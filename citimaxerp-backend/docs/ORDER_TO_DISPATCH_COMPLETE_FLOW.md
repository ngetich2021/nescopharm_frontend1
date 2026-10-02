# Complete Order to Dispatch Flow Guide

## Overview

This guide covers the complete lifecycle of order fulfillment, from creating an order, converting it to a dispatch with approval workflow, through to logistics assignment and delivery tracking.

---

## Table of Contents

1. [Order Creation](#1-order-creation)
2. [Converting Order to Dispatch](#2-converting-order-to-dispatch)
3. [Configuring Approval Workflow](#3-configuring-approval-workflow)
4. [Dispatch Approval Process](#4-dispatch-approval-process)
5. [Creating Logistics](#5-creating-logistics)
6. [Delivery Tracking](#6-delivery-tracking)
7. [Complete Workflow Example](#complete-workflow-example)

---

## 1. Order Creation

### Step 1.1: Create Customer Order

Before a dispatch can be created, you need an order from a customer.

**Endpoint:** `POST /api/orders`

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
  "customer_id": "customer-uuid",
  "delivery_location_id": "location-uuid",
  "order_type": "sale",
  "payment_terms": "credit",
  "credit_days": 30,
  "notes": "Customer requested urgent delivery",
  "items": [
    {
      "product_id": "product-uuid-1",
      "quantity": 100,
      "unit_price": 50.00,
      "cartons": 5,
      "pieces_per_carton": 20,
      "discount_percentage": 0
    },
    {
      "product_id": "product-uuid-2",
      "quantity": 50,
      "unit_price": 75.00,
      "cartons": 2,
      "pieces_per_carton": 25,
      "discount_percentage": 5
    }
  ]
}
```

**Validation Rules:**
- `customer_id`: UUID, required, must exist
- `delivery_location_id`: UUID, required, must belong to customer
- `order_type`: string, required, in: sale, transfer, return
- `items`: array, required, min: 1 item
- `items.*.product_id`: UUID, required
- `items.*.quantity`: integer, required, min: 1
- `items.*.unit_price`: numeric, required, min: 0

**Response:**
```json
{
  "success": true,
  "message": "Order created successfully",
  "data": {
    "id": "6668bb12-af73-4912-9472-0d2c9d0f2e9c",
    "order_number": "ORD-4026",
    "company_id": "14fafcd8-137b-4725-a6e9-7542ad27a6ed",
    "customer_id": "customer-uuid",
    "delivery_location_id": "location-uuid",
    "order_type": "sale",
    "status": "pending",
    "payment_terms": "credit",
    "credit_days": 30,
    "subtotal": 8750.00,
    "discount": 187.50,
    "tax": 0.00,
    "total": 8562.50,
    "notes": "Customer requested urgent delivery",
    "created_at": "2025-11-19 14:00:00",
    "customer": {
      "id": "customer-uuid",
      "name": "ABC Stores Ltd",
      "email": "orders@abcstores.com",
      "phone": "+254712345678"
    },
    "delivery_location": {
      "id": "location-uuid",
      "name": "ABC Stores - Main Branch",
      "address": "123 Main Street, Nairobi"
    },
    "items": [
      {
        "id": "item-uuid-1",
        "product_id": "product-uuid-1",
        "product": {
          "id": "product-uuid-1",
          "name": "Coca Cola 500ml",
          "product_code": "COKE-500",
          "unit_of_measure": "pieces"
        },
        "quantity": 100,
        "unit_price": 50.00,
        "cartons": 5,
        "pieces_per_carton": 20,
        "discount_percentage": 0,
        "discount_amount": 0.00,
        "subtotal": 5000.00,
        "total": 5000.00
      },
      {
        "id": "item-uuid-2",
        "product_id": "product-uuid-2",
        "product": {
          "id": "product-uuid-2",
          "name": "Fanta Orange 500ml",
          "product_code": "FANTA-500",
          "unit_of_measure": "pieces"
        },
        "quantity": 50,
        "unit_price": 75.00,
        "cartons": 2,
        "pieces_per_carton": 25,
        "discount_percentage": 5,
        "discount_amount": 187.50,
        "subtotal": 3750.00,
        "total": 3562.50
      }
    ]
  }
}
```

### Step 1.2: View Order Details

Retrieve order details to confirm items before creating dispatch.

**Endpoint:** `GET /api/orders/{order_id}`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "6668bb12-af73-4912-9472-0d2c9d0f2e9c",
    "order_number": "ORD-4026",
    "status": "pending",
    "total": 8562.50,
    "customer": {
      "name": "ABC Stores Ltd"
    },
    "items": [
      {
        "id": "item-uuid-1",
        "product": {
          "name": "Coca Cola 500ml",
          "product_code": "COKE-500"
        },
        "quantity": 100,
        "quantity_dispatched": 0,
        "quantity_remaining": 100
      },
      {
        "id": "item-uuid-2",
        "product": {
          "name": "Fanta Orange 500ml",
          "product_code": "FANTA-500"
        },
        "quantity": 50,
        "quantity_dispatched": 0,
        "quantity_remaining": 50
      }
    ]
  }
}
```

---

## 2. Converting Order to Dispatch

### Understanding Order vs Dispatch

- **Order** = Customer's request for products (what they want)
- **Dispatch** = Actual fulfillment of order (what is being sent)
- One order can have **multiple dispatches** (partial shipments)
- Dispatch can be for full order or partial quantities

### Step 2.1: Configure Company Approval Settings (One-Time Setup)

Before creating dispatches, configure default approvers for your company.

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
      "user_id": "sales-manager-uuid",
      "order": 1
    },
    {
      "user_id": "warehouse-manager-uuid",
      "order": 2
    },
    {
      "user_id": "finance-manager-uuid",
      "order": 3
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Dispatch approval settings updated successfully",
  "data": {
    "require_approval": true,
    "default_approvers": [
      {
        "user_id": "sales-manager-uuid",
        "order": 1,
        "user": {
          "first_name": "John",
          "last_name": "Sales",
          "email": "sales@company.com",
          "role": "Sales Manager"
        }
      },
      {
        "user_id": "warehouse-manager-uuid",
        "order": 2,
        "user": {
          "first_name": "Jane",
          "last_name": "Warehouse",
          "email": "warehouse@company.com",
          "role": "Warehouse Manager"
        }
      },
      {
        "user_id": "finance-manager-uuid",
        "order": 3,
        "user": {
          "first_name": "Mike",
          "last_name": "Finance",
          "email": "finance@company.com",
          "role": "Finance Manager"
        }
      }
    ]
  }
}
```

**Note:** This is a **one-time setup**. All new dispatches will automatically inherit these approvers unless you specify custom approvers.

### Step 2.2: Create Dispatch from Order (Full Dispatch)

Convert the entire order into a dispatch.

**Endpoint:** `POST /api/order-dispatches`

**Headers:**
```json
{
  "Authorization": "Bearer {token}",
  "Content-Type": "application/json",
  "Accept": "application/json"
}
```

**Payload (Full Order Dispatch - Using Default Approvers):**
```json
{
  "order_id": "6668bb12-af73-4912-9472-0d2c9d0f2e9c",
  "delivery_location_id": "location-uuid",
  "notes": "Complete order dispatch - urgent delivery",
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
    "delivery_location_id": "location-uuid",
    "status": "draft",
    "approval_status": "draft",
    "notes": "Complete order dispatch - urgent delivery",
    "created_at": "2025-11-19 14:25:00",
    "approvers": [
      {
        "user_id": "sales-manager-uuid",
        "order": 1,
        "status": "pending",
        "approved_at": null,
        "comments": null
      },
      {
        "user_id": "warehouse-manager-uuid",
        "order": 2,
        "status": "pending",
        "approved_at": null,
        "comments": null
      },
      {
        "user_id": "finance-manager-uuid",
        "order": 3,
        "status": "pending",
        "approved_at": null,
        "comments": null
      }
    ],
    "items": [
      {
        "id": "dispatch-item-uuid-1",
        "order_item_id": "item-uuid-1",
        "quantity_dispatched": 100,
        "product": {
          "id": "product-uuid-1",
          "name": "Coca Cola 500ml",
          "product_code": "COKE-500"
        }
      },
      {
        "id": "dispatch-item-uuid-2",
        "order_item_id": "item-uuid-2",
        "quantity_dispatched": 50,
        "product": {
          "id": "product-uuid-2",
          "name": "Fanta Orange 500ml",
          "product_code": "FANTA-500"
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

**Key Points:**
- Dispatch starts in `draft` status
- Approvers automatically inherited from company settings
- Dispatch number auto-generated (ODI-XXXX)
- Can edit dispatch while in draft status

### Step 2.3: Create Partial Dispatch from Order

Create a dispatch for only part of the order (partial fulfillment).

**Payload (Partial Dispatch):**
```json
{
  "order_id": "6668bb12-af73-4912-9472-0d2c9d0f2e9c",
  "delivery_location_id": "location-uuid",
  "notes": "Partial dispatch - first batch available",
  "items": [
    {
      "order_item_id": "item-uuid-1",
      "quantity_to_dispatch": 50
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
    "id": "dispatch-uuid",
    "dispatch_number": "ODI-0002",
    "status": "draft",
    "items": [
      {
        "order_item_id": "item-uuid-1",
        "quantity_dispatched": 50,
        "product": {
          "name": "Coca Cola 500ml"
        }
      }
    ],
    "order": {
      "order_number": "ORD-4026",
      "items": [
        {
          "id": "item-uuid-1",
          "quantity": 100,
          "quantity_dispatched": 50,
          "quantity_remaining": 50
        }
      ]
    }
  }
}
```

**Note:** Remaining 50 units of Coca Cola and 50 units of Fanta can be dispatched later.

### Step 2.4: Create Dispatch with Custom Approvers

Override default approvers for special cases (e.g., VIP customer, urgent order).

**Payload (Custom Approvers):**
```json
{
  "order_id": "6668bb12-af73-4912-9472-0d2c9d0f2e9c",
  "delivery_location_id": "location-uuid",
  "notes": "VIP customer - fast-track approval",
  "custom_approvers": [
    {
      "user_id": "ceo-uuid",
      "order": 1
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
    "id": "dispatch-uuid",
    "dispatch_number": "ODI-0003",
    "status": "draft",
    "approvers": [
      {
        "user_id": "ceo-uuid",
        "order": 1,
        "status": "pending",
        "approved_at": null,
        "comments": null
      }
    ],
    "items": [...]
  }
}
```

**Use Cases for Custom Approvers:**
- VIP/Priority customers requiring executive approval
- Small value orders needing only single approval
- Emergency orders with different approval chain
- Special discount orders requiring finance director approval

---

## 3. Configuring Approval Workflow

### Understanding Approval Workflow

**Approval Hierarchy:**
```
Order Created → Dispatch Created (draft) → Submit for Approval (pending)
                                                    ↓
                          Approver 1 Approves (in_progress)
                                                    ↓
                          Approver 2 Approves (in_progress)
                                                    ↓
                          Approver 3 Approves (approved) → Create Logistics (in_transit)
                                                    ↓
                                          Mark Delivered (delivered)
```

**Rejection Flow:**
```
Any Approver Rejects → Dispatch Cancelled (rejected)
                              ↓
                    Create New Dispatch to Retry
```

### Step 3.1: View Current Company Settings

Check which approvers are configured for your company.

**Endpoint:** `GET /api/company/dispatch-settings`

**Response:**
```json
{
  "success": true,
  "data": {
    "require_approval": true,
    "default_approvers": [
      {
        "user_id": "sales-manager-uuid",
        "order": 1,
        "user": {
          "id": "sales-manager-uuid",
          "first_name": "John",
          "last_name": "Sales",
          "email": "sales@company.com",
          "role": "Sales Manager",
          "is_active": true
        }
      },
      {
        "user_id": "warehouse-manager-uuid",
        "order": 2,
        "user": {
          "id": "warehouse-manager-uuid",
          "first_name": "Jane",
          "last_name": "Warehouse",
          "email": "warehouse@company.com",
          "role": "Warehouse Manager",
          "is_active": true
        }
      }
    ]
  }
}
```

### Step 3.2: Get List of Available Approvers

See all active users who can be added as approvers.

**Endpoint:** `GET /api/company/dispatch-settings/potential-approvers`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "user-uuid-1",
      "first_name": "John",
      "last_name": "Sales",
      "email": "sales@company.com",
      "role": "Sales Manager",
      "is_active": true
    },
    {
      "id": "user-uuid-2",
      "first_name": "Jane",
      "last_name": "Warehouse",
      "email": "warehouse@company.com",
      "role": "Warehouse Manager",
      "is_active": true
    },
    {
      "id": "user-uuid-3",
      "first_name": "Mike",
      "last_name": "Finance",
      "email": "finance@company.com",
      "role": "Finance Manager",
      "is_active": true
    }
  ]
}
```

### Step 3.3: Update Approvers (Optional)

Modify approval chain before submitting dispatch (only in draft status).

**Endpoint:** `PUT /api/order-dispatches/{dispatch_id}`

**Payload:**
```json
{
  "approvers": [
    {
      "user_id": "user-uuid-1",
      "order": 1
    },
    {
      "user_id": "user-uuid-2",
      "order": 2
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
    "approvers": [
      {
        "user_id": "user-uuid-1",
        "order": 1,
        "status": "pending"
      },
      {
        "user_id": "user-uuid-2",
        "order": 2,
        "status": "pending"
      }
    ]
  }
}
```

**Important:** Approvers can only be edited while dispatch is in `draft` status. Once submitted, they cannot be changed.

---

## 4. Dispatch Approval Process

### Step 4.1: Submit Dispatch for Approval

Move dispatch from draft to pending approval.

**Endpoint:** `POST /api/order-dispatches/{dispatch_id}/submit`

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
  "message": "Dispatch submitted for approval",
  "data": {
    "id": "19be6821-b10e-443d-8f25-fbd8adf8bc36",
    "dispatch_number": "ODI-0001",
    "status": "pending",
    "approval_status": "pending",
    "current_approver": {
      "id": "sales-manager-uuid",
      "first_name": "John",
      "last_name": "Sales",
      "email": "sales@company.com"
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

**What Happens:**
- Status changes: `draft` → `pending`
- Approval status: `draft` → `pending`
- First approver notified (can be via email/notification)
- Dispatch can no longer be edited

### Step 4.2: First Approver Approves

Sales Manager reviews and approves the dispatch.

**Endpoint:** `POST /api/order-dispatches/{dispatch_id}/approve`

**Headers:**
```json
{
  "Authorization": "Bearer {sales-manager-token}",
  "Content-Type": "application/json",
  "Accept": "application/json"
}
```

**Payload:**
```json
{
  "comments": "Order verified, customer credit OK, approved for dispatch"
}
```

**Response:**
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
      "id": "sales-manager-uuid",
      "first_name": "John",
      "last_name": "Sales",
      "email": "sales@company.com"
    },
    "approved_at": "2025-11-19 14:30:00",
    "comments": "Order verified, customer credit OK, approved for dispatch",
    "next_approver": {
      "id": "warehouse-manager-uuid",
      "first_name": "Jane",
      "last_name": "Warehouse",
      "email": "warehouse@company.com"
    },
    "approval_progress": {
      "total": 3,
      "approved": 1,
      "pending": 2,
      "percentage": 33.33
    }
  }
}
```

**What Happens:**
- Approval status: `pending` → `in_progress`
- Approver 1 marked as approved with timestamp
- Next approver (Warehouse Manager) becomes current approver
- Progress: 1/3 (33%)

### Step 4.3: Second Approver Approves

Warehouse Manager verifies stock and approves.

**Endpoint:** `POST /api/order-dispatches/{dispatch_id}/approve`

**Headers:**
```json
{
  "Authorization": "Bearer {warehouse-manager-token}",
  "Content-Type": "application/json",
  "Accept": "application/json"
}
```

**Payload:**
```json
{
  "comments": "Stock available and reserved for dispatch"
}
```

**Response:**
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
      "id": "warehouse-manager-uuid",
      "first_name": "Jane",
      "last_name": "Warehouse",
      "email": "warehouse@company.com"
    },
    "approved_at": "2025-11-19 14:35:00",
    "comments": "Stock available and reserved for dispatch",
    "next_approver": {
      "id": "finance-manager-uuid",
      "first_name": "Mike",
      "last_name": "Finance",
      "email": "finance@company.com"
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

**What Happens:**
- Still in `in_progress` approval status
- Approver 2 marked as approved
- Next approver (Finance Manager) becomes current
- Progress: 2/3 (67%)

### Step 4.4: Final Approver Approves

Finance Manager gives final approval.

**Endpoint:** `POST /api/order-dispatches/{dispatch_id}/approve`

**Headers:**
```json
{
  "Authorization": "Bearer {finance-manager-token}",
  "Content-Type": "application/json",
  "Accept": "application/json"
}
```

**Payload:**
```json
{
  "comments": "Payment terms verified, final approval granted"
}
```

**Response:**
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
      "id": "finance-manager-uuid",
      "first_name": "Mike",
      "last_name": "Finance",
      "email": "finance@company.com"
    },
    "comments": "Payment terms verified, final approval granted",
    "approval_progress": {
      "total": 3,
      "approved": 3,
      "pending": 0,
      "percentage": 100
    },
    "is_fully_approved": true,
    "approval_chain": [
      {
        "order": 1,
        "status": "approved",
        "approved_at": "2025-11-19 14:30:00",
        "comments": "Order verified, customer credit OK, approved for dispatch",
        "approver": {
          "first_name": "John",
          "last_name": "Sales",
          "role": "Sales Manager"
        }
      },
      {
        "order": 2,
        "status": "approved",
        "approved_at": "2025-11-19 14:35:00",
        "comments": "Stock available and reserved for dispatch",
        "approver": {
          "first_name": "Jane",
          "last_name": "Warehouse",
          "role": "Warehouse Manager"
        }
      },
      {
        "order": 3,
        "status": "approved",
        "approved_at": "2025-11-19 14:40:00",
        "comments": "Payment terms verified, final approval granted",
        "approver": {
          "first_name": "Mike",
          "last_name": "Finance",
          "role": "Finance Manager"
        }
      }
    ]
  }
}
```

**What Happens:**
- Status changes: `pending` → `approved`
- Approval status: `in_progress` → `approved`
- `final_approved_at` timestamp recorded
- Progress: 3/3 (100%)
- **Dispatch is now ready for logistics creation**

### Step 4.5: Rejection Scenario

If any approver rejects at any stage:

**Endpoint:** `POST /api/order-dispatches/{dispatch_id}/reject`

**Payload:**
```json
{
  "reason": "Insufficient stock available in warehouse for this dispatch"
}
```

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
      "id": "warehouse-manager-uuid",
      "first_name": "Jane",
      "last_name": "Warehouse",
      "email": "warehouse@company.com"
    },
    "rejected_at": "2025-11-19 14:35:00",
    "rejection_reason": "Insufficient stock available in warehouse for this dispatch"
  }
}
```

**What Happens:**
- Status: `pending` → `cancelled`
- Approval status: → `rejected`
- Rejection recorded with reason
- Dispatch cannot proceed
- Must create new dispatch if needed

---

## 5. Creating Logistics

Once dispatch is **fully approved**, assign vehicle and driver for delivery.

### Step 5.1: Create Logistics Entry

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
  "estimated_departure_time": "08:00:00",
  "notes": "Handle with care - fragile items. Customer expects delivery before noon."
}
```

**Validation Rules:**
- `vehicle_id`: UUID, required, must exist and be available
- `driver_id`: UUID, required, must exist and be active
- `scheduled_delivery_date`: date, required, must be today or future
- `estimated_departure_time`: time, optional
- `notes`: string, optional

**Response:**
```json
{
  "success": true,
  "message": "Logistics created successfully",
  "data": {
    "id": "logistics-uuid",
    "dispatch_id": "19be6821-b10e-443d-8f25-fbd8adf8bc36",
    "dispatch_number": "ODI-0001",
    "vehicle_id": "vehicle-uuid",
    "driver_id": "driver-uuid",
    "scheduled_delivery_date": "2025-11-20",
    "estimated_departure_time": "08:00:00",
    "status": "in_transit",
    "notes": "Handle with care - fragile items. Customer expects delivery before noon.",
    "created_at": "2025-11-19 14:45:00",
    "vehicle": {
      "id": "vehicle-uuid",
      "registration_number": "KAA 123A",
      "vehicle_type": "Truck",
      "capacity": "5 tons",
      "is_active": true
    },
    "driver": {
      "id": "driver-uuid",
      "first_name": "David",
      "last_name": "Driver",
      "phone": "+254712345678",
      "license_number": "DL-12345",
      "is_active": true
    },
    "dispatch": {
      "dispatch_number": "ODI-0001",
      "order_number": "ORD-4026",
      "customer": {
        "name": "ABC Stores Ltd"
      },
      "delivery_location": {
        "name": "ABC Stores - Main Branch",
        "address": "123 Main Street, Nairobi",
        "contact_person": "Store Manager",
        "phone": "+254723456789"
      },
      "items": [
        {
          "product": "Coca Cola 500ml",
          "quantity": 100,
          "cartons": 5
        },
        {
          "product": "Fanta Orange 500ml",
          "quantity": 50,
          "cartons": 2
        }
      ]
    }
  }
}
```

**What Happens:**
- Dispatch status: `approved` → `in_transit`
- Vehicle and driver assigned
- Scheduled delivery date set
- Logistics tracking begins
- Driver can now see dispatch in their assigned deliveries

### Step 5.2: View Logistics Details

**Endpoint:** `GET /api/logistics/{logistics_id}`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "logistics-uuid",
    "dispatch_number": "ODI-0001",
    "order_number": "ORD-4026",
    "status": "in_transit",
    "vehicle": {
      "registration_number": "KAA 123A",
      "type": "Truck"
    },
    "driver": {
      "name": "David Driver",
      "phone": "+254712345678"
    },
    "scheduled_delivery_date": "2025-11-20",
    "estimated_departure_time": "08:00:00",
    "actual_departure_time": null,
    "actual_delivery_time": null,
    "delivery_location": {
      "name": "ABC Stores - Main Branch",
      "address": "123 Main Street, Nairobi"
    },
    "items": [...],
    "tracking_history": []
  }
}
```

### Step 5.3: Update Logistics (Optional)

Update logistics details if needed (vehicle change, driver change, etc.).

**Endpoint:** `PUT /api/logistics/{logistics_id}`

**Payload:**
```json
{
  "driver_id": "new-driver-uuid",
  "scheduled_delivery_date": "2025-11-21",
  "notes": "Driver changed due to unavailability. New delivery date scheduled."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Logistics updated successfully",
  "data": {
    "id": "logistics-uuid",
    "driver": {
      "name": "New Driver Name"
    },
    "scheduled_delivery_date": "2025-11-21",
    "notes": "Driver changed due to unavailability. New delivery date scheduled."
  }
}
```

---

## 6. Delivery Tracking

### Step 6.1: Mark Departure (Driver Leaves Warehouse)

**Endpoint:** `POST /api/logistics/{logistics_id}/mark-departure`

**Payload:**
```json
{
  "actual_departure_time": "2025-11-20 08:15:00",
  "notes": "Left warehouse at 8:15 AM, all items loaded"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Departure recorded successfully",
  "data": {
    "id": "logistics-uuid",
    "status": "in_transit",
    "actual_departure_time": "2025-11-20 08:15:00",
    "notes": "Left warehouse at 8:15 AM, all items loaded"
  }
}
```

### Step 6.2: Mark as Delivered

Final step - record delivery and quantities received.

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
  "received_by": "Store Manager - John Doe",
  "receiver_phone": "+254723456789",
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
  "delivery_notes": "2 bottles of Fanta damaged during transit. Customer accepted delivery with damage note.",
  "signature_image": "base64_encoded_signature_image"
}
```

**Validation Rules:**
- `delivered_at`: datetime, required
- `received_by`: string, required
- `items`: array, required
- `items.*.quantity_delivered`: integer, required, min: 0
- `items.*.quantity_damaged`: integer, required, min: 0
- `quantity_delivered + quantity_damaged` must equal `quantity_dispatched`

**Response:**
```json
{
  "success": true,
  "message": "Dispatch marked as delivered successfully",
  "data": {
    "id": "19be6821-b10e-443d-8f25-fbd8adf8bc36",
    "dispatch_number": "ODI-0001",
    "order_number": "ORD-4026",
    "status": "delivered",
    "delivered_at": "2025-11-20 10:30:00",
    "received_by": "Store Manager - John Doe",
    "receiver_phone": "+254723456789",
    "delivery_notes": "2 bottles of Fanta damaged during transit. Customer accepted delivery with damage note.",
    "items": [
      {
        "id": "dispatch-item-uuid-1",
        "product": {
          "name": "Coca Cola 500ml",
          "product_code": "COKE-500"
        },
        "quantity_dispatched": 100,
        "quantity_delivered": 100,
        "quantity_damaged": 0,
        "delivery_status": "complete"
      },
      {
        "id": "dispatch-item-uuid-2",
        "product": {
          "name": "Fanta Orange 500ml",
          "product_code": "FANTA-500"
        },
        "quantity_dispatched": 50,
        "quantity_delivered": 48,
        "quantity_damaged": 2,
        "delivery_status": "partial_damage"
      }
    ],
    "summary": {
      "total_items": 2,
      "total_quantity_dispatched": 150,
      "total_quantity_delivered": 148,
      "total_quantity_damaged": 2,
      "delivery_success_rate": "98.67%"
    },
    "logistics": {
      "driver": {
        "name": "David Driver"
      },
      "vehicle": {
        "registration_number": "KAA 123A"
      },
      "scheduled_delivery_date": "2025-11-20",
      "actual_delivery_time": "2025-11-20 10:30:00"
    }
  }
}
```

**What Happens:**
- Dispatch status: `in_transit` → `delivered`
- Delivery timestamp recorded
- Damaged quantities tracked separately
- Invoice can now be generated
- Inventory automatically updated
- Order marked as fulfilled (if all items dispatched)

---

## Complete Workflow Example

### End-to-End Scenario: ABC Stores Order

#### Timeline

**Day 1 - 9:00 AM: Order Creation**
```
Sales Rep creates order for ABC Stores
- 100 units Coca Cola 500ml
- 50 units Fanta Orange 500ml
Order Number: ORD-4026
Status: pending
```

**Day 1 - 9:15 AM: Dispatch Creation**
```
Warehouse coordinator creates dispatch from order
- Full order dispatch
- Auto-inherits 3 company approvers
Dispatch Number: ODI-0001
Status: draft
```

**Day 1 - 9:30 AM: Submit for Approval**
```
Warehouse coordinator submits dispatch
Status: draft → pending
Current Approver: Sales Manager (John)
```

**Day 1 - 10:00 AM: Sales Manager Approval**
```
John (Sales Manager) approves
Comment: "Customer credit verified, payment terms OK"
Status: pending
Approval Status: pending → in_progress
Progress: 1/3 (33%)
Current Approver: Warehouse Manager (Jane)
```

**Day 1 - 11:00 AM: Warehouse Manager Approval**
```
Jane (Warehouse Manager) approves
Comment: "Stock available, reserved for dispatch"
Status: pending
Approval Status: in_progress
Progress: 2/3 (67%)
Current Approver: Finance Manager (Mike)
```

**Day 1 - 2:00 PM: Finance Manager Approval**
```
Mike (Finance Manager) approves
Comment: "Final approval granted, proceed with dispatch"
Status: pending → approved
Approval Status: in_progress → approved
Progress: 3/3 (100%)
```

**Day 1 - 2:30 PM: Logistics Creation**
```
Logistics coordinator assigns vehicle and driver
Vehicle: KAA 123A (Truck)
Driver: David Driver
Scheduled: Tomorrow (Day 2) 8:00 AM
Status: approved → in_transit
```

**Day 2 - 8:15 AM: Departure**
```
Driver marks departure from warehouse
All items loaded and verified
Status: in_transit
```

**Day 2 - 10:30 AM: Delivery**
```
Delivered to ABC Stores Main Branch
Received by: Store Manager - John Doe
- 100 units Coca Cola (all delivered)
- 48 units Fanta delivered, 2 damaged
Status: in_transit → delivered
Delivery Success: 98.67%
```

**Day 2 - 11:00 AM: Invoice Generation**
```
System auto-generates invoice
Invoice sent to customer
Order marked as fulfilled
```

### Visual Flow

```
┌─────────────────┐
│  Create Order   │
│   ORD-4026      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Create Dispatch │
│   ODI-0001      │
│  Status: draft  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│     Submit      │
│ Status: pending │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Sales Approves  │
│  Progress: 33%  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│Warehouse Approve│
│  Progress: 67%  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│Finance Approves │
│  Progress: 100% │
│Status: approved │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│Create Logistics │
│ Assign Vehicle  │
│  & Driver       │
│Status:in_transit│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Mark Delivered  │
│Status: delivered│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│Generate Invoice │
│ Order Complete  │
└─────────────────┘
```

---

## Key Concepts Summary

### Order vs Dispatch

| Aspect | Order | Dispatch |
|--------|-------|----------|
| **Purpose** | Customer's purchase request | Actual fulfillment/shipment |
| **Quantity** | Total quantity ordered | Actual quantity being sent |
| **Status** | pending, confirmed, fulfilled | draft, pending, approved, in_transit, delivered |
| **Approval** | May require sales approval | Requires multi-level approval workflow |
| **Multiple** | One order per customer request | Multiple dispatches per order possible |
| **Logistics** | No logistics | Has vehicle, driver, delivery tracking |

### Dispatch Statuses

| Status | Description | Can Edit? | Next Actions |
|--------|-------------|-----------|--------------|
| `draft` | Just created, being prepared | ✅ Yes | Submit for approval |
| `pending` | Submitted, waiting for first approval | ❌ No | Approvers approve/reject |
| `in_progress` | Some approvers approved, others pending | ❌ No | Remaining approvers approve |
| `approved` | All approvers approved | ❌ No | Create logistics |
| `in_transit` | Logistics assigned, on delivery | ❌ No | Mark as delivered |
| `delivered` | Delivered to customer | ❌ No | Generate invoice |
| `cancelled` | Rejected by approver | ❌ No | Create new dispatch |

### Approval Workflow Rules

1. **Sequential Approval**: Approvers must approve in order (1 → 2 → 3)
2. **Cannot Skip**: Approver 2 cannot approve until Approver 1 approves
3. **One at a Time**: Only current approver can approve
4. **Immediate Rejection**: Any approver can reject, cancelling entire dispatch
5. **No Editing After Submit**: Once submitted, dispatch cannot be edited
6. **Same User Multiple Times**: Allowed - each step processed separately
7. **Auto-Skip Inactive**: System skips deleted/inactive users during initialization

### Best Practices

**For Orders:**
- Verify customer details before creating order
- Check product availability
- Confirm delivery location with customer
- Document special instructions in notes

**For Dispatches:**
- Create dispatch only when ready to fulfill
- Use partial dispatches for large orders
- Verify quantities before submitting
- Add detailed notes for approvers
- Double-check approvers before submit

**For Approvals:**
- Add meaningful comments explaining decision
- Review all details before approving
- Reject with clear reason if issues found
- Check stock availability (warehouse)
- Verify payment terms (finance)

**For Logistics:**
- Assign vehicle appropriate for load
- Ensure driver is available
- Set realistic delivery dates
- Add special handling instructions
- Verify delivery location details

**For Delivery:**
- Record accurate delivered quantities
- Document any damages immediately
- Get customer signature
- Take photos if damaged items
- Update status promptly

---

## API Endpoints Quick Reference

### Order Management
- `POST /api/orders` - Create order
- `GET /api/orders/{id}` - View order details

### Dispatch Management
- `POST /api/order-dispatches` - Create dispatch from order
- `GET /api/order-dispatches/{id}` - View dispatch details
- `PUT /api/order-dispatches/{id}` - Update dispatch (draft only)
- `POST /api/order-dispatches/{id}/submit` - Submit for approval

### Approval Configuration
- `GET /api/company/dispatch-settings` - Get company default approvers
- `PUT /api/company/dispatch-settings` - Update default approvers
- `GET /api/company/dispatch-settings/potential-approvers` - List available approvers

### Approval Actions
- `POST /api/order-dispatches/{id}/approve` - Approve (current approver)
- `POST /api/order-dispatches/{id}/reject` - Reject (current approver)

### Logistics Management
- `POST /api/order-dispatches/{id}/create-logistics` - Assign vehicle/driver
- `GET /api/logistics/{id}` - View logistics details
- `PUT /api/logistics/{id}` - Update logistics
- `POST /api/logistics/{id}/mark-departure` - Record departure

### Delivery Tracking
- `POST /api/order-dispatches/{id}/mark-delivered` - Record delivery

---

## Troubleshooting

### Common Issues

**Issue: "Cannot create dispatch - order already fully dispatched"**
- **Cause**: All order items have been dispatched
- **Solution**: Check order.quantity_remaining for each item

**Issue: "Cannot submit dispatch without approvers"**
- **Cause**: No company default approvers configured
- **Solution**: Configure company settings first: `PUT /api/company/dispatch-settings`

**Issue: "You are not the current approver"**
- **Cause**: Trying to approve out of sequence
- **Solution**: Wait for previous approver or check current approver

**Issue: "Cannot create logistics - dispatch not approved"**
- **Cause**: Trying to assign logistics before full approval
- **Solution**: Wait for all approvers to approve

**Issue: "Cannot update dispatch - already submitted"**
- **Cause**: Trying to edit after submission
- **Solution**: Reject and create new dispatch if changes needed

---

## Support

For technical support or questions:
- Email: support@company.com
- Documentation: /docs folder
- API Testing: Use provided test scripts

**Test Script:** `/test_simplified_approval.php`
```bash
php test_simplified_approval.php
```

---

**Last Updated:** November 19, 2025  
**Document Version:** 1.0  
**System Version:** Laravel 10.x with PostgreSQL
