<?php

namespace Tests\Feature;

use App\Models\Company;
use App\Models\CreditNote;
use App\Models\CreditNoteLineItem;
use App\Models\Customer;
use App\Models\InventoryMovement;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\Permission;
use App\Models\Product;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CreditNoteInventoryAndRevenueTest extends TestCase
{
    use RefreshDatabase;

    protected Company $company;
    protected User $user;
    protected Customer $customer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->company = Company::factory()->create();

        $role = Role::create([
            'name' => 'Admin',
            'company_id' => $this->company->id,
            'is_system_role' => true,
        ]);

        foreach ([
            'can_update_invoices',
            'can_view_reports',
        ] as $permissionKey) {
            $permission = Permission::firstOrCreate(
                ['key' => $permissionKey],
                [
                    'name' => $permissionKey,
                    'slug' => $permissionKey,
                    'category' => 'test',
                    'is_system' => true,
                    'is_active' => true,
                ]
            );

            $role->permissions()->syncWithoutDetaching([$permission->id]);
        }

        $this->user = User::factory()->create([
            'company_id' => $this->company->id,
            'role_id' => $role->id,
        ]);

        $this->customer = Customer::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->company->id,
            'name' => 'Credit Test Customer',
            'customer_number' => 'CUST-' . Str::random(8) . '-0001',
            'status' => 'active',
        ]);

        Sanctum::actingAs($this->user);
    }

    public function test_issuing_credit_note_returns_items_to_inventory(): void
    {
        $product = Product::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->company->id,
            'name' => 'Returned Item',
            'sku' => 'RET-001',
            'product_number' => 'PROD-' . Str::random(8) . '-0001',
            'stock_quantity' => 5,
            'track_inventory' => true,
            'unit_cost' => 50,
            'price' => 80,
            'is_active' => true,
        ]);

        $invoice = Invoice::create([
            'id' => (string) Str::uuid(),
            'invoice_number' => 'INV-TEST-001',
            'company_id' => $this->company->id,
            'customer_id' => $this->customer->id,
            'status' => 'sent',
            'invoice_date' => now()->toDateString(),
            'due_date' => now()->addDays(30)->toDateString(),
            'subtotal' => 240,
            'tax_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => 240,
            'amount_paid' => 0,
            'balance_amount' => 240,
            'currency' => 'KES',
            'created_by' => $this->user->id,
        ]);

        $creditNote = CreditNote::create([
            'company_id' => $this->company->id,
            'customer_id' => $this->customer->id,
            'invoice_id' => $invoice->id,
            'created_by' => $this->user->id,
            'status' => 'draft',
            'credit_note_date' => now()->toDateString(),
            'subtotal' => 240,
            'tax_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => 240,
            'amount_applied' => 0,
            'amount_refunded' => 0,
            'balance_amount' => 240,
            'currency' => 'KES',
        ]);

        CreditNoteLineItem::create([
            'credit_note_id' => $creditNote->id,
            'product_id' => $product->id,
            'description' => 'Returned Item',
            'quantity' => 3,
            'unit' => 'pcs',
            'unit_price' => 80,
            'discount_amount' => 0,
            'tax_rate' => 0,
        ]);

        $response = $this->postJson("/api/credit-notes/{$creditNote->id}/issue");

        $response->assertOk()
            ->assertJsonPath('data.status', 'issued');

        $this->assertSame(8, $product->fresh()->stock_quantity);

        $movement = InventoryMovement::where('reference_id', $creditNote->id)->first();
        $this->assertNotNull($movement);
        $this->assertSame('return', $movement->type);
        $this->assertSame(3, $movement->quantity);
        $this->assertSame(5, $movement->quantity_before);
        $this->assertSame(8, $movement->quantity_after);
    }

    public function test_issued_credit_note_reduces_reported_total_sales(): void
    {
        $order = Order::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->company->id,
            'customer_id' => $this->customer->id,
            'order_number' => 'ORD-CREDIT-001',
            'total_amount' => 1000,
            'final_amount' => 1000,
            'status' => 'completed',
            'order_date' => now(),
        ]);

        $invoice = Invoice::create([
            'id' => (string) Str::uuid(),
            'invoice_number' => 'INV-CREDIT-001',
            'company_id' => $this->company->id,
            'customer_id' => $this->customer->id,
            'order_id' => $order->id,
            'status' => 'sent',
            'invoice_date' => now()->toDateString(),
            'due_date' => now()->addDays(30)->toDateString(),
            'subtotal' => 1000,
            'tax_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => 1000,
            'amount_paid' => 0,
            'balance_amount' => 1000,
            'currency' => 'KES',
            'created_by' => $this->user->id,
        ]);

        $creditNote = CreditNote::create([
            'company_id' => $this->company->id,
            'customer_id' => $this->customer->id,
            'invoice_id' => $invoice->id,
            'created_by' => $this->user->id,
            'status' => 'issued',
            'credit_note_date' => now()->toDateString(),
            'subtotal' => 200,
            'tax_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => 200,
            'amount_applied' => 0,
            'amount_refunded' => 0,
            'balance_amount' => 200,
            'currency' => 'KES',
            'issued_at' => now(),
        ]);

        $response = $this->getJson('/api/reports/sales?type=performance');

        $response->assertOk()
            ->assertJsonPath('data.total_sales', 800)
            ->assertJsonPath('data.total_credited', 200)
            ->assertJsonPath('data.summary_by_date.0.net_total', 800);
    }
}
