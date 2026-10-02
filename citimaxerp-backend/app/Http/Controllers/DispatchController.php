<?php

namespace App\Http\Controllers;

use App\Http\Traits\ChecksStockAvailability;
use App\Models\Dispatch;
use App\Models\InventoryBatch;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Requisition;
use App\Models\Store;
use App\Models\User;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;

class DispatchController extends Controller
{
    use ChecksStockAvailability;

    /**
     * Generate a unique dispatch number for the company.
     *
     * @param string $companyId
     * @return string
     */
    protected function generateDispatchNumber($companyId)
    {
        $prefix = 'DSP-' . substr($companyId, 0, 8) . '-';
        
        // Use raw query to avoid model accessors interfering
        $lastDispatch = DB::table('dispatches')
            ->select('dispatch_number')
            ->where('dispatch_number', 'like', $prefix . '%')
            ->orderBy('dispatch_number', 'desc')
            ->lockForUpdate()
            ->first();

        $nextNumber = $lastDispatch ? (int)substr($lastDispatch->dispatch_number, strlen($prefix)) + 1 : 1;
        return $prefix . str_pad($nextNumber, 4, '0', STR_PAD_LEFT);
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
     * Validate that a chosen batch matches the dispatch item's product/variant/store
     * and has enough available quantity. Returns the batch on success, or a string
     * error message on failure.
     */
    protected function resolveDispatchBatch($batchId, $productId, $variantId, $storeId, $quantity)
    {
        $batch = InventoryBatch::find($batchId);
        if (!$batch) {
            return 'Batch not found.';
        }
        if ($batch->product_id !== $productId) {
            return 'Batch does not belong to this product.';
        }
        if (($batch->variant_id ?: null) !== ($variantId ?: null)) {
            return 'Batch does not match the selected variant.';
        }
        if ($batch->store_id !== $storeId) {
            return 'Batch is not available in the selected store.';
        }
        if ($batch->status !== 'active') {
            return 'Batch is not active.';
        }
        if ($batch->quantity_available < $quantity) {
            return 'Insufficient available quantity in the selected batch.';
        }
        return $batch;
    }


    /**
     * Check if the user can manage the company related to the dispatch.
     *
     * @param  Request  $request
     * @param  string|null  $companyId
     * @return bool
     */

    public function markReturned(Request $request, $dispatchId)
    {
        $dispatch = Dispatch::with('dispatchItems')->findOrFail($dispatchId);
        $companyId = null;
        if ($dispatch->fromStore && property_exists($dispatch->fromStore, 'company_id')) {
            $companyId = $dispatch->fromStore->company_id;
        } elseif ($dispatch->dispatchItems->count() > 0 && $dispatch->dispatchItems[0]->product && property_exists($dispatch->dispatchItems[0]->product, 'company_id')) {
            $companyId = $dispatch->dispatchItems[0]->product->company_id;
        }
        if (!$this->hasPermission($request, 'can_return_dispatches') || !$this->hasPermission($request, "can_manage_company", $companyId)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to mark items as returned.'
            ], 403);
        }
        $data = $request->all();
        if (!isset($data['items']) || !is_array($data['items']) || empty($data['items'])) {
            return response()->json([
                'status' => 'failed',
                'message' => 'You must provide an array of items with id, returned_quantity, and return_notes.'
            ], 422);
        }
        $updated = [];
        $errors = [];
        foreach ($data['items'] as $itemData) {
            if (!isset($itemData['id']) || !isset($itemData['returned_quantity'])) {
                $errors[] = 'Each item must have id and returned_quantity.';
                continue;
            }
            $item = $dispatch->dispatchItems->where('id', $itemData['id'])->first();
            $itemName = null;
            if ($item && $item->product && isset($item->product->name)) {
                $itemName = $item->product->name;
            } else if ($item) {
                $itemName = $item->id;
            } else {
                $itemName = $itemData['id'];
            }
            if (!$item) {
                $errors[] = 'Dispatch item not found: ' . $itemName;
                continue;
            }
            if (!$item->is_returnable) {
                $errors[] = 'Item is not returnable: ' . $itemName;
                continue;
            }
            $returnQty = (int) $itemData['returned_quantity'];
            if ($returnQty <= 0) {
                $errors[] = 'Returned quantity must be positive for item: ' . $itemName;
                continue;
            }
            $alreadyReturned = (int) $item->returned_quantity;
            $maxReturnable = $item->quantity - $alreadyReturned;
            if ($returnQty > $maxReturnable) {
                $errors[] = 'Returned quantity exceeds dispatch quantity for item: ' . $itemName;
                continue;
            }
            // Update returned_quantity and return_notes
            $item->returned_quantity = $alreadyReturned + $returnQty;
            if (isset($itemData['return_notes'])) {
                $item->return_notes = $itemData['return_notes'];
            }
            // Mark as returned if fully returned
            if ($item->returned_quantity >= $item->quantity) {
                $item->is_returned = true;
            }
            $item->save();
            $updated[] = [
                'id' => $item->id,
                'returned_quantity' => $returnQty,
                'return_notes' => $item->return_notes ?? null
            ];
            // Increment stock by returned quantity
            $product = $item->product;
            $variant = $item->variant_id ? \App\Models\ProductVariant::find($item->variant_id) : null;
            if ($variant) {
                $variant->increment('stock_quantity', $returnQty);
            } else {
                $product->increment('stock_quantity', $returnQty);
            }
            if ($item->batch_id) {
                $item->batch?->returnFromDispatch($returnQty, [
                    'reference_type' => 'dispatch',
                    'reference_id' => $dispatch->id,
                    'reference_number' => $dispatch->dispatch_number,
                ], $itemData['return_notes'] ?? ('Returned against dispatch ' . $dispatch->dispatch_number));
            }
        }
        if (empty($updated)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'No eligible items were marked as returned.',
                'errors' => $errors
            ], 400);
        }
        return response()->json([
            'status' => 'success',
            'message' => 'Selected items marked as returned.',
            'returned_items' => $updated,
            'errors' => $errors,
            'dispatch' => $dispatch->fresh('dispatchItems')
        ]);
    }

    public function show(Request $request, $id)
    {
        $dispatch = Dispatch::with([
            'dispatchItems.product',
            'dispatchItems.variant',
            'fromStore',
            'toUser',
            'acknowledgedBy'
        ])->findOrFail($id);

        // Determine companyId for authorization (assuming fromStore's company_id)
        $companyId = null;
        if ($dispatch->fromStore && property_exists($dispatch->fromStore, 'company_id')) {
            $companyId = $dispatch->fromStore->company_id;
        } elseif ($dispatch->dispatchItems->count() > 0 && $dispatch->dispatchItems[0]->product && property_exists($dispatch->dispatchItems[0]->product, 'company_id')) {
            $companyId = $dispatch->dispatchItems[0]->product->company_id;
        }

        if (!$this->hasPermission($request, 'can_view_dispatches') || !$this->hasPermission($request, "can_manage_company", $companyId)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view this dispatch.'
            ], 403);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Dispatch retrieved successfully.',
            'dispatch' => $dispatch
        ], 200);
    }


    public function update(Request $request, $id)
    {
        $dispatch = Dispatch::with('dispatchItems')->findOrFail($id);
        // Determine companyId from first item's product, fallback to user's company
        $companyId = null;
        if ($dispatch->dispatchItems->count() > 0 && $dispatch->dispatchItems[0]->product && property_exists($dispatch->dispatchItems[0]->product, 'company_id')) {
            $companyId = $dispatch->dispatchItems[0]->product->company_id;
        }
        if (!$companyId) {
            $companyId = $request->user()->company_id;
        }
        if (!$this->hasPermission($request, 'can_update_dispatches') || !$this->hasPermission($request, "can_manage_company", $companyId)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to update this dispatch.'
            ], 403);
        }

        // Restrict update if dispatch is acknowledged or returned
        if ($dispatch->acknowledged_by || $dispatch->is_returned) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Cannot update a dispatch that is acknowledged or marked as returned.'
            ], 422);
        }

        $data = $request->all();
        $validator = Validator::make($data, [
            'from_store_id' => 'required|uuid|exists:stores,id',
            'to_entity' => 'required|string',
            'to_user_id' => 'nullable|uuid|exists:users,id',
            'type' => 'required|in:internal,external',
            'is_returnable' => 'boolean',
            'return_date' => 'nullable|date',
            'notes' => 'nullable|string',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|uuid|exists:products,id',
            'items.*.variant_id' => 'nullable|uuid|exists:product_variants,id',
            'items.*.batch_id' => 'nullable|uuid|exists:inventory_batches,id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.is_returnable' => 'boolean',
            'items.*.is_returned' => 'boolean',
            'items.*.return_date' => 'nullable|date',
            'items.*.notes' => 'nullable|string',
        ]);

        // Custom validation: if is_returnable is true, return_date is required
        if (isset($data['items']) && is_array($data['items'])) {
            foreach ($data['items'] as $idx => $item) {
                if ((isset($item['is_returnable']) && $item['is_returnable']) && (empty($item['return_date']))) {
                    $validator->errors()->add("items.$idx.return_date", 'A return_date must be provided if is_returnable is true.');
                }
            }
        }
        if ($validator->fails()) {
            $firstError = $validator->errors()->first();
            return response()->json([
                'status' => 'failed',
                'message' => 'Validation failed: ' . $firstError,
                'message' => $validator->errors(), 'errors' => $validator->errors()
            ], 422);
        }

        DB::beginTransaction();
        try {
            // Release on_hand for all old items (not yet acknowledged)
            foreach ($dispatch->dispatchItems as $oldItem) {
                $product = Product::find($oldItem->product_id);
                $variant = $oldItem->variant_id ? \App\Models\ProductVariant::find($oldItem->variant_id) : null;
                $releaseQty = $oldItem->quantity - $oldItem->received_quantity;
                if ($releaseQty > 0) {
                    if ($variant) {
                        $variant->decrement('on_hand', $releaseQty);
                    } else {
                        $product->decrement('on_hand', $releaseQty);
                    }
                    if ($oldItem->batch_id) {
                        $oldItem->batch?->releaseDispatchAllocation($releaseQty, [
                            'reference_type' => 'dispatch',
                            'reference_id' => $dispatch->id,
                            'reference_number' => $dispatch->dispatch_number,
                        ], 'Dispatch ' . $dispatch->dispatch_number . ' edited');
                    }
                }
            }

            $items = $data['items'];
            $updatedItems = [];
            foreach ($items as $index => $item) {
                $product = Product::find($item['product_id']);
                if (!$product) {
                    DB::rollBack();
                    Log::warning('Update failed: Product not found', ['index' => $index, 'product_id' => $item['product_id']]);
                    return response()->json([
                        'status' => 'failed',
                        'message' => "Item at index {$index}: Product not found."
                    ], 404);
                }
                if (!empty($item['variant_id'])) {
                    // Variants aren't store-scoped in this schema (store_id is unset on
                    // every variant) - per-store availability is tracked via InventoryBatch
                    // instead, validated separately below when a batch_id is supplied.
                    $variant = \App\Models\ProductVariant::where('id', $item['variant_id'])
                        ->where('product_id', $item['product_id'])
                        ->lockForUpdate()
                        ->first();
                    if (!$variant) {
                        DB::rollBack();
                        Log::warning('Update failed: Variant not found', ['index' => $index, 'variant_id' => $item['variant_id']]);
                        return response()->json([
                            'status' => 'failed',
                            'message' => "Item at index {$index}: Variant not found for this product."
                        ], 404);
                    }
                    if ($variant->stock_quantity - $variant->on_hand < $item['quantity']) {
                        DB::rollBack();
                        Log::warning('Update failed: Insufficient stock for variant', ['index' => $index, 'variant_id' => $item['variant_id']]);
                        return response()->json([
                            'status' => 'failed',
                            'message' => "Item at index {$index}: Insufficient available stock for the variant in the store."
                        ], 422);
                    }
                } else {
                    if ($product->stock_quantity - $product->on_hand < $item['quantity']) {
                        DB::rollBack();
                        Log::warning('Update failed: Insufficient stock for product', ['index' => $index, 'product_id' => $item['product_id']]);
                        return response()->json([
                            'status' => 'failed',
                            'message' => "Item at index {$index}: Insufficient available stock in the store."
                        ], 422);
                    }
                }
                if (!empty($item['batch_id'])) {
                    $batchOrError = $this->resolveDispatchBatch(
                        $item['batch_id'],
                        $item['product_id'],
                        $item['variant_id'] ?? null,
                        $data['from_store_id'],
                        $item['quantity']
                    );
                    if (is_string($batchOrError)) {
                        DB::rollBack();
                        return response()->json([
                            'status' => 'failed',
                            'message' => "Item at index {$index}: {$batchOrError}"
                        ], 422);
                    }
                }
                $updatedItems[] = [
                    'product_id' => $item['product_id'],
                    'variant_id' => $item['variant_id'] ?? null,
                    'batch_id' => $item['batch_id'] ?? null,
                    'quantity' => $item['quantity'],
                    'notes' => $item['notes'] ?? null,
                    'is_returnable' => $item['is_returnable'] ?? false,
                    'is_returned' => $item['is_returned'] ?? false,
                    'return_date' => $item['return_date'] ?? null,
                ];
            }

            // Audit log before update
            Log::info('Dispatch update initiated', [
                'dispatch_id' => $dispatch->id,
                'updated_by' => $request->user()->id,
                'updated_at' => now(),
                'fields_updated' => array_keys($data),
                'items_updated' => $updatedItems,
            ]);

            $dispatch->update([
                'from_store_id' => $data['from_store_id'],
                'to_entity' => $data['to_entity'],
                'to_user_id' => $data['to_user_id'] ?? null,
                'type' => $data['type'],
                'is_returnable' => $data['is_returnable'] ?? false,
                'return_date' => $data['return_date'] ?? null,
                'notes' => $data['notes'] ?? null,
            ]);
            $dispatch->dispatchItems()->delete();
            foreach ($updatedItems as $item) {
                $product = Product::find($item['product_id']);
                $variant = !empty($item['variant_id']) ? \App\Models\ProductVariant::find($item['variant_id']) : null;
                \App\Models\DispatchItem::create([
                    'id' => (string) Str::uuid(),
                    'dispatch_id' => $dispatch->id,
                    'product_id' => $item['product_id'],
                    'variant_id' => $item['variant_id'],
                    'batch_id' => $item['batch_id'] ?? null,
                    'quantity' => $item['quantity'],
                    'received_quantity' => 0,
                    'notes' => $item['notes'],
                    'is_returnable' => $item['is_returnable'],
                    'is_returned' => $item['is_returned'],
                    'return_date' => $item['return_date'],
                ]);
                if ($variant) {
                    $variant->increment('on_hand', $item['quantity']);
                } else {
                    $product->increment('on_hand', $item['quantity']);
                }
                if (!empty($item['batch_id'])) {
                    $batch = InventoryBatch::find($item['batch_id']);
                    $batch?->allocateForDispatch($item['quantity'], [
                        'reference_type' => 'dispatch',
                        'reference_id' => $dispatch->id,
                        'reference_number' => $dispatch->dispatch_number,
                    ], 'Dispatch ' . $dispatch->dispatch_number . ' edited');
                }
            }

            // Audit log after update
            Log::info('Dispatch update completed', [
                'dispatch_id' => $dispatch->id,
                'updated_by' => $request->user()->id,
                'updated_at' => now(),
            ]);

            DB::commit();
            return response()->json([
                'status' => 'success',
                'message' => 'Dispatch updated successfully.',
                'dispatch' => $dispatch->load('dispatchItems.product', 'dispatchItems.variant')
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to update dispatch', [
                'dispatch_id' => $dispatch->id,
                'error' => $e->getMessage(),
            ]);
            return response()->json([
                'status' => 'failed',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    public function index(Request $request)
    {
        if (!$this->hasPermission($request, 'can_view_dispatches')) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view dispatches.'
            ], 403);
        }
        $query = Dispatch::with(['dispatchItems.product', 'dispatchItems.variant', 'fromStore', 'toUser', 'acknowledgedBy']);
        if ($request->filled('from_store_id')) {
            $query->where('from_store_id', $request->input('from_store_id'));
        }
        if ($request->filled('to_user_id')) {
            $query->where('to_user_id', $request->input('to_user_id'));
        }
        if ($request->filled('type')) {
            $query->where('type', $request->input('type'));
        }
        $dispatches = $query->orderByDesc('created_at')->paginate(20);
        return response()->json([
            'status' => 'success',
            'message' => 'Dispatches retrieved successfully.',
            'dispatches' => $dispatches
        ], 200);
    }

    public function store(Request $request)
    {
        if (!$this->hasPermission($request, 'can_create_dispatches')) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to create a dispatch.'
            ], 403);
        }
        $data = $request->all();
        $validator = Validator::make($data, [
            'from_store_id' => 'required|uuid|exists:stores,id',
            'to_entity' => 'required|string',
            'to_user_id' => 'nullable|uuid|exists:users,id',
            'type' => 'required|in:internal,external',
            'is_returnable' => 'boolean',
            'return_date' => 'nullable|date',
            'notes' => 'nullable|string',
            'requisition_id' => 'nullable|uuid|exists:requisitions,id',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|uuid|exists:products,id',
            'items.*.variant_id' => 'nullable|uuid|exists:product_variants,id',
            'items.*.batch_id' => 'nullable|uuid|exists:inventory_batches,id',
            'items.*.quantity' => 'required|integer|min:1',
        ]);
        // Custom validation: if is_returnable is true, return_date is required
        if (isset($data['items']) && is_array($data['items'])) {
            foreach ($data['items'] as $idx => $item) {
                if ((isset($item['is_returnable']) && $item['is_returnable']) && (empty($item['return_date']))) {
                    $validator->errors()->add("items.$idx.return_date", 'A return_date must be provided if is_returnable is true.');
                }
            }
        }
        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Validation failed.',
                'message' => $validator->errors(), 'errors' => $validator->errors()
            ], 422);
        }
        DB::beginTransaction();
        try {
            $user = $request->user();
            $companyId = $user->company_id;

            // Linking the source requisition happens here, in the same transaction,
            // so a dispatch can never exist without its requisition being marked
            // dispatched (and dispatchers don't need general requisition-edit rights).
            $requisition = null;
            if (!empty($data['requisition_id'])) {
                $requisition = Requisition::where('id', $data['requisition_id'])->lockForUpdate()->first();
                $error = null;
                if ($requisition->company_id !== $companyId) {
                    $error = 'Requisition not found.';
                } elseif ($requisition->approval_status !== 'approved') {
                    $error = 'Only an approved requisition can be dispatched.';
                } elseif ($requisition->dispatch_id) {
                    $error = 'This requisition has already been dispatched.';
                }
                if ($error) {
                    DB::rollBack();
                    return response()->json(['status' => 'failed', 'message' => $error], 422);
                }
            }

            $dispatchNumber = $this->generateDispatchNumber($companyId);
            $items = $data['items'];
            foreach ($items as $index => $item) {
                $product = Product::find($item['product_id']);
                if (!$product) {
                    DB::rollBack();
                    return response()->json([
                        'status' => 'failed',
                        'message' => "Item at index {$index}: Product not found."
                    ], 404);
                }
                if (!empty($item['variant_id'])) {
                    // Variants aren't store-scoped in this schema (store_id is unset on
                    // every variant) - per-store availability is tracked via InventoryBatch
                    // instead, validated separately below when a batch_id is supplied.
                    $variant = \App\Models\ProductVariant::where('id', $item['variant_id'])
                        ->where('product_id', $item['product_id'])
                        ->lockForUpdate()
                        ->first();
                    if (!$variant) {
                        DB::rollBack();
                        return response()->json([
                            'status' => 'failed',
                            'message' => "Item at index {$index}: Variant not found for this product."
                        ], 404);
                    }
                    if ($variant->stock_quantity - $variant->on_hand < $item['quantity']) {
                        DB::rollBack();
                        return response()->json([
                            'status' => 'failed',
                            'message' => "Item at index {$index}: Insufficient available stock for the variant in the store."
                        ], 422);
                    }
                } else {
                    if ($product->stock_quantity - $product->on_hand < $item['quantity']) {
                        DB::rollBack();
                        return response()->json([
                            'status' => 'failed',
                            'message' => "Item at index {$index}: Insufficient available stock in the store."
                        ], 422);
                    }
                }
                if (!empty($item['batch_id'])) {
                    $batchOrError = $this->resolveDispatchBatch(
                        $item['batch_id'],
                        $item['product_id'],
                        $item['variant_id'] ?? null,
                        $data['from_store_id'],
                        $item['quantity']
                    );
                    if (is_string($batchOrError)) {
                        DB::rollBack();
                        return response()->json([
                            'status' => 'failed',
                            'message' => "Item at index {$index}: {$batchOrError}"
                        ], 422);
                    }
                }
            }
            $dispatch = Dispatch::create([
                'id' => (string) Str::uuid(),
                'dispatch_number' => $dispatchNumber,
                'from_store_id' => $data['from_store_id'],
                'to_entity' => $data['to_entity'],
                'to_user_id' => $data['to_user_id'] ?? null,
                'type' => $data['type'],
                'is_returnable' => false, // legacy, always false, kept for backward compatibility
                'return_date' => null, // legacy, always null, kept for backward compatibility
                'is_returned' => false,
                'notes' => $data['notes'] ?? null,
                'acknowledged_by' => null,
                'created_by' => $user->id,
            ]);
            foreach ($items as $item) {
                $product = Product::find($item['product_id']);
                $variant = !empty($item['variant_id']) ? \App\Models\ProductVariant::find($item['variant_id']) : null;
                \App\Models\DispatchItem::create([
                    'id' => (string) Str::uuid(),
                    'dispatch_id' => $dispatch->id,
                    'product_id' => $item['product_id'],
                    'variant_id' => $item['variant_id'] ?? null,
                    'batch_id' => $item['batch_id'] ?? null,
                    'quantity' => $item['quantity'],
                    'received_quantity' => 0,
                    'notes' => $item['notes'] ?? null,
                    'is_returnable' => $item['is_returnable'] ?? false,
                    'is_returned' => $item['is_returned'] ?? false,
                    'return_date' => $item['return_date'] ?? null,
                ]);
                if ($variant) {
                    $variant->increment('on_hand', $item['quantity']);
                } else {
                    $product->increment('on_hand', $item['quantity']);
                }
                if (!empty($item['batch_id'])) {
                    $batch = InventoryBatch::find($item['batch_id']);
                    $batch?->allocateForDispatch($item['quantity'], [
                        'reference_type' => 'dispatch',
                        'reference_id' => $dispatch->id,
                        'reference_number' => $dispatch->dispatch_number,
                    ], 'Dispatch ' . $dispatch->dispatch_number);
                }
            }
            if ($requisition) {
                $requisition->update([
                    'status' => 'dispatched',
                    'dispatch_id' => $dispatch->id,
                ]);
            }
            DB::commit();
            return response()->json([
                'status' => 'success',
                'message' => 'Dispatch created successfully.',
                'dispatch' => $dispatch->load('dispatchItems.product', 'dispatchItems.variant', 'dispatchItems.batch')
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'status' => 'failed',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    public function acknowledge(Request $request, $id)
    {
        $dispatch = Dispatch::with('dispatchItems')->findOrFail($id);
        // Consistent companyId logic
        $companyId = null;
        if ($dispatch->fromStore && property_exists($dispatch->fromStore, 'company_id')) {
            $companyId = $dispatch->fromStore->company_id;
        } elseif ($dispatch->dispatchItems->count() > 0 && $dispatch->dispatchItems[0]->product && property_exists($dispatch->dispatchItems[0]->product, 'company_id')) {
            $companyId = $dispatch->dispatchItems[0]->product->company_id;
        }
        if (!$this->hasPermission($request, 'can_acknowledge_dispatches') || !$this->hasPermission($request, "can_manage_company", $companyId)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to acknowledge this dispatch.'
            ], 403);
        }
        $user = $request->user();
        $items = $request->input('items');
        if (!is_array($items) || empty($items)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'You must provide an list of items with received quantities.'
            ], 422);
        }
        DB::beginTransaction();
        try {
            $allReceived = true;
            foreach ($items as $itemData) {
                if (!isset($itemData['id']) || !isset($itemData['received_quantity'])) {
                    DB::rollBack();
                    return response()->json([
                        'status' => 'failed',
                        'message' => 'Each item must have id and received_quantity.'
                    ], 422);
                }
                // Lock the row for update to prevent race conditions
                $item = \App\Models\DispatchItem::where('id', $itemData['id'])->lockForUpdate()->first();
                if (!$item || $item->dispatch_id !== $dispatch->id) {
                    DB::rollBack();
                    return response()->json([
                        'status' => 'failed',
                        'message' => 'Dispatch item not found: ' . $itemData['id']
                    ], 404);
                }
                $toReceive = (int) $itemData['received_quantity'];
                if ($toReceive < 0) {
                    DB::rollBack();
                    return response()->json([
                        'status' => 'failed',
                        'message' => 'Invalid received_quantity for item: ' . $item->id
                    ], 422);
                }
                $newReceived = $item->received_quantity + $toReceive;
                if ($newReceived > $item->quantity) {
                    DB::rollBack();
                    return response()->json([
                        'status' => 'failed',
                        'message' => 'Total received_quantity exceeds dispatch quantity for item: ' . $item->id
                    ], 422);
                }
                // Move from on_hand to stock_quantity on acknowledgment - defensive
                // recheck even though stock was already reserved at dispatch creation,
                // in case it was reduced in between (e.g. by a stock adjustment).
                $product = $item->product;
                $variant = $item->variant_id ? \App\Models\ProductVariant::find($item->variant_id) : null;
                $toAcknowledge = $toReceive;
                if ($error = $this->insufficientStockMessage($product, $variant, $toAcknowledge)) {
                    DB::rollBack();
                    return response()->json([
                        'status' => 'failed',
                        'message' => $error,
                    ], 422);
                }
                if ($variant) {
                    $variant->decrement('on_hand', $toAcknowledge);
                    $variant->decrement('stock_quantity', $toAcknowledge);
                } else {
                    $product->decrement('on_hand', $toAcknowledge);
                    $product->decrement('stock_quantity', $toAcknowledge);
                }
                if ($item->batch_id) {
                    $batch = InventoryBatch::find($item->batch_id);
                    $issued = $batch?->issueForDispatch($toAcknowledge, [
                        'reference_type' => 'dispatch',
                        'reference_id' => $dispatch->id,
                        'reference_number' => $dispatch->dispatch_number,
                    ], 'Acknowledged dispatch ' . $dispatch->dispatch_number);
                    if ($batch && !$issued) {
                        DB::rollBack();
                        return response()->json([
                            'status' => 'failed',
                            'message' => 'Insufficient allocated quantity in batch for item: ' . $item->id,
                        ], 422);
                    }
                }
                $item->received_quantity = $newReceived;
                $item->save();
                if ($newReceived < $item->quantity) {
                    $allReceived = false;
                }
            }
            if ($allReceived && !$dispatch->acknowledged_by) {
                $dispatch->acknowledged_by = $user->id;
                $dispatch->save();
            }
            DB::commit();
            return response()->json([
                'status' => 'success',
                'message' => $allReceived ? 'All items have been acknowledged.' : 'Partial receipt recorded.',
                'dispatch' => $dispatch->fresh('dispatchItems')
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'status' => 'failed',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    public function overdue(Request $request)
    {
        if (!$this->hasPermission($request, 'can_view_dispatches')) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view overdue dispatches.'
            ], 403);
        }
        $today = now()->toDateString();
        // For Postgres compatibility, cast boolean to integer (1/0)
        $overdue = \App\Models\DispatchItem::whereRaw('is_returnable::int = 1')
            ->whereRaw('is_returned::int = 0')
            ->whereDate('return_date', '<', $today)
            ->with(['dispatch', 'product', 'variant'])
            ->get();
        return response()->json([
            'status' => 'success',
            'message' => 'Overdue dispatch items retrieved successfully.',
            'overdue' => $overdue
        ]);
    }

    /**
     * Remove the specified dispatch and restore stock.
     */
    public function destroy(Request $request, $id)
    {
        $dispatch = Dispatch::with('dispatchItems')->findOrFail($id);
        // Determine companyId for authorization
        // Always set companyId, fallback to logged-in user's company if not found
        $companyId = $request->user()->company_id;
        if ($dispatch->fromStore && property_exists($dispatch->fromStore, 'company_id')) {
            $companyId = $dispatch->fromStore->company_id;
        } elseif ($dispatch->dispatchItems->count() > 0 && $dispatch->dispatchItems[0]->product && property_exists($dispatch->dispatchItems[0]->product, 'company_id')) {
            $companyId = $dispatch->dispatchItems[0]->product->company_id;
        }
        if (!$companyId) {
            $companyId = $request->user()->company_id;
        }
        if (!$this->hasPermission($request, 'can_delete_dispatches') || !$this->hasPermission($request, "can_manage_company", $companyId)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to delete this dispatch.'
            ], 403);
        }

        // Restrict deletion if dispatch is acknowledged or returned
        if ($dispatch->acknowledged_by || $dispatch->is_returned) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Cannot delete a dispatch that is acknowledged or marked as returned.'
            ], 422);
        }

        DB::beginTransaction();
        try {
            // Release on_hand for all unacknowledged items
            foreach ($dispatch->dispatchItems as $item) {
                $product = Product::find($item->product_id);
                $variant = $item->variant_id ? \App\Models\ProductVariant::find($item->variant_id) : null;
                $releaseQty = $item->quantity - $item->received_quantity;
                if ($releaseQty > 0) {
                    if ($variant) {
                        $variant->decrement('on_hand', $releaseQty);
                    } else {
                        $product->decrement('on_hand', $releaseQty);
                    }
                    if ($item->batch_id) {
                        $item->batch?->releaseDispatchAllocation($releaseQty, [
                            'reference_type' => 'dispatch',
                            'reference_id' => $dispatch->id,
                            'reference_number' => $dispatch->dispatch_number,
                        ], 'Dispatch ' . $dispatch->dispatch_number . ' deleted');
                    }
                }
            }
            // Optionally, log the deletion for audit
            Log::info('Dispatch deleted', [
                'dispatch_id' => $dispatch->id,
                'deleted_by' => $request->user()->id,
                'deleted_at' => now(),
            ]);
            // Optionally, fire an event here

            // Save deleted data for response
            $deletedData = $dispatch->toArray();
            $deletedData['items'] = $dispatch->dispatchItems->toArray();

            // Delete dispatch items and dispatch
            // If using SoftDeletes, this will soft delete; otherwise, hard delete
            $dispatch->dispatchItems()->delete();
            $dispatch->delete();

            // TODO: Handle related data (logs, notifications, etc.) if needed

            DB::commit();
            return response()->json([
                'status' => 'success',
                'message' => 'Dispatch deleted successfully.',
                'deleted_dispatch' => $deletedData
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to delete dispatch', [
                'dispatch_id' => $dispatch->id,
                'error' => $e->getMessage(),
            ]);
            return response()->json([
                'status' => 'failed',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Generate a printable "Requisition Note" for a dispatch — a goods-issue
     * slip showing each item, the batch it was pulled from, and its expiry
     * date, for warehouse traceability and handover.
     */
    public function printRequisitionNote(Request $request, $dispatchId)
    {
        $dispatch = Dispatch::with([
            'dispatchItems.product',
            'dispatchItems.variant',
            'dispatchItems.batch',
            'fromStore',
            'toUser',
            'createdBy',
        ])->findOrFail($dispatchId);

        $companyId = null;
        if ($dispatch->fromStore && property_exists($dispatch->fromStore, 'company_id')) {
            $companyId = $dispatch->fromStore->company_id;
        } elseif ($dispatch->dispatchItems->count() > 0 && $dispatch->dispatchItems[0]->product && property_exists($dispatch->dispatchItems[0]->product, 'company_id')) {
            $companyId = $dispatch->dispatchItems[0]->product->company_id;
        }

        if (!$this->hasPermission($request, 'can_view_dispatches')) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view this dispatch.'
            ], 403);
        }

        $requisition = Requisition::where('dispatch_id', $dispatch->id)
            ->with(['requester', 'approver'])
            ->first();

        $company = \App\Models\Company::find(
            $dispatch->fromStore?->company_id
                ?? $dispatch->dispatchItems->first()?->product?->company_id
                ?? $request->user()->company_id
        );

        $pdf = Pdf::loadView('requisitions.note', [
            'dispatch' => $dispatch,
            'requisition' => $requisition,
            'company' => $company,
        ])->setPaper('a4', 'portrait');

        $filename = 'requisition-note-' . $dispatch->dispatch_number . '.pdf';

        return response()->streamDownload(function () use ($pdf) {
            echo $pdf->output();
        }, $filename, [
            'Content-Type' => 'application/pdf',
        ]);
    }
}
