<?php

namespace App\Http\Traits;

use App\Models\Product;
use App\Models\ProductVariant;

/**
 * Shared guard so nothing can pull more stock out of inventory than is
 * actually on hand - stock must never be allowed to go negative because a
 * sale, dispatch, repair, or breakage recorded more than what's available.
 * Mirrors the existing check already used in OrderController::store/update.
 */
trait ChecksStockAvailability
{
    /**
     * @return string|null An error message if stock is insufficient, or null if the
     *                      deduction is safe to proceed (product not found, product/variant
     *                      not tracking inventory, or quantity <= 0 all pass through - those
     *                      are handled/validated elsewhere).
     */
    protected function insufficientStockMessage(?Product $product, ?ProductVariant $variant, int $quantity): ?string
    {
        if (!$product || $quantity <= 0 || !$product->track_inventory) {
            return null;
        }

        $available = $variant ? (int) $variant->stock_quantity : (int) $product->stock_quantity;
        $label = $variant ? "{$product->name} ({$variant->name})" : $product->name;

        if ($quantity > $available) {
            return "Insufficient stock for {$label}: requested {$quantity}, only {$available} available.";
        }

        return null;
    }
}
