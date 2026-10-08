<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * account_code was unique across ALL companies, so only one company could
     * ever own account "1010". Uniqueness per company already exists
     * (chart_of_accounts_company_id_account_code_unique); drop the global one.
     */
    public function up(): void
    {
        DB::statement('ALTER TABLE chart_of_accounts DROP CONSTRAINT IF EXISTS chart_of_accounts_account_code_unique');
        DB::statement('DROP INDEX IF EXISTS chart_of_accounts_account_code_unique');
        DB::statement('CREATE UNIQUE INDEX IF NOT EXISTS chart_of_accounts_company_id_account_code_unique ON chart_of_accounts (company_id, account_code)');
    }

    public function down(): void
    {
        // Not restored: a global unique code is incompatible with per-company charts.
    }
};
