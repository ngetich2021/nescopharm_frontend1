<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('stock_count_items', function (Blueprint $table) {
            $table->uuid('variant_id')->nullable()->after('product_id');
        });

        Schema::table('stock_count_items', function (Blueprint $table) {
            $table->foreign('variant_id', 'stock_count_items_variant_id_fkey')
                ->references('id')->on('product_variants')->onDelete('cascade');

            $table->index(['company_id', 'store_id', 'variant_id'], 'idx_stock_count_items_company_store_variant');
        });

        // The original unique key only covered (company_id, store_id, stock_count_id, product_id),
        // which prevented more than one line per product per count. Now that a variant-bearing
        // product can generate one line per variant (same product_id, different variant_id), the
        // key must include variant_id. Postgres treats NULLs as distinct in unique indexes, so
        // this still allows only one non-variant line per product per count while allowing many
        // variant lines (one per variant) for the same product.
        Schema::table('stock_count_items', function (Blueprint $table) {
            $table->dropUnique('stock_count_items_company_id_store_id_stock_count_id_produc_key');
        });

        DB::statement('
            ALTER TABLE stock_count_items
            ADD CONSTRAINT stock_count_items_company_store_count_product_variant_key
            UNIQUE (company_id, store_id, stock_count_id, product_id, variant_id)
        ');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement('ALTER TABLE stock_count_items DROP CONSTRAINT IF EXISTS stock_count_items_company_store_count_product_variant_key');

        Schema::table('stock_count_items', function (Blueprint $table) {
            $table->unique(['company_id', 'store_id', 'stock_count_id', 'product_id'], 'stock_count_items_company_id_store_id_stock_count_id_produc_key');
        });

        Schema::table('stock_count_items', function (Blueprint $table) {
            $table->dropForeign('stock_count_items_variant_id_fkey');
            $table->dropIndex('idx_stock_count_items_company_store_variant');
            $table->dropColumn('variant_id');
        });
    }
};
