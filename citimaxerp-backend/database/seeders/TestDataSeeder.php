<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use App\Models\Company;
use App\Models\User;
use App\Models\Role;
use App\Models\Store;
use App\Models\Customer;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\Supplier;
use App\Models\ExpenseCategory;

class TestDataSeeder extends Seeder
{
    public function run(): void
    {
        $this->command->info('🌱 Starting test data seeding...');

        // Create Company
        $this->command->info('Creating company...');
        $company = Company::create([
            'id' => Str::uuid(),
            'name' => 'Cherry Distributors Ltd',
            'description' => 'Leading beverage distributor',
            'email' => 'info@cherrydist.com',
            'phone' => '+254712345678',
            'address' => '123 Industrial Area',
            'city' => 'Nairobi',
            'country' => 'Kenya',
        ]);

        // Create Roles
        $this->command->info('Creating roles...');
        $adminRole = Role::create([
            'id' => Str::uuid(),
            'company_id' => $company->id,
            'name' => 'Admin',
            'description' => 'System Administrator',
        ]);

        // Create Admin User
        $this->command->info('Creating users...');
        $admin = User::create([
            'id' => Str::uuid(),
            'company_id' => $company->id,
            'role_id' => $adminRole->id,
            'first_name' => 'John',
            'last_name' => 'Admin',
            'email' => 'admin@cherrydist.com',
            'password' => Hash::make('password'),
            'phone' => '+254700000001',
        ]);

        // Create Store
        $this->command->info('Creating store...');
        $store = Store::create([
            'id' => Str::uuid(),
            'company_id' => $company->id,
            'name' => 'Main Warehouse',
            'description' => 'Primary distribution center',
            'address' => 'Industrial Area',
            'city' => 'Nairobi',
            'phone' => '+254711111111',
            'email' => 'warehouse@cherrydist.com',
        ]);

        // Create Supplier
        $this->command->info('Creating suppliers...');
        $supplier = Supplier::create([
            'id' => Str::uuid(),
            'company_id' => $company->id,
            'name' => 'Coca-Cola Bottlers',
            'email' => 'orders@cocacola.co.ke',
            'phone' => '+254733333333',
            'address' => 'Factory Road, Nairobi, Kenya',
        ]);

        // Create Product Category
        $this->command->info('Creating product categories...');
        $category = ProductCategory::create([
            'id' => Str::uuid(),
            'company_id' => $company->id,
            'name' => 'Soft Drinks',
            'description' => 'Non-alcoholic beverages',
        ]);

        // Create Products
        $this->command->info('Creating products...');
        Product::create([
            'id' => Str::uuid(),
            'company_id' => $company->id,
            'store_id' => $store->id,
            'product_number' => 'PROD-0001',
            'product_code' => 'COKE-500',
            'name' => 'Coca-Cola 500ml',
            'description' => 'Coca-Cola Classic 500ml bottle',
            'price' => 50.00,
            'unit_cost' => 35.00,
            'stock_quantity' => 500,
            'category_id' => $category->id,
            'supplier_id' => $supplier->id,
            'unit_of_measurement' => 'bottle',
        ]);

        Product::create([
            'id' => Str::uuid(),
            'company_id' => $company->id,
            'store_id' => $store->id,
            'product_number' => 'PROD-0002',
            'product_code' => 'SPRITE-500',
            'name' => 'Sprite 500ml',
            'description' => 'Sprite Lemon-Lime 500ml',
            'price' => 50.00,
            'unit_cost' => 35.00,
            'stock_quantity' => 450,
            'category_id' => $category->id,
            'supplier_id' => $supplier->id,
            'unit_of_measurement' => 'bottle',
        ]);

        Product::create([
            'id' => Str::uuid(),
            'company_id' => $company->id,
            'store_id' => $store->id,
            'product_number' => 'PROD-0003',
            'product_code' => 'FANTA-500',
            'name' => 'Fanta Orange 500ml',
            'description' => 'Fanta Orange 500ml bottle',
            'price' => 45.00,
            'unit_cost' => 32.00,
            'stock_quantity' => 400,
            'category_id' => $category->id,
            'supplier_id' => $supplier->id,
            'unit_of_measurement' => 'bottle',
        ]);

        Product::create([
            'id' => Str::uuid(),
            'company_id' => $company->id,
            'store_id' => $store->id,
            'product_number' => 'PROD-0004',
            'product_code' => 'PEPSI-500',
            'name' => 'Pepsi 500ml',
            'description' => 'Pepsi Cola 500ml bottle',
            'price' => 50.00,
            'unit_cost' => 35.00,
            'stock_quantity' => 380,
            'category_id' => $category->id,
            'supplier_id' => $supplier->id,
            'unit_of_measurement' => 'bottle',
        ]);

        // Create Customer
        $this->command->info('Creating customers...');
        Customer::create([
            'id' => Str::uuid(),
            'company_id' => $company->id,
            'name' => 'Jane Doe Supermarket',
            'email' => 'jane@supermarket.com',
            'phone' => '+254755555555',
            'address' => 'Market Street, Nairobi, Kenya',
        ]);

        // Create Expense Category
        $this->command->info('Creating expense categories...');
        ExpenseCategory::create([
            'id' => Str::uuid(),
            'company_id' => $company->id,
            'name' => 'Utilities',
            'description' => 'Electricity, water, internet',
        ]);

        $this->command->newLine();
        $this->command->info('✅ Test data seeding completed!');
        $this->command->info('📊 Login: admin@cherrydist.com / password');
    }
}
