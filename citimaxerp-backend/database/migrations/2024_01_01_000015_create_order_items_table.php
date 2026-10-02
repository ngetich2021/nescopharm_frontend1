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
        Schema::create('order_items', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('order_id');
            $table->uuid('product_id');
            $table->uuid('variant_id')->nullable();
            $table->uuid('unit_id')->nullable();
            $table->integer('quantity');
            $table->decimal('unit_quantity', 15, 4)->nullable();
            $table->integer('base_quantity')->nullable();
            $table->jsonb('packaging_breakdown')->nullable();
            $table->decimal('unit_price', 10, 2);
            $table->decimal('total_price', 10, 2);
            $table->timestamp('created_at')->nullable()->default(DB::raw('CURRENT_TIMESTAMP'));
            $table->timestamp('updated_at')->nullable()->default(DB::raw('CURRENT_TIMESTAMP'));
            $table->uuid('company_id')->nullable();
            $table->foreign('variant_id', 'fk_order_items_variant_id')->references('id')->on('product_variants')->onDelete('cascade');
            $table->foreign('company_id', 'order_items_company_id_fkey')->references('id')->on('companies');
            $table->foreign('order_id', 'order_items_order_id_fkey')->references('id')->on('orders');
            $table->foreign('product_id', 'order_items_product_id_fkey')->references('id')->on('products')->onDelete('cascade');
            // unit_id foreign key deferred to later migration (references product_packaging_units)

            $table->index('product_id', 'idx_order_items_product_id');
            $table->index('variant_id', 'idx_order_items_variant_id');
            $table->index('unit_id', 'idx_order_items_unit_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('order_items');
    }
};
