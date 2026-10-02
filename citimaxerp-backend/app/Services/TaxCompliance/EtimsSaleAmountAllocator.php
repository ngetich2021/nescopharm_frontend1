<?php

namespace App\Services\TaxCompliance;

use App\Models\Invoice;
use RuntimeException;

final class EtimsSaleAmountAllocator
{
    public const ROUNDING_PRODUCT_PREFIX = 'ETIMS-ROUNDING-';

    /**
     * Produce the largest exact two-decimal DigiTax amount that does not
     * exceed the ERP total. Any remaining cents are reported separately on a
     * tax-category-matched rounding item.
     *
     * @return array{quantity: float, unit_price: float, total_amount: float, rounding_amount_cents: int}
     */
    public function allocate(int $quantityHundredths, int $totalAmountCents): array
    {
        if ($quantityHundredths <= 0 || $totalAmountCents < 0) {
            throw new RuntimeException('eTIMS invoice item quantities must be positive and totals cannot be negative.');
        }

        $unitPriceCents = intdiv($totalAmountCents * 100, $quantityHundredths);

        // DigiTax compares monetary totals at two decimals. Fractional
        // quantities therefore need a cent price whose product is also an
        // exact cent amount.
        while ($unitPriceCents > 0 && ($quantityHundredths * $unitPriceCents) % 100 !== 0) {
            $unitPriceCents--;
        }

        $allocatedCents = intdiv($quantityHundredths * $unitPriceCents, 100);
        if ($allocatedCents <= 0) {
            throw new RuntimeException('eTIMS cannot represent this item with a positive two-decimal unit price.');
        }

        return [
            'quantity' => $quantityHundredths / 100,
            'unit_price' => $unitPriceCents / 100,
            'total_amount' => $allocatedCents / 100,
            'rounding_amount_cents' => $totalAmountCents - $allocatedCents,
        ];
    }

    /** @return array<string, int> KRA tax code => rounding cents */
    public function roundingRequirements(Invoice $invoice): array
    {
        $invoice->loadMissing('lineItems.product');
        $requirements = [];

        $profiles = $invoice->lineItems->groupBy(
            fn ($line) => EtimsTaxType::key((string) $line->product_id, EtimsTaxType::forLine($line)),
        );

        foreach ($profiles as $lines) {
            $taxTypeCode = EtimsTaxType::forLine($lines->first());
            $quantityHundredths = (int) $lines->sum(
                fn ($line) => (int) round((float) $line->quantity * 100),
            );
            $totalAmountCents = (int) $lines->sum(
                fn ($line) => (int) round((float) $line->line_total * 100),
            );
            $allocation = $this->allocate($quantityHundredths, $totalAmountCents);

            if ($allocation['rounding_amount_cents'] > 0) {
                $requirements[$taxTypeCode] = ($requirements[$taxTypeCode] ?? 0)
                    + $allocation['rounding_amount_cents'];
            }
        }

        return $requirements;
    }

    public static function roundingProductCode(string $taxTypeCode): string
    {
        return self::ROUNDING_PRODUCT_PREFIX.strtoupper($taxTypeCode);
    }

    public static function roundingProductName(string $taxTypeCode): string
    {
        return 'eTIMS VAT-inclusive rounding adjustment ('.EtimsTaxType::label($taxTypeCode).')';
    }

    public static function taxRate(string $taxTypeCode): float
    {
        return match (strtoupper($taxTypeCode)) {
            'B' => 16.0,
            'E' => 8.0,
            default => 0.0,
        };
    }
}
