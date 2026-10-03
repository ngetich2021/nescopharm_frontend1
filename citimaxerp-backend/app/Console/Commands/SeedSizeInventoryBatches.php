<?php

namespace App\Console\Commands;

use App\Models\InventoryBatch;
use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Test/dev only: gives every size of a multi-size product its own batches, with a deliberate
 * spread of expiry dates and a few deliberately awkward cases (a size with no stock at all, a
 * size holding only a nearly-expired batch), so FEFO allocation, expiry reporting and
 * dispatch-by-size have real data to work against.
 *
 * Batches are named DEMO-<item no>-<size>-<letter> so they are obvious in the UI and easy to
 * remove again with --fresh. Safe to re-run: sizes that already have batches are skipped.
 */
class SeedSizeInventoryBatches extends Command
{
    protected $signature = 'sizes:seed-test-batches
                            {--company= : Limit to one company id}
                            {--fresh : Delete previously seeded DEMO size batches first and reseed}';

    protected $description = 'Seed demo inventory batches (mixed expiry) for each size of multi-size products - test/dev only';

    private const PREFIX = 'DEMO-';

    public function handle(): int
    {
        $products = Product::query()
            ->whereRaw('has_variations = true')
            ->when($this->option('company'), fn ($q, $id) => $q->where('company_id', $id))
            ->with('variants')
            ->get()
            ->filter(fn ($p) => $p->variants->isNotEmpty());

        if ($products->isEmpty()) {
            $this->warn('No multi-size products found. Run products:backfill-sizes first.');
            return self::SUCCESS;
        }

        $created = 0;
        $skipped = 0;
        $emptySizes = 0;

        DB::transaction(function () use ($products, &$created, &$skipped, &$emptySizes) {
            foreach ($products as $product) {
                $itemNo = $product->item_number ?? substr($product->id, 0, 4);
                // Sizes share the item's price code, so every batch of every size sells at that price.
                $sellingPrice = (float) ($product->priceTiers()->max('price') ?? $product->price ?? 0);
                $unitCost = (float) ($product->unit_cost ?: round($sellingPrice * 0.6, 2));

                foreach ($product->variants->values() as $i => $variant) {
                    if ($this->option('fresh')) {
                        InventoryBatch::where('variant_id', $variant->id)
                            ->where('batch_number', 'like', self::PREFIX . '%')
                            ->delete();
                    }

                    if ($variant->inventoryBatches()->exists()) {
                        $skipped++;
                        continue;
                    }

                    // Every 7th size is left with no stock at all - a real case staff hit, and the
                    // one most likely to break a dispatch or an order that assumes stock exists.
                    if ($i % 7 === 3) {
                        $variant->update(['stock_quantity' => 0, 'on_hand' => 0, 'allocated' => 0]);
                        $emptySizes++;
                        continue;
                    }

                    $plan = $this->batchPlan($i);
                    $available = 0;

                    foreach ($plan as $letter => $batch) {
                        InventoryBatch::create([
                            'id' => (string) Str::uuid(),
                            'company_id' => $product->company_id,
                            'store_id' => $product->store_id,
                            'product_id' => $product->id,
                            'variant_id' => $variant->id,
                            'batch_number' => $this->batchNumber($itemNo, $variant->name, $letter),
                            'lot_number' => 'LOT-' . str_pad((string) (($i + 1) * 37 % 1000), 3, '0', STR_PAD_LEFT),
                            'quantity_received' => $batch['received'],
                            'quantity_available' => $batch['available'],
                            'quantity_expired' => $batch['expired'],
                            'manufacture_date' => now()->subDays($batch['received_days_ago'] + 45)->toDateString(),
                            'expiry_date' => now()->addDays($batch['expiry_in_days'])->toDateString(),
                            'received_date' => now()->subDays($batch['received_days_ago'])->toDateString(),
                            'unit_cost' => $unitCost,
                            'selling_price' => $sellingPrice,
                            'status' => $batch['status'],
                            'supplier' => 'Demo Supplier Ltd',
                            'notes' => 'Seeded demo batch (sizes:seed-test-batches)',
                        ]);
                        $created++;
                        $available += $batch['available'];
                    }

                    $variant->update(['stock_quantity' => $available, 'on_hand' => $available, 'allocated' => 0]);
                }

                // The product row reports the roll-up of its sizes.
                $product->update(['stock_quantity' => (int) $product->variants()->sum('stock_quantity')]);
            }
        });

        $this->info("Created {$created} demo batches across {$products->count()} products.");
        $this->line("  {$emptySizes} sizes deliberately left with no stock, {$skipped} sizes skipped (already had batches).");
        if ($skipped > 0) {
            $this->line('  Re-run with --fresh to replace previously seeded demo batches.');
        }

        return self::SUCCESS;
    }

    /**
     * Quantities and dates vary by position so the data isn't uniform: a near-expiry batch that
     * FEFO must pick first, a long-dated one behind it, and on every third size an already-expired
     * batch holding no stock.
     */
    private function batchPlan(int $i): array
    {
        $base = 15 + ($i * 7) % 40;

        $plan = [
            'A' => [
                'received' => $base,
                'available' => $base,
                'expired' => 0,
                'received_days_ago' => 70,
                'expiry_in_days' => 15 + $i % 10,
                'status' => 'active',
            ],
            'B' => [
                'received' => $base * 2,
                'available' => $base * 2,
                'expired' => 0,
                'received_days_ago' => 20,
                'expiry_in_days' => 200 + $i * 5,
                'status' => 'active',
            ],
        ];

        if ($i % 3 === 0) {
            $plan['X'] = [
                'received' => 6,
                'available' => 0,
                'expired' => 6,
                'received_days_ago' => 400,
                'expiry_in_days' => -12,
                'status' => 'expired',
            ];
        }

        return $plan;
    }

    private function batchNumber(string|int $itemNo, ?string $size, string $letter): string
    {
        $slug = preg_replace('/[^A-Za-z0-9.]/', '', (string) $size) ?: 'NA';
        return self::PREFIX . $itemNo . '-' . $slug . '-' . $letter;
    }
}
