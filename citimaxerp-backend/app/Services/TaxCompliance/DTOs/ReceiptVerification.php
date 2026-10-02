<?php

namespace App\Services\TaxCompliance\DTOs;

/**
 * Verdict from calling /verify on an uploaded supplier receipt (AP-side).
 */
final class ReceiptVerification
{
    public function __construct(
        public readonly bool $verified,
        public readonly ?string $supplierKraPin = null,
        public readonly ?string $traderInvoiceNumber = null,
        public readonly ?string $invoiceDate = null,
        public readonly ?float $totalAmount = null,
        public readonly ?float $taxAmount = null,
        public readonly ?string $currency = null,
        public readonly bool $vatReclaimable = false,
        public readonly ?string $errorMessage = null,
        public readonly array $raw = [],
    ) {}

    public static function valid(array $fields, array $raw = []): self
    {
        return new self(
            verified: true,
            supplierKraPin: $fields['supplier_kra_pin'] ?? null,
            traderInvoiceNumber: $fields['trader_invoice_number'] ?? null,
            invoiceDate: $fields['invoice_date'] ?? null,
            totalAmount: isset($fields['total_amount']) ? (float) $fields['total_amount'] : null,
            taxAmount: isset($fields['tax_amount']) ? (float) $fields['tax_amount'] : null,
            currency: $fields['currency'] ?? 'KES',
            vatReclaimable: (bool) ($fields['vat_reclaimable'] ?? true),
            raw: $raw,
        );
    }

    public static function invalid(string $message, array $raw = []): self
    {
        return new self(verified: false, errorMessage: $message, raw: $raw);
    }
}
