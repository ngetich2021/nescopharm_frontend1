# Accounting Integration System - Complete Documentation

## Overview

This document describes the dynamic, configurable accounting integration system for the Cherry API. The system allows each company to:

1. **Configure their own Chart of Accounts** - Map business transactions to their specific account codes
2. **Choose when transactions hit the accounting system** - Different trigger points based on business workflow
3. **Select accounting method** - Accrual or Cash basis accounting
4. **Control approval workflows** - Require approvals before journal entries are posted

---

## Architecture

### Core Components

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          CONTROLLERS                                     │
│  InvoiceController  │  ExpenseController  │  SupplierController          │
└──────────┬─────────────────┬─────────────────────┬──────────────────────┘
           │                 │                     │
           ▼                 ▼                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    AccountingWorkflowService                             │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ • Checks company settings before recording transactions          │    │
│  │ • Determines trigger point (on_created, on_sent, on_payment)    │    │
│  │ • Routes to appropriate accounting method (accrual vs cash)     │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└──────────┬──────────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                   AccountingIntegrationService                           │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ • Creates journal entries                                        │    │
│  │ • Uses AccountMappingResolver for dynamic account codes         │    │
│  │ • Handles debit/credit logic for all transaction types          │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└──────────┬──────────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        Database Tables                                   │
│  ┌───────────────────┐  ┌───────────────────┐  ┌────────────────────┐  │
│  │ journal_entries   │  │ journal_entry_items│  │ chart_of_accounts │  │
│  │ (header record)   │  │ (line items)       │  │ (account codes)   │  │
│  └───────────────────┘  └───────────────────┘  └────────────────────┘  │
│  ┌───────────────────┐  ┌───────────────────┐                          │
│  │ company_account_  │  │ company_accounting │                          │
│  │ mappings          │  │ _settings          │                          │
│  └───────────────────┘  └───────────────────┘                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Configuration Tables

### 1. Company Account Mappings (`company_account_mappings`)

Maps business transaction types to specific Chart of Account codes per company.

```sql
CREATE TABLE company_account_mappings (
    id UUID PRIMARY KEY,
    company_id UUID REFERENCES companies(id),
    mapping_key VARCHAR(100),      -- e.g., 'sales_revenue', 'accounts_receivable'
    chart_of_account_id UUID REFERENCES chart_of_accounts(id),
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

#### Core Mapping Keys

| Key | Description | Typical Account Type |
|-----|-------------|---------------------|
| `sales_revenue` | Sales/Revenue Account | Income |
| `accounts_receivable` | Customer Receivables | Asset |
| `accounts_payable` | Supplier Payables | Liability |
| `cash` | Cash Account | Asset |
| `bank` | Bank Account | Asset |
| `vat_output` | VAT Collected | Liability |
| `vat_input` | VAT Paid | Asset |
| `cost_of_goods_sold` | COGS | Expense |
| `inventory` | Stock/Inventory | Asset |
| `general_expense` | General Expenses | Expense |
| `discount_given` | Sales Discounts | Expense |
| `discount_received` | Purchase Discounts | Income |

#### Payment Method Keys

| Key | Description |
|-----|-------------|
| `payment_cash` | Cash payments |
| `payment_card` | Card payments |
| `payment_bank_transfer` | Bank transfers |
| `payment_check` | Check payments |
| `payment_mpesa` | M-Pesa mobile money |

---

### 2. Company Accounting Settings (`company_accounting_settings`)

Configures WHEN and HOW transactions are recorded to the accounting system.

```sql
CREATE TABLE company_accounting_settings (
    id UUID PRIMARY KEY,
    company_id UUID REFERENCES companies(id),
    
    -- Accounting Method
    accounting_method VARCHAR(20) DEFAULT 'accrual',  -- 'accrual' or 'cash'
    
    -- Sales Recognition Triggers
    sales_recognition_trigger VARCHAR(50) DEFAULT 'invoice_sent',
    auto_record_cash_sales BOOLEAN DEFAULT true,
    credit_sales_on_invoice_send BOOLEAN DEFAULT true,
    
    -- Purchase Recognition Triggers
    purchase_recognition_trigger VARCHAR(50) DEFAULT 'goods_received',
    
    -- Expense Recognition Triggers
    expense_recognition_trigger VARCHAR(50) DEFAULT 'expense_approved',
    
    -- Payment Recording
    auto_record_customer_payments BOOLEAN DEFAULT true,
    auto_record_supplier_payments BOOLEAN DEFAULT true,
    
    -- VAT & COGS Settings
    vat_recognition VARCHAR(20) DEFAULT 'invoice_date',
    cogs_recognition VARCHAR(20) DEFAULT 'on_dispatch',
    perpetual_inventory BOOLEAN DEFAULT true,
    
    -- Approval Settings
    require_invoice_approval BOOLEAN DEFAULT false,
    require_expense_approval BOOLEAN DEFAULT true,
    require_journal_approval BOOLEAN DEFAULT false,
    expense_approval_threshold DECIMAL(15,2),
    
    -- Integration Control
    accounting_integration_enabled BOOLEAN DEFAULT true,
    log_failed_entries BOOLEAN DEFAULT true,
    soft_fail_on_accounting_error BOOLEAN DEFAULT true,
    
    -- Period Control
    financial_year_start_month INTEGER DEFAULT 1,
    lock_closed_periods BOOLEAN DEFAULT true,
    current_period_end DATE,
    
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

---

## Sales Invoice Triggers

| Trigger | When Used | Accounting Entry |
|---------|-----------|------------------|
| `order_created` | When sales order is created | DR A/R, CR Deferred Revenue |
| `order_completed` | When order is fulfilled | DR A/R, CR Sales Revenue |
| `order_dispatched` | When goods are dispatched | DR A/R, CR Sales Revenue |
| `invoice_created` | When invoice is created | DR A/R, CR Sales Revenue |
| `invoice_sent` | When invoice is sent (DEFAULT) | DR A/R, CR Sales Revenue |
| `invoice_approved` | When invoice is approved | DR A/R, CR Sales Revenue |
| `payment_received` | When payment is received (Cash Basis) | DR Cash/Bank, CR Sales Revenue |
| `manual` | Only when explicitly triggered | No automatic entry |

---

## Common Accounting Workflows

### Scenario A: Standard Accrual Accounting (Default)

```
Settings:
  accounting_method: 'accrual'
  sales_recognition_trigger: 'invoice_sent'

Flow:
1. Create Invoice → No accounting entry
2. Send Invoice → DR A/R $1,000 / CR Sales Revenue $1,000
3. Receive Payment → DR Bank $1,000 / CR A/R $1,000
```

### Scenario B: Cash Basis Accounting

```
Settings:
  accounting_method: 'cash'
  sales_recognition_trigger: 'payment_received'

Flow:
1. Create Invoice → No accounting entry
2. Send Invoice → No accounting entry
3. Receive Payment → DR Bank $1,000 / CR Sales Revenue $1,000
```

### Scenario C: Early Revenue Recognition

```
Settings:
  accounting_method: 'accrual'
  sales_recognition_trigger: 'order_completed'

Flow:
1. Complete Order → DR A/R $1,000 / CR Sales Revenue $1,000
2. Create Invoice → No new entry (already recorded)
3. Receive Payment → DR Bank $1,000 / CR A/R $1,000
```

### Scenario D: Manual Control

```
Settings:
  sales_recognition_trigger: 'manual'

Flow:
1. All automatic triggers skipped
2. Accountant manually creates journal entries
3. Used for complex scenarios or audit requirements
```

---

## API Endpoints

### Account Mappings

```
GET    /api/finance/account-mappings              List all mappings
POST   /api/finance/account-mappings              Create a mapping
GET    /api/finance/account-mappings/available-keys   Get available mapping keys
POST   /api/finance/account-mappings/bulk         Bulk update mappings
POST   /api/finance/account-mappings/initialize   Initialize default mappings
GET    /api/finance/account-mappings/validate     Validate configuration
GET    /api/finance/account-mappings/{id}         Get specific mapping
DELETE /api/finance/account-mappings/{id}         Delete mapping
```

### Accounting Settings

```
GET    /api/finance/accounting-settings           Get company settings
PUT    /api/finance/accounting-settings           Update settings
POST   /api/finance/accounting-settings/reset     Reset to defaults
GET    /api/finance/accounting-settings/summary   Get plain language summary
```

### Example: Update Settings

```bash
PUT /api/finance/accounting-settings
Content-Type: application/json
Authorization: Bearer {token}

{
    "accounting_method": "cash",
    "sales_recognition_trigger": "payment_received",
    "expense_recognition_trigger": "expense_paid",
    "auto_record_customer_payments": true,
    "require_expense_approval": false
}
```

### Example: Get Settings Summary

```bash
GET /api/finance/accounting-settings/summary
```

Response:
```json
{
    "enabled": true,
    "method": "accrual",
    "summary": [
        "🟢 **Accounting integration is ENABLED**",
        "📊 Using **Accrual Basis** accounting - Revenue and expenses are recorded when earned/incurred.",
        "🧾 **Sales** are recorded to accounting when invoice is sent (recommended)",
        "💳 **Cash sales** (POS) are recorded immediately when payment is received",
        "📦 **Purchases** are recorded to accounting when goods are received (recommended)",
        "💸 **Expenses** are recorded to accounting when expense is approved (recommended)",
        "✅ Customer payments automatically create accounting entries",
        "✅ Supplier payments automatically create accounting entries"
    ]
}
```

---

## Integration Examples

### Invoice Controller Integration

```php
// In InvoiceController::sendInvoice()
try {
    $result = $this->accountingWorkflow
        ->forCompany($invoice->company_id)
        ->asUser($user->id)
        ->onInvoiceSent($invoice);
        
    if ($result) {
        Log::info('Accounting entry created', ['journal_id' => $result['journal_id']]);
    } else {
        Log::info('Accounting entry skipped (trigger not configured for this action)');
    }
} catch (\Exception $e) {
    // Soft fail - log but don't stop the business process
    Log::warning('Accounting entry failed', ['error' => $e->getMessage()]);
}
```

### Expense Controller Integration

```php
// In ExpenseController::approve()
if ($settings->shouldRecordExpenseAt('expense_approved')) {
    $result = $this->accountingWorkflow
        ->forCompany($expense->company_id)
        ->asUser($user->id)
        ->onExpenseRecorded($expense->amount, $expense->payment_method, $expense->description);
}
```

---

## Migration Guide for New Companies

### Step 1: Set Up Chart of Accounts

```bash
POST /api/finance/chart-of-accounts
{
    "code": "4000",
    "name": "Sales Revenue",
    "type": "income",
    "company_id": "uuid"
}
```

### Step 2: Initialize Account Mappings

```bash
POST /api/finance/account-mappings/initialize
# This creates default mappings for core transaction types
```

### Step 3: Configure Accounting Settings

```bash
PUT /api/finance/accounting-settings
{
    "accounting_method": "accrual",
    "sales_recognition_trigger": "invoice_sent",
    "expense_recognition_trigger": "expense_approved"
}
```

### Step 4: Validate Configuration

```bash
GET /api/finance/account-mappings/validate
# Returns any missing required mappings
```

---

## Error Handling

The system uses **soft failure** by default:

1. If accounting entry fails, the business transaction still completes
2. Failed entries are logged for later reconciliation
3. Can be configured to hard fail if required (`soft_fail_on_accounting_error: false`)

---

## Future Enhancements

1. **Multi-currency support** - Currency conversion in journal entries
2. **Cost center tracking** - Departmental accounting
3. **Bank reconciliation** - Match bank transactions to journal entries
4. **Financial reporting** - P&L, Balance Sheet generation
5. **Audit trail** - Complete history of accounting changes
