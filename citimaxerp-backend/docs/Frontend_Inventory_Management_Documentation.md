# Cherry API - Inventory Management Frontend Documentation

## Overview

This documentation covers the complete inventory management system including product receipts, batch tracking, and individual serial number management. The system provides end-to-end traceability from product receipt to individual unit tracking.

## Table of Contents

1. [Product Receipt Management](#product-receipt-management)
2. [Inventory Batch Tracking](#inventory-batch-tracking)
3. [Individual Serial Number Tracking](#individual-serial-number-tracking)
4. [Product Management](#product-management)
5. [Inventory Queries](#inventory-queries)
6. [Complete Workflow Examples](#complete-workflow-examples)

---

## Product Receipt Management

### Create Product Receipt

**Function**: Create new product receipts with automatic inventory updates, batch creation, and serial number tracking.

**Endpoint**: `POST /api/product-receipts`

**Authentication**: Bearer Token Required

#### Payload Structure

```json
{
  "company_id": "string (UUID, optional)",
  "store_id": "string (UUID, required)",
  "supplier_id": "string (UUID, optional)",
  "contractor_id": "string (UUID, optional)",
  "document_type": "string (required)",
  "reference_number": "string (optional)",
  "received_by": "string (UUID, required)",
  "document_url": "string (optional)",
  "items": "array (required)"
}
```

#### Receipt Level Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `company_id` | UUID | ❌ Optional | Company ID (defaults to authenticated user's company) |
| `store_id` | UUID | ✅ **Required** | Store receiving the products |
| `supplier_id` | UUID | ❌ Optional | Supplier providing the products |
| `contractor_id` | UUID | ❌ Optional | Contractor involved in delivery |
| `document_type` | String | ✅ **Required** | One of: `receipt`, `invoice`, `delivery_note`, `notification_note` |
| `reference_number` | String | ❌ Optional | External reference (invoice number, etc.) |
| `received_by` | UUID | ✅ **Required** | User ID receiving the products |
| `document_url` | String | ❌ Optional | URL to uploaded document |
| `items` | Array | ✅ **Required** | Array of product items (minimum 1 item) |

#### Item Level Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `product_id` | UUID | ❌ Optional | Existing product ID |
| `sku` | String | ❌ Optional | Product SKU (used to find/create product) |
| `barcode` | String | ❌ Optional | Product barcode |
| `name` | String | ❌ Optional | Product name (for auto-creation) |
| `variant_id` | UUID | ❌ Optional | Product variant ID |
| `quantity` | Integer | ✅ **Required** | Number of units received (min: 1) |
| `unit_price` | Decimal | ❌ Optional | Selling price per unit |
| `unit_cost` | Decimal | ❌ Optional | Cost price per unit |
| `expiry_date` | Date | ❌ Optional | Product expiry date |
| `notes` | String | ❌ Optional | Item-specific notes |

#### Batch Tracking Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `batch_number` | String | ❌ Optional | Inventory batch number |
| `lot_number` | String | ❌ Optional | Manufacturing lot number |
| `manufacture_date` | Date | ❌ Optional | Manufacturing date |
| `supplier` | String | ❌ Optional | Supplier name for this item |
| `supplier_id` | UUID | ❌ Optional | Supplier ID for this item |

#### Serial Number Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `serial_numbers` | Array | ❌ Optional | Pre-existing serial numbers |
| `track_serials` | Boolean | ❌ Optional | Enable auto-generation of serials |
| `serial_prefix` | String | ❌ Optional | Prefix for auto-generated serials |
| `warranty_months` | Integer | ❌ Optional | Warranty period in months |

#### Example Payload

```json
{
  "store_id": "550e8400-e29b-41d4-a716-446655440001",
  "supplier_id": "550e8400-e29b-41d4-a716-446655440002",
  "document_type": "receipt",
  "reference_number": "SUP-INV-2025-001",
  "received_by": "550e8400-e29b-41d4-a716-446655440004",
  "items": [
    {
      "product_id": "550e8400-e29b-41d4-a716-446655440010",
      "quantity": 3,
      "unit_price": 1200.00,
      "unit_cost": 1000.00,
      "serial_numbers": [
        "DELL123456789",
        "DELL987654321",
        "DELL456789123"
      ],
      "warranty_months": 24,
      "batch_number": "BATCH-DELL-2025-Q3",
      "notes": "Dell Laptops with manufacturer serials"
    },
    {
      "sku": "MOUSE-LOG-001",
      "name": "Logitech Mouse",
      "quantity": 10,
      "unit_price": 25.00,
      "track_serials": true,
      "serial_prefix": "LOG",
      "warranty_months": 12
    }
  ]
}
```

#### Response

**Success (201)**:
```json
{
  "status": "success",
  "message": "Product receipt created successfully.",
  "receipts": [
    {
      "id": "receipt-uuid",
      "product_receipt_number": "RCPT-12345678-0001",
      "company_id": "company-uuid",
      "store_id": "store-uuid",
      "supplier_id": "supplier-uuid",
      "document_type": "receipt",
      "reference_number": "SUP-INV-2025-001",
      "received_by": "user-uuid",
      "created_at": "2025-09-11T10:30:00Z",
      "product_receipt_items": [...]
    }
  ]
}
```

**Error (422)**:
```json
{
  "status": "failed",
  "message": "Product 'Dell Laptop': Serial numbers count (2) must match quantity (3)",
  "errors": {
    "items.0.serial_numbers": ["Serial count must match quantity"]
  }
}
```

---

### Update Product Receipt

**Function**: Update existing product receipt with inventory adjustments.

**Endpoint**: `PATCH /api/product-receipts/{id}`

**Payload**: Same structure as create, but all fields are optional except where items are being updated.

---

### Get Product Receipts

**Function**: Retrieve paginated list of product receipts.

**Endpoint**: `GET /api/product-receipts`

**Query Parameters**:
- `company_id` (optional): Filter by company
- `page` (optional): Page number for pagination

---

### Get Single Product Receipt

**Function**: Retrieve detailed product receipt with all items and relationships.

**Endpoint**: `GET /api/product-receipts/{id}`

**Response includes**: Receipt details, items, supplier info, contractor info, recipient info.

---

## Inventory Batch Tracking

### Get Inventory Batches

**Function**: Retrieve inventory batches with filtering and search capabilities.

**Endpoint**: `GET /api/inventory/batches`

**Query Parameters**:
- `product_id` (optional): Filter by product
- `store_id` (optional): Filter by store
- `status` (optional): Filter by status (`active`, `expired`, `sold_out`)
- `search` (optional): Search by batch number or lot number

#### Response
```json
{
  "status": "success",
  "batches": [
    {
      "id": "batch-uuid",
      "batch_number": "BATCH-DELL-2025-Q3",
      "lot_number": "LOT-DEL-092025",
      "product_id": "product-uuid",
      "store_id": "store-uuid",
      "quantity_received": 10,
      "quantity_available": 8,
      "quantity_sold": 2,
      "manufacture_date": "2025-08-15",
      "expiry_date": "2027-09-11",
      "status": "active",
      "product": {...},
      "store": {...}
    }
  ]
}
```

---

### Get Single Batch

**Function**: Get detailed batch information including serial numbers.

**Endpoint**: `GET /api/inventory/batches/{id}`

---

### Update Batch Quantities

**Function**: Manually adjust batch quantities for damaged, expired, or sold items.

**Endpoint**: `PATCH /api/inventory/batches/{id}`

**Payload**:
```json
{
  "quantity_damaged": 1,
  "quantity_expired": 0,
  "quantity_sold": 5,
  "notes": "Updated inventory count"
}
```

---

## Individual Serial Number Tracking

### Get Serial Numbers

**Function**: Retrieve serial numbers with filtering and tracking information.

**Endpoint**: `GET /api/inventory/serials`

**Query Parameters**:
- `product_id` (optional): Filter by product
- `batch_id` (optional): Filter by batch
- `status` (optional): Filter by status (`active`, `sold`, `damaged`, `returned`)
- `search` (optional): Search by serial number
- `store_id` (optional): Filter by store

#### Response
```json
{
  "status": "success",
  "serials": [
    {
      "id": "serial-uuid",
      "serial_number": "DELL123456789",
      "product_id": "product-uuid",
      "batch_id": "batch-uuid",
      "status": "active",
      "unit_cost": 1000.00,
      "unit_price": 1200.00,
      "received_date": "2025-09-11",
      "warranty_expiry_date": "2027-09-11",
      "purchase_reference": "RCPT-12345678-0001",
      "product": {...},
      "batch": {...}
    }
  ]
}
```

---

### Get Single Serial

**Function**: Get detailed serial number information and history.

**Endpoint**: `GET /api/inventory/serials/{id}`

---

### Update Serial Status

**Function**: Update serial number status (sold, damaged, returned, etc.).

**Endpoint**: `PATCH /api/inventory/serials/{id}`

**Payload**:
```json
{
  "status": "sold",
  "sold_date": "2025-09-11",
  "sold_to": "customer-uuid",
  "sale_price": 1150.00,
  "notes": "Sold to customer with extended warranty"
}
```

---

### Generate Serial Numbers

**Function**: Generate additional serial numbers for existing products.

**Endpoint**: `POST /api/inventory/serials/generate`

**Payload**:
```json
{
  "product_id": "product-uuid",
  "batch_id": "batch-uuid",
  "quantity": 5,
  "prefix": "CUSTOM",
  "warranty_months": 12
}
```

---

## Product Management

### Create Product

**Function**: Create new product with inventory tracking setup.

**Endpoint**: `POST /api/products`

**Payload**:
```json
{
  "name": "Product Name",
  "sku": "PROD-001",
  "barcode": "123456789012",
  "category_id": "category-uuid",
  "description": "Product description",
  "unit_price": 100.00,
  "cost_price": 80.00,
  "track_inventory": true,
  "track_serials": true,
  "track_batches": true,
  "minimum_stock": 10,
  "maximum_stock": 100
}
```

---

### Update Product

**Function**: Update product information and tracking settings.

**Endpoint**: `PATCH /api/products/{id}`

---

### Get Products

**Function**: Retrieve products with inventory information.

**Endpoint**: `GET /api/products`

**Query Parameters**:
- `category_id` (optional): Filter by category
- `track_serials` (optional): Filter by serial tracking
- `search` (optional): Search by name, SKU, or barcode

---

## Inventory Queries

### Get Inventory Summary

**Function**: Get overall inventory summary by store/company.

**Endpoint**: `GET /api/inventory/summary`

**Query Parameters**:
- `store_id` (optional): Filter by store
- `company_id` (optional): Filter by company

#### Response
```json
{
  "status": "success",
  "summary": {
    "total_products": 150,
    "total_batches": 45,
    "total_serials": 1250,
    "low_stock_products": 8,
    "expired_batches": 2,
    "damaged_items": 3,
    "inventory_value": 125000.00
  }
}
```

---

### Get Low Stock Report

**Function**: Get products with low stock levels.

**Endpoint**: `GET /api/inventory/low-stock`

---

### Get Expiry Report

**Function**: Get products/batches nearing expiry.

**Endpoint**: `GET /api/inventory/expiry-report`

**Query Parameters**:
- `days_ahead` (optional): Look ahead days (default: 30)

---

### Search Inventory

**Function**: Advanced search across all inventory levels.

**Endpoint**: `GET /api/inventory/search`

**Query Parameters**:
- `q` (required): Search query
- `type` (optional): Search type (`product`, `batch`, `serial`)

---

## Complete Workflow Examples

### Workflow 1: Receiving Products with Pre-existing Serials

```javascript
// 1. Create receipt with manufacturer serials
const receiptResponse = await fetch('/api/product-receipts', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    store_id: storeId,
    document_type: 'invoice',
    received_by: userId,
    items: [{
      product_id: productId,
      quantity: 3,
      unit_price: 999.00,
      serial_numbers: ['APPLE123', 'APPLE456', 'APPLE789'],
      warranty_months: 12,
      batch_number: 'APPLE-BATCH-001'
    }]
  })
});

// 2. System automatically creates:
// - ProductReceipt record
// - ProductReceiptItem records
// - InventoryBatch record
// - Individual InventorySerial records (3)
// - Updates product stock quantity

// 3. Query the created serials
const serialsResponse = await fetch(`/api/inventory/serials?product_id=${productId}`);
```

---

### Workflow 2: Auto-generating Serial Numbers

```javascript
// 1. Create receipt with auto-generation
const receiptResponse = await fetch('/api/product-receipts', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    store_id: storeId,
    document_type: 'receipt',
    received_by: userId,
    items: [{
      sku: 'WIDGET-001',
      name: 'Industrial Widget',
      quantity: 10,
      unit_price: 50.00,
      track_serials: true,
      serial_prefix: 'WDG',
      warranty_months: 6
    }]
  })
});

// 2. System generates serials like:
// WDG-250911-0001, WDG-250911-0002, etc.
```

---

### Workflow 3: Tracking Product Lifecycle

```javascript
// 1. Check serial status
const serial = await fetch('/api/inventory/serials/search?q=DELL123456789');

// 2. Update when sold
await fetch(`/api/inventory/serials/${serialId}`, {
  method: 'PATCH',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    status: 'sold',
    sold_date: '2025-09-11',
    sold_to: customerId,
    sale_price: 1150.00
  })
});

// 3. Track warranty and service history
const history = await fetch(`/api/inventory/serials/${serialId}/history`);
```

---

### Workflow 4: Inventory Reporting

```javascript
// 1. Get inventory summary
const summary = await fetch('/api/inventory/summary?store_id=' + storeId);

// 2. Check low stock items
const lowStock = await fetch('/api/inventory/low-stock');

// 3. Check expiring batches
const expiring = await fetch('/api/inventory/expiry-report?days_ahead=30');

// 4. Generate reports for management
const reportData = {
  summary: summary.data,
  lowStock: lowStock.data,
  expiring: expiring.data
};
```

---

## Error Handling

### Common Error Responses

**400 Bad Request**:
```json
{
  "status": "failed",
  "message": "Invalid request format"
}
```

**401 Unauthorized**:
```json
{
  "status": "failed",
  "message": "Authentication required"
}
```

**403 Forbidden**:
```json
{
  "status": "failed",
  "message": "Insufficient permissions"
}
```

**422 Validation Error**:
```json
{
  "status": "failed",
  "message": "Validation failed",
  "errors": {
    "field_name": ["Error message"]
  }
}
```

**500 Server Error**:
```json
{
  "status": "failed",
  "message": "Internal server error"
}
```

---

## Frontend Implementation Tips

### 1. Form Validation
- Validate serial count matches quantity before submission
- Check for duplicate serial numbers in real-time
- Validate date formats and ranges

### 2. UI/UX Considerations
- Provide clear indicators for required vs optional fields
- Show real-time inventory updates after receipt creation
- Implement barcode scanning for serial number input
- Use progressive disclosure for advanced features

### 3. State Management
- Cache frequently accessed inventory data
- Implement optimistic updates for better UX
- Handle offline scenarios for mobile inventory apps

### 4. Performance Optimization
- Implement pagination for large inventory lists
- Use debounced search for real-time filtering
- Lazy load detailed information when needed

This documentation provides complete coverage of the inventory management system, from basic product receipts to advanced serial number tracking and reporting capabilities.
