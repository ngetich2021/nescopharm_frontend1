<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * This migration creates the stock_adjustment_items table for the parent-child
     * stock adjustment structure. Each stock adjustment can have multiple items,
     * allowing bulk adjustments to be grouped under a single adjustment record.
     */
    public function up(): void
    {
        // First, modify the stock_adjustments table to be a header/parent table
        // Remove product-specific columns and keep only header-level data
        
        // Add new columns to stock_adjustments for totals
        Schema::table('stock_adjustments', function (Blueprint $table) {
            // Add total items count
            $table->integer('total_items')->default(0)->after('adjustment_number');
            // Add total quantity adjusted (sum of all items)
            $table->integer('total_quantity_adjusted')->default(0)->after('total_items');
        });

        // Create the stock_adjustment_items table
        Schema::create('stock_adjustment_items', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('stock_adjustment_id')->index();
            
            // Product information (moved from parent)
            $table->uuid('product_id')->index();
            $table->uuid('variant_id')->nullable()->index();
            $table->uuid('batch_id')->nullable()->index();
            $table->uuid('unit_id')->nullable()->index();
            $table->uuid('store_id')->nullable()->index();
            
            // Adjustment details per item
            $table->enum('adjustment_type', ['increase', 'decrease', 'set'])->default('increase');
            
            // Quantities
            $table->integer('quantity_before')->default(0);
            $table->integer('quantity_adjusted');
            $table->integer('quantity_after')->default(0);
            
            // Financial tracking per item
            $table->decimal('unit_cost', 15, 2)->nullable();
            $table->decimal('total_cost', 15, 2)->nullable();
            $table->decimal('unit_price', 15, 2)->nullable();
            $table->decimal('total_value', 15, 2)->nullable();
            
            // Item-specific notes
            $table->text('notes')->nullable();
            
            // Status for individual items (for partial processing)
            $table->enum('item_status', ['pending', 'applied', 'failed', 'skipped'])->default('pending');
            $table->text('error_message')->nullable();
            
            // Reference to related inventory movement
            $table->uuid('inventory_movement_id')->nullable();
            
            // Metadata for additional item-specific data
            $table->jsonb('metadata')->nullable();
            
            $table->timestamps();
            
            // Foreign keys
            $table->foreign('stock_adjustment_id')->references('id')->on('stock_adjustments')->onDelete('cascade');
            $table->foreign('product_id')->references('id')->on('products')->onDelete('cascade');
            $table->foreign('variant_id')->references('id')->on('product_variants')->onDelete('cascade');
            $table->foreign('batch_id')->references('id')->on('inventory_batches')->onDelete('set null');
            $table->foreign('unit_id')->references('id')->on('product_packaging_units')->onDelete('set null');
            $table->foreign('store_id')->references('id')->on('stores')->onDelete('cascade');
            $table->foreign('inventory_movement_id')->references('id')->on('inventory_movements')->onDelete('set null');
            
            // Indexes
            $table->index(['stock_adjustment_id', 'product_id'], 'idx_adj_items_adjustment_product');
            $table->index(['product_id', 'variant_id'], 'idx_adj_items_product_variant');
            $table->index('item_status', 'idx_adj_items_status');
            $table->index('created_at', 'idx_adj_items_created_at');
        });
        
        // Add trigger for updated_at
        DB::statement('
            CREATE TRIGGER update_stock_adjustment_items_modtime
            BEFORE UPDATE ON stock_adjustment_items
            FOR EACH ROW
            EXECUTE FUNCTION update_modified_column();
        ');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement('DROP TRIGGER IF EXISTS update_stock_adjustment_items_modtime ON stock_adjustment_items');
        Schema::dropIfExists('stock_adjustment_items');
        
        // Remove added columns from stock_adjustments
        Schema::table('stock_adjustments', function (Blueprint $table) {
            $table->dropColumn(['total_items', 'total_quantity_adjusted']);
        });
    }
};
