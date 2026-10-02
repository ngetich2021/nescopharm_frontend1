<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('quote_items', function (Blueprint $table) {
            $table->string('tax_type_code', 1)->nullable()->after('price_label');
            $table->decimal('tax_rate', 5, 2)->nullable()->after('tax_type_code');
        });

        // Converted quotes became orders/invoices that carried no VAT, so they
        // are frozen as Non-VAT to keep matching what was actually issued.
        // Open quotes are left null and pick up the product's current rate
        // until they're next saved.
        DB::table('quote_items')
            ->whereIn('quote_id', DB::table('quotes')->where('status', 'accepted')->select('id'))
            ->update(['tax_type_code' => 'D', 'tax_rate' => 0]);
    }

    public function down(): void
    {
        Schema::table('quote_items', function (Blueprint $table) {
            $table->dropColumn(['tax_type_code', 'tax_rate']);
        });
    }
};
