<?php

namespace App\Services\TaxCompliance;

use App\Models\InvoiceLineItem;
use App\Models\CreditNoteLineItem;
use App\Models\Product;

final class EtimsTaxType
{
    public const VALID_CODES = ['A', 'B', 'C', 'D', 'E'];

    public static function forLine(InvoiceLineItem|CreditNoteLineItem $line): string
    {
        $explicit = data_get($line->metadata, 'etims_tax_type_code');
        if (self::isValid($explicit)) {
            return strtoupper((string) $explicit);
        }

        $rate = (float) $line->tax_rate;
        if ($rate === 0.0 && $line->product) {
            $productCode = self::forProduct($line->product);
            if (in_array($productCode, ['A', 'C', 'D'], true)) {
                return $productCode;
            }
        }

        return self::forRate($rate);
    }

    public static function fromInput(mixed $explicit, mixed $rate): string
    {
        if (self::isValid($explicit)) {
            return strtoupper((string) $explicit);
        }

        return self::forRate((float) $rate);
    }

    /**
     * Only an explicit VAT category or tax rate counts. is_taxable alone is
     * not trusted: the product forms default it to true on every save, so a
     * product with no rate set is Non-VAT rather than an assumed 16%.
     */
    public static function forProduct(Product $product): string
    {
        $vatCategoryCode = $product->vatCategory?->etims_tax_type_code;
        if (self::isValid($vatCategoryCode)) {
            return strtoupper((string) $vatCategoryCode);
        }

        if ($product->is_taxable === false || $product->tax_rate === null) {
            return 'D';
        }

        $rate = (float) $product->tax_rate;

        return $rate === 0.0 ? 'C' : self::forRate($rate);
    }

    public static function rateForProduct(?Product $product): float
    {
        return $product ? self::rate(self::forProduct($product)) : 0.0;
    }

    public static function key(string $productId, string $taxTypeCode): string
    {
        return $productId.':'.strtoupper($taxTypeCode);
    }

    public static function label(string $taxTypeCode): string
    {
        return match (strtoupper($taxTypeCode)) {
            'A' => 'Exempt',
            'B' => 'VAT 16%',
            'C' => 'Zero-rated',
            'E' => 'VAT 8%',
            default => 'Non-VAT',
        };
    }

    public static function rate(string $taxTypeCode): float
    {
        return match (strtoupper($taxTypeCode)) {
            'B' => 16.0,
            'E' => 8.0,
            default => 0.0,
        };
    }

    private static function forRate(float $rate): string
    {
        return match (round($rate, 2)) {
            0.0 => 'D',
            8.0 => 'E',
            default => 'B',
        };
    }

    private static function isValid(mixed $code): bool
    {
        return is_string($code) && in_array(strtoupper($code), self::VALID_CODES, true);
    }
}
