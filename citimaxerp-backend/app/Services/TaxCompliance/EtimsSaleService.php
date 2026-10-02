<?php

namespace App\Services\TaxCompliance;

use App\Models\Company;
use App\Models\CreditNote;
use App\Models\Etims\EtimsItemRegistration;
use App\Models\Invoice;
use App\Services\TaxCompliance\DTOs\SaleSubmission;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Sale submission orchestration. The provider does HTTP; this service handles:
 *
 *   - Pre-submit lock acquisition (Invoice::lockForUpdate + state transition)
 *   - Pre-submit item-registration check (fail-fast if any line product isn't registered)
 *   - Circuit-breaker gating
 *   - Post-submit state update + webhook correlation
 *
 * The post-submit state is intentionally NOT "completed" - that's the webhook's
 * job. We move to "submitted" / "failed" / "response_invalid".
 *
 * State machine on invoice.etims_status:
 *
 *   null|draft → locked_pending  (set by observer just before dispatch)
 *   locked_pending → submitted   (provider returned pending)
 *   locked_pending → failed      (provider returned failed)
 *   submitted → completed        (webhook: sale.sync success)
 *   submitted → failed           (webhook: sale.sync failure)
 * Credit notes use the same submitted/completed states on the credit-note
 * invoice itself; the original sale remains completed.
 */
class EtimsSaleService
{
    public const LOCK_STATE = 'locked_pending';

    public function __construct(
        private readonly TaxComplianceProviderRegistry $registry,
        private readonly EtimsCircuitBreaker $breaker,
    ) {}

    /**
     * Acquire the lock + assign a client_request_id, then submit.
     *
     * Returns null when the invoice is ineligible (no enabled config, country
     * mismatch, before go-live date, items not registered, breaker open) -
     * caller logs and moves on. Returns the SaleSubmission DTO otherwise.
     */
    public function submitInvoice(Invoice $invoice): ?SaleSubmission
    {
        $companyId = (string) $invoice->company_id;
        $company = Company::find($companyId);
        if (! $company) {
            return null;
        }

        if (! $this->breaker->allow($companyId)) {
            $message = 'DigiTax is temporarily paused after repeated failures; retry will happen after cooldown.';
            $invoice->update([
                'etims_status' => 'failed',
                'etims_lock_state' => null,
                'etims_lock_acquired_at' => null,
                'etims_last_error' => $message,
            ]);

            return SaleSubmission::failed('', $message, null, 0);
        }

        $clientRequestId = null;

        // Acquire pessimistic lock + flip state in one transaction
        DB::transaction(function () use ($invoice, &$clientRequestId) {
            /** @var Invoice $locked */
            $locked = Invoice::lockForUpdate()->find($invoice->id);
            if (! $locked) {
                return;
            }
            if ($locked->etims_lock_state === self::LOCK_STATE) {
                // already locked, reuse its request id
                $clientRequestId = $locked->etims_client_request_id;

                return;
            }
            if (in_array($locked->etims_status, ['submitted', 'completed'], true)) {
                // nothing to do
                return;
            }
            $clientRequestId = $locked->etims_client_request_id ?: (string) Str::uuid();
            $locked->etims_client_request_id = $clientRequestId;
            $locked->etims_lock_state = self::LOCK_STATE;
            $locked->etims_lock_acquired_at = now();
            $locked->etims_status = 'locked_pending';
            $locked->save();
        });

        if (! $clientRequestId) {
            return null;   // already in terminal state
        }

        // The lock was acquired through a separate lockForUpdate model. Reload
        // this instance so subsequent failure updates can reliably clear it.
        $invoice->refresh();

        // Pre-flight: every line item's product must be eTIMS-registered.
        $missing = $this->findUnregisteredLineItems($invoice, $companyId);
        if (! empty($missing)) {
            $msg = 'Cannot submit: products not registered with eTIMS - '.implode(', ', array_slice($missing, 0, 5));
            $invoice->update([
                'etims_status' => 'failed',
                'etims_lock_state' => null,
                'etims_lock_acquired_at' => null,
                'etims_last_error' => $msg,
            ]);

            return SaleSubmission::failed($clientRequestId, $msg);
        }

        $provider = $this->registry->forCompany($company);
        $result = $provider->submitSale($company, $invoice->fresh(), $clientRequestId);

        if ($result->status === 'failed'
            && str_contains(strtolower((string) $result->errorMessage), 'trader_invoice_number has already been used')) {
            $result = $provider->findSaleSubmission($company, $invoice->fresh()) ?? $result;
        }

        // Post-submit state transition. Webhook will flip submitted → completed.
        $newStatus = match ($result->status) {
            'pending' => 'submitted',
            'completed' => 'completed',
            'failed' => 'failed',
            'response_invalid' => 'response_invalid',
            default => 'failed',
        };

        $invoice->update(array_merge([
            'etims_status' => $newStatus,
            'etims_sale_id' => $result->regulatorSaleId ?? $invoice->etims_sale_id,
            'etims_signature' => $result->signature ?? $invoice->etims_signature,
            'etims_qr_url' => $result->qrUrl ?? $invoice->etims_qr_url,
            'etims_trader_invoice_number' => $result->traderInvoiceNumber ?? $invoice->invoice_number,
            'etims_submitted_at' => now(),
            'etims_synced_at' => $result->status === 'completed' ? now() : $invoice->etims_synced_at,
            'etims_last_error' => $result->errorMessage,
            'etims_lock_state' => $result->status === 'completed' ? null : $invoice->etims_lock_state,
        ], $this->receiptArtifacts($result->raw)));

        if ($result->status === 'failed') {
            $this->breaker->recordFailure($companyId);
            // Release the lock on hard-failure so the user can retry/edit.
            $invoice->update(['etims_lock_state' => null]);
        } elseif (in_array($result->status, ['pending', 'completed'], true)) {
            $this->breaker->recordSuccess($companyId);
        }

        return $result;
    }

    public function refreshInvoice(Invoice $invoice): ?SaleSubmission
    {
        $company = Company::find($invoice->company_id);
        if (! $company || ! $invoice->etims_sale_id) {
            return null;
        }

        $result = $this->registry->forCompany($company)->refreshSaleSubmission($company, $invoice);

        if ($result->status === 'completed') {
            $invoice->update(array_merge([
                'etims_status' => 'completed',
                'etims_sale_id' => $result->regulatorSaleId ?? $invoice->etims_sale_id,
                'etims_signature' => $result->signature ?? $invoice->etims_signature,
                'etims_qr_url' => $result->qrUrl ?? $invoice->etims_qr_url,
                'etims_trader_invoice_number' => $result->traderInvoiceNumber ?? $invoice->etims_trader_invoice_number,
                'etims_synced_at' => now(),
                'etims_lock_state' => null,
                'etims_lock_acquired_at' => null,
                'etims_last_error' => null,
            ], $this->receiptArtifacts($result->raw)));
            $this->breaker->recordSuccess((string) $invoice->company_id);
        } elseif (in_array($result->status, ['failed', 'response_invalid'], true)) {
            $invoice->update([
                'etims_status' => $result->status,
                'etims_lock_state' => null,
                'etims_lock_acquired_at' => null,
                'etims_last_error' => $result->errorMessage,
            ]);
            $this->breaker->recordFailure((string) $invoice->company_id);
        }

        return $result;
    }

    /**
     * Apply a sale.sync webhook payload to the originating invoice.
     */
    public function applyWebhookCompletion(string $companyId, array $payload): bool
    {
        $clientRequestId = $payload['client_request_id']
            ?? $payload['X-Client-Request-Id']
            ?? null;
        $regulatorSaleId = $payload['data']['digitax_id']
            ?? $payload['data']['id']
            ?? $payload['data']['sale_id']
            ?? $payload['sale_id']
            ?? null;
        $traderInvoiceNumber = $payload['data']['trader_invoice_number']
            ?? $payload['trader_invoice_number']
            ?? null;

        $query = Invoice::query()->where('company_id', $companyId);
        if ($clientRequestId) {
            $query->where('etims_client_request_id', $clientRequestId);
        } elseif ($regulatorSaleId) {
            $query->where('etims_sale_id', $regulatorSaleId);
        } elseif ($traderInvoiceNumber) {
            $query->where(function ($invoiceQuery) use ($traderInvoiceNumber) {
                $invoiceQuery->where('etims_trader_invoice_number', $traderInvoiceNumber)
                    ->orWhere('invoice_number', $traderInvoiceNumber);
            });
        } else {
            return false;
        }

        $invoice = $query->first();
        if (! $invoice) {
            $creditQuery = CreditNote::query()->where('company_id', $companyId);
            if ($clientRequestId) {
                $creditQuery->where('etims_client_request_id', $clientRequestId);
            } elseif ($regulatorSaleId) {
                $creditQuery->where('etims_sale_id', $regulatorSaleId);
            } else {
                $creditQuery->where(function ($query) use ($traderInvoiceNumber) {
                    $query->where('etims_trader_invoice_number', $traderInvoiceNumber)
                        ->orWhere('credit_note_number', $traderInvoiceNumber);
                });
            }
            $invoice = $creditQuery->first();
        }
        if (! $invoice) {
            return false;
        }

        $queueStatus = strtolower((string) ($payload['data']['queue_status'] ?? $payload['data']['status'] ?? 'completed'));
        $success = (bool) ($payload['data']['success'] ?? $payload['success'] ?? ($queueStatus === 'completed'));
        if (! $success) {
            $invoice->update([
                'etims_status' => 'failed',
                'etims_lock_state' => null,
                'etims_last_error' => $payload['data']['error'] ?? $payload['data']['message'] ?? $payload['error'] ?? 'DigiTax reported a failed eTIMS sync.',
            ]);

            return true;
        }

        $invoice->update(array_merge([
            'etims_status' => 'completed',
            'etims_sale_id' => $regulatorSaleId ?? $invoice->etims_sale_id,
            'etims_signature' => $payload['data']['receipt_signature'] ?? $payload['data']['signature'] ?? $payload['signature'] ?? $invoice->etims_signature,
            'etims_qr_url' => $payload['data']['etims_url'] ?? $payload['data']['qr_url'] ?? $payload['qr_url'] ?? $invoice->etims_qr_url,
            'etims_trader_invoice_number' => $payload['data']['trader_invoice_number'] ?? $payload['trader_invoice_number'] ?? $invoice->etims_trader_invoice_number,
            'etims_synced_at' => now(),
            'etims_lock_state' => null,
            'etims_last_error' => null,
        ], $this->receiptArtifacts($payload)));

        return true;
    }

    /**
     * @return array<int, string>
     */
    private function findUnregisteredLineItems(Invoice $invoice, string $companyId): array
    {
        $invoice->loadMissing('lineItems.product');
        $productIds = $invoice->lineItems
            ->pluck('product_id')
            ->filter()
            ->unique()
            ->all();

        if (empty($productIds)) {
            return [];
        }

        $registrations = EtimsItemRegistration::query()
            ->where('company_id', $companyId)
            ->whereIn('product_id', $productIds)
            ->where('sync_status', EtimsItemRegistration::STATUS_SYNCED)
            ->whereNotNull('digitax_item_id')
            ->get()
            ->groupBy('product_id');

        return $invoice->lineItems
            ->filter(fn ($line) => ! $this->registrationForLine($registrations, $line))
            ->map(fn ($line) => (string) $line->product_id)
            ->unique()
            ->values()
            ->all();
    }

    private function registrationForLine($registrations, $line): ?EtimsItemRegistration
    {
        $taxTypeCode = EtimsTaxType::forLine($line);
        $productRegistrations = $registrations->get($line->product_id, collect());
        $registration = $productRegistrations->firstWhere('tax_type_code', $taxTypeCode);

        if (! $registration
            && $productRegistrations->count() === 1
            && blank($productRegistrations->first()?->tax_type_code)) {
            return $productRegistrations->first();
        }

        return $registration;
    }

    /**
     * Extract the KRA receipt fields that DigiTax returns either at the root or
     * inside its `data` envelope. Empty values are omitted so a partial webhook
     * cannot erase details already captured by a later status refresh.
     *
     * @return array<string, string|int>
     */
    private function receiptArtifacts(array $payload): array
    {
        // Supports rolling deployments where application code may briefly run
        // before the additive receipt-details migration has completed.
        if (! Schema::hasColumn('invoices', 'etims_receipt_number')) {
            return [];
        }

        $data = is_array($payload['data'] ?? null) ? $payload['data'] : $payload;

        return array_filter([
            'etims_receipt_number' => $data['receipt_number'] ?? null,
            'etims_serial_number' => $data['serial_number'] ?? $data['scu_id'] ?? null,
            'etims_invoice_number' => $data['invoice_number'] ?? $data['scu_invoice_number'] ?? null,
            'etims_receipt_date' => $data['date'] ?? $data['receipt_date'] ?? null,
            'etims_receipt_time' => $data['time'] ?? $data['receipt_time'] ?? null,
            'etims_internal_data' => $data['internal_data'] ?? null,
        ], static fn ($value) => $value !== null && $value !== '');
    }
}
