<?php

namespace App\Console\Commands;

use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Console\Command;
use Illuminate\Support\Str;

class BackfillProductSizes extends Command
{
    protected $signature = 'products:backfill-sizes
                            {--company= : Limit to one company id}
                            {--dry-run : List what would change without saving}';

    protected $description = 'Create size variants for products that list their sizes in the description, e.g. "Et Tubes Cuffed Id 2.0,2.5,3".';

    /**
     * A unit glued to the first number (Fr26,28) belongs on every size label; one separated by a
     * space (Id 2.0,2.5) is part of the item name. Mirrors parseSizesFromName() in the frontend.
     */
    public const SIZE_LIST = '/([A-Za-z]+)?(\d+(?:\.\d+)?(?:\s*,\s*\d+(?:\.\d+)?)+)\s*$/';

    public static function parseSizes(?string $name): array
    {
        if (!preg_match(self::SIZE_LIST, trim((string) $name), $m)) {
            return [];
        }
        $prefix = $m[1] ?? '';
        return array_map(fn ($value) => $prefix . trim($value), explode(',', $m[2]));
    }

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');

        $products = Product::query()
            ->when($this->option('company'), fn ($q, $id) => $q->where('company_id', $id))
            ->withCount('variants')
            ->get()
            ->filter(fn ($p) => $p->variants_count === 0 && count(self::parseSizes($p->name)) > 1);

        if ($products->isEmpty()) {
            $this->info('No products with an unparsed size list were found.');
            return self::SUCCESS;
        }

        $created = 0;
        foreach ($products as $product) {
            $sizes = self::parseSizes($product->name);
            $this->line("{$product->name}");
            $this->line('  -> ' . implode(', ', $sizes));

            if ($dryRun) {
                continue;
            }

            foreach ($sizes as $size) {
                ProductVariant::create([
                    'id' => (string) Str::uuid(),
                    'product_id' => $product->id,
                    'company_id' => $product->company_id,
                    'store_id' => $product->store_id,
                    'name' => $size,
                    // Price always comes from the product's price code; a size never carries its own.
                    'price' => 0,
                    'cost' => 0,
                    'stock_quantity' => 0,
                    'is_active' => true,
                ]);
                $created++;
            }
            $product->update(['has_variations' => true]);
        }

        $this->info($dryRun
            ? "Dry run: {$products->count()} products would get sizes. Re-run without --dry-run to apply."
            : "Created {$created} sizes across {$products->count()} products.");

        return self::SUCCESS;
    }
}
