<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * An expense is charged to a ledger account (main account -> sub-account) chosen on the form,
 * not to a category. Existing expenses get the account their category already posted to, so
 * nothing in the ledger moves. The category becomes optional.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('expenses', 'account_id')) {
            Schema::table('expenses', function (Blueprint $table) {
                $table->uuid('account_id')->nullable()->after('category_id');
                $table->foreign('account_id')->references('id')->on('chart_of_accounts')->nullOnDelete();
                $table->index('account_id');
            });
        }

        DB::statement('ALTER TABLE expenses ALTER COLUMN category_id DROP NOT NULL');

        // The category's own account first, then the company's general expense account.
        DB::statement(<<<'SQL'
            UPDATE expenses e SET account_id = m.chart_of_account_id
            FROM company_account_mappings m
            WHERE e.account_id IS NULL AND m.company_id = e.company_id AND m.is_active = true
              AND m.mapping_key = 'miscellaneous_expense' AND m.context_type = 'expense_category'
              AND m.context_id::text = e.category_id::text AND m.chart_of_account_id IS NOT NULL
        SQL);
        DB::statement(<<<'SQL'
            UPDATE expenses e SET account_id = m.chart_of_account_id
            FROM company_account_mappings m
            WHERE e.account_id IS NULL AND m.company_id = e.company_id AND m.is_active = true
              AND m.mapping_key = 'miscellaneous_expense' AND m.context_type IS NULL
              AND m.chart_of_account_id IS NOT NULL
        SQL);
    }

    public function down(): void
    {
        if (Schema::hasColumn('expenses', 'account_id')) {
            Schema::table('expenses', function (Blueprint $table) {
                $table->dropForeign(['account_id']);
                $table->dropIndex(['account_id']);
                $table->dropColumn('account_id');
            });
        }
    }
};
