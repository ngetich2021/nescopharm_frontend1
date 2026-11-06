<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * An invoice on credit terms is due on its invoice date plus those terms. Some were saved with an
 * earlier (or no) due date, so they counted as overdue too soon. Dates only move later; an invoice
 * this makes no longer overdue goes back to owing.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        $days = "COALESCE(NULLIF(credit_terms_days, 0), substring(payment_terms from '^\\s*[Nn][Ee][Tt]\\s+([0-9]{1,4})\\s*$')::int)";

        $moved = DB::update("
            UPDATE invoices
            SET due_date = invoice_date::date + ({$days}),
                status = CASE
                    WHEN status = 'overdue' AND balance_amount > 0.005
                         AND invoice_date::date + ({$days}) >= CURRENT_DATE
                    THEN CASE WHEN COALESCE(amount_paid, 0) + COALESCE(amount_credited, 0) > 0.005 THEN 'partially_paid' ELSE 'sent' END
                    ELSE status
                END
            WHERE invoice_date IS NOT NULL
              AND ({$days}) > 0
              AND (due_date IS NULL OR due_date::date < invoice_date::date + ({$days}))
        ");

        Log::info("Invoice due dates aligned with their terms: {$moved} invoices.");
    }

    public function down(): void
    {
        // The earlier dates were wrong and are not kept.
    }
};
