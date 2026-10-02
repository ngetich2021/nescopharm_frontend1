<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Internal-only record of which named price (see product_prices) was
        // used for this line, or "Custom" when staff typed a different
        // figure by hand. Staff-facing views only (ViewQuoteSheet, order
        // details) - never rendered on a customer-facing quote/order PDF.
        Schema::table('quote_items', function (Blueprint $table) {
            $table->string('price_label', 100)->nullable()->after('unit_price');
        });

        Schema::table('order_items', function (Blueprint $table) {
            $table->string('price_label', 100)->nullable()->after('unit_price');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('quote_items', function (Blueprint $table) {
            $table->dropColumn('price_label');
        });

        Schema::table('order_items', function (Blueprint $table) {
            $table->dropColumn('price_label');
        });
    }
};
