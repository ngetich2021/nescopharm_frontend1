# Cherry API – Product Receipting & Dispatch Functionality

## 1. Dispatch Creation

**Endpoint:**
`POST /api/whs/dispatches`

**Payload Example:**
```json
{
  "from_store_id": "store-uuid",
  "to_entity": "user|department|other",
  "to_user_id": "user-uuid", // optional, required if to_entity is user
  "type": "internal|external",
  "notes": "Optional notes",
  "items": [
    {
      "product_id": "product-uuid",
      "variant_id": "variant-uuid", // optional
      "quantity": 5,
      "is_returnable": true,
      "return_date": "2025-08-25" // required if is_returnable is true
    }
    // ... more items
  ]
}
```
**Notes:**
- Each item must specify `product_id`, `quantity`, and optionally `variant_id`.
- If `is_returnable` is true, `return_date` is required.
- The API will validate stock and return errors if insufficient.

**Response:**
- On success: `201 Created` with the dispatch object.
- On error: `422 Unprocessable Entity` with validation errors.

---

## 2. Product Receipting (Acknowledge Receipt)

**Endpoint:**
`POST /api/whs/dispatches/{dispatchId}/acknowledge`

**Payload Example:**
```json
{
  "items": [
    { "id": "dispatch-item-uuid-1", "received_quantity": 3 },
    { "id": "dispatch-item-uuid-2", "received_quantity": 2 }
  ]
}
```
**Notes:**
- Each item must include the dispatch item `id` and the `received_quantity`.
- `received_quantity` must be between 0 and the dispatched quantity.
- Partial receipts are supported; the API will indicate if all or only some items were received.

**Response:**
- On success:
  - If all items received: `"message": "All items acknowledged."`
  - If partial: `"message": "Partial receipt recorded."`
- On error:
  - Validation or not found errors with details.

---

## 3. Mark Items as Returned

**Endpoint:**
`POST /api/whs/dispatches/{dispatchId}/mark-returned`

**Payload Example:**
```json
{
  "items": [
    {
      "id": "dispatch-item-uuid-1",
      "returned_quantity": 2,
      "return_notes": "Damaged on site"
    },
    {
      "id": "dispatch-item-uuid-2",
      "returned_quantity": 1
    }
  ]
}
```
**Notes:**
- Supports partial returns and per-item notes.
- `returned_quantity` must not exceed the remaining quantity to be returned.
- The API will update stock and mark items as fully returned when appropriate.

**Response:**
- On success:
  - `"returned_items"` array with details.
  - `"errors"` array for any items that could not be processed.
- On error:
  - `"status": "failed"` with error details.

---

## 4. Overdue Returns & Reminders

- The backend automatically sends email reminders to users for items due in 2 days, due today, 1 day overdue, and 2 days overdue.
- No frontend action is required for reminders, but you may display overdue status using the `/api/whs/dispatches/overdue` endpoint.

---

## 5. General Notes

- All endpoints require authentication and appropriate permissions.
- Use the `id` fields returned from the dispatch creation for subsequent actions (receipting, returns).
- For best UX, display validation errors and success messages from the API responses.
- For each dispatch item, show product name, variant (if any), quantity, received/returned status, and due dates if returnable.

---

If you need more details or sample responses, let the backend team know!
