<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * An expense can include VAT: the amount paid stays as typed (e.g. 232,000), the VAT in it
 * (32,000 at 16%) goes to the VAT Account and only the rest (200,000) to the expense account.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('expenses', function (Blueprint $table) {
            if (!Schema::hasColumn('expenses', 'includes_vat')) {
                $table->boolean('includes_vat')->default(false)->after('amount');
            }
            if (!Schema::hasColumn('expenses', 'vat_rate')) {
                $table->decimal('vat_rate', 5, 2)->nullable()->after('includes_vat');
            }
            if (!Schema::hasColumn('expenses', 'vat_amount')) {
                $table->decimal('vat_amount', 15, 2)->default(0)->after('vat_rate');
            }
        });
    }

    public function down(): void
    {
        Schema::table('expenses', function (Blueprint $table) {
            foreach (['vat_amount', 'vat_rate', 'includes_vat'] as $column) {
                if (Schema::hasColumn('expenses', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
