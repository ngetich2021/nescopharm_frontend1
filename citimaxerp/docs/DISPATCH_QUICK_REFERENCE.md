# Order to Dispatch Workflow - Quick Reference

## 🚀 What's Been Implemented

### ✅ Backend Integration
- All API routes created in `app/api/`
- Client-side functions in `lib/order-dispatches.ts`
- 11 new permissions added to system

### ✅ Settings Management
- Navigate to: **Settings → Approvers → Dispatch Approvers**
- Configure default approvers for all dispatches
- Reorder approval chain
- Toggle approval requirement

### ✅ Order to Dispatch Conversion
- Button added to order details page: **"Create Dispatch"**
- Modal allows selecting quantities (full or partial)
- Creates dispatch in draft status
- Auto-assigns company default approvers

## 📂 File Structure

```
lib/
  └── order-dispatches.ts          # API functions & types

app/
  ├── api/
  │   ├── company/
  │   │   └── dispatch-settings/
  │   │       ├── route.ts
  │   │       └── potential-approvers/route.ts
  │   └── order-dispatches/
  │       ├── route.ts
  │       └── [id]/
  │           ├── route.ts
  │           ├── submit/route.ts
  │           ├── approve/route.ts
  │           ├── reject/route.ts
  │           ├── create-logistics/route.ts
  │           └── mark-delivered/route.ts
  │
  ├── settings/
  │   ├── page.tsx                 # Updated with Approvers tab
  │   └── approvers/
  │       ├── page.tsx
  │       └── components/
  │           └── dispatch-approvers-table.tsx
  │
  └── sales/orders/[id]/
      ├── order-details.tsx        # Updated with dispatch button
      └── create-dispatch-modal.tsx
```

## 🔄 Usage Flow

### 1. Configure Approvers (Admin/Manager)
```
Settings → Approvers → Dispatch Approvers
→ Add users in order (1, 2, 3...)
→ Save
```

### 2. Create Dispatch (Sales/Warehouse)
```
Orders → Select Order → Create Dispatch
→ Set quantities
→ Add notes
→ Create
```

### 3. Submit & Approve (Approvers)
```
[To be implemented in dispatch pages]
Dispatches → Select Draft → Submit
→ Approver 1 approves
→ Approver 2 approves
→ Status: Approved
```

### 4. Create Logistics (Logistics Team)
```
[To be implemented]
Dispatches → Select Approved → Create Logistics
→ Assign vehicle & driver
→ Set delivery date
→ Status: In Transit
```

### 5. Deliver (Driver)
```
[To be implemented]
Dispatches → Select In Transit → Mark Delivered
→ Enter received by details
→ Confirm quantities
→ Status: Delivered
```

## 🔑 Key Functions

### Import
```typescript
import {
  createOrderDispatch,
  submitDispatchForApproval,
  approveDispatch,
  rejectDispatch,
  createLogisticsFromDispatch,
  markDispatchDelivered,
  getCompanyDispatchSettings,
  updateCompanyDispatchSettings,
} from '@/lib/order-dispatches'
```

### Create Dispatch
```typescript
const response = await createOrderDispatch({
  order_id: orderId,
  delivery_location_id: locationId,
  notes: "Urgent delivery",
  items: [
    { order_item_id: itemId, quantity_to_dispatch: 100 }
  ]
})
```

### Submit for Approval
```typescript
await submitDispatchForApproval(dispatchId)
```

### Approve
```typescript
await approveDispatch(dispatchId, {
  comments: "Stock verified, approved"
})
```

### Reject
```typescript
await rejectDispatch(dispatchId, {
  reason: "Insufficient stock"
})
```

## 🎯 Status Transitions

```
CREATE → draft
SUBMIT → pending (approval_status: pending)
APPROVE_1 → pending (approval_status: in_progress)
APPROVE_2 → pending (approval_status: in_progress)
APPROVE_FINAL → approved (approval_status: approved)
CREATE_LOGISTICS → in_transit
MARK_DELIVERED → delivered

REJECT (any stage) → cancelled (approval_status: rejected)
```

## 🚧 Still To Build

### Dispatch Pages UI
- [ ] Dispatch list page with filters
- [ ] Dispatch detail page
- [ ] Submit button & confirmation
- [ ] Approve/Reject UI with comments
- [ ] Approval chain visualization
- [ ] Create logistics modal/form
- [ ] Mark delivered modal/form

### Components Needed
- `app/dispatch/page.tsx` - Main list
- `app/dispatch/[id]/page.tsx` - Details
- `app/dispatch/components/approval-chain.tsx`
- `app/dispatch/components/create-logistics-modal.tsx`
- `app/dispatch/components/mark-delivered-modal.tsx`

## 💡 Helper Functions Available

```typescript
// Check if dispatch can be edited
canEditDispatch(dispatch) // true if status === 'draft'

// Check if user can submit
canSubmitDispatch(dispatch) // true if draft + has items + has approvers

// Check if user can approve/reject
canApproveDispatch(dispatch, userId) // true if user is current approver

// Check if logistics can be created
canCreateLogistics(dispatch) // true if approved

// Check if can mark delivered
canMarkDelivered(dispatch) // true if in_transit

// Format status for display
formatDispatchStatus(status) // "Draft" | "Pending" | "Approved" etc.

// Get status badge color
getDispatchStatusColor(status) // 'default' | 'destructive' | 'secondary'
```

## 🎨 Badge Colors

```typescript
// Status
draft → secondary (gray)
pending → outline (yellow border)
approved → default (blue)
in_transit → default (blue)
delivered → default (green)
cancelled → destructive (red)

// Approval Status
draft → secondary
pending → outline
in_progress → outline
approved → default
rejected → destructive
```

## 📋 Permissions Check

```typescript
import { usePermissions } from '@/hooks/use-permissions'

const { hasPermission } = usePermissions()

// Check permission
if (hasPermission('can_create_order_dispatches')) {
  // Show create button
}

// Use in component
<PermissionGuard permissions={['can_approve_dispatches']}>
  <Button>Approve</Button>
</PermissionGuard>
```

## 🔍 Debugging

### Check dispatch settings
```typescript
const { data } = await getCompanyDispatchSettings()
console.log('Approval required:', data.require_approval)
console.log('Default approvers:', data.default_approvers)
```

### Check dispatch status
```typescript
const { data } = await getOrderDispatch(dispatchId)
console.log('Status:', data.status)
console.log('Approval status:', data.approval_status)
console.log('Current approver:', data.current_approver)
console.log('Progress:', data.approval_progress)
```

## 🆘 Common Issues

### "No approvers configured"
→ Go to Settings → Approvers → Add at least one approver

### "Cannot submit dispatch"
→ Check: dispatch in draft, has items, has approvers

### "You are not the current approver"
→ Wait for previous approver or check approval order

### "Cannot create logistics"
→ Dispatch must be fully approved first

### "Cannot mark delivered"
→ Logistics must be created first

## 📞 Support

For issues or questions:
1. Check implementation doc: `docs/ORDER_TO_DISPATCH_IMPLEMENTATION.md`
2. Check original spec: User-provided complete guide
3. Review permissions in `lib/permissions-map.ts`
4. Check API routes in `app/api/order-dispatches/`
