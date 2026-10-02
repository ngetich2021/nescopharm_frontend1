# Account Mapping Implementation Guide for Frontend

## Table of Contents
1. [Overview](#overview)
2. [Concepts](#concepts)
3. [Setup & Configuration](#setup--configuration)
4. [API Endpoints](#api-endpoints)
5. [Frontend Implementation](#frontend-implementation)
6. [Common Workflows](#common-workflows)
7. [Error Handling](#error-handling)
8. [Best Practices](#best-practices)

---

## Overview

Account Mappings are the **bridge between your business logic (invoices, expenses, etc.) and the accounting system (Chart of Accounts)**. They tell the system which accounting account to use for each type of transaction.

### Why Do We Need Mappings?

Every company has a different Chart of Accounts structure. Account Mappings allow each company to configure their own accounts without requiring code changes.

**Example:**
- Company A's "Sales Revenue" might be account code **4000**
- Company B's "Sales Revenue" might be account code **400-A**
- Your system uses the logical key `sales_revenue` and resolves it to the correct account code for each company

### Key Benefits
- ✅ **Multi-company support** - Each company has their own mappings
- ✅ **Flexible** - Accounts can be changed without redeploying
- ✅ **Contextual** - Different accounts for different scenarios (e.g., expense accounts per category)
- ✅ **Automatic reconciliation** - Transactions automatically post to correct accounts
- ✅ **Validation** - System prevents transactions if required accounts aren't configured

---

## Concepts

### Mapping Key
A **logical identifier** for an account purpose. Examples:
- `accounts_receivable` - Customer debts
- `sales_revenue` - Revenue from sales
- `accounts_payable` - Vendor debts
- `expense_account` - General expenses
- `cash_on_hand` - Cash/bank accounts

### Chart of Account
The **actual account** in the company's accounting system with:
- Account Code (e.g., "1200")
- Account Name (e.g., "Accounts Receivable")
- Account Type (asset, liability, income, expense)
- Account Subtype (current_asset, fixed_asset, etc.)

### Mapping
The **connection** between a Mapping Key and a Chart of Account for a specific company.

### Context
**Optional metadata** for context-aware mappings. Example:
```json
{
  "mapping_key": "expense_account",
  "context_type": "expense_category",
  "context_id": "category-123"  // Different account per category
}
```

---

## Setup & Configuration

### Step 1: Admin Configures Chart of Accounts
System Admin creates the company's Chart of Accounts:
```
GET /api/chart-of-accounts?company_id={id}
```

### Step 2: Frontend Initiates Mapping Setup
When a company is created or accounting enabled:

```javascript
// Initialize mappings (auto-detect from chart of accounts)
POST /api/finance/account-mappings/initialize
{
  "company_id": "uuid"
}

// Response shows what was auto-mapped and what's missing
{
  "status": "success",
  "mapped_count": 45,
  "unmapped_count": 3,
  "mapped": {
    "accounts_receivable": "1200",
    "sales_revenue": "4000"
  },
  "unmapped": {
    "expense_payroll": "Not found in chart"
  }
}
```

### Step 3: Admin Handles Missing Mappings
If auto-detection left gaps, admin manually configures:

```javascript
POST /api/finance/account-mappings
{
  "company_id": "uuid",
  "mapping_key": "expense_payroll",
  "account_code": "5100",
  "description": "Payroll expenses"
}
```

### Step 4: Validate Configuration
```javascript
GET /api/finance/account-mappings/validate?company_id={id}

// Response
{
  "is_valid": true,
  "configured_count": 45,
  "required_count": 45,
  "missing": [],
  "optional_missing": []
}
```

---

## API Endpoints

### 1. **Initialize Mappings (Auto-Detect)**
```
POST /api/finance/account-mappings/initialize
```

**Request:**
```json
{
  "company_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Account mappings initialized successfully.",
  "mapped_count": 45,
  "unmapped_count": 3,
  "mapped": {
    "accounts_receivable": "1200",
    "accounts_payable": "2100",
    "sales_revenue": "4000"
  },
  "unmapped": {
    "expense_payroll": "Could not auto-detect",
    "service_revenue": "Could not auto-detect"
  }
}
```

---

### 2. **Get All Mappings**
```
GET /api/finance/account-mappings?company_id={id}&is_system=false
```

**Query Parameters:**
- `company_id` - Filter by company (optional)
- `is_system` - Show only system mappings (optional)
- `context_type` - Filter by context type (optional)

**Response:**
```json
{
  "status": "success",
  "mappings": [
    {
      "id": "uuid",
      "company_id": "uuid",
      "mapping_key": "accounts_receivable",
      "account_code": "1200",
      "chart_of_account": {
        "id": "uuid",
        "account_code": "1200",
        "account_name": "Accounts Receivable",
        "account_type": "asset",
        "account_subtype": "current_asset",
        "is_active": true
      },
      "description": "Customer receivables",
      "context_type": null,
      "context_id": null,
      "priority": 0,
      "is_active": true
    }
  ],
  "available_keys": {
    "core": {
      "accounts_receivable": {
        "description": "Trade Receivables",
        "type": "asset",
        "required": true
      }
    }
  }
}
```

---

### 3. **Get Single Mapping**
```
GET /api/finance/account-mappings/{mapping-id}
```

**Response:**
```json
{
  "status": "success",
  "mapping": {
    "id": "uuid",
    "company_id": "uuid",
    "mapping_key": "sales_revenue",
    "account_code": "4000",
    "chart_of_account": {
      "id": "uuid",
      "account_code": "4000",
      "account_name": "Sales Revenue",
      "account_type": "income"
    }
  }
}
```

---

### 4. **Create/Update Mapping**
```
POST /api/finance/account-mappings
```

**Request:**
```json
{
  "company_id": "uuid",
  "mapping_key": "sales_revenue",
  "account_code": "4000",
  "chart_of_account_id": "uuid",
  "description": "Primary sales revenue account",
  "context_type": null,
  "context_id": null,
  "priority": 0
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Account mapping saved successfully.",
  "mapping": { /* mapping object */ }
}
```

---

### 5. **Bulk Update Mappings**
```
POST /api/finance/account-mappings/bulk
```

**Request:**
```json
{
  "company_id": "uuid",
  "mappings": [
    {
      "mapping_key": "accounts_receivable",
      "account_code": "1200",
      "description": "Customer receivables"
    },
    {
      "mapping_key": "sales_revenue",
      "account_code": "4000",
      "description": "Sales revenue"
    }
  ]
}
```

**Response:**
```json
{
  "status": "success",
  "saved_count": 2,
  "errors": []
}
```

---

### 6. **Get Available Mapping Keys**
```
GET /api/finance/account-mappings/available-keys
```

**Response:**
```json
{
  "status": "success",
  "core_keys": {
    "accounts_receivable": {
      "description": "Trade Receivables",
      "type": "asset",
      "required": true
    },
    "accounts_payable": {
      "description": "Accounts Payable",
      "type": "liability",
      "required": true
    },
    "sales_revenue": {
      "description": "Sales Revenue",
      "type": "income",
      "required": true
    }
  },
  "extended_keys": {
    "expense_account": {
      "description": "General Expense",
      "type": "expense",
      "required": true
    }
  },
  "payment_method_mappings": {
    "mpesa": "cash_mpesa",
    "bank_transfer": "cash_bank_transfer"
  }
}
```

---

### 7. **Validate Configuration**
```
GET /api/finance/account-mappings/validate?company_id={id}
```

**Response:**
```json
{
  "status": "success",
  "is_valid": true,
  "configured_count": 45,
  "required_count": 45,
  "configured": {
    "accounts_receivable": "uuid",
    "sales_revenue": "uuid"
  },
  "missing": [],
  "optional_missing": [
    {
      "key": "service_revenue",
      "description": "Service Revenue",
      "message": "Optional mapping not configured"
    }
  ]
}
```

---

### 8. **Delete Mapping**
```
DELETE /api/finance/account-mappings/{mapping-id}
```

**Response:**
```json
{
  "status": "success",
  "message": "Account mapping deleted successfully."
}
```

---

### 9. **Payment Method Configuration**
```
GET /api/finance/account-mappings/payment-methods?company_id={id}
POST /api/finance/account-mappings/payment-methods
```

**POST Request:**
```json
{
  "company_id": "uuid",
  "payment_method": "mpesa",
  "mapping_key": "cash_mpesa",
  "description": "M-Pesa cash account"
}
```

**Response:**
```json
{
  "status": "success",
  "payment_methods": {
    "mpesa": {
      "payment_method": "mpesa",
      "mapping_key": "cash_mpesa",
      "display_name": "M-Pesa"
    }
  }
}
```

---

## Frontend Implementation

### Setup Flow (Account Setup Page)

```javascript
// 1. Check if mappings are already configured
async function checkMappingStatus() {
  const response = await fetch('/api/finance/account-mappings/validate?company_id=' + companyId, {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  
  const data = await response.json();
  
  if (data.is_valid) {
    // All required mappings configured
    showSuccess('Accounting is ready to use');
  } else {
    // Show setup wizard
    showMappingSetupWizard(data.missing);
  }
}

// 2. Auto-initialize mappings
async function initializeMappings() {
  try {
    const response = await fetch('/api/finance/account-mappings/initialize', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ company_id: companyId })
    });
    
    const data = await response.json();
    
    if (data.status === 'success') {
      console.log(`Mapped ${data.mapped_count} accounts`);
      
      if (data.unmapped_count > 0) {
        // Show form to manually configure unmapped accounts
        showManualMappingForm(data.unmapped);
      } else {
        showSuccess('All accounts configured automatically!');
      }
    }
  } catch (error) {
    showError('Failed to initialize mappings: ' + error.message);
  }
}

// 3. Get available mapping keys for dropdown
async function loadAvailableMappingKeys() {
  const response = await fetch('/api/finance/account-mappings/available-keys', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  
  const data = await response.json();
  
  return {
    coreKeys: data.core_keys,
    extendedKeys: data.extended_keys,
    paymentMethods: data.payment_method_mappings
  };
}

// 4. Display mapping configuration form
async function showMappingSetupWizard(unmappedKeys) {
  const availableKeys = await loadAvailableMappingKeys();
  
  // Get list of chart of accounts to select from
  const response = await fetch('/api/finance/chart-of-accounts/minimal?company_id=' + companyId, {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  
  const chartAccounts = await response.json();
  
  // Build form with:
  // - Dropdown of unmapped keys
  // - Dropdown of available accounts
  // - Save button
}

// 5. Save individual mapping
async function saveMapping(mappingKey, accountCode, description) {
  const response = await fetch('/api/finance/account-mappings', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      company_id: companyId,
      mapping_key: mappingKey,
      account_code: accountCode,
      description: description
    })
  });
  
  const data = await response.json();
  
  if (data.status === 'success') {
    showSuccess('Mapping saved');
    // Refresh validation status
    checkMappingStatus();
  }
}

// 6. View all configured mappings
async function viewAllMappings() {
  const response = await fetch('/api/finance/account-mappings?company_id=' + companyId, {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  
  const data = await response.json();
  
  displayMappingsList(data.mappings);
}
```

---

## Common Workflows

### Workflow 1: First-Time Company Setup

```
1. User creates new company ✓
   ↓
2. Frontend calls POST /api/finance/account-mappings/initialize
   ↓
3. System auto-detects accounts from Chart of Accounts
   ↓
4. If gaps exist:
   - Frontend displays list of unmapped keys
   - User selects account for each unmapped key
   - Frontend calls POST /api/finance/account-mappings for each
   ↓
5. Frontend calls GET /api/finance/account-mappings/validate
   ↓
6. If valid: Show "Setup Complete" message
   If invalid: Show remaining gaps
```

### Workflow 2: Adding New Account Type

```
1. Admin wants to track a new expense type
   ↓
2. Admin creates new Chart of Account (e.g., "5500 - Training Expense")
   ↓
3. Frontend displays notification: "New accounts detected"
   ↓
4. Admin clicks "Add Mapping"
   ↓
5. Frontend shows:
   - Available mapping keys (from GET /api/finance/account-mappings/available-keys)
   - New Chart of Accounts (from GET /api/chart-of-accounts)
   ↓
6. Admin selects:
   - Mapping Key: "training_expense"
   - Account: "5500 - Training Expense"
   ↓
7. Frontend calls POST /api/finance/account-mappings
   ↓
8. Mapping created and immediately available for transactions
```

### Workflow 3: Using Mappings When Recording Transaction

**Note:** The backend handles this automatically. Frontend just submits transaction data.

```javascript
// Frontend submits invoice
POST /api/invoices
{
  "customer_id": "uuid",
  "amount": 1000,
  "items": [...]
}

// Backend automatically:
// 1. Gets companyId from invoice
// 2. Resolves 'accounts_receivable' mapping → 1200 (from mappings)
// 3. Resolves 'sales_revenue' mapping → 4000
// 4. Creates journal entry:
//    - Debit: 1200 (A/R) 1000
//    - Credit: 4000 (Revenue) 1000
// 5. Posts to accounting system
```

### Workflow 4: Context-Aware Mappings (Advanced)

**Scenario:** Different expense accounts per category

```javascript
// Frontend displays expense form
// - Category dropdown (e.g., "Travel", "Training", "Office")
// - Amount field

// When user selects category, frontend fetches context-aware mapping:
GET /api/account-mappings?context_type=expense_category&context_id={categoryId}

// Response contains the specific account for that category
// Backend automatically uses this when recording

// If category-specific account not found, falls back to general expense account
```

---

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `401 Unauthorized` | Missing/invalid token | Check authorization header |
| `403 Forbidden` | User can't manage this company | Ensure user is admin of company |
| `404 Not Found` | Mapping or company doesn't exist | Verify IDs are correct |
| `422 Invalid mapping key` | Key not in available list | Use endpoint to get valid keys |
| `422 Account code not found` | Account doesn't exist in chart | Verify account code in Chart of Accounts |

### Error Response Example

```json
{
  "status": "failed",
  "message": "Account code '9999' not found for this company.",
  "errors": {
    "account_code": ["Account not found"]
  }
}
```

### Validation Before Posting Transaction

```javascript
// Before allowing user to post/send transaction
async function validateMappingsBeforeTransaction() {
  const response = await fetch('/api/account-mappings/validate?company_id=' + companyId, {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  
  const data = await response.json();
  
  if (!data.is_valid) {
    showError('Accounting setup incomplete. Please configure missing accounts.');
    return false;
  }
  
  return true;
}

// In transaction form submission
async function submitInvoice(invoiceData) {
  if (!await validateMappingsBeforeTransaction()) {
    return;
  }
  
  // Proceed with submission
  submitTransaction(invoiceData);
}
```

---

## Best Practices

### 1. **Initialize on Company Creation**
```javascript
// After company is created, immediately initialize mappings
async function createCompany(companyData) {
  // Create company
  const company = await createCompanyAPI(companyData);
  
  // Initialize mappings
  await initializeMappings(company.id);
  
  return company;
}
```

### 2. **Show Mapping Status in Dashboard**
```javascript
// Display on admin dashboard
- Mappings Configured: 45/45 ✓
- Pending Setup: None
- Last Updated: 2025-01-11

// Or if incomplete
- Mappings Configured: 42/45 ⚠️
- Missing: expense_payroll, service_revenue, discount_account
- [Complete Setup] button
```

### 3. **Cache Mapping Keys Locally**
```javascript
// Load once on app startup
async function initializeAppState() {
  const mappingKeys = await fetch('/api/account-mappings/available-keys');
  sessionStorage.setItem('mappingKeys', JSON.stringify(mappingKeys));
}

// Use from cache in forms
function getMappingKeysFromCache() {
  return JSON.parse(sessionStorage.getItem('mappingKeys'));
}
```

### 4. **Warn on Missing Mappings**
```javascript
// Show banner on pages that need mappings
async function checkAndWarnMissingMappings() {
  const validation = await fetch('/api/account-mappings/validate?company_id=' + companyId);
  const data = await validation.json();
  
  if (!data.is_valid) {
    showWarningBanner(
      `⚠️ Accounting not fully configured. ${data.missing.length} mappings pending.`,
      { action: 'Complete Setup', handler: showMappingWizard }
    );
  }
}
```

### 5. **Validate Before Sensitive Operations**
```javascript
// Before posting invoice, sending expense, recording payment
async function beforeTransaction() {
  const validation = await fetch('/api/account-mappings/validate');
  
  if (validation.is_valid === false) {
    throw new Error('Cannot complete transaction: Accounting not configured');
  }
}
```

### 6. **Handle Bulk Updates Safely**
```javascript
// When updating multiple mappings
async function bulkUpdateMappings(mappings) {
  try {
    const response = await fetch('/api/account-mappings/bulk', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        company_id: companyId,
        mappings: mappings
      })
    });
    
    const data = await response.json();
    
    // Show results
    if (data.errors.length > 0) {
      showWarning(`${data.saved_count} saved, ${data.errors.length} failed`);
      showErrors(data.errors);
    } else {
      showSuccess(`${data.saved_count} mappings saved`);
    }
  } catch (error) {
    showError('Bulk update failed: ' + error.message);
  }
}
```

### 7. **Provide Clear UI for Mapping Configuration**

**Suggested Layout:**
```
┌─────────────────────────────────────────┐
│ Account Mapping Configuration           │
├─────────────────────────────────────────┤
│                                         │
│ Status: ✓ All configured (45/45)        │
│                                         │
│ [Auto-Initialize] [View All] [Help]    │
│                                         │
│ Core Mappings:                          │
│ ┌─────────────────────────────────────┐ │
│ │ Mapping Key         | Account | Edit │ │
│ ├─────────────────────────────────────┤ │
│ │ accounts_receivable | 1200    | ✓   │ │
│ │ sales_revenue       | 4000    | ✓   │ │
│ │ accounts_payable    | 2100    | ✓   │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Extended Mappings:                      │
│ ┌─────────────────────────────────────┐ │
│ │ Mapping Key         | Account | Edit │ │
│ ├─────────────────────────────────────┤ │
│ │ expense_account     | 5000    | ✓   │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

---

## Summary

**Account Mappings are the configuration layer that:**
1. ✅ Connects business transactions to accounting accounts
2. ✅ Allows multi-company support with different account structures
3. ✅ Enables context-aware routing (different accounts per scenario)
4. ✅ Prevents transactions when accounting isn't configured

**Frontend responsibilities:**
- Display setup wizard on first use
- Allow admin to view/configure mappings
- Warn users if setup incomplete
- Prevent transactions if required mappings missing

**Best practice:** Always validate mappings before allowing critical transactions.

