<?php

namespace App\Services\TaxCompliance;

use App\Models\Company;
use App\Models\Etims\EtimsSupplierReceipt;

/**
 * AP-side: uploaded supplier receipt → DigiTax /verify → mark VAT-reclaimable.
 */
class EtimsSupplierReceiptService
{
    public function __construct(
        private readonly TaxComplianceProviderRegistry $registry,
    ) {}

    /**
     * Verify an already-uploaded supplier receipt. Updates its row in place.
     */
    public function verify(EtimsSupplierReceipt $receipt): EtimsSupplierReceipt
    {
        $company = Company::findOrFail($receipt->company_id);
        $provider = $this->registry->forCompany($company);

        $verdict = $provider->verifySupplierReceipt(
            company: $company,
            qrPayload: $receipt->qr_payload ?? '',
            supplierKraPin: $receipt->supplier_kra_pin,
            traderInvoiceNumber: $receipt->trader_invoice_number,
        );

        if (!$verdict->verified) {
            $receipt->update([
                'verification_status' => EtimsSupplierReceipt::INVALID,
                'verification_error' => $verdict->errorMessage,
                'verified_at' => now(),
                'vat_reclaimable' => false,
                'digitax_verify_payload' => $verdict->raw,
            ]);
            return $receipt->fresh();
        }

        $receipt->update([
            'verification_status' => EtimsSupplierReceipt::VERIFIED,
            'verification_error' => null,
            'verified_at' => now(),
            'vat_reclaimable' => $verdict->vatReclaimable,
            'supplier_kra_pin' => $verdict->supplierKraPin ?? $receipt->supplier_kra_pin,
            'trader_invoice_number' => $verdict->traderInvoiceNumber ?? $receipt->trader_invoice_number,
            'invoice_date' => $verdict->invoiceDate ?? $receipt->invoice_date,
            'total_amount' => $verdict->totalAmount ?? $receipt->total_amount,
            'tax_amount' => $verdict->taxAmount ?? $receipt->tax_amount,
            'currency' => $verdict->currency ?? $receipt->currency,
            'digitax_verify_payload' => $verdict->raw,
        ]);
        return $receipt->fresh();
    }
}
