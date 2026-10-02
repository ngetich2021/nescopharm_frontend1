# Product Pricing History Tracking System

## Overview

The Product Pricing History system provides comprehensive tracking of all pricing changes across your products, variants, packaging units, and receipt items. This system automatically logs price changes and provides detailed analytics and reporting capabilities.

## Features

- ✅ Automatic tracking of all price changes
- ✅ Track changes for Products, Variants, Packaging Units, and Receipt Items
- ✅ Calculate change amounts and percentages
- ✅ Track who made the change and when
- ✅ Support for different price types (selling price, cost, unit cost, etc.)
- ✅ Track the source of changes (manual, API, receipt, bulk import)
- ✅ Comprehensive filtering and reporting
- ✅ Price increase/decrease analytics

## Database Schema

The `product_price_histories` table tracks:

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `company_id` | UUID | Company reference |
| `product_id` | UUID | Product reference (nullable) |
| `variant_id` | UUID | Variant reference (nullable) |
| `packaging_unit_id` | UUID | Packaging unit reference (nullable) |
| `receipt_item_id` | UUID | Receipt item reference (nullable) |
| `price_type` | String | Type of price (selling_price, cost, unit_cost, etc.) |
| `old_value` | Decimal | Previous price value |
| `new_value` | Decimal | New price value |
| `change_amount` | Decimal | Calculated change amount |
| `change_percentage` | Decimal | Calculated percentage change |
| `changed_by` | UUID | User who made the change |
| `change_reason` | Text | Optional reason for the change |
| `source` | String | Source of change (manual_update, receipt, api, etc.) |
| `source_reference` | String | Reference to source (e.g., receipt number) |
| `metadata` | JSON | Additional metadata |
| `created_at` | Timestamp | When the change occurred |

## Price Types

The system tracks different types of prices:

- `selling_price` - Main product/variant selling price
- `cost` - Product/variant cost
- `unit_cost` - Product unit cost
- `last_price` - Product last price
- `unit_price` - Receipt item unit price
- `price_per_unit` - Packaging unit price
- `cost_per_unit` - Packaging unit cost

## Automatic Tracking

Price changes are automatically tracked through model observers when you update:

### Product Pricing
```php
$product = Product::find($productId);
$product->price = 150.00;  // Old: 120.00
$product->save();
// Automatically logs the price change
```

### Variant Pricing
```php
$variant = ProductVariant::find($variantId);
$variant->price = 175.00;
$variant->cost = 120.00;
$variant->save();
// Automatically logs both price and cost changes
```

### Packaging Unit Pricing
```php
$packagingUnit = ProductPackagingUnit::find($unitId);
$packagingUnit->price_per_unit = 50.00;
$packagingUnit->cost_per_unit = 35.00;
$packagingUnit->save();
// Automatically logs both changes
```

### Receipt Item Pricing
```php
$receiptItem = ProductReceiptItem::find($itemId);
$receiptItem->unit_price = 95.00;
$receiptItem->save();
// Automatically logs the receipt price change
```

## Manual Logging

You can also manually log price changes using the service:

```php
use App\Services\ProductPriceHistoryService;

$service = app(ProductPriceHistoryService::class);

// Log a product price change
$service->logProductPriceChange(
    $product,
    'selling_price',
    $oldPrice,
    $newPrice,
    [
        'change_reason' => 'Seasonal promotion',
        'source' => 'manual_update',
        'metadata' => [
            'promotion_id' => '123',
            'discount_percentage' => 15
        ]
    ]
);

// Log a variant price change
$service->logVariantPriceChange(
    $variant,
    'selling_price',
    $oldPrice,
    $newPrice,
    ['change_reason' => 'Market adjustment']
);

// Log a packaging unit price change
$service->logPackagingUnitPriceChange(
    $packagingUnit,
    'price_per_unit',
    $oldPrice,
    $newPrice
);
```

## Bulk Logging

For bulk imports or migrations:

```php
$changes = [
    [
        'company_id' => $companyId,
        'product_id' => $productId1,
        'price_type' => 'selling_price',
        'old_value' => 100.00,
        'new_value' => 120.00,
    ],
    [
        'company_id' => $companyId,
        'product_id' => $productId2,
        'price_type' => 'selling_price',
        'old_value' => 50.00,
        'new_value' => 55.00,
    ],
];

$count = $service->bulkLogPriceChanges($changes, [
    'source' => 'bulk_import',
    'change_reason' => 'Annual price adjustment'
]);
```

## Retrieving Price History

### Get Product Price History
```php
// Using the relationship
$product = Product::with('priceHistory')->find($productId);
$history = $product->priceHistory;

// Get all history including variants and packaging units
$allHistory = $product->allPriceHistory;

// Using the service
$service = app(ProductPriceHistoryService::class);
$history = $service->getProductPriceHistory($product, [
    'price_type' => 'selling_price',
    'start_date' => now()->subDays(30),
    'increases_only' => true
]);
```

### Get Variant Price History
```php
$variant = ProductVariant::with('priceHistory')->find($variantId);
$history = $variant->priceHistory;

// Or with filters
$history = $service->getVariantPriceHistory($variant, [
    'price_type' => 'cost',
    'decreases_only' => true
]);
```

### Get Packaging Unit Price History
```php
$packagingUnit = ProductPackagingUnit::with('priceHistory')->find($unitId);
$history = $packagingUnit->priceHistory;
```

### Get Company-Wide Price Changes
```php
$priceChanges = $service->getCompanyPriceChanges(
    $companyId,
    now()->subDays(30),  // start date
    now(),               // end date
    [
        'price_type' => 'selling_price',
        'source' => 'api'
    ]
);
```

## Analytics and Reporting

### Get Price Changes Summary
```php
$summary = $service->getPriceChangesSummary($companyId, 30);

// Returns:
[
    'period_days' => 30,
    'total_changes' => 150,
    'price_increases' => 90,
    'price_decreases' => 60,
    'average_change_percentage' => 5.25,
    'changes_by_type' => [
        'selling_price' => 100,
        'cost' => 30,
        'unit_cost' => 20
    ]
]
```

### Using Scopes for Queries
```php
use App\Models\ProductPriceHistory;

// Recent price increases
$increases = ProductPriceHistory::forProduct($productId)
    ->recent(7)
    ->priceIncreases()
    ->get();

// Price decreases by type
$decreases = ProductPriceHistory::byPriceType('selling_price')
    ->priceDecreases()
    ->orderBy('change_percentage', 'asc')
    ->get();

// Changes from specific source
$receiptChanges = ProductPriceHistory::bySource('receipt')
    ->recent(30)
    ->with(['product', 'receiptItem'])
    ->get();
```

## API Endpoints (Example)

You can create controllers to expose this data via API:

```php
// Get product price history
GET /api/products/{id}/price-history
GET /api/products/{id}/price-history?price_type=selling_price&days=30

// Get variant price history
GET /api/variants/{id}/price-history

// Get company price changes summary
GET /api/companies/{id}/price-changes/summary?days=30

// Get company price changes
GET /api/companies/{id}/price-changes?start_date=2025-01-01&end_date=2025-01-31
```

## Best Practices

1. **Use Automatic Tracking**: Let the observers handle most price change logging automatically.

2. **Add Context**: When manually logging, include `change_reason` and relevant `metadata` to provide context for future reference.

3. **Filter Wisely**: Use the provided scopes and filters to efficiently query historical data.

4. **Regular Analysis**: Use the summary statistics to monitor pricing trends and make informed business decisions.

5. **Audit Trail**: The system provides a complete audit trail of who changed prices and when, which is crucial for compliance and accountability.

## Helper Methods

### Format Price Changes
```php
$history = ProductPriceHistory::first();

// Get formatted change with sign
$formattedChange = $history->getFormattedChange();  // e.g., "+25.00" or "-10.50"

// Get formatted percentage change
$percentageChange = $history->getFormattedPercentageChange();  // e.g., "+20.83%"

// Check change direction
if ($history->isPriceIncrease()) {
    // Handle price increase
}

if ($history->isPriceDecrease()) {
    // Handle price decrease
}

// Get the changed entity
$entity = $history->getChangedEntity();  // Returns Product, Variant, or PackagingUnit

// Get entity type name
$entityType = $history->getEntityTypeName();  // "Product", "Variant", or "Packaging Unit"
```

## Migration

To set up the pricing history system:

```bash
# Run the migration
php artisan migrate

# The observers are automatically registered in AppServiceProvider
# No additional setup required
```

## Example Use Cases

### 1. Price Audit Report
```php
// Get all price changes for a product in the last month
$product = Product::find($productId);
$changes = $product->allPriceHistory()
    ->where('created_at', '>=', now()->subDays(30))
    ->with('changedBy')
    ->get();

foreach ($changes as $change) {
    echo sprintf(
        "%s changed %s from $%s to $%s (%s) on %s\n",
        $change->changedBy->name,
        $change->getPriceTypeLabel(),
        $change->old_value,
        $change->new_value,
        $change->getFormattedPercentageChange(),
        $change->created_at->format('Y-m-d H:i:s')
    );
}
```

### 2. Track Cost Fluctuations
```php
// Find products with frequent cost changes
$products = Product::whereHas('priceHistory', function($query) {
    $query->where('price_type', 'unit_cost')
          ->where('created_at', '>=', now()->subDays(30));
}, '>=', 3)->get();
```

### 3. Receipt Price Tracking
```php
// Track all pricing from receipts
$receiptPrices = ProductPriceHistory::bySource('receipt')
    ->with(['product', 'receiptItem.productReceipt'])
    ->recent(30)
    ->get();
```

## Support

For questions or issues with the pricing history system, refer to:
- Model: `App\Models\ProductPriceHistory`
- Service: `App\Services\ProductPriceHistoryService`
- Observers: `App\Observers\*PriceObserver`
