<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Str;
use App\Models\Product;
use App\Models\ProductReceipt;
use App\Models\ProductReceiptItem;
use App\Models\Store;
use App\Models\User;
use App\Models\Supplier;
use App\Models\Company;

class ProductReceiptSampleSeeder extends Seeder
{
    public function run(): void
    {
        $this->command->info('🌱 Starting product receipt seeding...');

        // Get Cherry Distributors company (created by TestDataSeeder)
        $company = Company::where('name', 'Cherry Distributors Ltd')->first();
        if (!$company) {
            $this->command->error('❌ No Cherry Distributors company found. Please run TestDataSeeder first.');
            return;
        }

        $store = Store::where('company_id', $company->id)->first();
        if (!$store) {
            $this->command->error('❌ No store found for company.');
            return;
        }

        $user = User::where('company_id', $company->id)->first();
        if (!$user) {
            $this->command->error('❌ No user found for company.');
            return;
        }

        $supplier = Supplier::where('company_id', $company->id)->first();
        if (!$supplier) {
            $this->command->error('❌ No supplier found for company.');
            return;
        }

        // Get first 4 products in stock
        $products = Product::where('company_id', $company->id)
            ->where('stock_quantity', '>', 0)
            ->limit(4)
            ->get();

        if ($products->count() < 4) {
            $this->command->warn('⚠️  Found only ' . $products->count() . ' products in stock.');
        }

        $this->command->info('📦 Creating product receipts for ' . $products->count() . ' products...');

        // Sample batch and expiry data
        $batchSamples = [
            ['batch' => 'BATCH-2026-JAN-001', 'expiry' => '2027-12-31', 'mfg' => '2026-01-15'],
            ['batch' => 'BATCH-2026-FEB-002', 'expiry' => '2027-06-30', 'mfg' => '2026-02-10'],
            ['batch' => 'BATCH-2026-MAR-003', 'expiry' => '2028-03-15', 'mfg' => '2026-03-20'],
            ['batch' => 'BATCH-2026-APR-004', 'expiry' => '2027-09-20', 'mfg' => '2026-04-05'],
            ['batch' => 'BATCH-2026-MAY-005', 'expiry' => '2028-01-10', 'mfg' => '2026-05-12'],
            ['batch' => 'BATCH-2026-JUN-006', 'expiry' => '2027-05-05', 'mfg' => '2026-06-18'],
        ];

        $receiptNumber = 1;
        $batchIndex = 0;

        foreach ($products as $index => $product) {
            // First 2 products get 3 receipts, last 2 get 1 receipt each
            $receiptCount = ($index < 2) ? 3 : 1;

            $this->command->info("  📦 {$product->product_code} - {$product->name}");
            $currentStock = $product->stock_quantity;

            for ($r = 0; $r < $receiptCount; $r++) {
                $batchData = $batchSamples[$batchIndex % count($batchSamples)];
                $quantity = rand(100, 300);

                // Create Product Receipt
                $receipt = ProductReceipt::create([
                    'id' => Str::uuid(),
                    'company_id' => $company->id,
                    'supplier_id' => $supplier->id,
                    'document_type' => 'receipt',
                    'product_receipt_number' => 'PR-' . str_pad($receiptNumber, 6, '0', STR_PAD_LEFT),
                    'reference_number' => 'REF-' . str_pad($receiptNumber, 5, '0', STR_PAD_LEFT),
                    'received_by' => $user->id,
                    'store_id' => $store->id,
                ]);

                // Create Product Receipt Item with batch and expiry
                ProductReceiptItem::create([
                    'id' => Str::uuid(),
                    'company_id' => $company->id,
                    'product_receipt_id' => $receipt->id,
                    'product_id' => $product->id,
                    'quantity' => $quantity,
                    'unit_quantity' => rand(1, 5),
                    'batch_number' => $batchData['batch'],
                    'expiry_date' => $batchData['expiry'],
                    'unit_price' => $product->unit_cost,
                    'supplier_id' => $supplier->id,
                    'supplier' => $supplier->name,
                    'manufacture_date' => $batchData['mfg'],
                ]);

                // Increment product stock
                $product->increment('stock_quantity', $quantity);
                $currentStock += $quantity;

                $this->command->line("    ✓ Receipt: {$receipt->product_receipt_number}");
                $this->command->line("      Batch: {$batchData['batch']} | Expiry: {$batchData['expiry']}");
                $this->command->line("      Qty: +{$quantity} | Stock now: {$currentStock}");

                $receiptNumber++;
                $batchIndex++;
            }

            $this->command->newLine();
        }

        $this->command->info('✅ Product receipt seeding completed!');
        $this->command->info('📊 Created ' . ($receiptNumber - 1) . ' receipts');
        $this->command->info('💾 Product stock quantities have been incremented accordingly');
    }
}
