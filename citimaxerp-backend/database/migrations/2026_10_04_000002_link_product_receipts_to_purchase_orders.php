<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('product_receipts', function (Blueprint $table) {
            if (!Schema::hasColumn('product_receipts', 'purchase_order_id')) {
                $table->uuid('purchase_order_id')->nullable()->index();
                $table->foreign('purchase_order_id')->references('id')->on('purchase_orders')->nullOnDelete();
            }
        });

        Schema::table('product_receipt_items', function (Blueprint $table) {
            if (!Schema::hasColumn('product_receipt_items', 'purchase_order_item_id')) {
                $table->uuid('purchase_order_item_id')->nullable()->index();
                $table->foreign('purchase_order_item_id')->references('id')->on('purchase_order_items')->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('product_receipt_items', function (Blueprint $table) {
            $table->dropForeign(['purchase_order_item_id']);
            $table->dropColumn('purchase_order_item_id');
        });
        Schema::table('product_receipts', function (Blueprint $table) {
            $table->dropForeign(['purchase_order_id']);
            $table->dropColumn('purchase_order_id');
        });
    }
};
