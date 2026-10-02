<?php

/**
 * One-time backfill: resolve legacy free-text `category` values on products into real
 * ProductCategory rows and set category_id, plus create "Stool & Urine" / "Gauze"
 * categories and assign them by product-name keyword match where category is blank.
 *
 * Run with: php artisan tinker --execute="require base_path('scripts/backfill_product_categories.php');"
 */

use App\Models\Product;
use App\Models\ProductCategory;
use Illuminate\Support\Str;

$companies = Product::select('company_id')->distinct()->pluck('company_id');

foreach ($companies as $companyId) {
    echo "=== Company {$companyId} ===\n";

    // 1) Resolve every distinct free-text category value into a real ProductCategory row.
    $distinctCategories = Product::where('company_id', $companyId)
        ->whereNotNull('category')
        ->where('category', '!=', '')
        ->distinct()
        ->pluck('category');

    $resolved = 0;
    foreach ($distinctCategories as $categoryName) {
        $name = trim($categoryName);
        if ($name === '') {
            continue;
        }

        $category = ProductCategory::where('company_id', $companyId)
            ->whereRaw('LOWER(name) = ?', [strtolower($name)])
            ->first();

        if (!$category) {
            $category = ProductCategory::create([
                'id' => (string) Str::uuid(),
                'company_id' => $companyId,
                'name' => $name,
                'is_active' => true,
            ]);
            echo "  Created category: {$name}\n";
        }

        $updated = Product::where('company_id', $companyId)
            ->whereNull('category_id')
            ->whereRaw('LOWER(category) = ?', [strtolower($name)])
            ->update(['category_id' => $category->id]);

        $resolved += $updated;
    }
    echo "  Backfilled category_id on {$resolved} products from existing free-text categories.\n";

    // 2) Create "Stool & Urine" and "Gauze" categories and assign by name keyword match
    //    to products that are still completely uncategorized (blank category, null category_id).
    $keywordMap = [
        'Stool & Urine' => '%container%',
        'Gauze' => '%gauze%',
    ];

    foreach ($keywordMap as $categoryName => $likePattern) {
        $category = ProductCategory::where('company_id', $companyId)
            ->whereRaw('LOWER(name) = ?', [strtolower($categoryName)])
            ->first();

        if (!$category) {
            $category = ProductCategory::create([
                'id' => (string) Str::uuid(),
                'company_id' => $companyId,
                'name' => $categoryName,
                'is_active' => true,
            ]);
            echo "  Created category: {$categoryName}\n";
        }

        $updated = Product::where('company_id', $companyId)
            ->whereNull('category_id')
            ->where('name', 'ilike', $likePattern)
            ->update(['category_id' => $category->id, 'category' => $categoryName]);

        echo "  Assigned {$categoryName} to {$updated} products matching '{$likePattern}'.\n";
    }
}

echo "Done.\n";
