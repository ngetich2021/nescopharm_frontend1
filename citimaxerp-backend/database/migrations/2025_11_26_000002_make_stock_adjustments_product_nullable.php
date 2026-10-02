<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * This migration makes product-related columns nullable in the stock_adjustments table
     * to support the parent-child structure where product details are stored in items.
     */
    public function up(): void
    {
        Schema::table('stock_adjustments', function (Blueprint $table) {
            // Make product-related columns nullable for bulk adjustments
            // (product details are now stored in stock_adjustment_items)
            $table->uuid('product_id')->nullable()->change();
            $table->integer('quantity_adjusted')->nullable()->change();
            $table->string('adjustment_type')->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Note: This cannot be fully reversed if there are records with null product_id
        // You would need to populate product_id values first
        Schema::table('stock_adjustments', function (Blueprint $table) {
            // These would fail if there are null values
            // $table->uuid('product_id')->nullable(false)->change();
            // $table->integer('quantity_adjusted')->nullable(false)->change();
            // $table->string('adjustment_type')->nullable(false)->change();
        });
    }
};
