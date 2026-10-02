<?php

namespace App\Http\Controllers\Etims;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Etims\Concerns\ResolvesEtimsCompany;
use App\Jobs\Etims\SubmitInvoiceToEtimsJob;
use App\Models\CompanyEtimsConfig;
use App\Models\CreditNote;
use App\Models\Invoice;
use App\Services\TaxCompliance\EtimsCreditNoteService;
use App\Services\TaxCompliance\EtimsItemSyncService;
use App\Services\TaxCompliance\EtimsSaleService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

/**
 * Invoice-side eTIMS endpoints:
 *
 *   GET   /api/etims/invoices/{id}/status      - current eTIMS status + QR + signature
 *   POST  /api/etims/invoices/{id}/retry       - re-queue a failed submission
 *   POST  /api/etims/invoices/{id}/force-unlock - admin override (audit-logged)
 */
class EtimsInvoiceController extends Controller
{
    use ResolvesEtimsCompany;

    /**
     * Apply the same company/system-admin permission rules used by the core
     * invoice endpoints. This controller does not inherit InvoiceController,
     * so it must define the authorization helper locally.
     */
    protected function hasPermission(Request $request, string $permission, ?string $resourceCompanyId = null): bool
    {
        $user = $request->user();
        $role = $user?->role;

        if (!$role) {
            return false;
        }

        if ($role->hasPermission('can_manage_system')) {
            return true;
        }

        if ($role->hasPermission('can_manage_company')) {
            return $resourceCompanyId === null || (string) $user->company_id === (string) $resourceCompanyId;
        }

        return $role->hasPermission($permission);
    }

    public function status(
        Request $request,
        string $invoiceId,
        EtimsSaleService $saleService,
        EtimsItemSyncService $itemSyncService,
    ): JsonResponse {
        abort_unless($this->hasPermission($request, 'can_view_invoices', $this->resolveActiveCompanyId()), 403, 'Unauthorized');

        $companyId = (string) $this->resolveEtimsCompany($request)->id;
        $invoice = Invoice::where('company_id', $companyId)->findOrFail($invoiceId);

        // The invoice page polls this endpoint while work is pending. When the
        // application uses Laravel's synchronous queue driver, released jobs
        // cannot retry in the background, so use the poll to advance item
        // registration and dispatch the sale as soon as every item is ready.
        if ($invoice->etims_status === 'registering_items') {
            try {
                $items = $itemSyncService->prepareInvoiceProducts($invoice->company, $invoice);
                if ($items['status'] === 'ready') {
                    SubmitInvoiceToEtimsJob::dispatch((string) $invoice->id);
                } elseif ($items['status'] === 'failed') {
                    $invoice->update([
                        'etims_status' => 'failed',
                        'etims_last_error' => $items['message'],
                    ]);
                }
                $invoice->refresh();
            } catch (\Throwable) {
                // Keep polling; transient DigiTax errors are retried on the next poll.
            }
        }

        $needsReceiptDetails = $invoice->etims_status === 'completed'
            && (! $invoice->etims_serial_number || ! $invoice->etims_invoice_number || ! $invoice->etims_internal_data);

        if (($invoice->etims_status === 'submitted' || $needsReceiptDetails) && $invoice->etims_sale_id) {
            try {
                $saleService->refreshInvoice($invoice);
                $invoice->refresh();
            } catch (\Throwable) {
                // Status remains submitted; the next UI poll or webhook retries.
            }
        }

        return response()->json([
            'invoice_id' => $invoice->id,
            'invoice_number' => $invoice->invoice_number,
            'etims_requested' => $invoice->etims_requested,
            'etims_status' => $invoice->etims_status,
            'etims_sale_id' => $invoice->etims_sale_id,
            'etims_signature' => $invoice->etims_signature,
            'etims_qr_url' => $invoice->etims_qr_url,
            'etims_trader_invoice_number' => $invoice->etims_trader_invoice_number,
            'etims_receipt_number' => $invoice->etims_receipt_number,
            'etims_serial_number' => $invoice->etims_serial_number,
            'etims_invoice_number' => $invoice->etims_invoice_number,
            'etims_receipt_date' => $invoice->etims_receipt_date,
            'etims_receipt_time' => $invoice->etims_receipt_time,
            'etims_internal_data' => $invoice->etims_internal_data,
            'etims_submitted_at' => $invoice->etims_submitted_at?->toIso8601String(),
            'etims_synced_at' => $invoice->etims_synced_at?->toIso8601String(),
            'etims_last_error' => $invoice->etims_last_error,
            'etims_lock_state' => $invoice->etims_lock_state,
            'etims_lock_acquired_at' => $invoice->etims_lock_acquired_at?->toIso8601String(),
        ]);
    }

    public function retry(Request $request, string $invoiceId, EtimsCreditNoteService $creditNoteService): JsonResponse
    {
        abort_unless($this->hasPermission($request, 'can_update_invoices', $this->resolveActiveCompanyId()), 403, 'Unauthorized');

        $companyId = (string) $this->resolveEtimsCompany($request)->id;
        $invoice = Invoice::where('company_id', $companyId)->findOrFail($invoiceId);

        if (! in_array($invoice->etims_status, ['failed', 'response_invalid'], true)) {
            throw ValidationException::withMessages([
                'etims_status' => 'Only failed submissions can be retried (current: '.($invoice->etims_status ?? 'none').').',
            ]);
        }

        return $this->queueSubmission($invoice);
    }

    public function creditNoteStatus(Request $request, string $creditNoteId): JsonResponse
    {
        abort_unless($this->hasPermission($request, 'can_view_invoices', $this->resolveActiveCompanyId()), 403, 'Unauthorized');
        $companyId = (string) $this->resolveEtimsCompany($request)->id;
        $creditNote = CreditNote::where('company_id', $companyId)->findOrFail($creditNoteId);

        return response()->json([
            'invoice_id' => $creditNote->id,
            'invoice_number' => $creditNote->credit_note_number,
            'credit_note_id' => $creditNote->id,
            'credit_note_number' => $creditNote->credit_note_number,
            'etims_requested' => $creditNote->etims_requested,
            'etims_status' => $creditNote->etims_status,
            'etims_sale_id' => $creditNote->etims_sale_id,
            'etims_signature' => $creditNote->etims_signature,
            'etims_qr_url' => $creditNote->etims_qr_url,
            'etims_trader_invoice_number' => $creditNote->etims_trader_invoice_number,
            'etims_submitted_at' => $creditNote->etims_submitted_at?->toIso8601String(),
            'etims_synced_at' => $creditNote->etims_synced_at?->toIso8601String(),
            'etims_last_error' => $creditNote->etims_last_error,
            'etims_lock_state' => $creditNote->etims_lock_state,
            'etims_lock_acquired_at' => $creditNote->etims_lock_acquired_at?->toIso8601String(),
        ]);
    }

    public function retryCreditNote(
        Request $request,
        string $creditNoteId,
        EtimsCreditNoteService $creditNoteService,
    ): JsonResponse {
        abort_unless($this->hasPermission($request, 'can_update_invoices', $this->resolveActiveCompanyId()), 403, 'Unauthorized');
        $companyId = (string) $this->resolveEtimsCompany($request)->id;
        $creditNote = CreditNote::where('company_id', $companyId)->findOrFail($creditNoteId);
        if (! in_array($creditNote->etims_status, ['failed', 'response_invalid'], true)) {
            throw ValidationException::withMessages([
                'etims_status' => 'Only failed credit-note submissions can be retried.',
            ]);
        }
        $result = $creditNoteService->submit($creditNote);
        if (! in_array($result->status, ['pending', 'completed'], true)) {
            throw ValidationException::withMessages([
                'etims_status' => $result->errorMessage ?: 'DigiTax rejected the credit-note request.',
            ]);
        }

        return response()->json([
            'queued' => $result->status === 'pending',
            'etims_status' => $creditNote->fresh()->etims_status,
        ]);
    }

    /**
     * Manually raise an invoice on eTIMS when automatic generation was skipped.
     */
    public function submit(Request $request, string $invoiceId): JsonResponse
    {
        abort_unless($this->hasPermission($request, 'can_update_invoices', $this->resolveActiveCompanyId()), 403, 'Unauthorized');

        $companyId = (string) $this->resolveEtimsCompany($request)->id;
        $invoice = Invoice::where('company_id', $companyId)->findOrFail($invoiceId);

        if (in_array($invoice->etims_status, ['locked_pending', 'submitted', 'completed', 'voided_with_cn'], true)) {
            throw ValidationException::withMessages([
                'etims_status' => 'This invoice is already being processed or has already been raised on eTIMS.',
            ]);
        }

        $config = CompanyEtimsConfig::query()
            ->where('company_id', $companyId)
            ->notSuperseded()
            ->where('country_code', 'KE')
            ->latest()
            ->first();

        $readinessErrors = [];

        if (! $config) {
            $readinessErrors['etims_config'] = [
                'No Kenya eTIMS configuration exists. Open Settings → eTIMS and save the taxpayer identity.',
            ];
        } else {
            if (blank($config->kra_pin)) {
                $readinessErrors['kra_pin'] = [
                    'KRA PIN is missing. Save a valid KRA PIN before raising invoices.',
                ];
            }

            if (! $config->hasApiKey()) {
                $readinessErrors['digitax_api_key'] = [
                    'DigiTax API key is missing. Save the test API key before raising invoices.',
                ];
            }

            if ($config->last_test_connection_result !== 'success') {
                $readinessErrors['test_connection'] = [
                    'Test Connection has not succeeded yet. Run Test Connection and resolve the reported DigiTax or network error.',
                ];
            }

            if (! (bool) $config->enabled) {
                $readinessErrors['activation'] = [
                    'eTIMS is configured and tested but still disabled. Set a go-live date and click Enable eTIMS.',
                ];
            }
        }

        if ($readinessErrors !== []) {
            throw ValidationException::withMessages($readinessErrors);
        }

        return $this->queueSubmission($invoice);
    }

    public function forceUnlock(Request $request, string $invoiceId): JsonResponse
    {
        abort_unless($this->canManageCompany($request, $this->resolveActiveCompanyId()), 403, 'Unauthorized');

        $companyId = (string) $this->resolveEtimsCompany($request)->id;
        $invoice = Invoice::where('company_id', $companyId)->findOrFail($invoiceId);

        $invoice->update([
            'etims_lock_state' => null,
            'etims_lock_acquired_at' => null,
            'etims_status' => 'failed',
            'etims_last_error' => 'Force-unlocked by user '.Auth::id(),
        ]);

        return response()->json(['unlocked' => true]);
    }

    private function queueSubmission(Invoice $invoice): JsonResponse
    {
        $invoice->update([
            'etims_requested' => true,
            'etims_status' => null,
            'etims_last_error' => null,
            'etims_lock_state' => null,
            'etims_lock_acquired_at' => null,
        ]);
        SubmitInvoiceToEtimsJob::dispatch((string) $invoice->id)->afterCommit();

        return response()->json(['queued' => true]);
    }

    private function resolveActiveCompanyId(): string
    {
        if (function_exists('active_company_id')) {
            $id = active_company_id();
            if ($id) {
                return (string) $id;
            }
        }
        $user = Auth::user();
        if ($user && $user->company_id) {
            return (string) $user->company_id;
        }
        abort(403, 'Cannot resolve active company.');
    }
}
