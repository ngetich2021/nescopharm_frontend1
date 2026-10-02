# Order Dispatch Frontend Implementation Guide

**Version:** 1.0  
**Last Updated:** November 19, 2025  
**System:** Cherry API - Order Dispatch Management

---

## Table of Contents

1. [Overview](#overview)
2. [Workflow Process](#workflow-process)
3. [User Roles & Permissions](#user-roles--permissions)
4. [API Endpoints](#api-endpoints)
5. [Data Models](#data-models)
6. [Workflow States](#workflow-states)
7. [Step-by-Step Integration](#step-by-step-integration)
8. [Error Handling](#error-handling)
9. [Best Practices](#best-practices)

---

## Overview

### What is Order Dispatch?

The Order Dispatch system enables the creation of dispatches from existing orders with a multi-step approval workflow. Once approved, dispatches can be assigned logistics (driver, vehicle) and tracked through delivery.

### Key Features

- **Automatic Item Population**: Dispatch items are automatically pulled from order items
- **Packaging Information**: Each item includes detailed packaging breakdown (cartons, pieces, etc.)
- **Multi-Step Approval**: Configurable workflow with role-based approvals
- **Conditional Steps**: Approval steps can be triggered based on conditions (e.g., total items ≥ 10)
- **Delivery Tracking**: Track delivered and damaged quantities per item
- **Logistics Integration**: Associate driver, vehicle, and delivery details

### System Flow

```
Order (Completed) 
    ↓
Order Dispatch (Draft) 
    ↓
Initiate Workflow (Pending)
    ↓
Multi-Step Approval (In Progress)
    ↓
Dispatch Approved
    ↓
Create Logistics Record (Assign Driver/Vehicle)
    ↓
Mark In Transit
    ↓
Mark Delivered (Track Quantities)
```

---

## Workflow Process

### Phase 1: Order Creation

**Prerequisite**: A completed order must exist in the system before creating a dispatch.

- Orders contain customer information, delivery location, and order items
- Each order item has product details, quantity, and pricing
- Order must be in a state that allows dispatch creation (typically "completed" or "confirmed")

### Phase 2: Dispatch Creation

**Action**: Create a new dispatch from an existing order.

**What Happens**:
1. System validates that the order exists and is eligible for dispatch
2. A new dispatch record is created with a unique dispatch number (format: `ODI-XXXXXXXX-0001`)
3. Dispatch items are **automatically created** from order items
4. Each dispatch item includes:
   - Product code, name, and variant information
   - Quantity to be dispatched
   - Packaging breakdown (e.g., `{"cartons": 5, "pieces": 20}`)
   - Reference to the original order item
5. Dispatch status is set to `draft`
6. Approval status is set to `draft`

**User Actions Required**:
- Select the source order
- Optionally add notes or special instructions
- Review auto-populated items before submission

### Phase 3: Workflow Initiation

**Action**: Submit the dispatch for approval.

**What Happens**:
1. System validates that the dispatch is in `draft` status
2. A workflow instance is created based on the company's "Order Dispatch Approval" workflow
3. Approval status changes from `draft` to `pending`
4. First approval step is activated
5. Notification is sent to the first approver(s)
6. Workflow status becomes `in_progress`

**Default Workflow Steps**:
1. **Sales Verification** (12-hour timeout, required)
2. **Warehouse Approval** (24-hour timeout, required)
3. **Operations Manager Approval** (24-hour timeout, conditional: total_items ≥ 10)

### Phase 4: Approval Process

**Action**: Designated approvers review and approve/reject each step.

**What Happens**:
- Each step must be completed by users with the appropriate role or permissions
- Approvers can view dispatch details, items, and packaging information
- Approvers can:
  - **Approve**: Move to the next step
  - **Reject**: Cancel the workflow and return dispatch to draft
  - **Add Comments**: Provide feedback or instructions
- Conditional steps may be automatically skipped if conditions aren't met
- If a step times out, escalation may occur (based on configuration)

**User Actions Required**:
- Review dispatch details and items
- Verify packaging information
- Check delivery location and customer information
- Make approval decision with optional comments

### Phase 5: Workflow Completion

**What Happens**:
- When all required steps are approved, the workflow completes automatically
- Dispatch `approval_status` changes to `approved`
- Dispatch `status` changes to `approved`
- `approved_by` and `approved_at` are set
- Dispatch is now ready for logistics creation

### Phase 6: Logistics Creation

**Action**: Assign driver, vehicle, and delivery details.

**What Happens**:
1. System creates a `Logistic` record linked to the dispatch
2. Records include:
   - Driver information (name, contact)
   - Vehicle details (registration, type)
   - Pickup and delivery locations
   - Estimated delivery date/time
3. Dispatch status can be updated to `in_transit` when driver departs

**User Actions Required**:
- Select or create driver record
- Select or create vehicle record
- Set estimated delivery time
- Optionally add logistics notes

### Phase 7: Delivery Tracking

**Action**: Mark items as delivered and track any damages.

**What Happens**:
1. For each dispatch item, record:
   - `delivered_quantity`: Number of units successfully delivered
   - `damaged_quantity`: Number of units damaged during transit
   - `delivery_notes`: Any special notes about the delivery
2. System validates that `delivered_quantity + damaged_quantity ≤ original quantity`
3. When all items are marked, dispatch status changes to `delivered`
4. `delivered_at` timestamp is recorded

**User Actions Required**:
- Confirm delivered quantities for each item
- Report any damaged items with quantities
- Add delivery notes if needed
- Obtain customer signature/confirmation (if applicable)

---

## User Roles & Permissions

### Required Permissions

| Permission | Description | Required For |
|------------|-------------|--------------|
| `can_view_order_dispatches` | View dispatch list and details | All users |
| `can_create_order_dispatches` | Create new dispatches from orders | Dispatch creators |
| `can_update_order_dispatches` | Edit draft dispatches | Dispatch creators |
| `can_delete_order_dispatches` | Delete draft dispatches | Dispatch creators |
| `can_dispatch_order_dispatches` | Initiate workflow and create logistics | Dispatch coordinators |
| `can_approve_order_dispatches` | Approve workflow steps | Approvers |

### Permission Alternatives

Users with `can_manage_system` or `can_manage_company` permissions can perform all operations.

### Role-Based Workflow Steps

Each approval step is typically assigned to specific roles:

1. **Sales Verification**: Sales Manager, Sales Supervisor
2. **Warehouse Approval**: Warehouse Manager, Inventory Manager
3. **Operations Manager Approval**: Operations Manager, General Manager

---

## API Endpoints

### Base URL

```
/api/order-dispatches
```

### Authentication

All endpoints require Bearer token authentication:

```
Authorization: Bearer {access_token}
```

---

### 1. List Order Dispatches

**Endpoint**: `GET /api/order-dispatches`

**Purpose**: Retrieve a paginated list of dispatches with filtering options.

**Query Parameters**:
- `page` (integer): Page number (default: 1)
- `per_page` (integer): Items per page (default: 15, max: 100)
- `status` (string): Filter by status (draft, pending, approved, in_transit, delivered, cancelled)
- `approval_status` (string): Filter by approval status (draft, pending, in_progress, approved, rejected)
- `start_date` (date): Filter by created_at >= this date (format: YYYY-MM-DD)
- `end_date` (date): Filter by created_at <= this date (format: YYYY-MM-DD)

**Response**:
```json
{
  "success": true,
  "message": "Order dispatches retrieved successfully",
  "data": {
    "current_page": 1,
    "data": [
      {
        "id": "uuid",
        "order_dispatch_number": "ODI-12345678-0001",
        "order_id": "uuid",
        "approval_status": "approved",
        "status": "approved",
        "total_items": 100,
        "approved_at": "2025-11-19T10:30:00Z",
        "created_at": "2025-11-19T09:00:00Z",
        "order": {
          "id": "uuid",
          "order_number": "ORD-1234",
          "customer": {
            "name": "Customer Name"
          }
        }
      }
    ],
    "per_page": 15,
    "total": 50,
    "last_page": 4
  }
}
```

---

### 2. Get Single Dispatch

**Endpoint**: `GET /api/order-dispatches/{id}`

**Purpose**: Retrieve complete details of a specific dispatch including items, workflow, and relationships.

**Response**:
```json
{
  "success": true,
  "message": "Order dispatch retrieved successfully",
  "data": {
    "id": "uuid",
    "order_dispatch_number": "ODI-12345678-0001",
    "order_id": "uuid",
    "delivery_location_id": "uuid",
    "approval_status": "approved",
    "status": "approved",
    "workflow_instance_id": "uuid",
    "approved_by": "uuid",
    "approved_at": "2025-11-19T12:00:00Z",
    "dispatched_at": null,
    "delivered_at": null,
    "notes": "Handle with care",
    "metadata": {},
    "created_at": "2025-11-19T09:00:00Z",
    "updated_at": "2025-11-19T12:00:00Z",
    
    "order": {
      "id": "uuid",
      "order_number": "ORD-1234",
      "customer_id": "uuid",
      "total_amount": 150000.00,
      "customer": {
        "id": "uuid",
        "name": "Acme Corporation",
        "contact_person": "John Doe",
        "phone": "+256700000000"
      }
    },
    
    "deliveryLocation": {
      "id": "uuid",
      "name": "Main Warehouse",
      "address": "123 Industrial Road",
      "city": "Kampala",
      "district": "Central",
      "contact_person": "Jane Smith",
      "contact_phone": "+256700111111"
    },
    
    "items": [
      {
        "id": "uuid",
        "order_dispatch_id": "uuid",
        "order_item_id": "uuid",
        "product_id": "uuid",
        "variant_id": "uuid",
        "product_code": "SPR-500ML",
        "quantity": 100,
        "packaging_breakdown": {
          "cartons": 5,
          "pieces": 20
        },
        "delivered_quantity": 0,
        "damaged_quantity": 0,
        "delivery_notes": null,
        "product": {
          "id": "uuid",
          "product_code": "SPR-500ML",
          "product_name": "Sprite",
          "category": "Soft Drinks"
        },
        "variant": {
          "id": "uuid",
          "name": "500ml",
          "sku": "SPR-500ML-001"
        }
      }
    ],
    
    "approvedBy": {
      "id": "uuid",
      "first_name": "Operations",
      "last_name": "Manager",
      "email": "ops@company.com"
    },
    
    "activeWorkflowInstance": {
      "id": "uuid",
      "workflow_id": "uuid",
      "status": "approved",
      "current_step_index": 2,
      "completed_at": "2025-11-19T12:00:00Z",
      "steps": [
        {
          "id": "uuid",
          "step_index": 0,
          "step_name": "Sales Verification",
          "status": "approved",
          "approved_by": "uuid",
          "approved_at": "2025-11-19T10:00:00Z",
          "comments": "Verified and approved"
        },
        {
          "id": "uuid",
          "step_index": 1,
          "step_name": "Warehouse Approval",
          "status": "approved",
          "approved_by": "uuid",
          "approved_at": "2025-11-19T11:30:00Z",
          "comments": "Stock available"
        }
      ]
    },
    
    "logistic": null
  }
}
```

---

### 3. Create Order Dispatch

**Endpoint**: `POST /api/order-dispatches`

**Purpose**: Create a new dispatch from an existing order. Items are automatically pulled from the order.

**Request Body**:
```json
{
  "order_id": "uuid",
  "notes": "Optional notes or special instructions"
}
```

**Validation Rules**:
- `order_id`: Required, must be a valid UUID, must exist in orders table
- `notes`: Optional, string, max 1000 characters

**Response**:
```json
{
  "success": true,
  "message": "Order dispatch created successfully",
  "data": {
    "id": "uuid",
    "order_dispatch_number": "ODI-12345678-0001",
    "order_id": "uuid",
    "approval_status": "draft",
    "status": "draft",
    "items": [
      {
        "id": "uuid",
        "product_code": "SPR-500ML",
        "quantity": 100,
        "packaging_breakdown": {
          "cartons": 5,
          "pieces": 20
        }
      }
    ]
  }
}
```

**Important Notes**:
- Dispatch items are **automatically created** from order items
- Packaging information is auto-populated from order items
- Dispatch starts in `draft` status
- Cannot create multiple dispatches from the same order without business rules

---

### 4. Update Order Dispatch

**Endpoint**: `PUT /api/order-dispatches/{id}`

**Purpose**: Update dispatch details. Only allowed for dispatches in `draft` status.

**Request Body**:
```json
{
  "notes": "Updated notes",
  "metadata": {
    "custom_field": "custom_value"
  }
}
```

**Validation Rules**:
- `notes`: Optional, string, max 1000 characters
- `metadata`: Optional, JSON object

**Response**:
```json
{
  "success": true,
  "message": "Order dispatch updated successfully",
  "data": {
    "id": "uuid",
    "order_dispatch_number": "ODI-12345678-0001",
    "notes": "Updated notes",
    "updated_at": "2025-11-19T10:00:00Z"
  }
}
```

**Restrictions**:
- Can only update dispatches in `draft` status
- Cannot modify items (they are tied to the order)
- Cannot change order_id

---

### 5. Delete Order Dispatch

**Endpoint**: `DELETE /api/order-dispatches/{id}`

**Purpose**: Delete a dispatch. Only allowed for dispatches in `draft` status.

**Response**:
```json
{
  "success": true,
  "message": "Order dispatch deleted successfully"
}
```

**Restrictions**:
- Can only delete dispatches in `draft` status
- Cannot delete dispatches with active workflows
- Cascade deletes all associated dispatch items

---

### 6. Initiate Approval Workflow

**Endpoint**: `POST /api/order-dispatches/{id}/initiate-workflow`

**Purpose**: Submit the dispatch for approval and start the multi-step workflow.

**Request Body**: (empty)

**Response**:
```json
{
  "success": true,
  "message": "Approval workflow initiated successfully",
  "data": {
    "id": "uuid",
    "order_dispatch_number": "ODI-12345678-0001",
    "approval_status": "pending",
    "status": "pending",
    "workflow_instance_id": "uuid",
    "activeWorkflowInstance": {
      "id": "uuid",
      "workflow_id": "uuid",
      "status": "in_progress",
      "current_step_index": 0,
      "steps": [
        {
          "id": "uuid",
          "step_index": 0,
          "step_name": "Sales Verification",
          "status": "pending",
          "required_role": "sales_manager",
          "timeout_hours": 12,
          "due_at": "2025-11-20T09:00:00Z"
        }
      ]
    }
  }
}
```

**What Happens**:
1. System finds the company's "Order Dispatch Approval" workflow
2. Creates a new workflow instance
3. Activates the first approval step
4. Changes approval_status to `pending`
5. Sends notifications to first approvers

**Restrictions**:
- Can only initiate workflow for dispatches in `draft` status
- Requires `can_dispatch_order_dispatches` permission
- Cannot initiate workflow twice

---

### 7. Create Logistics Record

**Endpoint**: `POST /api/order-dispatches/{id}/create-logistics`

**Purpose**: Assign driver, vehicle, and delivery details to an approved dispatch.

**Request Body**:
```json
{
  "driver_name": "John Driver",
  "driver_contact": "+256700123456",
  "vehicle_registration": "UBJ 123A",
  "vehicle_type": "Truck",
  "estimated_delivery_time": "2025-11-20 14:00:00",
  "pickup_location": "Main Warehouse",
  "delivery_location": "Customer Site",
  "notes": "Call customer 30 minutes before arrival"
}
```

**Validation Rules**:
- `driver_name`: Required, string, max 255 characters
- `driver_contact`: Required, string, max 20 characters
- `vehicle_registration`: Required, string, max 50 characters
- `vehicle_type`: Optional, string, max 100 characters
- `estimated_delivery_time`: Optional, datetime (YYYY-MM-DD HH:mm:ss)
- `pickup_location`: Optional, string, max 255 characters
- `delivery_location`: Optional, string, max 255 characters
- `notes`: Optional, string, max 1000 characters

**Response**:
```json
{
  "success": true,
  "message": "Logistics record created successfully",
  "data": {
    "id": "uuid",
    "order_dispatch_number": "ODI-12345678-0001",
    "status": "in_transit",
    "logistic": {
      "id": "uuid",
      "order_dispatch_id": "uuid",
      "driver_name": "John Driver",
      "driver_contact": "+256700123456",
      "vehicle_registration": "UBJ 123A",
      "vehicle_type": "Truck",
      "estimated_delivery_time": "2025-11-20T14:00:00Z",
      "pickup_location": "Main Warehouse",
      "delivery_location": "Customer Site",
      "notes": "Call customer 30 minutes before arrival",
      "created_at": "2025-11-19T13:00:00Z"
    }
  }
}
```

**Restrictions**:
- Can only create logistics for `approved` dispatches
- Requires `can_dispatch_order_dispatches` permission
- Cannot create multiple logistics records (one per dispatch)

**Status Change**:
- Dispatch status automatically changes to `in_transit`
- `dispatched_at` timestamp is set

---

### 8. Mark Dispatch as Delivered

**Endpoint**: `POST /api/order-dispatches/{id}/mark-delivered`

**Purpose**: Record delivery quantities and mark dispatch as delivered.

**Request Body**:
```json
{
  "items": [
    {
      "item_id": "uuid",
      "delivered_quantity": 95,
      "damaged_quantity": 5,
      "delivery_notes": "5 bottles broken in transit"
    },
    {
      "item_id": "uuid",
      "delivered_quantity": 200,
      "damaged_quantity": 0,
      "delivery_notes": null
    }
  ]
}
```

**Validation Rules**:
- `items`: Required, array, must contain at least one item
- `items.*.item_id`: Required, must be a valid dispatch item UUID
- `items.*.delivered_quantity`: Required, integer, min 0
- `items.*.damaged_quantity`: Required, integer, min 0
- `items.*.delivery_notes`: Optional, string, max 500 characters
- Validation: `delivered_quantity + damaged_quantity` must equal original `quantity`

**Response**:
```json
{
  "success": true,
  "message": "Dispatch marked as delivered successfully",
  "data": {
    "id": "uuid",
    "order_dispatch_number": "ODI-12345678-0001",
    "status": "delivered",
    "delivered_at": "2025-11-20T15:30:00Z",
    "items": [
      {
        "id": "uuid",
        "product_code": "SPR-500ML",
        "quantity": 100,
        "delivered_quantity": 95,
        "damaged_quantity": 5,
        "delivery_notes": "5 bottles broken in transit"
      }
    ]
  }
}
```

**Restrictions**:
- Can only mark `in_transit` dispatches as delivered
- Must provide delivery data for all items
- Requires `can_dispatch_order_dispatches` permission

**Status Change**:
- Dispatch status changes to `delivered`
- `delivered_at` timestamp is set

---

## Data Models

### OrderDispatch Model

**Primary Fields**:
- `id` (UUID): Unique identifier
- `order_dispatch_number` (String): Auto-generated unique number (ODI-XXXXXXXX-0001)
- `order_id` (UUID): Reference to source order
- `delivery_location_id` (UUID): Reference to delivery location
- `approval_status` (Enum): draft, pending, in_progress, approved, rejected
- `status` (Enum): draft, pending, approved, in_transit, delivered, cancelled
- `workflow_instance_id` (UUID): Reference to active approval workflow
- `approved_by` (UUID): User who completed the approval
- `approved_at` (Timestamp): When approval was completed
- `dispatched_at` (Timestamp): When dispatch was sent out
- `delivered_at` (Timestamp): When dispatch was delivered
- `notes` (Text): Additional notes or instructions
- `metadata` (JSONB): Custom fields storage

**Relationships**:
- `order`: BelongsTo Order
- `deliveryLocation`: BelongsTo DeliveryLocation
- `items`: HasMany OrderDispatchItem
- `approvedBy`: BelongsTo User
- `activeWorkflowInstance`: BelongsTo ApprovalWorkflowInstance
- `workflowInstances`: HasMany ApprovalWorkflowInstance
- `logistic`: HasOne Logistic

**Computed Properties**:
- `total_items`: Sum of all item quantities
- `canBeDispatched()`: Boolean - true if status is 'approved'

---

### OrderDispatchItem Model

**Primary Fields**:
- `id` (UUID): Unique identifier
- `order_dispatch_id` (UUID): Reference to parent dispatch
- `order_item_id` (UUID): Reference to original order item
- `product_id` (UUID): Reference to product
- `variant_id` (UUID): Reference to product variant (optional)
- `product_code` (String): Product code for quick reference
- `quantity` (Decimal): Number of units to dispatch
- `unit_id` (UUID): Unit of measurement (optional)
- `packaging_breakdown` (JSONB): Packaging details (e.g., {"cartons": 5, "pieces": 20})
- `delivered_quantity` (Decimal): Actual units delivered
- `damaged_quantity` (Decimal): Units damaged during transit
- `delivery_notes` (Text): Notes about this item's delivery

**Relationships**:
- `orderDispatch`: BelongsTo OrderDispatch
- `orderItem`: BelongsTo OrderItem
- `product`: BelongsTo Product
- `variant`: BelongsTo ProductVariant
- `unit`: BelongsTo Unit (optional)

**Computed Properties**:
- `packaging_info`: Formatted packaging string

**Constraints**:
- `delivered_quantity + damaged_quantity <= quantity`
- Both quantities must be >= 0

---

### Logistic Model

**Primary Fields**:
- `id` (UUID): Unique identifier
- `order_dispatch_id` (UUID): Reference to dispatch
- `driver_name` (String): Driver's full name
- `driver_contact` (String): Driver's phone number
- `vehicle_registration` (String): Vehicle registration number
- `vehicle_type` (String): Type of vehicle (Truck, Van, Pickup, etc.)
- `estimated_delivery_time` (Timestamp): Expected delivery time
- `actual_delivery_time` (Timestamp): Actual delivery time
- `pickup_location` (String): Where items are collected from
- `delivery_location` (String): Where items are delivered to
- `notes` (Text): Logistics notes or special instructions
- `status` (Enum): pending, in_transit, delivered, cancelled

**Relationships**:
- `orderDispatch`: BelongsTo OrderDispatch

---

## Workflow States

### Dispatch Status Flow

```
draft → pending → approved → in_transit → delivered
                       ↓
                  cancelled
```

**Status Descriptions**:

| Status | Description | Allowed Actions |
|--------|-------------|-----------------|
| `draft` | Initial state, being created | Edit, Delete, Initiate Workflow |
| `pending` | Submitted for approval | View, Cancel |
| `approved` | Workflow completed, ready for dispatch | Create Logistics, Cancel |
| `in_transit` | Driver has dispatch, en route | View, Mark Delivered |
| `delivered` | Successfully delivered | View only (final state) |
| `cancelled` | Dispatch cancelled | View only (final state) |

---

### Approval Status Flow

```
draft → pending → in_progress → approved
                            ↓
                        rejected
```

**Approval Status Descriptions**:

| Status | Description | Workflow State |
|--------|-------------|----------------|
| `draft` | Not yet submitted | No workflow |
| `pending` | Submitted, waiting for first approver | Workflow created, not started |
| `in_progress` | Being reviewed by approvers | Active workflow, steps pending |
| `approved` | All steps approved | Workflow completed successfully |
| `rejected` | One or more steps rejected | Workflow terminated |

---

### Workflow Step Status

```
pending → approved
    ↓
rejected → (workflow ends)
    ↓
skipped (conditional steps)
```

**Step Status Descriptions**:

| Status | Description | Next Action |
|--------|-------------|-------------|
| `pending` | Waiting for approver | Approver must review |
| `approved` | Step approved | Move to next step |
| `rejected` | Step rejected | Workflow terminated |
| `skipped` | Condition not met | Auto-skipped, move to next |

---

## Step-by-Step Integration

### Step 1: Display Order List

**UI Requirements**:
- Show list of completed/confirmed orders
- Display order number, customer name, total amount, date
- Add "Create Dispatch" action button for eligible orders
- Filter by date range, customer, status

**API Call**:
- Endpoint: GET `/api/orders` (existing endpoint)
- Filter: `status=completed` or similar
- Display fields: order_number, customer.name, total_amount, created_at

---

### Step 2: Create Dispatch from Order

**UI Requirements**:
- Modal or form to create dispatch
- Display order summary (number, customer, items preview)
- Text area for optional notes
- "Create Dispatch" submit button

**User Flow**:
1. User clicks "Create Dispatch" on an order
2. System shows confirmation dialog with order details
3. User optionally adds notes
4. User clicks "Create"

**API Call**:
- Endpoint: POST `/api/order-dispatches`
- Body: `{ "order_id": "uuid", "notes": "optional" }`
- On success: Navigate to dispatch detail page

**Error Handling**:
- Order not found: Show error message
- Order already dispatched: Show warning with existing dispatch link
- Validation errors: Display field-specific errors

---

### Step 3: View Dispatch Details

**UI Requirements**:
- Display dispatch number prominently
- Show approval status badge (color-coded)
- Show dispatch status badge (color-coded)
- Display order information (number, customer, location)
- List all dispatch items with:
  - Product code and name
  - Quantity
  - Packaging breakdown (cartons, pieces, etc.)
  - Delivery status (if applicable)
- Show workflow progress (steps completed, pending, skipped)
- Action buttons based on current status:
  - Draft: "Edit", "Delete", "Submit for Approval"
  - Pending/In Progress: "View Workflow", "Cancel"
  - Approved: "Create Logistics", "Cancel"
  - In Transit: "Mark Delivered"
  - Delivered: View only

**API Call**:
- Endpoint: GET `/api/order-dispatches/{id}`
- Load all related data (order, items, workflow, logistics)

**Display Logic**:
```
IF approval_status === 'draft' AND status === 'draft'
  → Show "Submit for Approval" button

IF approval_status === 'in_progress'
  → Show workflow progress with step statuses
  → Show current approver information

IF approval_status === 'approved' AND status === 'approved'
  → Show "Create Logistics" button
  → Highlight that dispatch is ready

IF status === 'in_transit'
  → Show logistics information (driver, vehicle)
  → Show "Mark Delivered" button

IF status === 'delivered'
  → Show delivery summary (delivered/damaged quantities)
  → Show delivered_at timestamp
```

---

### Step 4: Submit for Approval

**UI Requirements**:
- Confirmation dialog before submission
- Display workflow steps that will be executed
- Show estimated approval time
- "Confirm Submission" button

**User Flow**:
1. User clicks "Submit for Approval" on draft dispatch
2. System shows workflow preview (steps and approvers)
3. User confirms submission
4. System initiates workflow
5. Navigate to dispatch detail with workflow view

**API Call**:
- Endpoint: POST `/api/order-dispatches/{id}/initiate-workflow`
- Body: (empty)
- On success: Reload dispatch details to show workflow

**Post-Submission**:
- Show success message: "Dispatch submitted for approval"
- Display workflow progress UI
- Notify user of next steps

---

### Step 5: Approve Workflow Steps

**UI Requirements** (for approvers):
- Notification when dispatch requires approval
- "Pending Approvals" dashboard/list
- Detail view showing:
  - Dispatch number and details
  - All items with quantities and packaging
  - Previous step approvals (if any)
  - Order information
  - Customer information
- Comment text area (optional)
- "Approve" and "Reject" buttons
- Rejection reason (required if rejecting)

**User Flow** (approver):
1. Approver receives notification
2. Approver navigates to "Pending Approvals" section
3. Approver clicks on dispatch to review
4. Approver reviews all details
5. Approver makes decision:
   - Approve: Optionally add comment, click "Approve"
   - Reject: Add rejection reason, click "Reject"
6. System processes approval/rejection
7. Move to next step or complete workflow

**API Call** (approve step):
- Endpoint: POST `/api/approval-workflow-instances/{workflow_id}/steps/{step_id}/approve`
- Body: `{ "comments": "optional comment" }`

**API Call** (reject step):
- Endpoint: POST `/api/approval-workflow-instances/{workflow_id}/steps/{step_id}/reject`
- Body: `{ "comments": "rejection reason", "reason": "reason code" }`

**Workflow Completion**:
- When final step is approved, dispatch automatically becomes `approved`
- System sends notification to dispatch creator
- Dispatch is ready for logistics creation

---

### Step 6: Create Logistics

**UI Requirements**:
- Form to enter logistics details
- Fields:
  - Driver name (text input, required)
  - Driver contact (phone input, required)
  - Vehicle registration (text input, required)
  - Vehicle type (dropdown: Truck, Van, Pickup, Motorcycle, Other)
  - Estimated delivery time (datetime picker)
  - Pickup location (text input or dropdown)
  - Delivery location (text input or pre-filled from dispatch)
  - Notes (text area)
- "Assign Driver & Vehicle" submit button

**User Flow**:
1. User clicks "Create Logistics" on approved dispatch
2. System shows logistics form
3. User enters driver and vehicle details
4. User sets estimated delivery time
5. User clicks "Assign"
6. System creates logistics record
7. Dispatch status changes to "in_transit"

**API Call**:
- Endpoint: POST `/api/order-dispatches/{id}/create-logistics`
- Body: logistics details object
- On success: Reload dispatch with logistics info

**Validation**:
- Driver name and contact are required
- Vehicle registration is required
- Phone number format validation
- Future datetime for estimated delivery

---

### Step 7: Track Dispatch in Transit

**UI Requirements**:
- Display "In Transit" status prominently
- Show logistics details:
  - Driver name and contact (with click-to-call)
  - Vehicle registration and type
  - Estimated delivery time
  - Pickup and delivery locations
  - Dispatch date/time
- Real-time status updates (if available)
- "Mark as Delivered" button

**User Flow**:
1. User views in-transit dispatch
2. User can see all logistics details
3. When delivery is complete, user clicks "Mark as Delivered"
4. System shows delivery confirmation form

---

### Step 8: Mark as Delivered

**UI Requirements**:
- Form showing all dispatch items
- For each item:
  - Product name and code
  - Original quantity
  - Input: Delivered quantity (default: original quantity)
  - Input: Damaged quantity (default: 0)
  - Validation: delivered + damaged = original
  - Text area: Delivery notes (optional)
- "Confirm Delivery" submit button

**User Flow**:
1. User clicks "Mark as Delivered"
2. System shows delivery confirmation form with all items
3. User enters delivered and damaged quantities for each item
4. User adds delivery notes if needed
5. User clicks "Confirm Delivery"
6. System validates quantities
7. System updates dispatch to "delivered" status
8. Show delivery summary

**API Call**:
- Endpoint: POST `/api/order-dispatches/{id}/mark-delivered`
- Body: array of items with delivered/damaged quantities
- On success: Show delivery confirmation screen

**Validation**:
- All items must be accounted for
- `delivered_quantity + damaged_quantity === quantity`
- Both quantities must be >= 0
- Cannot mark as delivered twice

**Final State**:
- Dispatch status is "delivered"
- All items have delivery data
- `delivered_at` timestamp is recorded
- No further edits allowed

---

## Error Handling

### Common Error Responses

**401 Unauthorized**:
```json
{
  "success": false,
  "message": "Unauthenticated",
  "errors": []
}
```
**Action**: Redirect to login

---

**403 Forbidden**:
```json
{
  "success": false,
  "message": "You do not have permission to perform this action",
  "errors": []
}
```
**Action**: Show permission error message

---

**404 Not Found**:
```json
{
  "success": false,
  "message": "Order dispatch not found",
  "errors": []
}
```
**Action**: Show "not found" error, redirect to list

---

**422 Validation Error**:
```json
{
  "success": false,
  "message": "The given data was invalid",
  "errors": {
    "order_id": ["The order id field is required."],
    "delivered_quantity": ["The delivered quantity must not be greater than 100."]
  }
}
```
**Action**: Display field-specific error messages

---

**409 Conflict**:
```json
{
  "success": false,
  "message": "Cannot update dispatch in current status",
  "errors": []
}
```
**Action**: Show error message, explain status restrictions

---

### Error Scenarios & Solutions

| Scenario | Error | User Action |
|----------|-------|-------------|
| Order already has dispatch | 409 Conflict | View existing dispatch, create another if allowed |
| Dispatch not in draft | 409 Conflict | Cannot edit, view only |
| Workflow already initiated | 409 Conflict | Cannot initiate again, view workflow |
| Not approved for logistics | 403 Forbidden | Wait for approval completion |
| Invalid quantities | 422 Validation | Fix quantities to match original |
| Network timeout | Network error | Retry request, show retry button |

---

## Best Practices

### 1. Status-Based UI

Always render UI based on current `status` and `approval_status`:

```
- Check both status fields before showing action buttons
- Disable/hide actions that aren't allowed for current state
- Use color-coded badges for statuses:
  - Draft: Gray
  - Pending: Yellow
  - In Progress: Blue
  - Approved: Green
  - Rejected: Red
  - In Transit: Purple
  - Delivered: Green
```

---

### 2. Real-Time Updates

Implement real-time updates for:
- Workflow step approvals
- Dispatch status changes
- New comments added to workflow

Use polling or WebSockets to refresh dispatch details when:
- User is viewing a dispatch with active workflow
- User is on "Pending Approvals" dashboard

---

### 3. Notifications

Show notifications for:
- Dispatch submitted for approval (creator)
- Approval step assigned (approver)
- Workflow approved (creator)
- Workflow rejected (creator)
- Dispatch in transit (relevant users)
- Dispatch delivered (creator, sales team)

---

### 4. Permission Checks

Always check user permissions before:
- Showing "Create Dispatch" button
- Showing "Edit" or "Delete" buttons
- Showing "Submit for Approval" button
- Showing "Approve" button
- Showing "Create Logistics" button
- Showing "Mark Delivered" button

Use permission alternatives:
```
canCreateDispatch = user.hasPermission('can_create_order_dispatches') 
                    || user.hasPermission('can_manage_system')
                    || user.hasPermission('can_manage_company')
```

---

### 5. Data Validation

Client-side validation before API calls:
- Required fields are filled
- Phone numbers match expected format
- Dates are in the future (for estimated delivery)
- Quantities are positive numbers
- Delivered + Damaged = Original quantity

---

### 6. Loading States

Show loading indicators during:
- API calls (button spinners)
- List pagination
- Detail view loading
- Workflow actions
- Form submissions

Disable form buttons during submission to prevent double-clicks.

---

### 7. Offline Handling

Handle offline scenarios:
- Cache dispatch list for offline viewing
- Show "offline" indicator when network is unavailable
- Queue actions when offline (if applicable)
- Sync when back online

---

### 8. Responsive Design

Ensure UI works on:
- Desktop (primary use case)
- Tablet (for warehouse/field use)
- Mobile (for drivers, delivery tracking)

Consider:
- Mobile-optimized delivery confirmation form
- Driver app for logistics updates
- Tablet view for warehouse approvals

---

### 9. Audit Trail

Display audit information:
- Created by, created at
- Updated by, updated at
- Approved by, approved at
- Dispatched at
- Delivered at

Show workflow history:
- Each step with approver name, timestamp, comments
- Skipped steps with reason

---

### 10. Performance Optimization

Optimize for performance:
- Lazy load item details (show count initially, expand to view all)
- Paginate large item lists
- Cache frequently accessed data (product names, customer info)
- Debounce search inputs
- Use skeleton loaders for better UX

---

## Integration Checklist

Use this checklist to track your implementation progress:

### Basic Functionality
- [ ] Display order list with "Create Dispatch" action
- [ ] Create dispatch from order
- [ ] View dispatch details
- [ ] Edit draft dispatch
- [ ] Delete draft dispatch
- [ ] Submit dispatch for approval

### Approval Workflow
- [ ] Display workflow progress
- [ ] Show pending approvals dashboard
- [ ] Approve workflow step
- [ ] Reject workflow step
- [ ] Add comments to approvals
- [ ] Handle workflow completion

### Logistics & Delivery
- [ ] Create logistics record
- [ ] Display driver and vehicle info
- [ ] Mark dispatch as in transit
- [ ] Mark dispatch as delivered
- [ ] Track delivered/damaged quantities
- [ ] Add delivery notes

### UI/UX
- [ ] Status badges and color coding
- [ ] Permission-based UI rendering
- [ ] Loading states and spinners
- [ ] Error handling and messages
- [ ] Form validations
- [ ] Confirmation dialogs
- [ ] Real-time updates (optional)
- [ ] Notifications (optional)

### Data Display
- [ ] List view with filters
- [ ] Detail view with all relationships
- [ ] Item list with packaging info
- [ ] Workflow step history
- [ ] Logistics details
- [ ] Delivery summary

### Testing
- [ ] Test full flow: order → dispatch → approve → logistics → deliver
- [ ] Test all status transitions
- [ ] Test permissions for different user roles
- [ ] Test validation errors
- [ ] Test edge cases (rejection, cancellation, damaged items)

---

## Support & Resources

### Related Documentation
- [ORDER_DISPATCH_API_DOCUMENTATION.md](./ORDER_DISPATCH_API_DOCUMENTATION.md) - Complete API reference
- [ORDER_DISPATCH_QUICK_REFERENCE.md](./ORDER_DISPATCH_QUICK_REFERENCE.md) - Quick start guide
- [COMPLETE_RESOLUTION.md](./COMPLETE_RESOLUTION.md) - Customer account approval system (similar pattern)

### API Testing
- Use Postman collection (create one for order dispatch endpoints)
- Test environment: `{base_url}/api`
- Authentication: Bearer token in Authorization header

### Contact
For questions or issues with the order dispatch system:
- Backend API questions: Contact backend team
- Workflow configuration: Contact system administrator
- Permission issues: Contact system administrator

---

**Document Version:** 1.0  
**Last Updated:** November 19, 2025  
**Prepared For:** Frontend Development Team
