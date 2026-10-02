<?php

namespace App\Console\Commands;

use App\Models\InventoryBatch;
use App\Models\Product;
use Illuminate\Console\Command;
use Illuminate\Support\Str;

/**
 * Test/dev only: creates real inventory_batches rows for existing products
 * so FEFO allocation, expiry-status reporting, and the batch dashboard have
 * actual data to work with instead of an empty table. Idempotent - skips
 * any product that already has batches, so it's safe to re-run.
 */
class SeedTestInventoryBatches extends Command
{
    protected $signature = 'batches:seed-test-data {--company= : Limit to one company_id}';
    protected $description = 'Seed realistic inventory batches (mixed expiry dates) for existing track_inventory products - test/dev environments only';

    public function handle(): int
    {
        $query = Product::whereRaw('track_inventory::int = 1')->where('stock_quantity', '>', 0);
        if ($companyId = $this->option('company')) {
            $query->where('company_id', $companyId);
        }

        $products = $query->get();
        $created = 0;
        $skipped = 0;

        foreach ($products as $product) {
            if ($product->inventoryBatches()->exists()) {
                $skipped++;
                continue;
            }

            $stock = (int) $product->stock_quantity;

            // Split current stock across three batches with different
            // received/expiry dates, so FEFO has something real to sort
            // between - roughly 20% expiring soon, 30% mid-term, 50% long-dated.
            $qtySoon = (int) max(1, round($stock * 0.2));
            $qtyMid = (int) max(0, round($stock * 0.3));
            $qtyLong = max(0, $stock - $qtySoon - $qtyMid);

            $plan = [
                ['qty' => $qtySoon, 'received_days_ago' => 60, 'expiry_days' => 18],
                ['qty' => $qtyMid, 'received_days_ago' => 30, 'expiry_days' => 120],
                ['qty' => $qtyLong, 'received_days_ago' => 5, 'expiry_days' => 365],
            ];

            foreach ($plan as $batchPlan) {
                if ($batchPlan['qty'] <= 0) {
                    continue;
                }

                InventoryBatch::create([
                    'id' => (string) Str::uuid(),
                    'company_id' => $product->company_id,
                    'store_id' => $product->store_id,
                    'product_id' => $product->id,
                    'batch_number' => InventoryBatch::generateBatchNumber($product->company_id, $product->id),
                    'quantity_received' => $batchPlan['qty'],
                    'quantity_available' => $batchPlan['qty'],
                    'manufacture_date' => now()->subDays($batchPlan['received_days_ago'] + 30)->toDateString(),
                    'expiry_date' => now()->addDays($batchPlan['expiry_days'])->toDateString(),
                    'received_date' => now()->subDays($batchPlan['received_days_ago'])->toDateString(),
                    'unit_cost' => $product->unit_cost,
                    'selling_price' => $product->price,
                    'status' => 'active',
                    'notes' => 'Seeded test batch (batches:seed-test-data)',
                ]);
                $created++;
            }

            // One extra, already-expired batch per product with a small
            // residual quantity, purely so expired-status reporting/filters
            // have something real to show. Not counted in available stock.
            InventoryBatch::create([
                'id' => (string) Str::uuid(),
                'company_id' => $product->company_id,
                'store_id' => $product->store_id,
                'product_id' => $product->id,
                'batch_number' => InventoryBatch::generateBatchNumber($product->company_id, $product->id),
                'quantity_received' => 5,
                'quantity_available' => 0,
                'quantity_expired' => 5,
                'manufacture_date' => now()->subDays(400)->toDateString(),
                'expiry_date' => now()->subDays(10)->toDateString(),
                'received_date' => now()->subDays(370)->toDateString(),
                'unit_cost' => $product->unit_cost,
                'selling_price' => $product->price,
                'status' => 'expired',
                'notes' => 'Seeded test batch (batches:seed-test-data) - already expired',
            ]);
            $created++;
        }

        $this->info("Seeded {$created} batches across " . ($products->count() - $skipped) . " products ({$skipped} skipped - already had batches).");

        return self::SUCCESS;
    }
}
