<?php

namespace App\Http\Controllers;

use App\Models\InventoryBatch;
use App\Models\InventoryMovement;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\PurchaseOrderReturn;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Services\PurchaseOrderReceivingService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * A purchase order records what was ordered. Stock arrives through product receipts raised
 * against it (see PurchaseOrderReceivingService), which keep its received quantities current.
 */
class PurchaseOrderController extends Controller
{
    protected PurchaseOrderReceivingService $receiving;

    // variant.product lets ProductVariant::display_name resolve without a query per size.
    protected const RELATIONS = [
        'items.product',
        'items.variant.product:id,name',
        'items.store:id,name',
        'supplier:id,name,phone,email',
        'store:id,name',
        'approvedBy:id,first_name,last_name',
        'productReceipts:id,purchase_order_id,product_receipt_number,reference_number,created_at',
    ];

    public function __construct(PurchaseOrderReceivingService $receiving)
    {
        $this->middleware('auth:sanctum');
        $this->receiving = $receiving;
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

    protected function generateOrderNumber($companyId)
    {
        $prefix = 'PO-' . substr($companyId, 0, 8) . '-';

        $lastPO = DB::table('purchase_orders')
            ->select('order_number')
            ->where('company_id', $companyId)
            ->where('order_number', 'like', $prefix . '%')
            ->whereRaw("order_number ~ ?", ['^' . preg_quote($prefix) . '[0-9]+$'])
            ->orderBy('order_number', 'desc')
            ->lockForUpdate()
            ->first();

        $nextNumber = $lastPO ? (int) substr($lastPO->order_number, strlen($prefix)) + 1 : 1;
        return $prefix . str_pad($nextNumber, 4, '0', STR_PAD_LEFT);
    }

    protected function recalculateTotal(PurchaseOrder $purchaseOrder): void
    {
        $this->receiving->recalculateTotal($purchaseOrder);
    }

    protected function itemName(?Product $product, ?ProductVariant $variant, ?string $fallback = null): string
    {
        if ($variant) {
            return ProductVariant::sizedName($product?->name, $variant->name);
        }
        return $product?->name ?? $fallback ?? '';
    }

    protected function present(PurchaseOrder $order): array
    {
        $order->loadMissing(self::RELATIONS);
        $data = $order->toArray();
        $data['items'] = $order->items->map(function (PurchaseOrderItem $item) {
            $row = $item->toArray();
            $row['item_name'] = $this->itemName($item->product, $item->variant, $item->description);
            $row['item_number'] = $item->product?->item_number;
            $row['size'] = $item->variant?->name;
            $row['pending_quantity'] = max(0, $item->quantity - $item->received_quantity);
            $row['over_received_quantity'] = max(0, $item->received_quantity - $item->quantity);
            $row['returnable_quantity'] = max(0, $item->received_quantity - $item->returned_quantity);
            return $row;
        })->values()->all();
        return $data;
    }

    protected function findForCompany(Request $request, $id): ?PurchaseOrder
    {
        $query = PurchaseOrder::where('id', $id);
        if (!$this->hasPermission($request, 'can_manage_all_purchase_orders')) {
            $query->where('company_id', $request->user()->company_id);
        }
        return $query->first();
    }

    protected function hasReceipts(PurchaseOrder $order): bool
    {
        return $order->productReceipts()->exists()
            || $order->items()->where('received_quantity', '>', 0)->exists();
    }

    /**
     * Resolve requested lines against the catalogue. Sized items need a size, the size must
     * belong to the item and still be active, and repeated item+size lines are merged.
     *
     * @return array{0: array, 1: string|null} [lines, error]
     */
    protected function resolveLines(array $items, string $companyId, ?string $defaultStoreId): array
    {
        $lines = [];
        foreach ($items as $index => $itemData) {
            $row = $index + 1;
            $product = Product::where('company_id', $companyId)->find($itemData['product_id']);
            if (!$product) {
                return [[], "Line {$row}: item not found."];
            }

            $variant = null;
            if (!empty($itemData['variant_id'])) {
                $variant = ProductVariant::where('id', $itemData['variant_id'])
                    ->where('product_id', $product->id)
                    ->first();
                if (!$variant) {
                    return [[], "Line {$row}: that size does not belong to {$product->name}."];
                }
            } elseif ($product->has_variations && $product->variants()->exists()) {
                return [[], "Line {$row}: pick a size for {$product->name}."];
            }

            $key = $product->id . '|' . ($variant?->id ?? '');
            $quantity = (int) $itemData['quantity'];
            $unitPrice = (float) $itemData['unit_price'];

            if (isset($lines[$key])) {
                $lines[$key]['quantity'] += $quantity;
                $lines[$key]['subtotal'] = $lines[$key]['quantity'] * $lines[$key]['unit_price'];
                continue;
            }

            $lines[$key] = [
                'product_id' => $product->id,
                'variant_id' => $variant?->id,
                'quantity' => $quantity,
                'unit_price' => $unitPrice,
                'subtotal' => $quantity * $unitPrice,
                'sku' => $variant?->sku ?: $product->sku,
                'description' => $this->itemName($product, $variant),
                'store_id' => $itemData['store_id'] ?? $defaultStoreId,
            ];
        }
        return [array_values($lines), null];
    }

    protected function createLines(PurchaseOrder $purchaseOrder, array $lines): void
    {
        foreach ($lines as $line) {
            PurchaseOrderItem::create(array_merge($line, [
                'id' => (string) Str::uuid(),
                'purchase_order_id' => $purchaseOrder->id,
                'received_quantity' => 0,
                'returned_quantity' => 0,
            ]));
        }
    }

    protected function linesSignature(iterable $lines): string
    {
        return collect($lines)
            ->map(fn ($l) => implode('|', [
                $l['product_id'],
                $l['variant_id'] ?? '',
                (int) $l['quantity'],
                number_format((float) $l['unit_price'], 2, '.', ''),
            ]))
            ->sort()
            ->implode(';');
    }

    protected function lineRules(string $prefix = ''): array
    {
        return [
            'items' => $prefix . 'required|array|min:1',
            'items.*.product_id' => 'required|string|exists:products,id',
            'items.*.variant_id' => 'nullable|string|exists:product_variants,id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.unit_price' => 'required|numeric|min:0',
            'items.*.store_id' => 'nullable|string|exists:stores,id',
        ];
    }

    protected function syncParentStock(Product $product): void
    {
        $this->receiving->syncParentStock($product);
    }

    public function index(Request $request)
    {
        $user = $request->user();
        // Whoever records product receipts needs the open orders to receive against.
        $receivable = $request->boolean('receivable');
        $allowed = $this->hasPermission($request, 'can_view_purchase_orders', $user->company_id)
            || ($receivable && $this->hasPermission($request, 'can_create_product_receipts', $user->company_id));
        if (!$allowed) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view purchase orders.',
            ], 403);
        }
        $query = PurchaseOrder::with(self::RELATIONS)->where('company_id', $user->company_id);
        if ($receivable) {
            $query->where('approval_status', 'approved')->whereIn('status', ['pending', 'partial']);
        }
        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }
        if ($request->filled('supplier_id')) {
            $query->where('supplier_id', $request->input('supplier_id'));
        }
        $orders = $query->orderBy('created_at', 'desc')->get();

        return response()->json([
            'status' => 'success',
            'message' => 'Purchase orders retrieved successfully.',
            'data' => $orders->map(fn ($o) => $this->present($o))->values(),
        ], 200);
    }

    public function show(Request $request, $id)
    {
        $order = $this->findForCompany($request, $id);
        if (!$order) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Purchase order not found or not authorized.',
            ], 404);
        }
        return response()->json([
            'status' => 'success',
            'message' => 'Purchase order retrieved successfully.',
            'data' => $this->present($order),
        ], 200);
    }

    public function store(Request $request)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_create_purchase_orders', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to create purchase orders.',
            ], 403);
        }

        $validator = Validator::make($request->all(), array_merge([
            'supplier_id' => 'required|string|exists:suppliers,id',
            'order_date' => 'required|date',
            'delivery_date' => 'nullable|date|after_or_equal:order_date',
            'store_id' => 'nullable|string|exists:stores,id',
            'currency_code' => 'nullable|string|size:3',
            'comments' => 'nullable|string|max:2000',
        ], $this->lineRules()));

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors()->first(),
                'errors' => $validator->errors(),
            ], 422);
        }

        [$lines, $error] = $this->resolveLines($request->input('items'), $user->company_id, $request->input('store_id') ?: null);
        if ($error) {
            return response()->json(['status' => 'failed', 'message' => $error], 422);
        }

        try {
            $purchaseOrder = DB::transaction(function () use ($request, $user, $lines) {
                $purchaseOrder = PurchaseOrder::create([
                    'id' => (string) Str::uuid(),
                    'company_id' => $user->company_id,
                    'supplier_id' => $request->input('supplier_id'),
                    'order_number' => $this->generateOrderNumber($user->company_id),
                    'order_date' => $request->input('order_date'),
                    'delivery_date' => $request->input('delivery_date') ?: null,
                    'store_id' => $request->input('store_id') ?: null,
                    'currency_code' => $request->input('currency_code', 'KES'),
                    'comments' => $request->input('comments'),
                    'status' => 'pending',
                    'approval_status' => 'pending',
                    'amount_paid' => 0,
                    'created_by' => $user->id,
                ]);
                $this->createLines($purchaseOrder, $lines);
                $this->recalculateTotal($purchaseOrder);
                return $purchaseOrder;
            });

            return response()->json([
                'status' => 'success',
                'message' => 'Purchase order created successfully.',
                'data' => $this->present($purchaseOrder->fresh()),
            ], 201);
        } catch (\Throwable $e) {
            Log::error('Failed to create purchase order', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to create purchase order: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function update(Request $request, $id)
    {
        $purchaseOrder = $this->findForCompany($request, $id);
        if (!$purchaseOrder) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Purchase order not found.',
            ], 404);
        }

        $user = $request->user();
        if (!$this->hasPermission($request, 'can_update_purchase_orders', $purchaseOrder->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to edit this purchase order.',
            ], 403);
        }

        $received = $this->hasReceipts($purchaseOrder);
        if ($received && collect($request->except(['comments']))->keys()->diff(['delivery_date', 'status'])->isNotEmpty()) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Stock has already been received against this purchase order, so only its comments can be changed.',
            ], 422);
        }
        if ($purchaseOrder->status === 'cancelled') {
            return response()->json([
                'status' => 'failed',
                'message' => 'This purchase order is cancelled.',
            ], 422);
        }

        $validator = Validator::make($request->all(), array_merge([
            'supplier_id' => 'sometimes|required|string|exists:suppliers,id',
            'order_date' => 'sometimes|required|date',
            'delivery_date' => 'nullable|date',
            'store_id' => 'nullable|string|exists:stores,id',
            'currency_code' => 'nullable|string|size:3',
            'status' => 'sometimes|required|string|in:pending,cancelled',
            'comments' => 'nullable|string|max:2000',
        ], $this->lineRules('sometimes|')));

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors()->first(),
                'errors' => $validator->errors(),
            ], 422);
        }
        if ($received && $request->input('status') === 'cancelled') {
            return response()->json([
                'status' => 'failed',
                'message' => 'A purchase order with received stock cannot be cancelled. Return the stock instead.',
            ], 422);
        }

        $lines = null;
        if ($request->has('items')) {
            [$lines, $error] = $this->resolveLines(
                $request->input('items'),
                $purchaseOrder->company_id,
                $request->input('store_id', $purchaseOrder->store_id) ?: null
            );
            if ($error) {
                return response()->json(['status' => 'failed', 'message' => $error], 422);
            }
        }

        try {
            DB::transaction(function () use ($request, $user, $purchaseOrder, $lines) {
                $fields = $request->only([
                    'supplier_id', 'order_date', 'delivery_date', 'store_id', 'currency_code',
                    'status', 'comments',
                ]);
                foreach (['delivery_date', 'store_id'] as $nullable) {
                    if (array_key_exists($nullable, $fields) && $fields[$nullable] === '') {
                        $fields[$nullable] = null;
                    }
                }

                $changesTerms = $lines !== null
                    && $this->linesSignature($lines) !== $this->linesSignature($purchaseOrder->items->toArray());
                $changesTerms = $changesTerms || (isset($fields['supplier_id']) && $fields['supplier_id'] !== $purchaseOrder->supplier_id);

                // Approval was given for specific items, quantities and prices.
                if ($changesTerms && $purchaseOrder->approval_status === 'approved') {
                    $fields['approval_status'] = 'pending';
                    $fields['approved_by'] = null;
                }

                $purchaseOrder->update(array_merge($fields, ['updated_by' => $user->id]));

                if ($lines !== null) {
                    $purchaseOrder->items()->delete();
                    $this->createLines($purchaseOrder, $lines);
                }

                $this->recalculateTotal($purchaseOrder);
            });

            return response()->json([
                'status' => 'success',
                'message' => 'Purchase order updated successfully.',
                'data' => $this->present($purchaseOrder->fresh()),
            ], 200);
        } catch (\Throwable $e) {
            Log::error('Failed to update purchase order', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to update purchase order: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Send received stock back to the supplier. Stock leaves this PO's receipt batches first,
     * and the PO total drops by the returned value.
     */
    public function returnItems(Request $request, $id)
    {
        $purchaseOrder = $this->findForCompany($request, $id);
        if (!$purchaseOrder) {
            return response()->json(['status' => 'failed', 'message' => 'Purchase order not found.'], 404);
        }

        $user = $request->user();
        if (!$this->hasPermission($request, 'can_receive_purchase_orders', $purchaseOrder->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to return stock on this purchase order.'], 403);
        }

        $validator = Validator::make($request->all(), [
            'items' => 'required|array|min:1',
            'items.*.id' => 'required|string|exists:purchase_order_items,id',
            'items.*.returned_quantity' => 'required|integer|min:0',
            'reason' => 'required|string|max:1000',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors()->first(),
                'errors' => $validator->errors(),
            ], 422);
        }

        $requested = collect($request->input('items'))->filter(fn ($i) => (int) $i['returned_quantity'] > 0)->keyBy('id');
        if ($requested->isEmpty()) {
            return response()->json(['status' => 'failed', 'message' => 'Enter a quantity to return for at least one line.'], 422);
        }

        $purchaseOrder->load('items.product', 'items.variant');
        $items = $purchaseOrder->items->keyBy('id');

        foreach ($requested as $itemId => $input) {
            $item = $items[$itemId] ?? null;
            if (!$item) {
                return response()->json(['status' => 'failed', 'message' => 'A line does not belong to this purchase order.'], 422);
            }
            $qty = (int) $input['returned_quantity'];
            $returnable = $item->received_quantity - $item->returned_quantity;
            $name = $this->itemName($item->product, $item->variant, $item->description);
            if ($qty > $returnable) {
                return response()->json(['status' => 'failed', 'message' => "{$name}: returning {$qty} but only {$returnable} received and not yet returned."], 422);
            }
            $target = $item->variant ?: $item->product;
            if ($item->product?->track_inventory !== false && $target && (int) $target->stock_quantity < $qty) {
                return response()->json(['status' => 'failed', 'message' => "{$name}: only {$target->stock_quantity} left in stock."], 422);
            }
        }

        try {
            $orderNumber = $purchaseOrder->order_number;
            DB::transaction(function () use ($purchaseOrder, $requested, $items, $user, $orderNumber, $request) {
                $summary = [];
                foreach ($requested as $itemId => $input) {
                    $item = $items[$itemId];
                    $qty = (int) $input['returned_quantity'];
                    $product = $item->product;
                    $variant = $item->variant;
                    $summary[] = $this->itemName($product, $variant, $item->description) . " x{$qty}";

                    if ($product && $product->track_inventory !== false) {
                        $target = $variant ?: $product;
                        $target->stock_quantity = max(0, (int) $target->stock_quantity - $qty);
                        $target->on_hand = max(0, (int) $target->on_hand - $qty);
                        $target->save();

                        $movement = [
                            'company_id' => $purchaseOrder->company_id,
                            'product_id' => $product->id,
                            'variant_id' => $variant?->id,
                            'type' => 'return',
                            'unit_cost' => $item->unit_price,
                            'reference_type' => 'purchase_order_return',
                            'reference_id' => $purchaseOrder->id,
                            'reference_number' => $orderNumber,
                            'movement_date' => now(),
                            'created_by' => $user->id,
                            'notes' => "Returned to supplier from {$orderNumber}: " . $request->input('reason'),
                        ];

                        // Take it from the batches this PO's receipts brought in first.
                        $left = $qty;
                        $batches = InventoryBatch::where('product_id', $product->id)
                            ->when($variant, fn ($q) => $q->where('variant_id', $variant->id), fn ($q) => $q->whereNull('variant_id'))
                            ->where('quantity_available', '>', 0)
                            ->orderByRaw('CASE WHEN product_receipt_id IN (SELECT id FROM product_receipts WHERE purchase_order_id = ?) THEN 0 ELSE 1 END', [$purchaseOrder->id])
                            ->orderBy('received_date', 'desc')
                            ->lockForUpdate()
                            ->get();
                        foreach ($batches as $batch) {
                            if ($left <= 0) {
                                break;
                            }
                            $take = min($left, (int) $batch->quantity_available);
                            $batchBefore = (int) $batch->quantity_available;
                            $batch->quantity_available -= $take;
                            $batch->quantity_received = max(0, (int) $batch->quantity_received - $take);
                            $batch->save();
                            $batch->updateStatus();
                            $left -= $take;

                            InventoryMovement::create($movement + [
                                'store_id' => $batch->store_id,
                                'batch_id' => $batch->id,
                                'quantity' => -$take,
                                'quantity_before' => $batchBefore,
                                'quantity_after' => $batch->quantity_available,
                                'total_cost' => $take * (float) $item->unit_price,
                            ]);
                        }
                        // Stock received without a batch.
                        if ($left > 0) {
                            InventoryMovement::create($movement + [
                                'store_id' => $item->store_id ?: ($purchaseOrder->store_id ?: ($variant?->store_id ?: $product->store_id)),
                                'quantity' => -$left,
                                'quantity_before' => (int) $target->stock_quantity + $left,
                                'quantity_after' => (int) $target->stock_quantity,
                                'total_cost' => $left * (float) $item->unit_price,
                            ]);
                        }

                        if ($variant) {
                            $this->syncParentStock($product);
                        }
                    }

                    $item->returned_quantity += $qty;
                    $item->save();
                }

                PurchaseOrderReturn::create([
                    'supplier_id' => $purchaseOrder->supplier_id,
                    'purchase_order_id' => $purchaseOrder->id,
                    'reason' => $request->input('reason'),
                    'return_date' => now(),
                    'status' => 'completed',
                    'notes' => implode(', ', $summary),
                ]);

                $purchaseOrder->updated_by = $user->id;
                $purchaseOrder->save();
                $this->receiving->sync($purchaseOrder->fresh());
            });

            return response()->json([
                'status' => 'success',
                'message' => 'Return recorded and stock removed.',
                'data' => $this->present($purchaseOrder->fresh()),
            ], 200);
        } catch (\Throwable $e) {
            Log::error('Failed to return purchase order stock', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to record return: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function destroy(Request $request, $id)
    {
        $purchaseOrder = $this->findForCompany($request, $id);
        if (!$purchaseOrder) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Purchase order not found.',
            ], 404);
        }
        if (!$this->hasPermission($request, 'can_delete_purchase_orders', $purchaseOrder->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to delete this purchase order.',
            ], 403);
        }
        if ($this->hasReceipts($purchaseOrder)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Stock has been received against this purchase order, so it cannot be deleted.',
            ], 422);
        }
        if ((float) $purchaseOrder->amount_paid > 0) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Payments have been made against this purchase order, so it cannot be deleted.',
            ], 422);
        }
        try {
            DB::transaction(function () use ($purchaseOrder) {
                $purchaseOrder->items()->delete();
                $purchaseOrder->delete();
            });
            return response()->json([
                'status' => 'success',
                'message' => 'Purchase order deleted successfully.'
            ]);
        } catch (\Throwable $e) {
            Log::error('Failed to delete purchase order', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to delete purchase order: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function approve(Request $request, $id)
    {
        $purchaseOrder = $this->findForCompany($request, $id);
        if (!$purchaseOrder) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Purchase order not found.',
            ], 404);
        }

        $user = $request->user();
        // Held only by the GM and Director roles; company/system admin rights deliberately don't imply it.
        if (!$user->role?->hasPermission('can_approve_purchase_orders') || $user->company_id !== $purchaseOrder->company_id) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Only the GM or a Director can approve purchase orders.',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'approval_status' => 'required|string|in:approved,rejected',
            'notes' => 'nullable|string',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors()->first(),
                'errors' => $validator->errors(),
            ], 422);
        }
        if ($purchaseOrder->status === 'cancelled') {
            return response()->json(['status' => 'failed', 'message' => 'This purchase order is cancelled.'], 422);
        }
        if (!$purchaseOrder->items()->exists()) {
            return response()->json(['status' => 'failed', 'message' => 'This purchase order has no items to approve.'], 422);
        }

        try {
            $purchaseOrder->update([
                'approval_status' => $request->input('approval_status'),
                'approved_by' => $user->id,
                'comments' => $request->input('notes') ?: $purchaseOrder->comments,
            ]);

            return response()->json([
                'status' => 'success',
                'message' => $request->input('approval_status') === 'approved'
                    ? 'Purchase order approved successfully.'
                    : 'Purchase order rejected.',
                'data' => $this->present($purchaseOrder->fresh()),
            ], 200);
        } catch (\Throwable $e) {
            Log::error('Failed to approve purchase order', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to approve purchase order: ' . $e->getMessage(),
            ], 500);
        }
    }
}
