<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('product_receipts', function (Blueprint $table) {
            $table->decimal('shipping_cost', 10, 2)->default(0)->after('store_id');
            $table->decimal('logistics_cost', 10, 2)->default(0)->after('shipping_cost');
        });
    }

    public function down(): void
    {
        Schema::table('product_receipts', function (Blueprint $table) {
            $table->dropColumn(['shipping_cost', 'logistics_cost']);
        });
    }
};
