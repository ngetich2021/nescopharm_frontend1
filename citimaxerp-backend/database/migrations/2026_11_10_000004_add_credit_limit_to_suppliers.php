<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A supplier's credit limit: how much we may owe them. Ordering past it only warns (purchase orders
 * still go through); empty means no limit.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('suppliers', 'credit_limit')) {
            Schema::table('suppliers', function (Blueprint $table) {
                $table->decimal('credit_limit', 15, 2)->nullable();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('suppliers', 'credit_limit')) {
            Schema::table('suppliers', function (Blueprint $table) {
                $table->dropColumn('credit_limit');
            });
        }
    }
};
