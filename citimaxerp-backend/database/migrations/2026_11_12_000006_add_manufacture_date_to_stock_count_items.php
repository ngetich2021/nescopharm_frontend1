<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Manufacturing date of the batch a count line is for (shown, and given to a batch found in the count). */
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('stock_count_items', 'manufacture_date')) {
            Schema::table('stock_count_items', function (Blueprint $table) {
                $table->date('manufacture_date')->nullable();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('stock_count_items', 'manufacture_date')) {
            Schema::table('stock_count_items', fn (Blueprint $table) => $table->dropColumn('manufacture_date'));
        }
    }
};
