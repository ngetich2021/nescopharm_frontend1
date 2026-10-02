<?php

namespace App\Http\Controllers;

use App\Models\ProductReceipt;
use App\Models\Supplier;
use App\Services\LandedCostAllocationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;

class ProductReceiptController extends Controller
{

    protected string $disk;
    protected LandedCostAllocationService $landedCostService;

    public function __construct(LandedCostAllocationService $landedCostService)
    {
        $this->middleware('auth:sanctum');
        $this->disk = config('filesystems.default', 's3');
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

    /**
     * Resolve a browser-accessible URL for a stored path. Cloud disks (S3/R2)
     * require a signed, time-limited URL since the bucket is not publicly
     * readable — mirrors ProductImageService::getUrl().
     */
    protected function getStorageUrl(string $path): string
    {
        if ($this->disk === 's3' || config("filesystems.disks.{$this->disk}.driver") === 's3') {
            try {
                return Storage::disk($this->disk)->temporaryUrl(
                    $path,
                    now()->addHours(24)
                );
            } catch (\Exception $e) {
                return Storage::disk($this->disk)->url($path);
            }
        }

        return Storage::disk($this->disk)->url($path);
    }

    /**
     * Generate a unique product receipt number for the company.
     *
     * @param string $companyId
     * @return string
     */
    protected function generateReceiptNumber($companyId)
    {
        $prefix = 'RCPT-' . substr($companyId, 0, 8) . '-';

        // Use raw query to avoid model accessors interfering
        $lastReceipt = DB::table('product_receipts')
            ->select('product_receipt_number')
            ->where('product_receipt_number', 'like', $prefix . '%')
            ->orderBy('product_receipt_number', 'desc')
            ->lockForUpdate()
            ->first();

        $nextNumber = $lastReceipt ? (int) substr($lastReceipt->product_receipt_number, strlen($prefix)) + 1 : 1;
        return $prefix . str_pad($nextNumber, 4, '0', STR_PAD_LEFT);
    }

    /**
     * Generate a unique product number for the company.
     *
     * @param string $companyId
     * @return string
     */
    protected function generateProductNumber($companyId)
    {
        $prefix = 'PROD-' . substr($companyId, 0, 8) . '-';

        // Use raw query to avoid model accessors interfering
        $lastProduct = DB::table('products')
            ->select('product_number')
            ->where('company_id', $companyId)
            ->where('product_number', 'like', $prefix . '%')
            ->orderBy('product_number', 'desc')
            ->lockForUpdate()
            ->first();

        $nextNumber = $lastProduct ? (int) substr($lastProduct->product_number, strlen($prefix)) + 1 : 1;
        return $prefix . str_pad($nextNumber, 4, '0', STR_PAD_LEFT);
    }

    /**
     * List all product receipts (with optional pagination).
     */
    public function index(Request $request)
    {
        $user = $request->user();
        $companyId = $request->input('company_id', $user->company_id);
        if (!$this->hasPermission($request, 'can_view_product_receipts', $companyId)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view product receipts.',
            ], 403);
        }
        $query = ProductReceipt::with(['store', 'supplier', 'recipient']);
        if (!$this->hasPermission($request, 'can_manage_system')) {
            $query->where('company_id', $companyId);
        }
        $receipts = $query->orderBy('created_at', 'desc')->paginate(20);
        return response()->json([
            'status' => 'success',
            'message' => 'Product receipts retrieved successfully.',
            'receipts' => $receipts,
        ], 200);
    }

    /**
     * Show a single product receipt by ID.
     */
    public function show(Request $request, $id)
    {
        $user = $request->user();
        $receipt = ProductReceipt::with([
            'product.store',
            'product.company',
            'product.category',
            'store',
            'variant',
            'productReceiptItems.product',
            'productReceiptItems.variant',
            'supplier',
            'contractor',
            'recipient',
        ])->find($id);
        if (!$receipt) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Product receipt not found.',
            ], 404);
        }
        $companyId = $receipt->product ? $receipt->product->company_id : null;
        if (!$this->hasPermission($request, 'can_view_product_receipts', $companyId)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view this product receipt.',
            ], 403);
        }
        // Prepare names for supplier, contractor, and recipient
        $supplierName = $receipt->supplier ? $receipt->supplier->name : null;
        $contractorName = $receipt->contractor ? ($receipt->contractor->name ?? ($receipt->contractor->first_name . ' ' . $receipt->contractor->last_name)) : null;
        $recipientName = $receipt->recipient ? ($receipt->recipient->name ?? ($receipt->recipient->first_name . ' ' . $receipt->recipient->last_name)) : null;

        return response()->json([
            'status' => 'success',
            'message' => 'Product receipt retrieved successfully.',
            'receipt' => $receipt,
            'supplier_name' => $supplierName,
            'contractor_name' => $contractorName,
            'recipient_name' => $recipientName,
        ], 200);
    }

    /**
     * Update a product receipt (only editable fields).
     */
    public function update(Request $request, $id)
    {
        $receipt = ProductReceipt::with('productReceiptItems')->findOrFail($id);
        $companyId = $receipt->company_id;
        if (!$this->hasPermission($request, 'can_update_product_receipts', $companyId)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to update this product receipt.',
            ], 403);
        }

        // TEMP: decode items if sent as JSON string (for Postman form-data)
        if ($request->has('items') && is_string($request->items)) {
            $decoded = json_decode($request->items, true);
            if (json_last_error() === JSON_ERROR_NONE) {
                $request->merge(['items' => $decoded]);
            }
        }

        $data = $request->all();
        $user = $request->user();
        $uploadedDocumentUrl = null;
        if ($request->hasFile('document')) {
            $file = $request->file('document');
            try {
                $path = 'receipts/' . date('Y/m/d') . '/' . Str::uuid() . '.' . $file->getClientOriginalExtension();
                $stored = Storage::disk($this->disk)->put($path, file_get_contents($file->getRealPath()));

                if ($stored) {
                    $uploadedDocumentUrl = $this->getStorageUrl($path);
                } else {
                    throw new \Exception('Failed to store receipt document');
                }
            } catch (\Exception $e) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Document upload failed: ' . $e->getMessage(),
                ], 500);
            }
        }

        DB::beginTransaction();
        try {
            // Validate required fields (same as store, but allow partial update for PATCH)
            $validator = Validator::make($data, [
                'store_id' => 'sometimes|uuid',
                'document_type' => 'sometimes|in:receipt,invoice,delivery_note,notification_note',
                'reference_number' => 'nullable|string|unique:product_receipts,reference_number,' . $id,
                'supplier_id' => 'nullable|uuid',
                'contractor_id' => 'nullable|uuid',
                'received_by' => 'sometimes|uuid',
                'document_url' => 'nullable|string',
                'shipping_cost' => 'nullable|numeric|min:0',
                'logistics_cost' => 'nullable|numeric|min:0',
                'items' => 'sometimes|array|min:1',
                'items.*.product_id' => 'nullable|uuid',
                'items.*.sku' => 'nullable|string',
                'items.*.barcode' => 'nullable|string',
                'items.*.variant_id' => 'nullable|uuid|exists:product_variants,id',
                'items.*.quantity' => 'required_with:items|integer|min:1',
                'items.*.unit_price' => 'nullable|numeric',
                'items.*.unit_cost' => 'nullable|numeric',
                'items.*.expiry_date' => 'nullable|date',
                'items.*.notes' => 'nullable|string',
                'items.*.batch_number' => 'nullable|string',
                'items.*.lot_number' => 'nullable|string',
                'items.*.manufacture_date' => 'nullable|date',
                'items.*.supplier' => 'nullable|string',
                'items.*.supplier_id' => 'nullable|uuid',
                'items.*.serial_numbers' => 'nullable|array',
                'items.*.serial_numbers.*' => 'string',
                'items.*.track_serials' => 'nullable|boolean',
                'items.*.serial_prefix' => 'nullable|string|max:20',
                'items.*.warranty_months' => 'nullable|integer|min:0',
            ]);
            if ($validator->fails()) {
                DB::rollBack();
                return response()->json(['status' => 'failed', 'message' => $validator->errors(), 'errors' => $validator->errors()], 422);
            }

            // Update main receipt fields
            $receipt->update([
                'supplier_id' => $data['supplier_id'] ?? $receipt->supplier_id,
                'contractor_id' => $data['contractor_id'] ?? $receipt->contractor_id,
                'document_type' => $data['document_type'] ?? $receipt->document_type,
                'reference_number' => $data['reference_number'] ?? $receipt->reference_number,
                'received_by' => $data['received_by'] ?? $receipt->received_by,
                'store_id' => $data['store_id'] ?? $receipt->store_id,
                'document_url' => $uploadedDocumentUrl ?? ($data['document_url'] ?? $receipt->document_url),
                'shipping_cost' => $data['shipping_cost'] ?? $receipt->shipping_cost,
                'logistics_cost' => $data['logistics_cost'] ?? $receipt->logistics_cost,
            ]);

            $pricingWarnings = [];

            // Handle items update if provided
            if (isset($data['items'])) {
                // Rollback inventory for old items
                foreach ($receipt->productReceiptItems as $oldItem) {
                    if ($oldItem->variant_id) {
                        $variant = \App\Models\ProductVariant::find($oldItem->variant_id);
                        if ($variant) {
                            $variant->decrement('stock_quantity', $oldItem->quantity);
                        }
                    } elseif ($oldItem->product_id) {
                        $product = \App\Models\Product::find($oldItem->product_id);
                        if ($product) {
                            $product->decrement('stock_quantity', $oldItem->quantity);
                        }
                    }
                }
                // Delete old items
                $receipt->productReceiptItems()->delete();

                $landedCostLines = [];

                // Add new items and update inventory
                foreach ($data['items'] as $item) {
                    // Find or create product if not exists
                    $product = null;
                    if (!empty($item['product_id'])) {
                        $product = \App\Models\Product::find($item['product_id']);
                    } else if (!empty($item['sku']) || !empty($item['barcode'])) {
                        $product = \App\Models\Product::where('sku', $item['sku'] ?? null)
                            ->orWhere('barcode', $item['barcode'] ?? null)
                            ->first();
                        if (!$product) {
                            $product = \App\Models\Product::create([
                                'id' => (string) Str::uuid(),
                                'sku' => $item['sku'] ?? null,
                                'barcode' => $item['barcode'] ?? null,
                                'name' => $item['name'] ?? 'Unnamed Product',
                                'company_id' => $companyId,
                                'store_id' => $data['store_id'] ?? $receipt->store_id,
                                'product_number' => $this->generateProductNumber($companyId),
                                'is_active' => true,
                            ]);
                        }
                    }
                    // Create item
                    $productReceiptItem = \App\Models\ProductReceiptItem::create([
                        'id' => (string) Str::uuid(),
                        'company_id' => $companyId,
                        'product_receipt_id' => $receipt->id,
                        'product_id' => $product ? $product->id : null,
                        'variant_id' => $item['variant_id'] ?? null,
                        'quantity' => $item['quantity'],
                        'unit_price' => $item['unit_price'] ?? null,
                        'expiry_date' => $item['expiry_date'] ?? null,
                        'notes' => $item['notes'] ?? null,
                        'batch_number' => $item['batch_number'] ?? null,
                        'lot_number' => $item['lot_number'] ?? null,
                        'manufacture_date' => $item['manufacture_date'] ?? null,
                        'supplier' => $item['supplier'] ?? null,
                        'supplier_id' => $item['supplier_id'] ?? $data['supplier_id'] ?? null,
                    ]);

                    // Create inventory batch if batch tracking is needed
                    $inventoryBatch = null;
                    if ($product && (!empty($item['batch_number']) || !empty($item['lot_number']))) {
                        $batchNumber = $item['batch_number'] ?? \App\Models\InventoryBatch::generateBatchNumber($companyId, $product->id);

                        $inventoryBatch = \App\Models\InventoryBatch::create([
                            'id' => (string) Str::uuid(),
                            'company_id' => $companyId,
                            'store_id' => $data['store_id'] ?? $receipt->store_id,
                            'product_id' => $product->id,
                            'variant_id' => $item['variant_id'] ?? null,
                            'batch_number' => $batchNumber,
                            'lot_number' => $item['lot_number'] ?? null,
                            'quantity_received' => $item['quantity'],
                            'quantity_available' => $item['quantity'],
                            'quantity_allocated' => 0,
                            'quantity_sold' => 0,
                            'quantity_damaged' => 0,
                            'quantity_expired' => 0,
                            'manufacture_date' => $item['manufacture_date'] ?? null,
                            'expiry_date' => $item['expiry_date'] ?? null,
                            'received_date' => now(),
                            'unit_cost' => $item['unit_cost'] ?? $item['unit_price'] ?? null,
                            'selling_price' => $item['unit_price'] ?? null,
                            'status' => 'active',
                            'supplier' => $item['supplier'] ?? null,
                            'supplier_id' => $item['supplier_id'] ?? $data['supplier_id'] ?? null,
                            'product_receipt_id' => $receipt->id,
                            'notes' => $item['notes'] ?? null,
                        ]);
                    }

                    // Create individual serial numbers if provided or if product requires serial tracking
                    if ($product && (isset($item['serial_numbers']) || (isset($item['track_serials']) && $item['track_serials']))) {
                        $serialNumbers = $item['serial_numbers'] ?? [];
                        $trackSerials = $item['track_serials'] ?? false;

                        // Handle products that come with existing serial numbers
                        if (!empty($serialNumbers)) {
                            // Validate that serial count matches quantity
                            if (count($serialNumbers) != $item['quantity']) {
                                DB::rollBack();
                                return response()->json([
                                    'status' => 'failed',
                                    'message' => "Product '{$product->name}': Serial numbers count (" . count($serialNumbers) . ") must match quantity ({$item['quantity']})",
                                ], 422);
                            }

                            // Check for duplicate serial numbers in this batch
                            $duplicates = array_diff_assoc($serialNumbers, array_unique($serialNumbers));
                            if (!empty($duplicates)) {
                                DB::rollBack();
                                return response()->json([
                                    'status' => 'failed',
                                    'message' => "Product '{$product->name}': Duplicate serial numbers found: " . implode(', ', $duplicates),
                                ], 422);
                            }

                            // Check if any serial numbers already exist in the database
                            $existingSerials = \App\Models\InventorySerial::where('company_id', $companyId)
                                ->whereIn('serial_number', $serialNumbers)
                                ->pluck('serial_number')
                                ->toArray();

                            if (!empty($existingSerials)) {
                                DB::rollBack();
                                return response()->json([
                                    'status' => 'failed',
                                    'message' => "Product '{$product->name}': Serial numbers already exist: " . implode(', ', $existingSerials),
                                ], 422);
                            }
                        }
                        // Auto-generate serial numbers if track_serials is true but no serial numbers provided
                        else if ($trackSerials && empty($serialNumbers)) {
                            $prefix = $item['serial_prefix'] ?? strtoupper(substr($product->name ?? 'PROD', 0, 3));
                            for ($i = 1; $i <= $item['quantity']; $i++) {
                                $serialNumbers[] = $prefix . '-' . now()->format('ymd') . '-' . str_pad($i, 4, '0', STR_PAD_LEFT);
                            }
                        }

                        // Create serial number records
                        foreach ($serialNumbers as $serialNumber) {
                            \App\Models\InventorySerial::create([
                                'id' => (string) Str::uuid(),
                                'company_id' => $companyId,
                                'store_id' => $data['store_id'] ?? $receipt->store_id,
                                'product_id' => $product->id,
                                'variant_id' => $item['variant_id'] ?? null,
                                'batch_id' => $inventoryBatch ? $inventoryBatch->id : null,
                                'serial_number' => trim($serialNumber),
                                'barcode' => $item['barcode'] ?? null,
                                'status' => 'active',
                                'unit_cost' => $item['unit_cost'] ?? $item['unit_price'] ?? null,
                                'unit_price' => $item['unit_price'] ?? null,
                                'received_date' => now(),
                                'warranty_expiry_date' => isset($item['warranty_months']) && $item['warranty_months']
                                    ? now()->addMonths($item['warranty_months'])
                                    : null,
                                'purchase_reference' => $receipt->product_receipt_number,
                                'notes' => $item['notes'] ?? null,
                                'created_by' => $data['received_by'] ?? $receipt->received_by,
                            ]);
                        }
                    }
                    // Update inventory (increase stock)
                    if (!empty($item['variant_id'])) {
                        $variant = \App\Models\ProductVariant::find($item['variant_id']);
                        if ($variant) {
                            $variant->increment('stock_quantity', $item['quantity']);
                        }
                    } else if ($product) {
                        $product->increment('stock_quantity', $item['quantity']);
                    }

                    if ($product) {
                        $unitValue = $item['unit_cost'] ?? $item['unit_price'] ?? null;
                        $landedCostLines[] = [
                            'product' => $product,
                            'quantity' => (int) $item['quantity'],
                            'unit_value' => $unitValue !== null ? (float) $unitValue : 0,
                            'unit_cost' => $unitValue !== null ? (float) $unitValue : null,
                        ];
                    }
                }

                // Distribute this receipt's shipping/logistics cost across the products
                // received on it, updating each product's landed-cost basis.
                $pricingWarnings = $this->landedCostService->apply(
                    $landedCostLines,
                    (float) ($data['shipping_cost'] ?? $receipt->shipping_cost ?? 0),
                    (float) ($data['logistics_cost'] ?? $receipt->logistics_cost ?? 0)
                );
            }

            DB::commit();
            return response()->json([
                'status' => 'success',
                'message' => 'Product receipt updated successfully.',
                'pricing_warnings' => $pricingWarnings,
                'receipt' => $receipt->fresh('productReceiptItems')
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['status' => 'failed', 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Delete a product receipt.
     */
    public function destroy(Request $request, $id)
    {
        $receipt = ProductReceipt::findOrFail($id);
        $companyId = $receipt->product ? $receipt->product->company_id : null;
        if (!$this->hasPermission($request, 'can_delete_product_receipts', $companyId)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to delete this product receipt.',
            ], 403);
        }
        $receipt->delete();
        return response()->json(['status' => 'success', 'message' => 'Product receipt deleted.']);
    }

    /**
     * Receive products (single or batch), auto-create products/variants if not found, handle document upload.
     */
    public function store(Request $request)
    {
        // TEMP: decode items if sent as JSON string (for Postman form-data)
        if ($request->has('items') && is_string($request->items)) {
            $decoded = json_decode($request->items, true);
            if (json_last_error() === JSON_ERROR_NONE) {
                $request->merge(['items' => $decoded]);
            }
        }

        $user = $request->user();
        $companyId = $request->input('company_id', $user->company_id);
        if (!$this->hasPermission($request, 'can_create_product_receipts', $companyId)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to create product receipts.',
            ], 403);
        }
        $data = $request->all();
        $isBatch = isset($data['receipts']) && is_array($data['receipts']);
        $receipts = $isBatch ? $data['receipts'] : [$data];
        $results = [];

        // Handle document upload (single receipt only for now)
        $user = $request->user();
        $companyId = $user->company_id;
        $uploadedDocumentUrl = null;
        if ($request->hasFile('document')) {
            $file = $request->file('document');
            try {
                $path = 'receipts/' . date('Y/m/d') . '/' . Str::uuid() . '.' . $file->getClientOriginalExtension();
                $stored = Storage::disk($this->disk)->put($path, file_get_contents($file->getRealPath()));

                if ($stored) {
                    $uploadedDocumentUrl = $this->getStorageUrl($path);
                } else {
                    throw new \Exception('Failed to store receipt document');
                }
            } catch (\Exception $e) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Document upload failed: ' . $e->getMessage(),
                ], 500);
            }
        }

        DB::beginTransaction();
        try {
            foreach ($receipts as $i => $receiptData) {
                // If received_by is not set, use the authenticated user's id
                if (empty($receiptData['received_by'])) {
                    $receiptData['received_by'] = optional($user)->id;
                }
                // Generate unique product_receipt_number
                $receiptData['product_receipt_number'] = $this->generateReceiptNumber($companyId);
                // Validate required fields
                $validator = Validator::make($receiptData, [
                    'store_id' => 'required|uuid',
                    'document_type' => 'required|in:receipt,invoice,delivery_note,notification_note',
                    'product_receipt_number' => 'required|string|unique:product_receipts,product_receipt_number',
                    'received_by' => 'required|uuid',
                    'shipping_cost' => 'nullable|numeric|min:0',
                    'logistics_cost' => 'nullable|numeric|min:0',
                    'items' => 'required|array|min:1',
                    'reference_number' => 'nullable|string',
                    'items.*.product_id' => 'nullable|uuid',
                    'items.*.sku' => 'nullable|string',
                    'items.*.barcode' => 'nullable|string',
                    'items.*.variant_id' => 'nullable|uuid|exists:product_variants,id',
                    'items.*.quantity' => 'required|integer|min:1',
                    'items.*.unit_price' => 'nullable|numeric',
                    'items.*.unit_cost' => 'nullable|numeric',
                    'items.*.expiry_date' => 'nullable|date',
                    'items.*.notes' => 'nullable|string',
                    'items.*.batch_number' => 'nullable|string',
                    'items.*.lot_number' => 'nullable|string',
                    'items.*.manufacture_date' => 'nullable|date',
                    'items.*.supplier' => 'nullable|string',
                    'items.*.supplier_id' => 'nullable|uuid',
                    'items.*.batch_number' => 'nullable|string',
                    'items.*.lot_number' => 'nullable|string',
                    'items.*.manufacture_date' => 'nullable|date',
                    'items.*.supplier' => 'nullable|string',
                    'items.*.supplier_id' => 'nullable|uuid',
                    'items.*.serial_numbers' => 'nullable|array',
                    'items.*.serial_numbers.*' => 'string',
                    'items.*.track_serials' => 'nullable|boolean',
                    'items.*.serial_prefix' => 'nullable|string|max:20',
                    'items.*.warranty_months' => 'nullable|integer|min:0',
                ]);
                if ($validator->fails()) {
                    DB::rollBack();
                    return response()->json(['status' => 'failed', 'message' => $validator->errors(), 'errors' => $validator->errors()], 422);
                }

                // Create product receipt
                $receipt = ProductReceipt::create([
                    'id' => Str::uuid(),
                    'company_id' => $companyId,
                    'supplier_id' => $receiptData['supplier_id'] ?? null,
                    'contractor_id' => $receiptData['contractor_id'] ?? null,
                    'document_type' => $receiptData['document_type'],
                    'product_receipt_number' => $receiptData['product_receipt_number'],
                    'reference_number' => $receiptData['reference_number'] ?? null,
                    'received_by' => $receiptData['received_by'],
                    'store_id' => $receiptData['store_id'],
                    'document_url' => $uploadedDocumentUrl ?? ($receiptData['document_url'] ?? null),
                    'shipping_cost' => $receiptData['shipping_cost'] ?? 0,
                    'logistics_cost' => $receiptData['logistics_cost'] ?? 0,
                ]);

                $landedCostLines = [];

                // Create product receipt items and update inventory
                foreach ($receiptData['items'] as $item) {
                    // Find or create product if not exists
                    $product = null;
                    if (!empty($item['product_id'])) {
                        $product = \App\Models\Product::find($item['product_id']);
                    } else if (!empty($item['sku']) || !empty($item['barcode'])) {
                        $product = \App\Models\Product::where('sku', $item['sku'] ?? null)
                            ->orWhere('barcode', $item['barcode'] ?? null)
                            ->first();
                        if (!$product) {
                            $product = \App\Models\Product::create([
                                'id' => (string) Str::uuid(),
                                'sku' => $item['sku'] ?? null,
                                'barcode' => $item['barcode'] ?? null,
                                'name' => $item['name'] ?? 'Unnamed Product',
                                'company_id' => $companyId,
                                'store_id' => $receiptData['store_id'],
                                'product_number' => $this->generateProductNumber($companyId),
                                'is_active' => true,
                            ]);
                        }
                    }
                    // Create item
                    $productReceiptItem = \App\Models\ProductReceiptItem::create([
                        'id' => (string) Str::uuid(),
                        'company_id' => $companyId,
                        'product_receipt_id' => $receipt->id,
                        'product_id' => $product ? $product->id : null,
                        'variant_id' => $item['variant_id'] ?? null,
                        'quantity' => $item['quantity'],
                        'unit_price' => $item['unit_price'] ?? null,
                        'expiry_date' => $item['expiry_date'] ?? null,
                        'notes' => $item['notes'] ?? null,
                        'batch_number' => $item['batch_number'] ?? null,
                        'lot_number' => $item['lot_number'] ?? null,
                        'manufacture_date' => $item['manufacture_date'] ?? null,
                        'supplier' => $item['supplier'] ?? null,
                        'supplier_id' => $item['supplier_id'] ?? $receiptData['supplier_id'] ?? null,
                    ]);

                    // Create inventory batch if batch tracking is needed
                    $inventoryBatch = null;
                    if ($product && (!empty($item['batch_number']) || !empty($item['lot_number']))) {
                        $batchNumber = $item['batch_number'] ?? \App\Models\InventoryBatch::generateBatchNumber($companyId, $product->id);

                        $inventoryBatch = \App\Models\InventoryBatch::create([
                            'id' => (string) Str::uuid(),
                            'company_id' => $companyId,
                            'store_id' => $receiptData['store_id'],
                            'product_id' => $product->id,
                            'variant_id' => $item['variant_id'] ?? null,
                            'batch_number' => $batchNumber,
                            'lot_number' => $item['lot_number'] ?? null,
                            'quantity_received' => $item['quantity'],
                            'quantity_available' => $item['quantity'],
                            'quantity_allocated' => 0,
                            'quantity_sold' => 0,
                            'quantity_damaged' => 0,
                            'quantity_expired' => 0,
                            'manufacture_date' => $item['manufacture_date'] ?? null,
                            'expiry_date' => $item['expiry_date'] ?? null,
                            'received_date' => now(),
                            'unit_cost' => $item['unit_cost'] ?? $item['unit_price'] ?? null,
                            'selling_price' => $item['unit_price'] ?? null,
                            'status' => 'active',
                            'supplier' => $item['supplier'] ?? null,
                            'supplier_id' => $item['supplier_id'] ?? $receiptData['supplier_id'] ?? null,
                            'product_receipt_id' => $receipt->id,
                            'notes' => $item['notes'] ?? null,
                        ]);
                    }

                    // Create individual serial numbers if provided or if product requires serial tracking
                    if ($product && (isset($item['serial_numbers']) || (isset($item['track_serials']) && $item['track_serials']))) {
                        $serialNumbers = $item['serial_numbers'] ?? [];
                        $trackSerials = $item['track_serials'] ?? false;

                        // Handle products that come with existing serial numbers
                        if (!empty($serialNumbers)) {
                            // Validate that serial count matches quantity
                            if (count($serialNumbers) != $item['quantity']) {
                                DB::rollBack();
                                return response()->json([
                                    'status' => 'failed',
                                    'message' => "Product '{$product->name}': Serial numbers count (" . count($serialNumbers) . ") must match quantity ({$item['quantity']})",
                                ], 422);
                            }

                            // Check for duplicate serial numbers in this batch
                            $duplicates = array_diff_assoc($serialNumbers, array_unique($serialNumbers));
                            if (!empty($duplicates)) {
                                DB::rollBack();
                                return response()->json([
                                    'status' => 'failed',
                                    'message' => "Product '{$product->name}': Duplicate serial numbers found: " . implode(', ', $duplicates),
                                ], 422);
                            }

                            // Check if any serial numbers already exist in the database (excluding current receipt)
                            $existingSerials = \App\Models\InventorySerial::where('company_id', $companyId)
                                ->whereIn('serial_number', $serialNumbers)
                                ->where('purchase_reference', '!=', $receiptData['product_receipt_number'])
                                ->pluck('serial_number')
                                ->toArray();

                            if (!empty($existingSerials)) {
                                DB::rollBack();
                                return response()->json([
                                    'status' => 'failed',
                                    'message' => "Product '{$product->name}': Serial numbers already exist: " . implode(', ', $existingSerials),
                                ], 422);
                            }
                        }
                        // Auto-generate serial numbers if track_serials is true but no serial numbers provided
                        else if ($trackSerials && empty($serialNumbers)) {
                            $prefix = $item['serial_prefix'] ?? strtoupper(substr($product->name ?? 'PROD', 0, 3));
                            for ($i = 1; $i <= $item['quantity']; $i++) {
                                $serialNumbers[] = $prefix . '-' . now()->format('ymd') . '-' . str_pad($i, 4, '0', STR_PAD_LEFT);
                            }
                        }

                        // Create serial number records
                        foreach ($serialNumbers as $serialNumber) {
                            \App\Models\InventorySerial::create([
                                'id' => (string) Str::uuid(),
                                'company_id' => $companyId,
                                'store_id' => $receiptData['store_id'],
                                'product_id' => $product->id,
                                'variant_id' => $item['variant_id'] ?? null,
                                'batch_id' => $inventoryBatch ? $inventoryBatch->id : null,
                                'serial_number' => trim($serialNumber),
                                'barcode' => $item['barcode'] ?? null,
                                'status' => 'active',
                                'unit_cost' => $item['unit_cost'] ?? $item['unit_price'] ?? null,
                                'unit_price' => $item['unit_price'] ?? null,
                                'received_date' => now(),
                                'warranty_expiry_date' => isset($item['warranty_months']) && $item['warranty_months']
                                    ? now()->addMonths($item['warranty_months'])
                                    : null,
                                'purchase_reference' => $receiptData['product_receipt_number'],
                                'notes' => $item['notes'] ?? null,
                                'created_by' => $receiptData['received_by'],
                            ]);
                        }
                    }
                    // Update inventory (increase stock)
                    if (!empty($item['variant_id'])) {
                        $variant = \App\Models\ProductVariant::find($item['variant_id']);
                        if ($variant) {
                            $variant->increment('stock_quantity', $item['quantity']);
                        }
                    } else if ($product) {
                        $product->increment('stock_quantity', $item['quantity']);
                    }

                    if ($product) {
                        $unitValue = $item['unit_cost'] ?? $item['unit_price'] ?? null;
                        $landedCostLines[] = [
                            'product' => $product,
                            'quantity' => (int) $item['quantity'],
                            'unit_value' => $unitValue !== null ? (float) $unitValue : 0,
                            'unit_cost' => $unitValue !== null ? (float) $unitValue : null,
                        ];
                    }
                }

                // Distribute this receipt's shipping/logistics cost across the products
                // received on it, updating each product's landed-cost basis.
                $pricingWarnings = $this->landedCostService->apply(
                    $landedCostLines,
                    (float) ($receiptData['shipping_cost'] ?? 0),
                    (float) ($receiptData['logistics_cost'] ?? 0)
                );

                $results[] = [
                    'receipt' => $receipt->load('productReceiptItems'),
                    'pricing_warnings' => $pricingWarnings,
                ];
            }
            DB::commit();
            return response()->json([
                'status' => 'success',
                'message' => 'Product receipt created successfully.',
                'receipts' => array_map(fn($r) => $r['receipt'], $results),
                'pricing_warnings' => array_merge(...array_map(fn($r) => $r['pricing_warnings'], $results)),
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'status' => 'failed',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get product receipt summary statistics for the company
     */
    public function getReceiptSummary(Request $request)
    {
        $user = $request->user();
        $companyId = $user->company_id;

        if (!$this->hasPermission($request, 'can_view_product_receipts', $companyId)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view product receipt summary.',
            ], 403);
        }

        try {
            $storeId = $request->get('store_id');
            $supplierId = $request->get('supplier_id');

            // Base query for company receipts
            $baseQuery = ProductReceipt::where('company_id', $companyId);

            // Filter by store if provided
            if ($storeId) {
                $baseQuery->where('store_id', $storeId);
            }

            // Filter by supplier if provided
            if ($supplierId) {
                $baseQuery->where('supplier_id', $supplierId);
            }

            // Total receipts count
            $totalReceipts = (clone $baseQuery)->count();

            // Recent receipts (last 7 days)
            $recentReceiptsCount = (clone $baseQuery)
                ->where('created_at', '>=', now()->subDays(7))
                ->count();

            // Today's receipts
            $todayReceiptsCount = (clone $baseQuery)
                ->whereDate('created_at', now()->toDateString())
                ->count();

            // This month's receipts
            $thisMonthReceiptsCount = (clone $baseQuery)
                ->whereMonth('created_at', now()->month)
                ->whereYear('created_at', now()->year)
                ->count();

            // Receipts by document type
            $receiptsByDocumentType = (clone $baseQuery)
                ->select('document_type', DB::raw('COUNT(*) as count'))
                ->groupBy('document_type')
                ->get()
                ->pluck('count', 'document_type');

            // Top suppliers by receipt count
            $topSuppliers = ProductReceipt::where('product_receipts.company_id', $companyId)
                ->when($storeId, function ($query) use ($storeId) {
                    return $query->where('product_receipts.store_id', $storeId);
                })
                ->join('suppliers', function ($join) use ($companyId) {
                    $join->on('product_receipts.supplier_id', '=', 'suppliers.id')
                        ->where('suppliers.company_id', $companyId);
                })
                ->select('suppliers.name as supplier_name', 'suppliers.id as supplier_id', DB::raw('COUNT(*) as receipt_count'))
                ->groupBy('suppliers.id', 'suppliers.name')
                ->orderBy('receipt_count', 'desc')
                ->limit(5)
                ->get();

            // Total receipt value - Note: total_amount field may not exist in current schema
            // $totalReceiptValue = (clone $baseQuery)->sum('total_amount') ?? 0;
            $totalReceiptValue = 0; // Placeholder since total_amount column doesn't exist

            // Average receipt value
            $averageReceiptValue = $totalReceipts > 0 ? ($totalReceiptValue / $totalReceipts) : 0;

            // Total items received across all receipts
            $totalItemsReceived = DB::table('product_receipt_items')
                ->join('product_receipts', 'product_receipt_items.product_receipt_id', '=', 'product_receipts.id')
                ->where('product_receipts.company_id', $companyId)
                ->when($storeId, function ($query) use ($storeId) {
                    return $query->where('product_receipts.store_id', $storeId);
                })
                ->when($supplierId, function ($query) use ($supplierId) {
                    return $query->where('product_receipts.supplier_id', $supplierId);
                })
                ->sum('product_receipt_items.quantity') ?? 0;

            // Count of total line items across all receipts
            $totalLineItems = DB::table('product_receipt_items')
                ->join('product_receipts', 'product_receipt_items.product_receipt_id', '=', 'product_receipts.id')
                ->where('product_receipts.company_id', $companyId)
                ->when($storeId, function ($query) use ($storeId) {
                    return $query->where('product_receipts.store_id', $storeId);
                })
                ->when($supplierId, function ($query) use ($supplierId) {
                    return $query->where('product_receipts.supplier_id', $supplierId);
                })
                ->count();

            // Monthly trends (last 6 months)
            $monthlyTrends = collect();
            for ($i = 5; $i >= 0; $i--) {
                $date = now()->subMonths($i);
                $count = (clone $baseQuery)
                    ->whereMonth('created_at', $date->month)
                    ->whereYear('created_at', $date->year)
                    ->count();

                $monthlyTrends->push([
                    'month' => $date->format('Y-m'),
                    'month_name' => $date->format('M Y'),
                    'count' => $count
                ]);
            }

            return response()->json([
                'status' => 'success',
                'message' => 'Product receipt summary retrieved successfully.',
                'data' => [
                    'overview' => [
                        'total_receipts' => $totalReceipts,
                        'recent_receipts' => $recentReceiptsCount,
                        'today_receipts' => $todayReceiptsCount,
                        'this_month_receipts' => $thisMonthReceiptsCount,
                        'total_items_received' => (int) $totalItemsReceived,
                        'total_line_items' => (int) $totalLineItems,
                    ],
                    'financial' => [
                        'total_receipt_value' => round($totalReceiptValue, 2),
                        'average_receipt_value' => round($averageReceiptValue, 2),
                    ],
                    'breakdown' => [
                        'by_document_type' => $receiptsByDocumentType,
                        'top_suppliers' => $topSuppliers,
                    ],
                    'trends' => [
                        'monthly_receipts' => $monthlyTrends,
                    ],
                    'filters' => [
                        'store_id' => $storeId,
                        'supplier_id' => $supplierId,
                        'company_id' => $companyId,
                    ],
                    'generated_at' => now()->toISOString(),
                ]
            ], 200);

        } catch (\Exception $e) {
            Log::error('Failed to get product receipt summary', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'company_id' => $companyId,
                'user_id' => $user->id,
            ]);

            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to retrieve product receipt summary: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get comprehensive batch summary statistics for the company
     */
    public function getBatchSummary(Request $request)
    {
        $user = $request->user();
        $companyId = $user->company_id;

        if (!$this->hasPermission($request, 'can_view_product_receipts', $companyId)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view batch summary.',
            ], 403);
        }

        try {
            // Validate request parameters
            $validator = \Illuminate\Support\Facades\Validator::make($request->all(), [
                'store_id' => 'nullable|string|exists:stores,id',
                'product_id' => 'nullable|string|exists:products,id',
                'supplier_id' => 'nullable|string|exists:suppliers,id',
                'status' => 'nullable|string|in:active,expired,sold_out,damaged,recalled',
                'expiry_days' => 'nullable|integer|min:1|max:365',
                'include_batches' => 'nullable|boolean',
                'per_page' => 'nullable|integer|min:1|max:100',
                'sort_by' => 'nullable|string|in:created_at,batch_number,expiry_date,quantity_available,quantity_allocated,unit_cost',
                'sort_order' => 'nullable|string|in:asc,desc',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Validation failed',
                    'message' => $validator->errors(), 'errors' => $validator->errors()
                ], 422);
            }

            // Get filter parameters
            $storeId = $request->get('store_id');
            $productId = $request->get('product_id');
            $supplierId = $request->get('supplier_id');
            $status = $request->get('status');
            $expiryDays = $request->get('expiry_days', 30); // Default 30 days for expiry alerts
            $includeBatches = $request->boolean('include_batches', false); // New parameter to include paginated batches
            $perPage = $request->get('per_page', 15); // Pagination parameter

            // Base query for company batches
            $baseQuery = \App\Models\InventoryBatch::where('company_id', $companyId);

            // Apply filters
            if ($storeId) {
                $baseQuery->where('store_id', $storeId);
            }
            if ($productId) {
                $baseQuery->where('product_id', $productId);
            }
            if ($supplierId) {
                $baseQuery->where('supplier_id', $supplierId);
            }
            if ($status) {
                $baseQuery->where('status', $status);
            }

            // Get paginated batches if requested
            $paginatedBatches = null;
            if ($includeBatches) {
                $batchesQuery = clone $baseQuery;
                $batchesQuery->with(['product', 'variant', 'store', 'supplier']);

                // Sorting for batches
                $sortBy = $request->get('sort_by', 'created_at');
                $sortOrder = $request->get('sort_order', 'desc');
                $batchesQuery->orderBy($sortBy, $sortOrder);

                $paginatedBatches = $batchesQuery->paginate($perPage);
            }

            // === OVERVIEW STATISTICS ===
            $totalBatches = (clone $baseQuery)->count();
            $activeBatches = (clone $baseQuery)->where('status', 'active')->count();
            $expiredBatches = (clone $baseQuery)->where('status', 'expired')->count();
            $soldOutBatches = (clone $baseQuery)->where('status', 'sold_out')->count();
            $damagedBatches = (clone $baseQuery)->where('status', 'damaged')->count();
            $recalledBatches = (clone $baseQuery)->where('status', 'recalled')->count();

            // Batches created in the last 7 days
            $recentBatches = (clone $baseQuery)
                ->where('created_at', '>=', now()->subDays(7))
                ->count();

            // Batches created today
            $todayBatches = (clone $baseQuery)
                ->whereDate('created_at', now()->toDateString())
                ->count();

            // === INVENTORY QUANTITIES ===
            $totalQuantityReceived = (clone $baseQuery)->sum('quantity_received') ?? 0;
            $totalQuantityAvailable = (clone $baseQuery)->sum('quantity_available') ?? 0;
            $totalQuantityAllocated = (clone $baseQuery)->sum('quantity_allocated') ?? 0;
            $totalQuantitySold = (clone $baseQuery)->sum('quantity_sold') ?? 0;
            $totalQuantityDamaged = (clone $baseQuery)->sum('quantity_damaged') ?? 0;
            $totalQuantityExpired = (clone $baseQuery)->sum('quantity_expired') ?? 0;

            // === FINANCIAL METRICS ===
            $totalInventoryValue = (clone $baseQuery)
                ->whereRaw('(quantity_available + quantity_allocated) > 0')
                ->get()
                ->sum(function ($batch) {
                    return ($batch->quantity_available + $batch->quantity_allocated) * $batch->unit_cost;
                });

            $totalAvailableValue = (clone $baseQuery)
                ->where('quantity_available', '>', 0)
                ->get()
                ->sum(function ($batch) {
                    return $batch->quantity_available * $batch->unit_cost;
                });

            $totalAllocatedValue = (clone $baseQuery)
                ->where('quantity_allocated', '>', 0)
                ->get()
                ->sum(function ($batch) {
                    return $batch->quantity_allocated * $batch->unit_cost;
                });

            // Average batch values
            $avgBatchReceived = $totalBatches > 0 ? round($totalQuantityReceived / $totalBatches, 2) : 0;
            $avgBatchValue = $totalBatches > 0 ? round($totalInventoryValue / $totalBatches, 2) : 0;

            // === EXPIRY ANALYSIS ===
            $expiringBatches = (clone $baseQuery)
                ->where('status', 'active')
                ->where('expiry_date', '<=', now()->addDays($expiryDays))
                ->where('expiry_date', '>=', now())
                ->count();

            $expiredBatchesWithStock = (clone $baseQuery)
                ->where('expiry_date', '<', now())
                ->whereRaw('(quantity_available + quantity_allocated) > 0')
                ->count();

            // Get detailed expiring batches
            $detailedExpiringBatches = (clone $baseQuery)
                ->with(['product:id,name,sku', 'store:id,name', 'supplier:id,name'])
                ->where('status', 'active')
                ->where('expiry_date', '<=', now()->addDays($expiryDays))
                ->where('expiry_date', '>=', now())
                ->orderBy('expiry_date', 'asc')
                ->limit(10)
                ->get()
                ->map(function ($batch) {
                    return [
                        'id' => $batch->id,
                        'batch_number' => $batch->batch_number,
                        'product_name' => $batch->product->name ?? 'Unknown Product',
                        'sku' => $batch->product->sku ?? null,
                        'store_name' => $batch->store->name ?? 'Unknown Store',
                        'supplier_name' => $batch->supplier->name ?? $batch->supplier ?? 'Unknown Supplier',
                        'quantity_available' => $batch->quantity_available,
                        'quantity_allocated' => $batch->quantity_allocated,
                        'expiry_date' => $batch->expiry_date?->format('Y-m-d'),
                        'days_to_expiry' => $batch->expiry_date ? now()->diffInDays($batch->expiry_date, false) : null,
                        'unit_cost' => $batch->unit_cost,
                        'total_value' => ($batch->quantity_available + $batch->quantity_allocated) * $batch->unit_cost,
                    ];
                });

            // === STATUS BREAKDOWN ===
            $statusBreakdown = (clone $baseQuery)
                ->select('status', DB::raw('COUNT(*) as count'), DB::raw('SUM(quantity_received) as total_quantity'))
                ->groupBy('status')
                ->get()
                ->keyBy('status');

            // === TOP PERFORMING BATCHES ===
            $topBatchesBySales = (clone $baseQuery)
                ->with(['product:id,name,sku', 'store:id,name'])
                ->where('quantity_sold', '>', 0)
                ->orderBy('quantity_sold', 'desc')
                ->limit(5)
                ->get()
                ->map(function ($batch) {
                    return [
                        'id' => $batch->id,
                        'batch_number' => $batch->batch_number,
                        'product_name' => $batch->product->name ?? 'Unknown Product',
                        'sku' => $batch->product->sku ?? null,
                        'store_name' => $batch->store->name ?? 'Unknown Store',
                        'quantity_sold' => $batch->quantity_sold,
                        'sales_value' => $batch->quantity_sold * $batch->selling_price,
                        'received_date' => $batch->received_date?->format('Y-m-d'),
                    ];
                });

            // === LOW STOCK BATCHES ===
            $lowStockBatches = (clone $baseQuery)
                ->with(['product:id,name,sku', 'store:id,name'])
                ->where('status', 'active')
                ->where('quantity_available', '>', 0)
                ->where('quantity_available', '<=', 10) // Threshold for low stock
                ->orderBy('quantity_available', 'asc')
                ->limit(10)
                ->get()
                ->map(function ($batch) {
                    return [
                        'id' => $batch->id,
                        'batch_number' => $batch->batch_number,
                        'product_name' => $batch->product->name ?? 'Unknown Product',
                        'sku' => $batch->product->sku ?? null,
                        'store_name' => $batch->store->name ?? 'Unknown Store',
                        'quantity_available' => $batch->quantity_available,
                        'expiry_date' => $batch->expiry_date?->format('Y-m-d'),
                        'unit_cost' => $batch->unit_cost,
                    ];
                });

            // === MONTHLY TRENDS (Last 6 months) ===
            $monthlyTrends = collect();
            for ($i = 5; $i >= 0; $i--) {
                $date = now()->subMonths($i);
                $monthQuery = (clone $baseQuery)
                    ->whereMonth('created_at', $date->month)
                    ->whereYear('created_at', $date->year);

                $count = $monthQuery->count();
                $quantityReceived = $monthQuery->sum('quantity_received') ?? 0;

                $monthlyTrends->push([
                    'month' => $date->format('Y-m'),
                    'month_name' => $date->format('M Y'),
                    'batch_count' => $count,
                    'quantity_received' => $quantityReceived,
                ]);
            }

            // === SUPPLIER PERFORMANCE ===
            $supplierStats = (clone $baseQuery)
                ->with('supplier:id,name')
                ->select(
                    'supplier_id',
                    'supplier',
                    DB::raw('COUNT(*) as batch_count'),
                    DB::raw('SUM(quantity_received) as total_quantity'),
                    DB::raw('AVG(unit_cost) as avg_unit_cost')
                )
                ->whereNotNull('supplier_id')
                ->groupBy('supplier_id', 'supplier')
                ->orderBy('batch_count', 'desc')
                ->limit(5)
                ->get()
                ->map(function ($stat) {
                    return [
                        'supplier_id' => $stat->supplier_id,
                        'supplier_name' => $stat->supplier->name ?? $stat->supplier ?? 'Unknown Supplier',
                        'batch_count' => $stat->batch_count,
                        'total_quantity' => $stat->total_quantity,
                        'avg_unit_cost' => round($stat->avg_unit_cost, 2),
                    ];
                });

            // === STORE DISTRIBUTION ===
            $storeDistribution = (clone $baseQuery)
                ->with('store:id,name')
                ->select(
                    'store_id',
                    DB::raw('COUNT(*) as batch_count'),
                    DB::raw('SUM(quantity_available + quantity_allocated) as current_stock')
                )
                ->whereNotNull('store_id')
                ->groupBy('store_id')
                ->orderBy('batch_count', 'desc')
                ->get()
                ->map(function ($stat) {
                    return [
                        'store_id' => $stat->store_id,
                        'store_name' => $stat->store->name ?? 'Unknown Store',
                        'batch_count' => $stat->batch_count,
                        'current_stock' => $stat->current_stock,
                    ];
                });

            return response()->json([
                'status' => 'success',
                'message' => 'Batch summary retrieved successfully.',
                'data' => [
                    'overview' => [
                        'total_batches' => $totalBatches,
                        'active_batches' => $activeBatches,
                        'expired_batches' => $expiredBatches,
                        'sold_out_batches' => $soldOutBatches,
                        'damaged_batches' => $damagedBatches,
                        'recalled_batches' => $recalledBatches,
                        'recent_batches' => $recentBatches,
                        'today_batches' => $todayBatches,
                    ],
                    'inventory' => [
                        'total_quantity_received' => (int) $totalQuantityReceived,
                        'total_quantity_available' => (int) $totalQuantityAvailable,
                        'total_quantity_allocated' => (int) $totalQuantityAllocated,
                        'total_quantity_sold' => (int) $totalQuantitySold,
                        'total_quantity_damaged' => (int) $totalQuantityDamaged,
                        'total_quantity_expired' => (int) $totalQuantityExpired,
                        'inventory_turnover_rate' => $totalQuantityReceived > 0 ? round(($totalQuantitySold / $totalQuantityReceived) * 100, 2) : 0,
                    ],
                    'financial' => [
                        'total_inventory_value' => round($totalInventoryValue, 2),
                        'total_available_value' => round($totalAvailableValue, 2),
                        'total_allocated_value' => round($totalAllocatedValue, 2),
                        'avg_batch_received' => $avgBatchReceived,
                        'avg_batch_value' => $avgBatchValue,
                    ],
                    'expiry_analysis' => [
                        'expiring_soon_count' => $expiringBatches,
                        'expired_with_stock_count' => $expiredBatchesWithStock,
                        'expiry_threshold_days' => $expiryDays,
                        'detailed_expiring_batches' => $detailedExpiringBatches,
                    ],
                    'alerts' => [
                        'low_stock_batches' => $lowStockBatches,
                        'expiring_batches_count' => $expiringBatches,
                        'expired_batches_with_stock' => $expiredBatchesWithStock,
                    ],
                    'performance' => [
                        'top_batches_by_sales' => $topBatchesBySales,
                        'supplier_stats' => $supplierStats,
                        'store_distribution' => $storeDistribution,
                    ],
                    'breakdown' => [
                        'by_status' => $statusBreakdown,
                    ],
                    'trends' => [
                        'monthly_batches' => $monthlyTrends,
                    ],
                    'filters' => [
                        'store_id' => $storeId,
                        'product_id' => $productId,
                        'supplier_id' => $supplierId,
                        'status' => $status,
                        'expiry_days' => $expiryDays,
                        'include_batches' => $includeBatches,
                        'per_page' => $perPage,
                        'company_id' => $companyId,
                    ],
                    'batches' => $paginatedBatches,
                    'generated_at' => now()->toISOString(),
                ]
            ], 200);

        } catch (\Exception $e) {
            Log::error('Failed to get batch summary', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'company_id' => $companyId,
                'user_id' => $user->id,
                'filters' => $request->all(),
            ]);

            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to retrieve batch summary: ' . $e->getMessage(),
            ], 500);
        }
    }
}
