<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Credit notes applied to an invoice were added to amount_paid, so a credited invoice read
 * "Paid" and the credit vanished whenever amount_paid was recomputed from receipts. Credit
 * now has its own column: balance = total - amount_paid - amount_credited.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('invoices', 'amount_credited')) {
            Schema::table('invoices', function (Blueprint $table) {
                $table->decimal('amount_credited', 15, 2)->default(0);
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('invoices', 'amount_credited')) {
            Schema::table('invoices', function (Blueprint $table) {
                $table->dropColumn('amount_credited');
            });
        }
    }
};
