<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up()
    {
        Schema::create('purchase_orders', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('company_id')->index();
            $table->string('order_number')->unique();
            $table->uuid('supplier_id')->index();
            $table->decimal('discount', 10, 2)->nullable();
            $table->date('supplier_invoice_date')->nullable();
            $table->string('tax_rate')->nullable();
            $table->uuid('store_id')->nullable()->index();
            $table->decimal('exchange_rate', 12, 4)->default(1);
            $table->date('order_date');
            $table->date('delivery_date')->nullable();
            $table->string('template')->nullable();
            $table->string('currency_code');
            $table->string('status');
            $table->text('comments')->nullable();
            $table->uuid('created_by')->nullable();
            $table->uuid('updated_by')->nullable();
            $table->uuid('parent_id')->nullable()->index();
            $table->timestamps();

            $table->foreign('company_id')->references('id')->on('companies')->onDelete('restrict');
            $table->foreign('supplier_id')->references('id')->on('suppliers')->onDelete('restrict');
            $table->foreign('store_id')->references('id')->on('stores')->onDelete('restrict');
            $table->foreign('created_by')->references('id')->on('users')->onDelete('set null');
            $table->foreign('updated_by')->references('id')->on('users')->onDelete('set null');
        });

        Schema::create('purchase_order_items', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('purchase_order_id')->index();
            $table->uuid('product_id')->index();
            $table->uuid('variant_id')->nullable()->index();
            $table->uuid('unit_id')->nullable();
            $table->integer('quantity');
            $table->integer('received_quantity')->default(0);
            $table->decimal('unit_quantity', 15, 4)->nullable();
            $table->integer('base_quantity')->nullable();
            $table->jsonb('packaging_breakdown')->nullable();
            $table->decimal('unit_price', 10, 2);
            $table->decimal('subtotal', 10, 2);
            $table->decimal('tax_amount', 10, 2)->default(0);
            $table->decimal('discount', 10, 2)->default(0);
            $table->text('description')->nullable();
            $table->string('sku')->nullable();
            $table->uuid('store_id')->nullable()->index();
            $table->timestamps();

            $table->foreign('purchase_order_id')->references('id')->on('purchase_orders')->onDelete('cascade');
            $table->foreign('product_id')->references('id')->on('products')->onDelete('restrict');
            $table->foreign('variant_id')->references('id')->on('product_variants')->onDelete('restrict');
            $table->foreign('store_id')->references('id')->on('stores')->onDelete('restrict');
            // unit_id foreign key deferred to later migration (references product_packaging_units)
            $table->index('unit_id', 'idx_purchase_order_items_unit_id');
        });
    }

    public function down()
    {
        Schema::dropIfExists('purchase_order_items');
        Schema::dropIfExists('purchase_orders');
    }
};