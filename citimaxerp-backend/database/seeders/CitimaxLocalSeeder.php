<?php

namespace Database\Seeders;

use App\Models\Company;
use App\Models\CompanyEtimsConfig;
use App\Models\Customer;
use App\Models\ExpenseCategory;
use App\Models\Invoice;
use App\Models\InvoiceLineItem;
use App\Models\Permission;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\Role;
use App\Models\Store;
use App\Models\Supplier;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Deterministic demo data for a local Citimax ERP installation.
 *
 * This seeder is deliberately idempotent and refuses to run unless the
 * application is using a local PostgreSQL connection. It never runs as part
 * of a production/staging deployment.
 */
class CitimaxLocalSeeder extends Seeder
{
    private const ADMIN_EMAIL = 'admin@citimax.local';
    private const ADMIN_PASSWORD = 'CitimaxLocal!2026';

    public function run(): void
    {
        $this->assertLocalDatabase();

        // Ensure a fresh local database has the permission catalogue before
        // assigning the full local-admin role.
        $this->call(SystemPermissionsSeeder::class);

        DB::transaction(function (): void {
            $company = Company::updateOrCreate(
                ['email' => 'demo@citimax.local'],
                [
                    'name' => 'Citimax ERP Demo Ltd',
                    'description' => 'Local demo company for Citimax ERP testing',
                    'phone' => '+254700000000',
                    'address' => 'Westlands Business Centre',
                    'city' => 'Nairobi',
                    'country' => 'Kenya',
                    'primary_country_code' => 'KE',
                    'is_active' => true,
                ]
            );

            $role = Role::updateOrCreate(
                ['name' => 'Citimax Local Admin'],
                [
                    'company_id' => $company->id,
                    'description' => 'Full-access administrator for the local Citimax demo tenant',
                    'is_active' => true,
                ]
            );

            // Suppress User::created role auto-provisioning; this seeder owns
            // the explicit local-admin role assignment below.
            $admin = User::withoutEvents(function () use ($company, $role): User {
                return User::updateOrCreate(
                    ['email' => self::ADMIN_EMAIL],
                    [
                        'company_id' => $company->id,
                        'role_id' => $role->id,
                        'first_name' => 'Citimax',
                        'last_name' => 'Administrator',
                        'password' => Hash::make(self::ADMIN_PASSWORD),
                        'phone' => '+254700000001',
                        'is_active' => DB::raw('true'),
                        'email_verified' => DB::raw('true'),
                    ]
                );
            });

            $admin->forceFill(['company_id' => $company->id, 'role_id' => $role->id])->saveQuietly();
            // The User model casts booleans, while this PostgreSQL schema
            // requires native boolean expressions rather than integer binds.
            DB::table('users')->where('id', $admin->id)->update([
                'is_active' => DB::raw('true'),
                'email_verified' => DB::raw('true'),
            ]);
            $admin->refresh();
            $role->permissions()->sync(Permission::query()->whereRaw('is_active = true')->pluck('id')->all());

            $warehouse = Store::updateOrCreate(
                ['company_id' => $company->id, 'store_code' => 'CIT-CENTRAL'],
                [
                    'name' => 'Citimax Central Warehouse',
                    'description' => 'Primary local demo warehouse',
                    'email' => 'warehouse@citimax.local',
                    'phone' => '+254700000010',
                    'address' => 'Industrial Area',
                    'city' => 'Nairobi',
                    'country' => 'Kenya',
                    'manager_name' => 'Citimax Warehouse',
                    'is_active' => DB::raw('true'),
                ]
            );

            $outlet = Store::updateOrCreate(
                ['company_id' => $company->id, 'store_code' => 'CIT-OUTLET'],
                [
                    'name' => 'Citimax Westlands Outlet',
                    'description' => 'Local demo retail outlet',
                    'email' => 'outlet@citimax.local',
                    'phone' => '+254700000011',
                    'address' => 'Westlands',
                    'city' => 'Nairobi',
                    'country' => 'Kenya',
                    'manager_name' => 'Citimax Outlet',
                    'is_active' => DB::raw('true'),
                ]
            );

            $beverages = ProductCategory::updateOrCreate(
                ['company_id' => $company->id, 'name' => 'Beverages'],
                ['description' => 'Drinks and bottled water', 'color' => '#2563EB', 'is_active' => true]
            );
            $household = ProductCategory::updateOrCreate(
                ['company_id' => $company->id, 'name' => 'Household'],
                ['description' => 'Everyday household products', 'color' => '#059669', 'is_active' => true]
            );

            $supplier = Supplier::updateOrCreate(
                ['company_id' => $company->id, 'name' => 'Nairobi Wholesale Supplies'],
                [
                    'email' => 'orders@nairobi-wholesale.local',
                    'phone' => '+254700000020',
                    'address' => 'Embakasi, Nairobi',
                    'contact_person' => 'Mary Wanjiku',
                    'is_active' => true,
                    'payment_terms_type' => 'net',
                    'payment_terms_days' => 30,
                ]
            );

            $water = Product::updateOrCreate(
                ['company_id' => $company->id, 'sku' => 'CIT-WATER-500'],
                [
                    'store_id' => $warehouse->id,
                    'product_number' => 'CIT-PROD-0001',
                    'product_code' => 'WATER-500',
                    'name' => 'Citimax Drinking Water 500ml',
                    'description' => 'Bottled drinking water for demo sales',
                    'price' => 50.00,
                    'unit_cost' => 30.00,
                    'stock_quantity' => 500,
                    'on_hand' => 500,
                    'low_stock_threshold' => 20,
                    'category' => 'Beverages',
                    'category_id' => $beverages->id,
                    'supplier' => $supplier->name,
                    'supplier_id' => $supplier->id,
                    'unit_of_measurement' => 'bottle',
                    'brand' => 'Citimax',
                    'is_active' => true,
                    'is_featured' => true,
                    'is_taxable' => true,
                    'track_inventory' => true,
                    'base_unit' => 'bottle',
                    // DigiTax accepts the documented generic goods code for
                    // local demos; use a more specific code in production
                    // after selecting it from the complete KRA catalogue.
                    'etims_item_class_code' => '99010000',
                ]
            );

            $soap = Product::updateOrCreate(
                ['company_id' => $company->id, 'sku' => 'CIT-SOAP-250'],
                [
                    'store_id' => $outlet->id,
                    'product_number' => 'CIT-PROD-0002',
                    'product_code' => 'SOAP-250',
                    'name' => 'Citimax Liquid Soap 250ml',
                    'description' => 'Household liquid soap for demo sales',
                    'price' => 180.00,
                    'unit_cost' => 110.00,
                    'stock_quantity' => 120,
                    'on_hand' => 120,
                    'low_stock_threshold' => 10,
                    'category' => 'Household',
                    'category_id' => $household->id,
                    'supplier' => $supplier->name,
                    'supplier_id' => $supplier->id,
                    'unit_of_measurement' => 'piece',
                    'brand' => 'Citimax',
                    'is_active' => true,
                    'is_taxable' => true,
                    'track_inventory' => true,
                    'base_unit' => 'piece',
                    'etims_item_class_code' => '99010000',
                ]
            );

            $customer = Customer::updateOrCreate(
                ['company_id' => $company->id, 'email' => 'accounts@acme-retail.local'],
                [
                    'customer_number' => 'CIT-CUST-0001',
                    'name' => 'Acme Retailers',
                    'business_name' => 'Acme Retailers Ltd',
                    'nature_of_business' => 'Retail trade',
                    'phone' => '+254700000030',
                    'address' => 'Kilimani, Nairobi',
                    'city' => 'Nairobi',
                    'country' => 'Kenya',
                    'status' => 'active',
                    'approval_status' => 'approved',
                    'payment_method' => 'cash',
                    'created_by' => $admin->id,
                ]
            );

            ExpenseCategory::updateOrCreate(
                ['company_id' => $company->id, 'name' => 'Office Operations'],
                ['description' => 'Local office and administration costs', 'color' => '#6B7280', 'is_active' => true]
            );

            $this->upsertTaxRate(
                [
                    'code' => 'CITIMAX_VAT_16',
                    'company_id' => $company->id,
                    'name' => 'Kenya VAT 16%',
                    'description' => 'Standard Kenyan VAT rate for local demo transactions',
                    'rate' => 0.1600,
                    'type' => 'vat',
                    'calculation_method' => 'percentage',
                    'is_active' => true,
                    'is_default' => true,
                    'effective_from' => now()->toDateString(),
                    'jurisdiction' => 'KE',
                    'etims_tax_type_code' => 'A',
                    'applicable_to' => ['products', 'services'],
                    'created_by' => $admin->id,
                    'updated_by' => $admin->id,
                ]
            );

            $this->upsertTaxRate(
                [
                    'code' => 'CITIMAX_ZERO_RATED',
                    'company_id' => $company->id,
                    'name' => 'Zero Rated',
                    'description' => 'Zero-rated local demo products',
                    'rate' => 0.0000,
                    'type' => 'vat',
                    'calculation_method' => 'percentage',
                    'is_active' => true,
                    'is_default' => false,
                    'effective_from' => now()->toDateString(),
                    'jurisdiction' => 'KE',
                    'etims_tax_type_code' => 'B',
                    'applicable_to' => ['products'],
                    'created_by' => $admin->id,
                    'updated_by' => $admin->id,
                ]
            );

            // Keep a draft invoice available for testing without triggering an
            // eTIMS submission during seeding.
            $invoice = Invoice::updateOrCreate(
                ['invoice_number' => 'CIT-INV-0001'],
                [
                    'company_id' => $company->id,
                    'customer_id' => $customer->id,
                    'type' => 'sales',
                    'status' => 'draft',
                    'invoice_date' => now()->toDateString(),
                    'due_date' => now()->addDays(30)->toDateString(),
                    'subtotal' => 500.00,
                    'tax_amount' => 80.00,
                    'discount_amount' => 0.00,
                    'total_amount' => 580.00,
                    'amount_paid' => 0.00,
                    'balance_amount' => 580.00,
                    'currency' => 'KES',
                    'exchange_rate' => 1,
                    'payment_terms' => 'Due within 30 days',
                    'notes' => 'Seeded draft invoice for local workflow testing',
                    'etims_requested' => DB::raw('false'),
                    'line_items' => [
                        ['product_id' => $water->id, 'description' => $water->name, 'quantity' => 10, 'unit_price' => 50, 'tax_rate' => 16],
                    ],
                    'metadata' => ['seed' => 'citimax-local'],
                    'created_by' => $admin->id,
                ]
            );

            InvoiceLineItem::updateOrCreate(
                ['invoice_id' => $invoice->id, 'product_id' => $water->id],
                [
                    'description' => $water->name,
                    'quantity' => 10,
                    'unit' => 'bottle',
                    'unit_price' => 50.00,
                    'discount_amount' => 0.00,
                    'tax_rate' => 16.00,
                    'tax_amount' => 80.00,
                    'line_total' => 580.00,
                    'metadata' => ['seed' => 'citimax-local'],
                ]
            );

            // Create an unconfigured test-mode eTIMS record. The API key is
            // intentionally not stored in source or seed data; enter it via
            // Settings → eTIMS when testing the integration.
            $etimsConfig = CompanyEtimsConfig::query()
                ->where('company_id', $company->id)
                ->whereNull('superseded_at')
                ->first();

            if (!$etimsConfig) {
                $etimsConfig = new CompanyEtimsConfig();
                $etimsConfig->company_id = $company->id;
            }

            $etimsConfig->fill([
                'name' => 'DigiTax Kenya (Local Test)',
                'country_code' => 'KE',
                'environment' => 'test',
                'branch_id' => '00',
                'enabled' => DB::raw('false'),
                'go_live_date' => null,
            ]);
            $etimsConfig->save();

            $this->command->info('Citimax local demo data seeded successfully.');
            $this->command->info('Login: ' . self::ADMIN_EMAIL . ' / ' . self::ADMIN_PASSWORD);
            $this->command->info('Company: ' . $company->name . ' (' . $company->id . ')');
        });
    }

    private function assertLocalDatabase(): void
    {
        if (!app()->environment('local')) {
            throw new RuntimeException('CitimaxLocalSeeder may only run when APP_ENV=local.');
        }

        $connection = config('database.default');
        $host = config("database.connections.{$connection}.host");

        if ($connection !== 'pgsql' || !in_array($host, ['127.0.0.1', 'localhost', '::1'], true)) {
            throw new RuntimeException('CitimaxLocalSeeder requires a local PostgreSQL database connection.');
        }
    }

    /**
     * Upsert tax rates through the query builder so PostgreSQL receives true
     * boolean expressions instead of PDO's integer bindings.
     */
    private function upsertTaxRate(array $attributes): void
    {
        $existing = DB::table('tax_rates')->where('code', $attributes['code'])->first();
        $now = now();
        $data = $attributes;
        $data['id'] = $existing?->id ?? (string) Str::uuid();
        $data['is_active'] = DB::raw($attributes['is_active'] ? 'true' : 'false');
        $data['is_default'] = DB::raw($attributes['is_default'] ? 'true' : 'false');
        $data['applicable_to'] = json_encode($attributes['applicable_to'], JSON_THROW_ON_ERROR);
        $data['deleted_at'] = null;
        $data['updated_at'] = $now;

        if ($existing) {
            DB::table('tax_rates')->where('id', $existing->id)->update($data);
        } else {
            $data['created_at'] = $now;
            DB::table('tax_rates')->insert($data);
        }
    }
}
