<?php

namespace App\Http\Controllers;

use App\Models\StockAdjustment;
use App\Models\StockAdjustmentItem;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\InventoryBatch;
use App\Models\InventoryMovement;
use App\Models\ProductUnitInventory;
use App\Models\ActivityLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use App\Http\Traits\HandlesDatabaseErrors;

class StockAdjustmentController extends Controller
{
    use HandlesDatabaseErrors;

    public function __construct()
    {
        $this->middleware('auth:sanctum');
    }

    /**
     * Generate adjustment number following the same pattern as ProductController
     */
    protected function generateAdjustmentNumber($companyId)
    {
        $prefix = 'ADJ-' . substr($companyId, 0, 8) . '-';

        // Use raw query to avoid model accessors interfering
        $lastAdjustment = DB::table('stock_adjustments')
            ->select('adjustment_number')
            ->where('company_id', $companyId)
            ->where('adjustment_number', 'like', $prefix . '%')
            ->orderBy('adjustment_number', 'desc')
            ->lockForUpdate()
            ->first();

        $nextNumber = $lastAdjustment ? (int)substr($lastAdjustment->adjustment_number, strlen($prefix)) + 1 : 1;
        return $prefix . str_pad($nextNumber, 4, '0', STR_PAD_LEFT);
    }

    /**
     * Get all stock adjustments
     */
    public function index(Request $request)
    {
        try {
            $user = $request->user();
            $companyId = $user->company_id;

            if (!$this->hasPermission($request, 'can_view_products', $companyId)) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $query = StockAdjustment::with([
                'product:id,name,sku,product_code',
                'variant:id,name,sku',
                'batch:id,batch_number,lot_number',
                'store:id,name',
                'createdBy:id,first_name,last_name,email',
                'approvedBy:id,first_name,last_name,email',
                'rejectedBy:id,first_name,last_name,email',
                // Include items for bulk adjustments (with limited columns for performance)
                'items:id,stock_adjustment_id,product_id,adjustment_type,quantity_adjusted,item_status',
                'items.product:id,name,sku,product_code'
            ])
            ->withCount('items') // Add items_count for easy filtering/display
            ->forCompany($companyId);

            // Filter by store
            if ($request->has('store_id') && $request->store_id) {
                $query->forStore($request->store_id);
            }

            // Filter by product
            if ($request->has('product_id') && $request->product_id) {
                $query->forProduct($request->product_id);
            }

            // Filter by status
            if ($request->has('status') && $request->status) {
                $query->byStatus($request->status);
            }

            // Filter by reason type
            if ($request->has('reason_type') && $request->reason_type) {
                $query->byReasonType($request->reason_type);
            }

            // Filter by adjustment type
            if ($request->has('adjustment_type') && $request->adjustment_type) {
                $query->byAdjustmentType($request->adjustment_type);
            }

            // Filter by type (bulk vs single)
            if ($request->has('type') && $request->type) {
                if ($request->type === 'bulk') {
                    // Bulk adjustments have items and no direct product_id
                    $query->whereNull('product_id')->has('items');
                } elseif ($request->type === 'single') {
                    // Single adjustments have product_id set directly
                    $query->whereNotNull('product_id');
                }
            }

            // Filter by date range
            if ($request->has('start_date') && $request->start_date) {
                $query->where('created_at', '>=', $request->start_date);
            }

            if ($request->has('end_date') && $request->end_date) {
                $query->where('created_at', '<=', $request->end_date);
            }

            // Search
            if ($request->has('search') && $request->search) {
                $search = $request->search;
                $query->where(function ($q) use ($search) {
                    $q->where('adjustment_number', 'ilike', "%{$search}%")
                        ->orWhere('reason', 'ilike', "%{$search}%")
                        ->orWhere('notes', 'ilike', "%{$search}%");
                });
            }

            // Sort
            $sortBy = $request->get('sort_by', 'created_at');
            $sortOrder = $request->get('sort_order', 'desc');
            $query->orderBy($sortBy, $sortOrder);

            // Paginate
            $perPage = $request->get('per_page', 20);
            $adjustments = $query->paginate($perPage);

            return response()->json([
                'status' => 'success',
                'data' => $adjustments
            ]);
        } catch (\Exception $e) {
            return $this->handleDatabaseError($e, 'fetching stock adjustments');
        }
    }

    /**
     * Get a single stock adjustment
     */
    public function show(Request $request, $id)
    {
        try {
            $user = $request->user();
            $companyId = $user->company_id;

            if (!$this->hasPermission($request, 'can_view_products', $companyId)) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $adjustment = StockAdjustment::with([
                'product:id,name,sku,product_code,stock_quantity,unit_cost,price',
                'variant:id,name,sku,stock_quantity,cost,price',
                'batch:id,batch_number,lot_number,quantity_available',
                'store:id,name',
                'unit:id,name,abbreviation',
                'createdBy:id,first_name,last_name,email',
                'approvedBy:id,first_name,last_name,email',
                'rejectedBy:id,first_name,last_name,email',
                'inventoryMovement',
                'items.product:id,name,sku,product_code',
                'items.variant:id,name,sku',
                'items.batch:id,batch_number',
                'items.store:id,name',
            ])->forCompany($companyId)->findOrFail($id);

            return response()->json([
                'status' => 'success',
                'message' => 'Stock adjustment retrieved successfully',
                'data' => $adjustment
            ]);
        } catch (\Exception $e) {
            return $this->handleDatabaseError($e, 'fetching stock adjustment');
        }
    }

    /**
     * Bulk create stock adjustment with multiple items (parent-child structure)
     * Creates a single stock adjustment record with multiple adjustment items
     */
    public function bulkStore(Request $request)
    {
        try {
            $user = $request->user();
            $companyId = $user->company_id;

            if (!$this->hasPermission($request, 'can_update_products', $companyId)) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $validator = Validator::make($request->all(), [
                // Header-level fields
                'reason_type' => 'required|in:damage,expiry,theft,loss,found,recount,correction,return,donation,sample,write_off,other',
                'reason' => 'required|string|max:500',
                'notes' => 'nullable|string',
                'status' => 'nullable|in:draft,pending',
                'store_id' => 'nullable|exists:stores,id',
                'attachments' => 'nullable|array',
                'metadata' => 'nullable|array',
                // Items array
                'items' => 'required|array|min:1',
                'items.*.product_id' => 'required|exists:products,id',
                'items.*.variant_id' => 'nullable|exists:product_variants,id',
                'items.*.batch_id' => 'nullable|exists:inventory_batches,id',
                'items.*.unit_id' => 'nullable|exists:product_packaging_units,id',
                'items.*.store_id' => 'nullable|exists:stores,id',
                'items.*.adjustment_type' => 'required|in:increase,decrease,set',
                'items.*.quantity_adjusted' => 'required|integer',
                'items.*.notes' => 'nullable|string',
                'items.*.unit_cost' => 'nullable|numeric|min:0',
                'items.*.unit_price' => 'nullable|numeric|min:0',
                'items.*.metadata' => 'nullable|array',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'status' => 'failed',
                    'message' => $validator->errors(), 'errors' => $validator->errors()
                ], 422);
            }

            // A 'set' line directly declares the closing stock quantity for
            // that item - restrict that to director-level credentials.
            $hasClosingStockLine = collect($request->input('items', []))
                ->contains(fn ($item) => ($item['adjustment_type'] ?? null) === 'set');
            if ($hasClosingStockLine && !$this->hasPermission($request, 'can_adjust_closing_stock', $companyId)) {
                return response()->json(['message' => 'Only director-level users can set closing stock quantities'], 403);
            }

            DB::beginTransaction();

            // Create the parent stock adjustment record
            $adjustment = StockAdjustment::create([
                'company_id' => $companyId,
                'adjustment_number' => $this->generateAdjustmentNumber($companyId),
                'store_id' => $request->store_id,
                'reason_type' => $request->reason_type,
                'reason' => $request->reason,
                'notes' => $request->notes,
                'status' => $request->status ?? 'draft',
                'created_by' => $user->id,
                'attachments' => $request->attachments,
                'metadata' => $request->metadata,
                'total_items' => 0,
                'total_quantity_adjusted' => 0,
            ]);

            $itemResults = [];
            $successCount = 0;
            $failedCount = 0;
            $totalCost = 0;
            $totalValue = 0;

            foreach ($request->items as $index => $itemData) {
                try {
                    // Verify product belongs to company
                    $product = Product::forCompany($companyId)->find($itemData['product_id']);
                    
                    if (!$product) {
                        $itemResults[] = [
                            'status' => 'failed',
                            'index' => $index,
                            'errors' => ['product_id' => ['Product not found or does not belong to your company']],
                            'input' => $itemData
                        ];
                        $failedCount++;
                        continue;
                    }

                    // Get current quantity
                    $currentQuantity = $this->getCurrentQuantity(
                        $itemData['product_id'],
                        $itemData['variant_id'] ?? null,
                        $itemData['batch_id'] ?? null,
                        $itemData['store_id'] ?? $request->store_id,
                        $itemData['unit_id'] ?? null
                    );

                    // Calculate the adjusted quantity based on type
                    $quantityAdjusted = $itemData['quantity_adjusted'];
                    $adjustmentType = $itemData['adjustment_type'];

                    // For 'set' type, calculate the difference
                    if ($adjustmentType === 'set') {
                        $quantityAdjusted = $itemData['quantity_adjusted'] - $currentQuantity;
                    } elseif ($adjustmentType === 'decrease') {
                        $quantityAdjusted = -abs($quantityAdjusted);
                    } else {
                        $quantityAdjusted = abs($quantityAdjusted);
                    }

                    $quantityAfter = $currentQuantity + $quantityAdjusted;

                    // Validate that final quantity won't be negative
                    if ($quantityAfter < 0) {
                        $itemResults[] = [
                            'status' => 'failed',
                            'index' => $index,
                            'errors' => [
                                'quantity' => [
                                    'Adjustment would result in negative stock quantity',
                                    "Current: {$currentQuantity}, Adjustment: {$quantityAdjusted}, Result: {$quantityAfter}"
                                ]
                            ],
                            'input' => $itemData
                        ];
                        $failedCount++;
                        continue;
                    }

                    // Get unit cost and price
                    $unitCost = $itemData['unit_cost'] ?? $this->getUnitCost($product, $itemData['variant_id'] ?? null);
                    $unitPrice = $itemData['unit_price'] ?? $this->getUnitPrice($product, $itemData['variant_id'] ?? null);

                    // Create the adjustment item
                    $item = StockAdjustmentItem::create([
                        'stock_adjustment_id' => $adjustment->id,
                        'product_id' => $itemData['product_id'],
                        'variant_id' => $itemData['variant_id'] ?? null,
                        'batch_id' => $itemData['batch_id'] ?? null,
                        'unit_id' => $itemData['unit_id'] ?? null,
                        'store_id' => $itemData['store_id'] ?? $request->store_id ?? $product->store_id,
                        'adjustment_type' => $adjustmentType,
                        'quantity_before' => $currentQuantity,
                        'quantity_adjusted' => $quantityAdjusted,
                        'quantity_after' => $quantityAfter,
                        'unit_cost' => $unitCost,
                        'unit_price' => $unitPrice,
                        'notes' => $itemData['notes'] ?? null,
                        'metadata' => $itemData['metadata'] ?? null,
                        'item_status' => 'pending',
                    ]);

                    // Calculate financial impact for item
                    $item->calculateFinancialImpact();
                    $item->save();

                    // Accumulate totals
                    $totalCost += $item->total_cost ?? 0;
                    $totalValue += $item->total_value ?? 0;

                    // Load relationships for item
                    $item->load([
                        'product:id,name,sku,product_code',
                        'variant:id,name,sku',
                        'batch:id,batch_number',
                        'store:id,name',
                    ]);

                    $itemResults[] = [
                        'status' => 'success',
                        'index' => $index,
                        'message' => 'Item added successfully',
                        'data' => $item
                    ];
                    $successCount++;

                } catch (\Exception $e) {
                    Log::error("Failed to create stock adjustment item (index {$index})", [
                        'error' => $e->getMessage(),
                        'input' => $itemData
                    ]);

                    $itemResults[] = [
                        'status' => 'failed',
                        'index' => $index,
                        'errors' => ['exception' => [$e->getMessage()]],
                        'input' => $itemData
                    ];
                    $failedCount++;
                }
            }

            // Update parent adjustment with totals
            $adjustment->total_items = $successCount;
            $adjustment->total_quantity_adjusted = collect($itemResults)
                ->where('status', 'success')
                ->sum(function ($item) {
                    return $item['data']['quantity_adjusted'] ?? 0;
                });
            $adjustment->total_cost = $totalCost;
            $adjustment->total_value = $totalValue;
            $adjustment->save();

            // If all items failed, delete the parent and rollback
            if ($successCount === 0) {
                DB::rollBack();
                return response()->json([
                    'status' => 'failed',
                    'message' => 'All items failed validation',
                    'summary' => [
                        'total' => count($request->items),
                        'successful' => 0,
                        'failed' => $failedCount
                    ],
                    'item_results' => $itemResults
                ], 422);
            }

            // Log activity
            ActivityLog::logActivity(
                'stock_adjustment_created',
                "Created bulk stock adjustment {$adjustment->adjustment_number} with {$successCount} items",
                $user,
                [
                    'adjustment_id' => $adjustment->id,
                    'adjustment_number' => $adjustment->adjustment_number,
                    'reason_type' => $adjustment->reason_type,
                    'total_items' => $successCount,
                    'total_quantity_adjusted' => $adjustment->total_quantity_adjusted,
                    'total_cost' => $adjustment->total_cost,
                    'total_value' => $adjustment->total_value,
                    'status' => $adjustment->status,
                    'failed_items' => $failedCount,
                    'bulk_operation' => true,
                ]
            );

            DB::commit();

            // Load relationships for the parent adjustment
            $adjustment->load([
                'store:id,name',
                'createdBy:id,first_name,last_name,email',
                'items.product:id,name,sku,product_code',
                'items.variant:id,name,sku',
                'items.batch:id,batch_number',
                'items.store:id,name',
            ]);

            $overallStatus = $failedCount === 0 ? 'completed' : 'partial';

            return response()->json([
                'status' => $overallStatus,
                'message' => "Stock adjustment created with {$successCount} items" . ($failedCount > 0 ? ", {$failedCount} failed" : ""),
                'summary' => [
                    'total_items_submitted' => count($request->items),
                    'successful_items' => $successCount,
                    'failed_items' => $failedCount
                ],
                'data' => $adjustment,
                'item_results' => $itemResults
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to create bulk stock adjustment', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return $this->handleDatabaseError($e, 'creating bulk stock adjustment');
        }
    }

    /**
     * Create a new stock adjustment
     */
    public function store(Request $request)
    {
        try {
            $user = $request->user();
            $companyId = $user->company_id;

            if (!$this->hasPermission($request, 'can_update_products', $companyId)) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $validator = Validator::make($request->all(), [
                'store_id' => 'nullable|exists:stores,id',
                'product_id' => 'required|exists:products,id',
                'variant_id' => 'nullable|exists:product_variants,id',
                'batch_id' => 'nullable|exists:inventory_batches,id',
                'unit_id' => 'nullable|exists:product_packaging_units,id',
                'adjustment_type' => 'required|in:increase,decrease,set',
                'reason_type' => 'required|in:damage,expiry,theft,loss,found,recount,correction,return,donation,sample,write_off,other',
                'quantity_adjusted' => 'required|integer',
                'reason' => 'required|string|max:500',
                'notes' => 'nullable|string',
                'unit_cost' => 'nullable|numeric|min:0',
                'unit_price' => 'nullable|numeric|min:0',
                'status' => 'nullable|in:draft,pending',
                'attachments' => 'nullable|array',
                'metadata' => 'nullable|array',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'status' => 'failed',
                    'message' => $validator->errors(), 'errors' => $validator->errors()
                ], 422);
            }

            // A 'set' adjustment directly declares the closing stock quantity
            // (rather than incrementing/decrementing it) - restrict that to
            // director-level credentials specifically.
            if ($request->adjustment_type === 'set' && !$this->hasPermission($request, 'can_adjust_closing_stock', $companyId)) {
                return response()->json(['message' => 'Only director-level users can set closing stock quantities'], 403);
            }

            DB::beginTransaction();

            // Verify product belongs to company
            $product = Product::forCompany($companyId)->findOrFail($request->product_id);

            // Get current quantity
            $currentQuantity = $this->getCurrentQuantity(
                $request->product_id,
                $request->variant_id,
                $request->batch_id,
                $request->store_id,
                $request->unit_id
            );

            // Calculate the adjusted quantity based on type
            $quantityAdjusted = $request->quantity_adjusted;
            $adjustmentType = $request->adjustment_type;

            // For 'set' type, calculate the difference
            if ($adjustmentType === 'set') {
                $quantityAdjusted = $request->quantity_adjusted - $currentQuantity;
            } elseif ($adjustmentType === 'decrease') {
                $quantityAdjusted = -abs($quantityAdjusted);
            } else {
                $quantityAdjusted = abs($quantityAdjusted);
            }

            $quantityAfter = $currentQuantity + $quantityAdjusted;

            // Validate that final quantity won't be negative
            if ($quantityAfter < 0) {
                DB::rollBack();
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Adjustment would result in negative stock quantity',
                    'current_quantity' => $currentQuantity,
                    'requested_adjustment' => $quantityAdjusted
                ], 422);
            }

            // Get unit cost and price
            $unitCost = $request->unit_cost ?? $this->getUnitCost($product, $request->variant_id);
            $unitPrice = $request->unit_price ?? $this->getUnitPrice($product, $request->variant_id);

            // Create the stock adjustment
            $adjustment = StockAdjustment::create([
                'company_id' => $companyId,
                'adjustment_number' => $this->generateAdjustmentNumber($companyId),
                'store_id' => $request->store_id ?? $product->store_id,
                'product_id' => $request->product_id,
                'variant_id' => $request->variant_id,
                'batch_id' => $request->batch_id,
                'unit_id' => $request->unit_id,
                'adjustment_type' => $adjustmentType,
                'reason_type' => $request->reason_type,
                'quantity_before' => $currentQuantity,
                'quantity_adjusted' => $quantityAdjusted,
                'quantity_after' => $quantityAfter,
                'unit_cost' => $unitCost,
                'unit_price' => $unitPrice,
                'status' => $request->status ?? 'draft',
                'created_by' => $user->id,
                'reason' => $request->reason,
                'notes' => $request->notes,
                'attachments' => $request->attachments,
                'metadata' => $request->metadata,
            ]);

            // Calculate financial impact
            $adjustment->calculateFinancialImpact();
            $adjustment->save();

            // Log activity
            ActivityLog::logActivity(
                'stock_adjustment_created',
                "Created stock adjustment {$adjustment->adjustment_number} for product: {$product->name}",
                $user,
                [
                    'adjustment_id' => $adjustment->id,
                    'adjustment_number' => $adjustment->adjustment_number,
                    'product_id' => $adjustment->product_id,
                    'product_name' => $product->name,
                    'variant_id' => $adjustment->variant_id,
                    'adjustment_type' => $adjustment->adjustment_type,
                    'reason_type' => $adjustment->reason_type,
                    'quantity_adjusted' => $adjustment->quantity_adjusted,
                    'quantity_before' => $adjustment->quantity_before,
                    'quantity_after' => $adjustment->quantity_after,
                    'status' => $adjustment->status,
                ]
            );

            DB::commit();

            // Load relationships
            $adjustment->load([
                'product',
                'variant',
                'batch',
                'store',
                'createdBy'
            ]);

            return response()->json([
                'status' => 'success',
                'message' => 'Stock adjustment created successfully',
                'data' => $adjustment
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to create stock adjustment', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return $this->handleDatabaseError($e, 'creating stock adjustment');
        }
    }

    /**
     * Update a stock adjustment
     */
    public function update(Request $request, $id)
    {
        try {
            $user = $request->user();
            $companyId = $user->company_id;

            if (!$this->hasPermission($request, 'can_update_products', $companyId)) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $adjustment = StockAdjustment::forCompany($companyId)->findOrFail($id);

            // Only draft and pending adjustments can be updated
            if (!in_array($adjustment->status, ['draft', 'pending'])) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Only draft or pending adjustments can be updated'
                ], 422);
            }

            $validator = Validator::make($request->all(), [
                'adjustment_type' => 'sometimes|in:increase,decrease,set',
                'reason_type' => 'sometimes|in:damage,expiry,theft,loss,found,recount,correction,return,donation,sample,write_off,other',
                'quantity_adjusted' => 'sometimes|integer',
                'reason' => 'sometimes|string|max:500',
                'notes' => 'nullable|string',
                'unit_cost' => 'nullable|numeric|min:0',
                'unit_price' => 'nullable|numeric|min:0',
                'status' => 'nullable|in:draft,pending',
                'attachments' => 'nullable|array',
                'metadata' => 'nullable|array',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'status' => 'failed',
                    'message' => $validator->errors(), 'errors' => $validator->errors()
                ], 422);
            }

            // A 'set' adjustment directly declares the closing stock quantity
            // - restrict that to director-level credentials.
            $effectiveType = $request->input('adjustment_type', $adjustment->adjustment_type);
            if ($effectiveType === 'set' && !$this->hasPermission($request, 'can_adjust_closing_stock', $companyId)) {
                return response()->json(['message' => 'Only director-level users can set closing stock quantities'], 403);
            }

            DB::beginTransaction();

            // If quantity or type is being updated, recalculate
            if ($request->has('quantity_adjusted') || $request->has('adjustment_type')) {
                $currentQuantity = $this->getCurrentQuantity(
                    $adjustment->product_id,
                    $adjustment->variant_id,
                    $adjustment->batch_id,
                    $adjustment->store_id,
                    $adjustment->unit_id
                );

                $quantityAdjusted = $request->quantity_adjusted ?? $adjustment->quantity_adjusted;
                $adjustmentType = $request->adjustment_type ?? $adjustment->adjustment_type;

                if ($adjustmentType === 'set') {
                    $quantityAdjusted = $quantityAdjusted - $currentQuantity;
                } elseif ($adjustmentType === 'decrease') {
                    $quantityAdjusted = -abs($quantityAdjusted);
                } else {
                    $quantityAdjusted = abs($quantityAdjusted);
                }

                $quantityAfter = $currentQuantity + $quantityAdjusted;

                if ($quantityAfter < 0) {
                    DB::rollBack();
                    return response()->json([
                        'status' => 'failed',
                        'message' => 'Adjustment would result in negative stock quantity'
                    ], 422);
                }

                $adjustment->quantity_before = $currentQuantity;
                $adjustment->quantity_adjusted = $quantityAdjusted;
                $adjustment->quantity_after = $quantityAfter;
                
                if ($request->has('adjustment_type')) {
                    $adjustment->adjustment_type = $adjustmentType;
                }
            }

            // Update other fields
            $adjustment->fill($request->only([
                'reason_type',
                'reason',
                'notes',
                'unit_cost',
                'unit_price',
                'status',
                'attachments',
                'metadata'
            ]));

            $adjustment->calculateFinancialImpact();
            $adjustment->save();

            // Log activity
            ActivityLog::logActivity(
                'stock_adjustment_updated',
                "Updated stock adjustment {$adjustment->adjustment_number}",
                $user,
                [
                    'adjustment_id' => $adjustment->id,
                    'adjustment_number' => $adjustment->adjustment_number,
                    'product_id' => $adjustment->product_id,
                    'changes' => $request->only([
                        'adjustment_type',
                        'reason_type',
                        'quantity_adjusted',
                        'reason',
                        'notes',
                        'status'
                    ]),
                ]
            );

            DB::commit();

            $adjustment->load([
                'product',
                'variant',
                'batch',
                'store',
                'createdBy'
            ]);

            return response()->json([
                'status' => 'success',
                'message' => 'Stock adjustment updated successfully',
                'data' => $adjustment
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->handleDatabaseError($e, 'updating stock adjustment');
        }
    }

    /**
     * Delete a stock adjustment
     */
    public function destroy(Request $request, $id)
    {
        try {
            $user = $request->user();
            $companyId = $user->company_id;

            if (!$this->hasPermission($request, 'can_delete_products', $companyId)) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $adjustment = StockAdjustment::forCompany($companyId)->findOrFail($id);

            // Only draft adjustments can be deleted
            if ($adjustment->status !== 'draft') {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Only draft adjustments can be deleted'
                ], 422);
            }

            $adjustment->delete();

            // Log activity
            ActivityLog::logActivity(
                'stock_adjustment_deleted',
                "Deleted stock adjustment {$adjustment->adjustment_number}",
                $user,
                [
                    'adjustment_id' => $adjustment->id,
                    'adjustment_number' => $adjustment->adjustment_number,
                    'product_id' => $adjustment->product_id,
                ]
            );

            return response()->json([
                'status' => 'success',
                'message' => 'Stock adjustment deleted successfully'
            ]);
        } catch (\Exception $e) {
            return $this->handleDatabaseError($e, 'deleting stock adjustment');
        }
    }

    /**
     * Approve a stock adjustment
     */
    public function approve(Request $request, $id)
    {
        try {
            $user = $request->user();
            $companyId = $user->company_id;

            if (!$this->hasPermission($request, 'can_approve_adjustments', $companyId)) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            DB::beginTransaction();

            $adjustment = StockAdjustment::forCompany($companyId)->findOrFail($id);

            if (!$adjustment->canBeApproved()) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'This adjustment cannot be approved'
                ], 422);
            }

            $adjustment->approve($user->id);

            // Log activity
            ActivityLog::logActivity(
                'stock_adjustment_approved',
                "Approved stock adjustment {$adjustment->adjustment_number}",
                $user,
                [
                    'adjustment_id' => $adjustment->id,
                    'adjustment_number' => $adjustment->adjustment_number,
                    'product_id' => $adjustment->product_id,
                    'quantity_adjusted' => $adjustment->quantity_adjusted,
                    'reason_type' => $adjustment->reason_type,
                ]
            );

            DB::commit();

            $adjustment->load([
                'product',
                'variant',
                'approvedBy'
            ]);

            return response()->json([
                'status' => 'success',
                'message' => 'Stock adjustment approved successfully',
                'data' => $adjustment
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->handleDatabaseError($e, 'approving stock adjustment');
        }
    }

    /**
     * Reject a stock adjustment
     */
    public function reject(Request $request, $id)
    {
        try {
            $user = $request->user();
            $companyId = $user->company_id;

            if (!$this->hasPermission($request, 'can_approve_adjustments', $companyId)) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $validator = Validator::make($request->all(), [
                'rejection_reason' => 'required|string|max:1000',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'status' => 'failed',
                    'message' => $validator->errors(), 'errors' => $validator->errors()
                ], 422);
            }

            DB::beginTransaction();

            $adjustment = StockAdjustment::forCompany($companyId)->findOrFail($id);

            if (!$adjustment->canBeRejected()) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'This adjustment cannot be rejected'
                ], 422);
            }

            $adjustment->reject($user->id, $request->rejection_reason);

            // Log activity
            ActivityLog::logActivity(
                'stock_adjustment_rejected',
                "Rejected stock adjustment {$adjustment->adjustment_number}",
                $user,
                [
                    'adjustment_id' => $adjustment->id,
                    'adjustment_number' => $adjustment->adjustment_number,
                    'product_id' => $adjustment->product_id,
                    'rejection_reason' => $request->rejection_reason,
                ]
            );

            DB::commit();

            $adjustment->load([
                'product',
                'variant',
                'rejectedBy'
            ]);

            return response()->json([
                'status' => 'success',
                'message' => 'Stock adjustment rejected successfully',
                'data' => $adjustment
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->handleDatabaseError($e, 'rejecting stock adjustment');
        }
    }

    /**
     * Apply/Complete a stock adjustment (update actual inventory)
     * Handles both single-item (legacy) and multi-item (bulk) adjustments
     */
    public function apply(Request $request, $id)
    {
        try {
            $user = $request->user();
            $companyId = $user->company_id;

            if (!$this->hasPermission($request, 'can_update_products', $companyId)) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            DB::beginTransaction();

            $adjustment = StockAdjustment::with(['product', 'variant', 'batch', 'items.product', 'items.variant', 'items.batch'])
                ->forCompany($companyId)
                ->findOrFail($id);

            if (!$adjustment->isApproved()) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Only approved adjustments can be applied'
                ], 422);
            }

            if ($adjustment->isCompleted()) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'This adjustment has already been applied'
                ], 422);
            }

            $itemResults = [];
            $successCount = 0;
            $failedCount = 0;

            // Check if this is a bulk adjustment (has items) or legacy single-item adjustment
            if ($adjustment->hasItems()) {
                // Process each item in the bulk adjustment
                foreach ($adjustment->pendingItems as $item) {
                    try {
                        // Apply the item to inventory
                        $this->applyItemToInventory($item);

                        // Create inventory movement record for this item
                        $movement = InventoryMovement::createAdjustment([
                            'company_id' => $adjustment->company_id,
                            'store_id' => $item->store_id ?? $adjustment->store_id,
                            'product_id' => $item->product_id,
                            'variant_id' => $item->variant_id,
                            'batch_id' => $item->batch_id,
                            'quantity' => $item->quantity_adjusted,
                            'quantity_before' => $item->quantity_before,
                            'quantity_after' => $item->quantity_after,
                            'unit_cost' => $item->unit_cost,
                            'unit_price' => $item->unit_price,
                            'total_cost' => $item->total_cost,
                            'total_value' => $item->total_value,
                            'created_by' => $user->id,
                            'notes' => "Stock adjustment: {$adjustment->adjustment_number} - {$adjustment->reason}",
                            'reference_type' => 'stock_adjustment_item',
                            'reference_id' => $item->id,
                            'reference_number' => $adjustment->adjustment_number,
                            'metadata' => [
                                'adjustment_id' => $adjustment->id,
                                'adjustment_item_id' => $item->id,
                                'adjustment_number' => $adjustment->adjustment_number,
                                'reason_type' => $adjustment->reason_type,
                                'adjustment_type' => $item->adjustment_type,
                            ]
                        ]);

                        // Mark item as applied
                        $item->markAsApplied($movement->id);

                        $itemResults[] = [
                            'status' => 'success',
                            'item_id' => $item->id,
                            'product' => $item->product->name ?? 'Unknown',
                            'quantity_adjusted' => $item->quantity_adjusted,
                            'movement_id' => $movement->id
                        ];
                        $successCount++;

                    } catch (\Exception $e) {
                        Log::error("Failed to apply stock adjustment item", [
                            'item_id' => $item->id,
                            'error' => $e->getMessage()
                        ]);

                        $item->markAsFailed($e->getMessage());

                        $itemResults[] = [
                            'status' => 'failed',
                            'item_id' => $item->id,
                            'product' => $item->product->name ?? 'Unknown',
                            'error' => $e->getMessage()
                        ];
                        $failedCount++;
                    }
                }

                // Complete the adjustment if at least one item succeeded
                if ($successCount > 0) {
                    $adjustment->complete();
                }

                // Log activity for bulk apply
                ActivityLog::logActivity(
                    'stock_adjustment_applied',
                    "Applied bulk stock adjustment {$adjustment->adjustment_number} ({$successCount} items applied, {$failedCount} failed)",
                    $user,
                    [
                        'adjustment_id' => $adjustment->id,
                        'adjustment_number' => $adjustment->adjustment_number,
                        'total_items' => $adjustment->total_items,
                        'items_applied' => $successCount,
                        'items_failed' => $failedCount,
                        'reason_type' => $adjustment->reason_type,
                        'bulk_operation' => true,
                    ]
                );

            } else {
                // Legacy single-item adjustment
                // Apply the adjustment to inventory
                $this->applyAdjustmentToInventory($adjustment);

                // Create inventory movement record
                $movement = InventoryMovement::createAdjustment([
                    'company_id' => $adjustment->company_id,
                    'store_id' => $adjustment->store_id,
                    'product_id' => $adjustment->product_id,
                    'variant_id' => $adjustment->variant_id,
                    'batch_id' => $adjustment->batch_id,
                    'quantity' => $adjustment->quantity_adjusted,
                    'quantity_before' => $adjustment->quantity_before,
                    'quantity_after' => $adjustment->quantity_after,
                    'unit_cost' => $adjustment->unit_cost,
                    'unit_price' => $adjustment->unit_price,
                    'total_cost' => $adjustment->total_cost,
                    'total_value' => $adjustment->total_value,
                    'created_by' => $user->id,
                    'notes' => "Stock adjustment: {$adjustment->adjustment_number} - {$adjustment->reason}",
                    'reference_type' => 'stock_adjustment',
                    'reference_id' => $adjustment->id,
                    'reference_number' => $adjustment->adjustment_number,
                    'metadata' => [
                        'adjustment_id' => $adjustment->id,
                        'adjustment_number' => $adjustment->adjustment_number,
                        'reason_type' => $adjustment->reason_type,
                        'adjustment_type' => $adjustment->adjustment_type,
                    ]
                ]);

                // Link the movement to the adjustment
                $adjustment->inventory_movement_id = $movement->id;
                $adjustment->complete();
                $successCount = 1;

                // Log activity
                ActivityLog::logActivity(
                    'stock_adjustment_applied',
                    "Applied stock adjustment {$adjustment->adjustment_number} to inventory",
                    $user,
                    [
                        'adjustment_id' => $adjustment->id,
                        'adjustment_number' => $adjustment->adjustment_number,
                        'product_id' => $adjustment->product_id,
                        'product_name' => $adjustment->product->name,
                        'variant_id' => $adjustment->variant_id,
                        'quantity_adjusted' => $adjustment->quantity_adjusted,
                        'quantity_before' => $adjustment->quantity_before,
                        'quantity_after' => $adjustment->quantity_after,
                        'inventory_movement_id' => $movement->id,
                        'reason_type' => $adjustment->reason_type,
                    ]
                );
            }

            DB::commit();

            $adjustment->load([
                'product',
                'variant',
                'inventoryMovement',
                'items.product',
                'items.variant',
                'items.inventoryMovement',
            ]);

            $response = [
                'status' => 'success',
                'message' => $adjustment->hasItems() 
                    ? "Stock adjustment applied: {$successCount} items succeeded" . ($failedCount > 0 ? ", {$failedCount} failed" : "")
                    : 'Stock adjustment applied successfully',
                'data' => $adjustment
            ];

            if ($adjustment->hasItems()) {
                $response['item_results'] = $itemResults;
                $response['summary'] = [
                    'total_items' => count($itemResults),
                    'applied' => $successCount,
                    'failed' => $failedCount
                ];
            }

            return response()->json($response);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to apply stock adjustment', [
                'adjustment_id' => $id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return $this->handleDatabaseError($e, 'applying stock adjustment');
        }
    }

    /**
     * Helper method to apply an adjustment item to inventory
     */
    private function applyItemToInventory($item)
    {
        // If batch_id is specified, adjust that batch
        if ($item->batch_id) {
            $batch = InventoryBatch::findOrFail($item->batch_id);
            $batch->increment('quantity_available', $item->quantity_adjusted);
            return;
        }

        // If unit_id is specified, adjust product_unit_inventory
        if ($item->unit_id) {
            $unitInventory = ProductUnitInventory::firstOrCreate(
                [
                    'product_id' => $item->product_id,
                    'variant_id' => $item->variant_id,
                    'unit_id' => $item->unit_id,
                    'store_id' => $item->store_id,
                    'company_id' => $item->stockAdjustment->company_id,
                ],
                [
                    'quantity' => 0,
                    'allocated' => 0,
                ]
            );
            $unitInventory->increment('quantity', $item->quantity_adjusted);
            return;
        }

        // Otherwise, adjust product or variant stock_quantity
        if ($item->variant_id) {
            $variant = ProductVariant::findOrFail($item->variant_id);
            $variant->increment('stock_quantity', $item->quantity_adjusted);
        } else {
            $product = Product::findOrFail($item->product_id);
            $product->increment('stock_quantity', $item->quantity_adjusted);
        }
    }

    /**
     * Get stock adjustment statistics
     */
    public function statistics(Request $request)
    {
        try {
            $user = $request->user();
            $companyId = $user->company_id;

            if (!$this->hasPermission($request, 'can_view_products', $companyId)) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $storeId = $request->get('store_id');
            $startDate = $request->get('start_date', now()->subDays(30));
            $endDate = $request->get('end_date', now());

            $query = StockAdjustment::forCompany($companyId)
                ->whereBetween('created_at', [$startDate, $endDate]);

            if ($storeId) {
                $query->forStore($storeId);
            }

            $statistics = [
                'total_adjustments' => (clone $query)->count(),
                'pending_adjustments' => (clone $query)->pending()->count(),
                'approved_adjustments' => (clone $query)->approved()->count(),
                'completed_adjustments' => (clone $query)->completed()->count(),
                'rejected_adjustments' => (clone $query)->byStatus('rejected')->count(),
                'total_value_impact' => (clone $query)->completed()->sum('total_value'),
                'total_cost_impact' => (clone $query)->completed()->sum('total_cost'),
                'by_reason_type' => (clone $query)->completed()
                    ->select('reason_type', DB::raw('count(*) as count'), DB::raw('sum(total_value) as total_value'))
                    ->groupBy('reason_type')
                    ->get(),
                'by_adjustment_type' => (clone $query)->completed()
                    ->select('adjustment_type', DB::raw('count(*) as count'), DB::raw('sum(abs(quantity_adjusted)) as total_quantity'))
                    ->groupBy('adjustment_type')
                    ->get(),
            ];

            return response()->json([
                'status' => 'success',
                'data' => $statistics
            ]);
        } catch (\Exception $e) {
            return $this->handleDatabaseError($e, 'fetching stock adjustment statistics');
        }
    }

    /**
     * Get activity logs for stock adjustments
     */
    public function activities(Request $request)
    {
        try {
            $user = $request->user();
            $companyId = $user->company_id;

            if (!$this->hasPermission($request, 'can_view_products', $companyId)) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $query = ActivityLog::with(['user:id,first_name,last_name,email'])
                ->where('company_id', $companyId)
                ->where('action', 'like', 'stock_adjustment_%');

            // Filter by specific adjustment
            if ($request->has('adjustment_id') && $request->adjustment_id) {
                $query->whereJsonContains('properties->adjustment_id', $request->adjustment_id);
            }

            // Filter by product
            if ($request->has('product_id') && $request->product_id) {
                $query->whereJsonContains('properties->product_id', $request->product_id);
            }

            // Filter by action type
            if ($request->has('action') && $request->action) {
                $query->where('action', $request->action);
            }

            // Filter by date range
            if ($request->has('start_date') && $request->start_date) {
                $query->where('created_at', '>=', $request->start_date);
            }

            if ($request->has('end_date') && $request->end_date) {
                $query->where('created_at', '<=', $request->end_date);
            }

            // Sort
            $query->orderBy('created_at', 'desc');

            // Paginate
            $perPage = $request->get('per_page', 50);
            $activities = $query->paginate($perPage);

            return response()->json([
                'status' => 'success',
                'data' => $activities
            ]);
        } catch (\Exception $e) {
            return $this->handleDatabaseError($e, 'fetching stock adjustment activities');
        }
    }

    /**
     * Get activity logs for a specific stock adjustment
     */
    public function adjustmentActivities(Request $request, $id)
    {
        try {
            $user = $request->user();
            $companyId = $user->company_id;

            if (!$this->hasPermission($request, 'can_view_products', $companyId)) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            // Verify adjustment belongs to company
            $adjustment = StockAdjustment::forCompany($companyId)->findOrFail($id);

            // Get all activity logs related to this adjustment
            $activities = ActivityLog::with(['user:id,first_name,last_name,email'])
                ->where('company_id', $companyId)
                ->where('action', 'like', 'stock_adjustment_%')
                ->whereJsonContains('properties->adjustment_id', $id)
                ->orderBy('created_at', 'desc')
                ->get();

            return response()->json([
                'status' => 'success',
                'data' => [
                    'adjustment' => $adjustment,
                    'activities' => $activities,
                    'activity_count' => $activities->count(),
                ]
            ]);
        } catch (\Exception $e) {
            return $this->handleDatabaseError($e, 'fetching adjustment activities');
        }
    }

    /**
     * Helper method to get current quantity
     */
    private function getCurrentQuantity($productId, $variantId = null, $batchId = null, $storeId = null, $unitId = null)
    {
        // If batch_id is specified, get quantity from that batch
        if ($batchId) {
            $batch = InventoryBatch::findOrFail($batchId);
            return $batch->quantity_available ?? 0;
        }

        // If unit_id is specified, get quantity from product_unit_inventory
        if ($unitId) {
            $unitInventory = ProductUnitInventory::where('product_id', $productId)
                ->where('variant_id', $variantId)
                ->where('unit_id', $unitId)
                ->when($storeId, function ($q) use ($storeId) {
                    return $q->where('store_id', $storeId);
                })
                ->first();
            
            return $unitInventory ? $unitInventory->quantity : 0;
        }

        // Otherwise, get from product or variant
        if ($variantId) {
            $variant = ProductVariant::findOrFail($variantId);
            return $variant->stock_quantity ?? 0;
        }

        $product = Product::findOrFail($productId);
        return $product->stock_quantity ?? 0;
    }

    /**
     * Helper method to apply adjustment to inventory
     */
    private function applyAdjustmentToInventory($adjustment)
    {
        // If batch_id is specified, adjust that batch
        if ($adjustment->batch_id) {
            $batch = InventoryBatch::findOrFail($adjustment->batch_id);
            $batch->increment('quantity_available', $adjustment->quantity_adjusted);
            return;
        }

        // If unit_id is specified, adjust product_unit_inventory
        if ($adjustment->unit_id) {
            $unitInventory = ProductUnitInventory::firstOrCreate(
                [
                    'product_id' => $adjustment->product_id,
                    'variant_id' => $adjustment->variant_id,
                    'unit_id' => $adjustment->unit_id,
                    'store_id' => $adjustment->store_id,
                    'company_id' => $adjustment->company_id,
                ],
                [
                    'quantity' => 0,
                    'allocated' => 0,
                ]
            );
            $unitInventory->increment('quantity', $adjustment->quantity_adjusted);
            return;
        }

        // Otherwise, adjust product or variant stock_quantity
        if ($adjustment->variant_id) {
            $variant = ProductVariant::findOrFail($adjustment->variant_id);
            $variant->increment('stock_quantity', $adjustment->quantity_adjusted);
        } else {
            $product = Product::findOrFail($adjustment->product_id);
            $product->increment('stock_quantity', $adjustment->quantity_adjusted);
        }
    }

    /**
     * Helper method to get unit cost
     */
    private function getUnitCost($product, $variantId = null)
    {
        if ($variantId) {
            $variant = ProductVariant::find($variantId);
            return $variant->cost ?? $product->unit_cost;
        }
        return $product->unit_cost;
    }

    /**
     * Helper method to get unit price
     */
    private function getUnitPrice($product, $variantId = null)
    {
        if ($variantId) {
            $variant = ProductVariant::find($variantId);
            return $variant->price ?? $product->price;
        }
        return $product->price;
    }

    /**
     * Check if user has permission
     */
    private function hasPermission($request, $permission, $resourceCompanyId = null)
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
}
