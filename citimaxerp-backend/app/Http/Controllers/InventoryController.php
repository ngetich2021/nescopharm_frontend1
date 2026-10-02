<?php

namespace App\Http\Controllers;

use App\Models\InventoryBatch;
use App\Models\InventoryMovement;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Store;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use App\Http\Traits\HandlesDatabaseErrors;

class InventoryController extends Controller
{
    use HandlesDatabaseErrors;

    public function __construct()
    {
        $this->middleware('auth:sanctum');
    }

    protected function hasPermission(Request $request, $permission, $resourceCompanyId = null)
    {
        $user = $request->user();
        $role = $user->role;
        if (!$role) {
            return false;
        }
        if ($role->hasPermission('can_manage_system')) {
            return true;
        }
        if ($role->hasPermission('can_manage_company')) {
            if ($resourceCompanyId !== null) {
                return $user->company_id === $resourceCompanyId;
            }
            return true;
        }
        return $role->hasPermission($permission);
    }

    /**
     * Get inventory summary for a company
     */
    public function getInventorySummary(Request $request): JsonResponse
    {
        try {
            $user = $request->user();
            $companyId = $user->company_id;

            if (!$this->hasPermission($request, 'can_view_inventory', $companyId)) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $storeId = $request->get('store_id');
            $query = InventoryBatch::forCompany($companyId);
            
            if ($storeId) {
                $query->forStore($storeId);
            }

            $summary = [
                'total_batches' => $query->count(),
                'active_batches' => $query->active()->count(),
                'expired_batches' => $query->expired()->count(),
                'expiring_soon' => $query->expiringSoon(30)->count(),
                'total_quantity' => $query->sum('quantity_available'),
                'total_allocated' => $query->sum('quantity_allocated'),
                'total_value' => $query->selectRaw('SUM(quantity_available * unit_cost)')->value('SUM(quantity_available * unit_cost)') ?? 0,
            ];

            // Recent movements
            $recentMovements = InventoryMovement::forCompany($companyId)
                ->when($storeId, fn($q) => $q->forStore($storeId))
                ->with(['product', 'variant', 'batch', 'createdBy'])
                ->recent(7)
                ->orderBy('movement_date', 'desc')
                ->limit(10)
                ->get();

            return response()->json([
                'summary' => $summary,
                'recent_movements' => $recentMovements
            ]);

        } catch (\Exception $e) {
            return $this->handleDatabaseError($e, 'fetching inventory summary');
        }
    }

    /**
     * Get all inventory batches
     */
    public function getBatches(Request $request): JsonResponse
    {
        try {
            $user = $request->user();
            $companyId = $user->company_id;

            if (!$this->hasPermission($request, 'can_view_inventory', $companyId)) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $query = InventoryBatch::with(['product', 'variant', 'store', 'supplier'])
                ->forCompany($companyId);

            // Filters
            if ($request->has('store_id')) {
                $query->forStore($request->store_id);
            }

            if ($request->has('product_id')) {
                $query->where('product_id', $request->product_id);
            }

            if ($request->has('status')) {
                $query->where('status', $request->status);
            }

            if ($request->has('expiring_soon')) {
                $query->expiringSoon($request->get('expiring_days', 30));
            }

            if ($request->has('expired')) {
                $query->expired();
            }

            if ($request->has('batch_number')) {
                $query->where('batch_number', 'ilike', '%' . $request->batch_number . '%');
            }

            // Sorting
            $sortBy = $request->get('sort_by', 'created_at');
            $sortOrder = $request->get('sort_order', 'desc');
            $query->orderBy($sortBy, $sortOrder);

            $batches = $query->paginate($request->get('per_page', 15));

            return response()->json($batches);

        } catch (\Exception $e) {
            return $this->handleDatabaseError($e, 'fetching inventory batches');
        }
    }

    /**
     * Create a new inventory batch
     */
    public function createBatch(Request $request): JsonResponse
    {
        $user = $request->user();
        $companyId = $user->company_id;

        if (!$this->hasPermission($request, 'can_create_inventory', $companyId)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validator = Validator::make($request->all(), [
            'store_id' => 'nullable|exists:stores,id',
            'product_id' => 'required|exists:products,id',
            'variant_id' => 'nullable|exists:product_variants,id',
            'batch_number' => 'nullable|string|max:100',
            'lot_number' => 'nullable|string|max:100',
            'serial_number' => 'nullable|string|max:100',
            'quantity_received' => 'required|integer|min:1',
            'manufacture_date' => 'nullable|date',
            'expiry_date' => 'nullable|date|after_or_equal:manufacture_date',
            'received_date' => 'required|date',
            'unit_cost' => 'nullable|numeric|min:0',
            'selling_price' => 'nullable|numeric|min:0',
            'supplier' => 'nullable|string|max:255',
            'supplier_id' => 'nullable|exists:suppliers,id',
            'purchase_order_number' => 'nullable|string|max:100',
            'product_receipt_id' => 'nullable|exists:product_receipts,id',
            'notes' => 'nullable|string',
            'custom_attributes' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => $validator->errors(), 'errors' => $validator->errors()], 422);
        }

        try {
            DB::beginTransaction();

            // Generate batch number if not provided
            $batchNumber = $request->batch_number ?? InventoryBatch::generateBatchNumber($companyId, $request->product_id);

            // Check for duplicate batch number
            $existingBatch = InventoryBatch::where('batch_number', $batchNumber)->first();
            if ($existingBatch) {
                return response()->json(['message' => 'Batch number already exists'], 422);
            }

            $batch = InventoryBatch::create([
                'company_id' => $companyId,
                'store_id' => $request->store_id,
                'product_id' => $request->product_id,
                'variant_id' => $request->variant_id,
                'batch_number' => $batchNumber,
                'lot_number' => $request->lot_number,
                'serial_number' => $request->serial_number,
                'quantity_received' => $request->quantity_received,
                'quantity_available' => $request->quantity_received,
                'manufacture_date' => $request->manufacture_date,
                'expiry_date' => $request->expiry_date,
                'received_date' => $request->received_date,
                'unit_cost' => $request->unit_cost,
                'selling_price' => $request->selling_price,
                'supplier' => $request->supplier,
                'supplier_id' => $request->supplier_id,
                'purchase_order_number' => $request->purchase_order_number,
                'product_receipt_id' => $request->product_receipt_id,
                'notes' => $request->notes,
                'custom_attributes' => $request->custom_attributes,
                'status' => 'active',
            ]);

            // Create initial receipt movement
            InventoryMovement::createReceipt([
                'company_id' => $companyId,
                'store_id' => $request->store_id,
                'product_id' => $request->product_id,
                'variant_id' => $request->variant_id,
                'batch_id' => $batch->id,
                'quantity' => $request->quantity_received,
                'quantity_before' => 0,
                'quantity_after' => $request->quantity_received,
                'unit_cost' => $request->unit_cost,
                'unit_price' => $request->selling_price,
                'total_cost' => $request->quantity_received * ($request->unit_cost ?? 0),
                'reference_type' => $request->product_receipt_id ? 'product_receipt' : 'manual',
                'reference_id' => $request->product_receipt_id,
                'reference_number' => $request->purchase_order_number,
                'created_by' => $user->id,
                'notes' => 'Initial batch receipt',
            ]);

            // Update product stock quantities
            $this->updateProductStock($request->product_id, $request->variant_id, $request->quantity_received);

            DB::commit();

            return response()->json([
                'message' => 'Inventory batch created successfully',
                'data' => $batch->load(['product', 'variant', 'store', 'supplier'])
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to create inventory batch', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Failed to create inventory batch', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Get specific batch details
     */
    public function getBatch(Request $request, string $id): JsonResponse
    {
        try {
            $user = $request->user();
            $companyId = $user->company_id;

            if (!$this->hasPermission($request, 'can_view_inventory', $companyId)) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $batch = InventoryBatch::with([
                'product', 
                'variant', 
                'store', 
                'supplier', 
                'productReceipt',
                'movements' => function($query) {
                    $query->with(['createdBy'])->orderBy('movement_date', 'desc');
                }
            ])
            ->forCompany($companyId)
            ->findOrFail($id);

            return response()->json($batch);

        } catch (\Exception $e) {
            return $this->handleDatabaseError($e, 'fetching inventory batch');
        }
    }

    /**
     * Update inventory batch
     */
    public function updateBatch(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        $companyId = $user->company_id;

        if (!$this->hasPermission($request, 'can_update_inventory', $companyId)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validator = Validator::make($request->all(), [
            'lot_number' => 'nullable|string|max:100',
            'serial_number' => 'nullable|string|max:100',
            'manufacture_date' => 'nullable|date',
            'expiry_date' => 'nullable|date|after_or_equal:manufacture_date',
            'unit_cost' => 'nullable|numeric|min:0',
            'selling_price' => 'nullable|numeric|min:0',
            'supplier' => 'nullable|string|max:255',
            'supplier_id' => 'nullable|exists:suppliers,id',
            'purchase_order_number' => 'nullable|string|max:100',
            'status' => 'sometimes|in:active,expired,recalled,damaged,sold_out',
            'notes' => 'nullable|string',
            'custom_attributes' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => $validator->errors(), 'errors' => $validator->errors()], 422);
        }

        try {
            $batch = InventoryBatch::forCompany($companyId)->findOrFail($id);

            $batch->update($request->only([
                'lot_number',
                'serial_number', 
                'manufacture_date',
                'expiry_date',
                'unit_cost',
                'selling_price',
                'supplier',
                'supplier_id',
                'purchase_order_number',
                'status',
                'notes',
                'custom_attributes',
            ]));

            // Auto-update status based on dates and quantities
            $batch->updateStatus();

            return response()->json([
                'message' => 'Inventory batch updated successfully',
                'data' => $batch->load(['product', 'variant', 'store', 'supplier'])
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to update inventory batch', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Failed to update inventory batch', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Allocate quantity from batch (for orders/reservations)
     */
    public function allocateQuantity(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        $companyId = $user->company_id;

        if (!$this->hasPermission($request, 'can_update_inventory', $companyId)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validator = Validator::make($request->all(), [
            'quantity' => 'required|integer|min:1',
            'reference_type' => 'nullable|string',
            'reference_id' => 'nullable|string',
            'reference_number' => 'nullable|string',
            'notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => $validator->errors(), 'errors' => $validator->errors()], 422);
        }

        try {
            $batch = InventoryBatch::forCompany($companyId)->findOrFail($id);

            if (!$batch->canAllocate($request->quantity)) {
                return response()->json([
                    'message' => 'Insufficient available quantity in batch',
                    'available_quantity' => $batch->quantity_available,
                    'requested_quantity' => $request->quantity
                ], 422);
            }

            DB::beginTransaction();

            $quantityBefore = $batch->quantity_available;
            $batch->allocateQuantity($request->quantity, $request->notes);

            // Create allocation movement
            InventoryMovement::create([
                'company_id' => $companyId,
                'store_id' => $batch->store_id,
                'product_id' => $batch->product_id,
                'variant_id' => $batch->variant_id,
                'batch_id' => $batch->id,
                'type' => 'allocation',
                'quantity' => -$request->quantity,
                'quantity_before' => $quantityBefore,
                'quantity_after' => $batch->quantity_available,
                'reference_type' => $request->reference_type,
                'reference_id' => $request->reference_id,
                'reference_number' => $request->reference_number,
                'unit_cost' => $batch->unit_cost,
                'unit_price' => $batch->selling_price,
                'created_by' => $user->id,
                'notes' => $request->notes,
            ]);

            DB::commit();

            return response()->json([
                'message' => 'Quantity allocated successfully',
                'data' => [
                    'batch_id' => $batch->id,
                    'allocated_quantity' => $request->quantity,
                    'remaining_available' => $batch->quantity_available,
                    'total_allocated' => $batch->quantity_allocated
                ]
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to allocate quantity', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Failed to allocate quantity', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Record sale from batch
     */
    public function recordSale(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        $companyId = $user->company_id;

        if (!$this->hasPermission($request, 'can_update_inventory', $companyId)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validator = Validator::make($request->all(), [
            'quantity' => 'required|integer|min:1',
            'unit_price' => 'nullable|numeric|min:0',
            'reference_type' => 'nullable|string',
            'reference_id' => 'nullable|string',
            'reference_number' => 'nullable|string',
            'notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => $validator->errors(), 'errors' => $validator->errors()], 422);
        }

        try {
            $batch = InventoryBatch::forCompany($companyId)->findOrFail($id);

            if ($batch->quantity_allocated < $request->quantity) {
                return response()->json([
                    'message' => 'Insufficient allocated quantity for sale',
                    'allocated_quantity' => $batch->quantity_allocated,
                    'requested_quantity' => $request->quantity
                ], 422);
            }

            DB::beginTransaction();

            $quantityBefore = $batch->quantity_allocated;
            $unitPrice = $request->unit_price ?? $batch->selling_price;
            
            $batch->sellQuantity($request->quantity, $unitPrice, $request->notes);

            // Create sale movement
            InventoryMovement::createSale([
                'company_id' => $companyId,
                'store_id' => $batch->store_id,
                'product_id' => $batch->product_id,
                'variant_id' => $batch->variant_id,
                'batch_id' => $batch->id,
                'quantity' => $request->quantity,
                'quantity_before' => $quantityBefore,
                'quantity_after' => $batch->quantity_allocated,
                'reference_type' => $request->reference_type,
                'reference_id' => $request->reference_id,
                'reference_number' => $request->reference_number,
                'unit_cost' => $batch->unit_cost,
                'unit_price' => $unitPrice,
                'total_cost' => $request->quantity * ($batch->unit_cost ?? 0),
                'total_value' => $request->quantity * $unitPrice,
                'created_by' => $user->id,
                'notes' => $request->notes,
            ]);

            // Update product stock quantities
            $this->updateProductStock($batch->product_id, $batch->variant_id, -$request->quantity);

            DB::commit();

            return response()->json([
                'message' => 'Sale recorded successfully',
                'data' => [
                    'batch_id' => $batch->id,
                    'sold_quantity' => $request->quantity,
                    'unit_price' => $unitPrice,
                    'total_value' => $request->quantity * $unitPrice,
                    'remaining_allocated' => $batch->quantity_allocated,
                    'batch_status' => $batch->status
                ]
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to record sale', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Failed to record sale', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Make inventory adjustment
     */
    public function makeAdjustment(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        $companyId = $user->company_id;

        if (!$this->hasPermission($request, 'can_update_inventory', $companyId)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validator = Validator::make($request->all(), [
            'adjustment_quantity' => 'required|integer',
            'adjustment_type' => 'required|in:available,damaged,expired',
            'reason' => 'required|string',
            'notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => $validator->errors(), 'errors' => $validator->errors()], 422);
        }

        try {
            $batch = InventoryBatch::forCompany($companyId)->findOrFail($id);
            $adjustmentQuantity = $request->adjustment_quantity;
            $adjustmentType = $request->adjustment_type;

            DB::beginTransaction();

            $quantityBefore = $batch->quantity_available;

            switch ($adjustmentType) {
                case 'available':
                    $batch->quantity_available += $adjustmentQuantity;
                    break;
                case 'damaged':
                    if ($batch->quantity_available < abs($adjustmentQuantity)) {
                        return response()->json(['message' => 'Insufficient available quantity for damage adjustment'], 422);
                    }
                    $batch->quantity_available -= abs($adjustmentQuantity);
                    $batch->quantity_damaged += abs($adjustmentQuantity);
                    break;
                case 'expired':
                    if ($batch->quantity_available < abs($adjustmentQuantity)) {
                        return response()->json(['message' => 'Insufficient available quantity for expiry adjustment'], 422);
                    }
                    $batch->quantity_available -= abs($adjustmentQuantity);
                    $batch->quantity_expired += abs($adjustmentQuantity);
                    break;
            }

            $batch->save();
            $batch->updateStatus();

            // Create adjustment movement
            InventoryMovement::createAdjustment([
                'company_id' => $companyId,
                'store_id' => $batch->store_id,
                'product_id' => $batch->product_id,
                'variant_id' => $batch->variant_id,
                'batch_id' => $batch->id,
                'quantity' => $adjustmentQuantity,
                'quantity_before' => $quantityBefore,
                'quantity_after' => $batch->quantity_available,
                'unit_cost' => $batch->unit_cost,
                'unit_price' => $batch->selling_price,
                'created_by' => $user->id,
                'notes' => $request->reason . ($request->notes ? ' - ' . $request->notes : ''),
                'metadata' => [
                    'adjustment_type' => $adjustmentType,
                    'reason' => $request->reason
                ],
            ]);

            // Update product stock if available quantity changed
            if ($adjustmentType === 'available') {
                $this->updateProductStock($batch->product_id, $batch->variant_id, $adjustmentQuantity);
            } else {
                // For damage/expiry, reduce product stock
                $this->updateProductStock($batch->product_id, $batch->variant_id, -abs($adjustmentQuantity));
            }

            DB::commit();

            return response()->json([
                'message' => 'Inventory adjustment recorded successfully',
                'data' => [
                    'batch_id' => $batch->id,
                    'adjustment_quantity' => $adjustmentQuantity,
                    'adjustment_type' => $adjustmentType,
                    'new_available_quantity' => $batch->quantity_available,
                    'batch_status' => $batch->status
                ]
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to make inventory adjustment', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Failed to make inventory adjustment', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Get inventory movements
     */
    public function getMovements(Request $request): JsonResponse
    {
        try {
            $user = $request->user();
            $companyId = $user->company_id;

            if (!$this->hasPermission($request, 'can_view_inventory', $companyId)) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $query = InventoryMovement::with(['product', 'variant', 'batch', 'store', 'createdBy'])
                ->forCompany($companyId);

            // Filters
            if ($request->has('store_id')) {
                $query->forStore($request->store_id);
            }

            if ($request->has('product_id')) {
                $query->forProduct($request->product_id, $request->variant_id);
            }

            if ($request->has('batch_id')) {
                $query->where('batch_id', $request->batch_id);
            }

            if ($request->has('type')) {
                $query->byType($request->type);
            }

            if ($request->has('date_from') && $request->has('date_to')) {
                $query->byDateRange($request->date_from, $request->date_to);
            }

            // Sorting
            $sortBy = $request->get('sort_by', 'movement_date');
            $sortOrder = $request->get('sort_order', 'desc');
            $query->orderBy($sortBy, $sortOrder);

            $movements = $query->paginate($request->get('per_page', 15));

            return response()->json($movements);

        } catch (\Exception $e) {
            return $this->handleDatabaseError($e, 'fetching inventory movements');
        }
    }

    /**
     * Get expiring batches
     */
    public function getExpiringBatches(Request $request): JsonResponse
    {
        try {
            $user = $request->user();
            $companyId = $user->company_id;

            if (!$this->hasPermission($request, 'can_view_inventory', $companyId)) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $days = $request->get('days', 30);
            $storeId = $request->get('store_id');

            $query = InventoryBatch::with(['product', 'variant', 'store'])
                ->forCompany($companyId)
                ->expiringSoon($days)
                ->available();

            if ($storeId) {
                $query->forStore($storeId);
            }

            $expiringBatches = $query->orderBy('expiry_date', 'asc')->get();

            return response()->json([
                'message' => "Batches expiring within {$days} days",
                'data' => $expiringBatches,
                'count' => $expiringBatches->count()
            ]);

        } catch (\Exception $e) {
            return $this->handleDatabaseError($e, 'fetching expiring batches');
        }
    }

    /**
     * Get batch availability for a product
     */
    public function getProductBatchAvailability(Request $request, string $productId): JsonResponse
    {
        try {
            $user = $request->user();
            $companyId = $user->company_id;

            if (!$this->hasPermission($request, 'can_view_inventory', $companyId)) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $variantId = $request->get('variant_id');
            $storeId = $request->get('store_id');

            $query = InventoryBatch::with(['store', 'supplier'])
                ->forCompany($companyId)
                ->where('product_id', $productId)
                ->available();

            if ($variantId) {
                $query->where('variant_id', $variantId);
            }

            if ($storeId) {
                $query->forStore($storeId);
            }

            // Sort by FIFO (First In, First Out) - oldest batches first
            $batches = $query->orderBy('received_date', 'asc')
                ->orderBy('expiry_date', 'asc')
                ->get();

            $totalAvailable = $batches->sum('quantity_available');
            $totalAllocated = $batches->sum('quantity_allocated');

            return response()->json([
                'product_id' => $productId,
                'variant_id' => $variantId,
                'store_id' => $storeId,
                'total_available' => $totalAvailable,
                'total_allocated' => $totalAllocated,
                'total_on_hand' => $totalAvailable + $totalAllocated,
                'batch_count' => $batches->count(),
                'batches' => $batches
            ]);

        } catch (\Exception $e) {
            return $this->handleDatabaseError($e, 'fetching product batch availability');
        }
    }

    /**
     * Helper method to update product stock quantities
     */
    private function updateProductStock($productId, $variantId, $quantityChange)
    {
        if ($variantId) {
            $variant = ProductVariant::find($variantId);
            if ($variant) {
                $variant->increment('stock_quantity', $quantityChange);
            }
        } else {
            $product = Product::find($productId);
            if ($product) {
                $product->increment('stock_quantity', $quantityChange);
            }
        }
    }
}
