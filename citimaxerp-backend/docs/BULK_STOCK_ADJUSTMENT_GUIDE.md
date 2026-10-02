# Bulk Stock Adjustment Guide

## Overview
The bulk stock adjustment feature allows you to adjust stock levels for multiple products and product variants in a single API request. This is useful for:
- End-of-day inventory adjustments
- Batch corrections after physical inventory counts
- Processing multiple damage/loss reports at once
- Applying adjustments across multiple product variants simultaneously

## API Endpoint

```
POST /api/stock-adjustments/bulk
```

## Authentication
Requires authentication token via Bearer token or Sanctum session.

## Permissions
- User must have `can_update_products` permission

## Request Format

### Headers
```
Content-Type: application/json
Authorization: Bearer {your-token}
```

### Request Body Structure

```json
{
  "adjustments": [
    {
      "product_id": "uuid",
      "variant_id": "uuid (optional)",
      "batch_id": "uuid (optional)",
      "unit_id": "uuid (optional)",
      "store_id": "uuid (optional)",
      "adjustment_type": "increase|decrease|set",
      "reason_type": "damage|expiry|theft|loss|found|recount|correction|return|donation|sample|write_off|other",
      "quantity_adjusted": 10,
      "reason": "Reason for adjustment",
      "notes": "Additional notes (optional)",
      "unit_cost": 100.00,
      "unit_price": 150.00,
      "status": "draft|pending",
      "attachments": ["url1", "url2"],
      "metadata": {}
    }
  ]
}
```

## Field Descriptions

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `adjustments` | array | Array of adjustment objects (minimum 1 item) |
| `adjustments.*.product_id` | uuid | Product to adjust |
| `adjustments.*.adjustment_type` | string | Type: `increase`, `decrease`, or `set` |
| `adjustments.*.reason_type` | string | Category: `damage`, `expiry`, `theft`, `loss`, `found`, `recount`, `correction`, `return`, `donation`, `sample`, `write_off`, `other` |
| `adjustments.*.quantity_adjusted` | integer | Amount to adjust |
| `adjustments.*.reason` | string | Detailed reason (max 500 chars) |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `adjustments.*.variant_id` | uuid | Specific product variant |
| `adjustments.*.batch_id` | uuid | Specific inventory batch |
| `adjustments.*.unit_id` | uuid | Specific packaging unit |
| `adjustments.*.store_id` | uuid | Specific store location |
| `adjustments.*.notes` | string | Additional notes |
| `adjustments.*.unit_cost` | decimal | Cost per unit (auto-calculated if not provided) |
| `adjustments.*.unit_price` | decimal | Price per unit (auto-calculated if not provided) |
| `adjustments.*.status` | string | `draft` or `pending` (default: `draft`) |
| `adjustments.*.attachments` | array | Array of URLs to supporting documents |
| `adjustments.*.metadata` | object | Additional custom data |

## Adjustment Types

### 1. Increase
Adds to current stock quantity.

```json
{
  "adjustment_type": "increase",
  "quantity_adjusted": 50
}
```
If current stock is 100, result will be 150.

### 2. Decrease
Subtracts from current stock quantity.

```json
{
  "adjustment_type": "decrease",
  "quantity_adjusted": 20
}
```
If current stock is 100, result will be 80.

### 3. Set
Sets stock to exact quantity.

```json
{
  "adjustment_type": "set",
  "quantity_adjusted": 75
}
```
Regardless of current stock, result will be 75.

## Response Format

### Successful Response (200/201)

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
      "data": {
        "id": "uuid",
        "adjustment_number": "ADJ-12345678-0001",
        "product": {
          "id": "uuid",
          "name": "Product Name",
          "sku": "SKU123"
        },
        "variant": null,
        "store": {
          "id": "uuid",
          "name": "Main Store"
        },
        "adjustment_type": "decrease",
        "reason_type": "damage",
        "quantity_before": 100,
        "quantity_adjusted": -10,
        "quantity_after": 90,
        "unit_cost": 100.00,
        "unit_price": 150.00,
        "total_cost": -1000.00,
        "total_value": -1500.00,
        "status": "draft",
        "reason": "Damaged during transport",
        "notes": null,
        "created_by": {
          "id": "uuid",
          "first_name": "John",
          "last_name": "Doe"
        },
        "created_at": "2025-11-26T10:30:00.000000Z"
      }
    },
    {
      "status": "failed",
      "index": 1,
      "errors": {
        "product_id": ["Product not found or does not belong to your company"]
      },
      "input": {
        "product_id": "invalid-uuid",
        "adjustment_type": "decrease",
        "reason_type": "damage",
        "quantity_adjusted": 5,
        "reason": "Damaged item"
      }
    }
  ]
}
```

### Status Values

- `completed` - All adjustments created successfully
- `partial` - Some succeeded, some failed
- `failed` - All adjustments failed

### Error Response (422)

```json
{
  "status": "failed",
  "errors": {
    "adjustments.0.product_id": ["The selected product id is invalid"],
    "adjustments.1.quantity_adjusted": ["The quantity adjusted field is required"]
  }
}
```

## Complete Examples

### Example 1: Multiple Products - Damage Report

```json
{
  "adjustments": [
    {
      "product_id": "123e4567-e89b-12d3-a456-426614174000",
      "adjustment_type": "decrease",
      "reason_type": "damage",
      "quantity_adjusted": 5,
      "reason": "Water damage during storage",
      "notes": "Boxes 1-5 affected",
      "status": "pending"
    },
    {
      "product_id": "223e4567-e89b-12d3-a456-426614174001",
      "adjustment_type": "decrease",
      "reason_type": "damage",
      "quantity_adjusted": 3,
      "reason": "Water damage during storage",
      "notes": "Boxes 1-3 affected",
      "status": "pending"
    },
    {
      "product_id": "323e4567-e89b-12d3-a456-426614174002",
      "adjustment_type": "decrease",
      "reason_type": "damage",
      "quantity_adjusted": 2,
      "reason": "Water damage during storage",
      "notes": "Boxes 1-2 affected",
      "status": "pending"
    }
  ]
}
```

### Example 2: Product Variants - Physical Count Corrections

```json
{
  "adjustments": [
    {
      "product_id": "123e4567-e89b-12d3-a456-426614174000",
      "variant_id": "111e4567-e89b-12d3-a456-426614174010",
      "adjustment_type": "set",
      "reason_type": "recount",
      "quantity_adjusted": 45,
      "reason": "Physical inventory count - Size Small",
      "status": "pending"
    },
    {
      "product_id": "123e4567-e89b-12d3-a456-426614174000",
      "variant_id": "211e4567-e89b-12d3-a456-426614174011",
      "adjustment_type": "set",
      "reason_type": "recount",
      "quantity_adjusted": 67,
      "reason": "Physical inventory count - Size Medium",
      "status": "pending"
    },
    {
      "product_id": "123e4567-e89b-12d3-a456-426614174000",
      "variant_id": "311e4567-e89b-12d3-a456-426614174012",
      "adjustment_type": "set",
      "reason_type": "recount",
      "quantity_adjusted": 52,
      "reason": "Physical inventory count - Size Large",
      "status": "pending"
    }
  ]
}
```

### Example 3: Found Items

```json
{
  "adjustments": [
    {
      "product_id": "123e4567-e89b-12d3-a456-426614174000",
      "adjustment_type": "increase",
      "reason_type": "found",
      "quantity_adjusted": 10,
      "reason": "Found in back storage area during cleaning",
      "notes": "Items were properly packaged and in good condition"
    },
    {
      "product_id": "223e4567-e89b-12d3-a456-426614174001",
      "adjustment_type": "increase",
      "reason_type": "found",
      "quantity_adjusted": 5,
      "reason": "Found in back storage area during cleaning"
    }
  ]
}
```

### Example 4: Mixed Adjustments with Batches

```json
{
  "adjustments": [
    {
      "product_id": "123e4567-e89b-12d3-a456-426614174000",
      "batch_id": "batch-001",
      "adjustment_type": "decrease",
      "reason_type": "expiry",
      "quantity_adjusted": 20,
      "reason": "Batch expired on 2025-11-20",
      "attachments": ["https://example.com/expiry-report.pdf"],
      "status": "pending"
    },
    {
      "product_id": "223e4567-e89b-12d3-a456-426614174001",
      "adjustment_type": "decrease",
      "reason_type": "theft",
      "quantity_adjusted": 3,
      "reason": "Reported stolen during break-in",
      "notes": "Police report filed",
      "attachments": ["https://example.com/police-report.pdf"],
      "status": "pending"
    }
  ]
}
```

### Example 5: Store-Specific Adjustments

```json
{
  "adjustments": [
    {
      "product_id": "123e4567-e89b-12d3-a456-426614174000",
      "store_id": "store-001",
      "adjustment_type": "decrease",
      "reason_type": "sample",
      "quantity_adjusted": 5,
      "reason": "Used for customer samples - Store A"
    },
    {
      "product_id": "123e4567-e89b-12d3-a456-426614174000",
      "store_id": "store-002",
      "adjustment_type": "decrease",
      "reason_type": "sample",
      "quantity_adjusted": 3,
      "reason": "Used for customer samples - Store B"
    }
  ]
}
```

## Validation Rules

### Per-Adjustment Validation

Each adjustment in the array is validated independently:

1. **Product Verification**: Product must exist and belong to the user's company
2. **Negative Stock Prevention**: Final quantity cannot be negative
3. **Variant Validation**: If variant_id provided, must exist and belong to the product
4. **Batch Validation**: If batch_id provided, must exist
5. **Unit Validation**: If unit_id provided, must exist
6. **Store Validation**: If store_id provided, must exist

### Validation Errors

If validation fails for any adjustment, it will be included in the failed results with specific error messages:

```json
{
  "status": "failed",
  "index": 2,
  "errors": {
    "quantity": [
      "Adjustment would result in negative stock quantity",
      "Current: 5, Adjustment: -10, Result: -5"
    ]
  },
  "input": { /* original input */ }
}
```

## Activity Logging

Each successful adjustment automatically creates an activity log entry:

- **Action**: `stock_adjustment_created`
- **Description**: Includes adjustment number, product name, and "(bulk operation)" indicator
- **Properties**: 
  - All adjustment details
  - `bulk_operation: true` flag for tracking

## Workflow Example

### 1. Create Draft Adjustments
```bash
POST /api/stock-adjustments/bulk
{
  "adjustments": [
    {
      "product_id": "...",
      "adjustment_type": "decrease",
      "reason_type": "damage",
      "quantity_adjusted": 10,
      "reason": "Damaged in transit",
      "status": "draft"
    },
    {
      "product_id": "...",
      "adjustment_type": "decrease",
      "reason_type": "damage",
      "quantity_adjusted": 5,
      "reason": "Damaged in transit",
      "status": "draft"
    }
  ]
}
```

### 2. Review Created Adjustments
Check the response for all created adjustment IDs and review details.

### 3. Submit for Approval
For each adjustment that needs approval, update status:
```bash
PATCH /api/stock-adjustments/{id}
{
  "status": "pending"
}
```

### 4. Approve Each Adjustment
```bash
POST /api/stock-adjustments/{id}/approve
```

### 5. Apply to Inventory
```bash
POST /api/stock-adjustments/{id}/apply
```

## Best Practices

### 1. Batch Size
- Recommended: 10-50 adjustments per request
- Maximum: No hard limit, but consider timeout thresholds
- For large operations, split into multiple batches

### 2. Error Handling
```javascript
const response = await fetch('/api/stock-adjustments/bulk', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({ adjustments })
});

const result = await response.json();

if (result.status === 'completed') {
  console.log('All adjustments created successfully');
} else if (result.status === 'partial') {
  console.log(`${result.summary.successful} succeeded, ${result.summary.failed} failed`);
  
  // Process failed items
  const failed = result.results.filter(r => r.status === 'failed');
  failed.forEach(item => {
    console.error(`Adjustment ${item.index} failed:`, item.errors);
  });
  
  // Retry or handle failures
} else {
  console.error('All adjustments failed');
}
```

### 3. Status Management
- Use `draft` for adjustments that need review
- Use `pending` for adjustments ready for approval
- Apply adjustments only after approval if required by your workflow

### 4. Provide Detailed Reasons
Always include clear, descriptive reasons for better audit trails:
```json
{
  "reason": "5 units damaged during transport - Invoice #12345",
  "notes": "Driver reported dropping box. Items inspected and confirmed damaged."
}
```

### 5. Use Attachments
Link supporting documentation:
```json
{
  "attachments": [
    "https://storage.example.com/damage-photos-001.jpg",
    "https://storage.example.com/incident-report-001.pdf"
  ]
}
```

### 6. Metadata for Custom Tracking
```json
{
  "metadata": {
    "incident_id": "INC-2025-001",
    "inspector": "John Doe",
    "inspection_date": "2025-11-26",
    "department": "Warehouse A"
  }
}
```

## Performance Considerations

- Each adjustment is processed independently within a single database transaction
- If one adjustment fails validation, others can still succeed
- Transaction commits only if at least one adjustment succeeds
- Activity logs are created for each successful adjustment

## Comparison with Single Adjustment

### Single Adjustment Endpoint
```
POST /api/stock-adjustments
```
- Creates one adjustment per request
- Simpler error handling
- Better for individual, ad-hoc adjustments

### Bulk Adjustment Endpoint
```
POST /api/stock-adjustments/bulk
```
- Creates multiple adjustments per request
- More complex error handling with partial success
- Better for batch operations and imports
- More efficient for large-scale adjustments

## Security & Permissions

- All adjustments must be for products in the user's company
- User must have `can_update_products` permission
- Each adjustment is logged with user information
- Activity logs track all changes for audit purposes

## Integration Examples

### JavaScript/TypeScript
```typescript
interface BulkAdjustmentRequest {
  adjustments: Array<{
    product_id: string;
    variant_id?: string;
    adjustment_type: 'increase' | 'decrease' | 'set';
    reason_type: string;
    quantity_adjusted: number;
    reason: string;
    notes?: string;
    status?: 'draft' | 'pending';
  }>;
}

async function createBulkAdjustments(data: BulkAdjustmentRequest) {
  const response = await fetch('/api/stock-adjustments/bulk', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });
  
  return await response.json();
}
```

### Python
```python
import requests

def create_bulk_adjustments(adjustments, token):
    url = "https://api.example.com/api/stock-adjustments/bulk"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}"
    }
    data = {"adjustments": adjustments}
    
    response = requests.post(url, json=data, headers=headers)
    return response.json()

# Usage
adjustments = [
    {
        "product_id": "123e4567-...",
        "adjustment_type": "decrease",
        "reason_type": "damage",
        "quantity_adjusted": 10,
        "reason": "Damaged items"
    },
    # ... more adjustments
]

result = create_bulk_adjustments(adjustments, "your-token")
```

### cURL
```bash
curl -X POST https://api.example.com/api/stock-adjustments/bulk \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "adjustments": [
      {
        "product_id": "123e4567-e89b-12d3-a456-426614174000",
        "adjustment_type": "decrease",
        "reason_type": "damage",
        "quantity_adjusted": 10,
        "reason": "Damaged during transit"
      }
    ]
  }'
```

## Troubleshooting

### Common Issues

#### 1. "Product not found or does not belong to your company"
- Verify the product_id exists
- Ensure the product belongs to your company
- Check that you're using the correct company context

#### 2. "Adjustment would result in negative stock quantity"
- Check current stock levels before adjustment
- Use `set` type if you want to set exact quantity
- Reduce the adjustment amount

#### 3. Partial Success
- Review the `results` array to identify which adjustments failed
- Check error messages for each failed adjustment
- Retry failed adjustments with corrected data

#### 4. Timeout Issues
- Reduce batch size (aim for 20-30 per request)
- Split large operations into multiple requests
- Consider processing during off-peak hours

## Support

For issues or questions about bulk stock adjustments:
1. Check this documentation
2. Review the API response error messages
3. Check activity logs for audit trail
4. Contact system administrator

## Related Documentation

- [Stock Adjustment API](STOCK_ADJUSTMENT_API.md)
- [Inventory Management](Frontend_Inventory_Management_Documentation.md)
- [Product Management](Product_Number_Implementation.md)
