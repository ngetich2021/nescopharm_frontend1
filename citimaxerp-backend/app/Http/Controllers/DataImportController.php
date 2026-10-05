<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\InventoryMovement;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Supplier;
use App\Services\DataImport\ImportSchemas;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

/**
 * Bulk import of the sheets used to migrate off a previous system. The user downloads a blank
 * template built from ImportSchemas, fills it with their old data and uploads it back here.
 * Every import runs as a preview first (dry_run), so nothing is written until the user has seen
 * row-by-row what the file will do.
 */
class DataImportController extends Controller
{
    public function __construct()
    {
        $this->middleware('auth:sanctum');
    }

    protected function hasPermission(Request $request, $permission, $resourceCompanyId = null)
    {
        $role = $request->user()->role;
        if (!$role) {
            return false;
        }
        if ($role->hasPermission('can_manage_system')) {
            return true;
        }
        if ($role->hasPermission('can_manage_company')) {
            return $resourceCompanyId === null || $request->user()->company_id === $resourceCompanyId;
        }
        return $role->hasPermission($permission);
    }

    /** The column layout of every sheet, so the page can build templates and show the format. */
    public function schemas()
    {
        return response()->json(['status' => 'success', 'schemas' => array_values(ImportSchemas::all())]);
    }

    public function import(Request $request, string $entity)
    {
        $schema = ImportSchemas::get($entity);
        if (!$schema || ($schema['context'] ?? 'hub') !== 'hub') {
            return response()->json(['status' => 'failed', 'message' => "There is no import called \"{$entity}\"."], 404);
        }

        $validator = Validator::make($request->all(), [
            'file' => 'required|file|mimes:xlsx,xls,csv,txt|max:10240',
            'dry_run' => 'nullable|boolean',
        ]);
        if ($validator->fails()) {
            return response()->json(['status' => 'failed', 'message' => $validator->errors()], 400);
        }

        $user = $request->user();
        if (!$this->hasPermission($request, $schema['permission'], $user->company_id)) {
            return response()->json(['status' => 'failed', 'message' => "You do not have permission to import {$schema['label']}."], 403);
        }

        try {
            $rows = \PhpOffice\PhpSpreadsheet\IOFactory::load($request->file('file')->getRealPath())
                ->getSheet(0)
                ->toArray(null, true, false, false);
        } catch (\Throwable $e) {
            return response()->json(['status' => 'failed', 'message' => 'Could not read the file: ' . $e->getMessage()], 422);
        }

        $headingRow = $this->findHeadingRow($rows, $schema);
        if ($headingRow === null) {
            return response()->json([
                'status' => 'failed',
                'message' => "This sheet's headings don't match the {$schema['label']} template. Download the template and paste your data under its headings.",
            ], 422);
        }

        $columns = ImportSchemas::mapHeadings($schema, $rows[$headingRow]);
        if ($missing = ImportSchemas::missingRequired($schema, $columns)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'These required columns are missing from the sheet: ' . implode(', ', $missing) . '.',
            ], 422);
        }

        $dryRun = $request->boolean('dry_run');
        // A real import against the remote database needs more than PHP's default 30 seconds.
        if (!$dryRun) {
            set_time_limit(600);
        }

        $body = array_slice($rows, $headingRow + 1);
        $cells = $this->rowReader($columns);

        DB::beginTransaction();
        try {
            [$summary, $results] = match ($entity) {
                'suppliers' => $this->importSuppliers($body, $cells, $user->company_id, $headingRow),
                'customers' => $this->importCustomers($body, $cells, $user, $headingRow),
                'opening_stock' => $this->importOpeningStock($body, $cells, $user, $headingRow),
            };
            $dryRun ? DB::rollBack() : DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json(['status' => 'failed', 'message' => 'The import stopped and nothing was saved: ' . $e->getMessage()], 500);
        }

        return response()->json([
            'status' => 'success',
            'message' => $dryRun ? 'Preview only - nothing was saved.' : "{$schema['label']} imported.",
            'dry_run' => $dryRun,
            'entity' => $entity,
            'summary' => $summary,
            'rows' => $results,
        ]);
    }

    /**
     * People often paste data under a title or a blank line, so look for the heading row rather than
     * assuming row 1. It is the first row in which at least two of the schema's columns are found.
     */
    private function findHeadingRow(array $rows, array $schema): ?int
    {
        foreach (array_slice($rows, 0, 10, true) as $index => $row) {
            if (count(ImportSchemas::mapHeadings($schema, $row)) >= 2) {
                return $index;
            }
        }
        return null;
    }

    /** Returns a closure giving trimmed, whitespace-collapsed access to a row's cells by field key. */
    private function rowReader(array $columns): \Closure
    {
        return fn (array $row) => fn (string $key) => isset($columns[$key])
            ? trim(preg_replace('/\s+/', ' ', (string) ($row[$columns[$key]] ?? '')))
            : '';
    }

    private function isBlankRow(array $row): bool
    {
        return implode('', array_map(fn ($c) => trim((string) $c), $row)) === '';
    }

    /** Accepts "1,200", "KES 1,200.50" and plain numbers; anything else is null. */
    private function number(string $value): ?float
    {
        $clean = str_replace([',', ' '], '', preg_replace('/^(KES|KSH|KSHS)\.?/i', '', $value));
        return is_numeric($clean) ? (float) $clean : null;
    }

    private function yesNo(string $value): ?bool
    {
        return $value === '' ? null : in_array(strtolower($value), ['yes', 'y', 'true', '1', 'active'], true);
    }

    /**
     * Handles text dates and the serial numbers Excel stores dates as. Returns null for an empty
     * cell and false for one that can't be read, which the caller reports rather than quietly
     * substituting a date - a wrong order date is much harder to spot later than a rejected row.
     */
    private function date(string $value): string|false|null
    {
        if ($value === '') {
            return null;
        }
        if (is_numeric($value) && (float) $value > 20000 && (float) $value < 80000) {
            return \PhpOffice\PhpSpreadsheet\Shared\Date::excelToDateTimeObject((float) $value)->format('Y-m-d');
        }
        // Slash and dash dates are read day first, the local convention; PHP would otherwise read
        // them month first and turn 15/02/2026 into a failure and 01/02/2026 into the wrong day.
        if (preg_match('#^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$#', $value, $m)) {
            return checkdate((int) $m[2], (int) $m[1], (int) $m[3])
                ? sprintf('%04d-%02d-%02d', $m[3], $m[2], $m[1])
                : false;
        }
        $timestamp = strtotime($value);
        return $timestamp === false ? false : date('Y-m-d', $timestamp);
    }

    /**
     * Item names are compared on their letters and digits alone, so the spacing, case and
     * punctuation people vary between systems stop mattering: "2ml syringe without needle",
     * "2 Ml Syringe Without Needle" and "2-ml syringe, without needle" are all the same item.
     */
    private function nameKey(string $name): string
    {
        return preg_replace('/[^a-z0-9]/', '', mb_strtolower(trim($name)));
    }

    /** Excel saves size "2.0" as 2, so numeric sizes are matched by value rather than by text. */
    private function sizeKey(?string $name): string
    {
        $trimmed = trim((string) $name);
        return is_numeric($trimmed) ? (string) (float) $trimmed : mb_strtolower($trimmed);
    }

    private function blankSummary(): array
    {
        return ['rows' => 0, 'created' => 0, 'updated' => 0, 'unchanged' => 0, 'errors' => 0];
    }

    private function importSuppliers(array $body, \Closure $cells, string $companyId, int $headingRow): array
    {
        $summary = $this->blankSummary();
        $results = [];
        $existing = Supplier::where('company_id', $companyId)->get()->keyBy(fn ($s) => mb_strtolower(trim($s->name)));

        foreach ($body as $offset => $row) {
            if ($this->isBlankRow($row)) {
                continue;
            }
            $cell = $cells($row);
            $line = $headingRow + $offset + 2;
            $summary['rows']++;
            $name = $cell('name');
            $result = ['row' => $line, 'key' => $name, 'name' => $name];

            if ($name === '') {
                $summary['errors']++;
                $results[] = $result + ['status' => 'error', 'message' => 'Supplier Name is required.'];
                continue;
            }

            $fields = array_filter([
                'email' => $cell('email') ?: null,
                'phone' => $cell('phone') ?: null,
                'contact_person' => $cell('contact_person') ?: null,
                'address' => $cell('address') ?: null,
                'payment_terms_type' => $cell('payment_terms_type') ?: null,
                'payment_terms_days' => ($d = $this->number($cell('payment_terms_days'))) !== null ? (int) $d : null,
                'payment_terms_description' => $cell('payment_terms_description') ?: null,
                'bank_name' => $cell('bank_name') ?: null,
                'bank_account_number' => $cell('bank_account_number') ?: null,
                'bank_branch' => $cell('bank_branch') ?: null,
                'bank_swift_code' => $cell('bank_swift_code') ?: null,
                'notes' => $cell('notes') ?: null,
                'is_active' => $this->yesNo($cell('is_active')),
            ], fn ($v) => $v !== null);

            $supplier = $existing->get(mb_strtolower($name));
            if ($supplier) {
                $supplier->fill($fields);
                if ($supplier->isDirty()) {
                    $supplier->save();
                    $summary['updated']++;
                    $results[] = $result + ['status' => 'updated'];
                } else {
                    $summary['unchanged']++;
                    $results[] = $result + ['status' => 'unchanged'];
                }
                continue;
            }

            $supplier = Supplier::create($fields + [
                'id' => (string) Str::uuid(),
                'company_id' => $companyId,
                'name' => $name,
                'is_active' => $fields['is_active'] ?? true,
            ]);
            $existing->put(mb_strtolower($name), $supplier);
            $summary['created']++;
            $results[] = $result + ['status' => 'created'];
        }

        return [$summary, $results];
    }

    private function importCustomers(array $body, \Closure $cells, $user, int $headingRow): array
    {
        $companyId = $user->company_id;
        $summary = $this->blankSummary();
        $results = [];
        $all = Customer::where('company_id', $companyId)->get();
        $byNumber = $all->whereNotNull('customer_number')->keyBy(fn ($c) => mb_strtolower(trim($c->customer_number)));
        $byName = $all->keyBy(fn ($c) => mb_strtolower(trim($c->name)));

        $textFields = ['business_name', 'customer_type', 'email', 'phone', 'telephone', 'pin_number', 'address',
            'city', 'county', 'region', 'country', 'postal_code', 'contact_person_name', 'contact_person_designation',
            'contact_person_phone', 'contact_person_email', 'payment_method', 'status', 'notes'];

        foreach ($body as $offset => $row) {
            if ($this->isBlankRow($row)) {
                continue;
            }
            $cell = $cells($row);
            $line = $headingRow + $offset + 2;
            $summary['rows']++;
            $name = $cell('name');
            $number = $cell('customer_number');
            $result = ['row' => $line, 'key' => $number, 'name' => $name];

            if ($name === '') {
                $summary['errors']++;
                $results[] = $result + ['status' => 'error', 'message' => 'Customer Name is required.'];
                continue;
            }

            $fields = array_filter(
                array_combine($textFields, array_map(fn ($f) => $cell($f) ?: null, $textFields)),
                fn ($v) => $v !== null
            );
            $fields['name'] = $name;

            $customer = $number !== '' ? $byNumber->get(mb_strtolower($number)) : $byName->get(mb_strtolower($name));
            if ($customer) {
                $customer->fill($fields);
                if ($customer->isDirty()) {
                    $customer->save();
                    $summary['updated']++;
                    $results[] = $result + ['status' => 'updated'];
                } else {
                    $summary['unchanged']++;
                    $results[] = $result + ['status' => 'unchanged'];
                }
                continue;
            }

            $customer = Customer::create($fields + [
                'id' => (string) Str::uuid(),
                'company_id' => $companyId,
                'created_by' => $user->id,
                'customer_number' => $number ?: null,
                'status' => $fields['status'] ?? 'active',
                // Migrated customers are already-trading accounts, so they skip the approval workflow.
                'approval_status' => 'approved',
            ]);
            $byName->put(mb_strtolower($name), $customer);
            if ($number !== '') {
                $byNumber->put(mb_strtolower($number), $customer);
            }
            $summary['created']++;
            $results[] = $result + ['status' => 'created'];
        }

        return [$summary, $results];
    }

    private function importOpeningStock(array $body, \Closure $cells, $user, int $headingRow): array
    {
        $companyId = $user->company_id;
        $summary = $this->blankSummary();
        $results = [];
        $products = Product::where('company_id', $companyId)->get()->keyBy(fn ($p) => (string) $p->item_number);
        $variants = ProductVariant::whereIn('product_id', $products->pluck('id'))->get()
            ->groupBy('product_id')
            ->map(fn ($group) => $group->keyBy(fn ($v) => $this->sizeKey($v->name)));
        $stores = DB::table('stores')->where('company_id', $companyId)->get();
        $defaultStoreId = $stores->first()->id ?? null;

        foreach ($body as $offset => $row) {
            if ($this->isBlankRow($row)) {
                continue;
            }
            $cell = $cells($row);
            $line = $headingRow + $offset + 2;
            $summary['rows']++;
            $itemNo = $cell('item_no');
            $size = $cell('size');
            $result = ['row' => $line, 'key' => $itemNo . ($size !== '' ? " / {$size}" : ''), 'name' => ''];

            $product = $products->get((string) (int) $itemNo);
            if ($itemNo === '' || !$product) {
                $summary['errors']++;
                $results[] = $result + ['status' => 'error', 'message' => "No product with Item No. \"{$itemNo}\". Import your products first."];
                continue;
            }
            $result['name'] = $size !== '' ? ProductVariant::sizedName($product->name, $size) : $product->name;

            $quantity = $this->number($cell('quantity'));
            if ($quantity === null) {
                $summary['errors']++;
                $results[] = $result + ['status' => 'error', 'message' => 'Quantity On Hand is missing or is not a number.'];
                continue;
            }

            $target = $product;
            if ($size !== '') {
                $target = $variants->get($product->id)?->get($this->sizeKey($size));
                if (!$target) {
                    $summary['errors']++;
                    $results[] = $result + ['status' => 'error', 'message' => "Item {$itemNo} has no size \"{$size}\"."];
                    continue;
                }
            }

            $storeName = $cell('store');
            $storeId = $target->store_id ?? $product->store_id ?? $defaultStoreId;
            if ($storeName !== '') {
                $match = $stores->first(fn ($s) => mb_strtolower(trim($s->name)) === mb_strtolower($storeName));
                if (!$match) {
                    $summary['errors']++;
                    $results[] = $result + ['status' => 'error', 'message' => "No store called \"{$storeName}\"."];
                    continue;
                }
                $storeId = $match->id;
            }

            $before = (float) ($target->stock_quantity ?? 0);
            $cost = $this->number($cell('unit_cost'));
            if ($cost !== null) {
                $target->{$size !== '' ? 'cost' : 'unit_cost'} = $cost;
            }

            if ($before == $quantity && !$target->isDirty()) {
                $summary['unchanged']++;
                $results[] = $result + ['status' => 'unchanged', 'before' => $before, 'after' => $quantity];
                continue;
            }

            $target->stock_quantity = $quantity;
            $target->save();

            // Opening balances still go through a movement, so the change is visible in stock history.
            InventoryMovement::createAdjustment([
                'id' => (string) Str::uuid(),
                'company_id' => $companyId,
                'store_id' => $storeId,
                'product_id' => $product->id,
                'variant_id' => $size !== '' ? $target->id : null,
                'quantity' => $quantity - $before,
                'quantity_before' => $before,
                'quantity_after' => $quantity,
                'reference_type' => 'opening_stock',
                'reference_number' => 'Opening stock import',
                'unit_cost' => $cost ?? ($size !== '' ? $target->cost : $product->unit_cost),
                'movement_date' => now(),
                'created_by' => $user->id,
                'notes' => $cell('notes') ?: 'Opening balance imported during migration',
            ]);

            $summary['updated']++;
            $results[] = $result + ['status' => 'updated', 'before' => $before, 'after' => $quantity];
        }

        return [$summary, $results];
    }
    /**
     * Read a purchase order sheet and resolve it against the catalogue WITHOUT saving anything.
     * The New Purchase Order form fills itself from what comes back, so the buyer still reviews and
     * edits the order before saving it the usual way. Rows that can't be matched are returned as
     * problems rather than silently dropped.
     */
    public function parsePurchaseOrder(Request $request)
    {
        $schema = ImportSchemas::get('purchase_order_items');

        $validator = Validator::make($request->all(), [
            'file' => 'required|file|mimes:xlsx,xls,csv,txt|max:10240',
        ]);
        if ($validator->fails()) {
            return response()->json(['status' => 'failed', 'message' => $validator->errors()], 400);
        }

        $user = $request->user();
        if (!$this->hasPermission($request, $schema['permission'], $user->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'You do not have permission to create purchase orders.'], 403);
        }
        $companyId = $user->company_id;

        try {
            $rows = \PhpOffice\PhpSpreadsheet\IOFactory::load($request->file('file')->getRealPath())
                ->getSheet(0)
                ->toArray(null, true, false, false);
        } catch (\Throwable $e) {
            return response()->json(['status' => 'failed', 'message' => 'Could not read the file: ' . $e->getMessage()], 422);
        }

        $headingRow = $this->findHeadingRow($rows, $schema);
        if ($headingRow === null) {
            return response()->json([
                'status' => 'failed',
                'message' => "This sheet's headings don't match the template. Download the template and paste your items under its headings.",
            ], 422);
        }

        $columns = ImportSchemas::mapHeadings($schema, $rows[$headingRow]);
        if ($missing = ImportSchemas::missingRequired($schema, $columns)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'These required columns are missing from the sheet: ' . implode(', ', $missing) . '.',
            ], 422);
        }

        $cells = $this->rowReader($columns);
        $products = Product::where('company_id', $companyId)->get();
        $variants = ProductVariant::whereIn('product_id', $products->pluck('id'))->get();
        $variantsByProduct = $variants->groupBy('product_id')
            ->map(fn ($group) => $group->keyBy(fn ($v) => $this->sizeKey($v->name)));

        // Items are matched on their name rather than a code, because that is what buyers and
        // suppliers actually write on an order. Names are compared on letters and digits only, so
        // "2ml syringe without needle" and "2 Ml Syringe Without Needle" are the same item.
        $byName = [];
        foreach ($products as $product) {
            $byName[$this->nameKey($product->name)][] = [$product, null];
        }
        // A sized item can also be written out in full, e.g. "Et Tubes Uncuffed Id 3.5".
        foreach ($variants as $variant) {
            $product = $products->firstWhere('id', $variant->product_id);
            if ($product) {
                $byName[$this->nameKey(ProductVariant::sizedName($product->name, $variant->name))][] = [$product, $variant];
            }
        }

        $header = ['supplier_id' => null, 'supplier_name' => null, 'order_date' => null, 'delivery_date' => null, 'comments' => null];
        $lines = [];
        $problems = [];

        foreach (array_slice($rows, $headingRow + 1) as $offset => $row) {
            if ($this->isBlankRow($row)) {
                continue;
            }
            $cell = $cells($row);
            $line = $headingRow + $offset + 2;

            // The order's own details are taken from the first row that carries them.
            if ($header['supplier_name'] === null && $cell('supplier') !== '') {
                $name = $cell('supplier');
                $supplier = Supplier::where('company_id', $companyId)->whereRaw('LOWER(TRIM(name)) = ?', [mb_strtolower(trim($name))])->first();
                $header['supplier_name'] = $name;
                $header['supplier_id'] = $supplier->id ?? null;
                if (!$supplier) {
                    $problems[] = ['row' => $line, 'message' => "No supplier called \"{$name}\" - pick one in the form."];
                }
            }
            foreach (['order_date', 'delivery_date'] as $field) {
                if ($header[$field] === null && $cell($field) !== '') {
                    $parsed = $this->date($cell($field));
                    if ($parsed === false) {
                        $problems[] = ['row' => $line, 'message' => ucfirst(str_replace('_', ' ', $field)) . ' could not be read. Use YYYY-MM-DD.'];
                    } else {
                        $header[$field] = $parsed;
                    }
                }
            }
            if ($header['comments'] === null && $cell('comments') !== '') {
                $header['comments'] = $cell('comments');
            }

            $itemName = $cell('item_name');
            if ($itemName === '') {
                continue;
            }
            $size = $cell('size');
            $matches = $byName[$this->nameKey($itemName)] ?? [];
            // With a size of its own, the name must be the plain item, not an already-sized one.
            if ($size !== '') {
                $matches = array_values(array_filter($matches, fn ($m) => $m[1] === null));
            }

            if (!$matches) {
                $problems[] = ['row' => $line, 'message' => "No item called \"{$itemName}\"."];
                continue;
            }
            if (count($matches) > 1) {
                $problems[] = ['row' => $line, 'message' => "\"{$itemName}\" matches more than one item - add the size, or pick it in the form."];
                continue;
            }

            [$product, $variant] = $matches[0];
            if ($size !== '') {
                $variant = $variantsByProduct->get($product->id)?->get($this->sizeKey($size));
                if (!$variant) {
                    $problems[] = ['row' => $line, 'message' => "\"{$itemName}\" has no size \"{$size}\"."];
                    continue;
                }
            } elseif (!$variant && ($variantsByProduct->get($product->id)?->isNotEmpty() ?? false)) {
                $problems[] = ['row' => $line, 'message' => "\"{$itemName}\" comes in sizes - put the size in the Size column, or write it into the description."];
                continue;
            }

            $quantity = $this->number($cell('quantity'));
            if ($quantity === null || $quantity <= 0) {
                $problems[] = ['row' => $line, 'message' => 'Quantity must be a number greater than zero.'];
                continue;
            }

            // Sizes rarely carry their own cost, so they fall back to the item's, as the form does.
            $unitPrice = $this->number($cell('unit_price'));
            if ($unitPrice === null) {
                $unitPrice = (float) ($variant && $variant->cost > 0 ? $variant->cost : $product->unit_cost);
            }

            $lines[] = [
                'product_id' => $product->id,
                'variant_id' => $variant?->id,
                'item_name' => $variant ? ProductVariant::sizedName($product->name, $variant->name) : $product->name,
                'item_number' => $product->item_number,
                'quantity' => (int) $quantity,
                'unit_price' => round($unitPrice, 2),
                'row' => $line,
            ];
        }

        if (!$lines) {
            return response()->json([
                'status' => 'failed',
                'message' => $problems
                    ? 'No items could be matched. ' . $problems[0]['message']
                    : 'The sheet has no item rows.',
            ], 422);
        }

        return response()->json([
            'status' => 'success',
            'header' => $header,
            'lines' => $lines,
            'problems' => $problems,
        ]);
    }

    /**
     * Read a delivery sheet against one purchase order and hand the lines back to the Create
     * Product Receipt form, saving nothing. Items are matched only against that order's
     * outstanding lines, because stock can only be received against what was actually ordered.
     * Several rows for the same line become several batch lines, as "Split batch" does by hand.
     */
    public function parseProductReceipt(Request $request)
    {
        $schema = ImportSchemas::get('product_receipt_items');

        $validator = Validator::make($request->all(), [
            'file' => 'required|file|mimes:xlsx,xls,csv,txt|max:10240',
            'purchase_order_id' => 'required|string',
        ]);
        if ($validator->fails()) {
            return response()->json(['status' => 'failed', 'message' => $validator->errors()], 400);
        }

        $user = $request->user();
        if (!$this->hasPermission($request, $schema['permission'], $user->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'You do not have permission to create product receipts.'], 403);
        }

        $order = \App\Models\PurchaseOrder::with('items.product', 'items.variant')
            ->where('company_id', $user->company_id)
            ->find($request->input('purchase_order_id'));
        if (!$order) {
            return response()->json(['status' => 'failed', 'message' => 'That purchase order could not be found.'], 404);
        }

        try {
            $rows = \PhpOffice\PhpSpreadsheet\IOFactory::load($request->file('file')->getRealPath())
                ->getSheet(0)
                ->toArray(null, true, false, false);
        } catch (\Throwable $e) {
            return response()->json(['status' => 'failed', 'message' => 'Could not read the file: ' . $e->getMessage()], 422);
        }

        $headingRow = $this->findHeadingRow($rows, $schema);
        if ($headingRow === null) {
            return response()->json([
                'status' => 'failed',
                'message' => "This sheet's headings don't match the template. Download the template and paste your delivery under its headings.",
            ], 422);
        }

        $columns = ImportSchemas::mapHeadings($schema, $rows[$headingRow]);
        if ($missing = ImportSchemas::missingRequired($schema, $columns)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'These required columns are missing from the sheet: ' . implode(', ', $missing) . '.',
            ], 422);
        }

        // Only the order's outstanding lines are matchable, keyed by what the item is called.
        $outstanding = [];
        $byName = [];
        foreach ($order->items as $item) {
            $pending = max(0, (int) $item->quantity - (int) $item->received_quantity);
            if ($pending <= 0 || !$item->product) {
                continue;
            }
            $outstanding[$item->id] = $pending;
            $name = $item->variant
                ? ProductVariant::sizedName($item->product->name, $item->variant->name)
                : $item->product->name;
            $byName[$this->nameKey($name)][] = $item;
            if ($item->variant) {
                // "Plain name + Size column" has to reach the same line as the full description.
                $byName[$this->nameKey($item->product->name)][] = $item;
            }
        }
        if (!$outstanding) {
            return response()->json(['status' => 'failed', 'message' => 'Nothing is still outstanding on that purchase order.'], 422);
        }

        $cells = $this->rowReader($columns);
        $header = ['reference_number' => null, 'shipping_cost' => null, 'logistics_cost' => null];
        $lines = [];
        $problems = [];
        $takenPerLine = [];

        foreach (array_slice($rows, $headingRow + 1) as $offset => $row) {
            if ($this->isBlankRow($row)) {
                continue;
            }
            $cell = $cells($row);
            $line = $headingRow + $offset + 2;

            if ($header['reference_number'] === null && $cell('reference_number') !== '') {
                $header['reference_number'] = $cell('reference_number');
            }
            foreach (['shipping_cost', 'logistics_cost'] as $field) {
                if ($header[$field] === null && $cell($field) !== '') {
                    $header[$field] = $this->number($cell($field));
                }
            }

            $itemName = $cell('item_name');
            if ($itemName === '') {
                continue;
            }
            $size = $cell('size');
            $matches = $byName[$this->nameKey($itemName)] ?? [];
            if ($size !== '') {
                $matches = array_values(array_filter(
                    $matches,
                    fn ($m) => $m->variant && $this->sizeKey($m->variant->name) === $this->sizeKey($size)
                ));
            }
            $matches = collect($matches)->unique('id')->values()->all();

            if (!$matches) {
                $problems[] = ['row' => $line, 'message' => "\"{$itemName}\"" . ($size !== '' ? " size \"{$size}\"" : '')
                    . ' is not outstanding on this purchase order.'];
                continue;
            }
            if (count($matches) > 1) {
                $problems[] = ['row' => $line, 'message' => "\"{$itemName}\" matches more than one line on the order - add the size."];
                continue;
            }
            $poItem = $matches[0];

            $quantity = $this->number($cell('quantity'));
            if ($quantity === null || $quantity <= 0) {
                $problems[] = ['row' => $line, 'message' => 'Quantity Received must be a number greater than zero.'];
                continue;
            }

            // Batch rows for one order line share that line's outstanding quantity.
            $alreadyTaken = $takenPerLine[$poItem->id] ?? 0;
            $room = $outstanding[$poItem->id] - $alreadyTaken;
            if ($room <= 0) {
                $problems[] = ['row' => $line, 'message' => "\"{$itemName}\" is already fully received by earlier rows in this sheet."];
                continue;
            }
            if ($quantity > $room) {
                $problems[] = ['row' => $line, 'message' => "\"{$itemName}\": only {$room} still outstanding, so {$quantity} was reduced to {$room}."];
                $quantity = $room;
            }
            $takenPerLine[$poItem->id] = $alreadyTaken + $quantity;

            $manufactureDate = $this->date($cell('manufacture_date'));
            $expiryDate = $this->date($cell('expiry_date'));
            foreach (['Manufacture Date' => $manufactureDate, 'Expiry Date' => $expiryDate] as $label => $value) {
                if ($value === false) {
                    $problems[] = ['row' => $line, 'message' => "{$label} could not be read. Use YYYY-MM-DD."];
                }
            }

            $lines[] = [
                'purchase_order_item_id' => $poItem->id,
                'product_id' => $poItem->product_id,
                'variant_id' => $poItem->variant_id,
                'item_name' => $poItem->variant
                    ? ProductVariant::sizedName($poItem->product->name, $poItem->variant->name)
                    : $poItem->product->name,
                'quantity' => (int) $quantity,
                'unit_price' => round($this->number($cell('unit_price')) ?? (float) $poItem->unit_price, 2),
                'batch_number' => $cell('batch_number') ?: null,
                'lot_number' => $cell('lot_number') ?: null,
                'manufacture_date' => $manufactureDate ?: null,
                'expiry_date' => $expiryDate ?: null,
                'notes' => $cell('notes') ?: null,
                'row' => $line,
            ];
        }

        if (!$lines) {
            return response()->json([
                'status' => 'failed',
                'message' => $problems
                    ? 'No lines could be matched. ' . $problems[0]['message']
                    : 'The sheet has no item rows.',
            ], 422);
        }

        return response()->json([
            'status' => 'success',
            'header' => $header,
            'lines' => $lines,
            'problems' => $problems,
        ]);
    }
}
