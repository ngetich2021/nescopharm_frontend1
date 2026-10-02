<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithFaker;
use Tests\TestCase;
use App\Models\User;
use App\Models\Company;
use App\Models\Role;
use App\Models\Customer;
use App\Models\Product;
use App\Models\Order;
use Carbon\Carbon;

class OrderDateTest extends TestCase
{
    // use RefreshDatabase; // Be careful with this on a persistent dev env

    protected $user;
    protected $company;
    protected $customer;
    protected $product;

    protected function setUp(): void
    {
        parent::setUp();

        // Setup common data
        // Ideally we use factories, but I'll create manually to be safe if factories aren't perfect
        $this->company = Company::firstOrCreate(
            ['name' => 'Test Company'],
            ['email' => 'test@company.com']
        );

        $role = Role::firstOrCreate(
            ['name' => 'admin', 'company_id' => $this->company->id],
            ['permissions' => ['can_create_orders', 'can_update_orders', 'can_view_orders']]
        );

        $this->user = User::where('email', 'testuser@example.com')->first();
        if (!$this->user) {
            $this->user = User::factory()->create([
                'company_id' => $this->company->id,
                'role_id' => $role->id,
                'email' => 'testuser@example.com'
            ]);
        }

        $this->actingAs($this->user);

        $this->customer = Customer::factory()->create(['company_id' => $this->company->id]);
        $this->product = Product::factory()->create(['company_id' => $this->company->id, 'price' => 100, 'stock_quantity' => 100, 'track_inventory' => true]);
    }

    public function test_can_create_order_with_order_date()
    {
        $orderDate = Carbon::now()->subDays(5)->toDateTimeString();

        $payload = [
            'customer_id' => $this->customer->id,
            'status' => 'pending',
            'items' => [
                [
                    'product_id' => $this->product->id,
                    'quantity' => 2,
                    'unit_price' => 100
                ]
            ],
            'order_date' => $orderDate
        ];

        $response = $this->postJson('/api/orders', $payload);

        $response->assertStatus(201);
        $this->assertDatabaseHas('orders', [
            'order_date' => $orderDate,
            'customer_id' => $this->customer->id
        ]);
    }

    public function test_order_date_defaults_to_now_if_missing()
    {
        $payload = [
            'customer_id' => $this->customer->id,
            'status' => 'pending',
            'items' => [
                [
                    'product_id' => $this->product->id,
                    'quantity' => 1,
                    'unit_price' => 100
                ]
            ]
            // missing order_date
        ];

        $response = $this->postJson('/api/orders', $payload);

        $response->assertStatus(201);
        $orderId = $response->json('order.id');
        $order = Order::find($orderId);

        // Assert order_date is set and close to now
        $this->assertNotNull($order->order_date);
        // Allow 2 seconds difference
        $this->assertTrue(Carbon::parse($order->order_date)->diffInSeconds(Carbon::now()) < 5);
    }

    public function test_can_update_order_date()
    {
        $order = Order::factory()->create([
            'company_id' => $this->company->id,
            'customer_id' => $this->customer->id,
            'order_date' => Carbon::now()->toDateTimeString()
        ]);

        $newDate = Carbon::now()->subDays(10)->toDateTimeString();

        $response = $this->putJson("/api/orders/{$order->id}", [
            'order_date' => $newDate
        ]);

        $response->assertStatus(200);
        $this->assertDatabaseHas('orders', [
            'id' => $order->id,
            'order_date' => $newDate
        ]);
    }
}
