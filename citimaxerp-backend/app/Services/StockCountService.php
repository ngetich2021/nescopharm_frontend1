<?php

namespace App\Services;

use App\Models\InventoryBatch;
use App\Models\InventoryMovement;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\StockCount;
use App\Models\StockCountItem;
use Illuminate\Support\Collection;

/**
 * Stock counts work per batch, since a product's stock is the sum of its batches:
 * - a new count lists one line per batch that holds stock (expected = what the batch holds), and
 *   one line with no batch for a product that has none, so found stock can still be entered;
 * - stock found during the count that is in no listed batch is added as a line with its batch
 *   number and expiry (is_new_batch);
 * - approving the count sets each batch to what was counted, puts found stock into its batch
 *   (the existing one with that number, or a new one) and records every change as a movement.
 */
class StockCountService
{
    /**
     * Batches of a product (or one size) that hold stock, soonest expiry first. Not narrowed to
     * the count's store: a product's stock is all its batches (batches are not always recorded
     * under the product's store).
     */
    public function batchesFor(string $companyId, ?string $storeId, string $productId, ?string $variantId): Collection
    {
        return InventoryBatch::where('company_id', $companyId)
            ->where('product_id', $productId)
            ->when($variantId, fn ($q) => $q->where('variant_id', $variantId), fn ($q) => $q->whereNull('variant_id'))
            ->where('quantity_available', '>', 0)
            ->orderByRaw('expiry_date asc nulls last')->orderBy('received_date')
            ->get();
    }

    /**
     * The count's lines for the products (and sizes) chosen: one per batch holding stock, or one
     * line with no batch when the product has none. Each is [item fields...] ready to save.
     */
    public function batchLines(string $companyId, ?string $storeId, array $items): array
    {
        // Every batch holding stock for these products in one query (one per product was 800
        // round trips for a full count, minutes against the remote database).
        $productIds = array_values(array_unique(array_column($items, 'product_id')));
        $all = $productIds
            ? InventoryBatch::where('company_id', $companyId)
                ->whereIn('product_id', $productIds)
                ->where('quantity_available', '>', 0)
                ->orderByRaw('expiry_date asc nulls last')->orderBy('received_date')
                ->get()
            : collect();
        $byKey = $all->groupBy(fn ($b) => $b->product_id . '|' . ($b->variant_id ?? ''));

        $line = fn (array $item, $b) => array_merge($item, [
            'batch_id' => $b->id,
            'batch_number' => $b->batch_number,
            'expiry_date' => optional($b->expiry_date)->toDateString(),
            'expected_quantity' => (int) $b->quantity_available,
            'unit_cost' => $b->unit_cost,
        ]);

        $lines = [];
        $sizedProducts = [];
        foreach ($items as $item) {
            $variantId = $item['variant_id'] ?? null;
            if ($variantId) {
                $sizedProducts[$item['product_id']] = $item;
            }
            $batches = $byKey->get($item['product_id'] . '|' . ($variantId ?? ''), collect());
            if ($batches->isEmpty()) {
                $lines[] = array_merge($item, ['batch_id' => null, 'batch_number' => null, 'expiry_date' => null, 'expected_quantity' => 0]);
                continue;
            }
            foreach ($batches as $b) {
                $lines[] = $line($item, $b);
            }
        }

        // A product counted by size can still hold a batch recorded without a size: list it too,
        // on its own line, so no stock is left out of the count.
        foreach ($sizedProducts as $productId => $item) {
            foreach ($byKey->get($productId . '|', collect()) as $b) {
                $lines[] = $line(array_merge($item, ['variant_id' => null]), $b);
            }
        }

        return $lines;
    }

    /** Whether a batch number is already a batch of this product (found stock goes into it). */
    public function findBatch(string $companyId, string $productId, ?string $variantId, string $batchNumber): ?InventoryBatch
    {
        return InventoryBatch::where('company_id', $companyId)->where('product_id', $productId)
            ->when($variantId, fn ($q) => $q->where('variant_id', $variantId), fn ($q) => $q->whereNull('variant_id'))
            ->whereRaw('upper(trim(batch_number)) = ?', [strtoupper(trim($batchNumber))])
            ->first();
    }

    /**
     * Put an approved count into stock. Runs inside the caller's transaction.
     * Returns a summary: batches corrected, batches created, movements recorded.
     */
    public function apply(StockCount $count, ?string $userId): array
    {
        $summary = ['batches_updated' => 0, 'batches_created' => 0, 'movements' => 0];
        $items = $count->items()->whereNotNull('counted_quantity')->get();
        $touched = [];      // product_id|variant_id => true, to refresh their stock totals
        $targets = [];      // batch id => ['batch' => InventoryBatch, 'qty' => counted total]
        $newBatches = [];   // product|variant|batch number => ['items' => [...], 'qty' => n]
        // The counted batches in one query, not one per line.
        $batchesById = InventoryBatch::whereIn('id', $items->pluck('batch_id')->filter()->unique()->values())->get()->keyBy('id');

        foreach ($items as $item) {
            $key = $item->product_id . '|' . ($item->variant_id ?? '');
            $number = trim((string) $item->batch_number);

            if ($item->batch_id) {
                $batch = $batchesById->get($item->batch_id);
                if ($batch) {
                    $targets[$batch->id] ??= ['batch' => $batch, 'qty' => 0];
                    $targets[$batch->id]['qty'] += (int) $item->counted_quantity;
                    $touched[$key] = true;
                    continue;
                }
            }

            if ($number !== '') {
                // Found stock under a batch number: the product's batch with that number if there
                // is one (the count sets it), otherwise a new batch.
                $batch = $this->findBatch($count->company_id, $item->product_id, $item->variant_id, $number);
                if ($batch) {
                    $targets[$batch->id] ??= ['batch' => $batch, 'qty' => 0];
                    $targets[$batch->id]['qty'] += (int) $item->counted_quantity;
                    $item->update(['batch_id' => $batch->id]);
                } else {
                    $nk = $key . '|' . strtoupper($number);
                    $newBatches[$nk] ??= ['items' => [], 'qty' => 0];
                    $newBatches[$nk]['items'][] = $item;
                    $newBatches[$nk]['qty'] += (int) $item->counted_quantity;
                }
                $touched[$key] = true;
                continue;
            }

            // A product-level line (counts made before batches were counted): spread the
            // difference over its batches.
            if ($item->is_variance) {
                $summary = $this->spreadDifference($count, $item, $userId, $summary);
                $touched[$key] = true;
            }
        }

        foreach ($targets as ['batch' => $batch, 'qty' => $qty]) {
            $before = (int) $batch->quantity_available;
            if ($qty === $before) {
                continue;
            }
            $batch->quantity_available = $qty;
            if ($qty > 0 && in_array($batch->status, ['sold_out', 'depleted'], true)) {
                $batch->status = 'active';
            }
            $batch->save();
            $this->movement($count, $batch, $qty - $before, $before, $qty, $userId);
            $summary['batches_updated']++;
            $summary['movements']++;
        }

        foreach ($newBatches as ['items' => $lines, 'qty' => $qty]) {
            if ($qty <= 0) {
                continue;
            }
            $first = $lines[0];
            $product = Product::find($first->product_id);
            $variant = $first->variant_id ? ProductVariant::find($first->variant_id) : null;
            $batch = InventoryBatch::create([
                'company_id' => $count->company_id,
                'store_id' => $count->store_id,
                'product_id' => $first->product_id,
                'variant_id' => $first->variant_id,
                'batch_number' => trim((string) $first->batch_number),
                'quantity_received' => $qty,
                'quantity_available' => $qty,
                'expiry_date' => collect($lines)->pluck('expiry_date')->filter()->first(),
                'received_date' => now(),
                'unit_cost' => $first->unit_cost ?? $variant?->cost ?? $product?->unit_cost ?? 0,
                'selling_price' => $variant?->price ?? $product?->price,
                'status' => 'active',
                'notes' => "Found in stock count {$count->count_number}",
            ]);
            foreach ($lines as $line) {
                $line->update(['batch_id' => $batch->id, 'is_new_batch' => true]);
            }
            $this->movement($count, $batch, $qty, 0, $qty, $userId);
            $summary['batches_created']++;
            $summary['movements']++;
        }

        foreach (array_keys($touched) as $key) {
            [$productId, $variantId] = explode('|', $key);
            $this->refreshStockTotal($productId, $variantId ?: null);
        }

        return $summary;
    }

    /** A product-level difference: more goes into its soonest-expiring batch, less comes out first-expiry-first. */
    protected function spreadDifference(StockCount $count, StockCountItem $item, ?string $userId, array $summary): array
    {
        $diff = (int) $item->counted_quantity - (int) $item->expected_quantity;
        $batches = $this->batchesFor($count->company_id, $count->store_id, $item->product_id, $item->variant_id);

        if ($diff > 0) {
            $batch = $batches->first();
            if (!$batch) {
                $product = Product::find($item->product_id);
                $batch = InventoryBatch::create([
                    'company_id' => $count->company_id, 'store_id' => $count->store_id,
                    'product_id' => $item->product_id, 'variant_id' => $item->variant_id,
                    'batch_number' => InventoryBatch::generateBatchNumber($count->company_id, $item->product_id),
                    'quantity_received' => 0, 'quantity_available' => 0, 'received_date' => now(),
                    'unit_cost' => $item->unit_cost ?? $product?->unit_cost ?? 0, 'selling_price' => $product?->price,
                    'status' => 'active', 'notes' => "Found in stock count {$count->count_number}",
                ]);
                $summary['batches_created']++;
            }
            $before = (int) $batch->quantity_available;
            $batch->increment('quantity_available', $diff);
            $this->movement($count, $batch, $diff, $before, $before + $diff, $userId);
            $summary['movements']++;
            return $summary;
        }

        $remaining = -$diff;
        foreach ($batches as $batch) {
            if ($remaining <= 0) {
                break;
            }
            $before = (int) $batch->quantity_available;
            $take = min($before, $remaining);
            $batch->decrement('quantity_available', $take);
            $this->movement($count, $batch, -$take, $before, $before - $take, $userId);
            $summary['movements']++;
            $remaining -= $take;
        }
        return $summary;
    }

    protected function movement(StockCount $count, InventoryBatch $batch, int $quantity, int $before, int $after, ?string $userId): void
    {
        InventoryMovement::createAdjustment([
            'company_id' => $count->company_id,
            'store_id' => $batch->store_id ?? $count->store_id,
            'product_id' => $batch->product_id,
            'variant_id' => $batch->variant_id,
            'batch_id' => $batch->id,
            'quantity' => $quantity,
            'quantity_before' => $before,
            'quantity_after' => $after,
            'unit_cost' => $batch->unit_cost,
            'total_cost' => round($quantity * (float) $batch->unit_cost, 2),
            'reference_type' => 'stock_count',
            'reference_id' => $count->id,
            'reference_number' => $count->count_number,
            'movement_date' => now(),
            'created_by' => $userId,
            'notes' => "Stock count {$count->count_number}: batch {$batch->batch_number} counted {$after} (was {$before})",
        ]);
    }

    /** Keep the stored stock figure equal to what the batches hold. */
    protected function refreshStockTotal(string $productId, ?string $variantId): void
    {
        $total = (int) InventoryBatch::where('product_id', $productId)
            ->when($variantId, fn ($q) => $q->where('variant_id', $variantId))
            ->where('status', 'active')->where('quantity_available', '>', 0)
            ->sum('quantity_available');
        if ($variantId) {
            ProductVariant::whereKey($variantId)->update(['stock_quantity' => $total]);
        }
        $productTotal = (int) InventoryBatch::where('product_id', $productId)
            ->where('status', 'active')->where('quantity_available', '>', 0)->sum('quantity_available');
        Product::whereKey($productId)->update(['stock_quantity' => $productTotal]);
    }
}
