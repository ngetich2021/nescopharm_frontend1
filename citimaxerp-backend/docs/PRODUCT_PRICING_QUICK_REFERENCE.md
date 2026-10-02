# Product Pricing Tracking - Quick Reference

## 🚀 Quick Start

### 1. Run Migration
```bash
php artisan migrate
```

### 2. That's It!
Price tracking is now automatic. Every time you update a product, variant, or packaging unit price, it's logged automatically.

## 📊 Common Queries

### Get Product Price History
```php
$product = Product::find($id);
$history = $product->priceHistory;
```

### Get Recent Price Increases
```php
use App\Models\ProductPriceHistory;

$increases = ProductPriceHistory::recent(7)
    ->priceIncreases()
    ->get();
```

### Get Summary Statistics
```php
$service = app(\App\Services\ProductPriceHistoryService::class);
$summary = $service->getPriceChangesSummary($companyId, 30);
```

## 🔍 Filtering Examples

### Filter by Price Type
```php
$history = ProductPriceHistory::forProduct($productId)
    ->byPriceType('selling_price')
    ->get();
```

### Filter by Date Range
```php
$history = ProductPriceHistory::forProduct($productId)
    ->where('created_at', '>=', now()->subDays(30))
    ->get();
```

### Filter by Source
```php
$receiptChanges = ProductPriceHistory::bySource('receipt')
    ->recent(30)
    ->get();
```

## 📈 Available Scopes

| Scope | Usage | Description |
|-------|-------|-------------|
| `forProduct($id)` | `->forProduct($productId)` | Filter by product |
| `forVariant($id)` | `->forVariant($variantId)` | Filter by variant |
| `forPackagingUnit($id)` | `->forPackagingUnit($unitId)` | Filter by packaging unit |
| `byPriceType($type)` | `->byPriceType('cost')` | Filter by price type |
| `bySource($source)` | `->bySource('api')` | Filter by source |
| `recent($days)` | `->recent(7)` | Last N days |
| `priceIncreases()` | `->priceIncreases()` | Only increases |
| `priceDecreases()` | `->priceDecreases()` | Only decreases |

## 💰 Price Types

- `selling_price` - Product/variant selling price
- `cost` - Variant cost
- `unit_cost` - Product unit cost
- `last_price` - Product last price
- `unit_price` - Receipt item unit price
- `price_per_unit` - Packaging unit price
- `cost_per_unit` - Packaging unit cost

## 🎯 Change Sources

- `manual_update` - Manual UI changes
- `api` - API endpoint changes
- `receipt` - From product receipts
- `bulk_import` - Bulk operations
- `system` - System changes

## 🛠️ Service Methods

### Log Changes Manually
```php
$service = app(\App\Services\ProductPriceHistoryService::class);

// Product
$service->logProductPriceChange($product, 'selling_price', $old, $new);

// Variant
$service->logVariantPriceChange($variant, 'price', $old, $new);

// Packaging Unit
$service->logPackagingUnitPriceChange($unit, 'price_per_unit', $old, $new);
```

### Get History
```php
// Product history
$service->getProductPriceHistory($product, ['days' => 30]);

// Variant history
$service->getVariantPriceHistory($variant);

// Company-wide changes
$service->getCompanyPriceChanges($companyId, $startDate, $endDate);
```

### Bulk Operations
```php
$changes = [
    [
        'company_id' => $companyId,
        'product_id' => $productId,
        'price_type' => 'selling_price',
        'old_value' => 100.00,
        'new_value' => 120.00,
    ],
    // ... more changes
];

$count = $service->bulkLogPriceChanges($changes);
```

## 📱 API Endpoints (If Configured)

```
GET /api/products/{id}/price-history
GET /api/products/{id}/price-history/all
GET /api/variants/{id}/price-history
GET /api/packaging-units/{id}/price-history
GET /api/companies/{id}/price-changes
GET /api/companies/{id}/price-changes/summary
```

### Query Parameters
- `?days=30` - Last 30 days
- `?price_type=selling_price` - Filter by type
- `?source=receipt` - Filter by source
- `?increases_only=true` - Only increases
- `?decreases_only=true` - Only decreases
- `?start_date=2025-01-01` - Start date
- `?end_date=2025-01-31` - End date

## 🔧 Helper Methods

```php
$change = ProductPriceHistory::first();

// Formatting
$change->getFormattedChange();              // "+25.00"
$change->getFormattedPercentageChange();    // "+20.83%"
$change->getPriceTypeLabel();               // "Selling Price"

// Checks
$change->isPriceIncrease();                 // true/false
$change->isPriceDecrease();                 // true/false

// Related entities
$change->getChangedEntity();                // Product/Variant/PackagingUnit
$change->getEntityTypeName();               // "Product", "Variant", etc.
```

## 📊 Example Reports

### Price Audit Report
```php
$product = Product::find($id);
$changes = $product->priceHistory()
    ->with('changedBy')
    ->where('created_at', '>=', now()->subMonth())
    ->get();

foreach ($changes as $change) {
    echo sprintf(
        "%s: %s changed from $%s to $%s (%s) by %s\n",
        $change->created_at->format('Y-m-d'),
        $change->getPriceTypeLabel(),
        $change->old_value,
        $change->new_value,
        $change->getFormattedPercentageChange(),
        $change->changedBy->name
    );
}
```

### Most Changed Products
```php
$products = Product::withCount([
    'allPriceHistory as recent_changes' => function($q) {
        $q->where('created_at', '>=', now()->subDays(30));
    }
])
->having('recent_changes', '>', 0)
->orderBy('recent_changes', 'desc')
->limit(10)
->get();
```

### Price Volatility Alert
```php
$volatileProducts = Product::whereHas('priceHistory', function($q) {
    $q->where('created_at', '>=', now()->subDays(7));
}, '>=', 3)->get();
```

## 📖 Full Documentation

See `docs/PRODUCT_PRICING_HISTORY.md` for complete documentation.

## ⚡ Performance Tips

1. Use scopes for filtering instead of `where()` when possible
2. Eager load relationships with `with()`
3. Use `recent()` scope to limit date ranges
4. Index on `created_at` is optimized for time-based queries

## 🐛 Troubleshooting

**No history being recorded?**
- Check AppServiceProvider has observers registered
- Verify migration was run
- Ensure you're actually changing the price value

**Too many records?**
- Observers only log when values actually change
- Use `recent()` scope to limit queries

**Need custom tracking?**
- Use the service class directly
- Add custom metadata in the options array

---

For detailed examples and advanced usage, see: `docs/PRODUCT_PRICING_HISTORY.md`
