<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

class ExportProductsToExcel extends Command
{
    protected $signature = 'products:export
        {--company= : Company UUID to export (defaults to the only company if there is exactly one)}
        {--out=products_export.xlsx : Output .xlsx file path}';

    protected $description = 'Export all existing products (and variants) into the Product_Import_Template.xlsx format for editing and re-import';

    private const HEADER = [
        'Name*', 'Product Code', 'SKU', 'Barcode', 'Category', 'Brand', 'Supplier',
        'Unit of Measurement', 'Price', 'Unit Cost', 'Stock Quantity', 'Low Stock Threshold',
        'Is Active', 'Is Taxable', 'Tax Rate (%)', 'HS Code', 'Description',
        'Has Variations', 'Variant Name', 'Variant SKU', 'Variant Price', 'Variant Cost',
        'Variant Stock Quantity', 'Variant Attributes',
    ];

    public function handle(): int
    {
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

        $products = DB::table('products')
            ->where('company_id', $companyId)
            ->orderBy('product_number')
            ->get();

        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Products');

        foreach (self::HEADER as $i => $title) {
            $sheet->setCellValue([$i + 1, 1], $title);
        }
        $sheet->getStyle('A1:X1')->getFont()->setBold(true)->getColor()->setRGB('FFFFFF');
        $sheet->getStyle('A1:X1')->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('1F4E78');
        $sheet->freezePane('A2');

        $rowNum = 2;
        $variantCount = 0;

        foreach ($products as $product) {
            $variants = $product->has_variations === true || $product->has_variations === 't' || $product->has_variations === 'true'
                ? DB::table('product_variants')->where('product_id', $product->id)->orderBy('created_at')->get()
                : collect();

            if ($variants->isEmpty()) {
                $this->writeRow($sheet, $rowNum++, $product, null);
            } else {
                foreach ($variants as $variant) {
                    $this->writeRow($sheet, $rowNum++, $product, $variant);
                    $variantCount++;
                }
            }
        }

        foreach (range('A', 'X') as $col) {
            $sheet->getColumnDimension($col)->setAutoSize(true);
        }

        $writer = new Xlsx($spreadsheet);
        $outPath = $this->option('out');
        $writer->save($outPath);

        $this->newLine();
        $this->info("Exported {$products->count()} products ({$variantCount} variant rows) to {$outPath}");
        $this->line('This file uses the same column format as the import template — edit values and re-run products:import to apply changes (existing SKUs will be updated, not duplicated).');

        return self::SUCCESS;
    }

    private function writeRow($sheet, int $rowNum, object $product, ?object $variant): void
    {
        $hasVariations = $variant !== null;

        $sheet->setCellValue([1, $rowNum], $product->name);
        $sheet->setCellValue([2, $rowNum], $product->product_code);
        $sheet->setCellValue([3, $rowNum], $product->sku);
        $sheet->setCellValue([4, $rowNum], $product->barcode);
        $sheet->setCellValue([5, $rowNum], $product->category);
        $sheet->setCellValue([6, $rowNum], $product->brand);
        $sheet->setCellValue([7, $rowNum], $product->supplier);
        $sheet->setCellValue([8, $rowNum], $product->unit_of_measurement);
        $sheet->setCellValue([9, $rowNum], $hasVariations ? null : $product->price);
        $sheet->setCellValue([10, $rowNum], $hasVariations ? null : $product->unit_cost);
        $sheet->setCellValue([11, $rowNum], $hasVariations ? null : $product->stock_quantity);
        $sheet->setCellValue([12, $rowNum], $product->low_stock_threshold);
        $sheet->setCellValue([13, $rowNum], $this->boolToYesNo($product->is_active));
        $sheet->setCellValue([14, $rowNum], $this->boolToYesNo($product->is_taxable));
        $sheet->setCellValue([15, $rowNum], $product->tax_rate);
        $sheet->setCellValue([16, $rowNum], $product->hs_code);
        $sheet->setCellValue([17, $rowNum], $product->description);
        $sheet->setCellValue([18, $rowNum], $hasVariations ? 'Yes' : 'No');

        if ($hasVariations) {
            $sheet->setCellValue([19, $rowNum], $variant->name);
            $sheet->setCellValue([20, $rowNum], $variant->sku);
            $sheet->setCellValue([21, $rowNum], $variant->price);
            $sheet->setCellValue([22, $rowNum], $variant->cost);
            $sheet->setCellValue([23, $rowNum], $variant->stock_quantity);
            $sheet->setCellValue([24, $rowNum], $this->attributesToString($variant->attributes));
        }
    }

    private function boolToYesNo($value): string
    {
        $truthy = $value === true || $value === 't' || $value === 'true' || $value === 1 || $value === '1';
        return $truthy ? 'Yes' : 'No';
    }

    private function attributesToString(?string $json): string
    {
        if (!$json) {
            return '';
        }
        $decoded = json_decode($json, true);
        if (!is_array($decoded)) {
            return '';
        }
        $pairs = [];
        foreach ($decoded as $key => $value) {
            $pairs[] = "{$key}={$value}";
        }
        return implode(';', $pairs);
    }
}
