<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Stock counts are taken per batch, so a product (or size) has one line for each of its batches
 * plus any found stock. The old rule allowed only one line per product/size in a count, so every
 * count of a product with two or more batches failed ("duplicate key ... product_variant_key").
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE stock_count_items DROP CONSTRAINT IF EXISTS stock_count_items_company_store_count_product_variant_key');
        DB::statement('DROP INDEX IF EXISTS stock_count_items_company_store_count_product_variant_key');
        DB::statement('CREATE INDEX IF NOT EXISTS stock_count_items_count_product_idx ON stock_count_items (stock_count_id, product_id, variant_id)');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS stock_count_items_count_product_idx');
    }
};
