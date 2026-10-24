<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * A file number is a whole number from 1 to the number of invoices, used once per company.
 * Anything already saved that breaks that (e.g. "-") is cleared so it can be entered again.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Not a whole number, zero, or more than the company has invoices.
        DB::statement(<<<'SQL'
            UPDATE invoices i SET file_number = NULL, filed_at = NULL, filed_by = NULL
            WHERE file_number IS NOT NULL AND (
                file_number !~ '^[0-9]+$'
                OR file_number::numeric < 1
                OR file_number::numeric > (SELECT COUNT(*) FROM invoices x WHERE x.company_id = i.company_id)
            )
        SQL);
        // "007" and "7" are the same number.
        DB::statement("UPDATE invoices SET file_number = (file_number::numeric)::bigint::text WHERE file_number IS NOT NULL");
        // Used twice: the earliest filed keeps it.
        DB::statement(<<<'SQL'
            UPDATE invoices SET file_number = NULL, filed_at = NULL, filed_by = NULL
            WHERE id IN (
                SELECT id FROM (
                    SELECT id, ROW_NUMBER() OVER (PARTITION BY company_id, file_number ORDER BY filed_at NULLS LAST, created_at) AS n
                    FROM invoices WHERE file_number IS NOT NULL
                ) t WHERE n > 1
            )
        SQL);

        DB::statement('CREATE UNIQUE INDEX IF NOT EXISTS invoices_company_file_number_unique ON invoices (company_id, file_number) WHERE file_number IS NOT NULL');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS invoices_company_file_number_unique');
    }
};
