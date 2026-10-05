<?php

namespace App\Http\Controllers;

use App\Models\Quote;
use App\Models\QuoteItem;
use App\Models\QuoteNote;
use App\Models\Customer;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Store;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\DeliveryLocation;
use App\Models\DeliveryDetail;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use App\Http\Traits\HandlesDatabaseErrors;
use App\Http\Traits\ChecksStockAvailability;
use App\Services\PackagingCalculatorService;

class QuoteController extends Controller
{
    use HandlesDatabaseErrors;
    use ChecksStockAvailability;

    protected $calculator;

    /**
     * Initialize the controller with middleware for authentication.
     */
    public function __construct(PackagingCalculatorService $calculator)
    {
        $this->middleware('auth:sanctum');
        $this->calculator = $calculator;
    }

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
     * Generate a unique quote number for the company.
     *
     * @param string $companyId
     * @return string
     */
    protected function generateQuoteNumber($companyId)
    {
        $prefix = 'QUO-' . substr($companyId, 0, 8) . '-';
        
        // Use raw query to avoid model accessors interfering
        $lastQuote = DB::table('quotes')
            ->select('quote_number')
            ->where('company_id', $companyId)
            ->where('quote_number', 'like', $prefix . '%')
            ->orderBy('quote_number', 'desc')
            ->lockForUpdate()
            ->first();

        $nextNumber = $lastQuote ? (int)substr($lastQuote->quote_number, strlen($prefix)) + 1 : 1;
        return $prefix . str_pad($nextNumber, 4, '0', STR_PAD_LEFT);
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

        $nextNumber = $lastOrder ? (int)substr($lastOrder->order_number, strlen($prefix)) + 1 : 1;
        return $prefix . str_pad($nextNumber, 4, '0', STR_PAD_LEFT);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'customer_id' => 'nullable|uuid|exists:customers,id',
            'sales_rep_id' => 'nullable|uuid|exists:users,id',
            'discount' => 'nullable|numeric|min:0|max:999999.99',
            'status' => 'required|string|in:pending,approved,rejected,expired',
            'delivery_location_id' => 'nullable|uuid|exists:delivery_locations,id',
            'currency' => 'nullable|string|in:KES,USD',
            'notes' => 'nullable|string',
            'valid_until' => 'required|date|after:today',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|uuid|exists:products,id',
            'items.*.variant_id' => 'nullable|uuid|exists:product_variants,id',
            'items.*.unit_id' => 'nullable|uuid|exists:product_packaging_units,id',
            'items.*.quantity' => 'required|numeric|min:0.0001',
            'items.*.unit_price' => 'required|numeric|min:0|max:999999.99',
            'items.*.price_label' => 'nullable|string|max:100',
            'items.*.price_unit' => 'nullable|string|max:50',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        $user = $request->user();
        if (!$this->hasPermission($request, 'can_create_quotes', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to create quotes.',
            ], 403);
        }

        try {
            Log::info('Quote creation attempt', [
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
                if (!$this->hasPermission($request, 'can_create_quotes', $customer->company_id)) {
                    return response()->json([
                        'status' => 'failed',
                        'message' => 'Unauthorized to create quotes for this customer\'s company.',
                    ], 403);
                }
            }

            // Validate delivery location if provided
            if ($request->has('delivery_location_id')) {
                $deliveryLocation = DeliveryLocation::find($request->input('delivery_location_id'));
                if ($deliveryLocation->company_id !== $user->company_id && !$this->hasPermission($request, 'can_manage_all_quotes')) {
                    return response()->json([
                        'status' => 'failed',
                        'message' => 'Delivery location does not belong to user\'s company.',
                    ], 403);
                }
            }

            // Validate products/variants and calculate total amount
            $totalAmount = 0;
            $belowMinimumPrice = false;
            $items = $request->input('items');
            foreach ($items as $index => $item) {
                $product = Product::with('store')->find($item['product_id']);
                if ($product->company_id !== $user->company_id && !$this->hasPermission($request, 'can_manage_all_quotes')) {
                    return response()->json([
                        'status' => 'failed',
                        'message' => "Item at index {$index}: Product does not belong to user\'s company.",
                    ], 403);
                }

                // Validate store if store_id is set
                if ($product->store_id) {
                    $store = $product->store;
                    if (!$store || $store->company_id !== $user->company_id && !$this->hasPermission($request, 'can_manage_all_quotes')) {
                        return response()->json([
                            'status' => 'failed',
                            'message' => "Item at index {$index}: Store does not belong to user\'s company.",
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
                                'message' => "Item at index {$index}: Variant store does not belong to user\'s company.",
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

                // Validate unit price (must not be below variant price if present, else product price)
                if ($item['unit_price'] < $priceToCheck) {
                    $belowMinimumPrice = true;
                    // Log the price discrepancy for audit purposes
                    Log::warning("Quote item below minimum price", [
                        'item_index' => $index,
                        'unit_price' => $item['unit_price'],
                        'minimum_price' => $priceToCheck,
                        'product_id' => $item['product_id'],
                        'variant_id' => $item['variant_id'] ?? null,
                        'user_id' => $user->id,
                        'company_id' => $user->company_id
                    ]);
                }

                // Validate stock if track_inventory is true. Quantity is in packs; stock is in pieces.
                $piecesNeeded = PackagingCalculatorService::piecesFor($item['quantity'], $item['price_unit'] ?? null);
                if ($product->track_inventory && $piecesNeeded > $stockQuantity) {
                    return response()->json([
                        'status' => 'failed',
                        'message' => PackagingCalculatorService::packStockMessage($index, $product->name, $item['quantity'], $item['price_unit'] ?? null, $piecesNeeded, (int) $stockQuantity),
                    ], 400);
                }

                // Handle packaging units
                $unitId = $item['unit_id'] ?? null;
                $unitQuantity = null;
                $baseQuantity = null;
                $packagingBreakdown = null;

                if ($unitId) {
                    // Validate unit belongs to product
                    $unit = \App\Models\ProductPackagingUnit::where('id', $unitId)
                        ->where('product_id', $product->id)
                        ->where('is_sellable', true)
                        ->where('is_active', true)
                        ->first();
                    
                    if (!$unit) {
                        return response()->json([
                            'status' => 'failed',
                            'message' => "Item at index {$index}: Invalid or inactive packaging unit for this product.",
                        ], 400);
                    }

                    $unitQuantity = $item['quantity'];
                    $baseQuantity = (int) $this->calculator->convertToBaseUnits($product, $unitQuantity, $unitId);
                    $packagingBreakdown = $this->calculator->calculatePackagingBreakdown($product, $baseQuantity);
                } else {
                    $baseQuantity = PackagingCalculatorService::piecesFor($item['quantity'], $item['price_unit'] ?? null);
                    if ($product->has_packaging) {
                        $packagingBreakdown = $this->calculator->calculatePackagingBreakdown($product, $baseQuantity);
                    }
                }

                $totalAmount += $item['quantity'] * $item['unit_price'];
            }

            return DB::transaction(function () use ($request, $user, $customer, $totalAmount, $items, $belowMinimumPrice) {
                $discount = $request->input('discount', 0);
                $finalAmount = $totalAmount - $discount;

                if ($finalAmount < 0) {
                    return response()->json([
                        'status' => 'failed',
                        'message' => 'Final amount cannot be negative.',
                    ], 400);
                }

                // Generate quote number
                $quoteNumber = $this->generateQuoteNumber($user->company_id);

                // Ensure booleans are cast properly for Postgres
                $belowMinimumPriceBool = filter_var($belowMinimumPrice, FILTER_VALIDATE_BOOLEAN);
                $requiresApprovalBool = filter_var($belowMinimumPrice, FILTER_VALIDATE_BOOLEAN);

                // A Sales Rep submitting a quote from POS gets flagged as such -
                // shown as "From: {rep} - {time}" until a can_create_quotes user
                // opens and edits it (see update(), which clears this).
                $isRepSubmission = (bool) ($user->role->is_sales_rep ?? false);

                // Create quote
                $quote = Quote::create([
                    'id' => (string) Str::uuid(),
                    'quote_number' => $quoteNumber,
                    'customer_id' => $request->input('customer_id'),
                    'company_id' => $user->company_id,
                    'sales_rep_id' => $request->input('sales_rep_id'),
                    'submitted_by_id' => $isRepSubmission ? $user->id : null,
                    'submitted_at' => $isRepSubmission ? now() : null,
                    'original_submitted_by_id' => $isRepSubmission ? $user->id : null,
                    'total_amount' => $totalAmount,
                    'discount' => $discount,
                    'final_amount' => $finalAmount,
                    'status' => $request->input('status'),
                    'delivery_location_id' => $request->input('delivery_location_id'),
                    'currency' => $request->input('currency', 'KES'),
                    'notes' => $request->input('notes'),
                    'below_minimum_price' => $belowMinimumPriceBool,
                    'requires_approval' => $requiresApprovalBool,
                    'valid_until' => $request->input('valid_until'),
                ]);

                // Create quote items
                foreach ($items as $item) {
                    // Recalculate packaging for each item
                    $unitId = $item['unit_id'] ?? null;
                    $unitQuantity = null;
                    $baseQuantity = null;
                    $packagingBreakdown = null;

                    $product = Product::find($item['product_id']);

                    if ($unitId) {
                        $unitQuantity = $item['quantity'];
                        $baseQuantity = (int) $this->calculator->convertToBaseUnits($product, $unitQuantity, $unitId);
                        $packagingBreakdown = $this->calculator->calculatePackagingBreakdown($product, $baseQuantity);
                    } else {
                        $baseQuantity = PackagingCalculatorService::piecesFor($item['quantity'], $item['price_unit'] ?? null);
                        if ($product->has_packaging) {
                            $packagingBreakdown = $this->calculator->calculatePackagingBreakdown($product, $baseQuantity);
                        }
                    }

                    QuoteItem::create([
                        'id' => (string) Str::uuid(),
                        'quote_id' => $quote->id,
                        'product_id' => $item['product_id'],
                        'variant_id' => !empty($item['variant_id']) ? $item['variant_id'] : null,
                        'unit_id' => $unitId,
                        'quantity' => $item['quantity'],
                        'unit_quantity' => $unitQuantity,
                        'base_quantity' => $baseQuantity,
                        'packaging_breakdown' => $packagingBreakdown,
                        'unit_price' => $item['unit_price'],
                        'price_label' => $item['price_label'] ?? null,
                        'price_unit' => $item['price_unit'] ?? null,
                        'total_price' => $item['quantity'] * $item['unit_price'],
                        'company_id' => $user->company_id,
                    ]);
                }

                $quote->syncTotals();

                $message = 'Quote created successfully.';
                if ($belowMinimumPrice) {
                    $message .= ' Note: This quote contains items priced below minimum and requires approval.';
                }

                Log::info('Quote created', [
                    'user_id' => $user->id,
                    'quote_id' => $quote->id,
                    'company_id' => $user->company_id,
                    'quote_number' => $quote->quote_number,
                ]);

                return response()->json([
                    'status' => 'success',
                    'message' => $message,
                    'quote' => $quote->load([
                        'customer', 
                        'deliveryLocation', 
                        'quoteItems.product.store',
                        'quoteItems.product.sellablePackagingUnits',
                        'quoteItems.variant',
                        'quoteItems.packagingUnit'
                    ]),
                    'requires_approval' => $belowMinimumPrice,
                ], 201);
            });
        } catch (\Exception $e) {
            Log::error('Failed to create quote', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to create quote: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function update(Request $request, $quoteId)
    {
        $validator = Validator::make($request->all(), [
            'status' => 'sometimes|required|string|in:pending,accepted,rejected',
            'valid_until' => 'sometimes|required|date|after:today',
            'notes' => 'nullable|string',
            'discount' => 'sometimes|numeric|min:0|max:999999.99',
            // An empty list deletes the quote (handled below).
            'items' => 'sometimes|present|array',
            'items.*.id' => 'nullable|uuid|exists:quote_items,id',
            'items.*.product_id' => 'required|uuid|exists:products,id',
            'items.*.variant_id' => 'nullable|uuid|exists:product_variants,id',
            'items.*.unit_id' => 'nullable|uuid|exists:product_packaging_units,id',
            'items.*.quantity' => 'required|numeric|min:0.0001',
            'items.*.unit_price' => 'required|numeric|min:0|max:999999.99',
            'items.*.price_label' => 'nullable|string|max:100',
            'items.*.price_unit' => 'nullable|string|max:50',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        $user = $request->user();
        if (!$this->hasPermission($request, 'can_update_quotes', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to edit quotes.',
            ], 403);
        }

        $quote = Quote::find($quoteId);
        if (!$quote) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Quote not found.',
            ], 404);
        }

        if (!$this->hasPermission($request, 'can_update_quotes', $quote->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to edit quotes for this company.',
            ], 403);
        }

        // Removing every item is part of editing, so a user who may edit the quote may also empty it,
        // which deletes it - no separate delete permission needed.
        if ($request->has('items') && count($request->input('items', [])) === 0) {
            if ($quote->status === 'accepted') {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'An accepted quote cannot be emptied. Reject it instead.',
                ], 400);
            }
            DB::transaction(function () use ($quote) {
                $quote->quoteItems()->delete();
                $quote->quoteNotes()->delete();
                $quote->delete();
            });
            Log::info('Quote deleted by removing all items', ['user_id' => $user->id, 'quote_id' => $quote->id]);

            return response()->json([
                'status' => 'success',
                'deleted' => true,
                'message' => "Quote {$quote->quote_number} had no items and was deleted.",
            ], 200);
        }

        try {
            return DB::transaction(function () use ($request, $quote) {
                // Update quote fields
                $quote->fill([
                    'status' => $request->input('status', $quote->status),
                    'valid_until' => $request->input('valid_until', $quote->valid_until),
                    'notes' => $request->input('notes', $quote->notes),
                ]);

                // Once a can_update_quotes-authorized user edits a rep-submitted
                // quote (see store(), where submitted_by_id is stamped), it's no
                // longer "new and unreviewed" - clear that flag so the "From:
                // rep - Needs Review" badge stops showing.
                if ($quote->submitted_by_id) {
                    $quote->submitted_by_id = null;
                    $quote->submitted_at = null;
                }

                // If this quote originated from a rep in POS and isn't already a
                // terminal state, staff editing it (e.g. adjusting prices/discounts)
                // is the "send back to the rep" step: route it to awaiting_rep_confirm
                // so the rep can review the new pricing and confirm or push back,
                // unless staff explicitly rejected/expired it outright.
                $explicitStatus = $request->input('status');
                $isTerminalDecision = in_array($explicitStatus, ['rejected', 'expired'], true);
                if ($quote->original_submitted_by_id && $quote->status !== 'accepted' && !$isTerminalDecision) {
                    $quote->status = 'awaiting_rep_confirm';
                }

                // Handle quote items if provided
                if ($request->has('items')) {
                    $totalAmount = 0;
                    $items = $request->input('items');
                    $existingItemIds = [];
                    $user = $request->user();

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

                        // Validate unit price
                        if ($item['unit_price'] < $product->unit_cost) {
                            return response()->json([
                                'status' => 'failed',
                                'message' => "Item at index {$index}: Unit price cannot be below unit cost ({$product->unit_cost}).",
                            ], 400);
                        }

                        // Validate stock. Quantity is in packs; stock is in pieces.
                        $piecesNeeded = PackagingCalculatorService::piecesFor($item['quantity'], $item['price_unit'] ?? null);
                        $stockQuantity = !empty($item['variant_id'])
                            ? (int) (\App\Models\ProductVariant::whereKey($item['variant_id'])->value('stock_quantity') ?? 0)
                            : (int) $product->stock_quantity;
                        if ($product->track_inventory && $piecesNeeded > $stockQuantity) {
                            return response()->json([
                                'status' => 'failed',
                                'message' => PackagingCalculatorService::packStockMessage($index, $product->name, $item['quantity'], $item['price_unit'] ?? null, $piecesNeeded, $stockQuantity),
                            ], 400);
                        }

                        $totalAmount += $item['quantity'] * $item['unit_price'];

                        // Handle packaging units
                        $unitId = $item['unit_id'] ?? null;
                        $unitQuantity = null;
                        $baseQuantity = null;
                        $packagingBreakdown = null;

                        if ($unitId) {
                            // Validate unit belongs to product
                            $unit = \App\Models\ProductPackagingUnit::where('id', $unitId)
                                ->where('product_id', $product->id)
                                ->where('is_sellable', true)
                                ->where('is_active', true)
                                ->first();
                            
                            if (!$unit) {
                                return response()->json([
                                    'status' => 'failed',
                                    'message' => "Item at index {$index}: Invalid or inactive packaging unit for this product.",
                                ], 400);
                            }

                            $unitQuantity = $item['quantity'];
                            $baseQuantity = (int) $this->calculator->convertToBaseUnits($product, $unitQuantity, $unitId);
                            $packagingBreakdown = $this->calculator->calculatePackagingBreakdown($product, $baseQuantity);
                        } else {
                            $baseQuantity = PackagingCalculatorService::piecesFor($item['quantity'], $item['price_unit'] ?? null);
                            if ($product->has_packaging) {
                                $packagingBreakdown = $this->calculator->calculatePackagingBreakdown($product, $baseQuantity);
                            }
                        }

                        // Update or create quote item
                        if (isset($item['id'])) {
                            $quoteItem = QuoteItem::where('id', $item['id'])->where('quote_id', $quote->id)->first();
                            if ($quoteItem) {
                                $quoteItem->update([
                                    'product_id' => $item['product_id'],
                                    'variant_id' => $item['variant_id'] ?? null,
                                    'unit_id' => $unitId,
                                    'quantity' => $item['quantity'],
                                    'unit_quantity' => $unitQuantity,
                                    'base_quantity' => $baseQuantity,
                                    'packaging_breakdown' => $packagingBreakdown,
                                    'unit_price' => $item['unit_price'],
                                    'price_label' => $item['price_label'] ?? null,
                                    'price_unit' => $item['price_unit'] ?? null,
                                    'total_price' => $item['quantity'] * $item['unit_price'],
                                ]);
                                $existingItemIds[] = $item['id'];
                            }
                        } else {
                            $quoteItem = QuoteItem::create([
                                'id' => (string) Str::uuid(),
                                'quote_id' => $quote->id,
                                'product_id' => $item['product_id'],
                                'variant_id' => $item['variant_id'] ?? null,
                                'unit_id' => $unitId,
                                'quantity' => $item['quantity'],
                                'unit_quantity' => $unitQuantity,
                                'base_quantity' => $baseQuantity,
                                'packaging_breakdown' => $packagingBreakdown,
                                'unit_price' => $item['unit_price'],
                                'price_label' => $item['price_label'] ?? null,
                                'price_unit' => $item['price_unit'] ?? null,
                                'total_price' => $item['quantity'] * $item['unit_price'],
                                'company_id' => $quote->company_id,
                            ]);
                            $existingItemIds[] = $quoteItem->id;
                        }
                    }

                    // Delete removed items
                    QuoteItem::where('quote_id', $quote->id)
                        ->whereNotIn('id', $existingItemIds)
                        ->delete();

                    // Update total amount - final_amount must be recalculated
                    // alongside it, or editing a quote's prices leaves the
                    // displayed total stuck at whatever it was before the
                    // edit (total_amount changes, final_amount silently
                    // doesn't, and every table/summary reads final_amount).
                    $quote->total_amount = $totalAmount;
                    $quote->discount = $request->input('discount', $quote->discount);
                    $quote->final_amount = $totalAmount - $quote->discount;
                }

                $quote->save();
                $quote->unsetRelation('quoteItems');
                $quote->syncTotals();

                return response()->json([
                    'status' => 'success',
                    'message' => 'Quote updated successfully.',
                    'quote' => $quote->load([
                        'quoteItems.product.store',
                        'quoteItems.product.sellablePackagingUnits',
                        'quoteItems.variant',
                        'quoteItems.packagingUnit'
                    ]),
                ], 200);
            });
        } catch (\Exception $e) {
            Log::error('Failed to update quote', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to update quote: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function convertToOrder(Request $request, $quoteId)
    {
        $validator = Validator::make($request->all(), [
            'delivery_location_id' => 'nullable|uuid|exists:delivery_locations,id',
            'delivery_instructions' => 'nullable|string',
            'sales_rep_id' => 'nullable|uuid|exists:users,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        if (!$this->hasPermission($request, 'can_create_orders')) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to create orders.',
            ], 403);
        }

        $quote = Quote::with(['quoteItems.product', 'customer'])->find($quoteId);
        if (!$quote) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Quote not found.',
            ], 404);
        }

        if ($quote->status === 'accepted') {
            return response()->json([
                'status' => 'failed',
                'message' => 'Quote has already been converted to an order.',
            ], 400);
        }

        if (!$this->hasPermission($request, 'can_create_orders', $quote->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to create orders for this company.',
            ], 403);
        }

        try {
            return DB::transaction(function () use ($request, $quote) {
                return $this->performConvertToOrder($request, $quote);
            });
        } catch (\Exception $e) {
            Log::error('Failed to convert quote to order', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to convert quote to order: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Shared order-creation body for both the staff-initiated convertToOrder()
     * and the rep-initiated confirm() endpoints. Must be called inside a
     * DB::transaction() by the caller.
     */
    protected function performConvertToOrder(Request $request, Quote $quote)
    {
        $user = $request->user();

                // Validate delivery location if provided
                $deliveryLocationId = $request->input('delivery_location_id');
                if ($deliveryLocationId) {
                    $deliveryLocation = DeliveryLocation::find($deliveryLocationId);
                    if ($deliveryLocation->customer_id !== $quote->customer_id) {
                        return response()->json([
                            'status' => 'failed',
                            'message' => 'Delivery location does not belong to the customer.',
                        ], 400);
                    }
                    if ($deliveryLocation->company_id !== $quote->company_id && !$this->hasPermission($request, 'can_manage_all_quotes')) {
                        return response()->json([
                            'status' => 'failed',
                            'message' => 'Delivery location does not belong to user’s company.',
                        ], 403);
                    }
                }

                // Re-validate stock for all items. Check against the variant's own
                // stock when the line is for a specific variant, not the parent
                // product's base stock - a product with variants doesn't hold
                // sellable stock at the base level.
                foreach ($quote->quoteItems as $index => $item) {
                    $product = $item->product;
                    $variant = $item->variant_id ? ($item->variant ?? \App\Models\ProductVariant::find($item->variant_id)) : null;
                    if ($error = $this->insufficientStockMessage($product, $variant, PackagingCalculatorService::piecesFor($item->quantity, $item->price_unit))) {
                        return response()->json([
                            'status' => 'failed',
                            'message' => "Item at index {$index}: {$error}",
                        ], 400);
                    }
                }

                // Generate order number
                $orderNumber = $this->generateOrderNumber($quote->company_id);

                // Cash vs. credit is decided on the order itself (at invoice
                // creation, where credit eligibility and limits are checked),
                // never at quote conversion - start as cash until then.
                $orderCredit = ['payment_type' => 'cash', 'credit_terms_days' => null];

                // Recomputed from the items at the product's current rate, so the
                // order carries the same subtotal/discount/VAT the quote shows.
                $quote->loadMissing('quoteItems.product.vatCategory');
                $totals = $quote->vatBreakdown();

                // Create order
                $order = Order::create([
                    'id' => (string) Str::uuid(),
                    'order_number' => $orderNumber,
                    'customer_id' => $quote->customer_id,
                    // Falls back to whoever originally submitted the quote (the
                    // rep) so orders converted from a rep's POS quote are
                    // attributed to them for their own "my orders" history,
                    // even though the confirm() request itself never passes
                    // sales_rep_id explicitly.
                    'sales_rep_id' => $request->input('sales_rep_id') ?: ($quote->sales_rep_id ?: $quote->original_submitted_by_id),
                    'payment_type' => $orderCredit['payment_type'],
                    'credit_terms_days' => $orderCredit['credit_terms_days'],
                    'total_amount' => $totals['subtotal'],
                    'discount' => $totals['discount'],
                    'tax' => $totals['vat'],
                    'status' => 'pending',
                    'company_id' => $quote->company_id,
                    'notes' => $quote->notes,
                    'final_amount' => $totals['total'],
                    'delivery_location_id' => $deliveryLocationId,
                    'amount_paid' => 0,
                    'currency' => 'KES', // Default, adjust as needed
                    'payment_status' => 'pending',
                ]);

                // Create order items and update stock
                foreach ($quote->quoteItems as $item) {
                    $itemTaxRate = $item->taxInfo()['rate'];
                    OrderItem::create([
                        'id' => (string) Str::uuid(),
                        'order_id' => $order->id,
                        'product_id' => $item->product_id,
                        'variant_id' => $item->variant_id,
                        'unit_id' => $item->unit_id,
                        'quantity' => $item->quantity,
                        'unit_quantity' => $item->unit_quantity,
                        'base_quantity' => $item->unit_id ? $item->base_quantity : PackagingCalculatorService::piecesFor($item->quantity, $item->price_unit),
                        'packaging_breakdown' => $item->packaging_breakdown,
                        'unit_price' => $item->unit_price,
                        'price_label' => $item->price_label,
                        'price_unit' => $item->price_unit,
                        'total_price' => $item->total_price,
                        'tax_rate' => $itemTaxRate,
                        'tax_amount' => round($item->netAmount() * $itemTaxRate / 100, 2),
                        'company_id' => $quote->company_id,
                    ]);
                    // Stock is taken when the order is receipted - see OrderStockService.
                }

                // Create delivery details
                DeliveryDetail::create([
                    'id' => (string) Str::uuid(),
                    'customer_id' => $quote->customer_id,
                    'order_id' => $order->id,
                    'delivery_location_id' => $deliveryLocationId,
                    'delivery_method' => 'standard', // Default
                    'delivery_status' => 'pending',
                    'delivery_instructions' => $request->input('delivery_instructions'),
                    'company_id' => $quote->company_id,
                ]);

                // Update quote status
                $quote->status = 'accepted';
                $quote->save();

                return response()->json([
                    'status' => 'success',
                    'message' => 'Quote converted to order successfully.',
                    'order' => $order->load([
                        'orderItems.product.store',
                        'orderItems.product.sellablePackagingUnits',
                        'orderItems.variant',
                        'orderItems.packagingUnit',
                        'deliveryDetails'
                    ]),
                ], 201);
    }

    /**
     * A rep confirms their own quote (originally submitted from POS, then
     * priced/adjusted by staff) and it becomes a real order. Authorized by
     * ownership of the quote, not by can_create_orders - reps don't have
     * that permission, and shouldn't need it just to finalize their own
     * already-reviewed quote.
     */
    public function confirm(Request $request, $quoteId)
    {
        $user = $request->user();
        $quote = Quote::with(['quoteItems.product', 'customer'])->find($quoteId);

        if (!$quote) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Quote not found.',
            ], 404);
        }

        if (!$quote->original_submitted_by_id || $quote->original_submitted_by_id !== $user->id || $quote->company_id !== $user->company_id) {
            return response()->json([
                'status' => 'failed',
                'message' => 'You can only confirm quotes you originally submitted.',
            ], 403);
        }

        if ($quote->status !== 'awaiting_rep_confirm') {
            return response()->json([
                'status' => 'failed',
                'message' => 'This quote is not currently awaiting your confirmation.',
            ], 400);
        }

        try {
            return DB::transaction(function () use ($request, $quote) {
                return $this->performConvertToOrder($request, $quote);
            });
        } catch (\Exception $e) {
            Log::error('Failed to confirm quote', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to confirm quote: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * A rep sends their reviewed-and-adjusted quote back to staff for further
     * changes instead of confirming it, with an optional note about what
     * needs adjusting.
     */
    public function requestChanges(Request $request, $quoteId)
    {
        $validator = Validator::make($request->all(), [
            'note' => 'nullable|string|max:2000',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        $user = $request->user();
        $quote = Quote::find($quoteId);

        if (!$quote) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Quote not found.',
            ], 404);
        }

        if (!$quote->original_submitted_by_id || $quote->original_submitted_by_id !== $user->id || $quote->company_id !== $user->company_id) {
            return response()->json([
                'status' => 'failed',
                'message' => 'You can only request changes on quotes you originally submitted.',
            ], 403);
        }

        if ($quote->status !== 'awaiting_rep_confirm') {
            return response()->json([
                'status' => 'failed',
                'message' => 'This quote is not currently awaiting your confirmation.',
            ], 400);
        }

        $note = $request->input('note');
        $quote->status = 'pending';
        $quote->submitted_by_id = $user->id;
        $quote->submitted_at = now();
        if ($note) {
            $quote->notes = trim(($quote->notes ? $quote->notes . "\n" : '') . "Rep requested changes: {$note}");
        }
        $quote->save();

        return response()->json([
            'status' => 'success',
            'message' => 'Changes requested. Quote sent back for review.',
            'quote' => $quote,
        ], 200);
    }

    public function index(Request $request)
    {
        $user = $request->user();
        // A rep listing only their own submitted quotes (?mine=1) doesn't need
        // can_view_quotes - they're not browsing the company's quotes, just
        // tracking what they personally submitted from POS.
        $mine = $request->boolean('mine');
        if (!$mine && !$this->hasPermission($request, 'can_view_quotes', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view quotes.',
            ], 403);
        }

        try {
            return $this->executeWithRetry(function() use ($request, $mine) {
                $user = $request->user();
                $query = Quote::with([
                    'customer' => function ($query) {
                        $query->select('id', 'name', 'email', 'phone');
                    },
                    'submittedBy' => function ($query) {
                        // users has no `name` column (first_name/last_name only,
                        // with `full_name` as a computed accessor) - selecting
                        // a bare `name` here 500'd every listing that included
                        // a rep-submitted quote still carrying submitted_by_id.
                        $query->select('id', 'first_name', 'last_name');
                    },
                ]);

                if ($mine) {
                    $query->where('company_id', $user->company_id)
                        ->where('original_submitted_by_id', $user->id);
                } elseif (!$this->hasPermission($request, 'can_manage_all_quotes')) {
                    $query->where('company_id', $user->company_id);
                } else {
                    if ($request->filled('company_id')) {
                        $query->where('company_id', $request->input('company_id'));
                    }
                }

                // Optional filters
                if ($request->filled('status')) {
                    $query->where('status', $request->input('status'));
                }
                if ($request->filled('customer_id')) {
                    $query->where('customer_id', $request->input('customer_id'));
                }
                if ($request->filled('quote_number')) {
                    $query->where('quote_number', 'ilike', '%' . $request->input('quote_number') . '%');
                }
                if ($request->filled('search')) {
                    $term = $request->input('search');
                    $query->where(function ($q) use ($term) {
                        $q->where('quote_number', 'ilike', "%{$term}%")
                            ->orWhereHas('customer', function ($cq) use ($term) {
                                $cq->where('name', 'ilike', "%{$term}%")
                                    ->orWhere('business_name', 'ilike', "%{$term}%");
                            });
                    });
                }

                $perPage = (int) $request->input('per_page', 20);
                $quotes = $query->select('id', 'customer_id', 'company_id', 'quote_number', 'total_amount', 'final_amount', 'status', 'valid_until', 'submitted_by_id', 'submitted_at', 'original_submitted_by_id', 'created_at', 'updated_at')
                    ->orderBy('created_at', 'desc')
                    ->paginate($perPage);

                return response()->json([
                    'status' => 'success',
                    'message' => 'Quotes retrieved successfully.',
                    'quotes' => $quotes,
                ], 200);
            });
        } catch (\Exception $e) {
            return $this->handleDatabaseError($e, 'fetching quotes');
        }
    }

    public function show(Request $request, $id)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_view_quotes', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view quotes.',
            ], 403);
        }

        try {
            $user = $request->user();
            $query = Quote::where('id', $id)
                ->with([
                    'customer' => function ($query) {
                        $query->select('id', 'name', 'email', 'phone', 'business_name', 'customer_type', 'payment_method', 'account_id')
                            ->with(['account' => fn ($q) => $q->select('id', 'credit_days')]);
                    },
                    'submittedBy' => function ($query) {
                        $query->select('id', 'first_name', 'last_name');
                    },
                    'salesRep' => function ($query) {
                        $query->select('id', 'first_name', 'last_name', 'email');
                    },
                    'company' => function ($query) {
                        $query->select('id', 'name', 'logo_url', 'letterhead_url');
                    },
                    'originalSubmittedBy' => function ($query) {
                        $query->select('id', 'first_name', 'last_name');
                    },
                    'deliveryLocation' => function ($query) {
                        $query->select('*');
                    },
                    'quoteItems' => function ($query) {
                        $query->select('id', 'quote_id', 'product_id', 'variant_id', 'unit_id', 'quantity', 'unit_quantity', 'base_quantity', 'packaging_breakdown', 'unit_price', 'price_label', 'price_unit', 'total_price')
                            ->with([
                                'product' => function ($query) {
                                    $query->select('id', 'name', 'item_number', 'price', 'store_id', 'has_packaging', 'base_unit', 'unit_of_measurement', 'product_code', 'sku', 'is_taxable', 'tax_rate', 'vat_category_id')
                                        ->with([
                                            'vatCategory' => function ($query) {
                                                $query->select('id', 'etims_tax_type_code');
                                            },
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
                                },
                                'packagingUnit' => function ($query) {
                                    $query->select('id', 'unit_name', 'unit_abbreviation', 'base_unit_quantity', 'price_per_unit');
                                }
                            ]);
                    },
                    'quoteNotes' => function ($query) {
                        $query->select('id', 'quote_id', 'note_content', 'created_by', 'created_at')
                            ->with(['creator' => function ($query) {
                                $query->select('id', 'first_name', 'last_name');
                            }])
                            ->orderBy('created_at', 'desc');
                    }
                ]);

            if (!$this->hasPermission($request, 'can_manage_all_quotes')) {
                $query->where('company_id', $user->company_id);
            }

            $quote = $query->first();

            if (!$quote) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Quote not found or not authorized.',
                ], 404);
            }

            $quote->setAttribute('payment_terms', $quote->paymentTermsLabel());
            $quote->setAttribute('totals', $quote->vatBreakdown());
            foreach ($quote->quoteItems as $item) {
                $tax = $item->taxInfo();
                $item->setAttribute('item_code', $item->itemCode());
                $item->setAttribute('pack_size', $item->packSize());
                $item->setAttribute('tax_label', $tax['label']);
                $item->setAttribute('tax_rate', $tax['rate']);
                $item->setAttribute('tax_amount', round($item->netAmount() * $tax['rate'] / 100, 2));
            }

            return response()->json([
                'status' => 'success',
                'quote' => $quote,
            ], 200);
        } catch (\Exception $e) {
            Log::error('Failed to retrieve quote details', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to retrieve quote details: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function salesReps(Request $request)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_view_quotes', $user->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to view quotes.'], 403);
        }

        $reps = \App\Models\User::where('company_id', $user->company_id)
            ->whereHas('role', fn ($q) => $q->salesRep())
            ->whereRaw('is_active = true')
            ->select('id', 'first_name', 'last_name', 'email')
            ->orderBy('first_name')
            ->get();

        return response()->json(['status' => 'success', 'data' => $reps]);
    }

    public function assignSalesRep(Request $request, $quoteId)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_update_quotes', $user->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to update quotes.'], 403);
        }

        $validator = Validator::make($request->all(), [
            'sales_rep_id' => 'nullable|uuid|exists:users,id',
        ]);
        if ($validator->fails()) {
            return response()->json(['status' => 'failed', 'message' => $validator->errors()], 422);
        }

        $quote = Quote::where('company_id', $user->company_id)->find($quoteId);
        if (!$quote) {
            return response()->json(['status' => 'failed', 'message' => 'Quote not found.'], 404);
        }

        $quote->update(['sales_rep_id' => $request->input('sales_rep_id')]);

        return response()->json([
            'status' => 'success',
            'message' => $quote->sales_rep_id ? 'Sales rep assigned' : 'Sales rep cleared',
            'data' => $quote->fresh(['salesRep:id,first_name,last_name,email']),
        ]);
    }

    public function destroy(Request $request, $id)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_delete_quotes', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to delete quotes.',
            ], 403);
        }

        $quote = Quote::where('id', $id)->first();
        if (!$quote) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Quote not found.',
            ], 404);
        }

        if (!$this->hasPermission($request, 'can_delete_quotes', $quote->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to delete quotes for this company.',
            ], 403);
        }

        try {
            Log::info('Quote delete attempt', [
                'user_id' => $request->user()->id,
                'quote_id' => $id,
            ]);
            
            return DB::transaction(function () use ($quote, $request) {
                // Delete related records
                $quote->quoteItems()->delete();
                $quote->quoteNotes()->delete();
                $quote->delete();

                Log::info('Quote deleted', [
                    'user_id' => $request->user()->id,
                    'quote_id' => $quote->id,
                    'company_id' => $quote->company_id,
                ]);
                
                return response()->json([
                    'status' => 'success',
                    'message' => 'Quote deleted successfully.',
                ], 200);
            });
        } catch (\Exception $e) {
            Log::error('Failed to delete quote', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to delete quote: ' . $e->getMessage(),
            ], 500);
        }
    }

    // Quote Notes functionality
    public function storeNote(Request $request, $quoteId)
    {
        $validator = Validator::make($request->all(), [
            'note_content' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        $user = $request->user();
        if (!$this->hasPermission($request, 'can_create_quote_notes', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to create quote notes.',
            ], 403);
        }

        $quote = Quote::where('id', $quoteId)->first();
        if (!$quote) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Quote not found.',
            ], 404);
        }

        if (!$this->hasPermission($request, 'can_create_quote_notes', $quote->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to create notes for this quote.',
            ], 403);
        }

        try {
            $quoteNote = QuoteNote::create([
                'id' => (string) Str::uuid(),
                'quote_id' => $quote->id,
                'note_content' => $request->input('note_content'),
                'created_by' => $user->id,
                'company_id' => $user->company_id,
            ]);

            return response()->json([
                'status' => 'success',
                'message' => 'Quote note created successfully.',
                'quote_note' => $quoteNote->load('creator:id,name'),
            ], 201);
        } catch (\Exception $e) {
            Log::error('Failed to create quote note', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to create quote note: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function getNotes(Request $request, $quoteId)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_view_quote_notes', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view quote notes.',
            ], 403);
        }

        $quote = Quote::where('id', $quoteId)->first();
        if (!$quote) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Quote not found.',
            ], 404);
        }

        if (!$this->hasPermission($request, 'can_view_quote_notes', $quote->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view notes for this quote.',
            ], 403);
        }

        try {
            $quoteNotes = QuoteNote::where('quote_id', $quoteId)
                ->with('creator:id,name')
                ->orderBy('created_at', 'desc')
                ->get();

            return response()->json([
                'status' => 'success',
                'message' => 'Quote notes retrieved successfully.',
                'quote_notes' => $quoteNotes,
            ], 200);
        } catch (\Exception $e) {
            Log::error('Failed to retrieve quote notes', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to retrieve quote notes: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function updateNote(Request $request, $quoteId, $noteId)
    {
        $validator = Validator::make($request->all(), [
            'note_content' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        $user = $request->user();
        if (!$this->hasPermission($request, 'can_update_quote_notes', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to update quote notes.',
            ], 403);
        }

        $quote = Quote::where('id', $quoteId)->first();
        if (!$quote) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Quote not found.',
            ], 404);
        }

        $quoteNote = QuoteNote::where('id', $noteId)
            ->where('quote_id', $quoteId)
            ->first();

        if (!$quoteNote) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Quote note not found.',
            ], 404);
        }

        // Only allow creators or admins to update notes
        if ($quoteNote->created_by !== $user->id && !$this->hasPermission($request, 'can_manage_company')) {
            return response()->json([
                'status' => 'failed',
                'message' => 'You can only update your own notes.',
            ], 403);
        }

        try {
            $quoteNote->update([
                'note_content' => $request->input('note_content'),
            ]);

            return response()->json([
                'status' => 'success',
                'message' => 'Quote note updated successfully.',
                'quote_note' => $quoteNote->load('creator:id,name'),
            ], 200);
        } catch (\Exception $e) {
            Log::error('Failed to update quote note', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to update quote note: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function destroyNote(Request $request, $quoteId, $noteId)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_delete_quote_notes', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to delete quote notes.',
            ], 403);
        }

        $quote = Quote::where('id', $quoteId)->first();
        if (!$quote) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Quote not found.',
            ], 404);
        }

        $quoteNote = QuoteNote::where('id', $noteId)
            ->where('quote_id', $quoteId)
            ->first();

        if (!$quoteNote) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Quote note not found.',
            ], 404);
        }

        // Only allow creators or admins to delete notes
        if ($quoteNote->created_by !== $user->id && !$this->hasPermission($request, 'can_manage_company')) {
            return response()->json([
                'status' => 'failed',
                'message' => 'You can only delete your own notes.',
            ], 403);
        }

        try {
            $quoteNote->delete();

            return response()->json([
                'status' => 'success',
                'message' => 'Quote note deleted successfully.',
            ], 200);
        } catch (\Exception $e) {
            Log::error('Failed to delete quote note', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to delete quote note: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Send quote to customer via email or WhatsApp.
     */
    public function sendQuote(Request $request, string $id)
    {
        $user = $request->user();
        $companyId = $user->company_id;
        if (!$this->hasPermission($request, 'can_update_quotes', $companyId)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to send quotes.',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'method' => 'sometimes|in:email,whatsapp',
            'email' => 'required_if:method,email|email',
            'phone' => 'required_if:method,whatsapp|regex:/^\+?[0-9]{10,15}$/',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        try {
            $quote = Quote::with(['customer.account', 'company', 'salesRep', 'originalSubmittedBy', 'quoteItems.product.vatCategory', 'quoteItems.variant', 'quoteItems.packagingUnit'])
                ->where('company_id', $user->company_id)
                ->findOrFail($id);

            if ($quote->status === 'expired') {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Cannot send expired quote',
                ], 400);
            }

            $method = $request->get('method', 'email');

            if ($method === 'email') {
                // Use the email from the request if provided, otherwise fallback to the customer's email
                $recipientEmail = $request->get('email') ?: ($quote->customer ? $quote->customer->email : null);
                if (!$recipientEmail) {
                    return response()->json([
                        'status' => 'failed',
                        'message' => 'No recipient email found',
                    ], 400);
                }
                try {
                    \Illuminate\Support\Facades\Notification::route('mail', $recipientEmail)
                        ->notify(new \App\Notifications\SendQuoteNotification($quote));
                } catch (\Exception $mailEx) {
                    Log::error('Failed to send quote email', ['error' => $mailEx->getMessage()]);
                    return response()->json([
                        'status' => 'failed',
                        'message' => 'Failed to send quote email',
                        'error' => $mailEx->getMessage(),
                    ], 500);
                }
            } else if ($method === 'whatsapp') {
                // Use the phone from the request if provided, otherwise fallback to the customer's WhatsApp phone
                $customer = $quote->customer;
                if (!$customer) {
                    return response()->json([
                        'status' => 'failed',
                        'message' => 'No customer found for quote',
                    ], 400);
                }
                $whatsappPhone = $request->get('phone') ?: $customer->getWhatsAppPhone();
                if (!$whatsappPhone) {
                    return response()->json([
                        'status' => 'failed',
                        'message' => 'No WhatsApp phone found for customer',
                    ], 400);
                }

                // 1. Generate PDF and save to a temp file
                $pdf = \Barryvdh\DomPDF\Facade\Pdf::loadView('quote.pdf', ['quote' => $quote]);
                $pdfContent = $pdf->output();
                $pdfFileName = 'quote-' . $quote->quote_number . '-' . time() . '.pdf';
                $tmpDir = storage_path('app/tmp');
                if (!file_exists($tmpDir)) {
                    mkdir($tmpDir, 0775, true);
                }
                $tmpFilePath = $tmpDir . '/' . $pdfFileName;
                file_put_contents($tmpFilePath, $pdfContent);

                // 2. Find or create WhatsApp conversation
                $conversation = \App\Models\Conversation::firstOrCreate([
                    'company_id' => $quote->company_id,
                    'customer_id' => $customer->id,
                    'platform' => 'whatsapp',
                    'platform_user_id' => $whatsappPhone,
                ], [
                    'customer_name' => $customer->name,
                    'customer_phone' => $whatsappPhone,
                    'status' => 'active',
                    // Provide a default value for NOT NULL field
                    'platform_conversation_id' => '',
                ]);

                // 3. Send via MetaChatService with local file path
                // Move PDF to public storage for WhatsApp (must be accessible by WhatsApp API)
                $publicPath = 'quotes/' . $pdfFileName;
                $publicFullPath = public_path($publicPath);
                if (!file_exists(dirname($publicFullPath))) {
                    mkdir(dirname($publicFullPath), 0775, true);
                }
                copy($tmpFilePath, $publicFullPath);
                $publicUrl = asset($publicPath);
                // Clean up temp file
                @unlink($tmpFilePath);

                // Create Message record of type 'document'
                $message = \App\Models\Message::create([
                    'conversation_id' => $conversation->id,
                    'direction' => 'outbound',
                    'sender_type' => 'agent',
                    'sender_name' => $user->name ?? 'System',
                    'message_type' => 'document',
                    'media_url' => $publicUrl,
                    'media_type' => 'application/pdf',
                    'caption' => 'Quote #' . $quote->quote_number,
                    'status' => 'pending',
                ]);

                // Send via MetaChatService
                $metaChatService = app(\App\Services\MetaChatService::class);
                $result = $metaChatService->sendMessage($conversation, $message);
                if (!$result['success']) {
                    Log::error('Failed to send quote via WhatsApp', ['error' => $result['error'] ?? 'Unknown', 'quote_id' => $quote->id]);
                    return response()->json([
                        'status' => 'failed',
                        'message' => 'Failed to send quote via WhatsApp',
                        'error' => $result['error'],
                    ], 500);
                }
            }

            $quote->markAsSent();

            return response()->json([
                'status' => 'success',
                'message' => 'Quote sent successfully',
                'data' => $quote,
            ], 200);

        } catch (\Exception $e) {
            Log::error('Failed to send quote', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to send quote',
                'error' => $e->getMessage(),
            ], 500);
        }
    }
}
