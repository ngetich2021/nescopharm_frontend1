<?php

use App\Models\Company;
use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Str;

return new class extends Migration {
    /**
     * Full permission set for an "Accountant" role: complete sales workflow
     * (orders/quotes, including browsing products/customers to price them),
     * plus requisitions, payments/receipts, suppliers and finance. Destructive
     * and cross-company admin permissions (delete, manage_all, close periods,
     * can_manage_company/system) are deliberately left out.
     */
    private const PERMISSION_KEYS = [
        // Sales / Orders / Quotes
        'can_view_orders', 'can_create_orders', 'can_update_orders', 'can_dispatch_orders',
        'can_view_quotes', 'can_create_quotes', 'can_update_quotes',
        'can_view_quote_notes', 'can_create_quote_notes', 'can_update_quote_notes',
        'can_view_sales_menu', 'can_view_orders_menu', 'can_view_quotes_menu', 'can_view_invoices_menu',

        // Customers (needed to pick/create a customer on a quote/order)
        'can_view_customers', 'can_create_customers', 'can_update_customers', 'can_view_customers_menu',

        // Products (view only - catalog/price reference)
        'can_view_products', 'can_view_products_menu', 'can_view_product_categories',

        // Requisitions
        'can_view_requisitions', 'can_create_requisitions', 'can_update_requisitions',
        'can_acknowledge_requisitions', 'can_view_requisitions_menu',

        // Receipts / Payments
        'can_view_payments', 'can_create_payments', 'can_update_payments',
        'can_view_payment_reports', 'can_view_payments_menu', 'can_view_payment_reports_menu',

        // Suppliers
        'can_view_suppliers', 'can_create_suppliers', 'can_update_suppliers', 'can_view_suppliers_menu',
        'can_view_purchase_orders', 'can_create_purchase_orders', 'can_update_purchase_orders',
        'can_view_purchase_orders_menu',

        // Finance
        'can_view_invoices', 'can_create_invoices', 'can_update_invoices',
        'can_view_expenses', 'can_create_expenses', 'can_update_expenses', 'can_view_expenses_menu',
        'can_view_accounts_receivable', 'can_view_accounts', 'can_create_accounts', 'can_update_accounts',
        'can_record_accounts', 'can_view_accounts_reports',
        'can_view_chart_of_accounts', 'can_create_chart_of_accounts', 'can_update_chart_of_accounts',
        'can_view_journal_entries', 'can_create_journal_entries', 'can_update_journal_entries', 'can_post_journal_entries',
        'can_view_general_ledger', 'can_view_trial_balance', 'can_view_financial_reports', 'can_view_financial_periods',
        'can_view_bank_accounts', 'can_create_bank_accounts', 'can_update_bank_accounts',
        'can_view_bank_transactions', 'can_create_bank_transactions', 'can_update_bank_transactions',
        'can_import_bank_transactions', 'can_view_bank_reconciliation',
        'can_view_budgets', 'can_manage_budgets',
        'can_view_fixed_assets', 'can_create_fixed_assets', 'can_update_fixed_assets', 'can_calculate_depreciation',
        'can_view_tax_rates', 'can_create_tax_rates', 'can_update_tax_rates',
        'can_view_accounts_payable', 'can_manage_accounts_payable', 'can_manage_accounts_receivable',
        'can_view_balance_sheet', 'can_view_income_statement', 'can_view_cash_flow_statement',
        'can_view_financial_ratios', 'can_view_account_aging', 'can_view_budget_variance',
        'can_view_finance_menu', 'can_view_finance_dashboard_menu',
    ];

    public function up(): void
    {
        $permissions = Permission::whereIn('key', self::PERMISSION_KEYS)->get();
        $syncData = $permissions->mapWithKeys(fn (Permission $perm) => [$perm->id => ['granted_at' => now()]])->toArray();

        // `roles.name` is unique system-wide (not per company) in this
        // schema, so only one company can ever hold a given role name at a
        // time - skip inactive/merged company records and tolerate a name
        // collision on any one company without failing the whole batch.
        Company::query()->whereRaw('is_active = true')->each(function (Company $company) use ($syncData) {
            try {
                $role = Role::firstOrCreate(
                    ['name' => 'Accountant', 'company_id' => $company->id],
                    [
                        'id' => (string) Str::uuid(),
                        'description' => 'Full sales, requisitions, payments, suppliers and finance workflow access',
                        'is_active' => true,
                    ]
                );

                $role->permissions()->syncWithoutDetaching($syncData);
            } catch (\Illuminate\Database\QueryException $e) {
                report($e);
            }
        });
    }

    public function down(): void
    {
        Role::where('name', 'Accountant')->delete();
    }
};
