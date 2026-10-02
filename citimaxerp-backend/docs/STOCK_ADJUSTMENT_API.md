# Stock Adjustment API Documentation

## Overview
The Stock Adjustment feature allows you to track and manage inventory adjustments with full activity logging. All stock adjustment actions are automatically logged in the activity monitor.

## Activity Tracking
Every stock adjustment action is automatically logged with the following details:
- User who performed the action
- Timestamp
- Action type (created, updated, approved, rejected, applied, deleted)
- Detailed properties including adjustment details
- IP address and user agent

## API Endpoints

### Bulk Create Stock Adjustments
```
POST /api/stock-adjustments/bulk
```

**Request Body:**
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
    },
    {
      "product_id": "uuid",
      "adjustment_type": "decrease",
      "reason_type": "damage",
      "quantity_adjusted": 5,
      "reason": "Damaged during transit"
    }
  ]
}
```

**Response:**
```json
{
  "status": "completed",
  "results": [
    {
      "status": "success",
      "message": "Stock adjustment created successfully",
      "data": { /* adjustment object */ }
    },
    {
      "status": "failed",
      "errors": { /* validation errors */ },
      "input": { /* original input */ }
    }
  ]
}
```

**Activity Logged:** Each successful adjustment logs `stock_adjustment_created`.

### 1. List All Stock Adjustments
```
GET /api/stock-adjustments
```

**Query Parameters:**
- `store_id` - Filter by store
- `product_id` - Filter by product
- `status` - Filter by status (draft, pending, approved, rejected, completed)
- `reason_type` - Filter by reason type
- `adjustment_type` - Filter by adjustment type (increase, decrease, set)
- `start_date` - Filter from date
- `end_date` - Filter to date
- `search` - Search in adjustment number, reason, notes
- `sort_by` - Sort field (default: created_at)
- `sort_order` - Sort direction (asc, desc)
- `per_page` - Results per page (default: 20)

**Response:**
```json
{
  "status": "success",
  "data": {
    "current_page": 1,
    "data": [
      {
        "id": "uuid",
        "adjustment_number": "ADJ-20251104-0001",
        "product": {...},
        "variant": {...},
        "store": {...},
        "adjustment_type": "decrease",
        "reason_type": "damage",
        "quantity_before": 100,
        "quantity_adjusted": -10,
        "quantity_after": 90,
        "status": "completed",
        "created_by": {...},
        "approved_by": {...}
      }
    ]
  }
}
```

### 2. Create Stock Adjustment
```
POST /api/stock-adjustments
```

**Request Body:**
```json
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
```

**Activity Logged:** `stock_adjustment_created`

### 3. Get Single Stock Adjustment
```
GET /api/stock-adjustments/{id}
```

### 4. Update Stock Adjustment
```
PATCH /api/stock-adjustments/{id}
```

**Note:** Only draft or pending adjustments can be updated.

**Activity Logged:** `stock_adjustment_updated`

### 5. Delete Stock Adjustment
```
DELETE /api/stock-adjustments/{id}
```

**Note:** Only draft adjustments can be deleted.

**Activity Logged:** `stock_adjustment_deleted`

### 6. Approve Stock Adjustment
```
POST /api/stock-adjustments/{id}/approve
```

**Activity Logged:** `stock_adjustment_approved`

### 7. Reject Stock Adjustment
```
POST /api/stock-adjustments/{id}/reject
```

**Request Body:**
```json
{
  "rejection_reason": "Reason for rejection"
}
```

**Activity Logged:** `stock_adjustment_rejected`

### 8. Apply/Complete Stock Adjustment
```
POST /api/stock-adjustments/{id}/apply
```

**Note:** This applies the adjustment to actual inventory and creates an inventory movement record.

**Activity Logged:** `stock_adjustment_applied`

### 9. Get Statistics
```
GET /api/stock-adjustments/statistics
```

**Query Parameters:**
- `store_id` - Filter by store
- `start_date` - From date (default: last 30 days)
- `end_date` - To date (default: today)

**Response:**
```json
{
  "status": "success",
  "data": {
    "total_adjustments": 150,
    "pending_adjustments": 10,
    "approved_adjustments": 20,
    "completed_adjustments": 115,
    "rejected_adjustments": 5,
    "total_value_impact": 15000.00,
    "total_cost_impact": 12000.00,
    "by_reason_type": [...],
    "by_adjustment_type": [...]
  }
}
```

### 10. Get All Stock Adjustment Activities
```
GET /api/stock-adjustments/activities
```

**Query Parameters:**
- `adjustment_id` - Filter by specific adjustment
- `product_id` - Filter by product
- `action` - Filter by action type (stock_adjustment_created, stock_adjustment_updated, etc.)
- `start_date` - From date
- `end_date` - To date
- `per_page` - Results per page (default: 50)

**Response:**
```json
{
  "status": "success",
  "data": {
    "current_page": 1,
    "data": [
      {
        "id": "uuid",
        "user": {
          "id": "uuid",
          "name": "John Doe",
          "email": "john@example.com"
        },
        "action": "stock_adjustment_created",
        "description": "Created stock adjustment ADJ-20251104-0001 for product: Widget A",
        "ip_address": "192.168.1.1",
        "user_agent": "Mozilla/5.0...",
        "properties": {
          "adjustment_id": "uuid",
          "adjustment_number": "ADJ-20251104-0001",
          "product_id": "uuid",
          "product_name": "Widget A",
          "adjustment_type": "decrease",
          "reason_type": "damage",
          "quantity_adjusted": -10,
          "quantity_before": 100,
          "quantity_after": 90,
          "status": "draft"
        },
        "created_at": "2025-11-04T10:30:00.000000Z"
      }
    ]
  }
}
```

### 11. Get Activities for Specific Stock Adjustment
```
GET /api/stock-adjustments/{id}/activities
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "adjustment": {...},
    "activities": [...],
    "activity_count": 5
  }
}
```

## Activity Types

The following activities are automatically tracked:

1. **stock_adjustment_created** - When a new adjustment is created
2. **stock_adjustment_updated** - When an adjustment is modified
3. **stock_adjustment_approved** - When an adjustment is approved
4. **stock_adjustment_rejected** - When an adjustment is rejected
5. **stock_adjustment_applied** - When an adjustment is applied to inventory
6. **stock_adjustment_deleted** - When a draft adjustment is deleted

## Activity Properties

Each activity log includes:
- `adjustment_id` - UUID of the adjustment
- `adjustment_number` - Human-readable adjustment number
- `product_id` - Product UUID
- `product_name` - Product name (when available)
- `variant_id` - Variant UUID (if applicable)
- `adjustment_type` - Type of adjustment
- `reason_type` - Reason for adjustment
- `quantity_adjusted` - Amount adjusted
- `quantity_before` - Stock before adjustment
- `quantity_after` - Stock after adjustment
- `status` - Current status
- Additional context-specific properties

## Workflow Example

1. **Create Adjustment** (Draft)
   ```
   POST /api/stock-adjustments
   Activity: stock_adjustment_created
   ```

2. **Submit for Approval**
   ```
   PATCH /api/stock-adjustments/{id}
   { "status": "pending" }
   Activity: stock_adjustment_updated
   ```

3. **Approve Adjustment**
   ```
   POST /api/stock-adjustments/{id}/approve
   Activity: stock_adjustment_approved
   ```

4. **Apply to Inventory**
   ```
   POST /api/stock-adjustments/{id}/apply
   Activity: stock_adjustment_applied
   ```

5. **View Activity Trail**
   ```
   GET /api/stock-adjustments/{id}/activities
   ```

## Permissions

The following permissions are checked:
- `can_view_products` - View adjustments and activities
- `can_update_products` - Create, update, apply adjustments
- `can_delete_products` - Delete draft adjustments
- `can_approve_adjustments` - Approve/reject adjustments

## Integration with Activity Monitor

All activities are stored in the `activity_logs` table and can be:
- Filtered by date range, user, action type
- Searched by description
- Exported for audit reports
- Monitored in real-time
- Used for compliance and reporting

## Best Practices

1. **Always provide detailed reasons** for adjustments
2. **Use the approval workflow** for significant adjustments
3. **Attach supporting documents** when available
4. **Review activity logs regularly** for audit compliance
5. **Monitor adjustment statistics** to identify patterns
6. **Use appropriate reason types** for better categorization
