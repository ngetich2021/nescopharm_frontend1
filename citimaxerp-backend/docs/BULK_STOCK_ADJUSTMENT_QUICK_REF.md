# Bulk Stock Adjustment - Quick Reference

## Endpoint
```
POST /api/stock-adjustments/bulk
```

## Quick Start

### Minimal Request
```json
{
  "adjustments": [
    {
      "product_id": "product-uuid",
      "adjustment_type": "decrease",
      "reason_type": "damage",
      "quantity_adjusted": 10,
      "reason": "Damaged during transport"
    }
  ]
}
```

### With Product Variant
```json
{
  "adjustments": [
    {
      "product_id": "product-uuid",
      "variant_id": "variant-uuid",
      "adjustment_type": "set",
      "reason_type": "recount",
      "quantity_adjusted": 50,
      "reason": "Physical inventory count"
    }
  ]
}
```

## Adjustment Types

| Type | Description | Example |
|------|-------------|---------|
| `increase` | Add to stock | Current: 100 → Adjust: +50 → Result: 150 |
| `decrease` | Subtract from stock | Current: 100 → Adjust: -20 → Result: 80 |
| `set` | Set to exact amount | Current: 100 → Set: 75 → Result: 75 |

## Reason Types

| Type | Use Case |
|------|----------|
| `damage` | Damaged/broken items |
| `expiry` | Expired products |
| `theft` | Stolen inventory |
| `loss` | Lost/missing items |
| `found` | Found items |
| `recount` | Physical count corrections |
| `correction` | Error corrections |
| `return` | Customer returns |
| `donation` | Donated items |
| `sample` | Product samples |
| `write_off` | Write-offs |
| `other` | Other reasons |

## Response Structure

```json
{
  "status": "completed|partial|failed",
  "message": "Bulk operation completed: X successful, Y failed",
  "summary": {
    "total": 5,
    "successful": 4,
    "failed": 1
  },
  "results": [
    {
      "status": "success",
      "index": 0,
      "message": "Stock adjustment created successfully",
      "data": { /* adjustment object */ }
    },
    {
      "status": "failed",
      "index": 1,
      "errors": { /* error details */ },
      "input": { /* original input */ }
    }
  ]
}
```

## Common Use Cases

### 1. Multiple Damaged Items
```json
{
  "adjustments": [
    {"product_id": "p1", "adjustment_type": "decrease", "reason_type": "damage", "quantity_adjusted": 5, "reason": "Water damage"},
    {"product_id": "p2", "adjustment_type": "decrease", "reason_type": "damage", "quantity_adjusted": 3, "reason": "Water damage"},
    {"product_id": "p3", "adjustment_type": "decrease", "reason_type": "damage", "quantity_adjusted": 2, "reason": "Water damage"}
  ]
}
```

### 2. Physical Count - Multiple Variants
```json
{
  "adjustments": [
    {"product_id": "p1", "variant_id": "v1", "adjustment_type": "set", "reason_type": "recount", "quantity_adjusted": 45, "reason": "Count - Small"},
    {"product_id": "p1", "variant_id": "v2", "adjustment_type": "set", "reason_type": "recount", "quantity_adjusted": 67, "reason": "Count - Medium"},
    {"product_id": "p1", "variant_id": "v3", "adjustment_type": "set", "reason_type": "recount", "quantity_adjusted": 52, "reason": "Count - Large"}
  ]
}
```

### 3. Found Items
```json
{
  "adjustments": [
    {"product_id": "p1", "adjustment_type": "increase", "reason_type": "found", "quantity_adjusted": 10, "reason": "Found in back storage"},
    {"product_id": "p2", "adjustment_type": "increase", "reason_type": "found", "quantity_adjusted": 5, "reason": "Found in back storage"}
  ]
}
```

## Field Reference

### Required
- `adjustments` (array, min 1)
- `adjustments.*.product_id` (uuid)
- `adjustments.*.adjustment_type` (increase|decrease|set)
- `adjustments.*.reason_type` (damage|expiry|theft|loss|found|recount|correction|return|donation|sample|write_off|other)
- `adjustments.*.quantity_adjusted` (integer)
- `adjustments.*.reason` (string, max 500 chars)

### Optional
- `adjustments.*.variant_id` (uuid)
- `adjustments.*.batch_id` (uuid)
- `adjustments.*.unit_id` (uuid)
- `adjustments.*.store_id` (uuid)
- `adjustments.*.notes` (string)
- `adjustments.*.unit_cost` (decimal)
- `adjustments.*.unit_price` (decimal)
- `adjustments.*.status` (draft|pending)
- `adjustments.*.attachments` (array of URLs)
- `adjustments.*.metadata` (object)

## Workflow

1. **Create** → `POST /api/stock-adjustments/bulk`
2. **Review** → Check response results
3. **Update** (if needed) → `PATCH /api/stock-adjustments/{id}`
4. **Approve** → `POST /api/stock-adjustments/{id}/approve`
5. **Apply** → `POST /api/stock-adjustments/{id}/apply`

## Error Handling

### Check Response Status
```javascript
if (result.status === 'completed') {
  // All succeeded
} else if (result.status === 'partial') {
  // Some failed - check result.results
} else {
  // All failed
}
```

### Common Errors
- **Product not found**: Invalid product_id or product not in your company
- **Negative stock**: Adjustment would make stock negative
- **Invalid variant**: Variant doesn't exist or doesn't belong to product
- **Validation error**: Missing required fields or invalid values

## Performance Tips

- **Batch size**: 10-50 adjustments per request (recommended)
- **Timeout**: Split large operations into multiple requests
- **Status**: Use `draft` for review, `pending` for approval workflow

## Permissions

- Requires: `can_update_products`
- Optional: `can_approve_adjustments` (for approval)

## Activity Logging

Each successful adjustment automatically logs:
- Action: `stock_adjustment_created`
- User information
- Product details
- Quantity changes
- `bulk_operation: true` flag

## Files

- **Documentation**: `/docs/BULK_STOCK_ADJUSTMENT_GUIDE.md`
- **Test Script**: `/test_bulk_stock_adjustment.php`
- **Postman Collection**: `/docs/Bulk_Stock_Adjustment.postman_collection.json`
- **Controller**: `/app/Http/Controllers/StockAdjustmentController.php`

## Related Endpoints

- `GET /api/stock-adjustments` - List all adjustments
- `GET /api/stock-adjustments/{id}` - Get single adjustment
- `PATCH /api/stock-adjustments/{id}` - Update adjustment
- `POST /api/stock-adjustments/{id}/approve` - Approve
- `POST /api/stock-adjustments/{id}/reject` - Reject
- `POST /api/stock-adjustments/{id}/apply` - Apply to inventory
- `DELETE /api/stock-adjustments/{id}` - Delete draft
- `GET /api/stock-adjustments/statistics` - Get statistics
- `GET /api/stock-adjustments/activities` - Get activity logs

## Support

For detailed documentation, see: `/docs/BULK_STOCK_ADJUSTMENT_GUIDE.md`
