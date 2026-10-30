<?php

namespace App\Console\Commands;

use App\Models\Order;
use App\Models\ProductVariant;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * One-off: take the stock of orders dated in a range (17-31 Oct 2026, now past sales) out of
 * what is on hand, so 1 Nov starts with the stock really left. Each line takes what its batches
 * still hold (soonest expiry first) - a product with nothing left is skipped, never negative.
 * Orders that already took their stock are left alone, and the order is stamped so it never
 * runs twice.
 */
class DeductPastOrderStock extends Command
{
    protected $signature = 'orders:deduct-past-stock {--from=2026-10-17} {--to=2026-10-31} {--dry-run} {--log= : Write every change to this JSON file}';

    protected $description = 'Take the stock of past orders in a date range from available stock (skipping what is not there)';

    public function handle(): int
    {
        $dry = (bool) $this->option('dry-run');
        $orders = Order::whereNull('deleted_at')
            ->whereNotIn('status', ['cancelled', 'rejected'])
            ->whereNull('stock_deducted_at')
            ->whereRaw('DATE(order_date) BETWEEN ? AND ?', [$this->option('from'), $this->option('to')])
            ->with('orderItems.product', 'orderItems.variant')
            ->orderBy('order_date')->orderBy('created_at')
            ->get();

        // What each product / variant still has on hand, drawn down as orders go (for the dry run).
        $onHand = [];
        $available = function ($target) use (&$onHand) {
            $key = get_class($target) . ':' . $target->id;
            return $onHand[$key] ??= (int) $target->getFEFOBatches()->sum('quantity_available');
        };

        $log = [];
        $totals = ['orders' => 0, 'lines' => 0, 'full' => 0, 'partial' => 0, 'skipped' => 0, 'units_taken' => 0, 'units_short' => 0];
        foreach ($orders as $order) {
            $lines = [];
            $run = function () use ($order, $dry, $available, &$onHand, &$lines, &$totals) {
                foreach ($order->orderItems as $item) {
                    if (!$item->product || !$item->product->track_inventory) {
                        continue;
                    }
                    $target = $item->variant_id ? ($item->variant ?? ProductVariant::find($item->variant_id)) : $item->product;
                    if (!$target) {
                        continue;
                    }
                    $qty = (int) ($item->base_quantity ?: $item->quantity);
                    $have = $available($target);
                    $take = min($qty, $have);
                    $totals['lines']++;
                    $totals[$take === $qty ? 'full' : ($take > 0 ? 'partial' : 'skipped')]++;
                    $totals['units_taken'] += $take;
                    $totals['units_short'] += $qty - $take;
                    $line = ['product' => $item->product->name, 'product_id' => $item->product_id, 'variant_id' => $item->variant_id, 'ordered' => $qty, 'available' => $have, 'taken' => $take];

                    if ($take > 0 && !$dry) {
                        $result = $target->allocateStockFEFO($take, [
                            'reference_type' => 'order',
                            'reference_id' => $order->id,
                            'reference_number' => $order->order_number,
                            'notes' => "Order {$order->order_number} (past sale, stock taken for 1 Nov)",
                        ]);
                        $taken = (int) $result['allocated_quantity'];
                        $item->batch_allocations = $result['allocations'] ?: null;
                        $item->save();
                        $target->decrement('stock_quantity', $taken);
                        $line['taken'] = $taken;
                        $line['batches'] = $result['allocations'];
                    }
                    $onHand[get_class($target) . ':' . $target->id] = $have - $take;
                    $lines[] = $line;
                }
                if (!$dry) {
                    $order->stock_deducted_at = now();
                    $order->saveQuietly();
                }
            };
            $dry ? $run() : DB::transaction($run);
            $totals['orders']++;
            $log[] = ['order' => $order->order_number, 'order_id' => $order->id, 'date' => (string) $order->order_date, 'lines' => $lines];
        }

        foreach ($log as $o) {
            foreach ($o['lines'] as $l) {
                if ($l['taken'] < $l['ordered']) {
                    $this->line(sprintf('  %s %s: ordered %d, %s', substr($o['date'], 0, 10), $l['product'], $l['ordered'], $l['taken'] ? "took {$l['taken']} (all there was)" : 'none in stock - skipped'));
                }
            }
        }
        $this->info(($dry ? 'Would take' : 'Took') . " stock for {$totals['orders']} orders, {$totals['lines']} lines: {$totals['full']} in full, {$totals['partial']} partly, {$totals['skipped']} skipped; {$totals['units_taken']} units taken, {$totals['units_short']} not in stock");

        if ($path = $this->option('log')) {
            file_put_contents($path, json_encode(['dry_run' => $dry, 'at' => now()->toDateTimeString(), 'totals' => $totals, 'orders' => $log], JSON_PRETTY_PRINT));
        }
        return self::SUCCESS;
    }
}
