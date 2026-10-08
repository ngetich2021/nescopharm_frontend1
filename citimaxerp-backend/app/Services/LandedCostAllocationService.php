<?php

namespace App\Services;

use App\Models\Product;

/**
 * Distributes a shipment's total shipping/logistics cost across the products
 * received in that shipment (proportional to each line's value), and updates
 * each product's landed-cost basis (unit_cost, shipping_cost, logistics_cost)
 * accordingly. Used anywhere goods are actually received: standalone product
 * receipts and purchase-order receiving.
 */
class LandedCostAllocationService
{
    /**
     * @param array $lines Each entry: [
     *   'product' => Product|null,
     *   'quantity' => int,
     *   'unit_value' => float|null,
     *   'unit_cost' => float|null,
     * ]
     * @param float $shippingCost Legacy shipping cost (kept for backward compat).
     * @param float $logisticsCost Legacy logistics cost (kept for backward compat).
     * @param float $totalImportCost Sum of all import cost components for this receipt.
     * @return string[]
     */
    public function apply(array $lines, float $shippingCost, float $logisticsCost, float $totalImportCost = 0): array
    {
        $warnings = [];

        $linesWithProduct = array_filter($lines, fn($line) => $line['product'] instanceof Product);
        if (empty($linesWithProduct)) {
            return $warnings;
        }

        $overallCost = $shippingCost + $logisticsCost + $totalImportCost;

        $totalItems = 0;
        foreach ($linesWithProduct as $line) {
            $totalItems += max(1, (int) $line['quantity']);
        }

        foreach ($linesWithProduct as $line) {
            /** @var Product $product */
            $product = $line['product'];
            $quantity = max(1, (int) $line['quantity']);

            $updates = [];
            if ($overallCost > 0 && $totalItems > 0) {
                $costPerItem = round($overallCost / $totalItems, 2);
                $updates['shipping_cost'] = $costPerItem;
                $updates['logistics_cost'] = 0;
            }
            if (!empty($line['unit_cost'])) {
                $updates['unit_cost'] = $line['unit_cost'];
            }

            if (empty($updates)) {
                continue;
            }

            $product->update($updates);
        }

        return $warnings;
    }
}
