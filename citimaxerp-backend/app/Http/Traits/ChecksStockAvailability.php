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

    /**
     * Checks every line and reports all the short ones together, so a quote or order with
     * several missing products names them all at once instead of one per attempt.
     *
     * @param  iterable<array{0: ?Product, 1: ?ProductVariant, 2: int}>  $lines
     * @return string|null One message listing each short line, or null if all are covered.
     */
    protected function insufficientStockSummary(iterable $lines): ?string
    {
        $short = [];
        foreach ($lines as [$product, $variant, $quantity]) {
            if (!$product || $quantity <= 0 || !$product->track_inventory) continue;
            $available = $variant ? (int) $variant->stock_quantity : (int) $product->stock_quantity;
            if ($quantity > $available) {
                $label = $variant ? "{$product->name} ({$variant->name})" : $product->name;
                $short[] = "• {$label}: requested {$quantity}, only {$available} available";
            }
        }

        if (!$short) return null;

        $count = count($short);
        return ($count === 1 ? '1 product does not' : "{$count} products do not") . " have enough stock:\n" . implode("\n", $short);
    }
}
