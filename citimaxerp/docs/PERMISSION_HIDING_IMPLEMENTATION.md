# Permission-Based UI Hiding Implementation

## Overview
This document summarizes the implementation of the `hideOnDenied` prop across the CitiMaxERP application. When users don't have specific permissions, UI elements (buttons, menu items, modals) are now **completely hidden** instead of showing "Access Denied" messages.

## Implementation Principle

### Before (Cluttered UI)
```tsx
// User sees "Access Denied" message in dropdown
<PermissionGuard permissions="can_delete_order">
  <DropdownMenuItem>Delete</DropdownMenuItem>
</PermissionGuard>
```

### After (Clean UI)
```tsx
// User doesn't see the menu item at all
<PermissionGuard permissions="can_delete_order" hideOnDenied>
  <DropdownMenuItem>Delete</DropdownMenuItem>
</PermissionGuard>
```

## Files Updated

### 1. **Sales Module**
- ✅ `/app/sales/orders/orders-table.tsx`
  - 5 instances: Edit button, Delete button, Duplicate button, Edit modal, Delete modal
  
- ✅ `/app/sales/quotes/components/ViewQuoteSheet.tsx`
  - 3 instances: Send dropdown, Edit button, Convert to Order button
  
- ✅ `/app/sales/quotes/components/QuotesTable.tsx`
  - 3 instances: Edit menu item, Convert dropdown item, Convert button

### 2. **Inventory Module**
- ✅ `/app/inventory/products/product-table.tsx`
  - 3 instances: Add Product button, Edit menu item, Delete menu item

### 3. **Purchase Orders**
- ✅ `/app/purchase-orders/purchase-orders-table.tsx`
  - 3 instances: Edit menu item, Receipt menu item, Delete menu item

### 4. **Suppliers**
- ✅ `/app/suppliers/suppliers-table.tsx`
  - 4 instances: Add Supplier button, Edit menu item, Delete menu item, Create sheet modal

### 5. **Expenses**
- ✅ `/app/expenses/expenses-client.tsx`
  - 3 instances: Add Expense button (header), Add Expense button (toolbar), Create modal
  
- ✅ `/app/expenses/components/expenses-table.tsx`
  - 4 instances: Edit menu item, Approve menu item, Delete menu item, Edit modal

### 6. **Product Receipts**
- ✅ `/app/product-receipt/components/ProductReceiptPage.tsx`
  - 3 instances: Create modal, Edit modal, Delete modal

## Pattern Applied

### UI Elements (Use `hideOnDenied`)
All interactive UI elements that users without permission shouldn't see:
- ✅ **Action Buttons** (Edit, Delete, Create, etc.)
- ✅ **Dropdown Menu Items** (inside action menus)
- ✅ **Modal/Sheet Components** (wrapping entire dialogs)
- ✅ **Icon Buttons** (in table rows)

### Page-Level Guards (NO `hideOnDenied`)
Elements that control entire page access should show "Access Denied":
- ❌ **Page Wrappers** (e.g., `app/sales/orders/page.tsx`)
- ❌ **Layout Guards** (e.g., `app/inventory/serial-numbers/layout.tsx`)
- ❌ **Dashboard Cards** (main content areas)

## Total Updates
- **Files Modified**: 8 files
- **Permission Guards Updated**: 31 instances
- **Modules Covered**: Sales, Inventory, Purchase Orders, Suppliers, Expenses, Product Receipts

## User Experience Impact

### Before Implementation
User without `can_delete_orders` permission:
```
[Orders Page]
┌─────────────────────────┐
│ Actions ▼               │
├─────────────────────────┤
│ 👁️ View Details        │
│ ⚠️ Access Denied        │ ← Cluttered
│ ⚠️ Access Denied        │ ← Cluttered
│ ⚠️ Access Denied        │ ← Cluttered
└─────────────────────────┘
```

### After Implementation
User without `can_delete_orders` permission:
```
[Orders Page]
┌─────────────────────────┐
│ Actions ▼               │
├─────────────────────────┤
│ 👁️ View Details        │
└─────────────────────────┘
```
✨ Clean, focused, professional UI

## Testing Instructions

1. **Login as a user with limited permissions**
2. **Navigate to each module**:
   - Sales → Orders
   - Sales → Quotes
   - Inventory → Products
   - Purchase Orders
   - Suppliers
   - Expenses
   - Product Receipts

3. **Verify**:
   - ✅ No "Access Denied" messages in dropdown menus
   - ✅ Buttons user can't use are completely hidden
   - ✅ Only available actions are visible
   - ✅ Page-level restrictions still show "Access Denied" card

## Security Notes

⚠️ **Important**: These are **UI-only** changes. All permission checks are still enforced on the backend. The `hideOnDenied` prop only affects what the user sees, not what they can access via API.

**Backend validation is mandatory** for:
- ✅ All API endpoints
- ✅ All mutation operations (Create, Update, Delete)
- ✅ All data retrieval operations
- ✅ All file access operations

## Maintenance Guidelines

### Adding New Protected Features
When adding new features that require permissions:

```tsx
// ✅ DO: Use hideOnDenied for UI elements
<PermissionGuard permissions="can_export_data" hideOnDenied>
  <Button onClick={handleExport}>
    <Download /> Export
  </Button>
</PermissionGuard>

// ❌ DON'T: Use hideOnDenied for page-level content
<PermissionGuard permissions="can_view_reports">
  <ReportsPage />
</PermissionGuard>
```

### Debugging Permission Issues
If users report missing functionality:
1. Check browser console for permission errors
2. Verify user's permission list in `localStorage` or session
3. Confirm backend returns correct permissions in login response
4. Use `hasPermission()` hook to debug: `console.log(hasPermission("permission_key"))`

## Related Documentation
- [`PERMISSION_UX_IMPROVEMENTS.md`](./PERMISSION_UX_IMPROVEMENTS.md) - Detailed usage patterns
- [`TROUBLESHOOTING_CACHE.md`](./TROUBLESHOOTING_CACHE.md) - Cache clearing guide
- [`/lib/permissions-map.ts`](../lib/permissions-map.ts) - Complete permissions list

---

**Last Updated**: November 5, 2025  
**Status**: ✅ Implemented across all major modules
