<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Customer;
use App\Models\DeliveryLocation;
use App\Models\DeliveryDetail;
use App\Models\Product;
use App\Models\Store;
use App\Models\ProductVariant;
use App\Models\InventoryBatch;
use App\Models\Logistic;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use App\Http\Traits\HandlesDatabaseErrors;
use App\Services\PackagingCalculatorService;
use App\Services\CustomerCreditTermsResolver;
use App\Services\TaxCompliance\EtimsTaxType;

class OrderController extends Controller
{
    use HandlesDatabaseErrors;

    protected $calculator;
    protected CustomerCreditTermsResolver $creditTermsResolver;

    /**
     * Initialize the controller with middleware for authentication.
     */
    public function __construct(PackagingCalculatorService $calculator, CustomerCreditTermsResolver $creditTermsResolver)
    {
        $this->middleware('auth:sanctum');
        $this->calculator = $calculator;
        $this->creditTermsResolver = $creditTermsResolver;
    }

    /**
     * Check if the user has a specific permission.
     *
     * @param Request $request
     * @param string $permission
     * @return bool
     */
    /**
     * Canonical multi-tenant permission check: system admin, company admin, or specific permission.
     */
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
     * Generate a unique order number for the company.
     *
     * @param string $companyId
     * @return string
     */
    protected function generateOrderNumber($companyId)
    {
        $prefix = 'ORD-' . substr($companyId, 0, 8) . '-';

        // Use raw query to avoid model accessors interfering
        $lastOrder = DB::table('orders')
            ->select('order_number')
            ->where('company_id', $companyId)
            ->where('order_number', 'like', $prefix . '%')
            ->orderBy('order_number', 'desc')
            ->lockForUpdate()
            ->first();

        $nextNumber = $lastOrder ? (int) substr($lastOrder->order_number, strlen($prefix)) + 1 : 1;
        return $prefix . str_pad($nextNumber, 4, '0', STR_PAD_LEFT);
    }

    /**
     * Generate a unique tracking number.
     *
     * @param string $companyId
     * @return string
     */
    protected function generateTrackingNumber($companyId)
    {
        $prefix = 'TRK-' . substr($companyId, 0, 8) . '-';
        $lastLogistic = Logistic::where('company_id', $companyId)
            ->where('tracking_number', 'like', $prefix . '%')
            ->orderBy('tracking_number', 'desc')
            ->first();

        $nextNumber = $lastLogistic ? (int) substr($lastLogistic->tracking_number, strlen($prefix)) + 1 : 1;
        return $prefix . str_pad($nextNumber, 4, '0', STR_PAD_LEFT);
    }

    public function index(Request $request)
    {
        $user = $request->user();
        // A rep listing only their own orders (?mine=1) doesn't need
        // can_view_orders - they're not browsing the company's orders, just
        // tracking their own past sales (e.g. the POS "Orders" tab).
        $mine = $request->boolean('mine');
        if (!$mine && !$this->hasPermission($request, 'can_view_orders', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view orders.',
            ], 403);
        }

        try {
            return $this->executeWithRetry(function () use ($request, $mine) {
                $user = $request->user();
                $query = Order::with([
                    'customer' => function ($query) {
                        $query->select('id', 'name', 'email', 'phone', 'customer_type', 'business_name', 'contact_person_name', 'contact_person_phone', 'contact_person_email', 'address', 'city', 'state', 'country', 'postal_code', 'payment_method', 'status');
                    }
                ]);

                if ($mine) {
                    $query->where('company_id', $user->company_id)
                        ->where('sales_rep_id', $user->id);
                } elseif (!$this->hasPermission($request, 'can_manage_all_quotes')) {
                    $query->where('company_id', $user->company_id);
                } else {
                    if ($request->filled('company_id')) {
                        $query->where('company_id', $request->input('company_id'));
                    }
                }

                if ($request->filled('search')) {
                    $term = $request->input('search');
                    $query->where(function ($q) use ($term) {
                        $q->where('order_number', 'ilike', "%{$term}%")
                            ->orWhereHas('customer', function ($cq) use ($term) {
                                $cq->where('name', 'ilike', "%{$term}%")
                                    ->orWhere('business_name', 'ilike', "%{$term}%");
                            });
                    });
                }

                $perPage = (int) $request->input('per_page', 1000);
                $orders = $query->select('id', 'customer_id', 'company_id', 'order_number', 'total_amount', 'discount', 'tax', 'final_amount', 'status', 'payment_status', 'created_at', 'updated_at')
                    ->orderBy('created_at', 'desc')
                    ->paginate($perPage);

                return response()->json([
                    'status' => 'success',
                    'message' => 'Orders retrieved successfully.',
                    'orders' => $orders,
                ], 200);
            });
        } catch (\Exception $e) {
            return $this->handleDatabaseError($e, 'fetching orders');
        }
    }


    public function show(Request $request, $id)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_view_orders', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view orders.',
            ], 403);
        }

        try {
            $user = $request->user();
            $query = Order::where('id', $id)
                ->with([
                    'customer' => function ($query) {
                        $query->select('id', 'name', 'email', 'phone', 'customer_type', 'business_name', 'contact_person_name', 'contact_person_phone', 'contact_person_email', 'address', 'city', 'state', 'country', 'postal_code', 'payment_method', 'status');
                    },
                    'deliveryLocation' => function ($query) {
                        $query->select('*');
                    },
                    'orderItems' => function ($query) {
                        $query->select('id', 'order_id', 'product_id', 'variant_id', 'quantity', 'base_quantity', 'packaging_breakdown', 'unit_price', 'price_label', 'total_price')
                            ->with([
                                'product' => function ($query) {
                                    $query->select('id', 'name', 'price', 'store_id', 'has_packaging', 'base_unit', 'tax_rate', 'is_taxable')
                                        ->with([
                                            'store' => function ($query) {
                                                $query->select('id', 'name');
                                            },
                                            'sellablePackagingUnits' => function ($query) {
                                                $query->select('id', 'product_id', 'unit_name', 'unit_abbreviation', 'base_unit_quantity', 'price_per_unit', 'is_base_unit', 'display_order')
                                                    ->whereRaw('is_active = true')
                                                    ->orderBy('display_order');
                                            }
                                        ]);
                                },
                                'variant' => function ($query) {
                                    $query->select('id', 'product_id', 'name', 'sku', 'price', 'cost', 'attributes');
                                }
                            ]);
                    },
                    'payments' => function ($query) {
                        $query->select('id', 'order_id', 'amount_paid', 'payment_method', 'status', 'created_at');
                    },
                    'deliveryDetails' => function ($query) {
                        $query->select('id', 'order_id', 'delivery_status', 'estimated_delivery_date', 'created_at', 'updated_at');
                    }
                ]);

            if (!$this->hasPermission($request, 'can_manage_all_quotes')) {
                $query->where('company_id', $user->company_id);
            }

            $order = $query->first();

            if (!$order) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Order not found or not authorized.',
                ], 404);
            }

            return response()->json([
                'status' => 'success',
                'order' => $order,
            ], 200);
        } catch (\Exception $e) {
            Log::error('Failed to retrieve order details', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to retrieve order details: ' . $e->getMessage(),
            ], 500);
        }
    }


    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'customer_id' => 'nullable|uuid|exists:customers,id',
            'sales_rep_id' => 'nullable|uuid|exists:users,id',
            'discount' => 'nullable|numeric|min:0|max:999999.99',
            'tax' => 'nullable|numeric|min:0|max:999999.99',
            'status' => 'required|string|in:pending,processing,completed,cancelled',
            'payment_status' => 'nullable|string',
            'payment_option' => 'sometimes|in:instant,credit',
            'payment_terms' => 'nullable|string',
            'due_date' => 'nullable|date',
            'delivery_location_id' => 'nullable|uuid|exists:delivery_locations,id',
            'tracking_number' => 'nullable|string|max:100',
            'amount_paid' => 'nullable|numeric|min:0|max:999999.99',
            'currency' => 'nullable|string|in:KES,USD',
            'notes' => 'nullable|string',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|uuid|exists:products,id',
            'items.*.variant_id' => 'nullable|uuid|exists:product_variants,id',
            'items.*.quantity' => 'required|numeric|min:0.0001',
            'items.*.unit_price' => 'required|numeric|min:0|max:999999.99',
            'items.*.price_label' => 'nullable|string|max:100',
            'items.*.price_unit' => 'nullable|string|max:50',
            'order_date' => 'nullable|date',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        $user = $request->user();
        if (!$this->hasPermission($request, 'can_create_orders', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to create orders.',
            ], 403);
        }

        try {
            Log::info('Order creation attempt', [
                'user_id' => $request->user()->id,
                'company_id' => $request->user()->company_id,
                'request' => $request->all(),
            ]);
            $user = $request->user();
            if (!$user->company_id) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'User is not assigned to a company.',
                ], 400);
            }

            $customer = null;
            if ($request->filled('customer_id')) {
                $customer = Customer::find($request->input('customer_id'));
                if (!$customer) {
                    return response()->json([
                        'status' => 'failed',
                        'message' => 'Customer not found.',
                    ], 404);
                }
                if (!$this->hasPermission($request, 'can_create_orders', $customer->company_id)) {
                    return response()->json([
                        'status' => 'failed',
                        'message' => 'Unauthorized to create orders for this customer’s company.',
                    ], 403);
                }
            }

            // Work out payment_type/credit_terms_days from the customer's registered
            // payment method (mirrors InvoiceController's cash/credit resolution), unless
            // this is an explicit instant/cash sale or there's no customer on the order yet.
            $paymentOption = $request->input('payment_option');
            if ($paymentOption === 'instant' || !$customer) {
                $orderCredit = [
                    'payment_type' => 'cash',
                    'credit_terms_days' => null,
                ];
            } else {
                $orderCredit = $this->creditTermsResolver->resolve(
                    $customer,
                    $request->input('order_date', now()->toDateString()),
                    $request->input('due_date'),
                    $request->input('payment_terms'),
                );
            }

            // Validate delivery location if provided
            if ($request->has('delivery_location_id')) {
                $deliveryLocation = DeliveryLocation::find($request->input('delivery_location_id'));
                if ($deliveryLocation->company_id !== $user->company_id && !$this->hasPermission($request, 'can_manage_all_quotes')) {
                    return response()->json([
                        'status' => 'failed',
                        'message' => 'Delivery location does not belong to user’s company.',
                    ], 403);
                }
            }

            // Validate products/variants and calculate total amount
            $totalAmount = 0;
            $totalTaxAmount = 0;
            $belowMinimumPrice = false;
            $items = $request->input('items');
            foreach ($items as $index => $item) {
                $product = Product::with('store')->find($item['product_id']);
                if ($product->company_id !== $user->company_id && !$this->hasPermission($request, 'can_manage_all_quotes')) {
                    return response()->json([
                        'status' => 'failed',
                        'message' => "Item at index {$index}: Product does not belong to user’s company.",
                    ], 403);
                }

                // Validate store if store_id is set
                if ($product->store_id) {
                    $store = $product->store;
                    if (!$store || $store->company_id !== $user->company_id && !$this->hasPermission($request, 'can_manage_all_quotes')) {
                        return response()->json([
                            'status' => 'failed',
                            'message' => "Item at index {$index}: Store does not belong to user’s company.",
                        ], 403);
                    }
                    if (!$store->is_active) {
                        return response()->json([
                            'status' => 'failed',
                            'message' => "Item at index {$index}: Store is not active.",
                        ], 400);
                    }
                }

                $cost = $product->unit_cost;
                $stockQuantity = $product->stock_quantity;
                $priceToCheck = $product->price;

                // Handle variant if provided
                if (!empty($item['variant_id'])) {
                    $variant = ProductVariant::where('id', $item['variant_id'])
                        ->where('product_id', $item['product_id'])
                        ->where('company_id', $user->company_id)
                        ->first();

                    if (!$variant) {
                        return response()->json([
                            'status' => 'failed',
                            'message' => "Item at index {$index}: Variant not found or does not belong to the product/company.",
                        ], 404);
                    }

                    if (!$variant->is_active) {
                        return response()->json([
                            'status' => 'failed',
                            'message' => "Item at index {$index}: Variant is not active.",
                        ], 400);
                    }

                    $cost = $variant->cost;
                    $stockQuantity = $variant->stock_quantity;
                    $priceToCheck = $variant->price; // Use variant price for validation

                    // Validate variant store if set
                    if ($variant->store_id) {
                        $variantStore = Store::find($variant->store_id);
                        if (!$variantStore || $variantStore->company_id !== $user->company_id && !$this->hasPermission($request, 'can_manage_all_quotes')) {
                            return response()->json([
                                'status' => 'failed',
                                'message' => "Item at index {$index}: Variant store does not belong to user’s company.",
                            ], 403);
                        }
                        if (!$variantStore->is_active) {
                            return response()->json([
                                'status' => 'failed',
                                'message' => "Item at index {$index}: Variant store is not active.",
                            ], 400);
                        }
                    }
                }

                // Calculate base quantity and packaging breakdown
                // Quantity is always in base units (pieces)
                $baseQuantity = (int) $item['quantity'];
                $packagingBreakdown = null;

                if ($product->has_packaging) {
                    $packagingBreakdown = $this->calculator->calculatePackagingBreakdown($product, $baseQuantity);
                }

                // Use unit price from request
                $unitPrice = $item['unit_price'];

                // Check if price is below minimum (for approval workflow)
                if ($unitPrice < $priceToCheck) {
                    $belowMinimumPrice = true;
                }

                // Validate stock if track_inventory is true
                if ($product->track_inventory && $baseQuantity > $stockQuantity) {
                    return response()->json([
                        'status' => 'failed',
                        'message' => "Item at index {$index}: Insufficient stock for product/variant {$product->name} (available: {$stockQuantity}).",
                    ], 400);
                }

                $totalAmount += $baseQuantity * $unitPrice;
                $totalTaxAmount += $baseQuantity * $unitPrice * EtimsTaxType::rateForProduct($product) / 100;
            }

            return DB::transaction(function () use ($request, $user, $customer, $totalAmount, $items, $belowMinimumPrice, $totalTaxAmount, $orderCredit) {
                $discount = $request->input('discount', 0);
                // VAT is added on top of prices and always calculated from the
                // items (never taken from the request); a discount reduces the
                // taxable base proportionally.
                $tax = round($totalAmount > 0 ? $totalTaxAmount * max(0, $totalAmount - $discount) / $totalAmount : 0, 2);
                $finalAmount = $totalAmount - $discount + $tax;

                if ($finalAmount < 0) {
                    return response()->json([
                        'status' => 'failed',
                        'message' => 'Final amount cannot be negative.',
                    ], 400);
                }

                // Generate order number
                $orderNumber = $this->generateOrderNumber($user->company_id);

                // Ensure booleans are cast properly for Postgres
                $belowMinimumPriceBool = filter_var($belowMinimumPrice, FILTER_VALIDATE_BOOLEAN);
                $requiresApprovalBool = filter_var($belowMinimumPrice, FILTER_VALIDATE_BOOLEAN);

                // Create order
                $order = Order::create([
                    'id' => (string) Str::uuid(),
                    'order_number' => $orderNumber,
                    'customer_id' => $request->input('customer_id'),
                    'sales_rep_id' => $request->input('sales_rep_id'),
                    'payment_type' => $orderCredit['payment_type'],
                    'credit_terms_days' => $orderCredit['credit_terms_days'],
                    'company_id' => $user->company_id,
                    'total_amount' => $totalAmount,
                    'discount' => $discount,
                    'tax' => $tax,
                    'final_amount' => $finalAmount,
                    'status' => $request->input('status'),
                    'payment_status' => $request->input('payment_status', 'unpaid'),
                    'delivery_location_id' => $request->input('delivery_location_id'),
                    'tracking_number' => $request->input('tracking_number'),
                    'amount_paid' => $request->input('amount_paid', 0),
                    'currency' => $request->input('currency', 'KES'),
                    'notes' => $request->input('notes'),
                    'below_minimum_price' => $belowMinimumPriceBool,
                    'requires_approval' => $requiresApprovalBool,
                    'order_date' => $request->input('order_date', now()),
                ]);

                // Create order items and update stock
                foreach ($items as $item) {
                    $product = Product::find($item['product_id']);
                    $variant = !empty($item['variant_id']) ? ProductVariant::find($item['variant_id']) : null;

                    // Calculate base quantity and packaging breakdown
                    $baseQuantity = (int) $item['quantity'];
                    $packagingBreakdown = null;

                    if ($product->has_packaging) {
                        $packagingBreakdown = $this->calculator->calculatePackagingBreakdown($product, $baseQuantity);
                    }

                    // Use unit price from request
                    $unitPrice = $item['unit_price'];

                    // Stock (and FEFO batches) are only taken once the order is receipted - see OrderStockService.
                    $batchAllocations = null;

                    OrderItem::create([
                        'id' => (string) Str::uuid(),
                        'order_id' => $order->id,
                        'product_id' => $item['product_id'],
                        'variant_id' => !empty($item['variant_id']) ? $item['variant_id'] : null,
                        'unit_id' => null,
                        'quantity' => $baseQuantity,
                        'unit_quantity' => null,
                        'base_quantity' => $baseQuantity,
                        'packaging_breakdown' => $packagingBreakdown,
                        'batch_allocations' => $batchAllocations,
                        'unit_price' => $unitPrice,
                        'price_label' => $item['price_label'] ?? null,
                        'price_unit' => $item['price_unit'] ?? null,
                        'total_price' => $baseQuantity * $unitPrice,
                        'tax_rate' => EtimsTaxType::rateForProduct($product),
                        'tax_amount' => round($unitPrice * $baseQuantity * EtimsTaxType::rateForProduct($product) / 100, 2),
                        'company_id' => $user->company_id,
                    ]);
                }

                // Orders created already paid come with their receipt.
                $orderStock = app(\App\Services\OrderStockService::class);
                if ($orderStock->hasReceipt($order)) {
                    $orderStock->deduct($order);
                }

                $message = 'Order created successfully.';
                if ($belowMinimumPrice) {
                    $message .= ' Note: This order contains items priced below minimum and requires approval.';
                }

                Log::info('Order created', [
                    'user_id' => $user->id,
                    'order_id' => $order->id,
                    'company_id' => $user->company_id,
                    'order_number' => $order->order_number,
                ]);

                return response()->json([
                    'status' => 'success',
                    'message' => $message,
                    'order' => $order->load([
                        'customer',
                        'deliveryLocation',
                        'orderItems.product.store',
                        'orderItems.product.sellablePackagingUnits',
                        'orderItems.variant',
                        'orderItems.packagingUnit'
                    ]),
                    'requires_approval' => $belowMinimumPrice,
                ], 201);
            });
        } catch (\Exception $e) {
            Log::error('Failed to create order', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to create order: ' . $e->getMessage(),
            ], 500);
        }
    }


    public function update(Request $request, $id)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_update_orders', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to edit orders.',
            ], 403);
        }

        $order = Order::where('id', $id)->first();
        if (!$order) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Order not found.',
            ], 404);
        }

        if (!$this->hasPermission($request, 'can_update_orders', $order->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to edit orders for this company.',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'customer_id' => 'sometimes|uuid|exists:customers,id',
            'discount' => 'sometimes|numeric|min:0|max:999999.99',
            'tax' => 'sometimes|numeric|min:0|max:999999.99',
            'status' => 'sometimes|string|in:pending,processing,completed,cancelled',
            'payment_status' => 'sometimes|string|in:unpaid,partial,paid',
            'payment_type' => 'sometimes|in:cash,credit',
            'credit_terms_days' => 'nullable|integer|min:0',
            'delivery_location_id' => 'nullable|uuid|exists:delivery_locations,id',
            'tracking_number' => 'nullable|string|max:100',
            'amount_paid' => 'sometimes|numeric|min:0|max:999999.99',
            'currency' => 'sometimes|string|in:KES,USD',
            'notes' => 'nullable|string',
            'items' => 'sometimes|array|min:1',
            'items.*.product_id' => 'required_with:items|uuid|exists:products,id',
            'items.*.variant_id' => 'nullable|uuid|exists:product_variants,id',
            'items.*.quantity' => 'required_with:items|integer|min:1',
            'items.*.unit_price' => 'required_with:items|numeric|min:0|max:999999.99',
            'items.*.price_label' => 'nullable|string|max:100',
            'items.*.price_unit' => 'nullable|string|max:50',
            'order_date' => 'nullable|date',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        try {
            Log::info('Order update attempt', [
                'user_id' => $request->user()->id,
                'order_id' => $id,
                'request' => $request->all(),
            ]);
            return DB::transaction(function () use ($request, $order) {
                if ($request->has('customer_id')) {
                    $customer = Customer::find($request->input('customer_id'));
                    if (!$this->hasPermission($request, 'can_update_orders', $customer->company_id)) {
                        return response()->json([
                            'status' => 'failed',
                            'message' => 'Unauthorized to assign this customer.',
                        ], 403);
                    }
                }

                if ($request->has('delivery_location_id')) {
                    $deliveryLocation = DeliveryLocation::find($request->input('delivery_location_id'));
                    if ($deliveryLocation && $deliveryLocation->company_id !== $order->company_id && !$this->hasPermission($request, 'can_manage_all_quotes')) {
                        return response()->json([
                            'status' => 'failed',
                            'message' => 'Delivery location does not belong to user’s company.',
                        ], 403);
                    }
                }

                // Handle updating items if provided
                if ($request->has('items')) {
                    $orderStock = app(\App\Services\OrderStockService::class);
                    $wasDeducted = (bool) $order->stock_deducted_at;
                    $orderStock->restore($order, "Order {$order->order_number} edited");
                    // Delete old items
                    $order->orderItems()->delete();

                    $items = $request->input('items');
                    $totalAmount = 0;
                    $belowMinimumPrice = false;
                    foreach ($items as $index => $item) {
                        $product = Product::with('store')->find($item['product_id']);
                        if ($product->company_id !== $order->company_id && !$this->hasPermission($request, 'can_manage_all_quotes')) {
                            return response()->json([
                                'status' => 'failed',
                                'message' => "Item at index {$index}: Product does not belong to order’s company.",
                            ], 403);
                        }
                        $cost = $product->unit_cost;
                        $stockQuantity = $product->stock_quantity;
                        $priceToCheck = $product->price;
                        $variant = null;
                        if (!empty($item['variant_id'])) {
                            $variant = ProductVariant::where('id', $item['variant_id'])
                                ->where('product_id', $item['product_id'])
                                ->where('company_id', $order->company_id)
                                ->first();
                            if (!$variant) {
                                return response()->json([
                                    'status' => 'failed',
                                    'message' => "Item at index {$index}: Variant not found or does not belong to the product/company.",
                                ], 404);
                            }
                            $cost = $variant->cost;
                            $stockQuantity = $variant->stock_quantity;
                            $priceToCheck = $variant->price;
                        }
                        if ($item['unit_price'] < $priceToCheck) {
                            $belowMinimumPrice = true;
                        }
                        if ($product->track_inventory && $item['quantity'] > $stockQuantity) {
                            return response()->json([
                                'status' => 'failed',
                                'message' => "Item at index {$index}: Insufficient stock for product/variant {$product->name} (available: {$stockQuantity}).",
                            ], 400);
                        }
                        $totalAmount += $item['quantity'] * $item['unit_price'];
                    }
                    // Update order totals
                    $discount = $request->input('discount', $order->discount ?? 0);

                    $newTotalTax = 0;
                    foreach ($items as $item) {
                        $product = Product::find($item['product_id']);
                        $newTotalTax += $item['unit_price'] * $item['quantity'] * EtimsTaxType::rateForProduct($product) / 100;
                    }

                    $tax = round($totalAmount > 0 ? $newTotalTax * max(0, $totalAmount - $discount) / $totalAmount : 0, 2);

                    $finalAmount = $totalAmount - $discount + $tax;
                    if ($finalAmount < 0) {
                        return response()->json([
                            'status' => 'failed',
                            'message' => 'Final amount cannot be negative.',
                        ], 400);
                    }
                    $order->total_amount = $totalAmount;
                    $order->final_amount = $finalAmount;
                    $order->discount = $discount;
                    $order->tax = $tax;
                    $order->save();
                    // Create new items and update stock
                    foreach ($items as $item) {
                        $product = Product::find($item['product_id']);
                        $variant = !empty($item['variant_id']) ? ProductVariant::find($item['variant_id']) : null;

                        $batchAllocations = null;

                        OrderItem::create([
                            'id' => (string) Str::uuid(),
                            'order_id' => $order->id,
                            'product_id' => $item['product_id'],
                            'variant_id' => !empty($item['variant_id']) ? $item['variant_id'] : null,
                            'quantity' => $item['quantity'],
                            'batch_allocations' => $batchAllocations,
                            'unit_price' => $item['unit_price'],
                            'price_label' => $item['price_label'] ?? null,
                            'price_unit' => $item['price_unit'] ?? null,
                            'total_price' => $item['quantity'] * $item['unit_price'],
                            'tax_rate' => EtimsTaxType::rateForProduct($product),
                            'tax_amount' => round($item['unit_price'] * $item['quantity'] * EtimsTaxType::rateForProduct($product) / 100, 2),
                        ]);
                    }

                    if ($wasDeducted) {
                        $orderStock->deduct($order->fresh());
                    }
                }

                if (($request->has('discount') || $request->has('tax')) && !$request->has('items')) {
                    // Tax is never taken from the request - it's recomputed
                    // from the order's items against the new discount.
                    $discount = $request->input('discount', $order->discount ?? 0);
                    $subtotal = (float) $order->total_amount;
                    $itemsTax = (float) $order->orderItems()->sum('tax_amount');
                    $tax = round($subtotal > 0 ? $itemsTax * max(0, $subtotal - $discount) / $subtotal : 0, 2);
                    $finalAmount = $subtotal - $discount + $tax;
                    if ($finalAmount < 0) {
                        return response()->json([
                            'status' => 'failed',
                            'message' => 'Final amount cannot be negative.',
                        ], 400);
                    }
                    $order->final_amount = $finalAmount;
                    $order->discount = $discount;
                    $order->tax = $tax;
                }

                $order->update($request->only([
                    'customer_id',
                    'status',
                    'payment_status',
                    'payment_type',
                    'credit_terms_days',
                    'delivery_location_id',
                    'tracking_number',
                    'amount_paid',
                    'currency',
                    'notes',
                    'order_date',
                ]));

                Log::info('Order updated', [
                    'user_id' => $request->user()->id,
                    'order_id' => $order->id,
                    'company_id' => $order->company_id,
                ]);
                return response()->json([
                    'status' => 'success',
                    'message' => 'Order updated successfully.',
                    'order' => $order->load(['customer', 'deliveryLocation', 'orderItems.product.store', 'orderItems.variant']),
                ], 200);
            });
        } catch (\Exception $e) {
            Log::error('Failed to update order', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to update order: ' . $e->getMessage(),
            ], 500);
        }
    }


    public function destroy(Request $request, $id)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_delete_orders', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to delete orders.',
            ], 403);
        }

        $order = Order::where('id', $id)->first();
        if (!$order) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Order not found.',
            ], 404);
        }

        if (!$this->hasPermission($request, 'can_delete_orders', $order->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to delete orders for this company.',
            ], 403);
        }

        if ($order->payments()->exists()) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Cannot delete order with associated payments.',
            ], 400);
        }

        try {
            Log::info('Order delete attempt', [
                'user_id' => $request->user()->id,
                'order_id' => $id,
            ]);
            return DB::transaction(function () use ($order, $request) {
                app(\App\Services\OrderStockService::class)->restore($order, "Order {$order->order_number} deleted");

                // Delete related records
                $order->orderItems()->delete();
                $order->deliveryDetails()->delete();
                $order->delete();

                Log::info('Order deleted', [
                    'user_id' => $request->user()->id,
                    'order_id' => $order->id,
                    'company_id' => $order->company_id,
                ]);
                return response()->json([
                    'status' => 'success',
                    'message' => 'Order deleted successfully.',
                ], 200);
            });
        } catch (\Exception $e) {
            Log::error('Failed to delete order', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to delete order: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function dispatch(Request $request, $id)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_dispatch_orders', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to dispatch orders.',
            ], 403);
        }

        $order = Order::with(['customer', 'deliveryLocation'])->where('id', $id)->first();
        if (!$order) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Order not found.',
            ], 404);
        }

        if (!$this->hasPermission($request, 'can_dispatch_orders', $order->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to dispatch orders for this company.',
            ], 403);
        }

        // Check if order already has a logistic record
        if (Logistic::where('order_id', $order->id)->exists()) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Order has already been dispatched.',
            ], 400);
        }

        // Check if delivery location is set
        if (!$order->delivery_location_id) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Order does not have a delivery location set.',
            ], 400);
        }

        $validator = Validator::make($request->all(), [
            'delivery_person_id' => 'nullable|uuid|exists:delivery_people,id',
            'logistics_provider' => 'nullable|string|max:255',
            'delivery_method' => 'nullable|string|max:255',
            'vehicle_type' => 'nullable|string|max:255',
            'vehicle_id' => 'nullable|string|max:255',
            'estimated_delivery_time' => 'nullable|date',
            'notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        try {
            return DB::transaction(function () use ($request, $order) {
                $user = $request->user();

                // Generate tracking number if not already set
                $trackingNumber = $order->tracking_number ?? $this->generateTrackingNumber($order->company_id);

                // Update order with tracking number if needed
                if (!$order->tracking_number) {
                    $order->tracking_number = $trackingNumber;
                    $order->save();
                }

                // Prepare delivery details from customer and delivery location
                $deliveryLocation = $order->deliveryLocation;
                $customer = $order->customer;

                // Create logistics record data
                $logisticData = [
                    'order_id' => $order->id,
                    'company_id' => $order->company_id,
                    'dispatcher_id' => $user->id,
                    'delivery_person_id' => $request->input('delivery_person_id'),
                    'logistics_provider' => $request->input('logistics_provider'),
                    'delivery_method' => $request->input('delivery_method', 'standard'),
                    'vehicle_type' => $request->input('vehicle_type'),
                    'vehicle_id' => $request->input('vehicle_id'),
                    'tracking_number' => $trackingNumber,
                    'delivery_status' => 'dispatched',
                    'recipient_name' => $customer->name,
                    'recipient_phone' => $customer->phone,
                    'delivery_address' => $this->formatDeliveryAddress($deliveryLocation),
                    'city' => $deliveryLocation->city,
                    'state' => $deliveryLocation->estate,
                    'country' => $deliveryLocation->country,
                    'dispatch_time' => now(),
                    'estimated_delivery_time' => $request->input('estimated_delivery_time'),
                    'notes' => $request->input('notes'),
                    'update_order_status' => true,
                ];

                // Use LogisticController to create the logistics record
                $logisticController = new LogisticController();
                $logistic = $logisticController->storeForOrderDispatch($order, $logisticData);

                // Create delivery detail record
                $deliveryDetail = DeliveryDetail::create([
                    'id' => (string) Str::uuid(),
                    'customer_id' => $customer->id,
                    'order_id' => $order->id,
                    'delivery_location_id' => $deliveryLocation->id,
                    'delivery_method' => $request->input('delivery_method', 'standard'),
                    'tracking_number' => $trackingNumber,
                    'estimated_delivery_date' => $request->input('estimated_delivery_time'),
                    'delivery_status' => 'dispatched',
                    'company_id' => $order->company_id,
                ]);

                return response()->json([
                    'status' => 'success',
                    'message' => 'Order dispatched successfully.',
                    'order' => $order->fresh(['customer', 'deliveryLocation', 'deliveryDetails']),
                    'logistic' => $logistic,
                    'delivery_detail' => $deliveryDetail,
                ], 200);
            });
        } catch (\Exception $e) {
            Log::error('Failed to dispatch order', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to dispatch order: ' . $e->getMessage(),
            ], 500);
        }
    }

    protected function formatDeliveryAddress(DeliveryLocation $location)
    {
        $addressParts = [];

        if (!empty($location->house_number)) {
            $addressParts[] = $location->house_number;
        }

        if (!empty($location->street)) {
            $addressParts[] = $location->street;
        }

        if (!empty($location->estate)) {
            $addressParts[] = $location->estate;
        }

        if (!empty($location->city)) {
            $addressParts[] = $location->city;
        }

        if (!empty($location->country)) {
            $addressParts[] = $location->country;
        }

        if (!empty($location->landmark)) {
            $addressParts[] = "Near " . $location->landmark;
        }

        $address = implode(', ', $addressParts);

        if (!empty($location->location_note)) {
            $address .= ". Note: " . $location->location_note;
        }

        return $address;
    }
}