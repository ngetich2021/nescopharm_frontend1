# Order Dispatch API Documentation

## Overview
The Order Dispatch system allows you to create dispatches from orders with approval workflows, product tracking, packaging information, and delivery logistics management.

## Features
- ✅ Create dispatches from existing orders
- ✅ Multi-step approval workflow (Sales → Warehouse → Operations Manager)
- ✅ Automatic product pulling from order items
- ✅ Packaging breakdown and tracking
- ✅ Integration with delivery logistics (driver, vehicle details)
- ✅ Delivery status tracking with damaged/delivered quantities
- ✅ Full audit trail with approval history

---

## Database Schema

### `order_dispatches` Table
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| dispatch_number | String | Unique dispatch number (ODI-XXXXXXXX-0001) |
| order_id | UUID | Reference to orders table |
| company_id | UUID | Company identifier |
| from_store_id | UUID | Source warehouse/store |
| delivery_location_id | UUID | Delivery destination |
| approval_status | Enum | draft, pending, in_progress, approved, rejected |
| workflow_instance_id | UUID | Reference to active workflow |
| logistic_id | UUID | Reference to logistics record |
| status | Enum | pending, approved, in_transit, delivered, cancelled |
| dispatch_date | Timestamp | When dispatch was sent |
| estimated_delivery_date | Timestamp | Expected delivery date |
| actual_delivery_date | Timestamp | Actual delivery date |
| notes | Text | Additional notes |
| special_instructions | Text | Delivery instructions |
| created_by | UUID | User who created dispatch |
| approved_by | UUID | User who approved |
| approved_at | Timestamp | Approval timestamp |

### `order_dispatch_items` Table
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| order_dispatch_id | UUID | Parent dispatch |
| order_item_id | UUID | Reference to order item |
| product_id | UUID | Product identifier |
| variant_id | UUID | Product variant (optional) |
| product_code | String | Product code |
| quantity | Integer | Quantity to dispatch |
| unit_id | UUID | Unit of measure (optional) |
| unit_quantity | Decimal | Quantity in units |
| base_quantity | Integer | Base quantity |
| packaging_breakdown | JSONB | Packaging details (cartons, pieces, etc.) |
| packaging_notes | Text | Packaging instructions |
| delivered_quantity | Integer | Actual delivered quantity |
| damaged_quantity | Integer | Damaged items count |
| delivery_notes | Text | Delivery notes |

---

## API Endpoints

### 1. List Order Dispatches
**GET** `/api/order-dispatches`

Get all order dispatches for the authenticated user's company.

**Query Parameters:**
- `status` (optional): Filter by status (pending, approved, in_transit, delivered, cancelled)
- `approval_status` (optional): Filter by approval status (draft, pending, approved, rejected)
- `order_id` (optional): Filter by specific order

**Response:**
```json
{
  "status": "success",
  "message": "Order dispatches retrieved successfully.",
  "data": [
    {
      "id": "uuid",
      "dispatch_number": "ODI-0001",
      "order_id": "uuid",
      "approval_status": "approved",
      "status": "in_transit",
      "dispatch_date": "2025-11-19T10:00:00Z",
      "estimated_delivery_date": "2025-11-20T16:00:00Z",
      "order": {
        "id": "uuid",
        "order_number": "ORD-0123",
        "customer": { ... }
      },
      "items": [...],
      "logistic": { ... },
      "created_by": { ... }
    }
  ]
}
```

---

### 2. Get Single Order Dispatch
**GET** `/api/order-dispatches/{id}`

Get detailed information about a specific order dispatch.

**Response:**
```json
{
  "status": "success",
  "message": "Order dispatch retrieved successfully.",
  "data": {
    "id": "uuid",
    "dispatch_number": "ODI-0001",
    "order": {
      "id": "uuid",
      "order_number": "ORD-0123",
      "customer": { ... },
      "order_items": [...]
    },
    "items": [
      {
        "id": "uuid",
        "product_id": "uuid",
        "product_code": "PROD-001",
        "quantity": 100,
        "packaging_breakdown": {
          "cartons": 5,
          "pieces": 10
        },
        "delivered_quantity": 0,
        "damaged_quantity": 0,
        "product": { ... },
        "variant": { ... }
      }
    ],
    "active_workflow_instance": {
      "status": "in_progress",
      "step_instances": [
        {
          "step": {
            "step_name": "Sales Verification",
            "step_order": 1
          },
          "status": "approved",
          "approved_at": "2025-11-19T09:00:00Z"
        }
      ]
    }
  }
}
```

---

### 3. Create Order Dispatch
**POST** `/api/order-dispatches`

Create a new order dispatch from an existing order.

**Request Body:**
```json
{
  "order_id": "uuid",
  "from_store_id": "uuid",
  "estimated_delivery_date": "2025-11-20T16:00:00Z",
  "notes": "Handle with care",
  "special_instructions": "Call customer before delivery",
  "items": [
    {
      "order_item_id": "uuid",
      "quantity": 100,
      "packaging_breakdown": {
        "cartons": 5,
        "pieces": 10
      },
      "packaging_notes": "Pack in bubble wrap"
    }
  ],
  "initiate_workflow": true
}
```

**Validation Rules:**
- `order_id`: Required, must exist in orders table
- `from_store_id`: Optional, must exist in stores table
- `items`: Required, array with at least 1 item
- `items.*.order_item_id`: Required, must exist in order_items table
- `items.*.quantity`: Required, integer, min 1, cannot exceed order item quantity
- `initiate_workflow`: Optional, boolean (default: false)

**Response:**
```json
{
  "status": "success",
  "message": "Order dispatch created successfully.",
  "data": {
    "id": "uuid",
    "dispatch_number": "ODI-0001",
    "approval_status": "pending",
    "status": "pending",
    "order": { ... },
    "items": [ ... ],
    "active_workflow_instance": { ... }
  }
}
```

**Error Responses:**
- `400`: Order already has a dispatch created
- `403`: Unauthorized to create order dispatches
- `422`: Validation errors (quantity exceeds order quantity, etc.)

---

### 4. Update Order Dispatch
**PUT/PATCH** `/api/order-dispatches/{id}`

Update an order dispatch (only allowed for draft or rejected dispatches).

**Request Body:**
```json
{
  "from_store_id": "uuid",
  "estimated_delivery_date": "2025-11-20T18:00:00Z",
  "notes": "Updated notes",
  "special_instructions": "New instructions",
  "items": [
    {
      "order_item_id": "uuid",
      "quantity": 150,
      "packaging_breakdown": {
        "cartons": 7,
        "pieces": 10
      }
    }
  ]
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Order dispatch updated successfully.",
  "data": { ... }
}
```

**Error Responses:**
- `400`: Cannot edit dispatch with current status
- `403`: Unauthorized to update order dispatches

---

### 5. Delete Order Dispatch
**DELETE** `/api/order-dispatches/{id}`

Delete an order dispatch (only allowed for draft status).

**Response:**
```json
{
  "status": "success",
  "message": "Order dispatch deleted successfully."
}
```

**Error Responses:**
- `400`: Can only delete dispatches in draft status
- `403`: Unauthorized to delete order dispatches

---

### 6. Initiate Approval Workflow
**POST** `/api/order-dispatches/{id}/initiate-workflow`

Start the approval workflow for a dispatch.

**Response:**
```json
{
  "status": "success",
  "message": "Approval workflow initiated successfully.",
  "data": {
    "id": "uuid",
    "approval_status": "pending",
    "active_workflow_instance": {
      "id": "uuid",
      "status": "in_progress",
      "step_instances": [
        {
          "step": {
            "step_name": "Sales Verification",
            "step_order": 1
          },
          "status": "pending"
        }
      ]
    }
  }
}
```

**Error Responses:**
- `400`: Dispatch already has an active workflow
- `400`: Can only initiate workflow for draft or rejected dispatches

---

### 7. Create Logistics
**POST** `/api/order-dispatches/{id}/create-logistics`

Create delivery logistics for an approved dispatch (driver, vehicle, tracking).

**Request Body:**
```json
{
  "delivery_person_id": "uuid",
  "logistics_provider": "DHL",
  "delivery_method": "express",
  "vehicle_type": "Van",
  "vehicle_id": "KAA-123X",
  "estimated_delivery_time": "2025-11-20T16:00:00Z",
  "notes": "Fragile items"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Logistics created successfully.",
  "data": {
    "dispatch": {
      "id": "uuid",
      "status": "in_transit",
      "dispatch_date": "2025-11-19T10:00:00Z",
      "logistic": {
        "id": "uuid",
        "tracking_number": "TRK-ABC123",
        "delivery_status": "dispatched",
        "vehicle_type": "Van",
        "vehicle_id": "KAA-123X",
        "delivery_person": {
          "full_name": "John Doe",
          "phone_number": "+254712345678"
        }
      }
    }
  }
}
```

**Error Responses:**
- `400`: Dispatch must be approved before creating logistics
- `400`: Logistics already created for this dispatch
- `403`: Unauthorized to create logistics

---

### 8. Mark as Delivered
**POST** `/api/order-dispatches/{id}/mark-delivered`

Mark dispatch as delivered with item-level delivery details.

**Request Body:**
```json
{
  "items": [
    {
      "id": "uuid",
      "delivered_quantity": 95,
      "damaged_quantity": 5,
      "delivery_notes": "5 items damaged during transit"
    }
  ]
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Dispatch marked as delivered successfully.",
  "data": {
    "id": "uuid",
    "status": "delivered",
    "actual_delivery_date": "2025-11-20T15:30:00Z",
    "items": [
      {
        "id": "uuid",
        "quantity": 100,
        "delivered_quantity": 95,
        "damaged_quantity": 5,
        "remaining_quantity": 5
      }
    ]
  }
}
```

---

## Approval Workflow

### Workflow Steps
1. **Sales Verification** (Step 1)
   - Verifies order details and customer information
   - Timeout: 12 hours
   - Can reject

2. **Warehouse Approval** (Step 2)
   - Confirms product availability and packaging
   - Timeout: 24 hours
   - Can reject

3. **Operations Manager Approval** (Step 3)
   - Final approval for large orders (≥10 items)
   - Timeout: 24 hours
   - Conditional based on `total_items` count

### Using Approval Endpoints

**Get Pending Approvals:**
```
GET /api/approvals/pending
```

**Approve a Step:**
```
POST /api/approvals/steps/{stepInstanceId}/approve
Body: { "notes": "Approved for dispatch" }
```

**Reject a Step:**
```
POST /api/approvals/steps/{stepInstanceId}/reject
Body: { "notes": "Insufficient stock", "reason": "Stock unavailable" }
```

---

## Permissions

Required permissions for order dispatch operations:

| Action | Permission Key |
|--------|---------------|
| View dispatches | `can_view_order_dispatches` |
| Create dispatches | `can_create_order_dispatches` |
| Update dispatches | `can_update_order_dispatches` |
| Delete dispatches | `can_delete_order_dispatches` |
| Create logistics | `can_dispatch_orders` |
| Approve dispatches | `can_approve_order_dispatches` |

---

## Complete Flow Example

### 1. Create Dispatch from Order
```bash
POST /api/order-dispatches
{
  "order_id": "123e4567-e89b-12d3-a456-426614174000",
  "from_store_id": "223e4567-e89b-12d3-a456-426614174000",
  "items": [
    {
      "order_item_id": "323e4567-e89b-12d3-a456-426614174000",
      "quantity": 50,
      "packaging_breakdown": {"cartons": 2, "pieces": 10}
    }
  ],
  "initiate_workflow": true
}
```

### 2. Approvers Review (via Approval API)
```bash
# Sales approves
POST /api/approvals/steps/{stepId}/approve
{ "notes": "Customer verified, proceed" }

# Warehouse approves
POST /api/approvals/steps/{stepId}/approve
{ "notes": "Stock available, ready to pack" }
```

### 3. Create Logistics (after approval)
```bash
POST /api/order-dispatches/{dispatchId}/create-logistics
{
  "delivery_person_id": "423e4567-e89b-12d3-a456-426614174000",
  "vehicle_type": "Truck",
  "vehicle_id": "KBZ-456Y"
}
```

### 4. Mark as Delivered
```bash
POST /api/order-dispatches/{dispatchId}/mark-delivered
{
  "items": [
    {
      "id": "523e4567-e89b-12d3-a456-426614174000",
      "delivered_quantity": 50,
      "damaged_quantity": 0
    }
  ]
}
```

---

## Integration Points

### With Orders
- Order status updates automatically when dispatch is created/delivered
- Links to order customer and delivery location

### With Logistics
- Creates `Logistic` record with driver and vehicle details
- Updates tracking numbers on orders
- Syncs delivery status

### With Approval Workflow
- Uses existing workflow infrastructure
- Configurable approval steps per company
- Email notifications (if configured)

---

## Best Practices

1. **Always validate order status** before creating dispatch
2. **Use `initiate_workflow: true`** on creation to start approval immediately
3. **Check `canBeDispatched()`** before creating logistics
4. **Track damaged items** separately for insurance/reporting
5. **Use packaging_breakdown** for accurate inventory management
6. **Set realistic estimated_delivery_date** for customer expectations

---

## Error Handling

Common error scenarios:

| Error Code | Scenario | Solution |
|------------|----------|----------|
| 400 | Order already has dispatch | Check existing dispatches first |
| 400 | Quantity exceeds order | Verify order item quantities |
| 403 | Missing permissions | Check user role permissions |
| 404 | Order/Dispatch not found | Verify ID exists |
| 422 | Validation errors | Review validation rules |

---

## Testing with Postman

Import this collection structure:

```json
{
  "info": {
    "name": "Order Dispatch API",
    "description": "Complete order dispatch workflow"
  },
  "item": [
    {
      "name": "1. Create Order Dispatch",
      "request": {
        "method": "POST",
        "header": [
          {"key": "Authorization", "value": "Bearer {{token}}"}
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"order_id\": \"{{orderId}}\",\n  \"items\": [...]\n}"
        },
        "url": "{{baseUrl}}/api/order-dispatches"
      }
    }
  ]
}
```

---

## Support & Questions

For implementation questions or issues:
1. Check error response messages
2. Verify permissions are seeded
3. Ensure migrations are run
4. Check workflow configuration

---

**Version:** 1.0  
**Last Updated:** November 19, 2025
