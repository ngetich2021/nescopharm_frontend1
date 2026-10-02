<?php

namespace Tests\Feature;

use App\Models\Company;
use App\Models\Customer;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderDispatch;
use App\Models\Permission;
use App\Models\Product;
use App\Models\Role;
use App\Models\Store;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class OrderDispatchTest extends TestCase
{
    use RefreshDatabase;

    protected $company;
    protected $user;
    protected $order;
    protected $product;

    protected function setUp(): void
    {
        error_log("OrderDispatchTest::setUp starting");
        parent::setUp();
        error_log("OrderDispatchTest::setUp parent::setUp done");

        // Create company
        $this->company = Company::factory()->create();

        // Create user
        $this->user = User::factory()->create([
            'company_id' => $this->company->id,
        ]);

        // Create role and permission
        $role = Role::create([
            'id' => Str::uuid(),
            'name' => 'Admin',
            'company_id' => $this->company->id,
            'is_active' => true,
        ]);

        $permission = Permission::create([
            'id' => Str::uuid(),
            'name' => 'Create Order Dispatches',
            'key' => 'can_create_order_dispatches',
            'is_active' => true,
        ]);

        $role->permissions()->attach($permission->id, [
            'granted_by' => $this->user->id,
            'granted_at' => now(),
        ]);

        // Assign role to user
        $this->user->update(['role_id' => $role->id]);

        // Create customer
        $customer = Customer::factory()->create(['company_id' => $this->company->id]);

        // Create product
        $this->product = Product::create([
            'id' => Str::uuid(),
            'company_id' => $this->company->id,
            'name' => 'Test Product',
            'product_code' => 'TP001',
            'price' => 100,
            'track_inventory' => true,
            'stock_quantity' => 10,
        ]);

        // Create order
        $this->order = Order::create([
            'id' => Str::uuid(),
            'order_number' => 'ORD-TEST-001',
            'customer_id' => $customer->id,
            'company_id' => $this->company->id,
            'total_amount' => 100,
            'status' => 'pending',
        ]);

        // Create order item
        OrderItem::create([
            'id' => Str::uuid(),
            'order_id' => $this->order->id,
            'product_id' => $this->product->id,
            'company_id' => $this->company->id,
            'quantity' => 1,
            'unit_price' => 100,
            'total_price' => 100,
        ]);

        // Ensure there's at least one approver configured or provided
        // The controller checks for empty(dispatch->approvers)
    }

    public function test_can_create_order_dispatch_from_order()
    {
        Sanctum::actingAs($this->user);

        $response = $this->postJson('/api/order-dispatches', [
            'order_id' => $this->order->id,
            'notes' => 'Test dispatch notes',
            'approvers' => [$this->user->id], // Provide current user as approver
        ]);

        $response->assertStatus(201);
        $response->assertJsonStructure([
            'success',
            'message',
            'data' => [
                'id',
                'order_id',
                'dispatch_number',
                'status',
            ],
        ]);

        $this->assertDatabaseHas('order_dispatches', [
            'order_id' => $this->order->id,
            'notes' => 'Test dispatch notes',
        ]);

        $dispatchId = $response->json('data.id');
        $this->assertDatabaseHas('order_dispatch_items', [
            'order_dispatch_id' => $dispatchId,
            'quantity' => 1,
        ]);
    }

    public function test_can_create_order_dispatch_with_delivery_details()
    {
        Sanctum::actingAs($this->user);

        $estimatedDate = now()->addDays(2)->format('Y-m-d');
        $specialInstructions = 'Handle with care';

        $response = $this->postJson('/api/order-dispatches', [
            'order_id' => $this->order->id,
            'notes' => 'Test dispatch notes',
            'estimated_delivery_date' => $estimatedDate,
            'special_instructions' => $specialInstructions,
            'approvers' => [$this->user->id],
        ]);

        $response->assertStatus(201);
        $response->assertJsonPath('data.estimated_delivery_date', function ($date) use ($estimatedDate) {
            return str_starts_with($date, $estimatedDate);
        });
        $response->assertJsonPath('data.special_instructions', $specialInstructions);

        $this->assertDatabaseHas('order_dispatches', [
            'order_id' => $this->order->id,
            'special_instructions' => $specialInstructions,
        ]);
    }

    public function test_fails_to_create_dispatch_with_insufficient_stock()
    {
        Sanctum::actingAs($this->user);

        // Update product stock to be less than ordered quantity
        $this->product->update(['stock_quantity' => 0]);

        $response = $this->postJson('/api/order-dispatches', [
            'order_id' => $this->order->id,
            'approvers' => [$this->user->id],
        ]);

        $response->assertStatus(422);
        $response->assertJsonPath('message', "Insufficient stock for product: Test Product. Available: 0, Requested: 1");
    }

    public function test_fails_to_create_dispatch_without_permission()
    {
        // Create user without the required permission
        $role = Role::create([
            'id' => Str::uuid(),
            'name' => 'No Permission Role',
            'company_id' => $this->company->id,
            'is_active' => true,
        ]);

        $unprivilegedUser = User::factory()->create([
            'company_id' => $this->company->id,
            'role_id' => $role->id,
        ]);

        Sanctum::actingAs($unprivilegedUser);

        $response = $this->postJson('/api/order-dispatches', [
            'order_id' => $this->order->id,
        ]);

        $response->assertStatus(403); // It will fail permission check early
    }
}
