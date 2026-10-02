<?php

namespace App\Services;

use App\Models\Product;
use App\Models\ProductPackagingUnit;
use Illuminate\Support\Collection;

class PackagingCalculatorService
{
    /**
     * Convert quantity from one unit to base units
     * 
     * @param Product $product
     * @param float $quantity
     * @param string $unitId
     * @return float
     */
    public function convertToBaseUnits(Product $product, float $quantity, string $unitId): float
    {
        if (!$product->has_packaging) {
            return $quantity;
        }

        $unit = ProductPackagingUnit::find($unitId);
        
        if (!$unit || $unit->product_id !== $product->id) {
            return $quantity; // Fallback to original quantity
        }

        return $unit->toBaseUnits($quantity);
    }

    /**
     * Convert quantity from base units to a specific unit
     * 
     * @param Product $product
     * @param float $baseQuantity
     * @param string $unitId
     * @return float
     */
    public function convertFromBaseUnits(Product $product, float $baseQuantity, string $unitId): float
    {
        if (!$product->has_packaging) {
            return $baseQuantity;
        }

        $unit = ProductPackagingUnit::find($unitId);
        
        if (!$unit || $unit->product_id !== $product->id) {
            return $baseQuantity; // Fallback to original quantity
        }

        return $unit->fromBaseUnits($baseQuantity);
    }

    /**
     * Calculate optimal packaging breakdown for a given base quantity
     * This shows how to pack the quantity using available units (e.g., 125 pieces = 1 Carton + 2 Boxes + 5 Pieces)
     * 
     * @param Product $product
     * @param int $baseQuantity
     * @return array
     */
    public function calculatePackagingBreakdown(Product $product, int $baseQuantity): array
    {
        if (!$product->has_packaging || $baseQuantity <= 0) {
            return [
                'total_base_quantity' => $baseQuantity,
                'breakdown' => [],
                'display_text' => "{$baseQuantity} {$product->base_unit}(s)"
            ];
        }

        // Get all active packaging units ordered by size (largest first)
        $units = ProductPackagingUnit::where('product_id', $product->id)
            ->whereRaw('is_active = true')
            ->orderBy('base_unit_quantity', 'desc')
            ->get();

        if ($units->isEmpty()) {
            return [
                'total_base_quantity' => $baseQuantity,
                'breakdown' => [],
                'display_text' => "{$baseQuantity} {$product->base_unit}(s)"
            ];
        }

        $breakdown = [];
        $remaining = $baseQuantity;

        foreach ($units as $unit) {
            if ($remaining <= 0) {
                break;
            }

            $unitBaseQty = $unit->base_unit_quantity;
            
            if ($unitBaseQty <= 0) {
                continue;
            }

            // Calculate how many of this unit fit into the remaining quantity
            $unitsNeeded = floor($remaining / $unitBaseQty);

            if ($unitsNeeded > 0) {
                $breakdown[] = [
                    'unit_id' => $unit->id,
                    'unit_name' => $unit->unit_name,
                    'unit_abbreviation' => $unit->unit_abbreviation,
                    'quantity' => $unitsNeeded,
                    'base_unit_quantity' => $unitBaseQty,
                    'total_base_units' => $unitsNeeded * $unitBaseQty,
                ];

                $remaining -= ($unitsNeeded * $unitBaseQty);
            }
        }

        // Generate display text
        $displayText = $this->generateDisplayText($breakdown);

        return [
            'total_base_quantity' => $baseQuantity,
            'breakdown' => $breakdown,
            'display_text' => $displayText,
            'remaining_base_units' => $remaining, // Should be 0 if calculation is correct
        ];
    }

    /**
     * Generate human-readable display text from breakdown
     * 
     * @param array $breakdown
     * @return string
     */
    protected function generateDisplayText(array $breakdown): string
    {
        if (empty($breakdown)) {
            return '';
        }

        $parts = [];
        foreach ($breakdown as $item) {
            $unitName = $this->pluralize($item['unit_name'], $item['quantity']);
            $parts[] = "{$item['quantity']} {$unitName}";
        }

        return implode(' + ', $parts);
    }

    /**
     * Intelligently pluralize unit names
     * 
     * @param string $word
     * @param int $count
     * @return string
     */
    protected function pluralize(string $word, int $count): string
    {
        if ($count <= 1) {
            return $word;
        }

        $word = strtolower($word);
        
        // Words that end in 'box' -> 'boxes'
        if (str_ends_with($word, 'box')) {
            return $word . 'es';
        }
        
        // Words that end in 's', 'ss', 'sh', 'ch', 'x', 'z' -> add 'es'
        if (preg_match('/(s|ss|sh|ch|x|z)$/i', $word)) {
            return $word . 'es';
        }
        
        // Words that end in consonant + 'y' -> change 'y' to 'ies'
        if (preg_match('/[^aeiou]y$/i', $word)) {
            return substr($word, 0, -1) . 'ies';
        }
        
        // Words that end in 'f' or 'fe' -> change to 'ves'
        if (preg_match('/f$/i', $word)) {
            return substr($word, 0, -1) . 'ves';
        }
        if (preg_match('/fe$/i', $word)) {
            return substr($word, 0, -2) . 'ves';
        }
        
        // Default: just add 's'
        return $word . 's';
    }

    /**
     * Calculate total base quantity from mixed unit input
     * Example: 2 Cartons + 3 Boxes = ? base units
     * 
     * @param Product $product
     * @param array $units Array of ['unit_id' => quantity]
     * @return int
     */
    public function calculateTotalBaseQuantity(Product $product, array $units): int
    {
        $totalBaseQuantity = 0;

        foreach ($units as $unitId => $quantity) {
            if ($quantity <= 0) {
                continue;
            }

            $unit = ProductPackagingUnit::find($unitId);
            
            if ($unit && $unit->product_id === $product->id) {
                $totalBaseQuantity += $unit->toBaseUnits($quantity);
            }
        }

        return (int) $totalBaseQuantity;
    }

    /**
     * Get packaging suggestion for a given quantity
     * This provides recommendations on how to package/dispatch
     * 
     * @param Product $product
     * @param int $baseQuantity
     * @param array $options
     * @return array
     */
    public function getPackagingSuggestion(Product $product, int $baseQuantity, array $options = []): array
    {
        $preferLargerUnits = $options['prefer_larger_units'] ?? true;
        $breakdown = $this->calculatePackagingBreakdown($product, $baseQuantity);

        $suggestion = [
            'recommended_breakdown' => $breakdown,
            'instructions' => $this->generatePackagingInstructions($breakdown),
        ];

        // Add weight and dimension estimates if available
        if ($breakdown['breakdown']) {
            $totalWeight = 0;
            $totalVolume = 0;

            foreach ($breakdown['breakdown'] as $item) {
                $unit = ProductPackagingUnit::find($item['unit_id']);
                if ($unit) {
                    if ($unit->weight) {
                        $totalWeight += $unit->weight * $item['quantity'];
                    }
                    if ($unit->length && $unit->width && $unit->height) {
                        $totalVolume += ($unit->length * $unit->width * $unit->height) * $item['quantity'];
                    }
                }
            }

            if ($totalWeight > 0) {
                $suggestion['estimated_weight'] = $totalWeight;
            }
            if ($totalVolume > 0) {
                $suggestion['estimated_volume'] = $totalVolume;
            }
        }

        return $suggestion;
    }

    /**
     * Generate packaging instructions for warehouse/dispatch
     * 
     * @param array $breakdown
     * @return string
     */
    protected function generatePackagingInstructions(array $breakdown): string
    {
        if (empty($breakdown['breakdown'])) {
            return 'No packaging required.';
        }

        $instructions = "Pick the following:\n";
        foreach ($breakdown['breakdown'] as $item) {
            $instructions .= "- {$item['quantity']} {$item['unit_name']}(s) [{$item['unit_abbreviation']}]\n";
        }

        return trim($instructions);
    }

    /**
     * Validate unit conversion
     * Check if a given unit conversion makes sense
     * 
     * @param string $fromUnitId
     * @param string $toUnitId
     * @param float $quantity
     * @return array
     */
    public function validateConversion(string $fromUnitId, string $toUnitId, float $quantity): array
    {
        $fromUnit = ProductPackagingUnit::find($fromUnitId);
        $toUnit = ProductPackagingUnit::find($toUnitId);

        if (!$fromUnit || !$toUnit) {
            return [
                'valid' => false,
                'error' => 'Invalid unit(s) specified.',
            ];
        }

        if ($fromUnit->product_id !== $toUnit->product_id) {
            return [
                'valid' => false,
                'error' => 'Units belong to different products.',
            ];
        }

        $baseQuantity = $fromUnit->toBaseUnits($quantity);
        $convertedQuantity = $toUnit->fromBaseUnits($baseQuantity);

        return [
            'valid' => true,
            'from_unit' => $fromUnit->display_name,
            'to_unit' => $toUnit->display_name,
            'original_quantity' => $quantity,
            'converted_quantity' => $convertedQuantity,
            'base_quantity' => $baseQuantity,
        ];
    }

    /**
     * Calculate price for a specific unit quantity
     * 
     * @param Product $product
     * @param string $unitId
     * @param float $quantity
     * @return float
     */
    public function calculatePrice(Product $product, string $unitId, float $quantity): float
    {
        $unit = ProductPackagingUnit::find($unitId);
        
        if (!$unit || $unit->product_id !== $product->id) {
            return $product->price * $quantity;
        }

        $pricePerUnit = $unit->getCalculatedPrice();
        
        return $pricePerUnit ? ($pricePerUnit * $quantity) : 0;
    }

    /**
     * Get all available sellable units for a product
     * 
     * @param Product $product
     * @return Collection
     */
    public function getAvailableUnits(Product $product): Collection
    {
        if (!$product->has_packaging) {
            return collect([]);
        }

        return ProductPackagingUnit::where('product_id', $product->id)
            ->sellable()
            ->ordered()
            ->get();
    }

    /**
     * Format quantity display with unit
     * 
     * @param float $quantity
     * @param ProductPackagingUnit|null $unit
     * @return string
     */
    public function formatQuantityDisplay(float $quantity, ?ProductPackagingUnit $unit): string
    {
        if (!$unit) {
            return (string) $quantity;
        }

        return "{$quantity} {$unit->unit_abbreviation}";
    }

    /**
     * Check if product has valid packaging configuration
     * 
     * @param Product $product
     * @return array
     */
    public function validatePackagingConfiguration(Product $product): array
    {
        if (!$product->has_packaging) {
            return [
                'valid' => true,
                'message' => 'Product does not use packaging system.',
            ];
        }

        $units = ProductPackagingUnit::where('product_id', $product->id)
            ->whereRaw('is_active = true')
            ->get();

        if ($units->isEmpty()) {
            return [
                'valid' => false,
                'errors' => ['No packaging units defined for this product.'],
            ];
        }

        $baseUnits = $units->filter(function($unit) {
            return $unit->is_base_unit === true || $unit->is_base_unit === 'true';
        });
        
        if ($baseUnits->count() === 0) {
            return [
                'valid' => false,
                'errors' => ['No base unit defined. At least one unit must be marked as base unit.'],
            ];
        }

        if ($baseUnits->count() > 1) {
            return [
                'valid' => false,
                'errors' => ['Multiple base units defined. Only one unit can be the base unit.'],
            ];
        }

        $baseUnit = $baseUnits->first();
        if ($baseUnit->base_unit_quantity != 1) {
            return [
                'valid' => false,
                'errors' => ['Base unit must have base_unit_quantity of 1.'],
            ];
        }

        return [
            'valid' => true,
            'message' => 'Packaging configuration is valid.',
            'units_count' => $units->count(),
            'base_unit' => $baseUnit->unit_name,
        ];
    }
}
