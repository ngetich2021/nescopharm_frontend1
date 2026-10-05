<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\ProductPackagingUnit;
use App\Models\ProductCategory;
use App\Models\ProductPriceTier;
use App\Models\ProductPriceHistory;
use App\Models\PriceListImport;
use App\Models\InventorySerial;
use App\Models\ProductReceiptItem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use App\Http\Traits\HandlesDatabaseErrors;
use App\Models\InventoryBatch;
use App\Models\InventoryMovement;
use App\Services\ProductPackagingService;
use App\Services\PackagingCalculatorService;
use App\Services\ProductImageService;

class ProductController extends Controller
{
    use HandlesDatabaseErrors;
    protected $packagingService;
    protected $calculator;
    protected $imageService;

    public function __construct(
        ProductPackagingService $packagingService,
        PackagingCalculatorService $calculator,
        ProductImageService $imageService
    ) {
        $this->middleware('auth:sanctum');
        $this->packagingService = $packagingService;
        $this->calculator = $calculator;
        $this->imageService = $imageService;
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
     * Resolve a category_id from a free-text category name, creating the ProductCategory
     * if it doesn't already exist for this company. Returns null if no name is given.
     */
    protected function resolveCategoryId(?string $companyId, ?string $categoryName): ?string
    {
        $categoryName = $categoryName ? trim($categoryName) : null;
        if (!$categoryName || !$companyId) {
            return null;
        }

        $category = ProductCategory::where('company_id', $companyId)
            ->whereRaw('LOWER(name) = ?', [strtolower($categoryName)])
            ->first();

        if (!$category) {
            $category = ProductCategory::create([
                'id' => (string) Str::uuid(),
                'company_id' => $companyId,
                'name' => $categoryName,
                'is_active' => true,
            ]);
        }

        return $category->id;
    }

    /**
     * Each price-list code (e.g. "NSPD 001") must belong to one product only within a company.
     */
    protected function priceCodeConflicts(string $companyId, array $tiers, ?string $productId): array
    {
        $errors = [];
        $seen = [];
        foreach ($tiers as $tier) {
            $name = trim((string) ($tier['tier_name'] ?? ''));
            $code = trim((string) ($tier['item_code'] ?? ''));
            if ($name === '' || $code === '') {
                continue;
            }
            $key = strtoupper("{$name} {$code}");
            if (isset($seen[$key])) {
                $errors[] = "{$key} is entered more than once.";
                continue;
            }
            $seen[$key] = true;

            $taken = ProductPriceTier::with('product:id,name')
                ->where('company_id', $companyId)
                ->where('tier_name', $name)
                ->where('item_code', $code)
                ->when($productId, fn ($q) => $q->where('product_id', '!=', $productId))
                ->first();
            if ($taken) {
                $errors[] = "{$key} is already used by \"" . ($taken->product?->name ?? 'another product') . '".';
            }
        }
        return $errors;
    }

    /**
     * Create/update/delete a product's price tiers to match the given list.
     * Each tier: ['id' => optional existing id, 'tier_name' => string, 'price' => number]
     */
    protected function syncPriceTiers(Product $product, ?array $tiers, ?ProductVariant $variant = null): void
    {
        if ($tiers === null) {
            return;
        }

        $scoped = fn () => ProductPriceTier::where('product_id', $product->id)
            ->where(fn ($q) => $variant ? $q->where('variant_id', $variant->id) : $q->whereNull('variant_id'));

        $keepIds = [];
        foreach ($tiers as $tier) {
            if (empty($tier['tier_name']) || !isset($tier['price'])) {
                continue;
            }
            $id = $tier['id'] ?? null;
            $existing = $id ? $scoped()->find($id) : null;

            $fields = [
                'tier_name' => $tier['tier_name'],
                'item_code' => ($tier['item_code'] ?? null) !== null && trim($tier['item_code']) !== '' ? trim($tier['item_code']) : null,
                'price' => $tier['price'],
                'unit_of_measure' => trim((string) ($tier['unit_of_measure'] ?? '')) ?: 'pcs',
            ];

            if ($existing) {
                $existing->update($fields);
                $keepIds[] = $existing->id;
            } else {
                $created = ProductPriceTier::create(array_merge($fields, [
                    'id' => (string) Str::uuid(),
                    'company_id' => $product->company_id,
                    'product_id' => $product->id,
                    'variant_id' => $variant?->id,
                ]));
                $keepIds[] = $created->id;
            }
        }

        // Remove tiers that were dropped from the submitted list
        $scoped()->whereNotIn('id', $keepIds)->delete();
    }

    /**
     * Permissions whose owner needs to browse the product catalog as part of
     * their own workflow (picking items/prices for a quote, order, requisition
     * or purchase order) even without full Product Management rights.
     */
    protected const PRODUCT_BROWSING_WORKFLOW_PERMISSIONS = [
        'can_view_products',
        'can_create_quotes',
        'can_update_quotes',
        'can_create_orders',
        'can_update_orders',
        'can_create_requisitions',
        'can_update_requisitions',
        'can_create_purchase_orders',
        'can_update_purchase_orders',
    ];

    public function index(Request $request)
    {
        $user = $request->user();
        $canBrowseProducts = collect(self::PRODUCT_BROWSING_WORKFLOW_PERMISSIONS)
            ->contains(fn ($permission) => $this->hasPermission($request, $permission, $user->company_id));

        if (!$canBrowseProducts) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view products.',
            ], 403);
        }

        $query = Product::with(['store', 'company', 'category', 'variants.priceTiers', 'supplier', 'priceTiers']);
        $companyId = $user->company_id;

        // If user is system admin and explicitly requests another company
        if ($this->hasPermission($request, 'can_manage_system') && $request->filled('company_id')) {
            $companyId = $request->input('company_id');
        }

        $query->where('company_id', $companyId);

        if ($request->filled('name')) {
            // Every word must appear, so pasted text with doubled or non-breaking spaces still matches.
            $words = preg_split('/[\s\x{00A0}]+/u', trim($request->input('name')), -1, PREG_SPLIT_NO_EMPTY);
            foreach ($words as $word) {
                $query->where('name', 'ilike', '%' . addcslashes($word, '%_\\') . '%');
            }
        }

        if ($request->filled('search')) {
            $term = trim($request->input('search'));
            // "NSPD 001" and "nspd001" both find the NSPD list's item 001.
            $compact = preg_replace('/\s+/', '', $term);
            $query->where(function ($q) use ($term, $compact) {
                $q->where('name', 'ilike', '%' . $term . '%')
                    ->orWhere('sku', 'ilike', '%' . $term . '%')
                    ->orWhere('description', 'ilike', '%' . $term . '%')
                    ->orWhereHas('priceTiers', fn ($t) => $t->whereRaw("(tier_name || coalesce(item_code, '')) ilike ?", ['%' . $compact . '%']));
                if (ctype_digit($term)) {
                    $q->orWhere('item_number', (int) $term);
                }
            });
        }

        if ($request->filled('category_id')) {
            $query->where('category_id', $request->input('category_id'));
        }

        if ($request->filled('category') && $request->input('category') !== 'all') {
            $query->where('category_id', $request->input('category'));
        }

        if ($request->filled('status') && $request->input('status') !== 'all') {
            $query->whereRaw('is_active = ' . ($request->input('status') === 'active' ? 'true' : 'false'));
        }

        // Pagination: ?page=1&per_page=500
        $perPage = (int) $request->input('per_page', 500);
        $products = $query->orderBy('name', 'asc')->paginate($perPage);

        return response()->json([
            'status' => 'success',
            'message' => 'Products retrieved successfully.',
            'data' => $products,
        ], 200);
    }

    public function show(Request $request, $id)
    {
        $user = $request->user();
        $product = Product::with(['store', 'company', 'category', 'supplier', 'priceTiers'])->find($id);
        if (!$product) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Product not found.',
            ], 404);
        }
        if (!$this->hasPermission($request, "can_view_products", $product->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view this product.',
            ], 403);
        }

        // Only load variants if has_variations is true
        if ($product->has_variations) {
            $product->load('variants.priceTiers');
        }

        // Load packaging units if configured
        if ($product->has_packaging) {
            $product->load('packagingUnits');
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Product retrieved successfully.',
            'product' => $product,
        ], 200);
    }

    private const PRICE_LIST_HEADERS = [
        'item_code' => ['itemcode', 'code', 'itemno', 'itemnumber', 'no'],
        'description' => ['itemdescription', 'description', 'item', 'itemname', 'productname', 'name', 'product'],
        'price' => ['price', 'unitprice', 'sellingprice', 'amount', 'rate'],
        'uom' => ['unitofmeasure', 'unitofmeasurement', 'uom', 'unit', 'packsize'],
        'tax' => ['taxstatus', 'tax', 'vat', 'vatstatus', 'taxcode', 'taxtype'],
    ];

    /**
     * Import one price list (NSPV, NSPH, NSPO, NSPD...) from Excel/CSV. Rows are matched to products by
     * item description (case-insensitive); products that don't exist yet are created. With dry_run=1
     * nothing is saved and the per-row result is returned for review.
     */
    public function importPriceList(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'file' => 'required|file|mimes:xlsx,xls,csv,txt|max:10240',
            'list_name' => 'required|string|max:20',
            'store_id' => 'nullable|uuid|exists:stores,id',
            'dry_run' => 'nullable|boolean',
        ]);
        if ($validator->fails()) {
            return response()->json(['status' => 'failed', 'message' => $validator->errors()], 400);
        }

        $user = $request->user();
        if (!$this->hasPermission($request, 'can_create_products', $user->company_id)
            || !$this->hasPermission($request, 'can_update_products', $user->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to import price lists.'], 403);
        }

        $companyId = $user->company_id;
        $listName = strtoupper(trim($request->input('list_name')));
        $dryRun = $request->boolean('dry_run');
        $storeId = $request->input('store_id')
            ?: DB::table('stores')->where('company_id', $companyId)->orderBy('created_at')->value('id');

        try {
            $rows = \PhpOffice\PhpSpreadsheet\IOFactory::load($request->file('file')->getRealPath())
                ->getActiveSheet()
                ->toArray(null, true, true, false);
        } catch (\Throwable $e) {
            return response()->json(['status' => 'failed', 'message' => 'Could not read the file: ' . $e->getMessage()], 422);
        }

        $columns = $this->mapPriceListHeaders($rows[0] ?? []);
        if (!isset($columns['description'], $columns['price'])) {
            return response()->json([
                'status' => 'failed',
                'message' => 'The first row must have column headings including "Item Description" and "Price" '
                    . '(optional: "Item Code", "Unit of Measure", "Tax Status").',
            ], 422);
        }

        $results = [];
        $summary = ['rows' => 0, 'products_created' => 0, 'products_matched' => 0, 'prices_added' => 0, 'prices_updated' => 0, 'errors' => 0];
        $priceHistoryRecords = [];

        DB::beginTransaction();
        try {
            for ($i = 1; $i < count($rows); $i++) {
                $row = $rows[$i];
                $cell = fn ($key) => isset($columns[$key]) ? trim((string) ($row[$columns[$key]] ?? '')) : '';
                $description = preg_replace('/\s+/', ' ', $cell('description'));
                if ($description === '' && $cell('price') === '') {
                    continue;
                }

                $summary['rows']++;
                $itemCode = $this->priceListItemCode($cell('item_code'), $listName);
                $result = ['row' => $i + 1, 'code' => trim($listName . ' ' . ($itemCode ?? '')), 'description' => $description];

                $rawPrice = str_replace([',', ' '], '', preg_replace('/^(KES|KSH|KSHS)\.?/i', '', $cell('price')));
                if ($description === '' || !is_numeric($rawPrice)) {
                    $summary['errors']++;
                    $results[] = $result + ['status' => 'error', 'message' => $description === '' ? 'Item description is missing.' : 'Price is missing or not a number.'];
                    continue;
                }
                $price = round((float) $rawPrice, 2);
                // Price lists without a unit of measure are sold in pieces.
                $uom = $cell('uom') !== '' ? $cell('uom') : 'pcs';
                $tax = $this->parseTaxStatus($cell('tax'));
                if ($tax === false) {
                    $summary['errors']++;
                    $results[] = $result + ['status' => 'error', 'message' => "Tax status \"{$cell('tax')}\" not recognised (use e.g. VAT 16%, Zero rated, Exempt, Non-VAT)."];
                    continue;
                }

                // Match order: this list's code already on a product, then a product whose SKU is the
                // code (older data stored codes there), then the item description.
                $code = trim($listName . ' ' . ($itemCode ?? ''));
                $matches = collect();
                if ($itemCode !== null) {
                    $tierOwner = ProductPriceTier::where('company_id', $companyId)->where('tier_name', $listName)->where('item_code', $itemCode)->value('product_id');
                    $matches = $tierOwner
                        ? Product::where('id', $tierOwner)->get()
                        : Product::where('company_id', $companyId)
                            ->whereRaw("upper(regexp_replace(coalesce(sku, ''), '\\s+', '', 'g')) = ?", [strtoupper(preg_replace('/\s+/', '', $code))])
                            ->get();
                }
                if ($matches->isEmpty()) {
                    $matches = Product::where('company_id', $companyId)
                        ->whereRaw("lower(regexp_replace(trim(name), '\\s+', ' ', 'g')) = ?", [mb_strtolower($description)])
                        ->get();
                }
                if ($matches->count() > 1) {
                    $summary['errors']++;
                    $results[] = $result + ['status' => 'error', 'message' => "{$matches->count()} products share this description - rename them so each is unique."];
                    continue;
                }

                $product = $matches->first();
                $notes = [];
                if (!$product) {
                    $product = Product::create([
                        'id' => (string) Str::uuid(),
                        'company_id' => $companyId,
                        'store_id' => $storeId,
                        'product_number' => $this->generateProductNumber($companyId),
                        'name' => $description,
                        'price' => $listName === 'NSPV' ? $price : 0,
                        'unit_cost' => 0,
                        'unit_of_measurement' => $uom,
                        'is_active' => true,
                        'track_inventory' => true,
                        'is_taxable' => $tax['is_taxable'] ?? true,
                        'tax_rate' => $tax['tax_rate'] ?? null,
                    ]);
                    $summary['products_created']++;
                    $status = 'created';
                } else {
                    $updates = [];
                    if ($listName === 'NSPV') {
                        $updates['price'] = $price;
                        $updates['unit_of_measurement'] = $uom;
                    }
                    if ($tax !== null) {
                        $updates['is_taxable'] = $tax['is_taxable'];
                        $updates['tax_rate'] = $tax['tax_rate'];
                    }
                    if ($updates) {
                        $product->update($updates);
                    }
                    $summary['products_matched']++;
                    $status = 'matched';
                }

                $tier = ProductPriceTier::where('company_id', $companyId)
                    ->where('tier_name', $listName)
                    ->when($itemCode !== null,
                        fn ($q) => $q->where('item_code', $itemCode),
                        fn ($q) => $q->whereNull('item_code')->where('product_id', $product->id))
                    ->first();

                if ($tier) {
                    if ($tier->product_id !== $product->id) {
                        $notes[] = "{$result['code']} moved here from another product.";
                    }
                    $oldPrice = (float) $tier->price;
                    $tier->update(['product_id' => $product->id, 'variant_id' => null, 'price' => $price, 'unit_of_measure' => $uom]);
                    $summary['prices_updated']++;

                    if (!$dryRun && $oldPrice !== $price) {
                        $priceHistoryRecords[] = [
                            'product_id' => $product->id,
                            'old_value' => $oldPrice,
                            'new_value' => $price,
                        ];
                    }
                } else {
                    ProductPriceTier::create([
                        'id' => (string) Str::uuid(),
                        'company_id' => $companyId,
                        'product_id' => $product->id,
                        'tier_name' => $listName,
                        'item_code' => $itemCode,
                        'price' => $price,
                        'unit_of_measure' => $uom,
                    ]);
                    $summary['prices_added']++;

                    if (!$dryRun) {
                        $priceHistoryRecords[] = [
                            'product_id' => $product->id,
                            'old_value' => null,
                            'new_value' => $price,
                        ];
                    }
                }

                $results[] = $result + [
                    'status' => $status,
                    'item_number' => $product->item_number,
                    'price' => $price,
                    'unit_of_measure' => $uom,
                    'message' => implode(' ', $notes) ?: null,
                ];
            }

            if ($dryRun) {
                DB::rollBack();
            } else {
                $nextVersion = (PriceListImport::where('company_id', $companyId)
                    ->where('list_name', $listName)
                    ->max('version') ?? 0) + 1;

                $uploadedFile = $request->file('file');
                $storedPath = $uploadedFile->storeAs(
                    "price-lists/{$companyId}",
                    "{$listName}_{$nextVersion}_" . time() . '.' . $uploadedFile->getClientOriginalExtension(),
                    'local'
                );

                $importRecord = PriceListImport::create([
                    'id' => (string) Str::uuid(),
                    'company_id' => $companyId,
                    'list_name' => $listName,
                    'version' => $nextVersion,
                    'file_name' => $uploadedFile->getClientOriginalName(),
                    'file_path' => $storedPath,
                    'rows_count' => $summary['rows'],
                    'products_created' => $summary['products_created'],
                    'products_matched' => $summary['products_matched'],
                    'prices_added' => $summary['prices_added'],
                    'prices_updated' => $summary['prices_updated'],
                    'errors_count' => $summary['errors'],
                    'uploaded_by' => $user->id,
                ]);

                foreach ($priceHistoryRecords as $rec) {
                    $change = $rec['old_value'] !== null ? $rec['new_value'] - $rec['old_value'] : null;
                    $pct = ($rec['old_value'] !== null && $rec['old_value'] != 0)
                        ? round(($change / $rec['old_value']) * 100, 2) : null;

                    ProductPriceHistory::create([
                        'id' => (string) Str::uuid(),
                        'company_id' => $companyId,
                        'product_id' => $rec['product_id'],
                        'price_type' => $listName,
                        'old_value' => $rec['old_value'],
                        'new_value' => $rec['new_value'],
                        'change_amount' => $change,
                        'change_percentage' => $pct,
                        'changed_by' => $user->id,
                        'source' => ProductPriceHistory::SOURCE_BULK_IMPORT,
                        'source_reference' => $importRecord->label,
                    ]);
                }

                DB::commit();
            }
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error('Price list import failed', ['error' => $e->getMessage()]);
            return response()->json(['status' => 'failed', 'message' => 'Import failed: ' . $e->getMessage()], 500);
        }

        return response()->json([
            'status' => 'success',
            'message' => $dryRun ? 'Preview only - nothing was saved.' : "{$listName} price list imported.",
            'dry_run' => $dryRun,
            'list_name' => $listName,
            'summary' => $summary,
            'rows' => $results,
        ]);
    }

    private const PRODUCT_SHEET_HEADERS = [
        'item_no' => ['itemno', 'itemnumber', 'no'],
        'row_type' => ['rowtype', 'type', 'linetype'],
        'size' => ['size', 'variant', 'variation', 'sizename'],
        'description' => ['itemdescription', 'description', 'name', 'itemname', 'productname'],
        'category' => ['category'],
        'uom' => ['unitofmeasure', 'unitofmeasurement', 'uom', 'unit'],
        'cost' => ['costprice', 'cost', 'unitcost', 'buyingprice'],
        'tax' => ['taxstatus', 'tax', 'vatstatus'],
        'hs_code' => ['hscode', 'hs'],
        'reorder' => ['reorderlevel', 'lowstockthreshold', 'reorder'],
        'track' => ['trackinventory', 'track'],
        'active' => ['active', 'isactive', 'status'],
        'brand' => ['brand'],
    ];

    /**
     * Import the products sheet that the products page exports. One row per item; an item with
     * sizes is followed by one row per size (Item No. 164.1, 164.2 ... or Row Type "Size").
     * Items are matched by Item No. (blank or unknown = new item), sizes by name under their item.
     * A blank cell leaves that field unchanged. Stock is never imported - it moves only through
     * receipts, stock adjustments, recounts and sales. dry_run=1 previews.
     */
    public function importProducts(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'file' => 'required|file|mimes:xlsx,xls,csv,txt|max:10240',
            'dry_run' => 'nullable|boolean',
        ]);
        if ($validator->fails()) {
            return response()->json(['status' => 'failed', 'message' => $validator->errors()], 400);
        }

        $user = $request->user();
        if (!$this->hasPermission($request, 'can_create_products', $user->company_id)
            || !$this->hasPermission($request, 'can_update_products', $user->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to import products.'], 403);
        }
        $companyId = $user->company_id;
        $dryRun = $request->boolean('dry_run');
        $storeId = DB::table('stores')->where('company_id', $companyId)->orderBy('created_at')->value('id');

        try {
            $rows = \PhpOffice\PhpSpreadsheet\IOFactory::load($request->file('file')->getRealPath())
                ->getSheet(0)
                ->toArray(null, true, false, false);
        } catch (\Throwable $e) {
            return response()->json(['status' => 'failed', 'message' => 'Could not read the file: ' . $e->getMessage()], 422);
        }

        $columns = [];
        $priceColumns = [];
        foreach ($rows[0] ?? [] as $index => $heading) {
            $normalized = preg_replace('/[^a-z0-9]/', '', strtolower((string) $heading));
            if (preg_match('/^([a-z]{2,10})(code|price)$/', $normalized, $m) && !in_array($normalized, ['costprice', 'hscode'], true)) {
                $priceColumns[strtoupper($m[1])][$m[2]] = $index;
                continue;
            }
            foreach (self::PRODUCT_SHEET_HEADERS as $field => $aliases) {
                if (!isset($columns[$field]) && in_array($normalized, $aliases, true)) {
                    $columns[$field] = $index;
                }
            }
        }
        if (!isset($columns['description']) && !isset($columns['item_no'])) {
            return response()->json([
                'status' => 'failed',
                'message' => 'The first row must have the column headings from the exported products sheet (at least "Item No." or "Item Description").',
            ], 422);
        }

        $number = fn ($v) => is_numeric($n = str_replace([',', ' '], '', preg_replace('/^(KES|KSH|KSHS)\.?/i', '', $v))) ? (float) $n : null;
        $yesNo = fn ($v) => $v === '' ? null : in_array(strtolower($v), ['yes', 'y', 'true', '1', 'active'], true);

        $summary = ['rows' => 0, 'items_created' => 0, 'items_updated' => 0, 'sizes_created' => 0, 'sizes_updated' => 0, 'unchanged' => 0, 'errors' => 0];
        $results = [];
        $current = null;
        // The database is remote (~250ms a round trip): look everything up once instead of per row,
        // let the preview simulate without writing, and give a real import more than PHP's 30s.
        $write = !$dryRun;
        if ($write) {
            set_time_limit(600);
        }
        $products = Product::where('company_id', $companyId)->get()->keyBy(fn ($p) => (string) $p->item_number);
        // Excel turns size "2.0" into 2 when it saves a sheet, so numeric sizes match by value.
        $sizeKey = fn ($name) => is_numeric($t = trim((string) $name)) ? (string) (float) $t : mb_strtolower($t);
        // What the preview shows side by side: the system's values before, and after applying the row.
        $itemSnapshot = fn (?Product $p) => $p ? [
            'uom' => $p->unit_of_measurement,
            'cost' => round((float) $p->unit_cost, 2),
            'tax' => $this->describeTaxStatus($p),
            'reorder' => $p->low_stock_threshold !== null ? (int) $p->low_stock_threshold : null,
        ] : null;
        $sizeSnapshot = fn (?ProductVariant $v) => $v ? ['cost' => round((float) $v->cost, 2)] : null;
        $variants = ProductVariant::whereIn('product_id', $products->pluck('id'))->get()
            ->groupBy('product_id')
            ->map(fn ($group) => $group->keyBy(fn ($v) => $sizeKey($v->name)));
        $nextItemNumber = (int) Product::withTrashed()->where('company_id', $companyId)->max('item_number') + 1;

        DB::beginTransaction();
        try {
            for ($i = 1; $i < count($rows); $i++) {
                $row = $rows[$i];
                $cell = fn ($key) => isset($columns[$key]) ? trim(preg_replace('/\s+/', ' ', (string) ($row[$columns[$key]] ?? ''))) : '';
                if (implode('', array_map(fn ($c) => trim((string) $c), $row)) === '') {
                    continue;
                }
                $summary['rows']++;
                $itemNo = $cell('item_no');
                $result = ['row' => $i + 1, 'item_no' => $itemNo, 'description' => $cell('description')];
                $isSize = strtolower($cell('row_type')) === 'size' || str_contains($itemNo, '.') || ($cell('size') !== '' && strtolower($cell('row_type')) !== 'item');

                if ($isSize) {
                    $parentNo = str_contains($itemNo, '.') ? strstr($itemNo, '.', true) : null;
                    $parent = $parentNo !== null ? $products->get((string) (int) $parentNo) : $current;
                    $sizeName = $cell('size');
                    if (!$parent || $sizeName === '') {
                        $summary['errors']++;
                        $results[] = $result + ['status' => 'error', 'message' => !$parent ? "No item {$parentNo} found for this size - put the size rows under their item." : 'Size name is missing.'];
                        continue;
                    }

                    $variant = $variants->get($parent->id)?->get($sizeKey($sizeName));
                    $cost = $number($cell('cost'));
                    $active = $yesNo($cell('active'));
                    $before = $sizeSnapshot($variant);
                    if ($variant) {
                        $variant->fill(array_filter(['cost' => $cost, 'is_active' => $active], fn ($v) => $v !== null));
                        if ($variant->isDirty()) {
                            $write && $variant->save();
                            $summary['sizes_updated']++;
                            $status = 'size updated';
                        } else {
                            $summary['unchanged']++;
                            $status = 'unchanged';
                        }
                    } else {
                        $variant = new ProductVariant([
                            'id' => (string) Str::uuid(),
                            'product_id' => $parent->id,
                            'company_id' => $companyId,
                            'store_id' => $parent->store_id ?? $storeId,
                            'name' => $sizeName,
                            'price' => 0,
                            'cost' => $cost ?? 0,
                            'stock_quantity' => 0,
                            'is_active' => $active ?? true,
                        ]);
                        if ($write) {
                            $variant->save();
                            if (!$parent->has_variations) {
                                $parent->update(['has_variations' => true]);
                            }
                        }
                        $variants->put($parent->id, ($variants->get($parent->id) ?? collect())->put($sizeKey($sizeName), $variant));
                        $summary['sizes_created']++;
                        $status = 'size created';
                    }
                    $results[] = array_merge($result, ['status' => $status, 'item_no' => $itemNo ?: ($parent->item_number . ' / ' . $sizeName),
                        'description' => ProductVariant::sizedName($parent->name, $sizeName),
                        'row_type' => 'size', 'size' => $sizeName, 'before' => $before, 'after' => $sizeSnapshot($variant)]);
                    continue;
                }

                $tax = $this->parseTaxStatus($cell('tax'));
                if ($tax === false) {
                    $summary['errors']++;
                    $results[] = $result + ['status' => 'error', 'message' => "Tax status \"{$cell('tax')}\" not recognised (use VAT 16%, Zero rated or Exempt)."];
                    continue;
                }

                if ($itemNo !== '' && !ctype_digit($itemNo)) {
                    $summary['errors']++;
                    $results[] = $result + ['status' => 'error', 'message' => "Item No. \"{$itemNo}\" is not a number."];
                    continue;
                }
                $product = $itemNo !== '' ? $products->get((string) (int) $itemNo) : null;
                if (!$product && $cell('description') === '') {
                    $summary['errors']++;
                    $results[] = $result + ['status' => 'error', 'message' => "Item {$itemNo} not found, and there is no description to create it."];
                    continue;
                }

                $fields = array_filter([
                    'name' => $cell('description') ?: null,
                    'category' => $cell('category') ?: null,
                    'unit_of_measurement' => $cell('uom') ?: null,
                    'unit_cost' => $number($cell('cost')),
                    'hs_code' => $cell('hs_code') ?: null,
                    'low_stock_threshold' => $number($cell('reorder')) !== null ? (int) $number($cell('reorder')) : null,
                    'track_inventory' => $yesNo($cell('track')),
                    'is_active' => $yesNo($cell('active')),
                    'brand' => $cell('brand') ?: null,
                ], fn ($v) => $v !== null);
                if ($tax !== null) {
                    $fields['is_taxable'] = $tax['is_taxable'];
                    $fields['tax_rate'] = $tax['tax_rate'];
                }
                if (isset($fields['category']) && $write) {
                    $fields['category_id'] = $this->resolveCategoryId($companyId, $fields['category']);
                }

                $before = $itemSnapshot($product);
                if ($product) {
                    $product->fill($fields);
                    if ($product->isDirty()) {
                        $write && $product->save();
                        $summary['items_updated']++;
                        $status = 'updated';
                    } else {
                        $summary['unchanged']++;
                        $status = 'unchanged';
                    }
                } else {
                    $product = new Product($fields + [
                        'id' => (string) Str::uuid(),
                        'company_id' => $companyId,
                        'store_id' => $storeId,
                        'price' => 0,
                        'unit_cost' => 0,
                        'unit_of_measurement' => 'pcs',
                        'stock_quantity' => 0,
                        'is_active' => true,
                        'track_inventory' => true,
                        'is_taxable' => true,
                        'tax_rate' => 16,
                    ]);
                    if ($write) {
                        $product->product_number = $this->generateProductNumber($companyId);
                        $product->save();
                    } else {
                        $product->item_number = $nextItemNumber++;
                    }
                    $products->put((string) $product->item_number, $product);
                    $summary['items_created']++;
                    $status = 'created';
                }

                $notes = [];
                foreach ($priceColumns as $list => $cols) {
                    $price = isset($cols['price']) ? $number(trim((string) ($row[$cols['price']] ?? ''))) : null;
                    $code = isset($cols['code']) ? $this->priceListItemCode(trim((string) ($row[$cols['code']] ?? '')), $list) : null;
                    if ($price === null) {
                        continue;
                    }
                    if ($code !== null) {
                        $owner = ProductPriceTier::where('company_id', $companyId)->where('tier_name', $list)->where('item_code', $code)
                            ->where('product_id', '!=', $product->id)->first();
                        if ($owner) {
                            $notes[] = "{$list} {$code} already belongs to another item - not changed.";
                            continue;
                        }
                    }
                    if (!$write) {
                        continue;
                    }
                    $tier = ProductPriceTier::where('company_id', $companyId)->where('product_id', $product->id)->whereNull('variant_id')->where('tier_name', $list)->first();
                    $values = ['price' => round($price, 2), 'unit_of_measure' => $product->unit_of_measurement ?: 'pcs'] + ($code !== null ? ['item_code' => $code] : []);
                    $tier
                        ? $tier->update($values)
                        : ProductPriceTier::create($values + ['id' => (string) Str::uuid(), 'company_id' => $companyId, 'product_id' => $product->id, 'tier_name' => $list]);
                    if ($list === 'NSPV') {
                        $product->update(['price' => round($price, 2)]);
                    }
                }

                $current = $product;
                $results[] = array_merge($result, ['status' => $status, 'item_no' => (string) $product->item_number, 'description' => $product->name,
                    'row_type' => 'item', 'size' => null, 'before' => $before, 'after' => $itemSnapshot($product), 'message' => implode(' ', $notes) ?: null]);
            }

            $dryRun ? DB::rollBack() : DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error('Product import failed', ['error' => $e->getMessage(), 'line' => $e->getLine()]);
            return response()->json(['status' => 'failed', 'message' => 'Import failed: ' . $e->getMessage()], 500);
        }

        return response()->json([
            'status' => 'success',
            'message' => $dryRun ? 'Preview only - nothing was saved.' : 'Products imported.',
            'dry_run' => $dryRun,
            'summary' => $summary,
            'rows' => $results,
        ]);
    }

    /**
     * The "Item Code" column may hold the full code (NSPH001, "NSPH 001") or just the number
     * (001) - the list is already known from the import, so only the number is stored. Without
     * this, a sheet exported from here and uploaded back would turn 001 into "NSPH NSPH001".
     */
    private function priceListItemCode(string $raw, string $listName): ?string
    {
        $value = preg_replace('/\s+/', '', trim($raw));
        if (stripos($value, $listName) === 0) {
            $value = substr($value, strlen($listName));
        }
        return $value !== '' ? $value : null;
    }

    /**
     * Every price currently on one list (NSPV, NSPH, NSPO, NSPD...), in the same shape the
     * importer reads. A GM/Director downloads this, edits the prices in Excel and re-imports
     * it, so the sheet must round-trip: same columns, same codes.
     */
    public function exportPriceList(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'list_name' => 'required|string|max:20',
        ]);
        if ($validator->fails()) {
            return response()->json(['status' => 'failed', 'message' => $validator->errors()], 400);
        }

        $user = $request->user();
        if (!$this->hasPermission($request, 'can_update_products', $user->company_id)
            && !$this->hasPermission($request, 'can_manage_pricing', $user->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to export price lists.'], 403);
        }

        $listName = strtoupper(trim($request->input('list_name')));

        $rows = ProductPriceTier::with('product:id,name,item_number,is_taxable,tax_rate')
            ->where('company_id', $user->company_id)
            ->where('tier_name', $listName)
            ->get()
            // Codes are strings like "001"/"57", so sort them as numbers where possible.
            ->sortBy(fn ($tier) => [is_numeric($tier->item_code) ? 0 : 1, is_numeric($tier->item_code) ? (float) $tier->item_code : 0, (string) $tier->item_code])
            ->values()
            ->map(fn ($tier) => [
                // What goes in the sheet's "Item Code" column: the full code staff know it by
                // (NSPH001), not the bare number, so the file reads the same as the ones supplied.
                'sheet_code' => $listName . $tier->item_code,
                'item_code' => $tier->item_code,
                'code' => $tier->code,
                'description' => $tier->product?->name,
                'price' => (float) $tier->price,
                'unit_of_measure' => $tier->unit_of_measure,
                'tax_status' => $this->describeTaxStatus($tier->product),
                'item_number' => $tier->product?->item_number,
            ]);

        return response()->json([
            'status' => 'success',
            'message' => $rows->isEmpty() ? "No prices are on the {$listName} list yet." : "{$listName} price list retrieved.",
            'list_name' => $listName,
            'rows' => $rows,
        ]);
    }

    public function priceListHistory(Request $request)
    {
        $user = $request->user();
        $listName = strtoupper(trim($request->input('list_name', '')));

        $query = PriceListImport::where('company_id', $user->company_id)
            ->orderByDesc('created_at');

        if ($listName) {
            $query->where('list_name', $listName);
        }

        $imports = $query->get();
        $userIds = $imports->pluck('uploaded_by')->filter()->unique()->values()->toArray();
        $users = \App\Models\User::whereIn('id', $userIds)->get()->keyBy('id');

        $data = $imports->map(function ($imp) use ($users) {
            $row = $imp->toArray();
            $u = $imp->uploaded_by ? $users->get($imp->uploaded_by) : null;
            $row['uploader'] = $u ? ['id' => $u->id, 'name' => $u->full_name] : null;
            return $row;
        });

        return response()->json(['data' => $data]);
    }

    public function downloadImportFile(Request $request, string $id)
    {
        $user = $request->user();
        $import = PriceListImport::where('id', $id)
            ->where('company_id', $user->company_id)
            ->first();

        if (!$import || !$import->file_path || !Storage::disk('local')->exists($import->file_path)) {
            return response()->json(['error' => 'File not found'], 404);
        }

        return Storage::disk('local')->download($import->file_path, $import->file_name);
    }

    public function productPriceHistory(Request $request, string $productId)
    {
        $user = $request->user();
        $product = Product::where('id', $productId)->where('company_id', $user->company_id)->first();
        if (!$product) {
            return response()->json(['error' => 'Product not found'], 404);
        }

        $history = ProductPriceHistory::where('product_id', $productId)
            ->orderByDesc('created_at')
            ->limit(100)
            ->get();

        $userIds = $history->pluck('changed_by')->filter()->unique()->values()->toArray();
        $users = \App\Models\User::whereIn('id', $userIds)->get()->keyBy('id');

        $data = $history->map(function ($h) use ($users) {
            $row = $h->toArray();
            $u = $h->changed_by ? $users->get($h->changed_by) : null;
            $row['changed_by_user'] = $u ? ['id' => $u->id, 'name' => $u->full_name] : null;
            return $row;
        });

        return response()->json(['data' => $data]);
    }

    /**
     * The inverse of parseTaxStatus(), so an exported sheet re-imports with the same tax.
     */
    private function describeTaxStatus(?Product $product): string
    {
        // The setter stores 'true'/'false' text, which the boolean cast reads as true until the model is reloaded.
        if (!$product || !filter_var($product->getAttributes()['is_taxable'] ?? false, FILTER_VALIDATE_BOOLEAN)) {
            return 'Exempt';
        }
        $rate = (float) ($product->tax_rate ?? 0);
        return $rate > 0 ? 'VAT ' . rtrim(rtrim(number_format($rate, 2, '.', ''), '0'), '.') . '%' : 'Zero rated';
    }

    private function mapPriceListHeaders(array $header): array
    {
        $columns = [];
        foreach ($header as $index => $heading) {
            $normalized = preg_replace('/[^a-z0-9]/', '', strtolower((string) $heading));
            foreach (self::PRICE_LIST_HEADERS as $field => $aliases) {
                if (!isset($columns[$field]) && in_array($normalized, $aliases, true)) {
                    $columns[$field] = $index;
                }
            }
        }
        return $columns;
    }

    /**
     * Blank means "leave the product's tax as it is" (null); unrecognised text returns false.
     * Exempt is stored as non-VAT: the product form has no separate exempt setting either.
     */
    private function parseTaxStatus(string $value): array|false|null
    {
        $v = strtolower(trim($value));
        if ($v === '') {
            return null;
        }
        if (str_contains($v, 'exempt') || str_contains($v, 'non') || in_array($v, ['a', 'd', 'no', 'none', 'no vat'], true)) {
            return ['is_taxable' => false, 'tax_rate' => null];
        }
        if (str_contains($v, 'zero') || $v === 'c') {
            return ['is_taxable' => true, 'tax_rate' => 0];
        }
        if (preg_match('/(\d+(?:\.\d+)?)/', $v, $m)) {
            return ['is_taxable' => true, 'tax_rate' => (float) $m[1]];
        }
        if ($v === 'e') {
            return ['is_taxable' => true, 'tax_rate' => 8];
        }
        if (in_array($v, ['b', 'vat', 'vatable', 'taxable', 'standard', 'yes', 'v'], true)) {
            return ['is_taxable' => true, 'tax_rate' => 16];
        }
        return false;
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'product_code' => 'nullable|string|max:100',
            'price' => 'nullable|numeric|min:0',
            'unit_cost' => 'nullable|numeric|min:0',
            'shipping_cost' => 'nullable|numeric|min:0',
            'logistics_cost' => 'nullable|numeric|min:0',
            'margin_amount' => 'nullable|numeric|min:0',
            'last_price' => 'nullable|numeric|min:0',
            'price_tiers' => 'nullable|array',
            'price_tiers.*.tier_name' => 'required_with:price_tiers|string|max:100',
            'price_tiers.*.price' => 'required_with:price_tiers|numeric|min:0',
            'price_tiers.*.item_code' => 'nullable|string|max:30',
            'price_tiers.*.unit_of_measure' => 'nullable|string|max:50',
            'stock_quantity' => 'nullable|integer|min:0',
            'category' => 'nullable|string|max:255',
            'category_id' => 'nullable|uuid|exists:product_categories,id',
            'sku' => 'nullable|string|max:255',
            'barcode' => 'nullable|string|max:255',
            'brand' => 'nullable|string|max:255',
            'supplier' => 'nullable|string|max:255',
            'supplier_id' => 'nullable|uuid|exists:suppliers,id',
            'unit_of_measurement' => 'nullable|string|max:50',
            'is_active' => 'nullable',
            'is_featured' => 'nullable',
            'is_digital' => 'nullable',
            'is_taxable' => 'nullable|boolean',
            'tax_rate' => 'nullable|numeric|min:0|max:100',
            'hs_code' => 'nullable|string|max:20',
            'track_inventory' => 'nullable',
            'store_id' => 'nullable|uuid|exists:stores,id',
            'on_hand' => 'nullable|integer|min:0',
            'allocated' => 'nullable|integer|min:0',
            'has_variations' => 'nullable',
            'variations' => 'nullable|array',
            'variations.*.price_tiers' => 'nullable|array',
            'variations.*.price_tiers.*.tier_name' => 'required|string|max:100',
            'variations.*.price_tiers.*.price' => 'required|numeric|min:0',
            'images' => 'nullable|array',
            'tags' => 'nullable|array',
            // Packaging fields
            'has_packaging' => 'nullable|boolean',
            'base_unit' => 'nullable|string|max:50',
            'packaging_units' => 'nullable|array',
            'packaging_units.*.unit_name' => 'required_with:packaging_units|string|max:100',
            'packaging_units.*.unit_abbreviation' => 'required_with:packaging_units|string|max:20',
            'packaging_units.*.base_unit_quantity' => 'required_with:packaging_units|numeric|min:0',
            'packaging_units.*.is_base_unit' => 'nullable|boolean',
            'packaging_units.*.is_sellable' => 'nullable|boolean',
            'packaging_units.*.is_purchasable' => 'nullable|boolean',
            'packaging_units.*.price_per_unit' => 'nullable|numeric|min:0',
            'packaging_units.*.cost_per_unit' => 'nullable|numeric|min:0',
            'packaging_units.*.display_order' => 'nullable|integer',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_create_products', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to create products.',
            ], 403);
        }
        try {
            $productData = $request->only([
                'name',
                'product_code',
                'description',
                'short_description',
                'price',
                'unit_cost',
                'shipping_cost',
                'logistics_cost',
                'margin_amount',
                'last_price',
                'stock_quantity',
                'low_stock_threshold',
                'category',
                'category_id',
                'sku',
                'barcode',
                'brand',
                'supplier',
                'supplier_id',
                'unit_of_measurement',
                'is_featured',
                'is_digital',
                'is_taxable',
                'tax_rate',
                'hs_code',
                'track_inventory',
                'has_packaging',
                'base_unit',
                'weight',
                'length',
                'width',
                'height',
                'shipping_class',
                'image_url',
                'primary_image_index',
                'has_variations',
                'variations',
                'tags',
                'on_hand',
                'allocated',
                'is_active'
            ]);

            // Auto-resolve/create a relational category from the free-text category name
            // if the caller didn't already supply a category_id.
            if (empty($productData['category_id']) && !empty($productData['category'])) {
                $productData['category_id'] = $this->resolveCategoryId(
                    $request->input('company_id', $user->company_id),
                    $productData['category']
                );
            }

            $priceErrors = $this->priceCodeConflicts(
                $request->input('company_id', $user->company_id),
                (array) $request->input('price_tiers', []),
                null
            );
            if (!empty($priceErrors)) {
                return response()->json([
                    'status' => 'failed',
                    'message' => implode(' ', $priceErrors),
                ], 422);
            }

            // Handle product images using ProductImageService
            $images = [];

            // Collect images from request (supports both file uploads and existing paths)
            if ($request->hasFile('images')) {
                $images = array_merge($images, $request->file('images'));
            }

            if ($request->has('images') && is_array($request->input('images'))) {
                $images = array_merge($images, $request->input('images'));
            }

            // Process all images through the service
            if (!empty($images)) {
                $productData['images'] = $this->imageService->processImages($images, 'products');
            } else {
                $productData['images'] = [];
            }

            $companyId = $request->input('company_id', $user->company_id);

            // Create product - Laravel casts will handle boolean conversion
            $product = Product::create([
                'id' => (string) Str::uuid(),
                'company_id' => $companyId,
                'store_id' => $request->input('store_id'),
                'product_number' => $this->generateProductNumber($companyId),
                'name' => $productData['name'] ?? null,
                'product_code' => $productData['product_code'] ?? null,
                'description' => $productData['description'] ?? null,
                'short_description' => $productData['short_description'] ?? null,
                'price' => $productData['price'] ?? null,
                'unit_cost' => $productData['unit_cost'] ?? null,
                'shipping_cost' => $productData['shipping_cost'] ?? 0,
                'logistics_cost' => $productData['logistics_cost'] ?? 0,
                'margin_amount' => $productData['margin_amount'] ?? 0,
                'last_price' => $productData['last_price'] ?? null,
                'stock_quantity' => $productData['stock_quantity'] ?? 0,
                'low_stock_threshold' => $productData['low_stock_threshold'] ?? 10,
                'category' => $productData['category'] ?? null,
                'category_id' => $productData['category_id'] ?? null,
                'sku' => $productData['sku'] ?? null,
                'barcode' => $productData['barcode'] ?? null,
                'brand' => $productData['brand'] ?? null,
                'supplier' => $productData['supplier'] ?? null,
                'supplier_id' => $productData['supplier_id'] ?? null,
                'unit_of_measurement' => $productData['unit_of_measurement'] ?? null,
                'is_featured' => ($productData['is_featured'] ?? false) ? 'true' : 'false',
                'is_digital' => ($productData['is_digital'] ?? false) ? 'true' : 'false',
                'is_taxable' => ($productData['is_taxable'] ?? true) ? 'true' : 'false',
                'tax_rate' => $productData['tax_rate'] ?? null,
                'hs_code' => $productData['hs_code'] ?? null,
                'track_inventory' => filter_var($productData['track_inventory'] ?? true, FILTER_VALIDATE_BOOLEAN) ? 'true' : 'false',
                'has_packaging' => ($productData['has_packaging'] ?? false) ? 'true' : 'false',
                'base_unit' => $productData['base_unit'] ?? null,
                'weight' => $productData['weight'] ?? null,
                'length' => $productData['length'] ?? null,
                'width' => $productData['width'] ?? null,
                'height' => $productData['height'] ?? null,
                'shipping_class' => $productData['shipping_class'] ?? null,
                'image_url' => $productData['image_url'] ?? null,
                'images' => $productData['images'] ?? [],
                'primary_image_index' => $productData['primary_image_index'] ?? 0,
                'has_variations' => ($productData['has_variations'] ?? false) ? 'true' : 'false',
                'tags' => $productData['tags'] ?? null,
                'on_hand' => $productData['on_hand'] ?? 0,
                'allocated' => $productData['allocated'] ?? 0,
                'is_active' => ($productData['is_active'] ?? true) ? 'true' : 'false',
            ]);
            // Handle variants if provided
            if ($request->input('has_variations') && is_array($request->input('variations'))) {
                foreach ($request->input('variations') as $index => $variantData) {
                    // Handle variant images using ProductImageService
                    $variantImages = [];

                    // Collect images from request (supports both file uploads and existing paths)
                    if ($request->hasFile("variations.{$index}.images")) {
                        $uploadedFiles = $request->file("variations.{$index}.images");
                        $variantImages = array_merge($variantImages, is_array($uploadedFiles) ? $uploadedFiles : [$uploadedFiles]);
                    }

                    if (isset($variantData['images']) && is_array($variantData['images'])) {
                        $variantImages = array_merge($variantImages, $variantData['images']);
                    }

                    // Process all variant images through the service
                    if (!empty($variantImages)) {
                        $variantData['images'] = $this->imageService->processImages($variantImages, 'product-variants');
                    }

                    // Ensure boolean fields are properly cast for PostgreSQL
                    // Convert to string 'true'/'false' for PostgreSQL boolean columns
                    if (isset($variantData['is_active'])) {
                        $isActive = ($variantData['is_active'] === true ||
                            $variantData['is_active'] === 1 ||
                            $variantData['is_active'] === '1' ||
                            $variantData['is_active'] === 'true');
                        $variantData['is_active'] = $isActive ? 'true' : 'false';
                    } else {
                        $variantData['is_active'] = 'true'; // Default to active
                    }
                    $variantTiers = $variantData['price_tiers'] ?? null;
                    unset($variantData['price_tiers']);
                    $variant = ProductVariant::create(array_merge($variantData, [
                        'id' => (string) Str::uuid(),
                        'product_id' => $product->id,
                        'company_id' => $request->input('company_id', $user->company_id),
                    ]));
                    $this->syncPriceTiers($product, $variantTiers, $variant);
                }
            }

            // Handle packaging units if provided
            $packagingResult = null;
            if ($request->input('has_packaging') && $request->has('packaging_units')) {
                $packagingUnits = $request->input('packaging_units');

                if (!empty($packagingUnits) && is_array($packagingUnits)) {
                    $packagingResult = $this->packagingService->setupProductPackaging($product, $packagingUnits);

                    if (!$packagingResult['success']) {
                        Log::warning('Packaging setup failed for product', [
                            'product_id' => $product->id,
                            'error' => $packagingResult['message']
                        ]);
                    }
                }
            }

            if ($product->has_variations) {
                $product->load('variants.priceTiers');
            }
            $product->load(['category', 'supplier']);

            // Load packaging units if configured
            if ($product->has_packaging) {
                $product->load('packagingUnits');
            }

            // Create price tiers if provided
            $this->syncPriceTiers($product, $request->input('price_tiers'));
            $product->load('priceTiers');

            $response = [
                'status' => 'success',
                'message' => 'Product created successfully.',
                'product' => $product,
            ];

            if ($packagingResult) {
                $response['packaging'] = $packagingResult;
            }

            return response()->json($response, 201);
        } catch (\Exception $e) {
            Log::error('Failed to create product', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to create product: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function update(Request $request, $id)
    {
        $product = Product::find($id);
        if (!$product) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Product not found.',
            ], 404);
        }
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_update_products', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to edit products.',
            ], 403);
        }
        if (!$this->hasPermission($request, "can_update_products", $product->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to edit this product.',
            ], 403);
        }
        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|required|string|max:255',
            'product_code' => 'nullable|string|max:100',
            'price' => 'sometimes|numeric|min:0',
            'unit_cost' => 'sometimes|numeric|min:0',
            'shipping_cost' => 'nullable|numeric|min:0',
            'logistics_cost' => 'nullable|numeric|min:0',
            'margin_amount' => 'nullable|numeric|min:0',
            'last_price' => 'nullable|numeric|min:0',
            'price_tiers' => 'nullable|array',
            'price_tiers.*.id' => 'nullable|uuid',
            'price_tiers.*.tier_name' => 'required_with:price_tiers|string|max:100',
            'price_tiers.*.price' => 'required_with:price_tiers|numeric|min:0',
            'price_tiers.*.item_code' => 'nullable|string|max:30',
            'price_tiers.*.unit_of_measure' => 'nullable|string|max:50',
            // stock_quantity is intentionally NOT accepted here - quantity may only change via
            // Stock Adjustment or Purchase Order receiving, never through a product edit.
            'category' => 'nullable|string|max:255',
            'category_id' => 'nullable|uuid|exists:product_categories,id',
            'sku' => 'nullable|string|max:255',
            'barcode' => 'nullable|string|max:255',
            'brand' => 'nullable|string|max:255',
            'supplier' => 'nullable|string|max:255',
            'supplier_id' => 'nullable|uuid|exists:suppliers,id',
            'unit_of_measurement' => 'nullable|string|max:50',
            'is_active' => 'nullable',
            'is_featured' => 'nullable',
            'is_digital' => 'nullable',
            'is_taxable' => 'nullable|boolean',
            'tax_rate' => 'nullable|numeric|min:0|max:100',
            'hs_code' => 'nullable|string|max:20',
            'track_inventory' => 'nullable',
            'store_id' => 'nullable|uuid|exists:stores,id',
            'on_hand' => 'nullable|integer|min:0',
            'allocated' => 'nullable|integer|min:0',
            'has_variations' => 'nullable',
            'variations' => 'nullable|array',
            'variations.*.id' => 'nullable|string', // Don't validate as UUID here, we'll do it manually
            'variations.*.name' => 'nullable|string|max:255',
            'variations.*.sku' => 'nullable|string|max:50',
            'variations.*.price' => 'nullable|numeric|min:0',
            'variations.*.cost' => 'nullable|numeric|min:0',
            // variations.*.stock_quantity is intentionally NOT accepted here either - same rule
            // applies to variant stock as to base product stock.
            'variations.*.store_id' => 'nullable|uuid|exists:stores,id',
            'variations.*.price_tiers' => 'nullable|array',
            'variations.*.price_tiers.*.id' => 'nullable|uuid',
            'variations.*.price_tiers.*.tier_name' => 'required|string|max:100',
            'variations.*.price_tiers.*.price' => 'required|numeric|min:0',
            'images' => 'nullable|array',
            'tags' => 'nullable|array',
            // Packaging fields
            'has_packaging' => 'nullable|boolean',
            'base_unit' => 'nullable|string|max:50',
            'packaging_units' => 'nullable|array',
            'packaging_units.*.unit_name' => 'required_with:packaging_units|string|max:100',
            'packaging_units.*.unit_abbreviation' => 'required_with:packaging_units|string|max:20',
            'packaging_units.*.base_unit_quantity' => 'required_with:packaging_units|numeric|min:0',
            'packaging_units.*.is_base_unit' => 'nullable|boolean',
            'packaging_units.*.is_sellable' => 'nullable|boolean',
            'packaging_units.*.is_purchasable' => 'nullable|boolean',
            'packaging_units.*.price_per_unit' => 'nullable|numeric|min:0',
            'packaging_units.*.cost_per_unit' => 'nullable|numeric|min:0',
            'packaging_units.*.display_order' => 'nullable|integer',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }
        try {
            Log::info('Starting product update', [
                'product_id' => $product->id,
                'has_variations' => $request->input('has_variations'),
                'variants_count' => is_array($request->input('variations')) ? count($request->input('variations')) : 0
            ]);

            $updateData = $request->only([
                'name',
                'description',
                'short_description',
                'price',
                'unit_cost',
                'shipping_cost',
                'logistics_cost',
                'margin_amount',
                'last_price',
                // NOTE: stock_quantity is deliberately excluded - quantity changes must go
                // through Stock Adjustment or Purchase Order receiving, never a product edit.
                'low_stock_threshold',
                'category',
                'category_id',
                'sku',
                'barcode',
                'brand',
                'supplier',
                'supplier_id',
                'unit_of_measurement',
                'is_featured',
                'is_digital',
                'is_taxable',
                'tax_rate',
                'hs_code',
                'track_inventory',
                'has_packaging',
                'base_unit',
                'weight',
                'length',
                'width',
                'height',
                'shipping_class',
                'image_url',
                'primary_image_index',
                'has_variations',
                'variations',
                'tags',
                'store_id',
                'on_hand',
                'allocated',
                'is_active'
            ]);

            // Explicitly handle boolean fields that might be false (request->only filters out false)
            $booleanFields = ['is_featured', 'is_digital', 'is_taxable', 'track_inventory', 'has_packaging', 'has_variations', 'is_active'];
            foreach ($booleanFields as $field) {
                if ($request->has($field)) {
                    $updateData[$field] = $request->input($field);
                    Log::info("Boolean field {$field} set", ['value' => $request->input($field), 'in_updateData' => $updateData[$field]]);
                }
            }

            // Auto-resolve/create a relational category from the free-text category name
            // if the caller didn't already supply a category_id.
            if (empty($updateData['category_id']) && !empty($updateData['category'])) {
                $updateData['category_id'] = $this->resolveCategoryId($product->company_id, $updateData['category']);
            }

            $priceErrors = $this->priceCodeConflicts(
                $product->company_id,
                (array) $request->input('price_tiers', []),
                $product->id
            );
            if (!empty($priceErrors)) {
                return response()->json([
                    'status' => 'failed',
                    'message' => implode(' ', $priceErrors),
                ], 422);
            }

            // Handle product images using ProductImageService
            $images = [];

            // Collect images from request (supports both file uploads and existing paths)
            if ($request->hasFile('images')) {
                $images = array_merge($images, $request->file('images'));
            }

            if ($request->has('images') && is_array($request->input('images'))) {
                $images = array_merge($images, $request->input('images'));
            }

            // Process all images through the service
            if (!empty($images)) {
                $updateData['images'] = $this->imageService->processImages($images, 'products');
            } elseif ($request->has('images')) {
                // If images key exists but is empty, clear images
                $updateData['images'] = [];
            }

            // Convert boolean fields explicitly for PostgreSQL (mutators don't trigger on mass assignment)
            $booleanFields = ['is_featured', 'is_digital', 'is_taxable', 'track_inventory', 'has_packaging', 'has_variations', 'is_active'];
            $booleanUpdates = [];
            foreach ($booleanFields as $field) {
                if (array_key_exists($field, $updateData)) {
                    $value = $updateData[$field];
                    // Store boolean values for separate raw update
                    $isTruthy = ($value === true || $value === 1 || $value === '1' || $value === 'true');
                    $booleanUpdates[$field] = $isTruthy ? 'true' : 'false';
                    // Remove from regular update to avoid type mismatch
                    unset($updateData[$field]);
                }
            }

            // Update non-boolean fields first
            if (!empty($updateData)) {
                $product->update($updateData);
            }

            // Update boolean fields using raw SQL to avoid PDO type issues
            if (!empty($booleanUpdates)) {
                $setClauses = [];
                foreach ($booleanUpdates as $field => $value) {
                    $setClauses[] = "\"{$field}\" = {$value}";
                }
                $setString = implode(', ', $setClauses);
                DB::statement("UPDATE products SET {$setString}, updated_at = NOW() WHERE id = ?", [$product->id]);
                $product->refresh();
            }
            // Handle variants - distinguish between existing and new variants
            // Process variations if: explicitly passed has_variations=true OR product already has variations in DB
            $shouldProcessVariations = $request->input('has_variations') || $product->has_variations;
            if ($shouldProcessVariations && is_array($request->input('variations'))) {
                Log::info('Processing variants in update', [
                    'variants_count' => count($request->input('variations')),
                    'has_files' => $request->hasFile('variations'),
                    'all_files' => array_keys($request->allFiles())
                ]);

                $keptVariantIds = [];
                foreach ($request->input('variations') as $index => $variantData) {
                    // Handle variant images using ProductImageService
                    $variantImages = [];

                    // Collect images from request (supports both file uploads and existing paths)
                    if ($request->hasFile("variations.{$index}.images")) {
                        $uploadedFiles = $request->file("variations.{$index}.images");
                        $variantImages = array_merge($variantImages, is_array($uploadedFiles) ? $uploadedFiles : [$uploadedFiles]);
                    }

                    if (isset($variantData['images']) && is_array($variantData['images'])) {
                        $variantImages = array_merge($variantImages, $variantData['images']);
                    }

                    // Process all variant images through the service
                    if (!empty($variantImages)) {
                        $variantData['images'] = $this->imageService->processImages($variantImages, 'product-variants');
                    }

                    // Quantity may only change via Stock Adjustment or Purchase Order receiving,
                    // never through a product edit - strip it even if the client sent it.
                    unset($variantData['stock_quantity']);

                    // Skip empty or incomplete variants
                    if (
                        empty($variantData) ||
                        (empty($variantData['name']) && empty($variantData['sku']) && empty($variantData['price']))
                    ) {
                        continue;
                    }
                    $variantTiers = $variantData['price_tiers'] ?? null;
                    unset($variantData['price_tiers']);
                    $variant = null;
                    $variantId = $variantData['id'] ?? null;
                    if ($variantId) {
                        // Check if this is a valid UUID and exists in database
                        if ($this->isValidUuid($variantId)) {
                            $variant = ProductVariant::where('id', $variantId)
                                ->where('product_id', $product->id)
                                ->first();

                            if ($variant) {
                                // Update existing variant
                                $updateData = $variantData;
                                unset($updateData['id']);

                                Log::info('Updating variant with data', [
                                    'variant_id' => $variantId,
                                    'has_images' => isset($updateData['images']),
                                    'images_count' => isset($updateData['images']) ? count($updateData['images']) : 0,
                                    'images' => $updateData['images'] ?? null
                                ]);

                                $variant->update($updateData);

                                Log::info('Updated existing variant', [
                                    'variant_id' => $variantId,
                                    'product_id' => $product->id,
                                    'stored_images' => $variant->images
                                ]);
                            } else {
                                // Valid UUID but variant doesn't exist - treat as new variant
                                Log::info('Valid UUID but variant not found, creating new variant', [
                                    'variant_id' => $variantId,
                                    'product_id' => $product->id
                                ]);
                                $variant = $this->createNewVariant($variantData, $product);
                            }
                        } else {
                            // Invalid UUID format - this is likely a temporary frontend ID, create new variant
                            Log::info('Invalid UUID format detected, creating new variant', [
                                'temp_id' => $variantId,
                                'product_id' => $product->id
                            ]);
                            $variant = $this->createNewVariant($variantData, $product);
                        }
                    } else {
                        // No ID provided - create new variant
                        Log::info('No ID provided, creating new variant', [
                            'product_id' => $product->id
                        ]);
                        $variant = $this->createNewVariant($variantData, $product);
                    }
                    $this->syncPriceTiers($product, $variantTiers, $variant);
                    if ($variant) {
                        $keptVariantIds[] = $variant->id;
                    }
                }

                $this->pruneRemovedVariants($product, $keptVariantIds);
            }
            // Clean up any variants that might have been left in an invalid state
            $this->cleanupInvalidVariants($product);

            // Handle packaging units if provided
            $packagingResult = null;
            if ($request->has('has_packaging')) {
                $hasPackaging = filter_var($request->input('has_packaging'), FILTER_VALIDATE_BOOLEAN);

                // If disabling packaging
                if (!$hasPackaging && $product->has_packaging) {
                    $packagingResult = $this->packagingService->disableProductPackaging($product);
                }

                // If enabling packaging with units
                if ($hasPackaging && $request->has('packaging_units')) {
                    $packagingUnits = $request->input('packaging_units');

                    if (!empty($packagingUnits) && is_array($packagingUnits)) {
                        // Remove existing packaging first if any - force delete to avoid unique constraint issues
                        ProductPackagingUnit::where('product_id', $product->id)->delete();

                        // Setup new packaging
                        $packagingResult = $this->packagingService->setupProductPackaging($product, $packagingUnits);

                        if (!$packagingResult['success']) {
                            Log::warning('Packaging update failed for product', [
                                'product_id' => $product->id,
                                'error' => $packagingResult['message']
                            ]);
                        }
                    }
                }
            }

            // Conditionally load variants based on has_variations
            if ($product->has_variations) {
                $product->load('variants.priceTiers');
            }
            $product->load(['category', 'supplier']);

            // Load packaging units if configured
            if ($product->has_packaging) {
                $product->load('packagingUnits');
            }

            // Sync price tiers if provided
            if ($request->has('price_tiers')) {
                $this->syncPriceTiers($product, $request->input('price_tiers'));
            }
            $product->load('priceTiers');

            $response = [
                'status' => 'success',
                'message' => 'Product updated successfully.',
                'product' => $product,
            ];

            if ($packagingResult) {
                $response['packaging'] = $packagingResult;
            }

            return response()->json($response, 200);
        } catch (\Exception $e) {
            Log::error('Failed to update product', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to update product: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function destroy(Request $request, $id)
    {
        $product = Product::find($id);
        if (!$product) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Product not found.',
            ], 404);
        }
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_delete_products', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to delete products.',
            ], 403);
        }
        if (!$this->hasPermission($request, "can_delete_products", $product->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to delete this product.',
            ], 403);
        }
        try {
            // Keep variants intact so historic orders and dispatches retain their detail.
            $product->delete();
            return response()->json([
                'status' => 'success',
                'message' => 'Product soft-deleted successfully.',
            ], 200);
        } catch (\Exception $e) {
            Log::error('Failed to delete product', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to delete product: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get product summary statistics for the company
     */
    public function getProductSummary(Request $request)
    {
        $user = $request->user();
        $companyId = $user->company_id;

        if (!$this->hasPermission($request, 'can_view_products', $companyId)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view product summary.',
            ], 403);
        }

        try {
            $storeId = $request->get('store_id');

            // Base query for company products
            $baseQuery = Product::where('company_id', $companyId);

            // Filter by store if provided
            if ($storeId) {
                $baseQuery->where('store_id', $storeId);
            }

            // Total products count
            $totalProducts = (clone $baseQuery)->count();

            // Active products count - using scope for PostgreSQL compatibility
            $activeProducts = (clone $baseQuery)->active()->count();

            // Low stock products (where stock_quantity <= low_stock_threshold)
            $lowStockProducts = (clone $baseQuery)
                ->whereColumn('stock_quantity', '<=', 'low_stock_threshold')
                ->whereRaw('track_inventory = true')
                ->count();

            // Out of stock products
            $outOfStockProducts = (clone $baseQuery)
                ->where('stock_quantity', 0)
                ->whereRaw('track_inventory = true')
                ->count();

            // Total inventory value (stock_quantity * unit_cost)
            $totalInventoryValue = (clone $baseQuery)
                ->selectRaw('SUM(stock_quantity * COALESCE(unit_cost, 0)) as total_value')
                ->value('total_value') ?? 0;

            // Total potential value (stock_quantity * price)
            $totalPotentialValue = (clone $baseQuery)
                ->selectRaw('SUM(stock_quantity * COALESCE(price, 0)) as total_value')
                ->value('total_value') ?? 0;

            // Products by category (top 5)
            $productsByCategory = Product::where('products.company_id', $companyId)
                ->when($storeId, function ($query) use ($storeId) {
                    return $query->where('products.store_id', $storeId);
                })
                ->join('product_categories', function ($join) use ($companyId) {
                    $join->on('products.category_id', '=', 'product_categories.id')
                        ->where('product_categories.company_id', $companyId);
                })
                ->select('product_categories.name as category_name', DB::raw('COUNT(*) as product_count'))
                ->groupBy('product_categories.id', 'product_categories.name')
                ->orderBy('product_count', 'desc')
                ->limit(5)
                ->get();

            // Recently added products (last 7 days)
            $recentlyAddedCount = (clone $baseQuery)
                ->where('created_at', '>=', now()->subDays(7))
                ->count();

            // Featured products count - using scope for PostgreSQL compatibility
            $featuredProducts = (clone $baseQuery)->featured()->count();

            // Digital products count
            $digitalProducts = (clone $baseQuery)->whereRaw('is_digital = true')->count();

            // Products with variations count
            $productsWithVariations = (clone $baseQuery)->whereRaw('has_variations = true')->count();

            return response()->json([
                'status' => 'success',
                'message' => 'Product summary retrieved successfully.',
                'data' => [
                    'overview' => [
                        'total_products' => $totalProducts,
                        'active_products' => $activeProducts,
                        'inactive_products' => $totalProducts - $activeProducts,
                        'featured_products' => $featuredProducts,
                        'digital_products' => $digitalProducts,
                        'products_with_variations' => $productsWithVariations,
                        'recently_added' => $recentlyAddedCount,
                    ],
                    'inventory' => [
                        'low_stock_products' => $lowStockProducts,
                        'out_of_stock_products' => $outOfStockProducts,
                        'total_inventory_value' => round($totalInventoryValue, 2),
                        'total_potential_value' => round($totalPotentialValue, 2),
                        'potential_profit' => round($totalPotentialValue - $totalInventoryValue, 2),
                    ],
                    'categories' => [
                        'top_categories' => $productsByCategory,
                        'categories_count' => $productsByCategory->count(),
                    ],
                    'filters' => [
                        'store_id' => $storeId,
                        'company_id' => $companyId,
                    ],
                    'generated_at' => now()->toISOString(),
                ]
            ], 200);
        } catch (\Exception $e) {
            Log::error('Failed to get product summary', [
                'error' => $e->getMessage(),
                'company_id' => $companyId,
                'store_id' => $storeId
            ]);

            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to retrieve product summary: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function bulkStore(Request $request)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_create_products', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to create products.',
            ], 403);
        }
        $productsData = $request->input('products');
        if (!is_array($productsData) || empty($productsData)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'No products provided or invalid format.',
            ], 400);
        }
        foreach ($productsData as $row) {
            if (filter_var($row['has_variations'] ?? false, FILTER_VALIDATE_BOOLEAN)) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Product variations are no longer supported. List each variation as its own product row.',
                ], 422);
            }
        }
        $created = [];
        $errors = [];
        // Group products by main product SKU
        $grouped = [];
        foreach ($productsData as $row) {
            // Always group by the main product SKU
            $groupKey = $row['sku'] ?? $row['name'];

            // Determine if this product should have variations
            $hasVariations = isset($row['has_variations']) && filter_var($row['has_variations'], FILTER_VALIDATE_BOOLEAN);

            if (!isset($grouped[$groupKey])) {
                // Initialize product data - use the first row as base product data
                $grouped[$groupKey] = $row;
                $grouped[$groupKey]['variations'] = [];
                $grouped[$groupKey]['has_variations'] = $hasVariations;

                Log::info('Initializing product group', [
                    'group_key' => $groupKey,
                    'product_name' => $row['name'],
                    'product_sku' => $row['sku'],
                    'has_variations' => $hasVariations
                ]);
            }

            // If this product has variations, add each row as a variant
            if ($hasVariations) {
                $grouped[$groupKey]['has_variations'] = true;

                // Create variant from current row data
                $variantData = [
                    'name' => $row['variant_name'] ?? null,
                    'sku' => $row['variant_sku'] ?? null,
                    'price' => isset($row['variant_price']) ? (float) $row['variant_price'] : null,
                    'cost' => isset($row['variant_cost']) ? (float) $row['variant_cost'] : null,
                    'stock_quantity' => isset($row['variant_stock_quantity']) ? (int) $row['variant_stock_quantity'] : null,
                    'on_hand' => isset($row['variant_on_hand']) ? (int) $row['variant_on_hand'] : null,
                    'allocated' => isset($row['variant_allocated']) ? (int) $row['variant_allocated'] : null,
                    'options' => isset($row['variant_options']) && is_array($row['variant_options']) ? $row['variant_options'] : [],
                    'images' => isset($row['variant_images']) && is_array($row['variant_images']) ? $row['variant_images'] : [],
                    'attributes' => isset($row['variant_attributes']) && is_array($row['variant_attributes']) ? $row['variant_attributes'] : [],
                    'store_id' => $row['variant_store_id'] ?? $row['store_id'] ?? null,
                ];

                $grouped[$groupKey]['variations'][] = $variantData;

                Log::info('Added variant to product group', [
                    'group_key' => $groupKey,
                    'variant_sku' => $variantData['sku'],
                    'variant_name' => $variantData['name'],
                    'variant_count' => count($grouped[$groupKey]['variations'])
                ]);
            }
        }
        // Clean up grouped products and ensure proper variant structure
        foreach ($grouped as $groupKey => &$product) {
            if ($product['has_variations'] && count($product['variations']) > 0) {
                // Clear base product stock fields when using variants
                $product['stock_quantity'] = null;
                $product['on_hand'] = null;
                $product['allocated'] = null;

                Log::info('Product with variants finalized', [
                    'group_key' => $groupKey,
                    'product_name' => $product['name'] ?? 'Unknown',
                    'product_sku' => $product['sku'] ?? 'Unknown',
                    'variant_count' => count($product['variations']),
                    'base_price' => $product['price'] ?? 0
                ]);
            } else {
                // Ensure has_variations is false for products without variants
                $product['has_variations'] = false;
                $product['variations'] = [];

                Log::info('Single product (no variants) finalized', [
                    'group_key' => $groupKey,
                    'product_name' => $product['name'] ?? 'Unknown',
                    'product_sku' => $product['sku'] ?? 'Unknown'
                ]);
            }
        }
        unset($product);
        $finalProducts = array_values($grouped);
        DB::beginTransaction();
        try {
            foreach ($finalProducts as $index => $productData) {
                $validator = Validator::make($productData, [
                    'name' => 'required|string|max:255',
                    'price' => 'nullable|numeric|min:0',
                    'unit_cost' => 'nullable|numeric|min:0',
                    'stock_quantity' => 'nullable|integer|min:0',
                    'category' => 'nullable|string|max:255',
                    'category_id' => 'nullable|uuid|exists:product_categories,id',
                    'sku' => 'nullable|string|max:255',
                    'barcode' => 'nullable|string|max:255',
                    'brand' => 'nullable|string|max:255',
                    'supplier' => 'nullable|string|max:255',
                    'supplier_id' => 'nullable|uuid|exists:suppliers,id',
                    'unit_of_measurement' => 'nullable|string|max:50',
                    'is_active' => 'nullable',
                    'is_featured' => 'nullable',
                    'is_digital' => 'nullable',
                    'is_taxable' => 'nullable|boolean',
                    'tax_rate' => 'nullable|numeric|min:0|max:100',
                    'hs_code' => 'nullable|string|max:20',
                    'track_inventory' => 'nullable',
                    'store_id' => 'nullable|uuid|exists:stores,id',
                    'on_hand' => 'nullable|integer|min:0',
                    'allocated' => 'nullable|integer|min:0',
                    'has_variations' => 'nullable',
                    'variations' => 'nullable|array',
                    'images' => 'nullable|array',
                    'tags' => 'nullable|array',
                ]);
                if ($validator->fails()) {
                    $errors[] = [
                        'index' => $index,
                        'name' => $productData['name'] ?? null,
                        'message' => $validator->errors(),
                    ];
                    continue;
                }
                $productData['images'] = isset($productData['images']) && is_array($productData['images']) ? $productData['images'] : [];
                $productData['tags'] = isset($productData['tags']) && is_array($productData['tags']) ? $productData['tags'] : [];
                $productData['variations'] = isset($productData['variations']) && is_array($productData['variations']) ? $productData['variations'] : [];

                if (!empty($productData['has_variations']) && is_array($productData['variations']) && count($productData['variations']) > 0) {
                    foreach ($productData['variations'] as &$variantData) {
                        $variantData['options'] = isset($variantData['options']) && is_array($variantData['options']) ? $variantData['options'] : [];
                        $variantData['images'] = isset($variantData['images']) && is_array($variantData['images']) ? $variantData['images'] : [];
                    }
                    unset($variantData);
                }

                // Helper to convert boolean values to proper PHP booleans
                // Laravel's casts will handle conversion to PostgreSQL booleans
                $toBool = function ($value, $default = false) {
                    if ($value === null) {
                        return $default;
                    }
                    return filter_var($value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) ?? $default;
                };

                // Auto-resolve/create a relational category from the free-text category name
                // if this row didn't already supply a category_id.
                if (empty($productData['category_id']) && !empty($productData['category'])) {
                    $productData['category_id'] = $this->resolveCategoryId($user->company_id, $productData['category']);
                }

                // Create product with proper boolean values
                $product = Product::create([
                    'id' => (string) Str::uuid(),
                    'company_id' => $user->company_id,
                    'store_id' => $productData['store_id'] ?? null,
                    'product_number' => $this->generateProductNumber($user->company_id),
                    'name' => $productData['name'] ?? null,
                    'description' => $productData['description'] ?? null,
                    'short_description' => $productData['short_description'] ?? null,
                    'price' => $productData['price'] ?? null,
                    'unit_cost' => $productData['unit_cost'] ?? null,
                    'shipping_cost' => $productData['shipping_cost'] ?? 0,
                    'logistics_cost' => $productData['logistics_cost'] ?? 0,
                    'margin_amount' => $productData['margin_amount'] ?? 0,
                    'last_price' => $productData['last_price'] ?? null,
                    'stock_quantity' => $productData['stock_quantity'] ?? 0,
                    'low_stock_threshold' => $productData['low_stock_threshold'] ?? 10,
                    'category' => $productData['category'] ?? null,
                    'category_id' => $productData['category_id'] ?? null,
                    'sku' => $productData['sku'] ?? null,
                    'barcode' => $productData['barcode'] ?? null,
                    'brand' => $productData['brand'] ?? null,
                    'supplier' => $productData['supplier'] ?? null,
                    'supplier_id' => $productData['supplier_id'] ?? null,
                    'unit_of_measurement' => $productData['unit_of_measurement'] ?? null,
                    'is_featured' => $toBool($productData['is_featured'] ?? null, false),
                    'is_digital' => $toBool($productData['is_digital'] ?? null, false),
                    'is_taxable' => $toBool($productData['is_taxable'] ?? null, true),
                    'tax_rate' => $productData['tax_rate'] ?? null,
                    'hs_code' => $productData['hs_code'] ?? null,
                    'track_inventory' => $toBool($productData['track_inventory'] ?? null, true),
                    'has_packaging' => $toBool($productData['has_packaging'] ?? null, false),
                    'weight' => $productData['weight'] ?? null,
                    'length' => $productData['length'] ?? null,
                    'width' => $productData['width'] ?? null,
                    'height' => $productData['height'] ?? null,
                    'shipping_class' => $productData['shipping_class'] ?? null,
                    'image_url' => $productData['image_url'] ?? null,
                    'images' => $productData['images'] ?? [],
                    'primary_image_index' => $productData['primary_image_index'] ?? 0,
                    'has_variations' => $toBool($productData['has_variations'] ?? null, false),
                    'tags' => $productData['tags'] ?? null,
                    'on_hand' => $productData['on_hand'] ?? 0,
                    'allocated' => $productData['allocated'] ?? 0,
                    'is_active' => $toBool($productData['is_active'] ?? null, true),
                ]);
                if (!empty($productData['has_variations']) && is_array($productData['variations']) && count($productData['variations']) > 0) {
                    Log::info('Creating variants for product', [
                        'product_id' => $product->id,
                        'product_name' => $product->name,
                        'variant_count' => count($productData['variations'])
                    ]);

                    foreach ($productData['variations'] as $variantIndex => $variantData) {
                        // Skip completely empty variants
                        if (
                            empty($variantData['name']) && empty($variantData['sku']) &&
                            !isset($variantData['price']) && !isset($variantData['cost']) &&
                            !isset($variantData['stock_quantity'])
                        ) {
                            Log::warning('Skipping empty variant', [
                                'product_id' => $product->id,
                                'variant_index' => $variantIndex
                            ]);
                            continue;
                        }

                        // Ensure numeric fields are properly cast (including 0 values)
                        $variantData['price'] = isset($variantData['price']) ? (float) $variantData['price'] : null;
                        $variantData['cost'] = isset($variantData['cost']) ? (float) $variantData['cost'] : null;
                        $variantData['stock_quantity'] = isset($variantData['stock_quantity']) ? (int) $variantData['stock_quantity'] : null;
                        $variantData['on_hand'] = isset($variantData['on_hand']) ? (int) $variantData['on_hand'] : null;
                        $variantData['allocated'] = isset($variantData['allocated']) ? (int) $variantData['allocated'] : null;

                        // Ensure boolean fields are properly cast for PostgreSQL
                        if (isset($variantData['is_active'])) {
                            $variantData['is_active'] = ($variantData['is_active'] === true ||
                                $variantData['is_active'] === 1 ||
                                $variantData['is_active'] === '1' ||
                                $variantData['is_active'] === 'true');
                        }

                        $variant = ProductVariant::create(array_merge($variantData, [
                            'id' => (string) Str::uuid(),
                            'product_id' => $product->id,
                            'company_id' => $user->company_id,
                        ]));

                        Log::info('Variant created successfully', [
                            'variant_id' => $variant->id,
                            'product_id' => $product->id,
                            'variant_name' => $variant->name,
                            'variant_price' => $variant->price,
                            'variant_sku' => $variant->sku
                        ]);
                    }
                }

                // Conditionally load variants based on has_variations
                if ($product->has_variations) {
                    $product->load('variants.priceTiers');
                }
                $product->load(['category', 'supplier']);

                $created[] = $product;
            }
            DB::commit();
            return response()->json([
                'status' => empty($errors) ? 'success' : 'partial',
                'message' => empty($errors) ? 'All products created successfully.' : 'Some products could not be created.',
                'products' => $created,
                'errors' => $errors,
            ], empty($errors) ? 201 : 207);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Bulk product creation failed', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Bulk product creation failed: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Validate if a string is a valid UUID format
     */
    protected function isValidUuid($uuid)
    {
        if (!is_string($uuid)) {
            return false;
        }

        return preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i', $uuid) === 1;
    }

    /**
     * Clean up invalid variants for a product
     */
    /**
     * Sizes dropped from the edit form. One that still holds stock or has batches is only
     * deactivated - deleting it would orphan batches that dispatch and stock history rely on.
     */
    protected function pruneRemovedVariants(Product $product, array $keptIds): void
    {
        $removed = ProductVariant::where('product_id', $product->id)
            ->whereNotIn('id', $keptIds)
            ->get();

        foreach ($removed as $variant) {
            if ($variant->stock_quantity > 0 || $variant->inventoryBatches()->exists()) {
                $variant->update(['is_active' => false]);
                continue;
            }
            ProductPriceTier::where('variant_id', $variant->id)->delete();
            $variant->delete();
        }
    }

    protected function cleanupInvalidVariants(Product $product)
    {
        // Remove variants that have no meaningful data
        $deletedCount = ProductVariant::where('product_id', $product->id)
            ->where(function ($query) {
                $query->whereNull('name')
                    ->whereNull('sku')
                    ->whereNull('price');
            })
            ->delete();

        if ($deletedCount > 0) {
            Log::info('Cleaned up invalid variants', [
                'product_id' => $product->id,
                'deleted_count' => $deletedCount
            ]);
        }
    }

    /**
     * Create a new variant for a product
     */
    protected function createNewVariant(array $variantData, Product $product)
    {
        // Remove any temporary or invalid ID
        $newVariantData = $variantData;
        unset($newVariantData['id']);

        // Ensure numeric fields are properly cast (including 0 values)
        if (isset($newVariantData['price'])) {
            $newVariantData['price'] = (float) $newVariantData['price'];
        }
        if (isset($newVariantData['cost'])) {
            $newVariantData['cost'] = (float) $newVariantData['cost'];
        }
        if (isset($newVariantData['stock_quantity'])) {
            $newVariantData['stock_quantity'] = (int) $newVariantData['stock_quantity'];
        }
        if (isset($newVariantData['on_hand'])) {
            $newVariantData['on_hand'] = (int) $newVariantData['on_hand'];
        }
        if (isset($newVariantData['allocated'])) {
            $newVariantData['allocated'] = (int) $newVariantData['allocated'];
        }

        // Ensure boolean fields are properly cast for PostgreSQL
        if (isset($newVariantData['is_active'])) {
            $newVariantData['is_active'] = ($newVariantData['is_active'] === true ||
                $newVariantData['is_active'] === 1 ||
                $newVariantData['is_active'] === '1' ||
                $newVariantData['is_active'] === 'true');
        }

        // Ensure required fields are set
        $newVariantData = array_merge([
            'id' => (string) Str::uuid(),
            'product_id' => $product->id,
            'company_id' => $product->company_id,
            'store_id' => $variantData['store_id'] ?? $product->store_id,
        ], $newVariantData);

        Log::info('Creating new variant', [
            'product_id' => $product->id,
            'variant_name' => $newVariantData['name'] ?? 'No name',
            'variant_price' => $newVariantData['price'] ?? 'No price',
            'variant_sku' => $newVariantData['sku'] ?? 'No SKU',
            'is_active' => $newVariantData['is_active'] ?? 'Not set'
        ]);

        return ProductVariant::create($newVariantData);
    }

    // ========================================
    // INVENTORY MANAGEMENT METHODS
    // ========================================

    /**
     * Get inventory summary for company products
     */
    public function getInventorySummary(Request $request)
    {
        try {
            $user = $request->user();
            $companyId = $user->company_id;

            if (!$this->hasPermission($request, 'can_view_products', $companyId)) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $storeId = $request->get('store_id');

            // Get batch-level inventory summary
            $batchQuery = InventoryBatch::forCompany($companyId);
            if ($storeId) {
                $batchQuery->forStore($storeId);
            }

            $batchSummary = [
                'total_batches' => $batchQuery->count(),
                'active_batches' => $batchQuery->active()->count(),
                'expired_batches' => $batchQuery->expired()->count(),
                'expiring_soon' => $batchQuery->expiringSoon(30)->count(),
                'batch_total_quantity' => $batchQuery->sum('quantity_available'),
                'batch_total_allocated' => $batchQuery->sum('quantity_allocated'),
                'batch_total_value' => $batchQuery->selectRaw('SUM(quantity_available * unit_cost)')->value('SUM(quantity_available * unit_cost)') ?? 0,
            ];

            // Get product-level inventory summary
            $productQuery = Product::forCompany($companyId);
            if ($storeId) {
                $productQuery->where('store_id', $storeId);
            }

            $productSummary = [
                'total_products' => $productQuery->count(),
                'active_products' => $productQuery->active()->count(),
                'tracked_products' => $productQuery->where('track_inventory', true)->count(),
                'low_stock_products' => $productQuery->whereRaw('stock_quantity <= low_stock_threshold')->count(),
                'out_of_stock_products' => $productQuery->where('stock_quantity', 0)->count(),
                'total_stock_value' => $productQuery->selectRaw('SUM(stock_quantity * unit_cost)')->value('SUM(stock_quantity * unit_cost)') ?? 0,
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
                'status' => 'success',
                'data' => [
                    'batch_summary' => $batchSummary,
                    'product_summary' => $productSummary,
                    'recent_movements' => $recentMovements
                ]
            ]);
        } catch (\Exception $e) {
            return $this->handleDatabaseError($e, 'fetching inventory summary');
        }
    }

    /**
     * Get all inventory batches for company products
     */
    public function getInventoryBatches(Request $request)
    {
        try {
            $user = $request->user();
            $companyId = $user->company_id;

            if (!$this->hasPermission($request, 'can_view_products', $companyId)) {
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

            if ($request->boolean('in_stock')) {
                $query->where('quantity_available', '>', 0);
            }

            // Sorting
            $sortBy = $request->get('sort_by', 'created_at');
            $sortOrder = $request->get('sort_order', 'desc');
            $query->orderBy($sortBy, $sortOrder);

            $batches = $query->paginate($request->get('per_page', 15));

            return response()->json([
                'status' => 'success',
                'data' => $batches
            ]);
        } catch (\Exception $e) {
            return $this->handleDatabaseError($e, 'fetching inventory batches');
        }
    }

    /**
     * Create a new inventory batch for a product
     */
    public function createInventoryBatch(Request $request, $productId)
    {
        $user = $request->user();
        $companyId = $user->company_id;

        // Check if product exists and belongs to company
        $product = Product::forCompany($companyId)->findOrFail($productId);

        if (!$this->hasPermission($request, 'can_update_products', $companyId)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validator = Validator::make($request->all(), [
            'store_id' => 'nullable|exists:stores,id',
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
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(), 'errors' => $validator->errors()
            ], 422);
        }

        try {
            DB::beginTransaction();

            // Generate batch number if not provided
            $batchNumber = $request->batch_number ?? InventoryBatch::generateBatchNumber($companyId, $productId);

            // Check for duplicate batch number
            $existingBatch = InventoryBatch::where('batch_number', $batchNumber)->first();
            if ($existingBatch) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Batch number already exists'
                ], 422);
            }

            $batch = InventoryBatch::create([
                'company_id' => $companyId,
                'store_id' => $request->store_id ?? $product->store_id,
                'product_id' => $productId,
                'variant_id' => $request->variant_id,
                'batch_number' => $batchNumber,
                'lot_number' => $request->lot_number,
                'serial_number' => $request->serial_number,
                'quantity_received' => $request->quantity_received,
                'quantity_available' => $request->quantity_received,
                'manufacture_date' => $request->manufacture_date,
                'expiry_date' => $request->expiry_date,
                'received_date' => $request->received_date,
                'unit_cost' => $request->unit_cost ?? $product->unit_cost,
                'selling_price' => $request->selling_price ?? $product->price,
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
                'store_id' => $request->store_id ?? $product->store_id,
                'product_id' => $productId,
                'variant_id' => $request->variant_id,
                'batch_id' => $batch->id,
                'quantity' => $request->quantity_received,
                'quantity_before' => 0,
                'quantity_after' => $request->quantity_received,
                'unit_cost' => $request->unit_cost ?? $product->unit_cost,
                'unit_price' => $request->selling_price ?? $product->price,
                'total_cost' => $request->quantity_received * ($request->unit_cost ?? $product->unit_cost ?? 0),
                'reference_type' => $request->product_receipt_id ? 'product_receipt' : 'manual',
                'reference_id' => $request->product_receipt_id,
                'reference_number' => $request->purchase_order_number,
                'created_by' => $user->id,
                'notes' => 'Initial batch receipt',
            ]);

            // Update product stock quantities
            $this->updateProductStock($productId, $request->variant_id, $request->quantity_received);

            DB::commit();

            return response()->json([
                'status' => 'success',
                'message' => 'Inventory batch created successfully',
                'data' => $batch->load(['product', 'variant', 'store', 'supplier'])
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to create inventory batch', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to create inventory batch',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get specific batch details
     */
    public function getInventoryBatch(Request $request, $productId, $batchId)
    {
        try {
            $user = $request->user();
            $companyId = $user->company_id;

            // Check product belongs to company
            Product::forCompany($companyId)->findOrFail($productId);

            if (!$this->hasPermission($request, 'can_view_products', $companyId)) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $batch = InventoryBatch::with([
                'product',
                'variant',
                'store',
                'supplier',
                'productReceipt',
                'movements' => function ($query) {
                    $query->with(['createdBy'])->orderBy('movement_date', 'desc');
                }
            ])
                ->forCompany($companyId)
                ->where('product_id', $productId)
                ->findOrFail($batchId);

            return response()->json([
                'status' => 'success',
                'data' => $batch
            ]);
        } catch (\Exception $e) {
            return $this->handleDatabaseError($e, 'fetching inventory batch');
        }
    }

    /**
     * Update inventory batch
     */
    public function updateInventoryBatch(Request $request, $productId, $batchId)
    {
        $user = $request->user();
        $companyId = $user->company_id;

        // Check product belongs to company
        Product::forCompany($companyId)->findOrFail($productId);

        if (!$this->hasPermission($request, 'can_update_products', $companyId)) {
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
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(), 'errors' => $validator->errors()
            ], 422);
        }

        try {
            $batch = InventoryBatch::forCompany($companyId)
                ->where('product_id', $productId)
                ->findOrFail($batchId);

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
                'status' => 'success',
                'message' => 'Inventory batch updated successfully',
                'data' => $batch->load(['product', 'variant', 'store', 'supplier'])
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to update inventory batch', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to update inventory batch',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Allocate quantity from batch (for orders/reservations)
     */
    public function allocateInventoryBatch(Request $request, $productId, $batchId)
    {
        $user = $request->user();
        $companyId = $user->company_id;

        // Check product belongs to company
        Product::forCompany($companyId)->findOrFail($productId);

        if (!$this->hasPermission($request, 'can_update_products', $companyId)) {
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
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(), 'errors' => $validator->errors()
            ], 422);
        }

        try {
            $batch = InventoryBatch::forCompany($companyId)
                ->where('product_id', $productId)
                ->findOrFail($batchId);

            if (!$batch->canAllocate($request->quantity)) {
                return response()->json([
                    'status' => 'failed',
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
                'status' => 'success',
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
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to allocate quantity',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Record sale from batch
     */
    public function recordBatchSale(Request $request, $productId, $batchId)
    {
        $user = $request->user();
        $companyId = $user->company_id;

        // Check product belongs to company
        Product::forCompany($companyId)->findOrFail($productId);

        if (!$this->hasPermission($request, 'can_update_products', $companyId)) {
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
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(), 'errors' => $validator->errors()
            ], 422);
        }

        try {
            $batch = InventoryBatch::forCompany($companyId)
                ->where('product_id', $productId)
                ->findOrFail($batchId);

            if ($batch->quantity_allocated < $request->quantity) {
                return response()->json([
                    'status' => 'failed',
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
                'status' => 'success',
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
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to record sale',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Make inventory adjustment on batch
     */
    public function adjustInventoryBatch(Request $request, $productId, $batchId)
    {
        $user = $request->user();
        $companyId = $user->company_id;

        // Check product belongs to company
        Product::forCompany($companyId)->findOrFail($productId);

        if (!$this->hasPermission($request, 'can_update_products', $companyId)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validator = Validator::make($request->all(), [
            'adjustment_quantity' => 'required|integer',
            'adjustment_type' => 'required|in:available,damaged,expired',
            'reason' => 'required|string',
            'notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(), 'errors' => $validator->errors()
            ], 422);
        }

        try {
            $batch = InventoryBatch::forCompany($companyId)
                ->where('product_id', $productId)
                ->findOrFail($batchId);

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
                        return response()->json([
                            'status' => 'failed',
                            'message' => 'Insufficient available quantity for damage adjustment'
                        ], 422);
                    }
                    $batch->quantity_available -= abs($adjustmentQuantity);
                    $batch->quantity_damaged += abs($adjustmentQuantity);
                    break;
                case 'expired':
                    if ($batch->quantity_available < abs($adjustmentQuantity)) {
                        return response()->json([
                            'status' => 'failed',
                            'message' => 'Insufficient available quantity for expiry adjustment'
                        ], 422);
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
                'status' => 'success',
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
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to make inventory adjustment',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get inventory movements for all products or specific product
     */
    public function getInventoryMovements(Request $request, $productId = null)
    {
        try {
            $user = $request->user();
            $companyId = $user->company_id;

            if (!$this->hasPermission($request, 'can_view_products', $companyId)) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $query = InventoryMovement::with(['product', 'variant', 'batch', 'store', 'createdBy'])
                ->forCompany($companyId);

            // Filter by specific product if provided
            if ($productId) {
                Product::forCompany($companyId)->findOrFail($productId); // Ensure product exists
                $query->forProduct($productId, $request->variant_id);
            }

            // Additional filters
            if ($request->has('store_id')) {
                $query->forStore($request->store_id);
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

            return response()->json([
                'status' => 'success',
                'message' => $productId ?
                    "Inventory movements for product ID {$productId}" :
                    "All inventory movements",
                'data' => $movements
            ]);
        } catch (\Exception $e) {
            return $this->handleDatabaseError($e, 'fetching inventory movements');
        }
    }

    /**
     * Get expiring batches for all products or specific product
     */
    public function getExpiringBatches(Request $request, $productId = null)
    {
        try {
            $user = $request->user();
            $companyId = $user->company_id;

            if (!$this->hasPermission($request, 'can_view_products', $companyId)) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $days = $request->get('days', 30);
            $storeId = $request->get('store_id');

            $query = InventoryBatch::with(['product', 'variant', 'store'])
                ->forCompany($companyId)
                ->expiringSoon($days)
                ->available();

            if ($productId) {
                Product::forCompany($companyId)->findOrFail($productId); // Ensure product exists
                $query->where('product_id', $productId);
            }

            if ($storeId) {
                $query->forStore($storeId);
            }

            $expiringBatches = $query->orderBy('expiry_date', 'asc')->get();

            return response()->json([
                'status' => 'success',
                'message' => $productId ?
                    "Batches for product expiring within {$days} days" :
                    "All batches expiring within {$days} days",
                'data' => $expiringBatches,
                'count' => $expiringBatches->count()
            ]);
        } catch (\Exception $e) {
            return $this->handleDatabaseError($e, 'fetching expiring batches');
        }
    }

    /**
     * Get batch availability for a specific product
     */
    public function getProductBatchAvailability(Request $request, $productId)
    {
        try {
            $user = $request->user();
            $companyId = $user->company_id;

            // Check product belongs to company
            $product = Product::forCompany($companyId)->findOrFail($productId);

            if (!$this->hasPermission($request, 'can_view_products', $companyId)) {
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
                'status' => 'success',
                'data' => [
                    'product' => [
                        'id' => $product->id,
                        'name' => $product->name,
                        'sku' => $product->sku,
                        'current_stock_quantity' => $product->stock_quantity
                    ],
                    'variant_id' => $variantId,
                    'store_id' => $storeId,
                    'batch_totals' => [
                        'total_available' => $totalAvailable,
                        'total_allocated' => $totalAllocated,
                        'total_on_hand' => $totalAvailable + $totalAllocated,
                        'batch_count' => $batches->count()
                    ],
                    'batches' => $batches
                ]
            ]);
        } catch (\Exception $e) {
            return $this->handleDatabaseError($e, 'fetching product batch availability');
        }
    }

    /**
     * Make stock adjustment for a product (updates the basic stock_quantity)
     */
    public function adjustProductStock(Request $request, $productId)
    {
        $user = $request->user();
        $companyId = $user->company_id;

        // Check product belongs to company
        $product = Product::forCompany($companyId)->findOrFail($productId);

        if (!$this->hasPermission($request, 'can_update_products', $companyId)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validator = Validator::make($request->all(), [
            'variant_id' => 'nullable|exists:product_variants,id',
            'adjustment_quantity' => 'required|integer',
            'adjustment_type' => 'required|in:increase,decrease,set',
            'reason' => 'required|string',
            'notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(), 'errors' => $validator->errors()
            ], 422);
        }

        try {
            DB::beginTransaction();

            $adjustmentQuantity = $request->adjustment_quantity;
            $adjustmentType = $request->adjustment_type;
            $variantId = $request->variant_id;

            if ($variantId) {
                $variant = ProductVariant::findOrFail($variantId);
                $currentStock = $variant->stock_quantity;

                switch ($adjustmentType) {
                    case 'increase':
                        $newStock = $currentStock + $adjustmentQuantity;
                        break;
                    case 'decrease':
                        $newStock = $currentStock - $adjustmentQuantity;
                        break;
                    case 'set':
                        $newStock = $adjustmentQuantity;
                        break;
                }

                if ($newStock < 0) {
                    return response()->json([
                        'status' => 'failed',
                        'message' => 'Stock cannot be negative'
                    ], 422);
                }

                $variant->update(['stock_quantity' => $newStock]);
                $actualAdjustment = $newStock - $currentStock;
            } else {
                $currentStock = $product->stock_quantity;

                switch ($adjustmentType) {
                    case 'increase':
                        $newStock = $currentStock + $adjustmentQuantity;
                        break;
                    case 'decrease':
                        $newStock = $currentStock - $adjustmentQuantity;
                        break;
                    case 'set':
                        $newStock = $adjustmentQuantity;
                        break;
                }

                if ($newStock < 0) {
                    return response()->json([
                        'status' => 'failed',
                        'message' => 'Stock cannot be negative'
                    ], 422);
                }

                $product->update(['stock_quantity' => $newStock]);
                $actualAdjustment = $newStock - $currentStock;
            }

            // Log this as a manual adjustment if no batches are involved
            if (class_exists('App\Models\InventoryMovement')) {
                InventoryMovement::createAdjustment([
                    'company_id' => $companyId,
                    'store_id' => $product->store_id,
                    'product_id' => $productId,
                    'variant_id' => $variantId,
                    'batch_id' => null, // No specific batch for direct stock adjustments
                    'quantity' => $actualAdjustment,
                    'quantity_before' => $currentStock,
                    'quantity_after' => $newStock,
                    'unit_cost' => $variantId ? ($variant->cost ?? $product->unit_cost) : $product->unit_cost,
                    'unit_price' => $variantId ? ($variant->price ?? $product->price) : $product->price,
                    'created_by' => $user->id,
                    'notes' => $request->reason . ($request->notes ? ' - ' . $request->notes : ''),
                    'metadata' => [
                        'adjustment_type' => $adjustmentType,
                        'reason' => $request->reason,
                        'direct_stock_adjustment' => true
                    ],
                ]);
            }

            DB::commit();

            return response()->json([
                'status' => 'success',
                'message' => 'Stock adjustment recorded successfully',
                'data' => [
                    'product_id' => $productId,
                    'variant_id' => $variantId,
                    'previous_stock' => $currentStock,
                    'new_stock' => $newStock,
                    'adjustment_quantity' => $actualAdjustment,
                    'adjustment_type' => $adjustmentType
                ]
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to adjust product stock', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to adjust product stock',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get low stock products
     */
    public function getLowStockProducts(Request $request)
    {
        try {
            $user = $request->user();
            $companyId = $user->company_id;

            if (!$this->hasPermission($request, 'can_view_products', $companyId)) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $storeId = $request->get('store_id');

            $query = Product::with(['store', 'variants'])
                ->forCompany($companyId)
                ->whereRaw('stock_quantity <= low_stock_threshold')
                ->where('track_inventory', true);

            if ($storeId) {
                $query->where('store_id', $storeId);
            }

            $lowStockProducts = $query->orderBy('stock_quantity', 'asc')->get();

            // Also check variants
            $variantQuery = ProductVariant::with(['product.store'])
                ->whereHas('product', function ($q) use ($companyId, $storeId) {
                    $q->forCompany($companyId);
                    if ($storeId) {
                        $q->where('store_id', $storeId);
                    }
                })
                ->whereRaw('stock_quantity <= (SELECT low_stock_threshold FROM products WHERE products.id = product_variants.product_id)');

            $lowStockVariants = $variantQuery->orderBy('stock_quantity', 'asc')->get();

            return response()->json([
                'status' => 'success',
                'data' => [
                    'low_stock_products' => $lowStockProducts,
                    'low_stock_variants' => $lowStockVariants,
                    'counts' => [
                        'products' => $lowStockProducts->count(),
                        'variants' => $lowStockVariants->count()
                    ]
                ]
            ]);
        } catch (\Exception $e) {
            return $this->handleDatabaseError($e, 'fetching low stock products');
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

    /**
     * Track serial number for returns/warranty claims
     */
    public function trackSerialNumber(Request $request, $serialNumber)
    {
        try {
            $user = $request->user();
            $companyId = $user->company_id;

            if (!$this->hasPermission($request, 'can_view_products', $companyId)) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            // Search in batch serial numbers
            $batch = InventoryBatch::forCompany($companyId)
                ->where('serial_number', $serialNumber)
                ->with([
                    'product',
                    'variant',
                    'store',
                    'movements' => function ($query) {
                        $query->with(['createdBy'])->orderBy('movement_date', 'desc');
                    }
                ])
                ->first();

            if ($batch) {
                return response()->json([
                    'status' => 'success',
                    'message' => 'Serial number found in batch records',
                    'found' => true,
                    'data' => [
                        'type' => 'batch_serial',
                        'batch' => $batch,
                        'product' => $batch->product,
                        'variant' => $batch->variant,
                        'store' => $batch->store,
                        'movement_history' => $batch->movements,
                        'verification' => [
                            'is_from_warehouse' => true,
                            'batch_status' => $batch->status,
                            'received_date' => $batch->received_date,
                            'expiry_date' => $batch->expiry_date,
                            'supplier' => $batch->supplier,
                            'original_quantity' => $batch->quantity_received,
                            'current_available' => $batch->quantity_available
                        ]
                    ]
                ]);
            }

            // Search in custom attributes (for individual item serial numbers)
            $batchesWithSerial = InventoryBatch::forCompany($companyId)
                ->whereJsonContains('custom_attributes->serial_numbers', $serialNumber)
                ->with(['product', 'variant', 'store', 'movements'])
                ->get();

            if ($batchesWithSerial->isNotEmpty()) {
                return response()->json([
                    'status' => 'success',
                    'found' => true,
                    'data' => [
                        'type' => 'item_serial',
                        'batches' => $batchesWithSerial,
                        'verification' => [
                            'is_from_warehouse' => true,
                            'total_matching_batches' => $batchesWithSerial->count(),
                            'serial_found_in_batches' => $batchesWithSerial->pluck('batch_number')->toArray()
                        ]
                    ]
                ]);
            }

            // Serial number not found
            return response()->json([
                'status' => 'success',
                'found' => false,
                'message' => 'Serial number not found in our records',
                'verification' => [
                    'is_from_warehouse' => false,
                    'possible_reasons' => [
                        'Product not purchased from this warehouse',
                        'Serial number entered incorrectly',
                        'Product pre-dates serial number tracking',
                        'Serial number belongs to a different company/store'
                    ]
                ]
            ]);
        } catch (\Exception $e) {
            return $this->handleDatabaseError($e, 'tracking serial number');
        }
    }

    /**
     * Bulk allocate inventory using FIFO method
     */
    public function bulkAllocateInventory(Request $request)
    {
        $user = $request->user();
        $companyId = $user->company_id;

        if (!$this->hasPermission($request, 'can_update_products', $companyId)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validator = Validator::make($request->all(), [
            'allocations' => 'required|array',
            'allocations.*.product_id' => 'required|exists:products,id',
            'allocations.*.variant_id' => 'nullable|exists:product_variants,id',
            'allocations.*.quantity' => 'required|integer|min:1',
            'allocations.*.notes' => 'nullable|string',
            'reference_type' => 'nullable|string',
            'reference_id' => 'nullable|string',
            'reference_number' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(), 'errors' => $validator->errors()
            ], 422);
        }

        try {
            DB::beginTransaction();

            $results = [];
            $totalAllocated = 0;
            $failed = [];

            foreach ($request->allocations as $allocation) {
                // Check product belongs to company
                $product = Product::forCompany($companyId)->find($allocation['product_id']);
                if (!$product) {
                    $failed[] = [
                        'product_id' => $allocation['product_id'],
                        'error' => 'Product not found or unauthorized'
                    ];
                    continue;
                }

                // Use FIFO allocation through the model
                if ($allocation['variant_id']) {
                    $variant = ProductVariant::find($allocation['variant_id']);
                    $result = $variant ? $variant->allocateStockFIFO($allocation['quantity'], [
                        'notes' => $allocation['notes'] ?? null,
                        'reference_type' => $request->reference_type,
                        'reference_id' => $request->reference_id,
                        'reference_number' => $request->reference_number,
                    ]) : ['success' => false, 'error' => 'Variant not found'];
                } else {
                    $result = $product->allocateStockFIFO($allocation['quantity'], [
                        'notes' => $allocation['notes'] ?? null,
                        'reference_type' => $request->reference_type,
                        'reference_id' => $request->reference_id,
                        'reference_number' => $request->reference_number,
                    ]);
                }

                if ($result['success']) {
                    $results[] = [
                        'product_id' => $allocation['product_id'],
                        'variant_id' => $allocation['variant_id'] ?? null,
                        'requested_quantity' => $allocation['quantity'],
                        'allocated_quantity' => $result['allocated_quantity'],
                        'allocations' => $result['allocations']
                    ];
                    $totalAllocated += $result['allocated_quantity'];
                } else {
                    $failed[] = [
                        'product_id' => $allocation['product_id'],
                        'variant_id' => $allocation['variant_id'] ?? null,
                        'requested_quantity' => $allocation['quantity'],
                        'error' => $result['error'] ?? 'Insufficient stock'
                    ];
                }
            }

            DB::commit();

            return response()->json([
                'status' => empty($failed) ? 'success' : 'partial',
                'message' => empty($failed) ? 'All allocations successful' : 'Some allocations failed',
                'data' => [
                    'successful_allocations' => $results,
                    'failed_allocations' => $failed,
                    'total_allocated_quantity' => $totalAllocated
                ]
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Bulk allocation failed', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Bulk allocation failed',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Create inventory batches from product receipt
     * This method is called when a product receipt is processed
     */
    public function createBatchesFromReceipt(Request $request)
    {
        $user = $request->user();
        $companyId = $user->company_id;

        if (!$this->hasPermission($request, 'can_create_products', $companyId)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validator = Validator::make($request->all(), [
            'receipt_id' => 'required|exists:product_receipts,id',
            'items' => 'required|array|min:1',
            'items.*.receipt_item_id' => 'required|exists:product_receipt_items,id',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.variant_id' => 'nullable|exists:product_variants,id',
            'items.*.batch_number' => 'nullable|string|max:100',
            'items.*.lot_number' => 'nullable|string|max:100',
            'items.*.serial_number' => 'nullable|string|max:100',
            'items.*.expiry_date' => 'nullable|date',
            'items.*.individual_serials' => 'nullable|array',
            'items.*.custom_attributes' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(), 'errors' => $validator->errors()
            ], 422);
        }

        try {
            DB::beginTransaction();

            $createdBatches = [];

            foreach ($request->items as $itemData) {
                // Get the receipt item details
                $receiptItem = ProductReceiptItem::with(['productReceipt', 'product'])
                    ->find($itemData['receipt_item_id']);

                if (!$receiptItem || $receiptItem->productReceipt->company_id !== $companyId) {
                    continue; // Skip unauthorized items
                }

                // Generate batch number if not provided
                $batchNumber = $itemData['batch_number'] ??
                    InventoryBatch::generateBatchNumber($companyId, $itemData['product_id']);

                // Create the inventory batch
                $batch = InventoryBatch::create([
                    'company_id' => $companyId,
                    'store_id' => $receiptItem->productReceipt->store_id ?? null,
                    'product_id' => $itemData['product_id'],
                    'variant_id' => $itemData['variant_id'],
                    'batch_number' => $batchNumber,
                    'lot_number' => $itemData['lot_number'],
                    'serial_number' => $itemData['serial_number'],
                    'quantity_received' => $receiptItem->quantity_received,
                    'quantity_available' => $receiptItem->quantity_received,
                    'manufacture_date' => $itemData['manufacture_date'] ?? null,
                    'expiry_date' => $itemData['expiry_date'],
                    'received_date' => $receiptItem->productReceipt->received_date,
                    'unit_cost' => $receiptItem->unit_cost,
                    'selling_price' => $receiptItem->product->price ?? null,
                    'supplier' => $receiptItem->supplier,
                    'supplier_id' => $receiptItem->supplier_id ?? $receiptItem->productReceipt->supplier_id,
                    'product_receipt_id' => $receiptItem->product_receipt_id,
                    'notes' => $itemData['notes'] ?? null,
                    'custom_attributes' => array_merge([
                        'serial_numbers' => $itemData['individual_serials'] ?? []
                    ], $itemData['custom_attributes'] ?? []),
                    'status' => 'active',
                ]);

                // Create initial receipt movement
                InventoryMovement::createReceipt([
                    'company_id' => $companyId,
                    'store_id' => $receiptItem->productReceipt->store_id ?? null,
                    'product_id' => $itemData['product_id'],
                    'variant_id' => $itemData['variant_id'],
                    'batch_id' => $batch->id,
                    'quantity' => $receiptItem->quantity_received,
                    'quantity_before' => 0,
                    'quantity_after' => $receiptItem->quantity_received,
                    'reference_type' => 'product_receipt',
                    'reference_id' => $receiptItem->product_receipt_id,
                    'reference_number' => $receiptItem->productReceipt->receipt_number,
                    'unit_cost' => $receiptItem->unit_cost,
                    'unit_price' => $receiptItem->product->price ?? null,
                    'total_cost' => $receiptItem->total_cost,
                    'created_by' => $user->id,
                    'notes' => 'Initial batch receipt - ' . $batch->batch_number,
                ]);

                // Update the receipt item with batch information
                $receiptItem->update([
                    'batch_number' => $batch->batch_number,
                    'lot_number' => $batch->lot_number,
                ]);

                $createdBatches[] = $batch->load(['product', 'variant', 'store']);
            }

            DB::commit();

            return response()->json([
                'status' => 'success',
                'message' => 'Inventory batches created from receipt successfully',
                'data' => [
                    'batches_created' => count($createdBatches),
                    'batches' => $createdBatches
                ]
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to create batches from receipt', [
                'error' => $e->getMessage(),
                'receipt_id' => $request->receipt_id
            ]);

            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to create batches from receipt',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    // =========================================================================
    // INDIVIDUAL SERIAL NUMBER MANAGEMENT FUNCTIONS
    // =========================================================================

    /**
     * Add individual serial numbers to products in warehouse
     */
    public function addProductSerialNumbers(Request $request)
    {
        $user = $request->user();
        $companyId = $user->company_id;

        if (!$this->hasPermission($request, 'can_update_products', $companyId)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        try {
            $validator = Validator::make($request->all(), [
                'product_id' => 'required|exists:products,id',
                'variant_id' => 'nullable|exists:product_variants,id',
                'store_id' => 'nullable|exists:stores,id',
                'batch_id' => 'nullable|exists:inventory_batches,id',
                'serial_numbers' => 'required|array|min:1',
                'serial_numbers.*' => 'required|string|unique:inventory_serials,serial_number',
                'unit_cost' => 'nullable|numeric|min:0',
                'unit_price' => 'nullable|numeric|min:0',
                'warranty_months' => 'nullable|integer|min:0|max:120',
                'purchase_reference' => 'nullable|string',
                'custom_attributes' => 'nullable|array',
                'notes' => 'nullable|string',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Validation failed',
                    'message' => $validator->errors(), 'errors' => $validator->errors()
                ], 422);
            }

            $data = $validator->validated();
            $serialNumbers = $data['serial_numbers'];

            // Verify product belongs to company
            $product = Product::where('id', $data['product_id'])
                ->where('company_id', $companyId)
                ->first();

            if (!$product) {
                return response()->json(['message' => 'Product not found'], 404);
            }

            $createdSerials = [];
            $warrantyExpiry = null;

            if (!empty($data['warranty_months'])) {
                $warrantyExpiry = now()->addMonths($data['warranty_months']);
            }

            DB::beginTransaction();

            foreach ($serialNumbers as $serialNumber) {
                $serial = InventorySerial::create([
                    'company_id' => $companyId,
                    'store_id' => $data['store_id'] ?? null,
                    'product_id' => $data['product_id'],
                    'variant_id' => $data['variant_id'] ?? null,
                    'batch_id' => $data['batch_id'] ?? null,
                    'serial_number' => $serialNumber,
                    'status' => 'active',
                    'unit_cost' => $data['unit_cost'] ?? null,
                    'unit_price' => $data['unit_price'] ?? null,
                    'received_date' => now()->toDateString(),
                    'warranty_expiry_date' => $warrantyExpiry,
                    'purchase_reference' => $data['purchase_reference'] ?? null,
                    'custom_attributes' => $data['custom_attributes'] ?? null,
                    'notes' => $data['notes'] ?? null,
                    'created_by' => $user->id,
                ]);

                $createdSerials[] = $serial->load(['product', 'variant', 'batch', 'store']);
            }

            DB::commit();

            return response()->json([
                'status' => 'success',
                'message' => count($createdSerials) . ' serial numbers added successfully',
                'data' => [
                    'created_count' => count($createdSerials),
                    'serials' => $createdSerials,
                    'product' => $product->load(['variants', 'store', 'category']),
                ]
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->handleDatabaseError($e, 'adding serial numbers');
        }
    }

    /**
     * Get all serial numbers for a specific product
     */
    public function getProductSerialNumbers(Request $request, $productId)
    {
        $user = $request->user();
        $companyId = $user->company_id;

        if (!$this->hasPermission($request, 'can_view_products', $companyId)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        try {
            $variantId = $request->query('variant_id');
            $status = $request->query('status', 'all'); // all, active, sold, returned, damaged
            $batchId = $request->query('batch_id');

            $query = InventorySerial::forCompany($companyId)
                ->byProduct($productId)
                ->with(['product', 'variant', 'batch', 'store', 'customer']);

            if ($variantId) {
                $query->byVariant($variantId);
            }

            if ($batchId) {
                $query->byBatch($batchId);
            }

            if ($status !== 'all') {
                $query->where('status', $status);
            }

            $serials = $query->orderBy('serial_number')->get();

            // Get summary statistics
            $summary = [
                'total_serials' => $serials->count(),
                'active' => $serials->where('status', 'active')->count(),
                'sold' => $serials->where('status', 'sold')->count(),
                'returned' => $serials->where('status', 'returned')->count(),
                'damaged' => $serials->where('status', 'damaged')->count(),
                'under_warranty' => $serials->filter(function ($serial) {
                    return $serial->isUnderWarranty();
                })->count(),
            ];

            return response()->json([
                'status' => 'success',
                'data' => [
                    'serials' => $serials,
                    'summary' => $summary,
                    'product' => $serials->first()?->product ?? null,
                ]
            ]);
        } catch (\Exception $e) {
            return $this->handleDatabaseError($e, 'fetching product serial numbers');
        }
    }

    /**
     * Update individual serial number
     */
    public function updateProductSerial(Request $request, $serialId)
    {
        $user = $request->user();
        $companyId = $user->company_id;

        if (!$this->hasPermission($request, 'can_update_products', $companyId)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        try {
            $serial = InventorySerial::forCompany($companyId)->find($serialId);

            if (!$serial) {
                return response()->json(['message' => 'Serial number not found'], 404);
            }

            $validator = Validator::make($request->all(), [
                'serial_number' => 'sometimes|string|unique:inventory_serials,serial_number,' . $serialId,
                'barcode' => 'nullable|string',
                'qr_code' => 'nullable|string',
                'status' => 'sometimes|in:active,sold,returned,damaged,lost,recalled',
                'unit_cost' => 'nullable|numeric|min:0',
                'unit_price' => 'nullable|numeric|min:0',
                'warranty_expiry_date' => 'nullable|date',
                'custom_attributes' => 'nullable|array',
                'notes' => 'nullable|string',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Validation failed',
                    'message' => $validator->errors(), 'errors' => $validator->errors()
                ], 422);
            }

            $data = $validator->validated();
            $data['updated_by'] = $user->id;

            $serial->update($data);

            return response()->json([
                'status' => 'success',
                'message' => 'Serial number updated successfully',
                'data' => [
                    'serial' => $serial->load(['product', 'variant', 'batch', 'store', 'customer'])
                ]
            ]);
        } catch (\Exception $e) {
            return $this->handleDatabaseError($e, 'updating serial number');
        }
    }

    /**
     * Mark serial as sold
     */
    public function markSerialAsSold(Request $request, $serialId)
    {
        $user = $request->user();
        $companyId = $user->company_id;

        if (!$this->hasPermission($request, 'can_update_products', $companyId)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        try {
            $serial = InventorySerial::forCompany($companyId)->find($serialId);

            if (!$serial) {
                return response()->json(['message' => 'Serial number not found'], 404);
            }

            if ($serial->status !== 'active') {
                return response()->json(['message' => 'Serial number is not available for sale'], 400);
            }

            $validator = Validator::make($request->all(), [
                'sale_reference' => 'required|string',
                'customer_id' => 'nullable|exists:customers,id',
                'unit_price' => 'nullable|numeric|min:0',
                'notes' => 'nullable|string',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Validation failed',
                    'message' => $validator->errors(), 'errors' => $validator->errors()
                ], 422);
            }

            $data = $validator->validated();

            $serial->markAsSold(
                $data['sale_reference'],
                $data['customer_id'] ?? null,
                $data['unit_price'] ?? null
            );

            if (!empty($data['notes'])) {
                $serial->update(['notes' => $data['notes']]);
            }

            return response()->json([
                'status' => 'success',
                'message' => 'Serial number marked as sold',
                'data' => [
                    'serial' => $serial->load(['product', 'variant', 'batch', 'store', 'customer'])
                ]
            ]);
        } catch (\Exception $e) {
            return $this->handleDatabaseError($e, 'marking serial as sold');
        }
    }

    /**
     * Mark serial as returned
     */
    public function markSerialAsReturned(Request $request, $serialId)
    {
        $user = $request->user();
        $companyId = $user->company_id;

        if (!$this->hasPermission($request, 'can_update_products', $companyId)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        try {
            $serial = InventorySerial::forCompany($companyId)->find($serialId);

            if (!$serial) {
                return response()->json(['message' => 'Serial number not found'], 404);
            }

            $validator = Validator::make($request->all(), [
                'notes' => 'nullable|string',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Validation failed',
                    'message' => $validator->errors(), 'errors' => $validator->errors()
                ], 422);
            }

            $data = $validator->validated();

            $serial->markAsReturned($data['notes'] ?? null);

            return response()->json([
                'status' => 'success',
                'message' => 'Serial number marked as returned',
                'data' => [
                    'serial' => $serial->load(['product', 'variant', 'batch', 'store', 'customer'])
                ]
            ]);
        } catch (\Exception $e) {
            return $this->handleDatabaseError($e, 'marking serial as returned');
        }
    }

    /**
     * Search/Track individual serial number (Enhanced version)
     */
    public function trackIndividualSerial(Request $request, $serialNumber)
    {
        $user = $request->user();
        $companyId = $user->company_id;

        if (!$this->hasPermission($request, 'can_view_products', $companyId)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        try {
            $serial = InventorySerial::findBySerialNumber($serialNumber, $companyId);

            if (!$serial) {
                // Also search in batch-level serials for backwards compatibility
                $batchSerial = InventoryBatch::forCompany($companyId)
                    ->where('serial_number', $serialNumber)
                    ->with(['product', 'variant', 'store'])
                    ->first();

                if ($batchSerial) {
                    return response()->json([
                        'status' => 'success',
                        'found' => true,
                        'type' => 'batch_level',
                        'data' => [
                            'batch' => $batchSerial,
                            'product' => $batchSerial->product,
                            'verification' => [
                                'is_from_warehouse' => true,
                                'level' => 'batch',
                                'batch_status' => $batchSerial->status,
                                'received_date' => $batchSerial->received_date,
                                'supplier' => $batchSerial->supplier,
                            ]
                        ]
                    ]);
                }

                return response()->json([
                    'status' => 'success',
                    'found' => false,
                    'message' => 'Serial number not found',
                    'verification' => [
                        'is_from_warehouse' => false,
                        'possible_reasons' => [
                            'Serial number not registered in system',
                            'Product not from this warehouse',
                            'Serial number entered incorrectly'
                        ]
                    ]
                ]);
            }

            return response()->json([
                'status' => 'success',
                'found' => true,
                'type' => 'individual_unit',
                'data' => [
                    'serial' => $serial,
                    'product' => $serial->product,
                    'variant' => $serial->variant,
                    'batch' => $serial->batch,
                    'store' => $serial->store,
                    'customer' => $serial->customer,
                    'verification' => [
                        'is_from_warehouse' => true,
                        'level' => 'individual',
                        'serial_status' => $serial->status,
                        'warranty_status' => $serial->getWarrantyStatus(),
                        'is_under_warranty' => $serial->isUnderWarranty(),
                        'received_date' => $serial->received_date,
                        'sold_date' => $serial->sold_date,
                        'warranty_expiry' => $serial->warranty_expiry_date,
                        'purchase_reference' => $serial->purchase_reference,
                        'sale_reference' => $serial->sale_reference,
                    ]
                ]
            ]);
        } catch (\Exception $e) {
            return $this->handleDatabaseError($e, 'tracking individual serial number');
        }
    }

    /**
     * Get warranty expiring serials
     */
    public function getWarrantyExpiringSerials(Request $request)
    {
        $user = $request->user();
        $companyId = $user->company_id;

        if (!$this->hasPermission($request, 'can_view_products', $companyId)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        try {
            $days = $request->query('days', 30);

            $expiringSerials = InventorySerial::forCompany($companyId)
                ->sold()
                ->warrantyExpiring($days)
                ->with(['product', 'variant', 'customer'])
                ->orderBy('warranty_expiry_date', 'asc')
                ->get();

            return response()->json([
                'status' => 'success',
                'data' => [
                    'expiring_serials' => $expiringSerials,
                    'count' => $expiringSerials->count(),
                    'days_ahead' => $days,
                ]
            ]);
        } catch (\Exception $e) {
            return $this->handleDatabaseError($e, 'fetching warranty expiring serials');
        }
    }

    /**
     * Bulk generate serial numbers for received products
     */
    public function bulkGenerateSerialNumbers(Request $request)
    {
        $user = $request->user();
        $companyId = $user->company_id;

        if (!$this->hasPermission($request, 'can_update_products', $companyId)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        try {
            $validator = Validator::make($request->all(), [
                'product_id' => 'required|exists:products,id',
                'variant_id' => 'nullable|exists:product_variants,id',
                'batch_id' => 'nullable|exists:inventory_batches,id',
                'quantity' => 'required|integer|min:1|max:1000',
                'prefix' => 'nullable|string|max:10',
                'unit_cost' => 'nullable|numeric|min:0',
                'unit_price' => 'nullable|numeric|min:0',
                'warranty_months' => 'nullable|integer|min:0|max:120',
                'purchase_reference' => 'nullable|string',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Validation failed',
                    'message' => $validator->errors(), 'errors' => $validator->errors()
                ], 422);
            }

            $data = $validator->validated();
            $quantity = $data['quantity'];

            $warrantyExpiry = null;
            if (!empty($data['warranty_months'])) {
                $warrantyExpiry = now()->addMonths($data['warranty_months']);
            }

            $serials = [];
            DB::beginTransaction();

            for ($i = 0; $i < $quantity; $i++) {
                $serialNumber = InventorySerial::generateSerialNumber(
                    $companyId,
                    $data['product_id'],
                    $data['prefix'] ?? 'SN'
                );

                $serials[] = [
                    'company_id' => $companyId,
                    'product_id' => $data['product_id'],
                    'variant_id' => $data['variant_id'] ?? null,
                    'batch_id' => $data['batch_id'] ?? null,
                    'serial_number' => $serialNumber,
                    'status' => 'active',
                    'unit_cost' => $data['unit_cost'] ?? null,
                    'unit_price' => $data['unit_price'] ?? null,
                    'received_date' => now()->toDateString(),
                    'warranty_expiry_date' => $warrantyExpiry,
                    'purchase_reference' => $data['purchase_reference'] ?? null,
                    'created_by' => $user->id,
                ];
            }

            $createdSerials = InventorySerial::bulkCreate($serials);

            DB::commit();

            return response()->json([
                'status' => 'success',
                'message' => "{$quantity} serial numbers generated successfully",
                'data' => [
                    'generated_count' => $quantity,
                    'serials' => $createdSerials,
                    'first_serial' => $createdSerials->first()->serial_number ?? null,
                    'last_serial' => $createdSerials->last()->serial_number ?? null,
                ]
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->handleDatabaseError($e, 'bulk generating serial numbers');
        }
    }

    /**
     * Get all serial numbers across all products (with filters and pagination)
     */
    public function getAllSerialNumbers(Request $request)
    {
        $user = $request->user();
        $companyId = $user->company_id;

        if (!$this->hasPermission($request, 'can_view_products', $companyId)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        try {
            $validator = Validator::make($request->all(), [
                'per_page' => 'integer|min:1|max:100',
                'page' => 'integer|min:1',
                'status' => 'string|in:active,sold,returned,damaged,lost,recalled',
                'product_id' => 'string|exists:products,id',
                'store_id' => 'string|exists:stores,id',
                'batch_id' => 'string|exists:inventory_batches,id',
                'search' => 'string|max:255',
                'warranty_status' => 'string|in:active,expiring_soon,expired,no_warranty',
                'date_from' => 'date',
                'date_to' => 'date',
                'sort_by' => 'string|in:serial_number,received_date,sold_date,warranty_expiry_date,unit_cost,unit_price,created_at',
                'sort_order' => 'string|in:asc,desc'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Validation failed',
                    'message' => $validator->errors(), 'errors' => $validator->errors()
                ], 422);
            }

            // Build query
            $query = InventorySerial::forCompany($companyId)
                ->with(['product', 'variant', 'batch', 'store', 'customer']);

            // Apply filters
            if ($request->has('status')) {
                $query->where('status', $request->status);
            }

            if ($request->has('product_id')) {
                $query->where('product_id', $request->product_id);
            }

            if ($request->has('store_id')) {
                $query->where('store_id', $request->store_id);
            }

            if ($request->has('batch_id')) {
                $query->where('batch_id', $request->batch_id);
            }

            // Search in serial number, barcode, or notes
            if ($request->has('search')) {
                $search = $request->search;
                $query->where(function ($q) use ($search) {
                    $q->where('serial_number', 'ILIKE', "%{$search}%")
                        ->orWhere('barcode', 'ILIKE', "%{$search}%")
                        ->orWhere('notes', 'ILIKE', "%{$search}%");
                });
            }

            // Date range filter
            if ($request->has('date_from')) {
                $query->where('received_date', '>=', $request->date_from);
            }

            if ($request->has('date_to')) {
                $query->where('received_date', '<=', $request->date_to);
            }

            // Warranty status filter
            if ($request->has('warranty_status')) {
                switch ($request->warranty_status) {
                    case 'active':
                        $query->whereNotNull('warranty_expiry_date')
                            ->where('warranty_expiry_date', '>', now())
                            ->where('warranty_expiry_date', '>', now()->addDays(30));
                        break;
                    case 'expiring_soon':
                        $query->whereNotNull('warranty_expiry_date')
                            ->where('warranty_expiry_date', '>', now())
                            ->where('warranty_expiry_date', '<=', now()->addDays(30));
                        break;
                    case 'expired':
                        $query->whereNotNull('warranty_expiry_date')
                            ->where('warranty_expiry_date', '<', now());
                        break;
                    case 'no_warranty':
                        $query->whereNull('warranty_expiry_date');
                        break;
                }
            }

            // Sorting
            $sortBy = $request->get('sort_by', 'created_at');
            $sortOrder = $request->get('sort_order', 'desc');
            $query->orderBy($sortBy, $sortOrder);

            // Pagination
            $perPage = $request->get('per_page', 20);
            $serials = $query->paginate($perPage);

            return response()->json([
                'status' => 'success',
                'message' => 'Serial numbers fetched successfully',
                'data' => $serials
            ]);

        } catch (\Exception $e) {
            return $this->handleDatabaseError($e, 'fetching all serial numbers');
        }
    }

    /**
     * Get serial numbers statistics (separate endpoint for performance)
     */
    public function getSerialsStatistics(Request $request)
    {
        $user = $request->user();
        $companyId = $user->company_id;

        if (!$this->hasPermission($request, 'can_view_products', $companyId)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        try {
            $validator = Validator::make($request->all(), [
                'product_id' => 'string|exists:products,id',
                'store_id' => 'string|exists:stores,id',
                'batch_id' => 'string|exists:inventory_batches,id',
                'cache_duration' => 'integer|min:60|max:3600', // 1 minute to 1 hour
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Validation failed',
                    'message' => $validator->errors(), 'errors' => $validator->errors()
                ], 422);
            }

            // Create cache key based on filters
            $cacheKey = 'serials_stats_' . $companyId;
            if ($request->has('product_id')) {
                $cacheKey .= '_product_' . $request->product_id;
            }
            if ($request->has('store_id')) {
                $cacheKey .= '_store_' . $request->store_id;
            }
            if ($request->has('batch_id')) {
                $cacheKey .= '_batch_' . $request->batch_id;
            }

            // Cache duration (default 5 minutes)
            $cacheDuration = $request->get('cache_duration', 300);

            // Try to get from cache first
            $stats = cache()->remember($cacheKey, $cacheDuration, function () use ($request, $companyId) {
                $query = InventorySerial::forCompany($companyId);

                // Apply filters
                if ($request->has('product_id')) {
                    $query->where('product_id', $request->product_id);
                }
                if ($request->has('store_id')) {
                    $query->where('store_id', $request->store_id);
                }
                if ($request->has('batch_id')) {
                    $query->where('batch_id', $request->batch_id);
                }

                return [
                    'total_serials' => $query->count(),
                    'by_status' => [
                        'active' => $query->clone()->where('status', 'active')->count(),
                        'sold' => $query->clone()->where('status', 'sold')->count(),
                        'returned' => $query->clone()->where('status', 'returned')->count(),
                        'damaged' => $query->clone()->where('status', 'damaged')->count(),
                        'lost' => $query->clone()->where('status', 'lost')->count(),
                        'recalled' => $query->clone()->where('status', 'recalled')->count(),
                    ],
                    'warranty_stats' => [
                        'under_warranty' => $query->clone()->whereNotNull('warranty_expiry_date')
                            ->where('warranty_expiry_date', '>', now())->count(),
                        'warranty_expired' => $query->clone()->whereNotNull('warranty_expiry_date')
                            ->where('warranty_expiry_date', '<', now())->count(),
                        'expiring_soon' => $query->clone()->whereNotNull('warranty_expiry_date')
                            ->where('warranty_expiry_date', '>', now())
                            ->where('warranty_expiry_date', '<=', now()->addDays(30))->count(),
                        'no_warranty' => $query->clone()->whereNull('warranty_expiry_date')->count(),
                    ],
                    'value_stats' => [
                        'total_cost_value' => round($query->clone()->where('status', 'active')->sum('unit_cost'), 2),
                        'total_retail_value' => round($query->clone()->where('status', 'active')->sum('unit_price'), 2),
                        'sold_value' => round($query->clone()->where('status', 'sold')->sum('unit_price'), 2),
                    ],
                    'recent_activity' => [
                        'added_today' => $query->clone()->whereDate('created_at', today())->count(),
                        'added_this_week' => $query->clone()->whereBetween('created_at', [now()->startOfWeek(), now()->endOfWeek()])->count(),
                        'sold_today' => $query->clone()->where('status', 'sold')->whereDate('sold_date', today())->count(),
                        'sold_this_week' => $query->clone()->where('status', 'sold')->whereBetween('sold_date', [now()->startOfWeek(), now()->endOfWeek()])->count(),
                    ],
                    'calculated_at' => now()->toISOString(),
                ];
            });

            return response()->json([
                'status' => 'success',
                'message' => 'Serial numbers statistics fetched successfully',
                'data' => [
                    'statistics' => $stats,
                    'filters_applied' => $request->only(['product_id', 'store_id', 'batch_id']),
                    'cache_info' => [
                        'cached' => cache()->has($cacheKey),
                        'cache_duration_seconds' => $cacheDuration,
                        'cache_key' => $cacheKey,
                    ]
                ]
            ]);

        } catch (\Exception $e) {
            return $this->handleDatabaseError($e, 'fetching serial numbers statistics');
        }
    }

    /**
     * Delete a product serial number
     */
    public function deleteProductSerial(Request $request, $serialId)
    {
        $user = $request->user();
        $companyId = $user->company_id;

        if (!$this->hasPermission($request, 'can_update_products', $companyId)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        try {
            $serial = InventorySerial::forCompany($companyId)->findOrFail($serialId);

            // Check if serial can be deleted (not sold to customer)
            if ($serial->status === 'sold' && $serial->customer_id) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Cannot delete serial number that has been sold to a customer. Consider marking as returned instead.'
                ], 422);
            }

            $serialNumber = $serial->serial_number;
            $serial->delete();

            return response()->json([
                'status' => 'success',
                'message' => "Serial number {$serialNumber} deleted successfully"
            ]);

        } catch (ModelNotFoundException $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Serial number not found'
            ], 404);
        } catch (\Exception $e) {
            return $this->handleDatabaseError($e, 'deleting serial number');
        }
    }
}
