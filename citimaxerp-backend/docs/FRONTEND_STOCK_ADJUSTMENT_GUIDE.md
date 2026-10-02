# Stock Adjustment API - Frontend Integration Guide

## Overview
The Stock Adjustment feature allows authorized users to track and manage inventory adjustments with full activity logging and approval workflows. This document provides everything the frontend team needs to integrate stock adjustment functionality.

---

## Table of Contents
1. [Authentication](#authentication)
2. [Process Flow](#process-flow)
3. [Workflow States](#workflow-states)
4. [API Endpoints](#api-endpoints)
5. [Data Models](#data-models)
6. [User Permissions](#user-permissions)
7. [Common Use Cases](#common-use-cases)
8. [Error Handling](#error-handling)

---

## Authentication

All API requests require a valid Bearer token obtained from the login endpoint.

**Login Endpoint:**
```
POST /api/login
```

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Login successful.",
  "data": {
    "token": "25|ip4k3Kzhx8FbbHcRhx1jZ7x9gGZyHOax0bjMFMCjaea95f9b",
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "first_name": "John",
      "last_name": "Admin",
      "company": {...},
      "role": {...}
    }
  }
}
```

**Include token in all subsequent requests:**
```
Authorization: Bearer {token}
```

---

## Process Flow

### Standard Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Stock Adjustment Workflow                     │
└─────────────────────────────────────────────────────────────────┘

1. CREATE (Draft)
   │
   ├─→ User creates adjustment with basic details
   │   Status: "draft"
   │   Can edit, delete
   │
2. SUBMIT (Pending)
   │
   ├─→ User submits for approval
   │   Status: "pending"
   │   Can no longer edit/delete
   │   Awaiting approval
   │
3. APPROVE
   │
   ├─→ Authorized user approves
   │   Status: "approved"
   │   Ready to be applied
   │
4. APPLY (Completed)
   │
   ├─→ Adjustment applied to inventory
   │   Status: "completed"
   │   Inventory updated
   │   Movement record created
   │
Alternative Path: REJECT
   │
   └─→ Adjustment rejected with reason
       Status: "rejected"
       No inventory impact
       User can create new adjustment
```

### Quick Workflow (Direct Apply)

For users with appropriate permissions, adjustments can be created and immediately applied:

```
CREATE → APPROVE → APPLY (one operation)
```

---

## Workflow States

| Status | Description | Can Edit | Can Delete | Can Approve | Can Apply |
|--------|-------------|----------|------------|-------------|-----------|
| **draft** | Initial state, being prepared | ✅ | ✅ | ❌ | ❌ |
| **pending** | Submitted for approval | ❌ | ❌ | ✅ | ❌ |
| **approved** | Approved, ready to apply | ❌ | ❌ | ❌ | ✅ |
| **completed** | Applied to inventory | ❌ | ❌ | ❌ | ❌ |
| **rejected** | Rejected, no inventory impact | ❌ | ❌ | ❌ | ❌ |

---

## API Endpoints

### 1. List All Stock Adjustments

**Endpoint:**
```
GET /api/stock-adjustments
```

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `store_id` | UUID | No | Filter by store |
| `product_id` | UUID | No | Filter by product |
| `status` | String | No | Filter by status (draft, pending, approved, rejected, completed) |
| `reason_type` | String | No | Filter by reason type |
| `adjustment_type` | String | No | Filter by adjustment type (increase, decrease, set) |
| `start_date` | DateTime | No | Filter from date (YYYY-MM-DD) |
| `end_date` | DateTime | No | Filter to date (YYYY-MM-DD) |
| `search` | String | No | Search in adjustment number, reason, notes |
| `sort_by` | String | No | Sort field (default: created_at) |
| `sort_order` | String | No | Sort direction (asc, desc) |
| `per_page` | Integer | No | Results per page (default: 20) |

**Example Request:**
```
GET /api/stock-adjustments?status=pending&per_page=10
```

**Success Response:**
```json
{
  "status": "success",
  "data": {
    "current_page": 1,
    "data": [
      {
        "id": "588370c9-a270-46bc-a6c3-06e59c8ada4b",
        "company_id": "14fafcd8-137b-4725-a6e9-7542ad27a6ed",
        "store_id": "f5c9bb5b-7b2c-4596-958a-0931f9595dac",
        "adjustment_number": "ADJ-20251104-0001",
        "product_id": "d6f33ea4-86d4-4293-9353-3b82d750db7b",
        "variant_id": null,
        "batch_id": null,
        "unit_id": null,
        "adjustment_type": "decrease",
        "reason_type": "damage",
        "quantity_before": 20,
        "quantity_adjusted": -10,
        "quantity_after": 10,
        "unit_cost": "4000.00",
        "total_cost": "-40000.00",
        "unit_price": "5000.00",
        "total_value": "-50000.00",
        "status": "draft",
        "created_by": {
          "id": "29590834-4d79-46b7-ab0b-fb6be2842c95",
          "first_name": "John",
          "last_name": "Admin",
          "email": "user@example.com",
          "full_name": "John Admin"
        },
        "approved_by": null,
        "rejected_by": null,
        "approved_at": null,
        "rejected_at": null,
        "reason": "Product damaged during storage inspection",
        "notes": "Found damaged items in warehouse sector A",
        "rejection_reason": null,
        "attachments": null,
        "metadata": null,
        "inventory_movement_id": null,
        "created_at": "2025-11-04T14:02:03.000000Z",
        "updated_at": "2025-11-04T17:02:03.000000Z",
        "product": {
          "id": "d6f33ea4-86d4-4293-9353-3b82d750db7b",
          "name": "Test Product",
          "sku": "SKU123",
          "product_code": "PROD123",
          "image_urls": [],
          "primary_image_url": null
        },
        "variant": null,
        "batch": null,
        "store": {
          "id": "f5c9bb5b-7b2c-4596-958a-0931f9595dac",
          "name": "Main Warehouse"
        }
      }
    ],
    "total": 1,
    "per_page": 20,
    "current_page": 1,
    "last_page": 1
  }
}
```

---

### 2. Get Single Stock Adjustment

**Endpoint:**
```
GET /api/stock-adjustments/{id}
```

**URL Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | UUID | Yes | Stock adjustment ID |

**Success Response:**
```json
{
  "status": "success",
  "data": {
    "id": "588370c9-a270-46bc-a6c3-06e59c8ada4b",
    "adjustment_number": "ADJ-20251104-0001",
    "product": {
      "id": "d6f33ea4-86d4-4293-9353-3b82d750db7b",
      "name": "Test Product",
      "sku": "SKU123",
      "product_code": "PROD123",
      "stock_quantity": 10,
      "unit_cost": "4000.00",
      "price": "5000.00"
    },
    "variant": null,
    "batch": null,
    "store": {
      "id": "f5c9bb5b-7b2c-4596-958a-0931f9595dac",
      "name": "Main Warehouse"
    },
    "adjustment_type": "decrease",
    "reason_type": "damage",
    "quantity_before": 20,
    "quantity_adjusted": -10,
    "quantity_after": 10,
    "unit_cost": "4000.00",
    "total_cost": "-40000.00",
    "unit_price": "5000.00",
    "total_value": "-50000.00",
    "status": "draft",
    "reason": "Product damaged during storage inspection",
    "notes": "Found damaged items in warehouse sector A",
    "created_by": {
      "id": "29590834-4d79-46b7-ab0b-fb6be2842c95",
      "first_name": "John",
      "last_name": "Admin",
      "email": "user@example.com",
      "full_name": "John Admin"
    },
    "created_at": "2025-11-04T14:02:03.000000Z",
    "updated_at": "2025-11-04T17:02:03.000000Z"
  }
}
```

---

### 3. Create Stock Adjustment

**Endpoint:**
```
POST /api/stock-adjustments
```

**Request Payload:**
```json
{
  "product_id": "d6f33ea4-86d4-4293-9353-3b82d750db7b",
  "variant_id": "optional-uuid",
  "batch_id": "optional-uuid",
  "unit_id": "optional-uuid",
  "store_id": "f5c9bb5b-7b2c-4596-958a-0931f9595dac",
  "adjustment_type": "decrease",
  "reason_type": "damage",
  "quantity_adjusted": -10,
  "reason": "Product damaged during storage inspection",
  "notes": "Found damaged items in warehouse sector A",
  "unit_cost": 4000.00,
  "unit_price": 5000.00,
  "status": "draft",
  "attachments": ["https://example.com/image1.jpg"],
  "metadata": {
    "location": "Sector A",
    "inspector": "John Doe"
  }
}
```

**Field Descriptions:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `product_id` | UUID | Yes | Product being adjusted |
| `variant_id` | UUID | No | Product variant (if applicable) |
| `batch_id` | UUID | No | Inventory batch (if tracking batches) |
| `unit_id` | UUID | No | Unit of measurement |
| `store_id` | UUID | No | Store/warehouse (uses default if not provided) |
| `adjustment_type` | String | Yes | `increase`, `decrease`, or `set` |
| `reason_type` | String | Yes | See [Reason Types](#reason-types) |
| `quantity_adjusted` | Integer | Yes | Quantity to adjust (negative for decrease) |
| `reason` | String | Yes | Detailed reason for adjustment |
| `notes` | String | No | Additional notes |
| `unit_cost` | Decimal | No | Cost per unit |
| `unit_price` | Decimal | No | Price per unit |
| `status` | String | No | `draft` or `pending` (default: draft) |
| `attachments` | Array | No | Array of attachment URLs |
| `metadata` | Object | No | Additional metadata |

**Success Response:**
```json
{
  "status": "success",
  "message": "Stock adjustment created successfully",
  "data": {
    "id": "588370c9-a270-46bc-a6c3-06e59c8ada4b",
    "adjustment_number": "ADJ-20251104-0001",
    "status": "draft",
    "...": "...full adjustment object"
  }
}
```

**Validation Errors:**
```json
{
  "status": "error",
  "message": "Validation failed",
  "errors": {
    "product_id": ["The product id field is required."],
    "adjustment_type": ["The adjustment type must be one of: increase, decrease, set."],
    "quantity_adjusted": ["The quantity adjusted field is required."]
  }
}
```

---

### 4. Update Stock Adjustment

**Endpoint:**
```
PATCH /api/stock-adjustments/{id}
```

**Note:** Only `draft` or `pending` adjustments can be updated.

**Request Payload:**
```json
{
  "quantity_adjusted": -15,
  "reason": "Updated reason after re-inspection",
  "notes": "Increased damaged quantity after second check",
  "status": "pending"
}
```

**Success Response:**
```json
{
  "status": "success",
  "message": "Stock adjustment updated successfully",
  "data": {
    "id": "588370c9-a270-46bc-a6c3-06e59c8ada4b",
    "adjustment_number": "ADJ-20251104-0001",
    "status": "pending",
    "...": "...updated adjustment object"
  }
}
```

---

### 5. Delete Stock Adjustment

**Endpoint:**
```
DELETE /api/stock-adjustments/{id}
```

**Note:** Only `draft` adjustments can be deleted.

**Success Response:**
```json
{
  "status": "success",
  "message": "Stock adjustment deleted successfully"
}
```

**Error Response (Wrong Status):**
```json
{
  "status": "error",
  "message": "Only draft adjustments can be deleted"
}
```

---

### 6. Approve Stock Adjustment

**Endpoint:**
```
POST /api/stock-adjustments/{id}/approve
```

**Note:** Requires `can_approve_adjustments` permission.

**Request Payload:**
```json
{}
```
(No body required)

**Success Response:**
```json
{
  "status": "success",
  "message": "Stock adjustment approved successfully",
  "data": {
    "id": "588370c9-a270-46bc-a6c3-06e59c8ada4b",
    "status": "approved",
    "approved_by": {
      "id": "uuid",
      "first_name": "Jane",
      "last_name": "Manager",
      "email": "manager@example.com"
    },
    "approved_at": "2025-11-04T15:30:00.000000Z",
    "...": "...full adjustment object"
  }
}
```

---

### 7. Reject Stock Adjustment

**Endpoint:**
```
POST /api/stock-adjustments/{id}/reject
```

**Request Payload:**
```json
{
  "rejection_reason": "Insufficient documentation provided"
}
```

**Field Descriptions:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `rejection_reason` | String | Yes | Reason for rejection |

**Success Response:**
```json
{
  "status": "success",
  "message": "Stock adjustment rejected successfully",
  "data": {
    "id": "588370c9-a270-46bc-a6c3-06e59c8ada4b",
    "status": "rejected",
    "rejected_by": {
      "id": "uuid",
      "first_name": "Jane",
      "last_name": "Manager",
      "email": "manager@example.com"
    },
    "rejected_at": "2025-11-04T15:30:00.000000Z",
    "rejection_reason": "Insufficient documentation provided",
    "...": "...full adjustment object"
  }
}
```

---

### 8. Apply Stock Adjustment (Complete)

**Endpoint:**
```
POST /api/stock-adjustments/{id}/apply
```

**Note:** This actually updates the inventory and creates an inventory movement record.

**Request Payload:**
```json
{}
```
(No body required)

**Success Response:**
```json
{
  "status": "success",
  "message": "Stock adjustment applied successfully. Inventory has been updated.",
  "data": {
    "id": "588370c9-a270-46bc-a6c3-06e59c8ada4b",
    "status": "completed",
    "inventory_movement_id": "movement-uuid",
    "product": {
      "id": "d6f33ea4-86d4-4293-9353-3b82d750db7b",
      "stock_quantity": 10
    },
    "...": "...full adjustment object"
  }
}
```

---

### 9. Get Statistics

**Endpoint:**
```
GET /api/stock-adjustments/statistics
```

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `store_id` | UUID | No | Filter by store |
| `start_date` | DateTime | No | From date (default: last 30 days) |
| `end_date` | DateTime | No | To date (default: today) |

**Example Request:**
```
GET /api/stock-adjustments/statistics?start_date=2025-10-01&end_date=2025-10-31
```

**Success Response:**
```json
{
  "status": "success",
  "data": {
    "total_adjustments": 150,
    "pending_adjustments": 10,
    "approved_adjustments": 20,
    "completed_adjustments": 115,
    "rejected_adjustments": 5,
    "total_value_impact": -15000.00,
    "total_cost_impact": -12000.00,
    "by_reason_type": [
      {
        "reason_type": "damage",
        "count": 45,
        "total_value": -8000.00
      },
      {
        "reason_type": "expiry",
        "count": 30,
        "total_value": -5000.00
      }
    ],
    "by_adjustment_type": [
      {
        "adjustment_type": "decrease",
        "count": 100,
        "total_value": -20000.00
      },
      {
        "adjustment_type": "increase",
        "count": 50,
        "total_value": 5000.00
      }
    ]
  }
}
```

---

### 10. Get All Activities

**Endpoint:**
```
GET /api/stock-adjustments/activities
```

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `adjustment_id` | UUID | No | Filter by specific adjustment |
| `product_id` | UUID | No | Filter by product |
| `action` | String | No | Filter by action type |
| `start_date` | DateTime | No | From date |
| `end_date` | DateTime | No | To date |
| `per_page` | Integer | No | Results per page (default: 50) |

**Success Response:**
```json
{
  "status": "success",
  "data": {
    "current_page": 1,
    "data": [
      {
        "id": "activity-uuid",
        "user": {
          "id": "user-uuid",
          "first_name": "John",
          "last_name": "Admin",
          "email": "user@example.com",
          "full_name": "John Admin"
        },
        "action": "stock_adjustment_created",
        "description": "Created stock adjustment ADJ-20251104-0001 for product: Test Product",
        "ip_address": "192.168.1.1",
        "user_agent": "Mozilla/5.0...",
        "properties": {
          "adjustment_id": "588370c9-a270-46bc-a6c3-06e59c8ada4b",
          "adjustment_number": "ADJ-20251104-0001",
          "product_id": "d6f33ea4-86d4-4293-9353-3b82d750db7b",
          "product_name": "Test Product",
          "adjustment_type": "decrease",
          "reason_type": "damage",
          "quantity_adjusted": -10,
          "quantity_before": 20,
          "quantity_after": 10,
          "status": "draft"
        },
        "created_at": "2025-11-04T14:02:03.000000Z"
      }
    ],
    "total": 1,
    "per_page": 50,
    "current_page": 1
  }
}
```

---

### 11. Get Activities for Specific Adjustment

**Endpoint:**
```
GET /api/stock-adjustments/{id}/activities
```

**Success Response:**
```json
{
  "status": "success",
  "data": {
    "adjustment": {
      "id": "588370c9-a270-46bc-a6c3-06e59c8ada4b",
      "adjustment_number": "ADJ-20251104-0001",
      "...": "...full adjustment object"
    },
    "activities": [
      {
        "id": "activity-uuid",
        "action": "stock_adjustment_created",
        "description": "Created stock adjustment ADJ-20251104-0001",
        "user": {...},
        "created_at": "2025-11-04T14:02:03.000000Z"
      },
      {
        "id": "activity-uuid-2",
        "action": "stock_adjustment_updated",
        "description": "Updated stock adjustment ADJ-20251104-0001",
        "user": {...},
        "created_at": "2025-11-04T14:15:00.000000Z"
      },
      {
        "id": "activity-uuid-3",
        "action": "stock_adjustment_approved",
        "description": "Approved stock adjustment ADJ-20251104-0001",
        "user": {...},
        "created_at": "2025-11-04T15:30:00.000000Z"
      }
    ],
    "activity_count": 3
  }
}
```

---

## Data Models

### Adjustment Types

| Value | Description | Quantity Sign |
|-------|-------------|---------------|
| `increase` | Add stock | Positive |
| `decrease` | Remove stock | Negative |
| `set` | Set absolute value | Can be positive or negative |

---

### Reason Types

| Value | Description | Common Use Case |
|-------|-------------|-----------------|
| `damage` | Damaged goods | Products broken during handling |
| `expiry` | Expired products | Past expiration date |
| `theft` | Stolen items | Security incidents |
| `loss` | Lost inventory | Cannot locate items |
| `found` | Found inventory | Located missing items |
| `recount` | Recount adjustment | Physical count correction |
| `correction` | Data correction | Fix data entry errors |
| `return` | Customer return | Restocking returned items |
| `donation` | Donated items | Charitable donations |
| `sample` | Sample items | Product samples given out |
| `write_off` | Write-off | Accounting write-offs |
| `other` | Other reasons | Any other reason |

---

### Activity Types

| Action | Description | When Triggered |
|--------|-------------|----------------|
| `stock_adjustment_created` | Adjustment created | POST /api/stock-adjustments |
| `stock_adjustment_updated` | Adjustment updated | PATCH /api/stock-adjustments/{id} |
| `stock_adjustment_approved` | Adjustment approved | POST /api/stock-adjustments/{id}/approve |
| `stock_adjustment_rejected` | Adjustment rejected | POST /api/stock-adjustments/{id}/reject |
| `stock_adjustment_applied` | Adjustment applied to inventory | POST /api/stock-adjustments/{id}/apply |
| `stock_adjustment_deleted` | Draft adjustment deleted | DELETE /api/stock-adjustments/{id} |

---

## User Permissions

The following permissions control access to stock adjustment features:

| Permission | Description | Can Perform |
|------------|-------------|-------------|
| `can_view_products` | View adjustments | List, view details, view activities |
| `can_update_products` | Create/update adjustments | Create, update, apply adjustments |
| `can_delete_products` | Delete adjustments | Delete draft adjustments |
| `can_approve_adjustments` | Approve/reject adjustments | Approve or reject pending adjustments |
| `can_manage_system` | Full system access | All operations |
| `can_manage_company` | Company-wide access | All operations within company |

---

## Common Use Cases

### Use Case 1: Create and Submit for Approval

**Step 1: Create Draft**
```
POST /api/stock-adjustments
{
  "product_id": "uuid",
  "adjustment_type": "decrease",
  "reason_type": "damage",
  "quantity_adjusted": -10,
  "reason": "Damaged during inspection",
  "status": "draft"
}
```

**Step 2: Review and Update (Optional)**
```
PATCH /api/stock-adjustments/{id}
{
  "notes": "Added additional notes"
}
```

**Step 3: Submit for Approval**
```
PATCH /api/stock-adjustments/{id}
{
  "status": "pending"
}
```

---

### Use Case 2: Manager Approval Flow

**Step 1: View Pending Adjustments**
```
GET /api/stock-adjustments?status=pending
```

**Step 2: Review Details**
```
GET /api/stock-adjustments/{id}
```

**Step 3: View Activity History**
```
GET /api/stock-adjustments/{id}/activities
```

**Step 4: Approve**
```
POST /api/stock-adjustments/{id}/approve
```

**Step 5: Apply to Inventory**
```
POST /api/stock-adjustments/{id}/apply
```

---

### Use Case 3: Quick Adjustment (Experienced User)

For users with full permissions, create and immediately complete:

**Create as Pending**
```
POST /api/stock-adjustments
{
  "product_id": "uuid",
  "adjustment_type": "decrease",
  "reason_type": "damage",
  "quantity_adjusted": -5,
  "reason": "Minor damage found",
  "status": "pending"
}
```

**Approve**
```
POST /api/stock-adjustments/{id}/approve
```

**Apply**
```
POST /api/stock-adjustments/{id}/apply
```

---

### Use Case 4: Bulk Recount Adjustment

After physical inventory count:

**Step 1: Get Current Stock**
```
GET /api/products/{id}
```

**Step 2: Calculate Difference**
```
Current Stock: 100
Physical Count: 95
Adjustment Needed: -5
```

**Step 3: Create Adjustment**
```
POST /api/stock-adjustments
{
  "product_id": "uuid",
  "adjustment_type": "decrease",
  "reason_type": "recount",
  "quantity_adjusted": -5,
  "reason": "Physical count discrepancy - Annual inventory",
  "notes": "Counted by: John Doe, Date: 2025-11-04"
}
```

---

### Use Case 5: Found Inventory

When finding previously missing items:

```
POST /api/stock-adjustments
{
  "product_id": "uuid",
  "adjustment_type": "increase",
  "reason_type": "found",
  "quantity_adjusted": 10,
  "reason": "Found items in secondary storage location",
  "notes": "Located in warehouse section B-12"
}
```

---

## Error Handling

### Common Error Responses

**401 Unauthorized**
```json
{
  "message": "Unauthenticated."
}
```
**Solution:** Ensure valid Bearer token is included in request.

---

**403 Forbidden**
```json
{
  "message": "Unauthorized"
}
```
**Solution:** User lacks required permission for this operation.

---

**404 Not Found**
```json
{
  "status": "error",
  "message": "Stock adjustment not found"
}
```
**Solution:** Verify the adjustment ID exists and belongs to user's company.

---

**422 Validation Error**
```json
{
  "status": "error",
  "message": "Validation failed",
  "errors": {
    "quantity_adjusted": ["The quantity adjusted field is required."],
    "product_id": ["The selected product id is invalid."]
  }
}
```
**Solution:** Fix validation errors in request payload.

---

**400 Bad Request**
```json
{
  "status": "error",
  "message": "Only draft adjustments can be updated"
}
```
**Solution:** Check adjustment status before attempting operation.

---

**500 Internal Server Error**
```json
{
  "status": "error",
  "message": "A database error occurred. Please refresh the page or contact support if this continues.",
  "error_type": "database_error"
}
```
**Solution:** Contact backend team or try again later.

---

## Best Practices

### 1. Always Provide Detailed Reasons
```json
{
  "reason": "Product damaged during storage inspection",
  "notes": "Found damaged items in warehouse sector A, shelf 3. Water damage from roof leak."
}
```

### 2. Use Appropriate Reason Types
Match the reason type to the actual situation for better reporting and analytics.

### 3. Attach Supporting Documentation
```json
{
  "attachments": [
    "https://storage.example.com/damage-photo-1.jpg",
    "https://storage.example.com/damage-photo-2.jpg"
  ]
}
```

### 4. Track Activities
Regularly check activity logs for audit trail:
```
GET /api/stock-adjustments/{id}/activities
```

### 5. Use Filters Effectively
Filter by status to show relevant adjustments to users:
```
GET /api/stock-adjustments?status=pending  // For approvers
GET /api/stock-adjustments?status=draft    // For creators
```

### 6. Monitor Statistics
Use statistics endpoint for dashboard displays:
```
GET /api/stock-adjustments/statistics?start_date=2025-11-01
```

---

## UI Recommendations

### List View
- Display: adjustment number, product, quantity, status, date
- Filter by: status, date range, product
- Sort by: date (newest first)
- Status badges with colors (draft: gray, pending: yellow, approved: blue, completed: green, rejected: red)

### Detail View
- Show full adjustment details
- Display activity timeline
- Show before/after quantities
- Include approval/rejection information
- Show attached documents/photos

### Create/Edit Form
- Product selector with search
- Adjustment type selector (increase/decrease/set)
- Reason type dropdown
- Quantity input with validation
- Reason text area (required)
- Notes text area (optional)
- File upload for attachments
- Save as draft or submit buttons

### Approval View
- List of pending adjustments
- Quick view of details
- Approve/Reject buttons
- Rejection reason modal
- Bulk approve option (future enhancement)

---

## Notes for Frontend Developers

1. **Date Handling**: All dates are in UTC. Convert to user's timezone for display.

2. **Decimal Precision**: Financial values use 2 decimal places. Use proper number formatting.

3. **Negative Quantities**: For decreases, quantity_adjusted is negative (e.g., -10).

4. **Status Flow**: Validate status transitions on frontend to prevent invalid operations.

5. **Real-time Updates**: Consider implementing polling or websockets for approval notifications.

6. **Optimistic UI**: Show loading states during API calls, revert on error.

7. **Error Messages**: Display validation errors next to relevant form fields.

8. **Activity Feed**: Format activity logs as a timeline for better UX.

9. **Permission Checks**: Hide/disable UI elements based on user permissions.

10. **Search**: Implement debounced search for filtering large lists.

---

## Testing Credentials

**Test User:**
```
Email: sinchwara@gmail.com
Password: password123
```

**Base URL:**
```
http://localhost:8000/api
```

---

## Support

For questions or issues with the API:
- Backend Team: backend-team@example.com
- API Documentation: See `/docs/STOCK_ADJUSTMENT_API.md`
- Postman Collection: See `/docs/Stock_Adjustment_API.postman_collection.json`
