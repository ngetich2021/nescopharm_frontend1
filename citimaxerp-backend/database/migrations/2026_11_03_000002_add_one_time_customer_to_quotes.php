<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * A quotation for someone not in the system ("one-time customer"): only their name and the
 * payment period offered (days; 0 = cash) are kept on the quote, with customer_id left empty
 * (so customer_id may now be null).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('quotes', function (Blueprint $table) {
            if (!Schema::hasColumn('quotes', 'one_time_customer_name')) {
                $table->string('one_time_customer_name', 255)->nullable();
            }
            if (!Schema::hasColumn('quotes', 'payment_days')) {
                $table->unsignedSmallInteger('payment_days')->nullable();
            }
        });
        DB::statement('ALTER TABLE quotes ALTER COLUMN customer_id DROP NOT NULL');
    }

    public function down(): void
    {
        Schema::table('quotes', function (Blueprint $table) {
            $table->dropColumn(['one_time_customer_name', 'payment_days']);
        });
    }
};
