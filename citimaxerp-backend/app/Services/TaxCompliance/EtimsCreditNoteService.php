<?php

namespace App\Services\TaxCompliance;

use App\Models\Company;
use App\Models\CreditNote;
use App\Models\Etims\EtimsItemRegistration;
use App\Models\Invoice;
use App\Services\TaxCompliance\DTOs\SaleSubmission;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use InvalidArgumentException;

/** Maps Citimax's separate credit-note model to DigiTax's sale-shaped contract. */
class EtimsCreditNoteService
{
    public function __construct(
        private readonly TaxComplianceProviderRegistry $registry,
        private readonly EtimsCircuitBreaker $breaker,
    ) {}

    public function submit(CreditNote $creditNote): SaleSubmission
    {
        if (! $creditNote->invoice_id) {
            throw new InvalidArgumentException('An eTIMS credit note must reference an original invoice.');
        }

        $original = Invoice::where('company_id', $creditNote->company_id)->findOrFail($creditNote->invoice_id);
        if ($original->etims_status !== 'completed') {
            throw new InvalidArgumentException(
                "Cannot issue credit note: original invoice eTIMS status is '{$original->etims_status}', must be 'completed'.",
            );
        }
        if (! $original->etims_sale_id) {
            throw new InvalidArgumentException('Cannot issue eTIMS credit note: original invoice has no DigiTax sale ID.');
        }
        if ($creditNote->lineItems()->whereNull('product_id')->exists()) {
            throw new InvalidArgumentException('Cannot raise eTIMS credit note: every credited line must reference an eTIMS product.');
        }

        $creditNote->loadMissing(['lineItems.product', 'customer']);
        $productIds = $creditNote->lineItems->pluck('product_id')->filter()->unique()->values();
        $registrations = EtimsItemRegistration::query()
            ->where('company_id', $creditNote->company_id)
            ->whereIn('product_id', $productIds)
            ->where('sync_status', EtimsItemRegistration::STATUS_SYNCED)
            ->whereNotNull('digitax_item_id')
            ->get()
            ->groupBy('product_id');
        $missingProducts = $creditNote->lineItems
            ->filter(function ($line) use ($registrations) {
                $taxTypeCode = EtimsTaxType::forLine($line);
                $productRegistrations = $registrations->get($line->product_id, collect());

                return ! $productRegistrations->firstWhere('tax_type_code', $taxTypeCode)
                    && ! ($productRegistrations->count() === 1
                        && blank($productRegistrations->first()?->tax_type_code));
            })
            ->pluck('product_id')->unique()->values();
        if ($missingProducts->isNotEmpty()) {
            throw new InvalidArgumentException(
                'Cannot raise eTIMS credit note: credited products are not registered - '
                .$missingProducts->take(5)->implode(', '),
            );
        }

        $companyId = (string) $creditNote->company_id;
        if (! $this->breaker->allow($companyId)) {
            $message = 'DigiTax is temporarily paused after repeated failures; retry after the cooldown.';
            $creditNote->update(['etims_status' => 'failed', 'etims_last_error' => $message]);

            return SaleSubmission::failed('', $message);
        }

        $company = Company::findOrFail($companyId);
        $provider = $this->registry->forCompany($company);
        $clientRequestId = DB::transaction(function () use ($creditNote) {
            /** @var CreditNote $locked */
            $locked = CreditNote::where('company_id', $creditNote->company_id)
                ->lockForUpdate()->findOrFail($creditNote->id);
            if (in_array($locked->etims_status, ['submitted', 'completed'], true)) {
                return null;
            }
            if ($locked->etims_lock_state === EtimsSaleService::LOCK_STATE) {
                throw new InvalidArgumentException('This eTIMS credit note is already being submitted.');
            }

            $requestId = $locked->etims_client_request_id ?: (string) Str::uuid();
            $locked->update([
                'etims_client_request_id' => $requestId,
                'etims_status' => 'locked_pending',
                'etims_lock_state' => EtimsSaleService::LOCK_STATE,
                'etims_lock_acquired_at' => now(),
                'etims_last_error' => null,
            ]);

            return $requestId;
        });

        if ($clientRequestId === null) {
            $creditNote->refresh();

            return new SaleSubmission(
                status: $creditNote->etims_status === 'completed' ? 'completed' : 'pending',
                regulatorSaleId: $creditNote->etims_sale_id,
                clientRequestId: $creditNote->etims_client_request_id ?: '',
                signature: $creditNote->etims_signature,
                qrUrl: $creditNote->etims_qr_url,
                traderInvoiceNumber: $creditNote->etims_trader_invoice_number,
            );
        }

        $adapter = $this->invoiceAdapter($creditNote->fresh(['lineItems.product', 'customer']));
        try {
            $result = $provider->submitCreditNote($company, $original, $adapter, $clientRequestId);
        } catch (\Throwable $e) {
            $result = SaleSubmission::failed($clientRequestId, $e->getMessage());
        }
        if ($result->status === 'failed'
            && str_contains(strtolower((string) $result->errorMessage), 'trader_invoice_number has already been used')) {
            $result = $provider->findSaleSubmission($company, $adapter) ?? $result;
        }

        $newStatus = match ($result->status) {
            'pending' => 'submitted',
            'completed' => 'completed',
            'response_invalid' => 'response_invalid',
            default => 'failed',
        };
        $creditNote->update(array_merge([
            'etims_status' => $newStatus,
            'etims_sale_id' => $result->regulatorSaleId ?? $creditNote->etims_sale_id,
            'etims_signature' => $result->signature ?? $creditNote->etims_signature,
            'etims_qr_url' => $result->qrUrl ?? $creditNote->etims_qr_url,
            'etims_trader_invoice_number' => $result->traderInvoiceNumber ?? $creditNote->credit_note_number,
            'etims_submitted_at' => now(),
            'etims_synced_at' => $result->status === 'completed' ? now() : $creditNote->etims_synced_at,
            'etims_last_error' => $result->errorMessage,
            'etims_lock_state' => null,
            'etims_lock_acquired_at' => null,
        ], $this->receiptArtifacts($result->raw)));

        if (in_array($result->status, ['failed', 'response_invalid'], true)) {
            $this->breaker->recordFailure($companyId);
        } elseif (in_array($result->status, ['pending', 'completed'], true)) {
            $this->breaker->recordSuccess($companyId);
        }

        return $result;
    }

    private function invoiceAdapter(CreditNote $creditNote): Invoice
    {
        $invoice = new Invoice();
        $invoice->forceFill([
            'id' => $creditNote->id,
            'company_id' => $creditNote->company_id,
            'customer_id' => $creditNote->customer_id,
            'invoice_number' => $creditNote->credit_note_number,
            'invoice_date' => $creditNote->credit_note_date,
            'subtotal' => $creditNote->subtotal,
            'tax_amount' => $creditNote->tax_amount,
            'discount_amount' => $creditNote->discount_amount,
            'total_amount' => $creditNote->total_amount,
            'currency' => $creditNote->currency,
            'notes' => $creditNote->notes,
            'metadata' => $creditNote->metadata ?: [],
            'etims_client_request_id' => $creditNote->etims_client_request_id,
            'etims_sale_id' => $creditNote->etims_sale_id,
            'etims_trader_invoice_number' => $creditNote->etims_trader_invoice_number,
        ]);
        $invoice->setRelation('lineItems', $creditNote->lineItems);
        $invoice->setRelation('customer', $creditNote->customer);

        return $invoice;
    }

    /** @return array<string, string|int> */
    private function receiptArtifacts(array $payload): array
    {
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
