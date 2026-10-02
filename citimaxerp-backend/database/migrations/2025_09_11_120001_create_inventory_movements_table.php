<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up()
    {
        Schema::create('inventory_movements', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id')->index();
            $table->uuid('store_id')->nullable()->index();
            $table->uuid('product_id')->index();
            $table->uuid('variant_id')->nullable()->index();
            $table->uuid('batch_id')->nullable()->index(); // Reference to inventory_batches
            
            // Movement details
            $table->enum('type', [
                'receipt',        // Receiving stock
                'sale',          // Selling stock
                'adjustment',    // Manual adjustments
                'transfer_out',  // Transferring out
                'transfer_in',   // Transferring in
                'return',        // Customer returns
                'damage',        // Damaged goods
                'expiry',        // Expired goods
                'recount'        // Stock count adjustment
            ]);
            
            $table->integer('quantity'); // Can be negative for outbound movements
            $table->integer('quantity_before')->default(0); // Quantity before movement
            $table->integer('quantity_after')->default(0);  // Quantity after movement
            
            // Movement source/reference
            $table->string('reference_type', 50)->nullable(); // order, receipt, dispatch, etc.
            $table->uuid('reference_id')->nullable(); // ID of the source document
            $table->string('reference_number', 100)->nullable(); // Human readable reference
            
            // Pricing at time of movement
            $table->decimal('unit_cost', 10, 2)->nullable();
            $table->decimal('unit_price', 10, 2)->nullable();
            $table->decimal('total_cost', 10, 2)->nullable();
            $table->decimal('total_value', 10, 2)->nullable();
            
            // Movement metadata
            $table->timestamp('movement_date')->default(DB::raw('CURRENT_TIMESTAMP'));
            $table->uuid('created_by')->nullable(); // User who created the movement
            $table->text('notes')->nullable();
            $table->jsonb('metadata')->nullable(); // Additional flexible data
            
            $table->timestamps();
            
            // Foreign keys
            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->foreign('store_id')->references('id')->on('stores')->onDelete('set null');
            $table->foreign('product_id')->references('id')->on('products')->onDelete('cascade');
            $table->foreign('variant_id')->references('id')->on('product_variants')->onDelete('cascade');
            $table->foreign('batch_id')->references('id')->on('inventory_batches')->onDelete('cascade');
            $table->foreign('created_by')->references('id')->on('users')->onDelete('set null');
            
            // Indexes for performance
            $table->index(['company_id', 'store_id'], 'idx_inventory_movements_company_store');
            $table->index(['product_id', 'variant_id'], 'idx_inventory_movements_product_variant');
            $table->index('movement_date', 'idx_inventory_movements_date');
            $table->index('type', 'idx_inventory_movements_type');
            $table->index(['reference_type', 'reference_id'], 'idx_inventory_movements_reference');
        });
        
        // Add trigger for updated_at
        DB::statement('
            CREATE TRIGGER update_inventory_movements_modtime
            BEFORE UPDATE ON inventory_movements
            FOR EACH ROW
            EXECUTE FUNCTION update_modified_column();
        ');
    }

    public function down()
    {
        DB::statement('DROP TRIGGER IF EXISTS update_inventory_movements_modtime ON inventory_movements');
        Schema::dropIfExists('inventory_movements');
    }
};
