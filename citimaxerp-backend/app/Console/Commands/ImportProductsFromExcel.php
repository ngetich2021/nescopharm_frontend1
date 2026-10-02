<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use PhpOffice\PhpSpreadsheet\IOFactory;

class ImportProductsFromExcel extends Command
{
    protected $signature = 'products:import
        {file : Path to the .xlsx file}
        {--company= : Company UUID to assign the products to (defaults to the only company if there is exactly one)}
        {--store= : Optional store UUID}
        {--dry-run : Validate and preview without writing to the database}';

    protected $description = 'Bulk import products (and their variations) from the Product_Import_Template.xlsx format directly into the database';

    // Example rows shipped in the template, auto-skipped if left in place
    private const EXAMPLE_CODES = ['BEV-CC-500', 'GR-MF-2KG', 'APP-TS-001'];

    private const EXPECTED_HEADER = [
        'Name*', 'Product Code', 'SKU', 'Barcode', 'Category', 'Brand', 'Supplier',
        'Unit of Measurement', 'Price', 'Unit Cost', 'Stock Quantity', 'Low Stock Threshold',
        'Is Active', 'Is Taxable', 'Tax Rate (%)', 'HS Code', 'Description',
        'Has Variations', 'Variant Name', 'Variant SKU', 'Variant Price', 'Variant Cost',
        'Variant Stock Quantity', 'Variant Attributes',
    ];

    public function handle(): int
    {
        $path = $this->argument('file');
        if (!file_exists($path)) {
            $this->error("File not found: {$path}");
            return self::FAILURE;
        }

        $companyId = $this->option('company');
        if (!$companyId) {
            $companies = DB::table('companies')->select('id', 'name')->get();
            if ($companies->count() === 1) {
                $companyId = $companies->first()->id;
                $this->info("Using company: {$companies->first()->name} ({$companyId})");
            } else {
                $this->error('Multiple companies found — pass --company=<uuid>. Options: '
                    . $companies->map(fn($c) => "{$c->name} ({$c->id})")->implode(', '));
                return self::FAILURE;
            }
        }

        $storeId = $this->option('store');
        $dryRun = (bool) $this->option('dry-run');

        $spreadsheet = IOFactory::load($path);
        $sheet = $spreadsheet->getSheetByName('Products') ?? $spreadsheet->getActiveSheet();
        $rows = $sheet->toArray(null, true, true, false);

        $header = array_map(fn($h) => trim((string) $h), $rows[0] ?? []);
        if (array_slice($header, 0, count(self::EXPECTED_HEADER)) !== self::EXPECTED_HEADER) {
            $this->error('Column headers do not match the expected Product_Import_Template.xlsx format.');
            return self::FAILURE;
        }

        // Pass 1: parse rows, skip blanks/examples, group by product-level SKU (or Name if no SKU)
        $groups = [];   // groupKey => ['rows' => [...]]
        $groupOrder = [];

        for ($i = 1; $i < count($rows); $i++) {
            $row = $rows[$i];
            $rowNum = $i + 1;

            $name = trim((string) ($row[0] ?? ''));
            if ($name === '') {
                continue; // blank row
            }

            $productCode = $this->nullableString($row[1] ?? null);
            if (in_array($productCode, self::EXAMPLE_CODES, true)) {
                $this->line("Row {$rowNum}: skipped example row ({$productCode})");
                continue;
            }

            $sku = $this->nullableString($row[2] ?? null);
            $groupKey = $sku ?? ('name:' . strtolower($name));

            if (!isset($groups[$groupKey])) {
                $groups[$groupKey] = [];
                $groupOrder[] = $groupKey;
            }
            $groups[$groupKey][] = ['rowNum' => $rowNum, 'row' => $row, 'name' => $name, 'sku' => $sku];
        }

        $productsCreated = 0;
        $productsUpdated = 0;
        $variantsCreated = 0;
        $variantsUpdated = 0;
        $skipped = 0;
        $errors = [];
        $now = now();

        foreach ($groupOrder as $groupKey) {
            $groupRows = $groups[$groupKey];
            $first = $groupRows[0];
            $row = $first['row'];
            $rowNum = $first['rowNum'];

            $hasVariations = collect($groupRows)->contains(
                fn($r) => $this->yesNo($r['row'][17] ?? null, false)
            );

            // Product-level SKU: if it already exists for this company, update it in place instead of inserting
            $existingProduct = $first['sku'] !== null
                ? DB::table('products')->where('company_id', $companyId)->where('sku', $first['sku'])->first()
                : null;

            $productId = $existingProduct->id ?? (string) Str::uuid();
            $productData = [
                'company_id' => $companyId,
                'store_id' => $storeId,
                'product_code' => $this->nullableString($row[1] ?? null),
                'name' => ucwords(strtolower($first['name'])),
                'description' => $this->nullableString($row[16] ?? null),
                'price' => $hasVariations ? null : $this->nullableDecimal($row[8] ?? null),
                'unit_cost' => $hasVariations ? null : $this->nullableDecimal($row[9] ?? null),
                'stock_quantity' => $hasVariations ? 0 : (int) ($this->nullableDecimal($row[10] ?? null) ?? 0),
                'on_hand' => $hasVariations ? 0 : (int) ($this->nullableDecimal($row[10] ?? null) ?? 0),
                'low_stock_threshold' => $this->nullableDecimal($row[11] ?? null) ?? 10,
                'category' => $this->nullableString($row[4] ?? null),
                'sku' => $first['sku'],
                'barcode' => $this->nullableString($row[3] ?? null),
                'brand' => $this->nullableString($row[5] ?? null),
                'supplier' => $this->nullableString($row[6] ?? null),
                'unit_of_measurement' => $this->nullableString($row[7] ?? null),
                'is_active' => $this->pgBool($this->yesNo($row[12] ?? null, true)),
                'is_taxable' => $this->pgBool($this->yesNo($row[13] ?? null, false)),
                'tax_rate' => $this->nullableDecimal($row[14] ?? null),
                'hs_code' => $this->nullableString($row[15] ?? null),
                'has_variations' => $this->pgBool($hasVariations),
                'updated_at' => $now,
            ];

            if ($existingProduct) {
                $action = 'updated';
                if (!$dryRun) {
                    DB::table('products')->where('id', $productId)->update($productData);
                }
                $productsUpdated++;
            } else {
                $action = 'created';
                $productData = array_merge($productData, [
                    'id' => $productId,
                    'product_number' => $this->generateProductNumber($companyId),
                    'track_inventory' => $this->pgBool(true),
                    'is_featured' => $this->pgBool(false),
                    'is_digital' => $this->pgBool(false),
                    'has_packaging' => $this->pgBool(false),
                    'base_unit' => 'piece',
                    'primary_image_index' => 0,
                    'images' => json_encode([]),
                    'allocated' => 0,
                    'created_at' => $now,
                ]);
                if (!$dryRun) {
                    DB::table('products')->insert($productData);
                }
                $productsCreated++;
            }

            $label = $dryRun ? "would be {$action}" : $action;
            $this->line("Row {$rowNum}: {$label} '{$productData['name']}'"
                . ($first['sku'] ? " (SKU {$first['sku']})" : '')
                . ($hasVariations ? ' with ' . count($groupRows) . ' variant(s)' : ''));

            if (!$hasVariations) {
                continue;
            }

            foreach ($groupRows as $gr) {
                $vRow = $gr['row'];
                $vRowNum = $gr['rowNum'];

                $variantName = $this->nullableString($vRow[18] ?? null);
                $variantSku = $this->nullableString($vRow[19] ?? null);

                if ($variantName === null || $variantSku === null) {
                    $errors[] = "Row {$vRowNum}: 'Has Variations' is Yes but Variant Name or Variant SKU is missing — variant skipped";
                    $skipped++;
                    continue;
                }

                $existingVariant = DB::table('product_variants')
                    ->where('company_id', $companyId)
                    ->where('sku', $variantSku)
                    ->first();

                $variantStock = (int) ($this->nullableDecimal($vRow[22] ?? null) ?? 0);
                $variantData = [
                    'product_id' => $productId,
                    'company_id' => $companyId,
                    'store_id' => $storeId,
                    'name' => $variantName,
                    'sku' => $variantSku,
                    'price' => $this->nullableDecimal($vRow[20] ?? null),
                    'cost' => $this->nullableDecimal($vRow[21] ?? null),
                    'stock_quantity' => $variantStock,
                    'on_hand' => $variantStock,
                    'attributes' => json_encode($this->parseAttributes($vRow[23] ?? null)),
                    'updated_at' => $now,
                ];

                if ($existingVariant) {
                    $vAction = 'updated';
                    if (!$dryRun) {
                        DB::table('product_variants')->where('id', $existingVariant->id)->update($variantData);
                    }
                    $variantsUpdated++;
                } else {
                    $vAction = 'created';
                    $variantData = array_merge($variantData, [
                        'id' => (string) Str::uuid(),
                        'is_active' => $this->pgBool(true),
                        'created_at' => $now,
                        'allocated' => 0,
                        'images' => json_encode([]),
                    ]);
                    if (!$dryRun) {
                        DB::table('product_variants')->insert($variantData);
                    }
                    $variantsCreated++;
                }

                $vLabel = $dryRun ? "would be {$vAction}" : $vAction;
                $this->line("  Row {$vRowNum}: variant {$vLabel} '{$variantName}' (SKU {$variantSku})");
            }
        }

        $this->newLine();
        $this->info(($dryRun ? '[DRY RUN] ' : '') . "Done. Products created: {$productsCreated}, updated: {$productsUpdated}. Variants created: {$variantsCreated}, updated: {$variantsUpdated}. Skipped: {$skipped}");
        foreach ($errors as $e) {
            $this->warn($e);
        }

        return self::SUCCESS;
    }

    private function nullableString($value): ?string
    {
        $value = trim((string) ($value ?? ''));
        return $value === '' ? null : $value;
    }

    private function nullableDecimal($value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }
        return is_numeric($value) ? (float) $value : null;
    }

    private function pgBool(bool $value): string
    {
        return $value ? 'true' : 'false';
    }

    private function yesNo($value, bool $default): bool
    {
        $value = strtolower(trim((string) ($value ?? '')));
        if ($value === '') {
            return $default;
        }
        return in_array($value, ['yes', 'y', 'true', '1'], true);
    }

    private function parseAttributes($value): array
    {
        $value = trim((string) ($value ?? ''));
        if ($value === '') {
            return [];
        }
        $attributes = [];
        foreach (explode(';', $value) as $pair) {
            $pair = trim($pair);
            if ($pair === '' || !str_contains($pair, '=')) {
                continue;
            }
            [$key, $val] = explode('=', $pair, 2);
            $key = trim($key);
            $val = trim($val);
            if ($key !== '') {
                $attributes[$key] = $val;
            }
        }
        return $attributes;
    }

    private function generateProductNumber(string $companyId): string
    {
        $prefix = 'PROD-' . substr($companyId, 0, 8) . '-';

        $lastProduct = DB::table('products')
            ->select('product_number')
            ->where('company_id', $companyId)
            ->where('product_number', 'like', $prefix . '%')
            ->orderBy('product_number', 'desc')
            ->lockForUpdate()
            ->first();

        $nextNumber = $lastProduct ? (int) substr($lastProduct->product_number, strlen($prefix)) + 1 : 1;
        return $prefix . str_pad((string) $nextNumber, 4, '0', STR_PAD_LEFT);
    }
}
