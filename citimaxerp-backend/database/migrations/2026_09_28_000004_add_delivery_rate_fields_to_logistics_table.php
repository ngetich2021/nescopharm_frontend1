<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('logistics', function (Blueprint $table) {
            $table->uuid('delivery_rate_id')->nullable()->after('order_dispatch_id');
            $table->integer('number_of_cartons')->nullable()->after('delivery_rate_id');
            $table->uuid('delivery_invoice_id')->nullable()->after('number_of_cartons');

            $table->foreign('delivery_rate_id')->references('id')->on('delivery_rates')->nullOnDelete();
            $table->foreign('delivery_invoice_id')->references('id')->on('delivery_invoices')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('logistics', function (Blueprint $table) {
            $table->dropForeign(['delivery_rate_id']);
            $table->dropForeign(['delivery_invoice_id']);
            $table->dropColumn(['delivery_rate_id', 'number_of_cartons', 'delivery_invoice_id']);
        });
    }
};
