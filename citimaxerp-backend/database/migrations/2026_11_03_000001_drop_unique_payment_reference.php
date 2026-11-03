<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * A payment's reference is the customer's bank / M-Pesa reference, and one reference can carry
 * several receipts (two payments quoting the same invoice no., or one deposit recorded in parts).
 * The unique index refused the second receipt, so it becomes a plain index. M-Pesa callbacks
 * still skip a code already received (PaymentController::mpesaCallback).
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_transaction_id_unique');
        DB::statement('DROP INDEX IF EXISTS payments_transaction_id_unique');
        DB::statement('CREATE INDEX IF NOT EXISTS payments_transaction_id_index ON payments (transaction_id)');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS payments_transaction_id_index');
    }
};
