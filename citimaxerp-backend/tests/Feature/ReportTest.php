<?php

namespace Tests\Feature;

use App\Models\Company;
use App\Models\Customer;
use App\Models\Product;
use App\Models\User;
use App\Models\Role;
use App\Models\Permission;
use App\Models\Order;
use App\Models\Quote;
use App\Models\OrderItem;
use App\Models\OrderDispatch;
use App\Models\PurchaseOrder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use Laravel\Sanctum\Sanctum;

class ReportTest extends TestCase
{
    use RefreshDatabase;

    protected $user;
    protected $company;
    protected $customer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->company = Company::factory()->create();

        $role = Role::create([
            'name' => 'Admin',
            'company_id' => $this->company->id,
            'is_system_role' => true
        ]);

        $permission = Permission::create([
            'name' => 'can_view_reports',
            'key' => 'can_view_reports',
            'slug' => 'can_view_reports',
            'category' => 'reports',
            'is_system' => true,
            'is_active' => true
        ]);

        $role->permissions()->attach($permission->id);

        $this->user = User::factory()->create([
            'company_id' => $this->company->id,
            'role_id' => $role->id
        ]);

        $this->customer = Customer::create([
            'id' => \Illuminate\Support\Str::uuid(),
            'company_id' => $this->company->id,
            'name' => 'Test Customer',
            'customer_number' => 'CUST-' . \Illuminate\Support\Str::random(8) . '-0001',
            'status' => 'active'
        ]);

        Sanctum::actingAs($this->user);
    }

    /**
     * Test Inventory Balance Report
     */
    public function test_inventory_balance_report(): void
    {
        for ($i = 0; $i < 5; $i++) {
            Product::create([
                'id' => \Illuminate\Support\Str::uuid(),
                'company_id' => $this->company->id,
                'name' => "Product " . ($i + 1),
                'sku' => "SKU-" . ($i + 1),
                'stock_quantity' => 100,
                'on_hand' => 100,
                'allocated' => 0,
                'is_active' => true,
                'is_taxable' => true,
                'is_featured' => false,
                'is_digital' => false,
                'track_inventory' => true,
                'has_packaging' => false,
                'has_variations' => false,
                'unit_cost' => 10.00,
                'product_number' => "PROD-" . \Illuminate\Support\Str::random(8) . "-000" . $i
            ]);
        }

        $response = $this->getJson('/api/reports/inventory?type=balance');

        $response->assertStatus(200)
            ->assertJsonStructure(['status', 'data', 'summary'])
            ->assertJsonCount(5, 'data');

        $this->assertEquals(5, $response->json('summary.total_items'));
        $this->assertEquals(500, $response->json('summary.total_stock'));
        $this->assertEquals(5000, $response->json('summary.total_value'));

        echo "\nInventory Balance Report with Summary Output:\n";
        echo json_encode($response->json(), JSON_PRETTY_PRINT);
    }

    /**
     * Test Low Stock Report
     */
    public function test_low_stock_report(): void
    {
        // Item with low stock
        Product::create([
            'id' => \Illuminate\Support\Str::uuid(),
            'company_id' => $this->company->id,
            'name' => "Low Stock Product",
            'sku' => "LS-001",
            'stock_quantity' => 5,
            'low_stock_threshold' => 10,
            'is_active' => true,
            'is_taxable' => true,
            'is_featured' => false,
            'is_digital' => false,
            'track_inventory' => true,
            'has_packaging' => false,
            'has_variations' => false,
            'product_number' => "PROD-" . \Illuminate\Support\Str::random(8) . "-0010"
        ]);

        // Item with normal stock
        Product::create([
            'id' => \Illuminate\Support\Str::uuid(),
            'company_id' => $this->company->id,
            'name' => "Normal Stock Product",
            'sku' => "NS-001",
            'stock_quantity' => 50,
            'low_stock_threshold' => 10,
            'is_active' => true,
            'is_taxable' => true,
            'is_featured' => false,
            'is_digital' => false,
            'track_inventory' => true,
            'has_packaging' => false,
            'has_variations' => false,
            'product_number' => "PROD-" . \Illuminate\Support\Str::random(8) . "-0011"
        ]);

        $response = $this->getJson('/api/reports/inventory?type=low_stock');

        $response->assertStatus(200)
            ->assertJsonStructure(['status', 'data', 'summary'])
            ->assertJsonCount(1, 'data');

        $this->assertEquals(1, $response->json('summary.total_low_stock_items'));

        echo "\nLow Stock Report with Summary Output:\n";
        echo json_encode($response->json(), JSON_PRETTY_PRINT);
    }

    /**
     * Test Inventory Filters
     */
    public function test_inventory_filters(): void
    {
        // Product in Category A
        Product::create([
            'id' => \Illuminate\Support\Str::uuid(),
            'company_id' => $this->company->id,
            'name' => "Cat A Product",
            'sku' => "CA-001",
            'category' => 'Category A',
            'stock_quantity' => 10,
            'is_active' => true,
            'product_number' => "PROD-" . \Illuminate\Support\Str::random(8) . "-0050"
        ]);

        // Product in Category B
        Product::create([
            'id' => \Illuminate\Support\Str::uuid(),
            'company_id' => $this->company->id,
            'name' => "Cat B Product",
            'sku' => "CB-001",
            'category' => 'Category B',
            'stock_quantity' => 20,
            'is_active' => true,
            'product_number' => "PROD-" . \Illuminate\Support\Str::random(8) . "-0051"
        ]);

        // Inactive Product
        Product::create([
            'id' => \Illuminate\Support\Str::uuid(),
            'company_id' => $this->company->id,
            'name' => "Inactive Product",
            'sku' => "IA-001",
            'stock_quantity' => 30,
            'is_active' => false,
            'product_number' => "PROD-" . \Illuminate\Support\Str::random(8) . "-0052"
        ]);

        // Test Category Filter
        $response = $this->getJson('/api/reports/inventory?type=balance&category=Category A');
        $response->assertStatus(200)->assertJsonCount(1, 'data');
        $this->assertEquals(10, $response->json('summary.total_stock'));

        // Test Status Filter
        $response = $this->getJson('/api/reports/inventory?type=balance&status=inactive');
        $response->assertStatus(200)->assertJsonCount(1, 'data');
        $this->assertEquals(30, $response->json('summary.total_stock'));

        echo "\nFiltered Inventory Report (Category A) Output:\n";
        echo json_encode($response->json(), JSON_PRETTY_PRINT);
    }

    /**
     * Test Inventory Movement Report
     */
    public function test_inventory_movement_report(): void
    {
        $product = Product::create([
            'id' => \Illuminate\Support\Str::uuid(),
            'company_id' => $this->company->id,
            'name' => "Movement Product",
            'sku' => "MV-001",
            'stock_quantity' => 50,
            'is_active' => true,
            'product_number' => "PROD-" . \Illuminate\Support\Str::random(8) . "-0020"
        ]);

        \App\Models\InventoryMovement::create([
            'id' => \Illuminate\Support\Str::uuid(),
            'company_id' => $this->company->id,
            'product_id' => $product->id,
            'type' => 'receipt',
            'quantity' => 10,
            'reference_type' => 'manual',
            'movement_date' => now(),
            'description' => 'Test movement'
        ]);

        $response = $this->getJson('/api/reports/inventory?type=movement');

        $response->assertStatus(200)
            ->assertJsonCount(1, 'data');

        echo "\nInventory Movement Report Output:\n";
        echo json_encode($response->json('data'), JSON_PRETTY_PRINT);
    }

    /**
     * Test Sales Performance Report
     */
    public function test_sales_performance_report(): void
    {
        // Create some orders
        Order::create([
            'id' => \Illuminate\Support\Str::uuid(),
            'company_id' => $this->company->id,
            'customer_id' => $this->customer->id,
            'order_number' => 'ORD-TEST-001',
            'total_amount' => 1000,
            'final_amount' => 1100, // including tax/shipping
            'status' => 'completed',
            'created_at' => now()
        ]);

        Order::create([
            'id' => \Illuminate\Support\Str::uuid(),
            'company_id' => $this->company->id,
            'customer_id' => $this->customer->id,
            'order_number' => 'ORD-TEST-002',
            'total_amount' => 2000,
            'final_amount' => 2200,
            'status' => 'pending',
            'created_at' => now()
        ]);

        $response = $this->getJson('/api/reports/sales?type=performance');

        $response->assertStatus(200)
            ->assertJsonStructure(['status', 'data' => ['total_sales', 'order_count', 'average_order_value', 'summary_by_date']]);

        $this->assertEquals(3300, $response->json('data.total_sales'));
        $this->assertEquals(2, $response->json('data.order_count'));

        echo "\nSales Performance Report Output:\n";
        echo json_encode($response->json('data'), JSON_PRETTY_PRINT);
    }

    /**
     * Test Product Sales Ranking Report
     */
    public function test_product_sales_ranking_report(): void
    {
        $product1 = Product::create([
            'id' => \Illuminate\Support\Str::uuid(),
            'company_id' => $this->company->id,
            'name' => "Hot Product",
            'sku' => "HOT-001",
            'product_number' => "PROD-" . \Illuminate\Support\Str::random(8) . "-0090"
        ]);

        $product2 = Product::create([
            'id' => \Illuminate\Support\Str::uuid(),
            'company_id' => $this->company->id,
            'name' => "Cold Product",
            'sku' => "COLD-001",
            'product_number' => "PROD-" . \Illuminate\Support\Str::random(8) . "-0091"
        ]);

        $order = Order::create([
            'id' => \Illuminate\Support\Str::uuid(),
            'company_id' => $this->company->id,
            'customer_id' => $this->customer->id,
            'order_number' => 'ORD-RANK-001',
            'total_amount' => 500,
            'final_amount' => 550,
            'status' => 'completed'
        ]);

        \App\Models\OrderItem::create([
            'id' => \Illuminate\Support\Str::uuid(),
            'order_id' => $order->id,
            'product_id' => $product1->id,
            'company_id' => $this->company->id,
            'quantity' => 10,
            'unit_price' => 40,
            'total_price' => 400
        ]);

        \App\Models\OrderItem::create([
            'id' => \Illuminate\Support\Str::uuid(),
            'order_id' => $order->id,
            'product_id' => $product2->id,
            'company_id' => $this->company->id,
            'quantity' => 2,
            'unit_price' => 50,
            'total_price' => 100
        ]);

        $response = $this->getJson('/api/reports/sales?type=ranking');

        $response->assertStatus(200)
            ->assertJsonCount(2, 'data');

        $this->assertEquals('Hot Product', $response->json('data.0.name'));
        $this->assertEquals(400, $response->json('data.0.total_revenue'));

        echo "\nProduct Sales Ranking Report Output:\n";
        echo json_encode($response->json('data'), JSON_PRETTY_PRINT);
    }

    /**
     * Test Quote Conversion Report
     */
    public function test_quote_conversion_report(): void
    {
        // Converted quote
        \App\Models\Quote::create([
            'id' => \Illuminate\Support\Str::uuid(),
            'company_id' => $this->company->id,
            'customer_id' => $this->customer->id,
            'quote_number' => 'QUO-CONV-001',
            'total_amount' => 1000,
            'status' => 'accepted',
        ]);

        // Pending quote
        \App\Models\Quote::create([
            'id' => \Illuminate\Support\Str::uuid(),
            'company_id' => $this->company->id,
            'customer_id' => $this->customer->id,
            'quote_number' => 'QUO-PEND-001',
            'total_amount' => 1000,
            'status' => 'pending',
        ]);

        $response = $this->getJson('/api/reports/sales?type=conversion');

        $response->assertStatus(200)
            ->assertJsonStructure(['status', 'data' => ['total_quotes', 'converted_quotes', 'conversion_rate']]);

        $this->assertEquals(2, $response->json('data.total_quotes'));
        $this->assertEquals(1, $response->json('data.converted_quotes'));
        $this->assertEquals(50, $response->json('data.conversion_rate'));

        echo "\nQuote Conversion Report Output:\n";
        echo json_encode($response->json('data'), JSON_PRETTY_PRINT);
    }

    /**
     * Test Logistics Reports
     */
    public function test_logistics_reports(): void
    {
        $order = Order::create([
            'id' => \Illuminate\Support\Str::uuid(),
            'company_id' => $this->company->id,
            'customer_id' => $this->customer->id,
            'order_number' => 'ORD-DISP-001',
            'status' => 'pending',
            'total_amount' => 100
        ]);

        // Efficiency report
        OrderDispatch::create([
            'id' => \Illuminate\Support\Str::uuid(),
            'company_id' => $this->company->id,
            'dispatch_number' => 'ODI-EFF-001',
            'order_id' => $order->id,
            'final_approved_at' => now()->subHours(5),
            'dispatch_date' => now(),
            'status' => 'in_transit',
            'created_by' => $this->user->id
        ]);

        $response = $this->getJson('/api/reports/logistics?type=efficiency');
        $response->assertStatus(200)->assertJsonCount(1, 'data');
        $this->assertEquals(5, round($response->json('data.0.hours_to_dispatch')));

        // Success rate report
        OrderDispatch::create([
            'id' => \Illuminate\Support\Str::uuid(),
            'company_id' => $this->company->id,
            'dispatch_number' => 'ODI-SUCC-001',
            'status' => 'delivered',
            'created_by' => $this->user->id,
            'order_id' => $order->id
        ]);

        $response = $this->getJson('/api/reports/logistics?type=success_rate');
        $response->assertStatus(200)->assertJsonStructure(['status', 'data' => ['total_dispatches', 'delivered', 'failed_or_returned', 'pending']]);

        echo "\nLogistics Success Rate Report Output:\n";
        echo json_encode($response->json('data'), JSON_PRETTY_PRINT);
    }

    /**
     * Test Procurement Reports
     */
    public function test_procurement_reports(): void
    {
        $supplier = \App\Models\Supplier::create([
            'id' => \Illuminate\Support\Str::uuid(),
            'company_id' => $this->company->id,
            'name' => 'Supplier A',
            'email' => 'supplier@example.com'
        ]);

        $po = PurchaseOrder::create([
            'id' => \Illuminate\Support\Str::uuid(),
            'company_id' => $this->company->id,
            'order_number' => 'PO-TEST-001',
            'status' => 'pending',
            'supplier_id' => $supplier->id,
            'currency_code' => 'KES',
            'order_date' => now()
        ]);

        $product = Product::create([
            'id' => \Illuminate\Support\Str::uuid(),
            'company_id' => $this->company->id,
            'name' => 'PO Product',
            'sku' => 'PO-SKU-001',
            'product_number' => 'PROD-PO-001'
        ]);

        \DB::table('purchase_order_items')->insert([
            'id' => \Illuminate\Support\Str::uuid(),
            'purchase_order_id' => $po->id,
            'product_id' => $product->id,
            'quantity' => 10,
            'unit_price' => 100,
            'subtotal' => 1000,
            'created_at' => now(),
            'updated_at' => now()
        ]);

        $response = $this->getJson('/api/reports/procurement');
        $response->assertStatus(200)->assertJsonCount(1, 'data');

        echo "\nProcurement Status Report Output:\n";
        echo json_encode($response->json('data'), JSON_PRETTY_PRINT);
    }

    /**
     * Test Customer Reports
     */
    public function test_customer_reports(): void
    {
        // Data already includes 1 customer from setUp
        $response = $this->getJson('/api/reports/customers');
        $response->assertStatus(200)->assertJsonCount(1, 'data');

        echo "\nCustomer Acquisition Report Output:\n";
        echo json_encode($response->json('data'), JSON_PRETTY_PRINT);
    }

    /**
     * Test Sales Location Filtering
     */
    public function test_sales_location_filtering(): void
    {
        // Order in Mombasa
        $loc1 = \App\Models\DeliveryLocation::create([
            'id' => \Illuminate\Support\Str::uuid(),
            'customer_id' => $this->customer->id,
            'company_id' => $this->company->id,
            'city' => 'Mombasa',
            'house_number' => '123',
            'country' => 'Kenya'
        ]);

        Order::create([
            'id' => \Illuminate\Support\Str::uuid(),
            'company_id' => $this->company->id,
            'customer_id' => $this->customer->id,
            'order_number' => 'ORD-MSA-001',
            'total_amount' => 500,
            'final_amount' => 500,
            'status' => 'completed',
            'delivery_location_id' => $loc1->id
        ]);

        // Order in Nairobi
        $loc2 = \App\Models\DeliveryLocation::create([
            'id' => \Illuminate\Support\Str::uuid(),
            'customer_id' => $this->customer->id,
            'company_id' => $this->company->id,
            'city' => 'Nairobi',
            'house_number' => '456',
            'country' => 'Kenya'
        ]);

        Order::create([
            'id' => \Illuminate\Support\Str::uuid(),
            'company_id' => $this->company->id,
            'customer_id' => $this->customer->id,
            'order_number' => 'ORD-NBO-001',
            'total_amount' => 1000,
            'final_amount' => 1000,
            'status' => 'completed',
            'delivery_location_id' => $loc2->id
        ]);

        // Test City Filter
        $response = $this->getJson('/api/reports/sales?type=performance&city=Mombasa');
        $response->assertStatus(200);
        $this->assertEquals(500, $response->json('data.total_sales'));
        $this->assertEquals(1, $response->json('data.order_count'));

        // Test Location ID Filter
        $response = $this->getJson('/api/reports/sales?type=performance&location_id=' . $loc2->id);
        $response->assertStatus(200);
        $this->assertEquals(1000, $response->json('data.total_sales'));
        $this->assertEquals(1, $response->json('data.order_count'));

        echo "\nSales Location Filtering Output (Mombasa):\n";
        echo json_encode($response->json('data'), JSON_PRETTY_PRINT);
    }
}
