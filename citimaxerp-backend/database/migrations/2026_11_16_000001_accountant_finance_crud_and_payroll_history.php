<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Cleaning up the books brought over from the old system, and recording every payroll since the
 * company started:
 * - payroll_runs.is_historical: a past payroll entered for the record (Payroll History import). Its
 *   figures are as typed, and it never posts to the ledger, because those salaries are already in
 *   the books as expenses.
 * - "Edit Posted Journal Entries": edit or delete a posted entry instead of only reversing it.
 * - The Accountant (and GM, Director) get full create/edit/delete across Finance and Payroll.
 */
return new class extends Migration
{
    private const GRANTS = [
        // key => [name, description, category]
        'can_edit_posted_journal_entries' => ['Edit Posted Journal Entries', 'Edit or delete journal entries that are already posted (cleaning up records from the old system)', 'Finance'],
        'can_view_journal_entries' => ['View Journal Entries', 'View journal entries', 'Finance'],
        'can_create_journal_entries' => ['Create Journal Entries', 'Create journal entries', 'Finance'],
        'can_update_journal_entries' => ['Edit Journal Entries', 'Edit journal entries', 'Finance'],
        'can_delete_journal_entries' => ['Delete Journal Entries', 'Delete journal entries', 'Finance'],
        'can_post_journal_entries' => ['Post Journal Entries', 'Post journal entries', 'Finance'],
        'can_reverse_journal_entries' => ['Reverse Journal Entries', 'Reverse posted journal entries', 'Finance'],
        'can_view_chart_of_accounts' => ['View Chart of Accounts', 'View the chart of accounts', 'Finance'],
        'can_create_chart_of_accounts' => ['Create Accounts', 'Add accounts to the chart of accounts', 'Finance'],
        'can_update_chart_of_accounts' => ['Edit Accounts', 'Edit accounts in the chart of accounts', 'Finance'],
        'can_delete_chart_of_accounts' => ['Delete Accounts', 'Delete accounts from the chart of accounts', 'Finance'],
        'can_view_bank_accounts' => ['View Bank Accounts', 'View bank accounts', 'Finance'],
        'can_create_bank_accounts' => ['Create Bank Accounts', 'Add bank accounts', 'Finance'],
        'can_update_bank_accounts' => ['Edit Bank Accounts', 'Edit bank accounts', 'Finance'],
        'can_delete_bank_accounts' => ['Delete Bank Accounts', 'Delete bank accounts', 'Finance'],
        'can_view_bank_transactions' => ['View Bank Transactions', 'View bank transactions', 'Finance'],
        'can_create_bank_transactions' => ['Create Bank Transactions', 'Add bank transactions', 'Finance'],
        'can_update_bank_transactions' => ['Edit Bank Transactions', 'Edit bank transactions', 'Finance'],
        'can_delete_bank_transactions' => ['Delete Bank Transactions', 'Delete bank transactions', 'Finance'],
        'can_import_bank_transactions' => ['Import Bank Transactions', 'Import bank statements', 'Finance'],
        'can_view_tax_rates' => ['View Tax Rates', 'View tax rates', 'Finance'],
        'can_create_tax_rates' => ['Create Tax Rates', 'Add tax rates', 'Finance'],
        'can_update_tax_rates' => ['Edit Tax Rates', 'Edit tax rates', 'Finance'],
        'can_delete_tax_rates' => ['Delete Tax Rates', 'Delete tax rates', 'Finance'],
        'can_view_budgets' => ['View Budgets', 'View budgets', 'Finance'],
        'can_manage_budgets' => ['Manage Budgets', 'Create, edit and delete budgets', 'Finance'],
        'can_view_financial_periods' => ['View Financial Periods', 'View financial periods', 'Finance'],
        'can_view_payroll' => ['View Payroll', 'View payroll runs and payslips', 'Payroll'],
        'can_create_payroll' => ['Create Payroll', 'Create and process payroll runs, import payroll history', 'Payroll'],
        'can_update_payroll' => ['Edit Payroll', 'Edit payslips', 'Payroll'],
        'can_approve_payroll' => ['Approve Payroll', 'Approve payroll runs', 'Payroll'],
        'can_process_payroll' => ['Pay Payroll', 'Mark payroll runs as paid', 'Payroll'],
        'can_delete_payroll' => ['Delete Payroll', 'Delete payroll runs', 'Payroll'],
    ];

    public function up(): void
    {
        if (!Schema::hasColumn('payroll_runs', 'is_historical')) {
            Schema::table('payroll_runs', function (Blueprint $table) {
                $table->boolean('is_historical')->default(false);
            });
        }

        $ids = [];
        foreach (self::GRANTS as $key => [$name, $description, $category]) {
            $ids[] = Permission::firstOrCreate(['key' => $key], [
                'id' => (string) Str::uuid(),
                'name' => $name,
                'description' => $description,
                'category' => $category,
                'is_system' => true,
                'is_active' => true,
            ])->id;
        }

        $grant = array_fill_keys($ids, ['granted_at' => now()]);
        Role::whereIn('name', ['GM', 'Director', 'Accountant'])
            ->each(fn (Role $role) => $role->permissions()->syncWithoutDetaching($grant));
    }

    public function down(): void
    {
        $id = Permission::where('key', 'can_edit_posted_journal_entries')->value('id');
        if ($id) {
            Role::all()->each(fn (Role $role) => $role->permissions()->detach($id));
            Permission::whereKey($id)->delete();
        }
        if (Schema::hasColumn('payroll_runs', 'is_historical')) {
            Schema::table('payroll_runs', fn (Blueprint $table) => $table->dropColumn('is_historical'));
        }
    }
};
