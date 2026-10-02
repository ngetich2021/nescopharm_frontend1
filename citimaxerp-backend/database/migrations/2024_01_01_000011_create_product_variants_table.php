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
        Schema::create('product_variants', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'))->nullable();
            $table->uuid('product_id')->nullable();
            $table->uuid('company_id');
            $table->uuid('store_id')->nullable();
            $table->string('name', 255)->nullable();
            $table->string('sku', 50)->nullable();
            $table->decimal('price', 10, 2)->nullable();
            $table->decimal('cost', 10, 2)->nullable();
            $table->integer('stock_quantity')->default(0);
            $table->jsonb('attributes')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamp('created_at')->nullable()->default(DB::raw('CURRENT_TIMESTAMP'));
            $table->timestamp('updated_at')->nullable()->default(DB::raw('CURRENT_TIMESTAMP'));
            $table->jsonb('options')->nullable();
            $table->jsonb('images')->nullable();
            $table->integer('on_hand')->default(0);
            $table->integer('on_hold')->default(0);
            $table->integer('damaged')->default(0);
            $table->string('inventory_status')->default('available');
            $table->integer('allocated')->default(0);
            $table->unique(['sku', 'company_id'], 'product_variants_sku_company_key');
            $table->unique(['product_id', 'name', 'options', 'store_id'], 'unique_product_variant_per_store');
            $table->foreign('company_id', 'product_variants_company_id_fkey')->references('id')->on('companies')->onDelete('cascade');
            $table->foreign('product_id', 'product_variants_product_id_fkey')->references('id')->on('products')->onDelete('cascade');
            $table->foreign('store_id', 'product_variants_store_id_fkey')->references('id')->on('stores')->onDelete('set null');

            $table->index('product_id', 'idx_product_variants_product_id');
            $table->index('company_id', 'idx_product_variants_company_id');
            $table->index('store_id', 'idx_product_variants_store_id');
            $table->index('attributes', 'idx_product_variants_attributes')->using('gin');
            $table->index(['company_id', 'store_id'], 'idx_product_variants_company_store');
        });

        DB::statement('
            CREATE TRIGGER update_product_variants_modtime
            BEFORE UPDATE ON product_variants
            FOR EACH ROW
            EXECUTE FUNCTION update_modified_column();
        ');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement('DROP TRIGGER IF EXISTS update_product_variants_modtime ON product_variants');
        Schema::dropIfExists('product_variants');
    }
};
