<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up()
    {
        Schema::create('inventory_batches', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id')->index();
            $table->uuid('store_id')->nullable()->index();
            $table->uuid('product_id')->index();
            $table->uuid('variant_id')->nullable()->index();
            
            // Batch identification
            $table->string('batch_number', 100)->unique();
            $table->string('lot_number', 100)->nullable(); // Alternative identification
            $table->string('serial_number', 100)->nullable(); // For serialized items
            
            // Batch details
            $table->integer('quantity_received')->default(0);
            $table->integer('quantity_available')->default(0);
            $table->integer('quantity_allocated')->default(0);
            $table->integer('quantity_sold')->default(0);
            $table->integer('quantity_damaged')->default(0);
            $table->integer('quantity_expired')->default(0);
            
            // Dates
            $table->date('manufacture_date')->nullable();
            $table->date('expiry_date')->nullable();
            $table->date('received_date');
            
            // Pricing
            $table->decimal('unit_cost', 10, 2)->nullable();
            $table->decimal('selling_price', 10, 2)->nullable();
            
            // Status and tracking
            $table->enum('status', ['active', 'expired', 'recalled', 'damaged', 'sold_out'])->default('active');
            $table->string('supplier', 255)->nullable();
            $table->uuid('supplier_id')->nullable();
            $table->string('purchase_order_number', 100)->nullable();
            $table->uuid('product_receipt_id')->nullable(); // Link to receipt
            
            // Additional tracking fields
            $table->text('notes')->nullable();
            $table->jsonb('custom_attributes')->nullable(); // For flexible additional data
            
            $table->timestamps();
            
            // Foreign keys
            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->foreign('store_id')->references('id')->on('stores')->onDelete('set null');
            $table->foreign('product_id')->references('id')->on('products')->onDelete('cascade');
            $table->foreign('variant_id')->references('id')->on('product_variants')->onDelete('cascade');
            $table->foreign('supplier_id')->references('id')->on('suppliers')->onDelete('set null');
            $table->foreign('product_receipt_id')->references('id')->on('product_receipts')->onDelete('set null');
            
            // Indexes for performance
            $table->index(['company_id', 'store_id'], 'idx_inventory_batches_company_store');
            $table->index(['product_id', 'variant_id'], 'idx_inventory_batches_product_variant');
            $table->index('expiry_date', 'idx_inventory_batches_expiry');
            $table->index('received_date', 'idx_inventory_batches_received');
            $table->index('status', 'idx_inventory_batches_status');
            $table->index('batch_number', 'idx_inventory_batches_batch_number');
        });
        
        // Add trigger for updated_at
        DB::statement('
            CREATE TRIGGER update_inventory_batches_modtime
            BEFORE UPDATE ON inventory_batches
            FOR EACH ROW
            EXECUTE FUNCTION update_modified_column();
        ');
    }

    public function down()
    {
        DB::statement('DROP TRIGGER IF EXISTS update_inventory_batches_modtime ON inventory_batches');
        Schema::dropIfExists('inventory_batches');
    }
};
