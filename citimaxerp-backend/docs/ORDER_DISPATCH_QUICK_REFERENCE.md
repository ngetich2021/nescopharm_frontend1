# Order Dispatch Quick Reference Guide

## Quick Start

### 1. Create Dispatch from Order
```bash
POST /api/order-dispatches
Authorization: Bearer {token}
Content-Type: application/json

{
  "order_id": "uuid",
  "from_store_id": "uuid",
  "items": [
    {
      "order_item_id": "uuid",
      "quantity": 100,
      "packaging_breakdown": {"cartons": 5, "pieces": 10},
      "packaging_notes": "Handle with care"
    }
  ],
  "initiate_workflow": true
}
```

### 2. Check Approval Status
```bash
GET /api/order-dispatches/{id}
```

### 3. Approve Steps (by designated approvers)
```bash
POST /api/approvals/steps/{stepInstanceId}/approve
{
  "notes": "Approved"
}
```

### 4. Create Logistics (after approval)
```bash
POST /api/order-dispatches/{id}/create-logistics
{
  "delivery_person_id": "uuid",
  "vehicle_type": "Truck",
  "vehicle_id": "KBZ-456Y",
  "delivery_method": "express"
}
```

### 5. Mark Delivered
```bash
POST /api/order-dispatches/{id}/mark-delivered
{
  "items": [
    {
      "id": "uuid",
      "delivered_quantity": 100,
      "damaged_quantity": 0
    }
  ]
}
```

---

## Status Flow

```
draft → pending → in_progress → approved → in_transit → delivered
                              ↘ rejected → cancelled
```

---

## Approval Workflow Steps

1. **Sales Verification** (12 hours timeout)
   - Verifies customer and order details
   
2. **Warehouse Approval** (24 hours timeout)
   - Confirms stock availability
   - Reviews packaging requirements
   
3. **Operations Manager** (24 hours timeout)
   - Only for orders with ≥10 items
   - Final approval for dispatch

---

## Key Permissions

| Permission | Purpose |
|------------|---------|
| `can_view_order_dispatches` | View dispatches |
| `can_create_order_dispatches` | Create new dispatches |
| `can_update_order_dispatches` | Edit draft/rejected dispatches |
| `can_dispatch_orders` | Create logistics & send |
| `can_approve_order_dispatches` | Approve dispatch requests |

---

## Common Errors & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| "Order already has dispatch" | Duplicate dispatch | Check if dispatch exists first |
| "Cannot edit dispatch" | Wrong status | Only draft/rejected can be edited |
| "Must be approved" | Premature logistics | Wait for workflow approval |
| "Quantity exceeds order" | Invalid quantity | Check order item quantities |

---

## Model Relationships

```php
OrderDispatch
  ├─ order (Order)
  ├─ items (OrderDispatchItem[])
  ├─ fromStore (Store)
  ├─ deliveryLocation (DeliveryLocation)
  ├─ logistic (Logistic)
  ├─ createdBy (User)
  └─ approvedBy (User)

OrderDispatchItem
  ├─ orderDispatch (OrderDispatch)
  ├─ orderItem (OrderItem)
  ├─ product (Product)
  └─ variant (ProductVariant)
```

---

## Packaging Breakdown Example

```json
{
  "packaging_breakdown": {
    "cartons": 5,
    "pieces": 10,
    "pallets": 1
  },
  "packaging_notes": "Stack max 3 high, keep dry"
}
```

---

## Testing Checklist

- [ ] Create dispatch from order
- [ ] Verify workflow initiated
- [ ] Approve all workflow steps
- [ ] Create logistics with driver
- [ ] Mark as delivered with quantities
- [ ] Check order status updated to "delivered"
- [ ] Verify logistic record created
- [ ] Test with damaged items
- [ ] Test rejection workflow
- [ ] Test draft editing

---

## Database Queries

### Get pending approvals for dispatch
```sql
SELECT d.*, w.status as workflow_status
FROM order_dispatches d
LEFT JOIN approval_workflow_instances w ON d.workflow_instance_id = w.id
WHERE w.status IN ('pending', 'in_progress');
```

### Get dispatches by status
```sql
SELECT * FROM order_dispatches
WHERE company_id = 'uuid'
AND status = 'in_transit';
```

### Get delivery summary
```sql
SELECT 
  d.dispatch_number,
  d.status,
  COUNT(i.id) as total_items,
  SUM(i.quantity) as total_quantity,
  SUM(i.delivered_quantity) as delivered,
  SUM(i.damaged_quantity) as damaged
FROM order_dispatches d
JOIN order_dispatch_items i ON d.id = i.order_dispatch_id
WHERE d.id = 'uuid'
GROUP BY d.id;
```

---

## Useful Code Snippets

### Check if order can be dispatched
```php
$order = Order::find($orderId);
$hasDispatch = OrderDispatch::where('order_id', $order->id)->exists();

if ($hasDispatch) {
    // Order already has dispatch
}
```

### Get dispatch with full details
```php
$dispatch = OrderDispatch::with([
    'order.customer',
    'items.product',
    'logistic.deliveryPerson',
    'activeWorkflowInstance.stepInstances'
])->find($id);
```

### Check approval status
```php
if ($dispatch->isApproved()) {
    // Can create logistics
}

if ($dispatch->isPendingApproval()) {
    // Waiting for approvers
}
```

---

## Configuration

### Seeding
```bash
# Seed permissions
php artisan db:seed --class=WorkflowPermissionsSeeder

# Seed workflows
php artisan db:seed --class=BasicWorkflowSeeder
```

### Migrations
```bash
php artisan migrate
```

---

## Support Resources

- Full API Docs: `docs/ORDER_DISPATCH_API_DOCUMENTATION.md`
- Dispatch Model: `app/Models/OrderDispatch.php`
- Controller: `app/Http/Controllers/OrderDispatchController.php`
- Workflow Seeder: `database/seeders/BasicWorkflowSeeder.php`

---

**Quick Help:**
- Dispatch number format: `ODI-{companyId8}-{0001}`
- Always check `canBeEdited()` before updates
- Use `canBeDispatched()` before creating logistics
- Packaging breakdown is flexible JSONB field
