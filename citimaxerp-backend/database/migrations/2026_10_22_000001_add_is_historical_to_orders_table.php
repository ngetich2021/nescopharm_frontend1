<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    // Sales brought across from the previous system. Their stock was already taken out
    // before the opening balances were captured, so these orders must never move stock
    // or post cost of goods sold - they only count towards sales, receivables and VAT.
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->boolean('is_historical')->default(false)->index();
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn('is_historical');
        });
    }
};
