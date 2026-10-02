# Order Dispatch Approval System Guide

## Overview

The Order Dispatch Approval System provides a simplified, sequential approval workflow for dispatching orders. Companies can configure default approvers who must approve dispatches in a specific order before they can be sent for logistics and delivery.

## Key Features

- **Company-Level Default Approvers**: Set default approval chain once, auto-apply to all new dispatches
- **Sequential Approval**: Approvers must approve in order (Approver 1 → Approver 2 → Approver 3)
- **Flexible Configuration**: Override default approvers per dispatch or use company defaults
- **Auto-Skip Inactive Users**: System automatically skips deleted/inactive users from approval chain
- **Progress Tracking**: Real-time approval progress (e.g., 2/3 approved, 67%)
- **Audit Trail**: Track who approved, when, and their comments

---

## System Architecture

### Database Tables

1. **company_settings** - Stores company-level configurations including default approvers
2. **order_dispatches** - Main dispatch table with `approvers` JSONB field
3. **orders** - Source orders for dispatches
4. **users** - Approver users

### Approval Data Structure

Approvers are stored as a JSON array in `order_dispatches.approvers`:

```json
[
  {
    "user_id": "uuid-of-user-1",
    "order": 1,
    "status": "approved",
    "approved_at": "2025-11-19 14:30:00",
    "comments": "Looks good, approved by sales"
  },
  {
    "user_id": "uuid-of-user-2",
    "order": 2,
    "status": "pending",
    "approved_at": null,
    "comments": null
  },
  {
    "user_id": "uuid-of-user-3",
    "order": 3,
    "status": "pending",
    "approved_at": null,
    "comments": null
  }
]
```

### Status Flow

**Dispatch Status:**
- `draft` → `pending` → `in_progress` → `approved` → `in_transit` → `delivered`

**Approval Status:**
- `draft` → `pending` → `in_progress` → `approved` (or `rejected`)

---

## Step-by-Step Implementation Guide

### Step 1: Configure Company Default Approvers

Set up default approvers at the company level. These will be automatically applied to all new dispatches.

**Endpoint:** `GET /api/company/dispatch-settings`

**Headers:**
```json
{
  "Authorization": "Bearer {token}",
  "Accept": "application/json"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "require_approval": true,
    "default_approvers": [
      {
        "user_id": "29590834-4d79-46b7-ab0b-fb6be2842c95",
        "order": 1,
        "user": {
          "id": "29590834-4d79-46b7-ab0b-fb6be2842c95",
          "first_name": "John",
          "last_name": "Admin",
          "email": "sales@company.com",
          "role": "Sales Manager"
        }
      },
      {
        "user_id": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
        "order": 2,
        "user": {
          "id": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
          "first_name": "Jane",
          "last_name": "Smith",
          "email": "warehouse@company.com",
          "role": "Warehouse Manager"
        }
      }
    ]
  }
}
```

---

### Step 2: Update Company Default Approvers

Configure or update the default approval chain for your company.

**Endpoint:** `PUT /api/company/dispatch-settings`

**Headers:**
```json
{
  "Authorization": "Bearer {token}",
  "Content-Type": "application/json",
  "Accept": "application/json"
}
```

**Payload:**
```json
{
  "require_approval": true,
  "default_approvers": [
    {
      "user_id": "29590834-4d79-46b7-ab0b-fb6be2842c95",
      "order": 1
    },
    {
      "user_id": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
      "order": 2
    },
    {
      "user_id": "e5f6g7h8-90ij-klmn-opqr-stuvwxyz1234",
      "order": 3
    }
  ]
}
```

**Validation Rules:**
- `require_approval`: boolean, required
- `default_approvers`: array, required, min: 1 approver
- `default_approvers.*.user_id`: UUID, required, must exist in users table
- `default_approvers.*.order`: integer, required, determines approval sequence

**Response:**
```json
{
  "success": true,
  "message": "Dispatch approval settings updated successfully",
  "data": {
    "require_approval": true,
    "default_approvers": [
      {
        "user_id": "29590834-4d79-46b7-ab0b-fb6be2842c95",
        "order": 1
      },
      {
        "user_id": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
        "order": 2
      },
      {
        "user_id": "e5f6g7h8-90ij-klmn-opqr-stuvwxyz1234",
        "order": 3
      }
    ]
  }
}
```

---

### Step 3: Get Potential Approvers

Retrieve list of all active users in the company who can be set as approvers.

**Endpoint:** `GET /api/company/dispatch-settings/potential-approvers`

**Headers:**
```json
{
  "Authorization": "Bearer {token}",
  "Accept": "application/json"
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "29590834-4d79-46b7-ab0b-fb6be2842c95",
      "first_name": "John",
      "last_name": "Admin",
      "email": "john@company.com",
      "role": "Sales Manager",
      "is_active": true
    },
    {
      "id": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
      "first_name": "Jane",
      "last_name": "Smith",
      "email": "jane@company.com",
      "role": "Warehouse Manager",
      "is_active": true
    }
  ]
}
```

---

### Step 4: Create Order Dispatch (Draft)

Create a new dispatch from an existing order. The dispatch starts in `draft` status and automatically inherits default approvers from company settings.

**Endpoint:** `POST /api/order-dispatches`

**Headers:**
```json
{
  "Authorization": "Bearer {token}",
  "Content-Type": "application/json",
  "Accept": "application/json"
}
```

**Payload (Using Default Approvers):**
```json
{
  "order_id": "6668bb12-af73-4912-9472-0d2c9d0f2e9c",
  "delivery_location_id": "d5e6f7g8-90hi-jklm-nopq-rstuvwxyz123",
  "notes": "Urgent delivery required",
  "items": [
    {
      "order_item_id": "item-uuid-1",
      "quantity_to_dispatch": 100
    },
    {
      "order_item_id": "item-uuid-2",
      "quantity_to_dispatch": 50
    }
  ]
}
```

**Payload (Custom Approvers - Override Defaults):**
```json
{
  "order_id": "6668bb12-af73-4912-9472-0d2c9d0f2e9c",
  "delivery_location_id": "d5e6f7g8-90hi-jklm-nopq-rstuvwxyz123",
  "notes": "Urgent delivery required",
  "custom_approvers": [
    {
      "user_id": "user-uuid-1",
      "order": 1
    },
    {
      "user_id": "user-uuid-2",
      "order": 2
    }
  ],
  "items": [
    {
      "order_item_id": "item-uuid-1",
      "quantity_to_dispatch": 100
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Order dispatch created successfully",
  "data": {
    "id": "19be6821-b10e-443d-8f25-fbd8adf8bc36",
    "dispatch_number": "ODI-0001",
    "order_id": "6668bb12-af73-4912-9472-0d2c9d0f2e9c",
    "company_id": "14fafcd8-137b-4725-a6e9-7542ad27a6ed",
    "delivery_location_id": "d5e6f7g8-90hi-jklm-nopq-rstuvwxyz123",
    "status": "draft",
    "approval_status": "draft",
    "notes": "Urgent delivery required",
    "created_at": "2025-11-19 14:25:00",
    "approvers": [
      {
        "user_id": "29590834-4d79-46b7-ab0b-fb6be2842c95",
        "order": 1,
        "status": "pending",
        "approved_at": null,
        "comments": null
      },
      {
        "user_id": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
        "order": 2,
        "status": "pending",
        "approved_at": null,
        "comments": null
      }
    ],
    "items": [
      {
        "id": "dispatch-item-uuid",
        "order_item_id": "item-uuid-1",
        "quantity_dispatched": 100,
        "product": {
          "id": "product-uuid",
          "name": "Coca Cola 500ml",
          "product_code": "COKE-500"
        }
      }
    ],
    "order": {
      "order_number": "ORD-4026",
      "customer": {
        "name": "ABC Stores Ltd"
      }
    }
  }
}
```

---

### Step 5: Update Dispatch (Draft Only)

Update dispatch details including approvers. **Only allowed when status is `draft`**.

**Endpoint:** `PUT /api/order-dispatches/{dispatch_id}`

**Headers:**
```json
{
  "Authorization": "Bearer {token}",
  "Content-Type": "application/json",
  "Accept": "application/json"
}
```

**Payload:**
```json
{
  "delivery_location_id": "new-location-uuid",
  "notes": "Updated delivery notes",
  "approvers": [
    {
      "user_id": "user-uuid-1",
      "order": 1
    },
    {
      "user_id": "user-uuid-2",
      "order": 2
    },
    {
      "user_id": "user-uuid-3",
      "order": 3
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Order dispatch updated successfully",
  "data": {
    "id": "19be6821-b10e-443d-8f25-fbd8adf8bc36",
    "dispatch_number": "ODI-0001",
    "status": "draft",
    "approval_status": "draft",
    "notes": "Updated delivery notes",
    "approvers": [
      {
        "user_id": "user-uuid-1",
        "order": 1,
        "status": "pending",
        "approved_at": null,
        "comments": null
      },
      {
        "user_id": "user-uuid-2",
        "order": 2,
        "status": "pending",
        "approved_at": null,
        "comments": null
      },
      {
        "user_id": "user-uuid-3",
        "order": 3,
        "status": "pending",
        "approved_at": null,
        "comments": null
      }
    ]
  }
}
```

**Error Response (If Not Draft):**
```json
{
  "success": false,
  "message": "Cannot update dispatch that has been submitted for approval",
  "errors": {
    "status": ["Dispatch can only be edited in draft status"]
  }
}
```

---

### Step 6: Submit Dispatch for Approval

Submit the draft dispatch for approval. Changes status from `draft` to `pending`.

**Endpoint:** `POST /api/order-dispatches/{dispatch_id}/submit`

**Headers:**
```json
{
  "Authorization": "Bearer {token}",
  "Accept": "application/json"
}
```

**Payload:** None required

**Response:**
```json
{
  "success": true,
  "message": "Dispatch submitted for approval",
  "data": {
    "id": "19be6821-b10e-443d-8f25-fbd8adf8bc36",
    "dispatch_number": "ODI-0001",
    "status": "pending",
    "approval_status": "pending",
    "current_approver": {
      "id": "29590834-4d79-46b7-ab0b-fb6be2842c95",
      "first_name": "John",
      "last_name": "Admin",
      "email": "john@company.com"
    },
    "approval_progress": {
      "total": 3,
      "approved": 0,
      "pending": 3,
      "percentage": 0
    }
  }
}
```

**Error Response (Already Submitted):**
```json
{
  "success": false,
  "message": "Dispatch has already been submitted for approval"
}
```

**Error Response (No Approvers):**
```json
{
  "success": false,
  "message": "Cannot submit dispatch without approvers"
}
```

---

### Step 7: View Dispatch Details

Get current status and approval chain of a dispatch.

**Endpoint:** `GET /api/order-dispatches/{dispatch_id}`

**Headers:**
```json
{
  "Authorization": "Bearer {token}",
  "Accept": "application/json"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "19be6821-b10e-443d-8f25-fbd8adf8bc36",
    "dispatch_number": "ODI-0001",
    "order_number": "ORD-4026",
    "status": "in_progress",
    "approval_status": "in_progress",
    "notes": "Urgent delivery required",
    "created_at": "2025-11-19 14:25:00",
    "approval_chain": [
      {
        "order": 1,
        "status": "approved",
        "approved_at": "2025-11-19 14:30:00",
        "comments": "Looks good, approved by sales",
        "approver": {
          "id": "29590834-4d79-46b7-ab0b-fb6be2842c95",
          "first_name": "John",
          "last_name": "Admin",
          "email": "john@company.com",
          "role": "Sales Manager"
        }
      },
      {
        "order": 2,
        "status": "pending",
        "approved_at": null,
        "comments": null,
        "approver": {
          "id": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
          "first_name": "Jane",
          "last_name": "Smith",
          "email": "jane@company.com",
          "role": "Warehouse Manager"
        }
      },
      {
        "order": 3,
        "status": "pending",
        "approved_at": null,
        "comments": null,
        "approver": {
          "id": "e5f6g7h8-90ij-klmn-opqr-stuvwxyz1234",
          "first_name": "Mike",
          "last_name": "Johnson",
          "email": "mike@company.com",
          "role": "Finance Manager"
        }
      }
    ],
    "current_approver": {
      "id": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
      "first_name": "Jane",
      "last_name": "Smith",
      "email": "jane@company.com"
    },
    "approval_progress": {
      "total": 3,
      "approved": 1,
      "pending": 2,
      "percentage": 33.33
    },
    "items": [
      {
        "id": "dispatch-item-uuid",
        "quantity_dispatched": 100,
        "product": {
          "name": "Coca Cola 500ml",
          "product_code": "COKE-500"
        }
      }
    ]
  }
}
```

---

### Step 8: Approve Dispatch (Current Approver)

Current approver in the sequence approves the dispatch. System automatically moves to next approver or marks as fully approved.

**Endpoint:** `POST /api/order-dispatches/{dispatch_id}/approve`

**Headers:**
```json
{
  "Authorization": "Bearer {token}",
  "Content-Type": "application/json",
  "Accept": "application/json"
}
```

**Payload:**
```json
{
  "comments": "Stock verified and ready for dispatch"
}
```

**Response (Not Final Approver):**
```json
{
  "success": true,
  "message": "Dispatch approved successfully",
  "data": {
    "id": "19be6821-b10e-443d-8f25-fbd8adf8bc36",
    "dispatch_number": "ODI-0001",
    "status": "pending",
    "approval_status": "in_progress",
    "approved_by": {
      "id": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
      "first_name": "Jane",
      "last_name": "Smith",
      "email": "jane@company.com"
    },
    "approved_at": "2025-11-19 14:35:00",
    "comments": "Stock verified and ready for dispatch",
    "next_approver": {
      "id": "e5f6g7h8-90ij-klmn-opqr-stuvwxyz1234",
      "first_name": "Mike",
      "last_name": "Johnson",
      "email": "mike@company.com"
    },
    "approval_progress": {
      "total": 3,
      "approved": 2,
      "pending": 1,
      "percentage": 66.67
    }
  }
}
```

**Response (Final Approver):**
```json
{
  "success": true,
  "message": "Dispatch fully approved and ready for logistics",
  "data": {
    "id": "19be6821-b10e-443d-8f25-fbd8adf8bc36",
    "dispatch_number": "ODI-0001",
    "status": "approved",
    "approval_status": "approved",
    "final_approved_at": "2025-11-19 14:40:00",
    "approved_by": {
      "id": "e5f6g7h8-90ij-klmn-opqr-stuvwxyz1234",
      "first_name": "Mike",
      "last_name": "Johnson",
      "email": "mike@company.com"
    },
    "approval_progress": {
      "total": 3,
      "approved": 3,
      "pending": 0,
      "percentage": 100
    },
    "is_fully_approved": true
  }
}
```

**Error Response (Not Current Approver):**
```json
{
  "success": false,
  "message": "You are not authorized to approve this dispatch at this stage",
  "error": "Current approver is Jane Smith (jane@company.com)"
}
```

**Error Response (Already Approved):**
```json
{
  "success": false,
  "message": "This dispatch has already been fully approved"
}
```

---

### Step 9: Reject Dispatch (Current Approver)

Current approver rejects the dispatch. This immediately cancels the entire dispatch.

**Endpoint:** `POST /api/order-dispatches/{dispatch_id}/reject`

**Headers:**
```json
{
  "Authorization": "Bearer {token}",
  "Content-Type": "application/json",
  "Accept": "application/json"
}
```

**Payload:**
```json
{
  "reason": "Insufficient stock available in warehouse"
}
```

**Validation Rules:**
- `reason`: string, required, min: 10 characters

**Response:**
```json
{
  "success": true,
  "message": "Dispatch rejected",
  "data": {
    "id": "19be6821-b10e-443d-8f25-fbd8adf8bc36",
    "dispatch_number": "ODI-0001",
    "status": "cancelled",
    "approval_status": "rejected",
    "rejected_by": {
      "id": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
      "first_name": "Jane",
      "last_name": "Smith",
      "email": "jane@company.com"
    },
    "rejected_at": "2025-11-19 14:35:00",
    "rejection_reason": "Insufficient stock available in warehouse"
  }
}
```

**Error Response (Not Current Approver):**
```json
{
  "success": false,
  "message": "You are not authorized to reject this dispatch at this stage"
}
```

---

### Step 10: Create Logistics (After Full Approval)

Once dispatch is fully approved, create logistics entries for tracking delivery.

**Endpoint:** `POST /api/order-dispatches/{dispatch_id}/create-logistics`

**Headers:**
```json
{
  "Authorization": "Bearer {token}",
  "Content-Type": "application/json",
  "Accept": "application/json"
}
```

**Payload:**
```json
{
  "vehicle_id": "vehicle-uuid",
  "driver_id": "driver-uuid",
  "scheduled_delivery_date": "2025-11-20",
  "notes": "Handle with care"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Logistics created successfully",
  "data": {
    "dispatch_id": "19be6821-b10e-443d-8f25-fbd8adf8bc36",
    "dispatch_number": "ODI-0001",
    "status": "in_transit",
    "logistics": {
      "id": "logistics-uuid",
      "vehicle": {
        "registration": "KAA 123A",
        "type": "Truck"
      },
      "driver": {
        "name": "John Driver",
        "phone": "+254712345678"
      },
      "scheduled_delivery_date": "2025-11-20",
      "created_at": "2025-11-19 14:45:00"
    }
  }
}
```

**Error Response (Not Approved):**
```json
{
  "success": false,
  "message": "Cannot create logistics for dispatch that is not fully approved"
}
```

---

### Step 11: Mark as Delivered

Mark the dispatch as delivered and record delivered/damaged quantities.

**Endpoint:** `POST /api/order-dispatches/{dispatch_id}/mark-delivered`

**Headers:**
```json
{
  "Authorization": "Bearer {token}",
  "Content-Type": "application/json",
  "Accept": "application/json"
}
```

**Payload:**
```json
{
  "delivered_at": "2025-11-20 10:30:00",
  "received_by": "Store Manager",
  "items": [
    {
      "dispatch_item_id": "dispatch-item-uuid-1",
      "quantity_delivered": 100,
      "quantity_damaged": 0
    },
    {
      "dispatch_item_id": "dispatch-item-uuid-2",
      "quantity_delivered": 48,
      "quantity_damaged": 2
    }
  ],
  "delivery_notes": "All items received in good condition"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Dispatch marked as delivered",
  "data": {
    "id": "19be6821-b10e-443d-8f25-fbd8adf8bc36",
    "dispatch_number": "ODI-0001",
    "status": "delivered",
    "delivered_at": "2025-11-20 10:30:00",
    "received_by": "Store Manager",
    "items": [
      {
        "product": "Coca Cola 500ml",
        "quantity_dispatched": 100,
        "quantity_delivered": 100,
        "quantity_damaged": 0
      },
      {
        "product": "Fanta Orange 500ml",
        "quantity_dispatched": 50,
        "quantity_delivered": 48,
        "quantity_damaged": 2
      }
    ]
  }
}
```

---

## Complete Workflow Example

### Scenario: 3-Person Sequential Approval

1. **Company Admin** configures default approvers:
   - Sales Manager (1st approver)
   - Warehouse Manager (2nd approver)
   - Finance Manager (3rd approver)

2. **Order Creator** creates dispatch from order:
   - Dispatch created in `draft` status
   - Auto-inherits 3 approvers from company settings
   - Dispatch number: `ODI-0001`

3. **Order Creator** submits for approval:
   - Status: `draft` → `pending`
   - Approval Status: `draft` → `pending`
   - Current Approver: Sales Manager

4. **Sales Manager** (1st approver) approves:
   - Comments: "Order verified, customer credit OK"
   - Status: `pending` (unchanged)
   - Approval Status: `pending` → `in_progress`
   - Progress: 1/3 (33%)
   - Current Approver: Warehouse Manager

5. **Warehouse Manager** (2nd approver) approves:
   - Comments: "Stock available and reserved"
   - Status: `pending` (unchanged)
   - Approval Status: `in_progress` (unchanged)
   - Progress: 2/3 (67%)
   - Current Approver: Finance Manager

6. **Finance Manager** (3rd approver) approves:
   - Comments: "Final approval granted"
   - Status: `pending` → `approved`
   - Approval Status: `in_progress` → `approved`
   - Progress: 3/3 (100%)
   - `final_approved_at` timestamp recorded

7. **Logistics Coordinator** creates logistics:
   - Assigns vehicle and driver
   - Status: `approved` → `in_transit`
   - Scheduled delivery date set

8. **Driver** marks as delivered:
   - Records delivered quantities
   - Status: `in_transit` → `delivered`
   - Delivery timestamp recorded

---

## Best Practices

### 1. Setting Up Approvers

- **Minimum 1 approver required** - System validates at least one approver exists
- **Logical sequence** - Order approvers by business logic (Sales → Warehouse → Finance)
- **Active users only** - System auto-filters inactive users, but keep settings updated
- **Clear roles** - Assign approvers based on their responsibilities and authority

### 2. Approval Comments

- **Be specific** - Explain what you verified or approved
- **Document concerns** - Note any issues found even if approving
- **Use for audit** - Comments become part of permanent audit trail
- **Required for rejection** - Minimum 10 characters to explain rejection reason

### 3. Editing Dispatches

- **Only in draft** - Once submitted, dispatch cannot be edited
- **Verify before submit** - Double-check all details including approvers
- **Use custom approvers** - Override defaults when needed for special cases

### 4. Sequential Approval

- **Cannot skip** - Approver 2 cannot approve until Approver 1 approves
- **Same user multiple times** - Allowed, each step processed separately
- **No parallel approval** - All approvals must be sequential

### 5. Rejection Handling

- **Immediate cancellation** - Rejection at any stage cancels entire dispatch
- **Create new dispatch** - Must create new dispatch to try again
- **Document reason** - Provide clear rejection reason for audit trail

---

## Error Handling

### Common Error Responses

**401 Unauthorized:**
```json
{
  "message": "Unauthenticated"
}
```

**403 Forbidden:**
```json
{
  "success": false,
  "message": "You do not have permission to perform this action"
}
```

**404 Not Found:**
```json
{
  "success": false,
  "message": "Order dispatch not found"
}
```

**422 Validation Error:**
```json
{
  "success": false,
  "message": "The given data was invalid",
  "errors": {
    "order_id": ["The order id field is required"],
    "items": ["At least one dispatch item is required"],
    "approvers.0.user_id": ["The selected user does not belong to your company"]
  }
}
```

**500 Server Error:**
```json
{
  "success": false,
  "message": "An error occurred while processing your request",
  "error": "Detailed error message"
}
```

---

## API Endpoints Summary

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/company/dispatch-settings` | Get company default approvers | Yes |
| PUT | `/api/company/dispatch-settings` | Update company default approvers | Yes (Admin) |
| GET | `/api/company/dispatch-settings/potential-approvers` | Get list of users who can be approvers | Yes |
| POST | `/api/order-dispatches` | Create new dispatch | Yes |
| GET | `/api/order-dispatches/{id}` | Get dispatch details | Yes |
| PUT | `/api/order-dispatches/{id}` | Update dispatch (draft only) | Yes |
| DELETE | `/api/order-dispatches/{id}` | Delete dispatch (draft only) | Yes |
| POST | `/api/order-dispatches/{id}/submit` | Submit dispatch for approval | Yes |
| POST | `/api/order-dispatches/{id}/approve` | Approve dispatch (current approver) | Yes |
| POST | `/api/order-dispatches/{id}/reject` | Reject dispatch (current approver) | Yes |
| POST | `/api/order-dispatches/{id}/create-logistics` | Create logistics (after approval) | Yes |
| POST | `/api/order-dispatches/{id}/mark-delivered` | Mark as delivered | Yes |

---

## Testing

### Test Script

A complete test script is available at `/test_simplified_approval.php` that demonstrates:
- Configuring company default approvers
- Creating orders and dispatches
- Sequential approval workflow
- Progress tracking
- Full approval completion

Run the test:
```bash
php test_simplified_approval.php
```

---

## Migration Guide

### From Old Workflow System

If migrating from the complex workflow system:

1. **Backup data** - Export existing workflow configurations
2. **Run migrations** - Execute new migration files
3. **Configure defaults** - Set company default approvers
4. **Test thoroughly** - Verify approval flow works correctly
5. **Remove old code** - Clean up workflow traits and services

### Database Changes

**Removed:**
- `workflow_instance_id` column
- `approved_by` column
- References to workflow tables

**Added:**
- `approvers` JSONB column
- `final_approved_at` timestamp
- `approval_status` and `status` enum values updated

---

## Support & Troubleshooting

### Issue: "You are not the current approver"

**Cause:** Trying to approve out of sequence  
**Solution:** Wait for previous approver to approve first

### Issue: "Cannot update dispatch that has been submitted"

**Cause:** Trying to edit dispatch after submission  
**Solution:** Only edit dispatches in `draft` status

### Issue: "No approvers configured"

**Cause:** Company has no default approvers and none provided  
**Solution:** Configure company default approvers first

### Issue: Approver not appearing in list

**Cause:** User is inactive or deleted  
**Solution:** Ensure user is active in the system

---

## Changelog

### Version 2.0 (November 2025)
- ✅ Removed complex workflow infrastructure
- ✅ Implemented simplified JSONB-based approval system
- ✅ Added company-level default approvers
- ✅ Added sequential approval with progress tracking
- ✅ Added auto-skip for inactive users
- ✅ Improved API responses with detailed approval chain
- ✅ Added comprehensive validation and error handling

### Version 1.0
- ❌ Complex workflow system (deprecated)
- ❌ Multiple workflow tables (deprecated)
- ❌ Workflow seeders and permissions (deprecated)

---

**Last Updated:** November 19, 2025  
**Document Version:** 2.0  
**System Version:** Laravel 10.x with PostgreSQL
