<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithFaker;
use Tests\TestCase;
use App\Models\User;
use App\Models\Company;
use App\Models\Product;
use App\Models\Order;
use App\Models\OrderItem;
use Laravel\Sanctum\Sanctum;

class OrderTaxTest extends TestCase
{
    use RefreshDatabase;

    protected $user;
    protected $company;

    protected function setUp(): void
    {
        parent::setUp();

        $this->company = Company::factory()->create();
        $this->user = User::factory()->create([
            'company_id' => $this->company->id,
        ]);

        // Assign role with permission
        $role = \App\Models\Role::factory()->create(['company_id' => $this->company->id]);
        $role->permissions = ['can_create_orders', 'can_view_orders'];
        $role->save();
        $this->user->role_id = $role->id;
        $this->user->save();

        Sanctum::actingAs($this->user);
    }

    public function test_order_creation_calculates_tax_correctly()
    {
        // Create a taxable product with 16% tax
        $product = Product::factory()->create([
            'company_id' => $this->company->id,
            'price' => 100,
            'is_taxable' => true,
            'tax_rate' => 16.00,
            'stock_quantity' => 100,
            'track_inventory' => true,
        ]);

        $payload = [
            'items' => [
                [
                    'product_id' => $product->id,
                    'quantity' => 2,
                    'unit_price' => 100,
                ]
            ],
            'status' => 'pending',
            'customer_id' => \App\Models\Customer::factory()->create(['company_id' => $this->company->id])->id,
        ];

        $response = $this->postJson('/api/orders', $payload);

        $response->assertStatus(201);

        $orderId = $response->json('order.id');
        $order = Order::find($orderId);
        $orderItem = OrderItem::where('order_id', $orderId)->first();

        // 2 items * 100 price = 200 subtotal
        // Tax = (200 * 16) / 100 = 32
        // Total = 200 + 32 = 232

        $this->assertEquals(32.00, $order->tax);
        $this->assertEquals(232.00, $order->final_amount);

        $this->assertEquals(16.00, $orderItem->tax_rate);
        $this->assertEquals(32.00, $orderItem->tax_amount);
    }

    public function test_order_line_tax_can_be_overridden_on_create_and_edit()
    {
        $this->user->role->update(['permissions' => ['can_create_orders', 'can_view_orders', 'can_update_orders']]);

        $product = Product::factory()->create([
            'company_id' => $this->company->id,
            'price' => 100,
            'is_taxable' => true,
            'tax_rate' => 16.00,
            'stock_quantity' => 100,
            'track_inventory' => true,
        ]);
        $customerId = \App\Models\Customer::factory()->create(['company_id' => $this->company->id])->id;

        $response = $this->postJson('/api/orders', [
            'items' => [['product_id' => $product->id, 'quantity' => 2, 'unit_price' => 100, 'tax_rate' => 0]],
            'status' => 'pending',
            'customer_id' => $customerId,
        ]);
        $response->assertStatus(201);
        $order = Order::find($response->json('order.id'));

        $this->assertEquals(0.00, $order->tax);
        $this->assertEquals(200.00, $order->final_amount);
        $this->assertEquals(0.00, OrderItem::where('order_id', $order->id)->value('tax_rate'));

        $this->putJson("/api/orders/{$order->id}", [
            'items' => [['product_id' => $product->id, 'quantity' => 2, 'unit_price' => 100, 'tax_rate' => 8]],
        ])->assertStatus(200);

        $order->refresh();
        $this->assertEquals(16.00, $order->tax);
        $this->assertEquals(216.00, $order->final_amount);
        $this->assertEquals(8.00, OrderItem::where('order_id', $order->id)->value('tax_rate'));
    }

    public function test_product_switched_off_tax_stops_charging_vat_despite_old_vat_category()
    {
        $standardRated = \App\Models\TaxRate::withoutGlobalScopes()->create([
            'company_id' => $this->company->id,
            'name' => 'VAT 16%',
            'code' => 'B',
            'rate' => 0.16,
            'etims_tax_type_code' => 'B',
        ]);

        $product = Product::factory()->create([
            'company_id' => $this->company->id,
            'price' => 100,
            'is_taxable' => true,
            'tax_rate' => 16.00,
            'vat_category_id' => $standardRated->id,
        ]);
        $this->assertEquals(16.0, \App\Services\TaxCompliance\EtimsTaxType::rateForProduct($product->fresh()));

        $product->update(['is_taxable' => false, 'tax_rate' => null]);

        $this->assertEquals('D', \App\Services\TaxCompliance\EtimsTaxType::forProduct($product->fresh()));
        $this->assertEquals(0.0, \App\Services\TaxCompliance\EtimsTaxType::rateForProduct($product->fresh()));
    }
}
