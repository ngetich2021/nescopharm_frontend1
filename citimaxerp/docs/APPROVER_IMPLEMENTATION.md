# Dispatch Approver API Implementation

This document describes the implementation of the dispatch approver functionality under the settings page.

## Overview

The dispatch approver system allows companies to configure approval workflows for dispatch operations. This includes setting default approvers in a specific order and enabling/disabling the approval requirement.

## Files Created

### 1. `/lib/approver.ts`
The main library file that handles all dispatch approver logic and API calls.

## API Details

### Endpoint
```
POST/PUT /api/company/dispatch-settings
```

### Request Payload
```json
{
  "require_approval": true,
  "default_approvers": [
    {
      "user_id": "29590834-4d79-46b7-ab0b-fb6be2842c95",
      "order": 1
    },
    {
      "user_id": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
      "order": 2
    },
    {
      "user_id": "e5f6g7h8-90ij-klmn-opqr-stuvwxyz1234",
      "order": 3
    }
  ]
}
```

### Response
```json
{
  "status": "success",
  "message": "Dispatch settings updated successfully",
  "data": {
    "id": "setting-id",
    "company_id": "company-id",
    "require_approval": true,
    "default_approvers": [
      {
        "user_id": "29590834-4d79-46b7-ab0b-fb6be2842c95",
        "order": 1
      },
      {
        "user_id": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
        "order": 2
      },
      {
        "user_id": "e5f6g7h8-90ij-klmn-opqr-stuvwxyz1234",
        "order": 3
      }
    ],
    "created_at": "2025-11-19T10:00:00Z",
    "updated_at": "2025-11-19T10:00:00Z"
  }
}
```

## Usage Examples

### 1. Fetching Current Dispatch Settings

```typescript
import { getDispatchSettings } from "@/lib/approver";

async function loadSettings() {
  try {
    const response = await getDispatchSettings();
    const settings = response.data;
    
    console.log("Require Approval:", settings.require_approval);
    console.log("Default Approvers:", settings.default_approvers);
  } catch (error) {
    console.error("Failed to load settings:", error);
  }
}
```

### 2. Updating Dispatch Settings

```typescript
import { updateDispatchSettings } from "@/lib/approver";

async function saveApprovers() {
  try {
    const payload = {
      require_approval: true,
      default_approvers: [
        { user_id: "user-id-1", order: 1 },
        { user_id: "user-id-2", order: 2 },
        { user_id: "user-id-3", order: 3 }
      ]
    };
    
    const response = await updateDispatchSettings(payload);
    console.log("Settings updated:", response.data);
  } catch (error) {
    console.error("Failed to update settings:", error);
  }
}
```

### 3. Getting Potential Approvers

```typescript
import { getPotentialApprovers } from "@/lib/approver";

async function loadUsers() {
  try {
    const response = await getPotentialApprovers();
    const users = response.data;
    
    users.forEach(user => {
      console.log(`${user.first_name} ${user.last_name} - ${user.email}`);
    });
  } catch (error) {
    console.error("Failed to load users:", error);
  }
}
```

### 4. Using Helper Functions

```typescript
import { 
  addApprover, 
  removeApprover, 
  moveApproverUp, 
  moveApproverDown,
  updateApprover,
  validateApprovers
} from "@/lib/approver";

// Add a new approver
let approvers = [
  { user_id: "user-1", order: 1 },
  { user_id: "user-2", order: 2 }
];

approvers = addApprover(approvers, "user-3");
// Result: [
//   { user_id: "user-1", order: 1 },
//   { user_id: "user-2", order: 2 },
//   { user_id: "user-3", order: 3 }
// ]

// Remove an approver
approvers = removeApprover(approvers, 1);
// Result: [
//   { user_id: "user-1", order: 1 },
//   { user_id: "user-3", order: 2 }
// ]

// Move approver up
approvers = moveApproverUp(approvers, 1);
// Result: [
//   { user_id: "user-3", order: 1 },
//   { user_id: "user-1", order: 2 }
// ]

// Update an approver
approvers = updateApprover(approvers, 0, "user-4");
// Result: [
//   { user_id: "user-4", order: 1 },
//   { user_id: "user-1", order: 2 }
// ]

// Validate approvers
const validation = validateApprovers(approvers);
if (!validation.isValid) {
  console.error("Validation error:", validation.error);
}
```

## Features

### API Functions
- ✅ `getDispatchSettings()` - Fetch current dispatch settings
- ✅ `updateDispatchSettings(payload)` - Update dispatch settings
- ✅ `getPotentialApprovers()` - Get list of active users who can be approvers

### Helper Functions
- ✅ `validateApprovers(approvers)` - Validate approver list
- ✅ `reorderApprovers(approvers)` - Reorder approvers sequentially
- ✅ `addApprover(approvers, userId)` - Add new approver
- ✅ `removeApprover(approvers, index)` - Remove approver
- ✅ `moveApproverUp(approvers, index)` - Move approver up
- ✅ `moveApproverDown(approvers, index)` - Move approver down
- ✅ `updateApprover(approvers, index, userId)` - Update approver user
- ✅ `formatApproverName(approver)` - Format approver name
- ✅ `findApproverById(potentialApprovers, userId)` - Find approver by ID
- ✅ `isUserAlreadyApprover(approvers, userId)` - Check if user is already an approver

### Validation Features
- ✅ Validates that all approvers have valid user IDs
- ✅ Prevents duplicate approvers
- ✅ Ensures proper order numbering
- ✅ Validates at least one approver when approval is required
- ✅ Normalizes approver order to be sequential (1, 2, 3, ...)

## Integration

The approver functionality is integrated into the settings page at `/app/settings/approvers/page.tsx` and uses the `DispatchApproversTable` component which has been updated to use the new `approver.ts` library.

### Navigation
Settings Page → Approvers Tab → Dispatch Approvers

### Permissions Required
- `can_manage_dispatch_settings`
- `can_manage_system`
- `can_manage_company`

## Implementation Details

### State Management
The component maintains the following state:
- `requireApproval`: Boolean to enable/disable approval workflow
- `approvers`: Array of dispatch approvers with user_id and order
- `potentialApprovers`: List of active users who can be selected as approvers

### Workflow
1. User navigates to Settings → Approvers → Dispatch Approvers
2. Component loads existing settings and potential approvers
3. User can:
   - Toggle approval requirement on/off
   - Add/remove approvers
   - Reorder approvers using up/down arrows
   - Select users from dropdown for each approver slot
4. Validation runs before saving
5. Settings are saved to the backend via API
6. Success/error toast notifications are shown

## Error Handling

All API functions include proper error handling:
- Try-catch blocks for network errors
- Validation errors with descriptive messages
- User-friendly error messages in toast notifications
- Graceful handling when settings don't exist yet

## Type Safety

Full TypeScript support with:
- `DispatchApprover` type for approver objects
- `CompanyDispatchSettings` type for settings object
- `PotentialApprover` type for user objects
- Proper return types for all functions
- Generic API response types
