<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Carbon\Carbon;
use App\Models\Company;
use App\Models\User;
use App\Models\Role;
use App\Models\Permission;
use App\Models\Store;
use App\Models\Customer;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\Supplier;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Invoice;
use App\Models\InvoiceLineItem;
use App\Models\Payment;
use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Models\Employee;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\Quote;
use App\Models\QuoteItem;
use App\Models\DeliveryLocation;
use App\Models\DeliveryPerson;
use App\Models\FixedAsset;
use App\Models\BankAccount;
use App\Models\ChartOfAccount;
use App\Models\TaxRate;
use App\Models\ActivityLog;

class ComprehensiveSeeder extends Seeder
{
    /** firstOrCreate with explicit UUID to ensure id is populated */
    private function foc(string $model, array $search, array $values = [])
    {
        if (!isset($values['id'])) {
            $values['id'] = Str::uuid()->toString();
        }
        return $model::unguarded(fn () => $model::firstOrCreate($search, $values));
    }

    private static array $allPermissionKeys = [
        // System
        'can_manage_system', 'can_manage_company', 'can_manage_system_permissions', 'can_access_admin_portal',
        'can_view_company', 'can_update_company', 'can_create_company', 'can_view_companies', 'can_manage_companies',
        // Users
        'can_view_users', 'can_create_users', 'can_update_users', 'can_delete_users',
        'can_view_all_users', 'can_update_all_users', 'can_manage_all_users',
        // Roles
        'can_view_roles', 'can_create_roles', 'can_update_roles', 'can_delete_roles',
        'can_view_all_roles', 'can_assign_roles',
        // Dashboard
        'can_view_dashboard',
        // Products
        'can_view_products', 'can_create_products', 'can_update_products', 'can_delete_products', 'can_manage_all_products',
        'can_view_product_categories', 'can_create_product_categories', 'can_update_product_categories', 'can_delete_product_categories',
        // Inventory
        'can_view_inventory', 'can_create_inventory', 'can_update_inventory',
        'can_view_stock_counts', 'can_create_stock_counts', 'can_update_stock_counts', 'can_delete_stock_counts',
        'can_view_product_receipts',
        // Orders
        'can_view_orders', 'can_create_orders', 'can_update_orders', 'can_delete_orders', 'can_dispatch_orders',
        // Quotes
        'can_view_quotes', 'can_create_quotes', 'can_update_quotes', 'can_delete_quotes', 'can_manage_all_quotes',
        'can_view_quote_notes', 'can_create_quote_notes', 'can_update_quote_notes', 'can_delete_quote_notes',
        // Customers
        'can_view_customers', 'can_create_customers', 'can_update_customers', 'can_delete_customers',
        'can_view_delivery_locations',
        'can_view_accounts', 'can_create_accounts', 'can_update_accounts', 'can_delete_accounts',
        'can_record_accounts', 'can_view_account_approvals', 'can_approve_account', 'can_request_credit_updates',
        'can_view_documents', 'can_create_documents', 'can_update_documents', 'can_delete_documents',
        // Invoices
        'can_view_invoices', 'can_create_invoices', 'can_update_invoices', 'can_delete_invoices',
        // Payments
        'can_view_payments', 'can_create_payments', 'can_update_payments', 'can_manage_payments', 'can_manage_all_payments',
        'can_refund_payments', 'can_view_payment_reports',
        // Expenses
        'can_view_expenses', 'can_create_expenses', 'can_update_expenses', 'can_delete_expenses',
        'can_approve_expenses', 'can_delete_approved_expenses', 'can_manage_all_expenses',
        // Suppliers
        'can_view_suppliers', 'can_manage_suppliers', 'can_update_suppliers',
        // Purchase Orders
        'can_view_purchase_orders', 'can_create_purchase_orders', 'can_update_purchase_orders', 'can_delete_purchase_orders',
        'can_approve_purchase_orders', 'can_receive_purchase_orders', 'can_manage_all_purchase_orders',
        // Employees & Payroll
        'can_view_employees', 'can_create_employees', 'can_update_employees', 'can_delete_employees',
        'can_view_payroll', 'can_create_payroll', 'can_update_payroll', 'can_delete_payroll',
        'can_approve_payroll', 'can_process_payroll',
        'can_view_leave_management_menu', 'can_view_salary_advance_menu', 'can_view_time_management_menu',
        // Stores
        'can_view_stores',
        // Delivery
        'can_view_deliveries', 'can_create_delivery_persons', 'can_update_delivery_persons', 'can_deactivate_delivery_persons',
        // Dispatches
        'can_view_dispatches', 'can_create_dispatches', 'can_update_dispatches', 'can_delete_dispatches', 'can_return_dispatches', 'can_dispatch_items',
        'can_view_order_dispatches', 'can_create_order_dispatches', 'can_update_order_dispatches', 'can_delete_order_dispatches',
        'can_approve_order_dispatches', 'can_dispatch_order_dispatches',
        // Logistics
        'can_view_logistics', 'can_create_logistics', 'can_update_logistics', 'can_manage_all_logistics',
        // Finance / Accounting
        'can_view_chart_of_accounts', 'can_create_chart_of_accounts', 'can_update_chart_of_accounts', 'can_delete_chart_of_accounts',
        'can_view_journal_entries', 'can_create_journal_entries', 'can_update_journal_entries', 'can_delete_journal_entries',
        'can_post_journal_entries', 'can_reverse_journal_entries',
        'can_view_tax_rates', 'can_create_tax_rates', 'can_update_tax_rates', 'can_delete_tax_rates',
        'can_view_bank_accounts', 'can_create_bank_accounts', 'can_update_bank_accounts', 'can_delete_bank_accounts',
        'can_view_bank_transactions', 'can_create_bank_transactions', 'can_update_bank_transactions', 'can_delete_bank_transactions', 'can_import_bank_transactions',
        'can_view_bank_reconciliation',
        'can_view_fixed_assets', 'can_create_fixed_assets', 'can_update_fixed_assets', 'can_delete_fixed_assets', 'can_calculate_depreciation',
        'can_view_financial_periods', 'can_close_financial_periods', 'can_reopen_financial_periods', 'can_set_current_financial_period',
        'can_view_financial_reports', 'can_view_general_ledger', 'can_view_trial_balance',
        'can_view_accounts_receivable', 'can_view_accounts_reports', 'can_view_budgets',
        'can_manage_all_finance',
        // Reports & SOPs
        'can_view_reports', 'can_create_reports', 'can_update_reports', 'can_delete_reports',
        'can_view_sops', 'can_create_sops', 'can_update_sops', 'can_delete_sops', 'can_comment_sops',
        // Breakages & Repairs
        'can_view_breakages', 'can_create_breakages', 'can_update_breakages', 'can_delete_breakages',
        'can_approve_breakages', 'can_manage_all_breakages', 'can_replace_breakage_items',
        'can_view_repairs', 'can_create_repairs', 'can_update_repairs', 'can_delete_repairs',
        'can_approve_repairs', 'can_complete_repairs', 'can_dispatch_repaired_items', 'can_manage_all_repairs',
        // Requisitions
        'can_view_requisitions', 'can_create_requisitions', 'can_update_requisitions', 'can_delete_requisitions',
        'can_approve_requisitions', 'can_acknowledge_requisitions', 'can_manage_all_requisitions',
        // Stock Adjustments
        'can_approve_adjustments', 'can_adjust_closing_stock',
        // Workflows & Approvals
        'can_view_workflows', 'can_create_workflows', 'can_edit_workflows', 'can_delete_workflows',
        'can_view_approvals', 'can_cancel_workflows', 'can_view_workflow_reports',
    ];

    public function run(): void
    {
        \Illuminate\Database\Eloquent\Model::unguard();
        $company = Company::first();
        $admin = User::where('email', 'admin@cherrydist.com')->first();
        $store = Store::where('company_id', $company->id)->first();
        $role = Role::where('company_id', $company->id)->first();
        $supplier = Supplier::where('company_id', $company->id)->first();
        $category = ProductCategory::where('company_id', $company->id)->first();
        $expenseCategory = ExpenseCategory::where('company_id', $company->id)->first();
        $existingCustomer = Customer::where('company_id', $company->id)->first();
        $existingProducts = Product::where('company_id', $company->id)->pluck('id')->toArray();

        $now = Carbon::now();
        $cid = $company->id;
        $sid = $store->id;
        $aid = $admin->id;

        // Fix admin
        $admin->update(['email_verified' => true]);
        $role->update(['name' => 'Super Admin']);

        // ═══════════════════════════════════════════
        // PERMISSIONS — all system permissions
        // ═══════════════════════════════════════════
        $this->command->info('Creating permissions...');
        $permIds = [];
        foreach (self::$allPermissionKeys as $key) {
            $name = ucwords(str_replace(['can_', '_'], ['', ' '], $key));
            $perm = Permission::firstOrCreate(
                ['key' => $key],
                ['name' => $name, 'description' => $name, 'category' => 'General']
            );
            $permIds[$key] = $perm->id;
            // Grant all to Super Admin
            $role->permissions()->syncWithoutDetaching([$perm->id => ['granted_at' => $now]]);
        }

        // ═══════════════════════════════════════════
        // ROLES
        // ═══════════════════════════════════════════
        $this->command->info('Creating roles...');
        $salesRole = Role::firstOrCreate(['name' => 'Sales Manager', 'company_id' => $cid], ['description' => 'Manages sales operations']);
        $warehouseRole = Role::firstOrCreate(['name' => 'Warehouse Staff', 'company_id' => $cid], ['description' => 'Handles inventory and dispatch']);
        $financeRole = Role::firstOrCreate(['name' => 'Finance Officer', 'company_id' => $cid], ['description' => 'Handles finance and accounting']);
        $hrRole = Role::firstOrCreate(['name' => 'HR Manager', 'company_id' => $cid], ['description' => 'Manages employees and payroll']);
        $directorRole = Role::firstOrCreate(['name' => 'Director', 'company_id' => $cid], ['description' => 'Company director - full oversight, including closing-stock adjustments']);

        // Director: full company access, same as Super Admin.
        foreach ($permIds as $permId) { $directorRole->permissions()->syncWithoutDetaching([$permId => ['granted_at' => $now]]); }

        // Sales Manager permissions
        $salesPerms = ['can_view_dashboard', 'can_view_orders', 'can_create_orders', 'can_update_orders', 'can_view_quotes', 'can_create_quotes', 'can_update_quotes', 'can_view_customers', 'can_create_customers', 'can_update_customers', 'can_view_products', 'can_view_invoices', 'can_create_invoices', 'can_view_payments', 'can_create_payments', 'can_view_delivery_locations', 'can_view_reports', 'can_view_dispatches', 'can_create_dispatches'];
        foreach ($salesPerms as $k) { if (isset($permIds[$k])) $salesRole->permissions()->syncWithoutDetaching([$permIds[$k] => ['granted_at' => $now]]); }

        // Warehouse permissions
        $whPerms = ['can_view_dashboard', 'can_view_products', 'can_update_products', 'can_view_inventory', 'can_update_inventory', 'can_view_stock_counts', 'can_create_stock_counts', 'can_view_dispatches', 'can_create_dispatches', 'can_update_dispatches', 'can_dispatch_items', 'can_view_order_dispatches', 'can_create_order_dispatches', 'can_view_product_receipts', 'can_view_purchase_orders', 'can_receive_purchase_orders', 'can_view_breakages', 'can_create_breakages', 'can_view_repairs', 'can_view_requisitions', 'can_create_requisitions'];
        foreach ($whPerms as $k) { if (isset($permIds[$k])) $warehouseRole->permissions()->syncWithoutDetaching([$permIds[$k] => ['granted_at' => $now]]); }

        // Finance permissions
        $finPerms = ['can_view_dashboard', 'can_view_chart_of_accounts', 'can_create_chart_of_accounts', 'can_update_chart_of_accounts', 'can_view_journal_entries', 'can_create_journal_entries', 'can_post_journal_entries', 'can_view_invoices', 'can_create_invoices', 'can_update_invoices', 'can_view_payments', 'can_create_payments', 'can_view_expenses', 'can_create_expenses', 'can_approve_expenses', 'can_view_tax_rates', 'can_view_bank_accounts', 'can_view_bank_transactions', 'can_view_bank_reconciliation', 'can_view_fixed_assets', 'can_view_financial_reports', 'can_view_general_ledger', 'can_view_trial_balance', 'can_view_accounts_receivable', 'can_view_budgets', 'can_view_financial_periods', 'can_view_reports'];
        foreach ($finPerms as $k) { if (isset($permIds[$k])) $financeRole->permissions()->syncWithoutDetaching([$permIds[$k] => ['granted_at' => $now]]); }

        // HR permissions
        $hrPerms = ['can_view_dashboard', 'can_view_employees', 'can_create_employees', 'can_update_employees', 'can_view_payroll', 'can_create_payroll', 'can_approve_payroll', 'can_process_payroll', 'can_view_leave_management_menu', 'can_view_salary_advance_menu', 'can_view_time_management_menu', 'can_view_reports'];
        foreach ($hrPerms as $k) { if (isset($permIds[$k])) $hrRole->permissions()->syncWithoutDetaching([$permIds[$k] => ['granted_at' => $now]]); }

        // ═══════════════════════════════════════════
        // USERS
        // ═══════════════════════════════════════════
        $this->command->info('Creating users...');
        $userIds = [$aid];
        $usersData = [
            ['first_name' => 'Grace', 'last_name' => 'Muthoni', 'email' => 'grace@cherrydist.com', 'role_id' => $salesRole->id],
            ['first_name' => 'Peter', 'last_name' => 'Kamau', 'email' => 'peter@cherrydist.com', 'role_id' => $salesRole->id],
            ['first_name' => 'Faith', 'last_name' => 'Wanjiku', 'email' => 'faith@cherrydist.com', 'role_id' => $warehouseRole->id],
            ['first_name' => 'Brian', 'last_name' => 'Ochieng', 'email' => 'brian@cherrydist.com', 'role_id' => $warehouseRole->id],
            ['first_name' => 'Lucy', 'last_name' => 'Akinyi', 'email' => 'lucy@cherrydist.com', 'role_id' => $financeRole->id],
            ['first_name' => 'James', 'last_name' => 'Mwangi', 'email' => 'james@cherrydist.com', 'role_id' => $hrRole->id],
        ];
        foreach ($usersData as $u) {
            $user = User::firstOrCreate(['email' => $u['email']], array_merge($u, [
                'company_id' => $cid, 'password' => Hash::make('password'),
                'phone' => '+2547' . rand(10000000, 99999999),
            ]));
            $userIds[] = $user->id;
        }

        // ═══════════════════════════════════════════
        // STORES, SUPPLIERS, CATEGORIES
        // ═══════════════════════════════════════════
        $this->command->info('Creating stores, suppliers, categories...');
        $this->foc(Store::class, ['name' => 'Mombasa Branch', 'company_id' => $cid], ['description' => 'Coastal distribution center', 'address' => 'Nyali Road', 'city' => 'Mombasa', 'phone' => '+254722222222', 'email' => 'mombasa@cherrydist.com']);

        $supplier2 = $this->foc(Supplier::class, ['name' => 'East African Breweries', 'company_id' => $cid], ['email' => 'supply@eabl.co.ke', 'phone' => '+254744444444', 'address' => 'Ruaraka, Nairobi', 'contact_person' => 'James Mwangi']);
        $supplier3 = $this->foc(Supplier::class, ['name' => 'Bidco Africa', 'company_id' => $cid], ['email' => 'orders@bidco.co.ke', 'phone' => '+254755555555', 'address' => 'Thika Road, Nairobi', 'contact_person' => 'Mary Njeri']);

        $cat2 = $this->foc(ProductCategory::class, ['name' => 'Juices', 'company_id' => $cid], ['description' => 'Fruit juices and nectars']);
        $cat3 = $this->foc(ProductCategory::class, ['name' => 'Water', 'company_id' => $cid], ['description' => 'Bottled water products']);
        $cat4 = $this->foc(ProductCategory::class, ['name' => 'Snacks', 'company_id' => $cid], ['description' => 'Packaged snacks and biscuits']);

        $expCat2 = $this->foc(ExpenseCategory::class, ['name' => 'Transport', 'company_id' => $cid], ['id' => Str::uuid()->toString(), 'description' => 'Vehicle fuel and maintenance']);
        $expCat3 = $this->foc(ExpenseCategory::class, ['name' => 'Office Supplies', 'company_id' => $cid], ['id' => Str::uuid()->toString(), 'description' => 'Stationery and equipment']);

        // ═══════════════════════════════════════════
        // PRODUCTS
        // ═══════════════════════════════════════════
        $this->command->info('Creating products...');
        $productIds = $existingProducts;
        $prods = [
            // Soft Drinks
            ['code' => 'FANTA-500', 'name' => 'Fanta Orange 500ml', 'price' => 50, 'cost' => 35, 'stock' => 400, 'cat' => $category->id, 'sup' => $supplier->id],
            ['code' => 'FANTA-1L', 'name' => 'Fanta Orange 1L', 'price' => 90, 'cost' => 60, 'stock' => 300, 'cat' => $category->id, 'sup' => $supplier->id],
            ['code' => 'FANTA-2L', 'name' => 'Fanta Orange 2L', 'price' => 150, 'cost' => 100, 'stock' => 200, 'cat' => $category->id, 'sup' => $supplier->id],
            ['code' => 'COKE-1L', 'name' => 'Coca-Cola 1L', 'price' => 90, 'cost' => 60, 'stock' => 350, 'cat' => $category->id, 'sup' => $supplier->id],
            ['code' => 'COKE-2L', 'name' => 'Coca-Cola 2L', 'price' => 150, 'cost' => 100, 'stock' => 250, 'cat' => $category->id, 'sup' => $supplier->id],
            ['code' => 'SPRITE-1L', 'name' => 'Sprite 1L', 'price' => 90, 'cost' => 60, 'stock' => 280, 'cat' => $category->id, 'sup' => $supplier->id],
            ['code' => 'STONEY-500', 'name' => 'Stoney Tangawizi 500ml', 'price' => 50, 'cost' => 35, 'stock' => 350, 'cat' => $category->id, 'sup' => $supplier->id],
            ['code' => 'NOVIDA-500', 'name' => 'Novida Pineapple 500ml', 'price' => 50, 'cost' => 35, 'stock' => 300, 'cat' => $category->id, 'sup' => $supplier->id],
            ['code' => 'KREST-500', 'name' => 'Krest Bitter Lemon 500ml', 'price' => 55, 'cost' => 38, 'stock' => 200, 'cat' => $category->id, 'sup' => $supplier->id],
            // Juices
            ['code' => 'MINUTE-1L', 'name' => 'Minute Maid 1L', 'price' => 150, 'cost' => 100, 'stock' => 200, 'cat' => $cat2->id, 'sup' => $supplier->id],
            ['code' => 'MINUTE-500', 'name' => 'Minute Maid 500ml', 'price' => 80, 'cost' => 55, 'stock' => 350, 'cat' => $cat2->id, 'sup' => $supplier->id],
            ['code' => 'DELMONTE-1L', 'name' => 'Del Monte Mango 1L', 'price' => 160, 'cost' => 110, 'stock' => 180, 'cat' => $cat2->id, 'sup' => $supplier->id],
            ['code' => 'DELMONTE-500', 'name' => 'Del Monte Orange 500ml', 'price' => 85, 'cost' => 58, 'stock' => 250, 'cat' => $cat2->id, 'sup' => $supplier->id],
            ['code' => 'PICK-1L', 'name' => 'Pick N Peel Orange 1L', 'price' => 130, 'cost' => 85, 'stock' => 200, 'cat' => $cat2->id, 'sup' => $supplier->id],
            ['code' => 'TROPICAL-1L', 'name' => 'Tropical Heat Passion 1L', 'price' => 140, 'cost' => 90, 'stock' => 150, 'cat' => $cat2->id, 'sup' => $supplier->id],
            // Water
            ['code' => 'DASANI-500', 'name' => 'Dasani Water 500ml', 'price' => 30, 'cost' => 15, 'stock' => 800, 'cat' => $cat3->id, 'sup' => $supplier->id],
            ['code' => 'DASANI-1L', 'name' => 'Dasani Water 1L', 'price' => 50, 'cost' => 25, 'stock' => 600, 'cat' => $cat3->id, 'sup' => $supplier->id],
            ['code' => 'KERINGET-500', 'name' => 'Keringet Water 500ml', 'price' => 30, 'cost' => 15, 'stock' => 700, 'cat' => $cat3->id, 'sup' => $supplier->id],
            ['code' => 'KERINGET-1L', 'name' => 'Keringet Water 1L', 'price' => 50, 'cost' => 25, 'stock' => 500, 'cat' => $cat3->id, 'sup' => $supplier->id],
            ['code' => 'AQUAMIST-500', 'name' => 'Aquamist Water 500ml', 'price' => 35, 'cost' => 18, 'stock' => 600, 'cat' => $cat3->id, 'sup' => $supplier->id],
            ['code' => 'HIGHLAND-5L', 'name' => 'Highland Water 5L', 'price' => 120, 'cost' => 65, 'stock' => 200, 'cat' => $cat3->id, 'sup' => $supplier->id],
            // Beers
            ['code' => 'TUSKER-500', 'name' => 'Tusker Lager 500ml', 'price' => 200, 'cost' => 140, 'stock' => 300, 'cat' => $category->id, 'sup' => $supplier2->id],
            ['code' => 'WHITE-500', 'name' => 'White Cap 500ml', 'price' => 200, 'cost' => 140, 'stock' => 250, 'cat' => $category->id, 'sup' => $supplier2->id],
            ['code' => 'TUSKER-LITE', 'name' => 'Tusker Lite 330ml', 'price' => 180, 'cost' => 125, 'stock' => 280, 'cat' => $category->id, 'sup' => $supplier2->id],
            ['code' => 'TUSKER-MALT', 'name' => 'Tusker Malt 500ml', 'price' => 250, 'cost' => 170, 'stock' => 220, 'cat' => $category->id, 'sup' => $supplier2->id],
            ['code' => 'GUINESS-500', 'name' => 'Guinness 500ml', 'price' => 250, 'cost' => 175, 'stock' => 180, 'cat' => $category->id, 'sup' => $supplier2->id],
            ['code' => 'BALOZI-500', 'name' => 'Balozi Lager 500ml', 'price' => 180, 'cost' => 120, 'stock' => 300, 'cat' => $category->id, 'sup' => $supplier2->id],
            ['code' => 'PILSNER-500', 'name' => 'Pilsner Lager 500ml', 'price' => 190, 'cost' => 130, 'stock' => 260, 'cat' => $category->id, 'sup' => $supplier2->id],
            // Snacks & Cooking
            ['code' => 'EAZI-1L', 'name' => 'Eazi Cooking Oil 1L', 'price' => 350, 'cost' => 250, 'stock' => 150, 'cat' => $cat4->id, 'sup' => $supplier3->id],
            ['code' => 'EAZI-2L', 'name' => 'Eazi Cooking Oil 2L', 'price' => 650, 'cost' => 450, 'stock' => 100, 'cat' => $cat4->id, 'sup' => $supplier3->id],
            ['code' => 'EAZI-5L', 'name' => 'Eazi Cooking Oil 5L', 'price' => 1400, 'cost' => 950, 'stock' => 80, 'cat' => $cat4->id, 'sup' => $supplier3->id],
            ['code' => 'COWBOY-50', 'name' => 'Cowboy Gum 50pcs', 'price' => 100, 'cost' => 60, 'stock' => 500, 'cat' => $cat4->id, 'sup' => $supplier3->id],
            ['code' => 'CHIPSY-100', 'name' => 'Chipsy Crisps 100g', 'price' => 80, 'cost' => 50, 'stock' => 400, 'cat' => $cat4->id, 'sup' => $supplier3->id],
            ['code' => 'TROPICAL-S', 'name' => 'Tropical Heat Crisps 50g', 'price' => 50, 'cost' => 30, 'stock' => 600, 'cat' => $cat4->id, 'sup' => $supplier3->id],
            ['code' => 'BISCUIT-M', 'name' => 'Marie Biscuits 200g', 'price' => 60, 'cost' => 35, 'stock' => 450, 'cat' => $cat4->id, 'sup' => $supplier3->id],
            ['code' => 'BREAD-WH', 'name' => 'White Bread 400g', 'price' => 60, 'cost' => 40, 'stock' => 200, 'cat' => $cat4->id, 'sup' => $supplier3->id],
            ['code' => 'SUGAR-1KG', 'name' => 'Sugar 1kg', 'price' => 180, 'cost' => 130, 'stock' => 300, 'cat' => $cat4->id, 'sup' => $supplier3->id],
            ['code' => 'FLOUR-2KG', 'name' => 'Wheat Flour 2kg', 'price' => 200, 'cost' => 140, 'stock' => 250, 'cat' => $cat4->id, 'sup' => $supplier3->id],
            ['code' => 'RICE-1KG', 'name' => 'Pishori Rice 1kg', 'price' => 220, 'cost' => 155, 'stock' => 280, 'cat' => $cat4->id, 'sup' => $supplier3->id],
            ['code' => 'SALT-500', 'name' => 'Table Salt 500g', 'price' => 30, 'cost' => 15, 'stock' => 500, 'cat' => $cat4->id, 'sup' => $supplier3->id],
            ['code' => 'MILK-500', 'name' => 'Fresh Milk 500ml', 'price' => 65, 'cost' => 45, 'stock' => 300, 'cat' => $cat2->id, 'sup' => $supplier3->id],
            ['code' => 'YOGURT-500', 'name' => 'Vanilla Yogurt 500ml', 'price' => 120, 'cost' => 80, 'stock' => 200, 'cat' => $cat2->id, 'sup' => $supplier3->id],
            ['code' => 'TEA-100', 'name' => 'Kenya Tea Bags 100s', 'price' => 250, 'cost' => 170, 'stock' => 300, 'cat' => $cat4->id, 'sup' => $supplier3->id],
        ];
        $n = 3;
        foreach ($prods as $p) {
            $prod = $this->foc(Product::class, ['product_code' => $p['code'], 'company_id' => $cid], [
                'store_id' => $sid, 'product_number' => 'PROD-' . str_pad($n++, 4, '0', STR_PAD_LEFT),
                'name' => $p['name'], 'description' => $p['name'], 'price' => $p['price'], 'unit_cost' => $p['cost'],
                'stock_quantity' => $p['stock'], 'category_id' => $p['cat'], 'supplier_id' => $p['sup'],
                'unit_of_measurement' => 'piece',
            ]);
            $productIds[] = $prod->id;
        }
        $productIds = array_values(array_unique($productIds));

        // ═══════════════════════════════════════════
        // CUSTOMERS
        // ═══════════════════════════════════════════
        $this->command->info('Creating customers...');
        $customerIds = $existingCustomer ? [$existingCustomer->id] : [];
        foreach ([
            ['Quickmart Supermarket', 'orders@quickmart.co.ke', '+254711000001', 'Ngong Road, Nairobi'],
            ['Naivas Supermarket', 'procurement@naivas.co.ke', '+254711000002', 'Moi Avenue, Nairobi'],
            ['Carrefour Kenya', 'supply@carrefour.co.ke', '+254711000003', 'Two Rivers Mall, Nairobi'],
            ['Chandarana Foodplus', 'orders@chandarana.co.ke', '+254711000004', 'Yaya Centre, Nairobi'],
            ['Tumaini Supermarket', 'info@tumaini.co.ke', '+254711000005', 'Jogoo Road, Nairobi'],
            ['Mama Njeri Kiosk', 'mama.njeri@gmail.com', '+254711000006', 'Kawangware, Nairobi'],
            ['Eastleigh Wholesalers', 'info@eastleighwhole.co.ke', '+254711000007', '1st Avenue, Eastleigh'],
            ['Mombasa Beverages Ltd', 'orders@msabeverages.co.ke', '+254711000008', 'Digo Road, Mombasa'],
            ['Nakuru Distributors', 'info@nakdist.co.ke', '+254711000009', 'Kenyatta Avenue, Nakuru'],
            ['Kisumu Fresh Mart', 'info@kisumufresh.co.ke', '+254711000010', 'Oginga Odinga St, Kisumu'],
            ['Eldoret Supplies', 'orders@eldoretsupplies.co.ke', '+254711000011', 'Uganda Road, Eldoret'],
            ['Thika Wholesalers', 'info@thikawhole.co.ke', '+254711000012', 'Kenyatta Hwy, Thika'],
            ['Malindi Beach Shop', 'orders@malindibeach.co.ke', '+254711000013', 'Lamu Road, Malindi'],
            ['Nyeri Mini Market', 'info@nyerimini.co.ke', '+254711000014', 'Kimathi Way, Nyeri'],
            ['Machakos Traders', 'orders@machakostraders.co.ke', '+254711000015', 'Syokimau Rd, Machakos'],
            ['Kitale General Store', 'info@kitalegen.co.ke', '+254711000016', 'Kenyatta St, Kitale'],
            ['Nanyuki Provisions', 'orders@nanyukiprov.co.ke', '+254711000017', 'Kenyatta Rd, Nanyuki'],
            ['Garissa Supplies Ltd', 'info@garissasup.co.ke', '+254711000018', 'Hospital Rd, Garissa'],
            ['Lamu Island Store', 'orders@lamuisland.co.ke', '+254711000019', 'Waterfront, Lamu'],
            ['Embu Wholesale Hub', 'info@embuwhole.co.ke', '+254711000020', 'Kenyatta Hwy, Embu'],
            ['Meru Distributors', 'orders@merudist.co.ke', '+254711000021', 'Tom Mboya St, Meru'],
            ['Kajiado Fresh Foods', 'info@kajiadofresh.co.ke', '+254711000022', 'Namanga Rd, Kajiado'],
            ['Naivasha Lake Store', 'orders@naivashalake.co.ke', '+254711000023', 'Moi Ave, Naivasha'],
            ['Kericho Tea Mart', 'info@kerichoteamart.co.ke', '+254711000024', 'Moi Hwy, Kericho'],
            ['Bungoma Supplies', 'orders@bungomasup.co.ke', '+254711000025', 'Mumias Rd, Bungoma'],
            ['Migori Town Store', 'info@migoritown.co.ke', '+254711000026', 'Kisii Rd, Migori'],
            ['Voi Junction Market', 'orders@voijunction.co.ke', '+254711000027', 'Mombasa Hwy, Voi'],
            ['Isiolo Frontier Shop', 'info@isiolofrontier.co.ke', '+254711000028', 'Main St, Isiolo'],
            ['Kakamega Mart', 'orders@kakamegamart.co.ke', '+254711000029', 'Mumias Rd, Kakamega'],
            ['Kiambu Fresh Stores', 'info@kiambufresh.co.ke', '+254711000030', 'Thika Rd, Kiambu'],
            ['Ruiru Quick Shop', 'orders@ruiruquick.co.ke', '+254711000031', 'Thika Superhwy, Ruiru'],
            ['Limuru Green Market', 'info@limurugreen.co.ke', '+254711000032', 'Limuru Rd, Limuru'],
            ['Athi River Store', 'orders@athiriver.co.ke', '+254711000033', 'Mombasa Rd, Athi River'],
            ['Syokimau Mart', 'info@syokimaumart.co.ke', '+254711000034', 'Mombasa Rd, Syokimau'],
            ['Karen Corner Shop', 'orders@karencorner.co.ke', '+254711000035', 'Karen Rd, Karen'],
            ['Westlands Grocers', 'info@westlandsgroc.co.ke', '+254711000036', 'Waiyaki Way, Westlands'],
            ['Lavington Fine Foods', 'orders@lavfinefood.co.ke', '+254711000037', 'James Gichuru Rd, Lavington'],
            ['Kilimani Corner Store', 'info@kilimanistore.co.ke', '+254711000038', 'Argwings Kodhek, Kilimani'],
            ['South B Mini Mart', 'orders@southbmini.co.ke', '+254711000039', 'Mombasa Rd, South B'],
            ['South C Provisions', 'info@southcprov.co.ke', '+254711000040', 'Muhoho Ave, South C'],
            ['Langata Stores', 'orders@langatastores.co.ke', '+254711000041', 'Langata Rd, Langata'],
            ['Embakasi Wholesale', 'info@embakasiwhole.co.ke', '+254711000042', 'Airport Rd, Embakasi'],
            ['Donholm Mart', 'orders@donholmmart.co.ke', '+254711000043', 'Outering Rd, Donholm'],
            ['Pipeline Market', 'info@pipelinemarket.co.ke', '+254711000044', 'Pipeline Rd, Embakasi'],
        ] as [$name, $email, $phone, $address]) {
            $c = $this->foc(Customer::class, ['email' => $email, 'company_id' => $cid], ['name' => $name, 'phone' => $phone, 'address' => $address, 'status' => 'active', 'customer_type' => 'business']);
            $customerIds[] = $c->id;
        }
        $customerIds = array_values(array_unique($customerIds));

        // Delivery Locations
        $dlIds = [];
        foreach (array_slice($customerIds, 0, 15) as $custId) {
            $dl = $this->foc(DeliveryLocation::class, ['customer_id' => $custId, 'company_id' => $cid],
                ['house_number' => (string)rand(1, 200), 'city' => 'Nairobi', 'country' => 'Kenya', 'street' => 'Street ' . rand(1, 50), 'estate' => 'Estate ' . rand(1, 20)]);
            $dlIds[$custId] = $dl->id;
        }

        // ═══════════════════════════════════════════
        // ORDERS + ITEMS
        // ═══════════════════════════════════════════
        $this->command->info('Creating orders...');
        $allSts = ['pending','confirmed','processing','delivered','cancelled'];
        $allPay = ['unpaid','partial','paid'];
        for ($i = 0; $i < 50; $i++) {
            $sts = $allSts; $pay = $allPay;
            // 60% delivered+paid, 15% delivered+partial, 10% pending, 10% confirmed, 5% cancelled
            $r = rand(1, 100);
            if ($r <= 60) { $st = 'delivered'; $ps = 'paid'; }
            elseif ($r <= 75) { $st = 'delivered'; $ps = 'partial'; }
            elseif ($r <= 85) { $st = 'pending'; $ps = 'unpaid'; }
            elseif ($r <= 95) { $st = 'confirmed'; $ps = 'unpaid'; }
            else { $st = 'cancelled'; $ps = 'unpaid'; }
            $custId = $customerIds[array_rand($customerIds)];
            $total = 0; $items = [];
            for ($j = 0; $j < rand(2, 4); $j++) {
                $pid = $productIds[array_rand($productIds)];
                $pr = Product::find($pid);
                $q = rand(5, 50); $up = $pr->price ?? 50; $lt = $q * $up; $total += $lt;
                $items[] = ['product_id' => $pid, 'quantity' => $q, 'unit_price' => $up, 'total_price' => $lt, 'tax_amount' => 0];
            }
            $ap = $ps === 'paid' ? $total : ($ps === 'partial' ? $total * 0.5 : 0);
            $od = $now->copy()->subDays(rand(1, 90));
            $order = Order::create(['id' => Str::uuid()->toString(),
                'order_number' => 'ORD-' . str_pad($i + 1, 5, '0', STR_PAD_LEFT), 'customer_id' => $custId, 'company_id' => $cid,
                'total_amount' => $total, 'discount' => 0, 'tax' => $total * 0.16, 'final_amount' => $total * 1.16,
                'status' => $st, 'payment_status' => $ps, 'amount_paid' => $ap, 'currency' => 'KES',
                'delivery_location_id' => $dlIds[$custId] ?? null, 'order_date' => $od, 'created_at' => $od, 'updated_at' => $now,
            ]);
            foreach ($items as $it) { OrderItem::create(array_merge(['id' => Str::uuid()->toString()], $it, ['order_id' => $order->id])); }
        }

        // ═══════════════════════════════════════════
        // INVOICES + LINE ITEMS
        // ═══════════════════════════════════════════
        $this->command->info('Creating invoices...');
        $invN = 1;
        foreach (Order::where('company_id', $cid)->where('status', 'delivered')->get() as $order) {
            $inv = Invoice::create(['id' => Str::uuid()->toString(),
                'invoice_number' => 'INV-' . str_pad($invN++, 5, '0', STR_PAD_LEFT), 'company_id' => $cid,
                'customer_id' => $order->customer_id, 'order_id' => $order->id, 'type' => 'standard',
                'status' => $order->payment_status === 'paid' ? 'paid' : 'sent',
                'invoice_date' => $order->created_at, 'due_date' => Carbon::parse($order->created_at)->addDays(30),
                'subtotal' => $order->total_amount, 'tax_amount' => $order->tax, 'discount_amount' => 0,
                'total_amount' => $order->final_amount, 'amount_paid' => $order->amount_paid,
                'balance_amount' => $order->final_amount - $order->amount_paid, 'currency' => 'KES',
                'payment_terms' => 'Net 30', 'created_by' => $aid,
            ]);
            foreach (OrderItem::where('order_id', $order->id)->get() as $oi) {
                $pr = Product::find($oi->product_id);
                InvoiceLineItem::create(['id' => Str::uuid()->toString(),
                    'invoice_id' => $inv->id, 'product_id' => $oi->product_id, 'description' => $pr->name ?? 'Product',
                    'quantity' => $oi->quantity, 'unit' => 'pcs', 'unit_price' => $oi->unit_price,
                    'discount_amount' => 0, 'tax_amount' => $oi->total_price * 0.16, 'line_total' => $oi->total_price * 1.16,
                ]);
            }
        }

        // ═══════════════════════════════════════════
        // PAYMENTS
        // ═══════════════════════════════════════════
        $this->command->info('Creating payments...');
        $pN = 1;
        foreach (Order::where('company_id', $cid)->where('payment_status', 'paid')->get() as $order) {
            $inv = Invoice::where('order_id', $order->id)->first();
            Payment::create(['id' => Str::uuid()->toString(),
                'company_id' => $cid, 'order_id' => $order->id, 'invoice_id' => $inv->id ?? null,
                'customer_id' => $order->customer_id, 'transaction_id' => 'TXN-' . str_pad($pN++, 5, '0', STR_PAD_LEFT),
                'payment_method' => ['mpesa', 'bank_transfer', 'cash'][rand(0, 2)], 'amount_paid' => $order->amount_paid,
                'status' => 'completed', 'payment_date' => Carbon::parse($order->created_at)->addDays(rand(1, 14)),
            ]);
        }

        // ═══════════════════════════════════════════
        // EXPENSES
        // ═══════════════════════════════════════════
        $this->command->info('Creating expenses...');
        $allExpCats = [$expenseCategory->id, $expCat2->id, $expCat3->id];
        $vendors = ['Kenya Power', 'Shell Petrol', 'Safaricom', 'Office Mart', 'City Council', 'DHL Kenya', 'Uber Freight', 'Jumia Business', 'Twiga Foods', 'KCB Bank', 'Equity Bank', 'Total Energies', 'Rubis Petrol', 'Nairobi Water', 'Zuku Internet'];
        $descs = ['Electricity bill', 'Fuel for delivery', 'Internet and airtime', 'Office supplies', 'Business permits', 'Courier services', 'Freight transport', 'Equipment purchase', 'Supplies', 'Bank charges', 'Service fees', 'Vehicle fuel', 'Generator fuel', 'Water bill', 'Fiber internet'];
        for ($i = 0; $i < 45; $i++) {
            Expense::create(['id' => Str::uuid()->toString(),
                'company_id' => $cid, 'store_id' => $sid, 'category_id' => $allExpCats[array_rand($allExpCats)],
                'vendor_name' => $vendors[$i % count($vendors)], 'description' => $descs[$i % count($descs)],
                'amount' => rand(1500, 35000), 'expense_date' => $now->copy()->subDays(rand(1, 90)),
                'payment_method' => ['cash', 'bank_transfer', 'card'][rand(0, 2)],
                'status' => $i % 5 === 0 ? 'pending' : 'approved', 'created_by' => $aid,
            ]);
        }

        // ═══════════════════════════════════════════
        // EMPLOYEES
        // ═══════════════════════════════════════════
        $this->command->info('Creating employees...');
        $eN = 1;
        foreach ([
            ['Samuel', 'Kipchoge', 'Sales', 'Sales Rep', 45000, 'male'],
            ['Mercy', 'Chebet', 'Sales', 'Sales Rep', 45000, 'female'],
            ['David', 'Otieno', 'Warehouse', 'Warehouse Supervisor', 55000, 'male'],
            ['Ann', 'Wambui', 'Finance', 'Accountant', 65000, 'female'],
            ['Kevin', 'Njoroge', 'Warehouse', 'Stock Clerk', 30000, 'male'],
            ['Diana', 'Adhiambo', 'HR', 'HR Officer', 55000, 'female'],
            ['Joseph', 'Maina', 'Logistics', 'Driver', 35000, 'male'],
            ['Esther', 'Nyambura', 'Logistics', 'Driver', 35000, 'female'],
            ['Patrick', 'Were', 'IT', 'IT Support', 50000, 'male'],
            ['Caroline', 'Mwende', 'Sales', 'Sales Manager', 80000, 'female'],
            ['Michael', 'Karanja', 'Sales', 'Sales Rep', 42000, 'male'],
            ['Janet', 'Korir', 'Finance', 'Finance Clerk', 38000, 'female'],
            ['Stephen', 'Mutua', 'Warehouse', 'Stock Clerk', 30000, 'male'],
            ['Ruth', 'Jebet', 'Sales', 'Sales Rep', 42000, 'female'],
            ['Simon', 'Ndirangu', 'Logistics', 'Driver', 35000, 'male'],
            ['Alice', 'Jepkosgei', 'HR', 'HR Assistant', 35000, 'female'],
            ['Charles', 'Kimani', 'Warehouse', 'Warehouse Assistant', 28000, 'male'],
            ['Mary', 'Moraa', 'Finance', 'Accounts Clerk', 36000, 'female'],
            ['Robert', 'Omondi', 'IT', 'Systems Admin', 60000, 'male'],
            ['Winnie', 'Gathoni', 'Sales', 'Sales Rep', 42000, 'female'],
            ['Daniel', 'Kiprotich', 'Logistics', 'Fleet Manager', 65000, 'male'],
            ['Lilian', 'Nafula', 'Finance', 'Senior Accountant', 75000, 'female'],
            ['George', 'Wafula', 'Warehouse', 'Warehouse Manager', 70000, 'male'],
            ['Susan', 'Chepngetich', 'HR', 'Payroll Officer', 48000, 'female'],
            ['James', 'Kibet', 'Sales', 'Regional Sales Lead', 85000, 'male'],
            ['Nancy', 'Kemunto', 'Logistics', 'Dispatch Coordinator', 40000, 'female'],
            ['Philip', 'Mwangangi', 'IT', 'Network Engineer', 55000, 'male'],
            ['Agnes', 'Rotich', 'Finance', 'Tax Clerk', 38000, 'female'],
            ['Victor', 'Simiyu', 'Warehouse', 'Stock Clerk', 30000, 'male'],
            ['Beatrice', 'Chelagat', 'Sales', 'Sales Rep', 42000, 'female'],
            ['Thomas', 'Nyongesa', 'Logistics', 'Driver', 35000, 'male'],
            ['Florence', 'Mukami', 'HR', 'Training Officer', 50000, 'female'],
            ['Andrew', 'Kiplagat', 'Sales', 'Key Account Manager', 90000, 'male'],
            ['Christine', 'Auma', 'Finance', 'Budget Analyst', 55000, 'female'],
            ['Peter', 'Githinji', 'Warehouse', 'Inventory Analyst', 45000, 'male'],
            ['Jane', 'Chemutai', 'IT', 'Help Desk', 38000, 'female'],
            ['Dennis', 'Barasa', 'Logistics', 'Driver', 35000, 'male'],
            ['Catherine', 'Njoki', 'Sales', 'Sales Coordinator', 45000, 'female'],
            ['Vincent', 'Langat', 'Warehouse', 'Receiving Clerk', 30000, 'male'],
            ['Margaret', 'Boit', 'Finance', 'Cashier', 32000, 'female'],
            ['Sammy', 'Okello', 'Logistics', 'Driver', 35000, 'male'],
            ['Priscilla', 'Kemboi', 'HR', 'Recruitment Officer', 48000, 'female'],
            ['Kenneth', 'Wanyama', 'IT', 'Database Admin', 58000, 'male'],
            ['Rebecca', 'Cheroben', 'Sales', 'Sales Rep', 42000, 'female'],
            ['Henry', 'Kiptoo', 'Warehouse', 'Forklift Operator', 33000, 'male'],
        ] as [$fn, $ln, $dept, $pos, $sal, $gen]) {
            $this->foc(Employee::class, ['email' => strtolower($fn) . '.' . strtolower($ln) . '@cherrydist.com', 'company_id' => $cid], [
                'employee_number' => 'EMP-' . str_pad($eN++, 4, '0', STR_PAD_LEFT),
                'first_name' => $fn, 'last_name' => $ln, 'phone' => '+2547' . rand(10000000, 99999999),
                'date_of_birth' => Carbon::now()->subYears(rand(25, 45)), 'gender' => $gen,
                'national_id' => (string)rand(20000000, 39999999), 'hire_date' => Carbon::now()->subMonths(rand(3, 36)),
                'employment_type' => 'full_time', 'payment_frequency' => 'monthly', 'basic_salary' => $sal,
                'department' => $dept, 'position' => $pos, 'created_by' => $aid,
            ]);
        }

        // ═══════════════════════════════════════════
        // PURCHASE ORDERS + ITEMS
        // ═══════════════════════════════════════════
        $this->command->info('Creating purchase orders...');
        $allSup = [$supplier->id, $supplier2->id, $supplier3->id];
        for ($i = 1; $i <= 15; $i++) {
            $supId = $allSup[($i - 1) % 3]; $total = 0; $poItems = [];
            for ($j = 0; $j < rand(2, 4); $j++) {
                $pid = $productIds[array_rand($productIds)]; $pr = Product::find($pid);
                $q = rand(50, 200); $up = $pr->unit_cost ?? 35; $lt = $q * $up; $total += $lt;
                $poItems[] = ['product_id' => $pid, 'quantity' => $q, 'unit_price' => $up, 'subtotal' => $lt, 'discount' => 0, 'tax_amount' => 0, 'received_quantity' => $i <= 3 ? $q : 0];
            }
            $po = PurchaseOrder::create(['id' => Str::uuid()->toString(),
                'company_id' => $cid, 'order_number' => 'PO-' . str_pad($i, 5, '0', STR_PAD_LEFT),
                'supplier_id' => $supId, 'store_id' => $sid, 'currency_code' => 'KES',
                'order_date' => $now->copy()->subDays(rand(5, 40)), 'delivery_date' => $now->copy()->addDays(rand(1, 14)),
                'status' => $i <= 8 ? 'received' : ($i <= 11 ? 'approved' : 'pending'),
                'approval_status' => $i <= 11 ? 'approved' : 'pending',
                'total_amount' => $total, 'amount_paid' => $i <= 8 ? $total : 0,
                'payment_status' => $i <= 8 ? 'paid' : 'unpaid', 'created_by' => $aid,
            ]);
            foreach ($poItems as $it) { PurchaseOrderItem::create(array_merge(['id' => Str::uuid()->toString()], $it, ['purchase_order_id' => $po->id])); }
        }

        // ═══════════════════════════════════════════
        // ACCOUNTING
        // ═══════════════════════════════════════════
        $this->command->info('Creating chart of accounts...');
        foreach ([
            ['1000', 'Cash', 'asset', 'current_asset', 'debit'],
            ['1010', 'Bank Account - KCB', 'asset', 'current_asset', 'debit'],
            ['1200', 'Accounts Receivable', 'asset', 'current_asset', 'debit'],
            ['1300', 'Inventory', 'asset', 'current_asset', 'debit'],
            ['1500', 'Fixed Assets', 'asset', 'fixed_asset', 'debit'],
            ['2000', 'Accounts Payable', 'liability', 'current_liability', 'credit'],
            ['2100', 'VAT Payable', 'liability', 'current_liability', 'credit'],
            ['2200', 'PAYE Payable', 'liability', 'current_liability', 'credit'],
            ['3000', 'Owner Equity', 'equity', 'owner_equity', 'credit'],
            ['3100', 'Retained Earnings', 'equity', 'retained_earnings', 'credit'],
            ['4000', 'Sales Revenue', 'income', 'operating_income', 'credit'],
            ['4100', 'Service Revenue', 'income', 'operating_income', 'credit'],
            ['5000', 'Cost of Goods Sold', 'expense', 'cost_of_goods_sold', 'debit'],
            ['5100', 'Salaries & Wages', 'expense', 'operating_expense', 'debit'],
            ['5200', 'Rent Expense', 'expense', 'operating_expense', 'debit'],
            ['5300', 'Utilities Expense', 'expense', 'operating_expense', 'debit'],
            ['5400', 'Transport Expense', 'expense', 'operating_expense', 'debit'],
        ] as [$code, $name, $type, $sub, $bal]) {
            $this->foc(ChartOfAccount::class, ['account_code' => $code, 'company_id' => $cid],
                ['account_name' => $name, 'account_type' => $type, 'account_subtype' => $sub, 'normal_balance' => $bal, 'opening_balance' => 0, 'level' => 1]);
        }

        $this->command->info('Creating tax rates...');
        $this->foc(TaxRate::class, ['code' => 'VAT-16', 'company_id' => $cid], ['name' => 'Standard VAT', 'rate' => 0.16, 'type' => 'vat', 'calculation_method' => 'percentage', 'effective_from' => '2024-01-01']);
        $this->foc(TaxRate::class, ['code' => 'VAT-0', 'company_id' => $cid], ['name' => 'Zero Rated', 'rate' => 0, 'type' => 'vat', 'calculation_method' => 'percentage', 'effective_from' => '2024-01-01']);
        $this->foc(TaxRate::class, ['code' => 'VAT-EX', 'company_id' => $cid], ['name' => 'Exempt', 'rate' => 0, 'type' => 'other', 'calculation_method' => 'percentage', 'effective_from' => '2024-01-01']);

        // ═══════════════════════════════════════════
        // MISC
        // ═══════════════════════════════════════════
        $this->command->info('Creating delivery persons, quotes, assets, banks...');

        $this->foc(DeliveryPerson::class, ['full_name' => 'Joseph Maina', 'company_id' => $cid], ['phone_number' => '+254712300001']);
        $this->foc(DeliveryPerson::class, ['full_name' => 'Esther Nyambura', 'company_id' => $cid], ['phone_number' => '+254712300002']);
        $this->foc(DeliveryPerson::class, ['full_name' => 'Tom Odhiambo', 'company_id' => $cid], ['phone_number' => '+254712300003']);

        // Quotes
        $qStatuses = ['draft', 'sent', 'accepted', 'rejected', 'expired', 'draft', 'sent', 'accepted', 'sent', 'draft'];
        foreach ($qStatuses as $qi => $qStatus) {
            $custId = $customerIds[array_rand($customerIds)]; $total = 0; $qItems = [];
            for ($j = 0; $j < rand(2, 3); $j++) {
                $pid = $productIds[array_rand($productIds)]; $pr = Product::find($pid);
                $q = rand(10, 30); $up = $pr->price ?? 50; $lt = $q * $up; $total += $lt;
                $qItems[] = ['product_id' => $pid, 'quantity' => $q, 'unit_price' => $up, 'total_price' => $lt];
            }
            $quote = Quote::create(['id' => Str::uuid()->toString(),
                'quote_number' => 'QT-' . str_pad($qi + 1, 5, '0', STR_PAD_LEFT), 'customer_id' => $custId, 'company_id' => $cid,
                'total_amount' => $total, 'discount' => 0, 'final_amount' => $total, 'status' => $qStatus,
                'currency' => 'KES', 'valid_until' => $now->copy()->addDays(30), 'delivery_location_id' => $dlIds[$custId] ?? null,
            ]);
            foreach ($qItems as $it) { QuoteItem::create(array_merge(['id' => Str::uuid()->toString()], $it, ['quote_id' => $quote->id])); }
        }

        // Fixed Assets
        foreach ([
            ['FA-001', 'Delivery Truck - Isuzu NKR', 'vehicle', 3500000, 8],
            ['FA-002', 'Delivery Van - Toyota Hiace', 'vehicle', 2800000, 8],
            ['FA-003', 'Cold Room Unit', 'equipment', 1200000, 10],
            ['FA-004', 'Office Computers (5 units)', 'computer', 250000, 4],
            ['FA-005', 'Forklift', 'equipment', 1800000, 10],
        ] as [$code, $name, $cat, $cost, $life]) {
            $this->foc(FixedAsset::class, ['asset_number' => $code, 'company_id' => $cid], [
                'asset_name' => $name, 'asset_category' => $cat, 'purchase_date' => $now->copy()->subMonths(rand(6, 24)),
                'purchase_cost' => $cost, 'useful_life_years' => $life, 'residual_value' => $cost * 0.1,
                'depreciation_method' => 'straight_line', 'book_value' => $cost * 0.9, 'status' => 'active', 'created_by' => $aid,
            ]);
        }

        // Bank Accounts
        $this->foc(BankAccount::class, ['account_number' => '1234567890', 'company_id' => $cid], ['bank_name' => 'KCB Bank', 'account_name' => 'Cherry Distributors Ltd', 'branch_name' => 'Nairobi CBD', 'account_type' => 'checking', 'currency_code' => 'KES', 'current_balance' => 1250000, 'available_balance' => 1250000]);
        $this->foc(BankAccount::class, ['account_number' => '0987654321', 'company_id' => $cid], ['bank_name' => 'Equity Bank', 'account_name' => 'Cherry Distributors Ltd', 'branch_name' => 'Industrial Area', 'account_type' => 'checking', 'currency_code' => 'KES', 'current_balance' => 380000, 'available_balance' => 380000]);

        // Activity Logs
        foreach (['Created order ORD-00001', 'Updated product price', 'Viewed customer', 'Created invoice', 'Updated order status', 'Added employee', 'Approved PO', 'Generated report', 'Created expense', 'Updated stock'] as $i => $desc) {
            ActivityLog::create(['id' => Str::uuid()->toString(),'company_id' => $cid, 'user_id' => $userIds[array_rand($userIds)], 'action' => ['create','update','view'][$i%3], 'description' => $desc, 'created_at' => $now->copy()->subHours(rand(1, 200))]);
        }

        // ═══════════════════════════════════════════
        // SUMMARY
        // ═══════════════════════════════════════════
        $this->command->newLine();
        $this->command->info('Seeding completed!');
        $total = 0;
        foreach (['users','roles','permissions','role_permissions','stores','suppliers','product_categories','products','customers','delivery_locations','orders','order_items','invoices','invoice_line_items','payments','expenses','expense_categories','employees','purchase_orders','purchase_order_items','quotes','quote_items','chart_of_accounts','tax_rates','delivery_persons','fixed_assets','bank_accounts','activity_logs'] as $t) {
            $c = \DB::table($t)->count(); $total += $c;
            $this->command->info("  {$t}: {$c}");
        }
        $this->command->info("  TOTAL: {$total} records");
    }
}
