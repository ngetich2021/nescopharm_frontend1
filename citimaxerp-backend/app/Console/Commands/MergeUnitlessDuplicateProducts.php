<?php

namespace App\Console\Commands;

use App\Models\Product;
use Illuminate\Console\Command;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Finds products entered twice, once with units in the size and once without, e.g.
 * "Crepe Bandage 2'' (5cm x 4.5cm)" and "Crepe Bandage 2'' (5 x 4.5)". The one written with
 * units is kept; everything that points at the other (order, invoice, receipt and stock lines)
 * is moved onto it, its stock is added, and it is deleted.
 */
class MergeUnitlessDuplicateProducts extends Command
{
    protected $signature = 'products:merge-unit-duplicates
        {--company= : Only this company id}
        {--force : Actually merge; without it the command only lists the pairs}';

    protected $description = 'Merge products that differ only by size units (5 x 4.5 vs 5cm x 4.5cm), keeping the one with units';

    // Per-product settings: the kept product has its own, so the duplicate's are dropped, not moved.
    private const SETTINGS_TABLES = [
        'product_packaging_units', 'product_store', 'product_price_tiers', 'product_unit_inventory', 'product_price_histories',
        'etims_item_registrations',
    ];

    private const UNITS = 'cm|mm|m|ml|mls|mg|g|gm|gms|kg|l|ltr|ltrs|litres?|inch(?:es)?|in|"|\'\'';

    public function handle(): int
    {
        $products = Product::query()
            ->when($this->option('company'), fn ($q, $c) => $q->where('company_id', $c))
            ->get(['id', 'company_id', 'name', 'product_code', 'item_number', 'stock_quantity', 'created_at']);

        $groups = $products
            ->groupBy(fn ($p) => $p->company_id . '|' . $this->key($p->name))
            ->filter(fn (Collection $g) => $g->count() > 1)
            // Only unit differences ("5 x 4.5" vs "5cm x 4.5cm"), not spelling or spacing ones.
            ->filter(fn (Collection $g) => $g->pluck('name')->map(fn ($n) => preg_replace('/[^a-z0-9.]+/u', '', mb_strtolower($n)))->unique()->count() > 1);

        if ($groups->isEmpty()) {
            $this->info('No unit-only duplicates found.');
            return self::SUCCESS;
        }

        $productTables = collect(DB::select(
            "SELECT table_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'product_id' AND table_name <> 'products'"
        ))->pluck('table_name');
        $variantTables = collect(DB::select(
            "SELECT table_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'variant_id'"
        ))->pluck('table_name');

        $merged = 0;
        foreach ($groups as $group) {
            $keep = $this->keeper($group);
            foreach ($group->where('id', '!=', $keep->id) as $dup) {
                $this->line(sprintf('KEEP "%s" [%s]  <-  DELETE "%s" [%s] (stock %d)',
                    $keep->name, $keep->product_code ?: '-', $dup->name, $dup->product_code ?: '-', (int) $dup->stock_quantity));
                if ($this->option('force')) {
                    $this->merge($keep, $dup, $productTables, $variantTables);
                    $merged++;
                }
            }
        }

        $this->option('force')
            ? $this->info("Merged and deleted: {$merged}")
            : $this->warn('Dry run: nothing changed. Add --force to merge.');
        return self::SUCCESS;
    }

    // Name with units, spacing and punctuation dropped: "(5cm x 4.5cm)" and "(5 x 4.5)" match.
    private function key(string $name): string
    {
        $name = mb_strtolower($name);
        $name = preg_replace('/(\d+(?:\.\d+)?)\s*(?:' . self::UNITS . ')(?![a-z])/u', '$1', $name);
        return preg_replace('/[^a-z0-9.]+/u', '', $name);
    }

    // The name with the most units written in it; on a tie, the older product.
    private function keeper(Collection $group): Product
    {
        return $group->sortBy([
            fn ($a, $b) => preg_match_all('/\d\s*(?:' . self::UNITS . ')(?![a-z])/iu', $b->name) <=> preg_match_all('/\d\s*(?:' . self::UNITS . ')(?![a-z])/iu', $a->name),
            fn ($a, $b) => $a->created_at <=> $b->created_at,
        ])->first();
    }

    private function merge(Product $keep, Product $dup, Collection $productTables, Collection $variantTables): void
    {
        DB::transaction(function () use ($keep, $dup, $productTables, $variantTables) {
            // Sizes: one the kept product already has (same name) takes the duplicate's lines.
            foreach (DB::table('product_variants')->where('product_id', $dup->id)->get() as $variant) {
                $match = DB::table('product_variants')->where('product_id', $keep->id)->where('name', $variant->name)->value('id');
                if ($match) {
                    foreach ($variantTables->reject(fn ($t) => $t === 'product_variants') as $table) {
                        DB::table($table)->where('variant_id', $variant->id)->update(['variant_id' => $match]);
                    }
                    DB::table('product_variants')->where('id', $match)->increment('stock_quantity', (int) $variant->stock_quantity);
                    DB::table('product_variants')->where('id', $variant->id)->delete();
                }
            }

            foreach ($productTables as $table) {
                if (in_array($table, self::SETTINGS_TABLES, true)) {
                    DB::table($table)->where('product_id', $dup->id)->delete();
                } else {
                    DB::table($table)->where('product_id', $dup->id)->update(['product_id' => $keep->id]);
                }
            }

            // Nothing points at it any more, so nothing cascades. Gone first so its code can move over.
            DB::table('products')->where('id', $dup->id)->delete();
            DB::table('products')->where('id', $keep->id)->update(array_filter([
                'product_code' => $keep->product_code ? null : $dup->product_code,
            ]) + [
                'stock_quantity' => DB::raw('COALESCE(stock_quantity, 0) + ' . (int) $dup->stock_quantity),
            ]);
        });
    }
}
