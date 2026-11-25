<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Stock is the sum of a product's batches. The stored stock figure on a product (and on each
 * variant) is a copy that some screens read - requisitions, orders, product lists - and it can
 * drift when a path changes a batch without refreshing it (e.g. a batch's expiry corrected after
 * a stock count had left it out as expired: Plaster Of Paris 4" showed 0 with 11,287 in batches).
 * This lists every product/variant whose figure differs from its batches and, with --fix, sets it.
 * Products with no batches at all are left alone.
 */
class SyncStockFromBatches extends Command
{
    protected $signature = 'stock:sync-from-batches {--fix : Write the batch totals (otherwise only list the differences)}';
    protected $description = 'Find (and with --fix correct) product and variant stock figures that differ from the sum of their batches.';

    public function handle(): int
    {
        $products = DB::select("
            SELECT p.id, p.name, p.stock_quantity AS stored, b.total
            FROM products p
            JOIN (SELECT product_id, SUM(GREATEST(quantity_available, 0)) AS total FROM inventory_batches GROUP BY product_id) b
              ON b.product_id = p.id
            WHERE p.deleted_at IS NULL AND COALESCE(p.stock_quantity, 0) <> b.total
            ORDER BY p.name");

        $variants = DB::select("
            SELECT v.id, p.name AS product, v.name, v.stock_quantity AS stored, b.total
            FROM product_variants v
            JOIN products p ON p.id = v.product_id AND p.deleted_at IS NULL
            JOIN (SELECT variant_id, SUM(GREATEST(quantity_available, 0)) AS total FROM inventory_batches WHERE variant_id IS NOT NULL GROUP BY variant_id) b
              ON b.variant_id = v.id
            WHERE COALESCE(v.stock_quantity, 0) <> b.total
            ORDER BY p.name, v.name");

        foreach ($products as $r) {
            $this->line("Product  {$r->name}: stored {$r->stored}, batches {$r->total}");
        }
        foreach ($variants as $r) {
            $this->line("Variant  {$r->product} / {$r->name}: stored {$r->stored}, batches {$r->total}");
        }

        if ($this->option('fix') && ($products || $variants)) {
            DB::transaction(function () use ($products, $variants) {
                foreach ($products as $r) {
                    DB::update('UPDATE products SET stock_quantity = ?, updated_at = NOW() WHERE id = ?', [(int) $r->total, $r->id]);
                }
                foreach ($variants as $r) {
                    DB::update('UPDATE product_variants SET stock_quantity = ?, updated_at = NOW() WHERE id = ?', [(int) $r->total, $r->id]);
                }
            });
            \Illuminate\Support\Facades\Log::info('stock:sync-from-batches corrected stock figures', [
                'products' => array_map(fn ($r) => "{$r->name}: {$r->stored} -> {$r->total}", $products),
                'variants' => array_map(fn ($r) => "{$r->product} / {$r->name}: {$r->stored} -> {$r->total}", $variants),
            ]);
        }

        $verb = $this->option('fix') ? 'corrected' : 'differ';
        $this->info(count($products) . " product(s) and " . count($variants) . " variant(s) {$verb}.");

        return self::SUCCESS;
    }
}
