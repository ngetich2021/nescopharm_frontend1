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
        Schema::create('inventory_serials', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('company_id');
            $table->uuid('store_id')->nullable();
            $table->uuid('product_id');
            $table->uuid('variant_id')->nullable();
            $table->uuid('batch_id')->nullable(); // Link to inventory_batches if applicable
            
            // Serial number information
            $table->string('serial_number'); // The actual serial number
            $table->string('barcode')->nullable(); // Optional barcode
            $table->string('qr_code')->nullable(); // Optional QR code
            
            // Status tracking
            $table->string('status')->default('active');
            
            // Cost and pricing
            $table->decimal('unit_cost', 10, 2)->nullable();
            $table->decimal('unit_price', 10, 2)->nullable();
            
            // Dates
            $table->date('received_date')->nullable();
            $table->date('sold_date')->nullable();
            $table->date('warranty_expiry_date')->nullable();
            
            // Transaction references
            $table->string('purchase_reference')->nullable(); // Reference to purchase order
            $table->string('sale_reference')->nullable(); // Reference to sale/order
            $table->uuid('customer_id')->nullable(); // Who bought it
            
            // Additional attributes
            $table->json('custom_attributes')->nullable(); // Flexible storage for additional data
            $table->text('notes')->nullable();
            
            // Audit fields
            $table->uuid('created_by')->nullable();
            $table->uuid('updated_by')->nullable();
            $table->timestamps();
        });

        // Add unique constraint, indexes, and foreign keys after table creation
        Schema::table('inventory_serials', function (Blueprint $table) {
            $table->unique('serial_number');
            
            // Indexes
            $table->index(['company_id', 'status']);
            $table->index(['company_id', 'product_id']);
            $table->index(['company_id', 'batch_id']);
            $table->index(['serial_number']);
            $table->index(['status']);
            
            // Foreign key constraints
            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->foreign('store_id')->references('id')->on('stores')->onDelete('set null');
            $table->foreign('product_id')->references('id')->on('products')->onDelete('cascade');
            $table->foreign('variant_id')->references('id')->on('product_variants')->onDelete('set null');
            $table->foreign('customer_id')->references('id')->on('customers')->onDelete('set null');
            $table->foreign('created_by')->references('id')->on('users')->onDelete('set null');
            $table->foreign('updated_by')->references('id')->on('users')->onDelete('set null');
        });

        // Add check constraint for status
        DB::statement("
            ALTER TABLE inventory_serials
            ADD CONSTRAINT inventory_serials_status_check
            CHECK (status IN ('active', 'sold', 'returned', 'damaged', 'lost', 'recalled'));
        ");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement('ALTER TABLE inventory_serials DROP CONSTRAINT IF EXISTS inventory_serials_status_check');
        Schema::dropIfExists('inventory_serials');
    }
};
