<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * orders.final_amount, discount and amount_paid were numeric(8,2), so any order of a
 * million shillings or more failed with "numeric field overflow". Every order amount
 * becomes numeric(15,2); widening keeps the existing values as they are.
 */
return new class extends Migration
{
    private const COLUMNS = ['total_amount', 'discount', 'tax', 'final_amount', 'amount_paid'];

    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }
        foreach (self::COLUMNS as $column) {
            DB::statement("ALTER TABLE orders ALTER COLUMN {$column} TYPE numeric(15,2)");
        }
    }

    public function down(): void
    {
        // Narrowing back would fail on any order of a million or more, so it is left wide.
    }
};
