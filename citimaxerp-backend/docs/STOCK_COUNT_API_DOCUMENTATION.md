# Stock Count API Documentation

## Overview

The Stock Count API allows you to manage inventory stock counts, including cycle counts and full counts. This system helps track inventory variances by comparing expected quantities with actual counted quantities.

---

## Table of Contents

1. [Authentication](#authentication)
2. [Stock Count Workflow](#stock-count-workflow)
3. [API Endpoints](#api-endpoints)
   - [List Stock Counts](#1-list-stock-counts)
   - [View Stock Count Details](#2-view-stock-count-details)
   - [Create Stock Count](#3-create-stock-count)
   - [Update Stock Count](#4-update-stock-count)
   - [Delete Stock Count](#5-delete-stock-count)
4. [Data Models](#data-models)
5. [Status Flow](#status-flow)
6. [Error Handling](#error-handling)

---

## Authentication

All endpoints require authentication using Laravel Sanctum bearer tokens.

**Headers Required:**
```
Authorization: Bearer {token}
Content-Type: application/json
```

---

## Stock Count Workflow

### Typical Stock Count Flow:

1. **Create** - Create a new stock count in `draft` status with expected quantities
2. **Start** - Update status to `in_progress` to begin counting
3. **Count** - Record actual counted quantities for each item
4. **Complete** - Update status to `completed` when counting is finished
5. **Approve** - Update status to `approved` to update inventory (optional)

### Status Transitions:

```
draft → in_progress → completed → approved
  ↓
cancelled (can be cancelled from draft or in_progress)
```

---

## API Endpoints

### Base URL
```
/api/stock-counts
```

---

### 1. List Stock Counts

**Endpoint:** `GET /api/stock-counts`

**Description:** Retrieve a list of all stock counts for the authenticated user's company.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| company_id | UUID | No | Filter by specific company (admin only) |
| store_id | UUID | No | Filter by specific store |
| status | String | No | Filter by status (draft, in_progress, completed, approved, cancelled) |
| count_type | String | No | Filter by type (cycle_count, full_count) |

**Example Request:**
```http
GET /api/stock-counts?store_id=f5c9bb5b-7b2c-4596-958a-0931f9595dac&status=completed
Authorization: Bearer {token}
```

**Success Response (200 OK):**
```json
{
  "status": "success",
  "stock_counts": [
    {
      "id": "88369cd4-7d1d-45e8-ba4a-8873b8d3f04f",
      "company_id": "14fafcd8-137b-4725-a6e9-7542ad27a6ed",
      "store_id": "f5c9bb5b-7b2c-4596-958a-0931f9595dac",
      "count_number": "SC-0002",
      "name": "Monthly Stock Count - November 2025",
      "count_type": "cycle_count",
      "status": "completed",
      "scheduled_date": null,
      "total_products_expected": 2,
      "total_products_counted": 2,
      "total_variances": 2,
      "total_variance_value": "0.00",
      "created_at": "2025-11-04T11:13:56.000000Z",
      "updated_at": "2025-11-04T11:14:20.000000Z",
      "store": {
        "id": "f5c9bb5b-7b2c-4596-958a-0931f9595dac",
        "name": "Main Store"
      }
    }
  ]
}
```

---

### 2. View Stock Count Details

**Endpoint:** `GET /api/stock-counts/{id}`

**Description:** Retrieve detailed information about a specific stock count, including all items.

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | UUID | Yes | Stock count ID |

**Example Request:**
```http
GET /api/stock-counts/88369cd4-7d1d-45e8-ba4a-8873b8d3f04f
Authorization: Bearer {token}
```

**Success Response (200 OK):**
```json
{
  "status": "success",
  "message": "Stock count details retrieved successfully.",
  "stock_count": {
    "id": "88369cd4-7d1d-45e8-ba4a-8873b8d3f04f",
    "company_id": "14fafcd8-137b-4725-a6e9-7542ad27a6ed",
    "store_id": "f5c9bb5b-7b2c-4596-958a-0931f9595dac",
    "count_number": "SC-0002",
    "name": "Monthly Stock Count - November 2025",
    "description": "Regular monthly inventory count",
    "count_type": "cycle_count",
    "status": "completed",
    "location": "Main Warehouse",
    "category_filter": "Beverages",
    "scheduled_date": null,
    "started_at": "2025-11-04T11:14:00.000000Z",
    "completed_at": "2025-11-04T11:14:15.000000Z",
    "approved_at": null,
    "created_by": "admin@cherrydist.com",
    "assigned_to": "warehouse@example.com",
    "approved_by": null,
    "total_products_expected": 2,
    "total_products_counted": 2,
    "total_variances": 2,
    "total_variance_value": "0.00",
    "created_at": "2025-11-04T11:13:56.000000Z",
    "updated_at": "2025-11-04T11:14:20.000000Z",
    "store": {
      "id": "f5c9bb5b-7b2c-4596-958a-0931f9595dac",
      "name": "Main Store"
    },
    "items": [
      {
        "id": "ce603b75-cae2-4b69-bca0-00ac381fdd25",
        "stock_count_id": "88369cd4-7d1d-45e8-ba4a-8873b8d3f04f",
        "product_id": "b93d477d-dee6-4b68-ada1-4d1522ada5a8",
        "product_name": "Coca-Cola 500ml",
        "product_sku": "COKE-500",
        "product_category": "Beverages",
        "unit_cost": "35.00",
        "expected_quantity": 500,
        "counted_quantity": 495,
        "variance_quantity": -5,
        "variance_value": "-175.00",
        "is_counted": true,
        "requires_recount": false,
        "is_variance": true,
        "counted_by": "admin@cherrydist.com",
        "counted_at": "2025-11-04T11:14:10.000000Z",
        "notes": "Found 5 units short",
        "product": {
          "id": "b93d477d-dee6-4b68-ada1-4d1522ada5a8",
          "name": "Coca-Cola 500ml",
          "unit_cost": "35.00"
        }
      },
      {
        "id": "1a69ad10-c75e-4a18-8e6d-e0daf9dd51f4",
        "stock_count_id": "88369cd4-7d1d-45e8-ba4a-8873b8d3f04f",
        "product_id": "e1972b65-3e71-48c9-9249-c38388eb6673",
        "product_name": "Sprite 500ml",
        "product_sku": "SPRITE-500",
        "product_category": "Beverages",
        "unit_cost": "35.00",
        "expected_quantity": 450,
        "counted_quantity": 455,
        "variance_quantity": 5,
        "variance_value": "175.00",
        "is_counted": true,
        "requires_recount": false,
        "is_variance": true,
        "counted_by": "admin@cherrydist.com",
        "counted_at": "2025-11-04T11:14:10.000000Z",
        "notes": "Found 5 units extra",
        "product": {
          "id": "e1972b65-3e71-48c9-9249-c38388eb6673",
          "name": "Sprite 500ml",
          "unit_cost": "35.00"
        }
      }
    ]
  }
}
```

**Error Response (404 Not Found):**
```json
{
  "status": "failed",
  "message": "Stock count not found or not authorized."
}
```

---

### 3. Create Stock Count

**Endpoint:** `POST /api/stock-counts`

**Description:** Create a new stock count with items.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| company_id | UUID | Yes | Company ID |
| store_id | UUID | Yes | Store ID |
| name | String | Yes | Stock count name (max 255 chars) |
| description | String | No | Description of the stock count |
| count_type | String | Yes | Type of count: `cycle_count` or `full_count` |
| status | String | Yes | Initial status: `draft` or `in_progress` |
| location | String | No | Physical location (max 255 chars) |
| category_filter | String | No | Product category filter (max 255 chars) |
| assigned_to | String | No | Email of assigned person (max 255 chars) |
| items | Array | Yes | Array of stock count items (min 1 item) |
| items[].product_id | UUID | Yes | Product ID |
| items[].expected_quantity | Integer | Yes | Expected quantity (≥ 0) |
| items[].counted_quantity | Integer | No | Actual counted quantity |
| items[].notes | String | No | Notes for this item |
| items[].requires_recount | Boolean | No | Whether item needs recount (default: false) |

**Example Request:**
```json
{
  "company_id": "14fafcd8-137b-4725-a6e9-7542ad27a6ed",
  "store_id": "f5c9bb5b-7b2c-4596-958a-0931f9595dac",
  "name": "Monthly Stock Count - November 2025",
  "description": "Regular monthly inventory count",
  "count_type": "cycle_count",
  "status": "draft",
  "location": "Main Warehouse",
  "category_filter": "Beverages",
  "assigned_to": "warehouse@example.com",
  "items": [
    {
      "product_id": "b93d477d-dee6-4b68-ada1-4d1522ada5a8",
      "expected_quantity": 500,
      "counted_quantity": null,
      "notes": "Coca-Cola 500ml"
    },
    {
      "product_id": "e1972b65-3e71-48c9-9249-c38388eb6673",
      "expected_quantity": 450,
      "counted_quantity": null,
      "notes": "Sprite 500ml"
    }
  ]
}
```

**Success Response (201 Created):**
```json
{
  "status": "success",
  "message": "Stock count created successfully.",
  "stock_count": {
    "id": "88369cd4-7d1d-45e8-ba4a-8873b8d3f04f",
    "company_id": "14fafcd8-137b-4725-a6e9-7542ad27a6ed",
    "store_id": "f5c9bb5b-7b2c-4596-958a-0931f9595dac",
    "count_number": "SC-0002",
    "name": "Monthly Stock Count - November 2025",
    "description": "Regular monthly inventory count",
    "count_type": "cycle_count",
    "status": "draft",
    "location": "Main Warehouse",
    "category_filter": "Beverages",
    "scheduled_date": null,
    "started_at": null,
    "completed_at": null,
    "approved_at": null,
    "created_by": "admin@cherrydist.com",
    "assigned_to": "warehouse@example.com",
    "approved_by": null,
    "total_products_expected": 2,
    "total_products_counted": 0,
    "total_variances": 0,
    "total_variance_value": "0.00",
    "created_at": "2025-11-04T11:13:56.000000Z",
    "updated_at": "2025-11-04T11:13:56.000000Z",
    "store": {
      "id": "f5c9bb5b-7b2c-4596-958a-0931f9595dac",
      "name": "Main Store"
    },
    "items": [
      {
        "id": "ce603b75-cae2-4b69-bca0-00ac381fdd25",
        "company_id": "14fafcd8-137b-4725-a6e9-7542ad27a6ed",
        "store_id": "f5c9bb5b-7b2c-4596-958a-0931f9595dac",
        "stock_count_id": "88369cd4-7d1d-45e8-ba4a-8873b8d3f04f",
        "product_id": "b93d477d-dee6-4b68-ada1-4d1522ada5a8",
        "product_name": "Coca-Cola 500ml",
        "product_sku": "COKE-500",
        "product_category": "Beverages",
        "unit_cost": "35.00",
        "expected_quantity": 500,
        "counted_quantity": null,
        "variance_quantity": null,
        "variance_value": null,
        "counted_by": null,
        "counted_at": null,
        "notes": "Coca-Cola 500ml",
        "is_counted": false,
        "requires_recount": false,
        "is_variance": null,
        "created_at": "2025-11-04T11:13:56.000000Z",
        "updated_at": "2025-11-04T11:13:56.000000Z",
        "product": {
          "id": "b93d477d-dee6-4b68-ada1-4d1522ada5a8",
          "name": "Coca-Cola 500ml",
          "unit_cost": "35.00"
        }
      }
    ]
  }
}
```

**Validation Errors (400 Bad Request):**
```json
{
  "status": "failed",
  "message": {
    "name": ["The name field is required."],
    "items": ["The items field must contain at least 1 item."]
  }
}
```

---

### 4. Update Stock Count

**Endpoint:** `PATCH /api/stock-counts/{id}` or `PUT /api/stock-counts/{id}`

**Description:** Update an existing stock count. This endpoint is used for:
- Updating stock count status
- Recording counted quantities
- Modifying items

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | UUID | Yes | Stock count ID |

**Request Body (Partial Update Allowed):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | String | No | Stock count name |
| description | String | No | Description |
| count_type | String | No | `cycle_count` or `full_count` |
| status | String | No | `draft`, `in_progress`, `completed`, `approved`, `cancelled` |
| location | String | No | Physical location |
| category_filter | String | No | Product category filter |
| started_at | DateTime | No | When counting started |
| completed_at | DateTime | No | When counting completed |
| approved_at | DateTime | No | When approved |
| assigned_to | String | No | Email of assigned person |
| approved_by | String | No | Email of approver |
| items | Array | No | Updated items array |
| items[].id | UUID | No | Existing item ID (omit to create new) |
| items[].product_id | UUID | Yes | Product ID |
| items[].expected_quantity | Integer | Yes | Expected quantity |
| items[].counted_quantity | Integer | No | Actual counted quantity |
| items[].notes | String | No | Item notes |
| items[].requires_recount | Boolean | No | Recount flag |

**Example Request (Update Status):**
```json
{
  "status": "in_progress"
}
```

**Example Request (Record Counted Quantities):**
```json
{
  "items": [
    {
      "id": "ce603b75-cae2-4b69-bca0-00ac381fdd25",
      "product_id": "b93d477d-dee6-4b68-ada1-4d1522ada5a8",
      "expected_quantity": 500,
      "counted_quantity": 495,
      "notes": "Found 5 units short"
    },
    {
      "id": "1a69ad10-c75e-4a18-8e6d-e0daf9dd51f4",
      "product_id": "e1972b65-3e71-48c9-9249-c38388eb6673",
      "expected_quantity": 450,
      "counted_quantity": 455,
      "notes": "Found 5 units extra"
    }
  ]
}
```

**Example Request (Complete Stock Count):**
```json
{
  "status": "completed",
  "completed_at": "2025-11-04T11:14:15.000000Z"
}
```

**Example Request (Approve Stock Count):**
```json
{
  "status": "approved",
  "approved_by": "admin@cherrydist.com",
  "approved_at": "2025-11-04T11:15:00.000000Z"
}
```

**Success Response (200 OK):**
```json
{
  "status": "success",
  "message": "Stock count updated successfully.",
  "stock_count": {
    "id": "88369cd4-7d1d-45e8-ba4a-8873b8d3f04f",
    "company_id": "14fafcd8-137b-4725-a6e9-7542ad27a6ed",
    "store_id": "f5c9bb5b-7b2c-4596-958a-0931f9595dac",
    "count_number": "SC-0002",
    "name": "Monthly Stock Count - November 2025",
    "status": "in_progress",
    "started_at": "2025-11-04T11:14:00.000000Z",
    "created_at": "2025-11-04T11:13:56.000000Z",
    "updated_at": "2025-11-04T11:14:05.000000Z",
    "store": {
      "id": "f5c9bb5b-7b2c-4596-958a-0931f9595dac",
      "name": "Main Store"
    },
    "items": [...]
  }
}
```

**Important Notes:**
- When status is changed to `approved`, the system automatically updates product inventory quantities based on counted values
- Items not included in the update will be deleted
- When updating items, include the `id` field to update existing items, or omit it to create new items

---

### 5. Delete Stock Count

**Endpoint:** `DELETE /api/stock-counts/{id}`

**Description:** Delete a stock count. Only non-approved stock counts can be deleted.

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | UUID | Yes | Stock count ID |

**Example Request:**
```http
DELETE /api/stock-counts/88369cd4-7d1d-45e8-ba4a-8873b8d3f04f
Authorization: Bearer {token}
```

**Success Response (200 OK):**
```json
{
  "status": "success",
  "message": "Stock count deleted successfully."
}
```

**Error Response (400 Bad Request - Approved Stock Count):**
```json
{
  "status": "failed",
  "message": "Cannot delete an approved stock count."
}
```

**Error Response (404 Not Found):**
```json
{
  "status": "failed",
  "message": "Stock count not found."
}
```

---

## Data Models

### Stock Count Object

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| company_id | UUID | Company ID |
| store_id | UUID | Store ID |
| count_number | String | Auto-generated count number (e.g., "SC-0001") |
| name | String | Stock count name |
| description | String | Description |
| count_type | String | Type: `cycle_count` or `full_count` |
| status | String | Status: `draft`, `in_progress`, `completed`, `approved`, `cancelled` |
| location | String | Physical location |
| category_filter | String | Product category filter |
| scheduled_date | DateTime | Scheduled date (nullable) |
| started_at | DateTime | When counting started |
| completed_at | DateTime | When counting completed |
| approved_at | DateTime | When approved |
| created_by | String | Email of creator |
| assigned_to | String | Email of assigned person |
| approved_by | String | Email of approver |
| total_products_expected | Integer | Total number of products |
| total_products_counted | Integer | Number of products counted |
| total_variances | Integer | Number of items with variances |
| total_variance_value | Decimal | Total monetary value of variances |
| created_at | DateTime | Creation timestamp |
| updated_at | DateTime | Last update timestamp |

### Stock Count Item Object

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| company_id | UUID | Company ID |
| store_id | UUID | Store ID |
| stock_count_id | UUID | Parent stock count ID |
| product_id | UUID | Product ID |
| product_name | String | Product name (snapshot) |
| product_sku | String | Product SKU (snapshot) |
| product_category | String | Product category (snapshot) |
| unit_cost | Decimal | Unit cost (snapshot) |
| expected_quantity | Integer | Expected quantity |
| counted_quantity | Integer | Actual counted quantity (nullable) |
| variance_quantity | Integer | Calculated: counted - expected |
| variance_value | Decimal | Calculated: variance_quantity × unit_cost |
| counted_by | String | Email of counter |
| counted_at | DateTime | When counted |
| notes | String | Item-specific notes |
| is_counted | Boolean | Whether item has been counted |
| requires_recount | Boolean | Whether item needs recounting |
| is_variance | Boolean | Whether there's a variance |
| created_at | DateTime | Creation timestamp |
| updated_at | DateTime | Last update timestamp |

---

## Status Flow

### Status Descriptions

| Status | Description | Actions Available |
|--------|-------------|-------------------|
| **draft** | Initial state, stock count is being prepared | Edit, Delete, Start |
| **in_progress** | Counting is actively happening | Record counts, Edit, Complete, Cancel |
| **completed** | Counting finished, awaiting approval | Approve, Edit items, Cancel |
| **approved** | Final state, inventory updated | View only (cannot edit/delete) |
| **cancelled** | Stock count was cancelled | View only |

### Valid Transitions

- `draft` → `in_progress`
- `draft` → `cancelled`
- `in_progress` → `completed`
- `in_progress` → `cancelled`
- `completed` → `approved`
- `completed` → `in_progress` (to recount)

### Inventory Update Behavior

When a stock count is **approved**:
- System automatically updates product inventory quantities
- Only products with variances (`is_variance = true`) are updated
- Only products with `track_inventory = true` are updated
- Product stock quantity is set to the counted quantity

---

## Error Handling

### Common Error Responses

**403 Forbidden - Unauthorized:**
```json
{
  "status": "failed",
  "message": "Unauthorized to create stock counts."
}
```

**400 Bad Request - Validation Error:**
```json
{
  "status": "failed",
  "message": {
    "company_id": ["The company id field is required."],
    "items.0.expected_quantity": ["The items.0.expected_quantity must be at least 0."]
  }
}
```

**404 Not Found:**
```json
{
  "status": "failed",
  "message": "Stock count not found."
}
```

**500 Internal Server Error:**
```json
{
  "status": "failed",
  "message": "Failed to create stock count: [error details]"
}
```

### Validation Rules

#### Stock Count Creation/Update:
- `company_id`: Required UUID, must exist in companies table
- `store_id`: Required UUID, must exist in stores table
- `name`: Required string, max 255 characters
- `count_type`: Required, must be `cycle_count` or `full_count`
- `status`: Must be one of: `draft`, `in_progress`, `completed`, `approved`, `cancelled`
- `items`: Required array with at least 1 item

#### Stock Count Items:
- `product_id`: Required UUID, must exist and belong to the same company/store
- `expected_quantity`: Required integer, must be ≥ 0
- `counted_quantity`: Optional integer, must be ≥ 0 if provided
- When `counted_quantity` is provided, `counted_by` and `counted_at` are automatically set

---

## Best Practices

### For Frontend Implementation:

1. **Creating a Stock Count:**
   - Start with status `draft`
   - Allow users to add products with expected quantities
   - Don't set `counted_quantity` initially

2. **Starting a Count:**
   - Update status to `in_progress`
   - Set `started_at` timestamp

3. **Recording Counts:**
   - Update items with `counted_quantity`
   - System automatically calculates variances
   - Mark items with `requires_recount` if needed

4. **Completing a Count:**
   - Update status to `completed`
   - Set `completed_at` timestamp
   - Review variances before approval

5. **Approving a Count:**
   - Update status to `approved`
   - Set `approved_by` and `approved_at`
   - **Warning:** This updates actual inventory - ensure counts are accurate

6. **Filtering and Reporting:**
   - Use query parameters to filter by status, store, or type
   - Display variance reports highlighting items with discrepancies
   - Show monetary impact using `total_variance_value`

### UI Recommendations:

- Show visual indicators for variance items (`is_variance = true`)
- Highlight items requiring recount (`requires_recount = true`)
- Display count progress (counted vs expected items)
- Provide warnings before approving (inventory will be updated)
- Disable editing/deletion for approved counts
- Show count number (`SC-XXXX`) for easy reference

---

## Example Workflows

### Complete Stock Count Flow

```
1. Create Stock Count
   POST /api/stock-counts
   {
     "name": "Weekly Cycle Count",
     "status": "draft",
     "items": [...]
   }

2. Start Counting
   PATCH /api/stock-counts/{id}
   {
     "status": "in_progress"
   }

3. Record Counts
   PATCH /api/stock-counts/{id}
   {
     "items": [
       {
         "id": "{item_id}",
         "counted_quantity": 495
       }
     ]
   }

4. Complete Count
   PATCH /api/stock-counts/{id}
   {
     "status": "completed"
   }

5. Review and Approve
   GET /api/stock-counts/{id}  // Review variances
   
   PATCH /api/stock-counts/{id}
   {
     "status": "approved"
   }
```

---

## Notes

- All timestamps are in UTC
- Count numbers are auto-generated sequentially per company/store (SC-0001, SC-0002, etc.)
- Variance calculations are automatic and stored as computed columns
- Approved stock counts cannot be edited or deleted
- Deleting a stock count also deletes all associated items (cascade)
- The system tracks who created, counted, and approved each stock count

---

## Support

For technical support or questions about this API, contact the backend development team.
