<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Company;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\ProductPackagingUnit;
use App\Models\ProductReceiptItem;
use App\Models\ProductReceipt;
use App\Models\ProductPriceHistory;
use App\Services\ProductPriceHistoryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;

class ProductPriceHistoryTest extends TestCase
{
    use RefreshDatabase;

    protected $user;
    protected $company;
    protected $product;
    protected $service;

    protected function setUp(): void
    {
        parent::setUp();

        // Create test company
        $this->company = Company::create([
            'id' => Str::uuid(),
            'name' => 'Test Company',
            'email' => 'test@company.com',
        ]);

        // Create test user
        $this->user = User::create([
            'id' => Str::uuid(),
            'company_id' => $this->company->id,
            'name' => 'Test User',
            'email' => 'test@example.com',
            'password' => bcrypt('password'),
        ]);

        // Create test product
        $this->product = Product::create([
            'id' => Str::uuid(),
            'company_id' => $this->company->id,
            'name' => 'Test Product',
            'product_number' => 'PROD-0001',
            'price' => 100.00,
            'unit_cost' => 50.00,
            'last_price' => 95.00,
        ]);

        $this->service = new ProductPriceHistoryService();

        $this->actingAs($this->user);
    }

    /** @test */
    public function it_automatically_logs_product_price_changes()
    {
        // Update product price
        $this->product->price = 150.00;
        $this->product->save();

        // Check that price change was logged
        $this->assertDatabaseHas('product_price_histories', [
            'product_id' => $this->product->id,
            'price_type' => ProductPriceHistory::PRICE_TYPE_SELLING_PRICE,
            'old_value' => 100.00,
            'new_value' => 150.00,
            'change_amount' => 50.00,
        ]);

        $history = ProductPriceHistory::where('product_id', $this->product->id)->first();
        $this->assertEquals(50.00, $history->change_percentage);
    }

    /** @test */
    public function it_automatically_logs_product_unit_cost_changes()
    {
        $this->product->unit_cost = 75.00;
        $this->product->save();

        $this->assertDatabaseHas('product_price_histories', [
            'product_id' => $this->product->id,
            'price_type' => ProductPriceHistory::PRICE_TYPE_UNIT_COST,
            'old_value' => 50.00,
            'new_value' => 75.00,
            'change_amount' => 25.00,
        ]);
    }

    /** @test */
    public function it_automatically_logs_product_last_price_changes()
    {
        $this->product->last_price = 120.00;
        $this->product->save();

        $this->assertDatabaseHas('product_price_histories', [
            'product_id' => $this->product->id,
            'price_type' => ProductPriceHistory::PRICE_TYPE_LAST_PRICE,
            'old_value' => 95.00,
            'new_value' => 120.00,
        ]);
    }

    /** @test */
    public function it_does_not_log_when_price_does_not_change()
    {
        $initialCount = ProductPriceHistory::count();

        // Update without changing price
        $this->product->name = 'Updated Name';
        $this->product->save();

        $this->assertEquals($initialCount, ProductPriceHistory::count());
    }

    /** @test */
    public function it_automatically_logs_variant_price_changes()
    {
        $variant = ProductVariant::create([
            'id' => Str::uuid(),
            'product_id' => $this->product->id,
            'company_id' => $this->company->id,
            'name' => 'Test Variant',
            'price' => 120.00,
            'cost' => 60.00,
        ]);

        // Update variant price
        $variant->price = 180.00;
        $variant->save();

        $this->assertDatabaseHas('product_price_histories', [
            'variant_id' => $variant->id,
            'price_type' => ProductPriceHistory::PRICE_TYPE_SELLING_PRICE,
            'old_value' => 120.00,
            'new_value' => 180.00,
            'change_amount' => 60.00,
        ]);
    }

    /** @test */
    public function it_automatically_logs_variant_cost_changes()
    {
        $variant = ProductVariant::create([
            'id' => Str::uuid(),
            'product_id' => $this->product->id,
            'company_id' => $this->company->id,
            'name' => 'Test Variant',
            'price' => 120.00,
            'cost' => 60.00,
        ]);

        $variant->cost = 80.00;
        $variant->save();

        $this->assertDatabaseHas('product_price_histories', [
            'variant_id' => $variant->id,
            'price_type' => ProductPriceHistory::PRICE_TYPE_COST,
            'old_value' => 60.00,
            'new_value' => 80.00,
        ]);
    }

    /** @test */
    public function it_automatically_logs_packaging_unit_price_changes()
    {
        $packagingUnit = ProductPackagingUnit::create([
            'id' => Str::uuid(),
            'product_id' => $this->product->id,
            'company_id' => $this->company->id,
            'unit_name' => 'Box',
            'unit_abbreviation' => 'BX',
            'is_base_unit' => true,
            'base_unit_quantity' => 1,
            'price_per_unit' => 100.00,
            'cost_per_unit' => 50.00,
        ]);

        $packagingUnit->price_per_unit = 125.00;
        $packagingUnit->save();

        $this->assertDatabaseHas('product_price_histories', [
            'packaging_unit_id' => $packagingUnit->id,
            'price_type' => ProductPriceHistory::PRICE_TYPE_PRICE_PER_UNIT,
            'old_value' => 100.00,
            'new_value' => 125.00,
        ]);
    }

    /** @test */
    public function it_can_manually_log_price_changes()
    {
        $history = $this->service->logProductPriceChange(
            $this->product,
            ProductPriceHistory::PRICE_TYPE_SELLING_PRICE,
            100.00,
            150.00,
            [
                'change_reason' => 'Seasonal promotion',
                'source' => ProductPriceHistory::SOURCE_MANUAL_UPDATE,
            ]
        );

        $this->assertNotNull($history);
        $this->assertEquals('Seasonal promotion', $history->change_reason);
        $this->assertEquals(ProductPriceHistory::SOURCE_MANUAL_UPDATE, $history->source);
        $this->assertEquals(50.00, $history->change_amount);
        $this->assertEquals(50.00, $history->change_percentage);
    }

    /** @test */
    public function it_calculates_change_percentage_correctly()
    {
        $history = $this->service->logProductPriceChange(
            $this->product,
            ProductPriceHistory::PRICE_TYPE_SELLING_PRICE,
            100.00,
            120.00
        );

        $this->assertEquals(20.00, $history->change_amount);
        $this->assertEquals(20.00, $history->change_percentage);
    }

    /** @test */
    public function it_handles_price_decreases()
    {
        $history = $this->service->logProductPriceChange(
            $this->product,
            ProductPriceHistory::PRICE_TYPE_SELLING_PRICE,
            100.00,
            80.00
        );

        $this->assertEquals(-20.00, $history->change_amount);
        $this->assertEquals(-20.00, $history->change_percentage);
        $this->assertTrue($history->isPriceDecrease());
        $this->assertFalse($history->isPriceIncrease());
    }

    /** @test */
    public function it_retrieves_product_price_history()
    {
        // Create some history
        $this->service->logProductPriceChange($this->product, 'selling_price', 100.00, 110.00);
        $this->service->logProductPriceChange($this->product, 'selling_price', 110.00, 120.00);
        $this->service->logProductPriceChange($this->product, 'unit_cost', 50.00, 55.00);

        $history = $this->service->getProductPriceHistory($this->product);

        $this->assertCount(3, $history);
    }

    /** @test */
    public function it_filters_price_history_by_type()
    {
        $this->service->logProductPriceChange($this->product, 'selling_price', 100.00, 110.00);
        $this->service->logProductPriceChange($this->product, 'unit_cost', 50.00, 55.00);

        $history = $this->service->getProductPriceHistory($this->product, [
            'price_type' => 'selling_price'
        ]);

        $this->assertCount(1, $history);
        $this->assertEquals('selling_price', $history->first()->price_type);
    }

    /** @test */
    public function it_filters_price_history_by_date()
    {
        // Create old history
        ProductPriceHistory::create([
            'id' => Str::uuid(),
            'company_id' => $this->company->id,
            'product_id' => $this->product->id,
            'price_type' => 'selling_price',
            'old_value' => 90.00,
            'new_value' => 100.00,
            'change_amount' => 10.00,
            'change_percentage' => 11.11,
            'created_at' => now()->subDays(60),
        ]);

        // Create recent history
        $this->service->logProductPriceChange($this->product, 'selling_price', 100.00, 110.00);

        $history = $this->service->getProductPriceHistory($this->product, [
            'start_date' => now()->subDays(30)
        ]);

        $this->assertCount(1, $history);
    }

    /** @test */
    public function it_filters_price_increases()
    {
        $this->service->logProductPriceChange($this->product, 'selling_price', 100.00, 120.00);
        $this->service->logProductPriceChange($this->product, 'selling_price', 120.00, 110.00);

        $increases = ProductPriceHistory::forProduct($this->product->id)
            ->priceIncreases()
            ->get();

        $this->assertCount(1, $increases);
        $this->assertTrue($increases->first()->isPriceIncrease());
    }

    /** @test */
    public function it_filters_price_decreases()
    {
        $this->service->logProductPriceChange($this->product, 'selling_price', 100.00, 120.00);
        $this->service->logProductPriceChange($this->product, 'selling_price', 120.00, 110.00);

        $decreases = ProductPriceHistory::forProduct($this->product->id)
            ->priceDecreases()
            ->get();

        $this->assertCount(1, $decreases);
        $this->assertTrue($decreases->first()->isPriceDecrease());
    }

    /** @test */
    public function it_generates_price_changes_summary()
    {
        // Create various price changes
        $this->service->logProductPriceChange($this->product, 'selling_price', 100.00, 120.00);
        $this->service->logProductPriceChange($this->product, 'selling_price', 120.00, 110.00);
        $this->service->logProductPriceChange($this->product, 'unit_cost', 50.00, 60.00);

        $summary = $this->service->getPriceChangesSummary($this->company->id, 30);

        $this->assertEquals(3, $summary['total_changes']);
        $this->assertEquals(2, $summary['price_increases']);
        $this->assertEquals(1, $summary['price_decreases']);
        $this->assertArrayHasKey('changes_by_type', $summary);
        $this->assertEquals(2, $summary['changes_by_type']['selling_price']);
        $this->assertEquals(1, $summary['changes_by_type']['unit_cost']);
    }

    /** @test */
    public function it_performs_bulk_logging()
    {
        $changes = [
            [
                'company_id' => $this->company->id,
                'product_id' => $this->product->id,
                'price_type' => 'selling_price',
                'old_value' => 100.00,
                'new_value' => 120.00,
            ],
            [
                'company_id' => $this->company->id,
                'product_id' => $this->product->id,
                'price_type' => 'unit_cost',
                'old_value' => 50.00,
                'new_value' => 55.00,
            ],
        ];

        $count = $this->service->bulkLogPriceChanges($changes, [
            'source' => ProductPriceHistory::SOURCE_BULK_IMPORT,
        ]);

        $this->assertEquals(2, $count);
        $this->assertDatabaseHas('product_price_histories', [
            'source' => ProductPriceHistory::SOURCE_BULK_IMPORT,
        ]);
    }

    /** @test */
    public function it_accesses_price_history_via_product_relationship()
    {
        $this->service->logProductPriceChange($this->product, 'selling_price', 100.00, 120.00);
        
        $product = Product::with('priceHistory')->find($this->product->id);
        
        $this->assertNotNull($product->priceHistory);
        $this->assertCount(1, $product->priceHistory);
    }

    /** @test */
    public function it_accesses_all_price_history_via_product_relationship()
    {
        // Create variant
        $variant = ProductVariant::create([
            'id' => Str::uuid(),
            'product_id' => $this->product->id,
            'company_id' => $this->company->id,
            'name' => 'Test Variant',
            'price' => 120.00,
        ]);

        // Log product and variant changes
        $this->service->logProductPriceChange($this->product, 'selling_price', 100.00, 120.00);
        $this->service->logVariantPriceChange($variant, 'selling_price', 120.00, 140.00);

        $product = Product::with('allPriceHistory')->find($this->product->id);
        
        $this->assertCount(2, $product->allPriceHistory);
    }

    /** @test */
    public function it_formats_change_values_correctly()
    {
        $history = $this->service->logProductPriceChange(
            $this->product,
            'selling_price',
            100.00,
            125.50
        );

        $this->assertEquals('+25.50', $history->getFormattedChange());
        $this->assertEquals('+25.50%', $history->getFormattedPercentageChange());
    }

    /** @test */
    public function it_formats_negative_changes_correctly()
    {
        $history = $this->service->logProductPriceChange(
            $this->product,
            'selling_price',
            100.00,
            85.00
        );

        $this->assertEquals('-15.00', $history->getFormattedChange());
        $this->assertEquals('-15.00%', $history->getFormattedPercentageChange());
    }

    /** @test */
    public function it_gets_price_type_label()
    {
        $history = $this->service->logProductPriceChange(
            $this->product,
            ProductPriceHistory::PRICE_TYPE_SELLING_PRICE,
            100.00,
            120.00
        );

        $this->assertEquals('Selling Price', $history->getPriceTypeLabel());
    }

    /** @test */
    public function it_gets_entity_type_name()
    {
        $productHistory = $this->service->logProductPriceChange(
            $this->product,
            'selling_price',
            100.00,
            120.00
        );

        $this->assertEquals('Product', $productHistory->getEntityTypeName());

        $variant = ProductVariant::create([
            'id' => Str::uuid(),
            'product_id' => $this->product->id,
            'company_id' => $this->company->id,
            'name' => 'Test Variant',
            'price' => 120.00,
        ]);

        $variantHistory = $this->service->logVariantPriceChange(
            $variant,
            'selling_price',
            120.00,
            140.00
        );

        $this->assertEquals('Product Variant', $variantHistory->getEntityTypeName());
    }

    /** @test */
    public function it_tracks_changed_by_user()
    {
        $this->product->price = 150.00;
        $this->product->save();

        $history = ProductPriceHistory::where('product_id', $this->product->id)->first();

        $this->assertEquals($this->user->id, $history->changed_by);
        $this->assertNotNull($history->changedBy);
        $this->assertEquals($this->user->name, $history->changedBy->name);
    }

    /** @test */
    public function it_uses_recent_scope()
    {
        // Create old history
        ProductPriceHistory::create([
            'id' => Str::uuid(),
            'company_id' => $this->company->id,
            'product_id' => $this->product->id,
            'price_type' => 'selling_price',
            'old_value' => 90.00,
            'new_value' => 100.00,
            'change_amount' => 10.00,
            'created_at' => now()->subDays(60),
        ]);

        // Create recent history
        $this->service->logProductPriceChange($this->product, 'selling_price', 100.00, 110.00);

        $recent = ProductPriceHistory::recent(30)->get();

        $this->assertCount(1, $recent);
    }

    /** @test */
    public function it_stores_metadata()
    {
        $history = $this->service->logProductPriceChange(
            $this->product,
            'selling_price',
            100.00,
            120.00,
            [
                'metadata' => [
                    'promotion_id' => '123',
                    'discount_percentage' => 15,
                ]
            ]
        );

        $this->assertIsArray($history->metadata);
        $this->assertEquals('123', $history->metadata['promotion_id']);
        $this->assertEquals(15, $history->metadata['discount_percentage']);
    }

    /** @test */
    public function it_handles_null_old_value()
    {
        $history = $this->service->logProductPriceChange(
            $this->product,
            'selling_price',
            null,
            100.00
        );

        $this->assertNull($history->old_value);
        $this->assertEquals(100.00, $history->new_value);
        $this->assertNull($history->change_amount);
        $this->assertNull($history->change_percentage);
    }

    /** @test */
    public function it_skips_logging_when_values_are_same()
    {
        $initialCount = ProductPriceHistory::count();

        $history = $this->service->logProductPriceChange(
            $this->product,
            'selling_price',
            100.00,
            100.00
        );

        $this->assertNull($history);
        $this->assertEquals($initialCount, ProductPriceHistory::count());
    }

    /** @test */
    public function product_price_history_relationship_works()
    {
        $variant = ProductVariant::create([
            'id' => Str::uuid(),
            'product_id' => $this->product->id,
            'company_id' => $this->company->id,
            'name' => 'Test Variant',
            'price' => 120.00,
        ]);

        $variant->price = 150.00;
        $variant->save();

        $variant = ProductVariant::with('priceHistory')->find($variant->id);

        $this->assertNotNull($variant->priceHistory);
        $this->assertCount(1, $variant->priceHistory);
    }

    /** @test */
    public function packaging_unit_price_history_relationship_works()
    {
        $packagingUnit = ProductPackagingUnit::create([
            'id' => Str::uuid(),
            'product_id' => $this->product->id,
            'company_id' => $this->company->id,
            'unit_name' => 'Box',
            'unit_abbreviation' => 'BX',
            'is_base_unit' => true,
            'base_unit_quantity' => 1,
            'price_per_unit' => 100.00,
        ]);

        $packagingUnit->price_per_unit = 125.00;
        $packagingUnit->save();

        $packagingUnit = ProductPackagingUnit::with('priceHistory')->find($packagingUnit->id);

        $this->assertNotNull($packagingUnit->priceHistory);
        $this->assertCount(1, $packagingUnit->priceHistory);
    }
}
