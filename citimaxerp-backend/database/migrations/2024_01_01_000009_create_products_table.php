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
        Schema::create('products', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('company_id');
            $table->uuid('store_id')->nullable();
            $table->string('product_number', 50)->nullable();
            $table->string('product_code', 100)->nullable();
            $table->string('name', 255);
            $table->text('description')->nullable();
            $table->text('short_description')->nullable();
            $table->decimal('price', 10, 2)->nullable();
            $table->decimal('unit_cost', 10, 2)->nullable();
            $table->decimal('last_price', 10, 2)->nullable();
            $table->integer('stock_quantity')->default(0);
            $table->date('expiry_date')->nullable();
            $table->integer('low_stock_threshold')->default(10);
            $table->string('category', 100)->nullable();
            $table->uuid('category_id')->nullable();
            $table->string('sku', 50)->nullable();
            $table->string('barcode', 100)->nullable();
            $table->string('brand', 255)->nullable();
            $table->string('supplier', 255)->nullable();
            $table->uuid('supplier_id')->nullable();
            $table->string('unit_of_measurement', 50)->nullable();
            $table->boolean('is_active')->default(true);
            $table->boolean('is_featured')->default(false);
            $table->boolean('is_digital')->default(false);
            $table->boolean('track_inventory')->default(true);
            $table->boolean('has_packaging')->default(false);
            $table->string('base_unit', 50)->default('piece')->nullable();
            $table->jsonb('packaging_config')->nullable();
            $table->decimal('weight', 8, 2)->nullable();
            $table->decimal('length', 8, 2)->nullable();
            $table->decimal('width', 8, 2)->nullable();
            $table->decimal('height', 8, 2)->nullable();
            $table->string('shipping_class', 100)->nullable();
            $table->text('image_url')->nullable();
            $table->jsonb('images')->nullable();
            $table->integer('primary_image_index')->default(0);
            $table->boolean('has_variations')->default(false);
            $table->jsonb('tags')->nullable();
            $table->timestamp('created_at')->nullable()->default(DB::raw('CURRENT_TIMESTAMP'));
            $table->timestamp('updated_at')->nullable()->default(DB::raw('CURRENT_TIMESTAMP'));
            $table->integer('on_hand')->default(0);
            $table->integer('on_hold')->default(0);
            $table->integer('damaged')->default(0);
            $table->string('inventory_status')->default('available');
            $table->integer('allocated')->default(0);
            $table->unique(['sku', 'company_id'], 'products_sku_company_key');
            $table->foreign('company_id', 'products_company_id_fkey')->references('id')->on('companies')->onDelete('cascade');
            $table->foreign('store_id', 'products_store_id_fkey')->references('id')->on('stores')->onDelete('set null');
            // category_id and supplier_id foreign keys deferred to later migration

            $table->index('company_id', 'idx_products_company_id');
            $table->index('store_id', 'idx_products_store_id');
            $table->index('category', 'idx_products_category');
            $table->index('category_id', 'idx_products_category_id');
            $table->index('brand', 'idx_products_brand');
            $table->index('supplier', 'idx_products_supplier');
            $table->index('supplier_id', 'idx_products_supplier_id');
            $table->index('is_active', 'idx_products_is_active');
            $table->index('is_featured', 'idx_products_is_featured');
            $table->index(['company_id', 'store_id'], 'idx_products_company_store');
            $table->index('tags', 'idx_products_tags')->using('gin');
            $table->index('sku', 'idx_products_sku');
            $table->index('product_number', 'idx_products_product_number');
            $table->index('product_code', 'idx_products_product_code');
            $table->index('has_packaging', 'idx_products_has_packaging');
        });

        DB::statement('
            CREATE TRIGGER update_products_modtime
            BEFORE UPDATE ON products
            FOR EACH ROW
            EXECUTE FUNCTION update_modified_column();
        ');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement('DROP TRIGGER IF EXISTS update_products_modtime ON products');
        Schema::dropIfExists('products');
    }
};
