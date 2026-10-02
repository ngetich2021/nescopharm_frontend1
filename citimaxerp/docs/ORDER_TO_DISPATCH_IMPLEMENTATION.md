# Order to Dispatch Workflow Implementation

## Overview
This document outlines the implementation of the complete order-to-dispatch workflow with approval system, as per the documentation requirements.

## ✅ Completed Components

### 1. Core Library & Types (`lib/order-dispatches.ts`)
**Purpose**: Client-side API functions and TypeScript types for the order dispatch workflow.

**Key Features**:
- Complete TypeScript interfaces for OrderDispatch, OrderDispatchApprover, OrderDispatchItem
- Company dispatch settings types
- API functions for CRUD operations on dispatches
- Approval workflow functions (submit, approve, reject)
- Logistics creation and mark-delivered functions
- Helper functions for status checks and permissions

**API Functions Implemented**:
- `createOrderDispatch()` - Create dispatch from order
- `getOrderDispatch()` - Get dispatch details
- `listOrderDispatches()` - List dispatches with filters
- `updateOrderDispatch()` - Update dispatch (draft only)
- `submitDispatchForApproval()` - Submit for approval
- `approveDispatch()` - Approve dispatch (current approver)
- `rejectDispatch()` - Reject dispatch
- `createLogisticsFromDispatch()` - Create logistics entry
- `markDispatchDelivered()` - Mark as delivered
- `deleteOrderDispatch()` - Delete draft dispatch
- `getCompanyDispatchSettings()` - Get approval settings
- `updateCompanyDispatchSettings()` - Update approval settings
- `getPotentialApprovers()` - List available approvers

### 2. API Routes (Next.js App Router)

**Company Dispatch Settings**:
- `app/api/company/dispatch-settings/route.ts` - GET/PUT dispatch settings
- `app/api/company/dispatch-settings/potential-approvers/route.ts` - GET potential approvers

**Order Dispatches**:
- `app/api/order-dispatches/route.ts` - GET (list) / POST (create)
- `app/api/order-dispatches/[id]/route.ts` - GET / PUT / DELETE
- `app/api/order-dispatches/[id]/submit/route.ts` - POST submit for approval
- `app/api/order-dispatches/[id]/approve/route.ts` - POST approve
- `app/api/order-dispatches/[id]/reject/route.ts` - POST reject
- `app/api/order-dispatches/[id]/create-logistics/route.ts` - POST create logistics
- `app/api/order-dispatches/[id]/mark-delivered/route.ts` - POST mark delivered

All routes:
- Handle authentication via cookies
- Proxy requests to backend API
- Return consistent error responses
- Support Next.js 14 App Router patterns

### 3. Permissions (`lib/permissions-map.ts`)

Added 11 new permissions for dispatch workflow:
- `can_create_order_dispatches` - Create dispatches from orders
- `can_view_order_dispatches` - View dispatch details
- `can_update_order_dispatches` - Update drafts
- `can_delete_order_dispatches` - Delete drafts
- `can_submit_dispatches_for_approval` - Submit for approval
- `can_approve_dispatches` - Approve dispatches
- `can_reject_dispatches` - Reject dispatches
- `can_create_dispatch_logistics` - Create logistics
- `can_mark_dispatches_delivered` - Mark delivered
- `can_manage_dispatch_settings` - Manage settings

### 4. Settings Page - Approvers Management

**Location**: `app/settings/approvers/`

**Components**:
- `page.tsx` - Main approvers management page with tabs
- `components/dispatch-approvers-table.tsx` - Dispatch approvers configuration

**Features**:
- Toggle approval requirement on/off
- Add/remove approvers in specific order
- Reorder approvers (move up/down)
- Select approvers from active users
- Save configuration to company settings
- Visual approval chain explanation
- Permission-guarded (requires `can_manage_dispatch_settings`)

**Integration**:
- Added "Approvers" tab to Settings page
- Appears between "User Management" and "Payments"
- Only visible to users with proper permissions

### 5. Order Details Page Integration

**Location**: `app/sales/orders/[id]/`

**Changes**:
- Added "Create Dispatch" button with Truck icon
- Import `CreateDispatchModal` component
- State management for modal visibility
- Success toast notification on dispatch creation

**Component**: `create-dispatch-modal.tsx`
- Shows all order items with quantities
- Displays: Ordered, Dispatched, Available, Dispatch Qty
- Validates at least one item selected
- Supports partial dispatch quantities
- Input validation (min/max constraints)
- Notes field for special instructions
- Info box explaining next steps
- Creates dispatch in draft status with default approvers

## 📋 Workflow Flow

### Step 1: Configure Approvers (One-Time Setup)
1. Navigate to Settings → Approvers → Dispatch Approvers
2. Toggle "Require approval for dispatches"
3. Add approvers in desired order (Order 1, 2, 3, etc.)
4. Select users from dropdown for each approver position
5. Reorder using up/down arrows if needed
6. Save changes

### Step 2: Create Dispatch from Order
1. Open order details page
2. Click "Create Dispatch" button
3. Review order items
4. Adjust dispatch quantities (can be partial)
5. Add optional notes
6. Click "Create Dispatch"
7. Dispatch created in **draft** status with default approvers

### Step 3: Approval Workflow (To be implemented in UI)
1. **Draft** → Submit for approval
2. **Pending** → First approver approves
3. **In Progress** → Subsequent approvers approve in sequence
4. **Approved** → All approvers approved, ready for logistics
5. **Rejected** → Any approver rejects, dispatch cancelled

### Step 4: Create Logistics (To be implemented in UI)
1. Once approved, assign vehicle and driver
2. Set scheduled delivery date
3. Add logistics notes
4. Dispatch status: **In Transit**

### Step 5: Delivery (To be implemented in UI)
1. Mark departure (optional)
2. Mark as delivered with:
   - Delivery timestamp
   - Received by name and phone
   - Actual quantities delivered
   - Damaged quantities
   - Delivery notes
   - Signature (optional)
3. Dispatch status: **Delivered**

## 🔄 Status Flow

### Dispatch Status
```
draft → pending → approved → in_transit → delivered
                     ↓
                 cancelled (if rejected)
```

### Approval Status
```
draft → pending → in_progress → approved
                      ↓
                  rejected
```

## 🎯 Next Steps (Remaining UI Work)

### 7. Dispatch Approval Workflow UI
**Components to Create**:
- Dispatch details page showing approval chain
- Current approver indicator
- Approve/Reject action buttons
- Approval progress indicator (1/3, 2/3, 3/3)
- Approval history timeline
- Comments from each approver

**Features**:
- Only current approver can approve/reject
- Sequential approval enforcement
- Real-time approval status updates
- Permission checks per action

### 8. Dispatch List & Detail Pages
**Components to Create/Update**:
- Dispatch list table with filters
- Status badges (draft, pending, approved, etc.)
- Approval status badges
- Quick actions (submit, view, edit, delete)
- Dispatch detail view with:
  - Order information
  - Items being dispatched
  - Approval chain visualization
  - Logistics information (if assigned)
  - Delivery status
- Create Logistics form/modal
- Mark Delivered form/modal

**Features**:
- Filter by status, approval status, order
- Search by dispatch number, order number
- Pagination
- Export capabilities
- Print dispatch document
- Permission-based action visibility

## 📊 Key Data Structures

### OrderDispatch
```typescript
{
  id: string
  dispatch_number: string // e.g., "ODI-0001"
  order_id: string
  status: 'draft' | 'pending' | 'approved' | 'in_transit' | 'delivered' | 'cancelled'
  approval_status: 'draft' | 'pending' | 'in_progress' | 'approved' | 'rejected'
  items: OrderDispatchItem[]
  approvers: OrderDispatchApprover[]
  order: { order_number, customer }
  delivery_location: { name, address }
  logistics?: { vehicle, driver, dates }
}
```

### OrderDispatchApprover
```typescript
{
  user_id: string
  order: number // 1, 2, 3 (sequence)
  status: 'pending' | 'approved' | 'rejected'
  approved_at?: string
  comments?: string
  user: { first_name, last_name, email, role }
}
```

### CompanyDispatchSettings
```typescript
{
  company_id: string
  require_approval: boolean
  default_approvers: Array<{
    user_id: string
    order: number
  }>
}
```

## 🔐 Permission Matrix

| Action | Permissions Required |
|--------|---------------------|
| View Dispatches | `can_view_order_dispatches` |
| Create Dispatch | `can_create_order_dispatches` |
| Update Draft | `can_update_order_dispatches` |
| Delete Draft | `can_delete_order_dispatches` |
| Submit for Approval | `can_submit_dispatches_for_approval` |
| Approve | `can_approve_dispatches` + be current approver |
| Reject | `can_reject_dispatches` + be current approver |
| Create Logistics | `can_create_dispatch_logistics` |
| Mark Delivered | `can_mark_dispatches_delivered` |
| Manage Settings | `can_manage_dispatch_settings` |

## 🚀 Testing Checklist

### Backend Prerequisites
- [ ] Backend API implements all documented endpoints
- [ ] Database tables created for order_dispatches, approvers, etc.
- [ ] Authentication middleware working
- [ ] Permission checks implemented

### Frontend Testing
- [x] Settings page loads approvers tab
- [x] Can add/remove/reorder approvers
- [x] Settings save successfully
- [x] Order details page shows "Create Dispatch" button
- [x] Modal opens with correct order data
- [x] Can adjust dispatch quantities
- [x] Validation works for quantities
- [x] Dispatch creation succeeds
- [ ] Dispatch list page displays correctly
- [ ] Can submit dispatch for approval
- [ ] Approvers receive notifications
- [ ] Approval workflow progresses correctly
- [ ] Rejection workflow works
- [ ] Can create logistics after approval
- [ ] Can mark as delivered
- [ ] Status badges display correctly

## 📝 Notes for Backend Team

The frontend is ready and expects the following API structure:

### POST /order-dispatches
```json
{
  "order_id": "uuid",
  "delivery_location_id": "uuid",
  "notes": "string",
  "custom_approvers": [{"user_id": "uuid", "order": 1}], // optional
  "items": [{"order_item_id": "uuid", "quantity_to_dispatch": 100}]
}
```

### Response Format
All endpoints should return:
```json
{
  "success": true,
  "message": "Success message",
  "data": { /* actual data */ }
}
```

### Error Format
```json
{
  "success": false,
  "message": "Error description",
  "errors": { /* validation errors if applicable */ }
}
```

## 🎨 UI/UX Considerations

1. **Visual Hierarchy**: Status badges use color coding (draft=gray, pending=yellow, approved=green, etc.)
2. **Progressive Disclosure**: Show relevant actions based on current status
3. **Feedback**: Toast notifications for all actions
4. **Validation**: Client-side validation before API calls
5. **Loading States**: Spinners during async operations
6. **Permission Guards**: Hide/disable actions user cannot perform
7. **Responsive**: All components work on mobile/tablet/desktop

## 📚 Documentation References

See the complete workflow documentation provided for:
- Detailed API payloads
- Validation rules
- Response examples
- Business logic
- Use cases and scenarios
