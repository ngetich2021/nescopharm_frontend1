# Cherry API – Detailed Product Receipting & Dispatch Documentation

## 1. Overview
This document describes the full workflow and API usage for product dispatching and receipting in the Cherry WMS. It covers all endpoints, payloads, validation, and best practices for frontend implementation.

---

## 2. Dispatch Lifecycle & Workflow
- **Create Dispatch:** Warehouse staff creates a dispatch, specifying products, variants, quantities, and returnability.
- **Acknowledge Receipt:** Recipient (user/department) acknowledges received items, supporting partial receipts.
- **Return Items:** Recipient returns items (fully or partially), optionally adding return notes.
- **Overdue Reminders:** System sends automated reminders for items due for return.
- **Audit Trail:** All actions are tracked per item for full traceability.

---

## 3. API Endpoints

### 3.1 Create Dispatch
**POST** `/api/whs/dispatches`
- See previous documentation for payload.
- Returns the created dispatch with all items and their IDs.

### 3.2 List Dispatches
**GET** `/api/whs/dispatches`
- Query params: `from_store_id`, `to_user_id`, `type` (optional)
- Returns paginated list of dispatches with summary info.

### 3.3 View Dispatch Details
**GET** `/api/whs/dispatches/{id}`
- Returns full details of a dispatch, including all items, their status, product/variant info, and returnability.

### 3.4 Acknowledge Receipt (Product Receipting)
**POST** `/api/whs/dispatches/{dispatchId}/acknowledge`
- Payload: Array of items with `id` and `received_quantity`.
- Each item can be partially or fully received.
- Response includes updated dispatch and item statuses.

### 3.5 Mark Items as Returned
**POST** `/api/whs/dispatches/{dispatchId}/mark-returned`
- Payload: Array of items with `id`, `returned_quantity`, and optional `return_notes`.
- Supports partial returns and per-item notes.
- Response includes updated item statuses and errors if any.

### 3.6 List Overdue Returns
**GET** `/api/whs/dispatches/overdue`
- Returns all items that are overdue for return, with product, variant, dispatch, and due date info.

---

## 4. Data Structures & Field Explanations

### 4.1 Dispatch Object
- `id`: UUID
- `dispatch_number`: Unique string
- `from_store_id`, `to_entity`, `to_user_id`, `type`, `notes`
- `items`: Array of DispatchItem objects
- `created_at`, `updated_at`, `acknowledged_by`

### 4.2 DispatchItem Object
- `id`: UUID
- `product_id`, `variant_id`, `quantity`, `received_quantity`, `is_returnable`, `is_returned`, `return_date`, `returned_quantity`, `return_notes`, `reminder_status`
- `product`: Product object (with name, SKU, etc.)
- `variant`: Variant object (if any)

### 4.3 Status Fields
- `is_returnable`: Boolean, if item must be returned
- `is_returned`: Boolean, if item has been fully returned
- `returned_quantity`: How many have been returned so far
- `reminder_status`: JSON object tracking which reminders have been sent (see below)

### 4.4 Reminder Status
- Example: `{ "due_2_days": true, "due_today": false, "overdue_1_day": false, "overdue_2_days": false }`

---

## 5. Error Handling & Validation
- All endpoints return clear error messages and validation details.
- Common errors:
    - Insufficient stock
    - Invalid product/variant
    - Missing required fields
    - Unauthorized access
    - Over-receipting or over-returning items
- Error responses include the item name (if available) for clarity.

---

## 6. Permissions & Security
- All endpoints require authentication.
- Permissions are enforced per user role and company.
- Only authorized users can create, view, acknowledge, or return dispatches.

---

## 7. UI/UX Recommendations
- Show all dispatches with status indicators (pending, partially received, fully received, overdue, returned).
- For each item, display:
    - Product name, variant, quantity, received/returned status, due date (if returnable), and notes.
- Allow partial receipting and partial returns with clear input fields.
- Display validation errors and success messages from API responses.
- Show overdue items and their reminder status if needed.
- Provide links to view full dispatch details from lists.

---

## 8. Example Flows

### 8.1 Creating a Dispatch
1. User selects products/variants and quantities.
2. Optionally marks items as returnable and sets return dates.
3. Submits dispatch; receives dispatch and item IDs for tracking.

### 8.2 Product Receipting
1. Recipient views assigned dispatches.
2. For each item, enters received quantity (can be partial).
3. Submits receipt; sees updated status and any errors.

### 8.3 Returning Items
1. Recipient views items due for return.
2. For each, enters returned quantity and optional notes.
3. Submits; sees updated status and errors if any.

### 8.4 Overdue Reminders
- System sends emails automatically; frontend can show overdue status using `/overdue` endpoint.

---


---

## 9. Product Receipting (Goods-In/Stock Intake)

Product receipting is the process of recording new stock arrivals into the warehouse. This is managed by the ProductReceiptController and is separate from dispatch/returns.

### 9.1 Create Product Receipt

**Endpoint:**  
`POST /api/whs/product-receipts`

**Payload Example (Single Receipt):**
```json
{
  "product": {
    "sku": "SKU123",
    "name": "Product Name",
    "barcode": "1234567890"
    // ...other product fields as needed
  },
  "quantity": 10,
  "store_id": "store-uuid",
  "document_type": "receipt", // or invoice, delivery_note, notification_note
  "reference_number": "INV-2025-001",
  "received_by": "user-uuid",
  "variant": {
    "sku": "SKU123-VAR1",
    "name": "Variant Name"
    // ...other variant fields as needed
  },
  "supplier_id": "supplier-uuid", // optional
  "contractor_id": "contractor-uuid", // optional
  "document_url": "https://..." // optional, or upload file as 'document'
}
```

**Batch Receipts:**  
Send an array as `receipts` and upload multiple files as `documents[]`.

**Notes:**
- If the product or variant does not exist, it will be created.
- You can upload a document file or provide a URL.
- The API will increment stock for the product/variant.

**Response:**
- On success:  
  - `201 Created` with the created receipt(s).
- On error:  
  - `422 Unprocessable Entity` with validation errors.

---

### 9.2 View Product Receipt

**Endpoint:**  
`GET /api/whs/product-receipts/{id}`

**Returns:**  
- Full details of the product receipt, including product, variant, store, and document info.

---

### 9.3 Update Product Receipt

**Endpoint:**  
`PUT /api/whs/product-receipts/{id}`

**Payload:**  
- Any editable fields (quantity, document_type, reference_number, document, etc.)

**Notes:**
- Only allowed for receipts not yet finalized or locked.
- The API will update stock if quantity is changed.

**Response:**
- On success: Updated receipt object.
- On error: Validation errors.

---

### 9.4 Product Receipt Data Structure

- `id`: UUID
- `product_id`, `variant_id`, `store_id`, `quantity`, `document_type`, `reference_number`, `received_by`, `supplier_id`, `contractor_id`, `document_url`, `document_path`, `created_at`, `updated_at`
- `product`: Product object (with name, SKU, etc.)
- `variant`: Variant object (if any)
- `store`: Store object

---

### 9.5 Product Receipting Workflow Example
1. User scans or enters product/variant details and quantity.
2. Uploads or links a receipt/invoice document.
3. Submits the receipt; system creates product/variant if needed and increments stock.
4. User can view or update the receipt record as needed.

---

