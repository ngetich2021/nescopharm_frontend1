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
}
