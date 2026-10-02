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
        Schema::create('stock_count_items', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('company_id');
            $table->uuid('store_id');
            $table->uuid('stock_count_id');
            $table->uuid('product_id');
            $table->string('product_name', 255);
            $table->string('product_sku', 100)->nullable();
            $table->string('product_category', 255)->nullable();
            $table->decimal('unit_cost', 10, 2)->nullable();
            $table->integer('expected_quantity')->default(0);
            $table->integer('counted_quantity')->nullable();
            $table->integer('variance_quantity')->storedAs('counted_quantity - expected_quantity')->nullable();
            $table->decimal('variance_value', 12, 2)->storedAs('((counted_quantity - expected_quantity) * unit_cost)::numeric(12,2)')->nullable();
            $table->string('counted_by', 255)->nullable();
            $table->timestamp('counted_at')->nullable();
            $table->text('notes')->nullable();
            $table->boolean('is_counted')->default(false);
            $table->boolean('requires_recount')->default(false);
            $table->boolean('is_variance')->storedAs('counted_quantity IS NOT NULL AND counted_quantity <> expected_quantity')->nullable();
            $table->timestamp('created_at')->nullable()->default(DB::raw('CURRENT_TIMESTAMP'));
            $table->timestamp('updated_at')->nullable()->default(DB::raw('CURRENT_TIMESTAMP'));
        });

        // Add constraints, foreign keys and indexes after table creation
        Schema::table('stock_count_items', function (Blueprint $table) {
            $table->unique(['company_id', 'store_id', 'stock_count_id', 'product_id'], 'stock_count_items_company_id_store_id_stock_count_id_produc_key');
            $table->foreign('stock_count_id', 'stock_count_items_stock_count_id_fkey')->references('id')->on('stock_counts')->onDelete('cascade');
            $table->foreign('company_id', 'stock_count_items_company_id_fkey')->references('id')->on('companies');
            $table->foreign('store_id', 'stock_count_items_store_id_fkey')->references('id')->on('stores');

            $table->index(['company_id', 'store_id'], 'idx_stock_count_items_company_store');
            $table->index(['company_id', 'store_id', 'stock_count_id'], 'idx_stock_count_items_company_store_stock_count');
            $table->index(['company_id', 'store_id', 'product_id'], 'idx_stock_count_items_company_store_product');
            $table->index(['company_id', 'store_id', 'is_counted'], 'idx_stock_count_items_company_store_counted');
            $table->index(['company_id', 'store_id', 'is_variance'], 'idx_stock_count_items_company_store_variance');
        });

        // Add check constraints
        DB::statement('
            ALTER TABLE stock_count_items
            ADD CONSTRAINT counted_data_consistency
            CHECK (
                (
                    (is_counted = false AND counted_quantity IS NULL AND counted_by IS NULL AND counted_at IS NULL)
                    OR (is_counted = true AND counted_quantity IS NOT NULL AND counted_by IS NOT NULL AND counted_at IS NOT NULL)
                )
            );
        ');

        DB::statement('
            ALTER TABLE stock_count_items
            ADD CONSTRAINT valid_quantities
            CHECK (
                (expected_quantity >= 0 AND (counted_quantity IS NULL OR counted_quantity >= 0))
            );
        ');

        DB::statement('
            CREATE TRIGGER trigger_stock_count_items_updated_at
            BEFORE UPDATE ON stock_count_items
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        ');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement('ALTER TABLE stock_count_items DROP CONSTRAINT IF EXISTS counted_data_consistency');
        DB::statement('ALTER TABLE stock_count_items DROP CONSTRAINT IF EXISTS valid_quantities');
        DB::statement('DROP TRIGGER IF EXISTS trigger_stock_count_items_updated_at ON stock_count_items');
        Schema::dropIfExists('stock_count_items');
    }
};
