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
        Schema::create('product_unit_inventory', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id')->index();
            $table->uuid('store_id')->index();
            $table->uuid('product_id')->index();
            $table->uuid('variant_id')->nullable()->index();
            $table->uuid('unit_id')->index(); // FK to product_packaging_units
            
            // Inventory quantities for this specific unit
            $table->integer('quantity')->default(0); // Total quantity of this unit type
            $table->integer('allocated')->default(0); // Allocated/reserved quantity
            $table->integer('available')->storedAs('quantity - allocated'); // Available = Total - Allocated
            $table->integer('on_hold')->default(0); // Held for various reasons
            $table->integer('damaged')->default(0); // Damaged units
            
            // Reorder levels specific to this unit
            $table->integer('reorder_level')->nullable();
            $table->integer('reorder_quantity')->nullable();
            
            // Tracking
            $table->timestamp('last_restocked_at')->nullable();
            $table->timestamp('last_sold_at')->nullable();
            
            $table->timestamps();
            
            // Foreign keys
            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->foreign('store_id')->references('id')->on('stores')->onDelete('cascade');
            $table->foreign('product_id')->references('id')->on('products')->onDelete('cascade');
            $table->foreign('variant_id')->references('id')->on('product_variants')->onDelete('cascade');
            $table->foreign('unit_id')->references('id')->on('product_packaging_units')->onDelete('cascade');
            
            // Indexes
            $table->index(['company_id', 'store_id'], 'idx_product_unit_inventory_company_store');
            $table->index(['product_id', 'store_id'], 'idx_product_unit_inventory_product_store');
            $table->index(['product_id', 'variant_id', 'store_id', 'unit_id'], 'idx_product_unit_inventory_full');
            
            // Unique constraint - one record per product/variant/store/unit combination
            $table->unique(['product_id', 'variant_id', 'store_id', 'unit_id'], 'unique_product_variant_store_unit');
        });
        
        // Add trigger for updated_at
        DB::statement('
            CREATE TRIGGER update_product_unit_inventory_modtime
            BEFORE UPDATE ON product_unit_inventory
            FOR EACH ROW
            EXECUTE FUNCTION update_modified_column();
        ');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement('DROP TRIGGER IF EXISTS update_product_unit_inventory_modtime ON product_unit_inventory');
        Schema::dropIfExists('product_unit_inventory');
    }
};
