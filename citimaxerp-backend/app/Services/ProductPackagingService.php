<?php

namespace App\Services;

use App\Models\Product;
use App\Models\ProductPackagingUnit;
use App\Models\ProductUnitInventory;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ProductPackagingService
{
    protected $calculator;

    public function __construct(PackagingCalculatorService $calculator)
    {
        $this->calculator = $calculator;
    }

    /**
     * Enable packaging for a product and set up units
     * 
     * @param Product $product
     * @param array $units Array of unit definitions
     * @return array
     */
    public function setupProductPackaging(Product $product, array $units): array
    {
        try {
            DB::beginTransaction();

            // Enable packaging on product
            $baseUnit = $units[0]['unit_name'] ?? 'piece';
            
            // Use raw statement with explicit boolean casting for PostgreSQL
            DB::statement("UPDATE products SET has_packaging = ?::boolean, base_unit = ?, updated_at = ? WHERE id = ?", [
                'true',
                $baseUnit,
                now(),
                $product->id
            ]);

            $createdUnits = [];
            $baseUnitCount = 0;

            // Helper to convert boolean values for PostgreSQL
            // Returns string 'true'/'false' to avoid PDO integer conversion
            $toBool = function($value, $default = false) {
                if ($value === null) {
                    $result = $default;
                } else {
                    // Handle actual boolean values
                    if (is_bool($value)) {
                        $result = $value;
                    } else if (is_numeric($value)) {
                        $result = (bool)(int)$value;
                    } else if (is_string($value)) {
                        $lower = strtolower(trim($value));
                        $result = in_array($lower, ['true', '1', 'yes', 'on'], true);
                    } else {
                        $result = $default;
                    }
                }
                // Return string for PostgreSQL
                return $result ? 'true' : 'false';
            };

            foreach ($units as $index => $unitData) {
                $isBaseUnit = ($unitData['is_base_unit'] ?? ($index === 0));
                // Convert to boolean first for logic
                if (is_string($isBaseUnit)) {
                    $lower = strtolower(trim($isBaseUnit));
                    $isBaseUnit = in_array($lower, ['true', '1', 'yes', 'on'], true);
                } else {
                    $isBaseUnit = (bool)$isBaseUnit;
                }
                
                if ($isBaseUnit) {
                    $baseUnitCount++;
                }

                // Base unit must have quantity of 1
                if ($isBaseUnit && ($unitData['base_unit_quantity'] ?? 1) != 1) {
                    throw new \Exception('Base unit must have base_unit_quantity of 1');
                }

                $unit = ProductPackagingUnit::create([
                    'id' => (string) Str::uuid(),
                    'company_id' => $product->company_id,
                    'product_id' => $product->id,
                    'unit_name' => $unitData['unit_name'],
                    'unit_abbreviation' => $unitData['unit_abbreviation'],
                    'description' => $unitData['description'] ?? null,
                    'base_unit_quantity' => $unitData['base_unit_quantity'] ?? 1,
                    'is_base_unit' => $toBool($isBaseUnit),
                    'is_sellable' => $toBool($unitData['is_sellable'] ?? null, true),
                    'is_purchasable' => $toBool($unitData['is_purchasable'] ?? null, true),
                    'is_active' => $toBool($unitData['is_active'] ?? null, true),
                    'price_per_unit' => $unitData['price_per_unit'] ?? null,
                    'cost_per_unit' => $unitData['cost_per_unit'] ?? null,
                    'display_order' => $unitData['display_order'] ?? ($index + 1),
                    'barcode' => $unitData['barcode'] ?? null,
                    'weight' => $unitData['weight'] ?? null,
                    'length' => $unitData['length'] ?? null,
                    'width' => $unitData['width'] ?? null,
                    'height' => $unitData['height'] ?? null,
                ]);

                $createdUnits[] = $unit;
            }

            if ($baseUnitCount !== 1) {
                throw new \Exception('Exactly one unit must be marked as base unit');
            }

            DB::commit();

            return [
                'success' => true,
                'message' => 'Packaging setup completed successfully',
                'product_id' => $product->id,
                'units_created' => count($createdUnits),
                'units' => $createdUnits,
            ];

        } catch (\Exception $e) {
            DB::rollBack();
            return [
                'success' => false,
                'message' => 'Failed to setup packaging: ' . $e->getMessage(),
            ];
        }
    }

    /**
     * Add a new packaging unit to an existing product
     * 
     * @param Product $product
     * @param array $unitData
     * @return array
     */
    public function addPackagingUnit(Product $product, array $unitData): array
    {
        try {
            if (!$product->has_packaging) {
                return [
                    'success' => false,
                    'message' => 'Product does not have packaging enabled',
                ];
            }

            // Helper to convert boolean values to proper PHP booleans
            // Laravel's casts will handle conversion to PostgreSQL booleans
            $toBool = function($value, $default = false) {
                if ($value === null) {
                    return $default;
                }
                return filter_var($value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) ?? $default;
            };

            // Prevent adding another base unit
            $isBaseUnit = filter_var($unitData['is_base_unit'] ?? false, FILTER_VALIDATE_BOOLEAN);
            if ($isBaseUnit) {
                $existingBaseUnit = ProductPackagingUnit::where('product_id', $product->id)
                    ->where('is_base_unit', true)
                    ->exists();

                if ($existingBaseUnit) {
                    return [
                        'success' => false,
                        'message' => 'Product already has a base unit',
                    ];
                }
            }

            $unit = ProductPackagingUnit::create([
                'id' => (string) Str::uuid(),
                'company_id' => $product->company_id,
                'product_id' => $product->id,
                'unit_name' => $unitData['unit_name'],
                'unit_abbreviation' => $unitData['unit_abbreviation'],
                'description' => $unitData['description'] ?? null,
                'base_unit_quantity' => $unitData['base_unit_quantity'],
                'is_base_unit' => $toBool($isBaseUnit),
                'is_sellable' => $toBool($unitData['is_sellable'] ?? null, true),
                'is_purchasable' => $toBool($unitData['is_purchasable'] ?? null, true),
                'is_active' => $toBool($unitData['is_active'] ?? null, true),
                'price_per_unit' => $unitData['price_per_unit'] ?? null,
                'cost_per_unit' => $unitData['cost_per_unit'] ?? null,
                'display_order' => $unitData['display_order'] ?? 999,
                'barcode' => $unitData['barcode'] ?? null,
                'weight' => $unitData['weight'] ?? null,
                'length' => $unitData['length'] ?? null,
                'width' => $unitData['width'] ?? null,
                'height' => $unitData['height'] ?? null,
            ]);

            return [
                'success' => true,
                'message' => 'Packaging unit added successfully',
                'unit' => $unit,
            ];

        } catch (\Exception $e) {
            return [
                'success' => false,
                'message' => 'Failed to add packaging unit: ' . $e->getMessage(),
            ];
        }
    }

    /**
     * Initialize unit inventory records for a product at a store
     * 
     * @param Product $product
     * @param string $storeId
     * @param string|null $variantId
     * @return array
     */
    public function initializeUnitInventory(Product $product, string $storeId, ?string $variantId = null): array
    {
        try {
            if (!$product->has_packaging) {
                return [
                    'success' => false,
                    'message' => 'Product does not have packaging enabled',
                ];
            }

            $units = ProductPackagingUnit::where('product_id', $product->id)
                ->where('is_active', true)
                ->get();

            $inventoryRecords = [];

            foreach ($units as $unit) {
                // Check if inventory record already exists
                $existing = ProductUnitInventory::where('product_id', $product->id)
                    ->where('store_id', $storeId)
                    ->where('variant_id', $variantId)
                    ->where('unit_id', $unit->id)
                    ->first();

                if (!$existing) {
                    $inventory = ProductUnitInventory::create([
                        'id' => (string) Str::uuid(),
                        'company_id' => $product->company_id,
                        'store_id' => $storeId,
                        'product_id' => $product->id,
                        'variant_id' => $variantId,
                        'unit_id' => $unit->id,
                        'quantity' => 0,
                        'allocated' => 0,
                    ]);

                    $inventoryRecords[] = $inventory;
                }
            }

            return [
                'success' => true,
                'message' => 'Unit inventory initialized',
                'records_created' => count($inventoryRecords),
            ];

        } catch (\Exception $e) {
            return [
                'success' => false,
                'message' => 'Failed to initialize unit inventory: ' . $e->getMessage(),
            ];
        }
    }

    /**
     * Add inventory in a specific unit
     * 
     * @param Product $product
     * @param string $storeId
     * @param string $unitId
     * @param int $quantity
     * @param string|null $variantId
     * @return array
     */
    public function addInventory(Product $product, string $storeId, string $unitId, int $quantity, ?string $variantId = null): array
    {
        try {
            DB::beginTransaction();

            $inventory = ProductUnitInventory::where('product_id', $product->id)
                ->where('store_id', $storeId)
                ->where('variant_id', $variantId)
                ->where('unit_id', $unitId)
                ->first();

            if (!$inventory) {
                // Create if doesn't exist
                $inventory = ProductUnitInventory::create([
                    'id' => (string) Str::uuid(),
                    'company_id' => $product->company_id,
                    'store_id' => $storeId,
                    'product_id' => $product->id,
                    'variant_id' => $variantId,
                    'unit_id' => $unitId,
                    'quantity' => $quantity,
                    'allocated' => 0,
                ]);
            } else {
                $inventory->addInventory($quantity);
            }

            DB::commit();

            return [
                'success' => true,
                'message' => "Added {$quantity} units to inventory",
                'new_quantity' => $inventory->quantity,
                'available' => $inventory->available,
            ];

        } catch (\Exception $e) {
            DB::rollBack();
            return [
                'success' => false,
                'message' => 'Failed to add inventory: ' . $e->getMessage(),
            ];
        }
    }

    /**
     * Get inventory summary for a product across all units
     * 
     * @param Product $product
     * @param string|null $storeId
     * @param string|null $variantId
     * @return array
     */
    public function getInventorySummary(Product $product, ?string $storeId = null, ?string $variantId = null): array
    {
        if (!$product->has_packaging) {
            return [
                'has_packaging' => false,
                'total_base_units' => $product->stock_quantity ?? 0,
            ];
        }

        $query = ProductUnitInventory::where('product_id', $product->id)
            ->with('unit');

        if ($storeId) {
            $query->where('store_id', $storeId);
        }

        if ($variantId) {
            $query->where('variant_id', $variantId);
        }

        $inventories = $query->get();

        $summary = [
            'has_packaging' => true,
            'units' => [],
            'total_base_units' => 0,
            'total_available_base_units' => 0,
        ];

        foreach ($inventories as $inventory) {
            $unit = $inventory->unit;
            
            $summary['units'][] = [
                'unit_id' => $unit->id,
                'unit_name' => $unit->unit_name,
                'unit_abbreviation' => $unit->unit_abbreviation,
                'quantity' => $inventory->quantity,
                'allocated' => $inventory->allocated,
                'available' => $inventory->available,
                'base_unit_quantity' => $unit->base_unit_quantity,
                'total_base_units' => $inventory->getQuantityInBaseUnits(),
                'available_base_units' => $inventory->getAvailableInBaseUnits(),
            ];

            $summary['total_base_units'] += $inventory->getQuantityInBaseUnits();
            $summary['total_available_base_units'] += $inventory->getAvailableInBaseUnits();
        }

        // Add breakdown
        if ($summary['total_available_base_units'] > 0) {
            $breakdown = $this->calculator->calculatePackagingBreakdown(
                $product,
                (int) $summary['total_available_base_units']
            );
            $summary['packaging_breakdown'] = $breakdown;
        }

        return $summary;
    }

    /**
     * Transfer inventory between units (e.g., unpack 1 carton into 10 boxes)
     * 
     * @param Product $product
     * @param string $storeId
     * @param string $fromUnitId
     * @param string $toUnitId
     * @param int $quantity
     * @param string|null $variantId
     * @return array
     */
    public function transferBetweenUnits(
        Product $product,
        string $storeId,
        string $fromUnitId,
        string $toUnitId,
        int $quantity,
        ?string $variantId = null
    ): array {
        try {
            DB::beginTransaction();

            $fromUnit = ProductPackagingUnit::find($fromUnitId);
            $toUnit = ProductPackagingUnit::find($toUnitId);

            if (!$fromUnit || !$toUnit) {
                throw new \Exception('Invalid unit specified');
            }

            if ($fromUnit->product_id !== $product->id || $toUnit->product_id !== $product->id) {
                throw new \Exception('Units do not belong to this product');
            }

            // Get inventory records
            $fromInventory = ProductUnitInventory::where('product_id', $product->id)
                ->where('store_id', $storeId)
                ->where('variant_id', $variantId)
                ->where('unit_id', $fromUnitId)
                ->first();

            if (!$fromInventory || $fromInventory->available < $quantity) {
                throw new \Exception('Insufficient inventory in source unit');
            }

            // Remove from source unit
            $fromInventory->removeInventory($quantity);

            // Calculate equivalent quantity in target unit
            $baseQuantity = $fromUnit->toBaseUnits($quantity);
            $toQuantity = $toUnit->fromBaseUnits($baseQuantity);

            // Add to target unit
            $toInventory = ProductUnitInventory::where('product_id', $product->id)
                ->where('store_id', $storeId)
                ->where('variant_id', $variantId)
                ->where('unit_id', $toUnitId)
                ->first();

            if (!$toInventory) {
                $toInventory = ProductUnitInventory::create([
                    'id' => (string) Str::uuid(),
                    'company_id' => $product->company_id,
                    'store_id' => $storeId,
                    'product_id' => $product->id,
                    'variant_id' => $variantId,
                    'unit_id' => $toUnitId,
                    'quantity' => $toQuantity,
                    'allocated' => 0,
                ]);
            } else {
                $toInventory->addInventory($toQuantity);
            }

            DB::commit();

            return [
                'success' => true,
                'message' => "Transferred {$quantity} {$fromUnit->unit_abbreviation} to {$toQuantity} {$toUnit->unit_abbreviation}",
                'from_unit' => [
                    'unit_name' => $fromUnit->unit_name,
                    'quantity_removed' => $quantity,
                    'new_quantity' => $fromInventory->quantity,
                ],
                'to_unit' => [
                    'unit_name' => $toUnit->unit_name,
                    'quantity_added' => $toQuantity,
                    'new_quantity' => $toInventory->quantity,
                ],
            ];

        } catch (\Exception $e) {
            DB::rollBack();
            return [
                'success' => false,
                'message' => 'Transfer failed: ' . $e->getMessage(),
            ];
        }
    }

    /**
     * Disable packaging for a product
     * Warning: This will remove all packaging units and unit inventory!
     * 
     * @param Product $product
     * @return array
     */
    public function disableProductPackaging(Product $product): array
    {
        try {
            DB::beginTransaction();

            // Delete unit inventory records
            ProductUnitInventory::where('product_id', $product->id)->delete();

            // Delete packaging units
            ProductPackagingUnit::where('product_id', $product->id)->delete();

            // Disable packaging on product
            $product->has_packaging = false;
            $product->save();

            DB::commit();

            return [
                'success' => true,
                'message' => 'Packaging disabled successfully',
            ];

        } catch (\Exception $e) {
            DB::rollBack();
            return [
                'success' => false,
                'message' => 'Failed to disable packaging: ' . $e->getMessage(),
            ];
        }
    }
}
