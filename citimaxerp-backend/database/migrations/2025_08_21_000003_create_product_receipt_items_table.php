<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('product_receipt_items', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id')->nullable()->index();
            $table->uuid('product_receipt_id');
            $table->uuid('product_id');
            $table->uuid('variant_id')->nullable();
            $table->uuid('unit_id')->nullable();
            $table->integer('quantity');
            $table->decimal('unit_quantity', 15, 4)->nullable();
            $table->integer('base_quantity')->nullable();
            $table->jsonb('packaging_breakdown')->nullable();
            $table->decimal('unit_price', 12, 2)->nullable();
            $table->date('expiry_date')->nullable();
            $table->string('notes')->nullable();
            $table->string('batch_number', 100)->nullable();
            $table->string('lot_number', 100)->nullable();
            $table->date('manufacture_date')->nullable();
            $table->string('supplier', 255)->nullable();
            $table->uuid('supplier_id')->nullable();
            $table->timestamps();
            
            $table->foreign('product_receipt_id')->references('id')->on('product_receipts')->onDelete('cascade');
            $table->foreign('product_id')->references('id')->on('products');
            $table->foreign('variant_id')->references('id')->on('product_variants');
            $table->foreign('supplier_id')->references('id')->on('suppliers')->onDelete('set null');
            $table->foreign('unit_id')->references('id')->on('product_packaging_units')->onDelete('set null');
            
            $table->index('batch_number', 'idx_product_receipt_items_batch');
            $table->index('supplier_id', 'idx_product_receipt_items_supplier');
            $table->index('unit_id', 'idx_product_receipt_items_unit_id');
        });
    }

    public function down()
    {
        Schema::dropIfExists('product_receipt_items');
    }
};
