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
        Schema::create('order_dispatch_items', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('order_dispatch_id');
            $table->uuid('order_item_id')->nullable(); // Reference to original order item
            $table->uuid('product_id');
            $table->uuid('variant_id')->nullable();
            $table->string('product_code')->nullable();
            
            // Quantity and packaging
            $table->integer('quantity');
            $table->uuid('unit_id')->nullable(); // Unit of measure
            $table->decimal('unit_quantity', 15, 4)->nullable();
            $table->integer('base_quantity')->nullable();
            $table->jsonb('packaging_breakdown')->nullable(); // e.g., {"cartons": 2, "pieces": 5}
            $table->text('packaging_notes')->nullable();
            
            // Delivery tracking
            $table->integer('delivered_quantity')->default(0);
            $table->integer('damaged_quantity')->default(0);
            $table->text('delivery_notes')->nullable();
            
            $table->timestamps();
            
            // Foreign keys
            $table->foreign('order_dispatch_id')->references('id')->on('order_dispatches')->onDelete('cascade');
            $table->foreign('order_item_id')->references('id')->on('order_items')->onDelete('set null');
            $table->foreign('product_id')->references('id')->on('products')->onDelete('cascade');
            $table->foreign('variant_id')->references('id')->on('product_variants')->onDelete('set null');
            // Only add unit_id foreign key if units table exists
            if (Schema::hasTable('units')) {
                $table->foreign('unit_id')->references('id')->on('units')->onDelete('set null');
            }
            
            // Indexes
            $table->index('order_dispatch_id', 'idx_order_dispatch_items_dispatch_id');
            $table->index('product_id', 'idx_order_dispatch_items_product_id');
            $table->index('order_item_id', 'idx_order_dispatch_items_order_item_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('order_dispatch_items');
    }
};
