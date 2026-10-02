<?php

namespace Tests\Feature;

use Tests\TestCase;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;
use App\Models\Company;
use App\Models\User;
use App\Models\Product;
use App\Models\ProductPackagingUnit;

class QuotePackagingTest extends TestCase
{
    public function test_create_quote_with_packaging_unit_saves_packaging_fields()
    {
        // Create minimal schema for the test to avoid relying on full migrations
        Schema::create('companies', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('name')->nullable();
            $table->timestamps();
        });

        Schema::create('roles', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('company_id')->nullable();
            $table->string('name')->nullable();
            $table->json('permissions')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('users', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('company_id')->nullable();
            $table->string('email')->unique();
            $table->string('password');
            $table->string('first_name')->nullable();
            $table->string('last_name')->nullable();
            $table->boolean('email_verified')->default(false);
            $table->boolean('is_active')->default(true);
            $table->string('role_id')->nullable();
            $table->timestamps();
        });

        Schema::create('customers', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('name')->nullable();
            $table->timestamps();
        });

        Schema::create('products', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('company_id')->nullable();
            $table->string('name')->nullable();
            $table->decimal('price', 10, 2)->default(0);
            $table->decimal('unit_cost', 10, 2)->default(0);
            $table->integer('stock_quantity')->default(0);
            $table->boolean('has_packaging')->default(false);
            $table->string('base_unit')->nullable();
            $table->timestamps();
        });

        Schema::create('product_packaging_units', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('company_id')->nullable();
            $table->string('product_id')->nullable();
            $table->string('parent_unit_id')->nullable();
            $table->string('unit_name')->nullable();
            $table->string('unit_abbreviation')->nullable();
            $table->decimal('base_unit_quantity', 12, 4)->nullable();
            $table->decimal('units_per_parent', 12, 4)->nullable();
            $table->boolean('is_base_unit')->default(false);
            $table->boolean('is_sellable')->default(true);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('quotes', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('quote_number')->nullable();
            $table->string('customer_id')->nullable();
            $table->string('company_id')->nullable();
            $table->decimal('total_amount', 12, 2)->default(0);
            $table->decimal('discount', 12, 2)->default(0);
            $table->decimal('final_amount', 12, 2)->default(0);
            $table->string('status')->nullable();
            $table->date('valid_until')->nullable();
            $table->timestamps();
        });

        Schema::create('quote_items', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('quote_id')->nullable();
            $table->string('product_id')->nullable();
            $table->string('variant_id')->nullable();
            $table->string('unit_id')->nullable();
            $table->decimal('quantity', 12, 4)->default(0);
            $table->decimal('unit_quantity', 12, 4)->nullable();
            $table->integer('base_quantity')->nullable();
            $table->json('packaging_breakdown')->nullable();
            $table->decimal('unit_price', 12, 2)->default(0);
            $table->decimal('total_price', 12, 2)->default(0);
            $table->string('company_id')->nullable();
            $table->timestamps();
        });

        // Create company
        $company = Company::create([
            'id' => (string) Str::uuid(),
            'name' => 'Test Company'
        ]);

        // Create a user for authentication - avoid firing model events to keep test simple
        $user = User::withoutEvents(function () use ($company) {
            return User::create([
                'id' => (string) Str::uuid(),
                'company_id' => $company->id,
                'email' => 'test@example.com',
                'password' => bcrypt('password'),
                'first_name' => 'Test',
                'last_name' => 'User',
                'email_verified' => true,
                'is_active' => true,
            ]);
        });

        // Create role and assign to user so permission checks pass
        \App\Models\Role::create([
            'id' => (string) Str::uuid(),
            'company_id' => $company->id,
            'name' => 'super_admin',
            'permissions' => json_encode(['can_create_quotes' => true, 'can_manage_all_quotes' => true]),
            'is_active' => true,
        ]);

        // reload user and set role_id directly
        $user->role_id = \App\Models\Role::where('company_id', $company->id)->where('name', 'super_admin')->first()->id;
        $user->save();

        // Create a product that uses packaging
        $product = Product::create([
            'id' => (string) Str::uuid(),
            'company_id' => $company->id,
            'name' => 'Packaged Widget',
            'price' => 10.00,
            'unit_cost' => 5.00,
            'stock_quantity' => 1000,
            'has_packaging' => true,
            'base_unit' => 'Piece'
        ]);

        // Create base packaging unit (piece)
        $baseUnit = ProductPackagingUnit::create([
            'id' => (string) Str::uuid(),
            'company_id' => $company->id,
            'product_id' => $product->id,
            'unit_name' => 'Piece',
            'unit_abbreviation' => 'pc',
            'is_base_unit' => true,
            'base_unit_quantity' => 1,
            'is_sellable' => true,
            'is_active' => true,
        ]);

        // Create carton unit that contains 12 pieces
        $cartonUnit = ProductPackagingUnit::create([
            'id' => (string) Str::uuid(),
            'company_id' => $company->id,
            'product_id' => $product->id,
            'parent_unit_id' => $baseUnit->id,
            'unit_name' => 'Carton',
            'unit_abbreviation' => 'ctn',
            'units_per_parent' => 12,
            'is_sellable' => true,
            'is_active' => true,
        ]);

        // Prepare payload - order 1.5 cartons (should convert to 18 base units)
        $payload = [
            'status' => 'pending',
            'valid_until' => now()->addDays(7)->toDateString(),
            'items' => [
                [
                    'product_id' => $product->id,
                    'unit_id' => $cartonUnit->id,
                    'quantity' => 1.5,
                    'unit_price' => 120.00,
                ]
            ]
        ];

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/quotes', $payload);

        $response->assertStatus(201);

        $response->assertJsonPath('quote.quoteItems.0.unit_id', $cartonUnit->id);
        $response->assertJsonPath('quote.quoteItems.0.unit_quantity', '1.5000');

        // base_quantity casted to int by controller (1.5 * 12 = 18)
        $response->assertJsonPath('quote.quoteItems.0.base_quantity', 18);

        // Ensure DB contains the quote item with expected base_quantity
        $this->assertDatabaseHas('quote_items', [
            'product_id' => $product->id,
            'unit_id' => $cartonUnit->id,
            'base_quantity' => 18,
        ]);
    }
}
