<?php

namespace App\Http\Controllers;

use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Services\LandedCostAllocationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class PurchaseOrderController extends Controller
{
    protected LandedCostAllocationService $landedCostService;

    public function __construct(LandedCostAllocationService $landedCostService)
    {
        $this->middleware('auth:sanctum');
        $this->landedCostService = $landedCostService;
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

    // Generate a unique purchase order number for the company
    protected function generateOrderNumber($companyId)
    {
        $prefix = 'PO-' . substr($companyId, 0, 8) . '-';

        // Use raw query to avoid model accessors interfering
        $lastPO = DB::table('purchase_orders')
            ->select('order_number')
            ->where('company_id', $companyId)
            ->where('order_number', 'like', $prefix . '%')
            ->orderBy('order_number', 'desc')
            ->lockForUpdate()
            ->first();

        $nextNumber = $lastPO ? (int) substr($lastPO->order_number, strlen($prefix)) + 1 : 1;
        return $prefix . str_pad($nextNumber, 4, '0', STR_PAD_LEFT);
    }

    /**
     * Recompute and persist total_amount from the order's current items plus
     * shipping/logistics minus discount, and refresh payment_status against
     * whatever amount_paid already is. Must run after items are created,
     * updated or removed - nothing else keeps total_amount in sync.
     */
    protected function recalculateTotal(PurchaseOrder $purchaseOrder): void
    {
        $itemsTotal = (float) $purchaseOrder->items()->sum('subtotal');
        $totalAmount = $itemsTotal
            + (float) $purchaseOrder->shipping_cost
            + (float) $purchaseOrder->logistics_cost
            - (float) $purchaseOrder->discount;
        $totalAmount = max(0, $totalAmount);

        $amountPaid = (float) $purchaseOrder->amount_paid;
        $status = 'unpaid';
        if ($totalAmount > 0 && $amountPaid >= $totalAmount) {
            $status = 'paid';
        } elseif ($amountPaid > 0) {
            $status = 'partial';
        }

        $purchaseOrder->update([
            'total_amount' => $totalAmount,
            'payment_status' => $status,
        ]);
    }

    // List all purchase orders for the user's company
    public function index(Request $request)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_view_purchase_orders', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view purchase orders.',
            ], 403);
        }
        $query = PurchaseOrder::with([
            'items.product' => function ($q) {
                $q->with(['store', 'company', 'variants']);
            },
            'items.variant',
            'items.store',
            'supplier',
            'store'
        ]);
        $query->where('company_id', $user->company_id);
        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }
        $orders = $query->orderBy('created_at', 'desc')->get();
        return response()->json([
            'status' => 'success',
            'message' => 'Purchase orders retrieved successfully.',
            'data' => $orders,
        ], 200);
    }

    // Show a single purchase order
    public function show(Request $request, $id)
    {
        $user = $request->user();
        $query = PurchaseOrder::with([
            'items.product' => function ($q) {
                $q->with(['store', 'company', 'variants']);
            },
            'items.variant',
            'items.store',
            'supplier',
            'store'
        ])->where('id', $id);
        if (!$this->hasPermission($request, 'can_manage_all_purchase_orders')) {
            $query->where('company_id', $user->company_id);
        }
        $order = $query->first();
        if (!$order) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Purchase order not found or not authorized.',
            ], 404);
        }
        $orderArray = $order->toArray();
        $orderArray['items'] = array_map(function ($item) {
            $item['product_name'] = isset($item['product']['name']) ? $item['product']['name'] : null;
            $item['variant_name'] = isset($item['variant']['name']) ? $item['variant']['name'] : null;
            return $item;
        }, $orderArray['items'] ?? []);
        return response()->json([
            'status' => 'success',
            'message' => 'Purchase order retrieved successfully.',
            'data' => $orderArray,
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

        $validator = Validator::make($request->all(), [
            'supplier_id' => 'required|string|exists:suppliers,id',
            'order_date' => 'required|date',
            'delivery_date' => 'nullable|date|after_or_equal:order_date',
            'store_id' => 'nullable|string|exists:stores,id',
            'currency_code' => 'nullable|string|size:3',
            'shipping_cost' => 'nullable|numeric|min:0',
            'logistics_cost' => 'nullable|numeric|min:0',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|string|exists:products,id',
            'items.*.variant_id' => 'nullable|string|exists:product_variants,id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.unit_price' => 'required|numeric|min:0',
            'items.*.store_id' => 'nullable|string|exists:stores,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        try {
            DB::beginTransaction();

            $user = $request->user();
            $purchaseOrder = PurchaseOrder::create([
                'id' => (string) Str::uuid(),
                'company_id' => $user->company_id,
                'supplier_id' => $request->input('supplier_id'),
                'order_number' => $this->generateOrderNumber($user->company_id),
                'order_date' => $request->input('order_date'),
                'delivery_date' => $request->input('delivery_date'),
                'store_id' => $request->input('store_id'),
                'currency_code' => $request->input('currency_code', 'KES'),
                'shipping_cost' => $request->input('shipping_cost', 0),
                'logistics_cost' => $request->input('logistics_cost', 0),
                'status' => 'pending',
                'created_by' => $user->id,
            ]);

            foreach ($request->input('items') as $itemData) {
                $product = Product::find($itemData['product_id']);
                if (!$product || !$this->hasPermission($request, 'can_create_purchase_orders', $product->company_id)) {
                    throw new \Exception("Unauthorized or invalid product: {$itemData['product_id']}");
                }

                $variant = null;
                if (($itemData['variant_id'] ?? null)) {
                    $variant = ProductVariant::where('id', ($itemData['variant_id'] ?? null))
                        ->where('product_id', $itemData['product_id'])
                        ->first();
                    if (!$variant) {
                        throw new \Exception("Invalid variant for product: {$itemData['product_id']}");
                    }
                    if ($variant->track_inventory && $variant->stock_quantity !== null && $itemData['quantity'] > $variant->stock_quantity) {
                        throw new \Exception("Insufficient stock for variant: {$variant->sku}");
                    }
                } elseif ($product->has_variations) {
                    throw new \Exception("Product {$product->name} requires a variant selection.");
                }

                $subtotal = $itemData['quantity'] * $itemData['unit_price'];
                PurchaseOrderItem::create([
                    'id' => (string) Str::uuid(),
                    'purchase_order_id' => $purchaseOrder->id,
                    'product_id' => $itemData['product_id'],
                    'variant_id' => ($itemData['variant_id'] ?? null),
                    'quantity' => $itemData['quantity'],
                    'received_quantity' => 0, // Initialize as 0
                    'unit_price' => $itemData['unit_price'],
                    'subtotal' => $subtotal,
                    'sku' => $variant ? $variant->sku : $product->sku,
                    'store_id' => $itemData['store_id'] ?? $request->input('store_id'),
                ]);
            }

            $this->recalculateTotal($purchaseOrder);

            DB::commit();
            return response()->json([
                'status' => 'success',
                'message' => 'Purchase order created successfully.',
                'data' => $purchaseOrder->load([
                    'items.product.store',
                    'items.product.company',
                    'items.product.variants',
                    'items.variant:id,sku,product_id',
                    'items.store:id,name',
                    'supplier:id,name',
                    'store:id,name'
                ]),
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to create purchase order', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to create purchase order: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function update(Request $request, $id)
    {
        $purchaseOrder = PurchaseOrder::find($id);
        if (!$purchaseOrder) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Purchase order not found.',
            ], 404);
        }

        $user = $request->user();
        if (!$this->hasPermission($request, 'can_update_purchase_orders', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to edit purchase orders.',
            ], 403);
        }

        if (!$this->hasPermission($request, 'can_update_purchase_orders', $purchaseOrder->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to edit this purchase order.',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'supplier_id' => 'sometimes|required|string|exists:suppliers,id',
            'order_date' => 'sometimes|required|date',
            'delivery_date' => 'nullable|date|after_or_equal:order_date',
            'store_id' => 'nullable|string|exists:stores,id',
            'status' => 'sometimes|required|string|in:pending,confirmed,received,cancelled',
            'shipping_cost' => 'nullable|numeric|min:0',
            'logistics_cost' => 'nullable|numeric|min:0',
            'items' => 'sometimes|required|array|min:1',
            'items.*.product_id' => 'required|string|exists:products,id',
            'items.*.variant_id' => 'nullable|string|exists:product_variants,id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.unit_price' => 'required|numeric|min:0',
            'items.*.store_id' => 'nullable|string|exists:stores,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        try {
            $user = $request->user();
            DB::beginTransaction();

            $purchaseOrder->update(array_merge(
                $request->only([
                    'supplier_id',
                    'order_date',
                    'delivery_date',
                    'store_id',
                    'currency_code',
                    'status',
                    'comments',
                    'shipping_cost',
                    'logistics_cost',
                ]),
                ['updated_by' => $user->id]
            ));

            if ($request->has('items')) {
                PurchaseOrderItem::where('purchase_order_id', $purchaseOrder->id)->delete();
                foreach ($request->input('items') as $itemData) {
                    $product = Product::find($itemData['product_id']);
                    if (!$product || !$this->hasPermission($request, 'can_update_purchase_orders', $product->company_id)) {
                        throw new \Exception("Unauthorized or invalid product: {$itemData['product_id']}");
                    }

                    $variant = null;
                    if (($itemData['variant_id'] ?? null)) {
                        $variant = ProductVariant::where('id', ($itemData['variant_id'] ?? null))
                            ->where('product_id', $itemData['product_id'])
                            ->first();
                        if (!$variant) {
                            throw new \Exception("Invalid variant for product: {$itemData['product_id']}");
                        }
                        if ($variant->track_inventory && $variant->stock_quantity !== null && $itemData['quantity'] > $variant->stock_quantity) {
                            throw new \Exception("Insufficient stock for variant: {$variant->sku}");
                        }
                    } elseif ($product->has_variations) {
                        throw new \Exception("Product {$product->name} requires a variant selection.");
                    }

                    $subtotal = $itemData['quantity'] * $itemData['unit_price'];
                    PurchaseOrderItem::create([
                        'id' => (string) Str::uuid(),
                        'purchase_order_id' => $purchaseOrder->id,
                        'product_id' => $itemData['product_id'],
                        'variant_id' => ($itemData['variant_id'] ?? null),
                        'quantity' => $itemData['quantity'],
                        'received_quantity' => 0, // Initialize as 0
                        'unit_price' => $itemData['unit_price'],
                        'subtotal' => $subtotal,
                        'sku' => $variant ? $variant->sku : $product->sku,
                        'store_id' => $itemData['store_id'] ?? $request->input('store_id'),
                    ]);
                }
            }

            $this->recalculateTotal($purchaseOrder);

            DB::commit();
            return response()->json([
                'status' => 'success',
                'message' => 'Purchase order updated successfully.',
                'data' => $purchaseOrder->load([
                    'items.product.store',
                    'items.product.company',
                    'items.product.variants',
                    'items.variant:id,sku,product_id',
                    'items.store:id,name',
                    'supplier:id,name',
                    'store:id,name'
                ]),
                'order_number' => $purchaseOrder->order_number,
            ], 200);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to update purchase order', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to update purchase order: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function receive(Request $request, $id)
    {
        $purchaseOrder = PurchaseOrder::find($id);
        if (!$purchaseOrder) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Purchase order not found.',
            ], 404);
        }

        $user = $request->user();
        if (!$this->hasPermission($request, 'can_receive_purchase_orders', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to receive purchase orders.',
            ], 403);
        }

        if (!$this->hasPermission($request, 'can_receive_purchase_orders', $purchaseOrder->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to receive this purchase order.',
            ], 403);
        }

        if ($purchaseOrder->status === 'received' || $purchaseOrder->status === 'partial') {
            return response()->json([
                'status' => 'failed',
                'message' => 'Purchase order already received or partially receipted. Please receipt the latest split PO.',
            ], 400);
        }

        $validator = Validator::make($request->all(), [
            'items' => 'required|array|min:1',
            'items.*.id' => 'required|string|exists:purchase_order_items,id',
            'items.*.received_quantity' => 'required|integer|min:0',
            'shipping_cost' => 'nullable|numeric|min:0',
            'logistics_cost' => 'nullable|numeric|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        try {
            DB::beginTransaction();

            $user = $request->user();
            $remainingItems = [];
            $receivedItems = $request->input('items');
            $shippingCost = (float) $request->input('shipping_cost', 0);
            $logisticsCost = (float) $request->input('logistics_cost', 0);
            $landedCostLines = [];

            foreach ($receivedItems as $receivedItem) {
                $item = PurchaseOrderItem::where('id', $receivedItem['id'])
                    ->where('purchase_order_id', $purchaseOrder->id)
                    ->first();
                if (!$item) {
                    throw new \Exception("Invalid item ID: {$receivedItem['id']}");
                }
                if ($receivedItem['received_quantity'] > $item->quantity) {
                    throw new \Exception("Received quantity for item {$item->sku} exceeds ordered quantity.");
                }
                if ($receivedItem['received_quantity'] > 0) {
                    if ($item->variant_id) {
                        $variant = ProductVariant::find($item->variant_id);
                        if ($variant) {
                            $variant->stock_quantity = (int) $variant->stock_quantity + (int) $receivedItem['received_quantity'];
                            $variant->on_hand = (int) $variant->on_hand + (int) $receivedItem['received_quantity'];
                            $variant->save();
                        } else {
                            throw new \Exception("Variant not found: {$item->variant_id}");
                        }
                    } else {
                        $product = Product::find($item->product_id);
                        if ($product && !$product->has_variations) {
                            $product->stock_quantity = (int) $product->stock_quantity + (int) $receivedItem['received_quantity'];
                            $product->on_hand = (int) $product->on_hand + (int) $receivedItem['received_quantity'];
                            $product->save();
                        } else {
                            throw new \Exception("Product {$item->product_id} requires a variant or is invalid.");
                        }
                    }
                    // Update received_quantity for the item
                    $item->received_quantity += (int) $receivedItem['received_quantity'];
                    $item->save();

                    // Track this line for landed-cost allocation below - the cost basis
                    // (unit_price paid) and quantity actually received in this call.
                    $landedCostLines[] = [
                        'product' => Product::find($item->product_id),
                        'quantity' => (int) $receivedItem['received_quantity'],
                        'unit_value' => (float) $item->unit_price,
                        'unit_cost' => (float) $item->unit_price,
                    ];
                }
                if ($receivedItem['received_quantity'] < $item->quantity) {
                    $remainingItems[] = [
                        'product_id' => $item->product_id,
                        'variant_id' => $item->variant_id,
                        'quantity' => $item->quantity - $receivedItem['received_quantity'],
                        'unit_price' => $item->unit_price,
                        'store_id' => $item->store_id,
                        'sku' => $item->sku,
                    ];
                }
            }

            $newPurchaseOrder = null;
            if (!empty($remainingItems)) {
                // Always use the original PO number as prefix for splits
                $originalOrderNumber = $purchaseOrder->order_number;
                // If this PO is already a split, get the root/original order number
                if (preg_match('/^(PO-[^-]+-[^-]+)(?:-\d+)*$/', $purchaseOrder->order_number, $matches)) {
                    $originalOrderNumber = $matches[1];
                }
                $existingSplits = PurchaseOrder::where('order_number', 'like', $originalOrderNumber . '-%')->count();
                $splitNumber = str_pad($existingSplits + 1, 2, '0', STR_PAD_LEFT);
                $splitOrderNumber = $originalOrderNumber . '-' . $splitNumber;
                $newPurchaseOrder = PurchaseOrder::create([
                    'id' => (string) Str::uuid(),
                    'company_id' => $purchaseOrder->company_id,
                    'supplier_id' => $purchaseOrder->supplier_id,
                    'order_number' => $splitOrderNumber,
                    'order_date' => $purchaseOrder->order_date,
                    'delivery_date' => $purchaseOrder->delivery_date,
                    'store_id' => $purchaseOrder->store_id,
                    'currency_code' => $purchaseOrder->currency_code ?? 'KES',
                    'status' => 'pending',
                    'comments' => "Remaining quantities from {$originalOrderNumber}",
                    'created_by' => $user->id,
                    'parent_id' => $purchaseOrder->id,
                ]);
                // Only add the remaining (unreceived) quantities to the new PO
                foreach ($remainingItems as $itemData) {
                    $subtotal = $itemData['quantity'] * $itemData['unit_price'];
                    PurchaseOrderItem::create([
                        'id' => (string) Str::uuid(),
                        'purchase_order_id' => $newPurchaseOrder->id,
                        'product_id' => $itemData['product_id'],
                        'variant_id' => ($itemData['variant_id'] ?? null),
                        'quantity' => $itemData['quantity'],
                        'unit_price' => $itemData['unit_price'],
                        'subtotal' => $subtotal,
                        'sku' => $itemData['sku'],
                        'store_id' => $itemData['store_id'],
                    ]);
                }
            }

            // Set status
            if (!empty($remainingItems)) {
                $purchaseOrder->status = 'partial';
            } else {
                $purchaseOrder->status = 'received';
            }
            $purchaseOrder->updated_by = $user->id;
            $purchaseOrder->shipping_cost = $shippingCost;
            $purchaseOrder->logistics_cost = $logisticsCost;
            $purchaseOrder->save();

            // Distribute the shipment's shipping/logistics cost across the products
            // actually received in this call, updating each product's landed-cost
            // basis (unit_cost, shipping_cost, logistics_cost).
            $pricingWarnings = $this->landedCostService->apply($landedCostLines, $shippingCost, $logisticsCost);

            DB::commit();
            $response = [
                'status' => 'success',
                'message' => 'Purchase order received successfully.',
                // The frontend (lib/purchaseorders.ts receiptPurchaseOrder) reads
                // `purchase_order`, not `data` - keep both so any other caller
                // relying on `data` doesn't break.
                'data' => $purchaseOrder,
                'purchase_order' => $purchaseOrder,
                'pricing_warnings' => $pricingWarnings,
            ];
            if ($newPurchaseOrder) {
                $response['new_purchase_order'] = $newPurchaseOrder->load([
                    'items.product.store',
                    'items.product.company',
                    'items.product.variants',
                    'items.variant:id,sku,product_id',
                    'items.store:id,name',
                    'supplier:id,name',
                    'store:id,name'
                ]);
            }
            return response()->json($response, 200);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to receive purchase order', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to receive purchase order: ' . $e->getMessage(),
            ], 500);
        }
    }

    // Delete a purchase order
    public function destroy(Request $request, $id)
    {
        $purchaseOrder = PurchaseOrder::find($id);
        if (!$purchaseOrder) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Purchase order not found.',
            ], 404);
        }
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_delete_purchase_orders', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to delete purchase orders.',
            ], 403);
        }
        if (!$this->hasPermission($request, 'can_delete_purchase_orders', $purchaseOrder->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to delete this purchase order.',
            ], 403);
        }
        try {
            DB::beginTransaction();
            $purchaseOrder->items()->delete();
            $purchaseOrder->delete();
            DB::commit();
            return response()->json([
                'status' => 'success',
                'message' => 'Purchase order deleted successfully.'
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to delete purchase order', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to delete purchase order: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Approve or reject a purchase order
     */
    public function approve(Request $request, $id)
    {
        $purchaseOrder = PurchaseOrder::find($id);
        if (!$purchaseOrder) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Purchase order not found.',
            ], 404);
        }

        $user = $request->user();

        // Check permission for approving purchase orders
        if (!$this->hasPermission($request, 'can_approve_purchase_orders', $purchaseOrder->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to approve purchase orders.',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'approval_status' => 'required|string|in:approved,rejected',
            'notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        try {
            $purchaseOrder->update([
                'approval_status' => $request->input('approval_status'),
                'approved_by' => $user->id,
                'comments' => $request->input('notes') ?? $purchaseOrder->comments,
            ]);

            $statusMessage = $request->input('approval_status') === 'approved'
                ? 'Purchase order approved successfully.'
                : 'Purchase order rejected.';

            return response()->json([
                'status' => 'success',
                'message' => $statusMessage,
                'data' => $purchaseOrder->fresh([
                    'items.product.store',
                    'items.product.company',
                    'items.product.variants',
                    'items.variant:id,sku,product_id',
                    'items.store:id,name',
                    'supplier:id,name',
                    'store:id,name',
                    'approvedBy:id,first_name,last_name,email'
                ]),
            ], 200);
        } catch (\Exception $e) {
            Log::error('Failed to approve purchase order', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to approve purchase order: ' . $e->getMessage(),
            ], 500);
        }
    }
}
