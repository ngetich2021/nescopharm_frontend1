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
     *   'unit_value' => float|null,   // used to weight this line's share of shipping/logistics cost
     *   'unit_cost' => float|null,    // if known, becomes the product's new unit_cost
     * ]
     * @param float $shippingCost Total shipping cost for this shipment.
     * @param float $logisticsCost Total logistics cost for this shipment.
     * @return string[] Warnings for products whose current selling price no longer
     *                   exceeds the new minimum valid price (cost + shipping + logistics + margin).
     */
    public function apply(array $lines, float $shippingCost, float $logisticsCost): array
    {
        $warnings = [];

        $linesWithProduct = array_filter($lines, fn($line) => $line['product'] instanceof Product);
        if (empty($linesWithProduct)) {
            return $warnings;
        }

        $totalValue = 0;
        foreach ($linesWithProduct as $line) {
            $totalValue += (float) ($line['unit_value'] ?? 0) * (int) $line['quantity'];
        }

        $lineCount = count($linesWithProduct);

        foreach ($linesWithProduct as $line) {
            /** @var Product $product */
            $product = $line['product'];
            $quantity = max(1, (int) $line['quantity']);
            $lineValue = (float) ($line['unit_value'] ?? 0) * $quantity;
            $share = $totalValue > 0 ? ($lineValue / $totalValue) : (1 / $lineCount);

            $updates = [];
            if ($shippingCost > 0 || $logisticsCost > 0) {
                $updates['shipping_cost'] = round(($shippingCost * $share) / $quantity, 2);
                $updates['logistics_cost'] = round(($logisticsCost * $share) / $quantity, 2);
            }
            if (!empty($line['unit_cost'])) {
                $updates['unit_cost'] = $line['unit_cost'];
            }

            if (empty($updates)) {
                continue;
            }

            $product->update($updates);
            $product->refresh();

            $currentPrice = (float) $product->price;
            $minPrice = $product->minimum_valid_price;
            if ($currentPrice > 0 && $currentPrice <= $minPrice) {
                $warnings[] = "{$product->name}: current selling price (" . number_format($currentPrice, 2)
                    . ") no longer exceeds cost + shipping + logistics + margin (minimum "
                    . number_format($minPrice, 2) . "). Please review its pricing.";
            }
        }

        return $warnings;
    }
}
