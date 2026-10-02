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
        Schema::create('product_store', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('product_id');
            $table->uuid('company_id');
            $table->uuid('store_id');
            $table->integer('stock_quantity')->default(0);
            $table->integer('on_hand')->default(0);
            $table->integer('allocated')->default(0);
            $table->decimal('price', 10, 2)->nullable();
            $table->unique(['product_id', 'store_id'], 'product_store_product_id_store_id_key');
            $table->foreign('company_id', 'product_store_company_id_fkey')->references('id')->on('companies')->onDelete('cascade');
            $table->foreign('product_id', 'product_store_product_id_fkey')->references('id')->on('products')->onDelete('cascade');
            $table->foreign('store_id', 'product_store_store_id_fkey')->references('id')->on('stores')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('product_store');
    }
};
