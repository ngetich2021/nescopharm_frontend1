<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\ProductPackagingUnit;
use App\Models\ProductUnitInventory;
use App\Services\PackagingCalculatorService;
use App\Services\ProductPackagingService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;

class ProductPackagingController extends Controller
{
    protected $packagingService;
    protected $calculator;

    public function __construct(
        ProductPackagingService $packagingService,
        PackagingCalculatorService $calculator
    ) {
        $this->packagingService = $packagingService;
        $this->calculator = $calculator;
    }

    /**
     * Setup packaging for a product
     * POST /api/products/{productId}/packaging/setup
     */
    public function setupPackaging(Request $request, $productId)
    {
        $validator = Validator::make($request->all(), [
            'units' => 'required|array|min:1',
            'units.*.unit_name' => 'required|string|max:100',
            'units.*.unit_abbreviation' => 'required|string|max:20',
            'units.*.base_unit_quantity' => 'required|numeric|min:0.0001',
            'units.*.is_base_unit' => 'sometimes|boolean',
            'units.*.is_sellable' => 'sometimes|boolean',
            'units.*.is_purchasable' => 'sometimes|boolean',
            'units.*.price_per_unit' => 'nullable|numeric|min:0',
            'units.*.display_order' => 'sometimes|integer',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Validation failed',
                'message' => $validator->errors(), 'errors' => $validator->errors(),
            ], 400);
        }

        $product = Product::find($productId);
        if (!$product) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Product not found',
            ], 404);
        }

        $result = $this->packagingService->setupProductPackaging($product, $request->units);

        if ($result['success']) {
            return response()->json([
                'status' => 'success',
                'message' => $result['message'],
                'data' => $result,
            ], 201);
        }

        return response()->json([
            'status' => 'failed',
            'message' => $result['message'],
        ], 400);
    }

    /**
     * Get packaging units for a product
     * GET /api/products/{productId}/packaging/units
     */
    public function getPackagingUnits($productId)
    {
        $product = Product::find($productId);
        if (!$product) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Product not found',
            ], 404);
        }

        $units = ProductPackagingUnit::where('product_id', $productId)
            ->orderBy('display_order', 'asc')
            ->get();

        return response()->json([
            'status' => 'success',
            'data' => [
                'product_id' => $productId,
                'has_packaging' => $product->has_packaging,
                'base_unit' => $product->base_unit,
                'units' => $units,
            ],
        ], 200);
    }

    /**
     * Add a new packaging unit to a product
     * POST /api/products/{productId}/packaging/units
     */
    public function addPackagingUnit(Request $request, $productId)
    {
        $validator = Validator::make($request->all(), [
            'unit_name' => 'required|string|max:100',
            'unit_abbreviation' => 'required|string|max:20',
            'base_unit_quantity' => 'required|numeric|min:0.0001',
            'is_base_unit' => 'sometimes|boolean',
            'is_sellable' => 'sometimes|boolean',
            'is_purchasable' => 'sometimes|boolean',
            'price_per_unit' => 'nullable|numeric|min:0',
            'cost_per_unit' => 'nullable|numeric|min:0',
            'display_order' => 'sometimes|integer',
            'weight' => 'nullable|numeric|min:0',
            'length' => 'nullable|numeric|min:0',
            'width' => 'nullable|numeric|min:0',
            'height' => 'nullable|numeric|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Validation failed',
                'message' => $validator->errors(), 'errors' => $validator->errors(),
            ], 400);
        }

        $product = Product::find($productId);
        if (!$product) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Product not found',
            ], 404);
        }

        $result = $this->packagingService->addPackagingUnit($product, $request->all());

        if ($result['success']) {
            return response()->json([
                'status' => 'success',
                'message' => $result['message'],
                'data' => $result['unit'],
            ], 201);
        }

        return response()->json([
            'status' => 'failed',
            'message' => $result['message'],
        ], 400);
    }

    /**
     * Update a packaging unit
     * PUT /api/packaging/units/{unitId}
     */
    public function updatePackagingUnit(Request $request, $unitId)
    {
        $validator = Validator::make($request->all(), [
            'unit_name' => 'sometimes|string|max:100',
            'unit_abbreviation' => 'sometimes|string|max:20',
            'base_unit_quantity' => 'sometimes|numeric|min:0.0001',
            'is_sellable' => 'sometimes|boolean',
            'is_purchasable' => 'sometimes|boolean',
            'is_active' => 'sometimes|boolean',
            'price_per_unit' => 'nullable|numeric|min:0',
            'cost_per_unit' => 'nullable|numeric|min:0',
            'display_order' => 'sometimes|integer',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Validation failed',
                'message' => $validator->errors(), 'errors' => $validator->errors(),
            ], 400);
        }

        $unit = ProductPackagingUnit::find($unitId);
        if (!$unit) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Packaging unit not found',
            ], 404);
        }

        // Prevent changing base_unit_quantity for base unit
        if ($unit->is_base_unit && $request->has('base_unit_quantity') && $request->base_unit_quantity != 1) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Base unit quantity must remain 1',
            ], 400);
        }

        $unit->update($request->only([
            'unit_name',
            'unit_abbreviation',
            'base_unit_quantity',
            'is_sellable',
            'is_purchasable',
            'is_active',
            'price_per_unit',
            'cost_per_unit',
            'display_order',
            'weight',
            'length',
            'width',
            'height',
        ]));

        return response()->json([
            'status' => 'success',
            'message' => 'Packaging unit updated successfully',
            'data' => $unit->fresh(),
        ], 200);
    }

    /**
     * Delete a packaging unit
     * DELETE /api/packaging/units/{unitId}
     */
    public function deletePackagingUnit($unitId)
    {
        $unit = ProductPackagingUnit::find($unitId);
        if (!$unit) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Packaging unit not found',
            ], 404);
        }

        // Prevent deleting base unit
        if ($unit->is_base_unit) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Cannot delete base unit',
            ], 400);
        }

        $unit->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Packaging unit deleted successfully',
        ], 200);
    }

    /**
     * Calculate packaging breakdown for a quantity
     * POST /api/products/{productId}/packaging/calculate-breakdown
     */
    public function calculateBreakdown(Request $request, $productId)
    {
        $validator = Validator::make($request->all(), [
            'base_quantity' => 'required|integer|min:1',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Validation failed',
                'message' => $validator->errors(), 'errors' => $validator->errors(),
            ], 400);
        }

        $product = Product::find($productId);
        if (!$product) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Product not found',
            ], 404);
        }

        $breakdown = $this->calculator->calculatePackagingBreakdown($product, $request->base_quantity);

        return response()->json([
            'status' => 'success',
            'data' => $breakdown,
        ], 200);
    }

    /**
     * Convert between units
     * POST /api/packaging/convert
     */
    public function convertUnits(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'from_unit_id' => 'required|uuid|exists:product_packaging_units,id',
            'to_unit_id' => 'required|uuid|exists:product_packaging_units,id',
            'quantity' => 'required|numeric|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Validation failed',
                'message' => $validator->errors(), 'errors' => $validator->errors(),
            ], 400);
        }

        $result = $this->calculator->validateConversion(
            $request->from_unit_id,
            $request->to_unit_id,
            $request->quantity
        );

        if (!$result['valid']) {
            return response()->json([
                'status' => 'failed',
                'message' => $result['error'],
            ], 400);
        }

        return response()->json([
            'status' => 'success',
            'data' => $result,
        ], 200);
    }

    /**
     * Get inventory summary for a product
     * GET /api/products/{productId}/packaging/inventory
     */
    public function getInventorySummary(Request $request, $productId)
    {
        $product = Product::find($productId);
        if (!$product) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Product not found',
            ], 404);
        }

        $storeId = $request->query('store_id');
        $variantId = $request->query('variant_id');

        $summary = $this->packagingService->getInventorySummary($product, $storeId, $variantId);

        return response()->json([
            'status' => 'success',
            'data' => $summary,
        ], 200);
    }

    /**
     * Add inventory in a specific unit
     * POST /api/products/{productId}/packaging/inventory/add
     */
    public function addInventory(Request $request, $productId)
    {
        $validator = Validator::make($request->all(), [
            'store_id' => 'required|uuid|exists:stores,id',
            'unit_id' => 'required|uuid|exists:product_packaging_units,id',
            'quantity' => 'required|integer|min:1',
            'variant_id' => 'nullable|uuid|exists:product_variants,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Validation failed',
                'message' => $validator->errors(), 'errors' => $validator->errors(),
            ], 400);
        }

        $product = Product::find($productId);
        if (!$product) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Product not found',
            ], 404);
        }

        $result = $this->packagingService->addInventory(
            $product,
            $request->store_id,
            $request->unit_id,
            $request->quantity,
            $request->variant_id
        );

        if ($result['success']) {
            return response()->json([
                'status' => 'success',
                'message' => $result['message'],
                'data' => $result,
            ], 200);
        }

        return response()->json([
            'status' => 'failed',
            'message' => $result['message'],
        ], 400);
    }

    /**
     * Transfer inventory between units
     * POST /api/products/{productId}/packaging/inventory/transfer
     */
    public function transferInventory(Request $request, $productId)
    {
        $validator = Validator::make($request->all(), [
            'store_id' => 'required|uuid|exists:stores,id',
            'from_unit_id' => 'required|uuid|exists:product_packaging_units,id',
            'to_unit_id' => 'required|uuid|exists:product_packaging_units,id',
            'quantity' => 'required|integer|min:1',
            'variant_id' => 'nullable|uuid|exists:product_variants,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Validation failed',
                'message' => $validator->errors(), 'errors' => $validator->errors(),
            ], 400);
        }

        $product = Product::find($productId);
        if (!$product) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Product not found',
            ], 404);
        }

        $result = $this->packagingService->transferBetweenUnits(
            $product,
            $request->store_id,
            $request->from_unit_id,
            $request->to_unit_id,
            $request->quantity,
            $request->variant_id
        );

        if ($result['success']) {
            return response()->json([
                'status' => 'success',
                'message' => $result['message'],
                'data' => $result,
            ], 200);
        }

        return response()->json([
            'status' => 'failed',
            'message' => $result['message'],
        ], 400);
    }

    /**
     * Initialize unit inventory for a product at a store
     * POST /api/products/{productId}/packaging/inventory/initialize
     */
    public function initializeInventory(Request $request, $productId)
    {
        $validator = Validator::make($request->all(), [
            'store_id' => 'required|uuid|exists:stores,id',
            'variant_id' => 'nullable|uuid|exists:product_variants,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Validation failed',
                'message' => $validator->errors(), 'errors' => $validator->errors(),
            ], 400);
        }

        $product = Product::find($productId);
        if (!$product) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Product not found',
            ], 404);
        }

        $result = $this->packagingService->initializeUnitInventory(
            $product,
            $request->store_id,
            $request->variant_id
        );

        if ($result['success']) {
            return response()->json([
                'status' => 'success',
                'message' => $result['message'],
                'data' => $result,
            ], 201);
        }

        return response()->json([
            'status' => 'failed',
            'message' => $result['message'],
        ], 400);
    }

    /**
     * Validate packaging configuration for a product
     * GET /api/products/{productId}/packaging/validate
     */
    public function validateConfiguration($productId)
    {
        $product = Product::find($productId);
        if (!$product) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Product not found',
            ], 404);
        }

        $validation = $this->calculator->validatePackagingConfiguration($product);

        return response()->json([
            'status' => $validation['valid'] ? 'success' : 'failed',
            'data' => $validation,
        ], $validation['valid'] ? 200 : 400);
    }

    /**
     * Disable packaging for a product
     * DELETE /api/products/{productId}/packaging
     */
    public function disablePackaging($productId)
    {
        $product = Product::find($productId);
        if (!$product) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Product not found',
            ], 404);
        }

        $result = $this->packagingService->disableProductPackaging($product);

        if ($result['success']) {
            return response()->json([
                'status' => 'success',
                'message' => $result['message'],
            ], 200);
        }

        return response()->json([
            'status' => 'failed',
            'message' => $result['message'],
        ], 400);
    }
}
