<?php

use App\Models\Invoice;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Every invoice follows its customer's Credit Period: due = invoice date + that period. The old
 * values are kept in invoice_terms_backup_20261106, so this can be undone. The ledger is not touched.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement('CREATE TABLE IF NOT EXISTS invoice_terms_backup_20261106 AS
            SELECT id, due_date, credit_terms_days, payment_terms, status FROM invoices');

        $moved = Invoice::syncCreditPeriods();

        Log::info("Invoices put on their customer's Credit Period: {$moved}.");
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement('UPDATE invoices i
            SET due_date = b.due_date, credit_terms_days = b.credit_terms_days, payment_terms = b.payment_terms, status = b.status
            FROM invoice_terms_backup_20261106 b WHERE b.id = i.id');
    }
};
