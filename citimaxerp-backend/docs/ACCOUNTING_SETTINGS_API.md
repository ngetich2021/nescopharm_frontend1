# Accounting Integration API Documentation

## Overview

The Cherry API Accounting Integration system provides a flexible, configurable way for companies to manage when and how their business transactions are recorded in the accounting system. Each company can customize their accounting workflow based on their business needs and accounting standards compliance.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Configuration Options](#configuration-options)
3. [Sales Recognition Triggers](#sales-recognition-triggers)
4. [API Reference](#api-reference)
5. [Common Configurations](#common-configurations)
6. [Integration Examples](#integration-examples)
7. [Troubleshooting](#troubleshooting)

---

## Quick Start

### 1. Get Current Settings

```bash
GET /api/finance/accounting-settings
Authorization: Bearer {token}
```

### 2. Configure Your Workflow

```bash
PUT /api/finance/accounting-settings
Authorization: Bearer {token}
Content-Type: application/json

{
    "accounting_method": "accrual",
    "sales_recognition_trigger": "invoice_sent"
}
```

### 3. Verify Configuration

```bash
GET /api/finance/accounting-settings/summary
```

---

## Configuration Options

### Accounting Method

| Value | Description |
|-------|-------------|
| `accrual` | Record revenue when earned and expenses when incurred (default) |
| `cash` | Record revenue when payment received and expenses when paid |

### New Fields & Notes

- `soft_fail_on_accounting_error` (boolean): When `true`, accounting failures are logged and business transactions complete; when `false`, the business transaction will fail if accounting entry creation fails.
- `vat_recognition` (string): Controls when VAT is recognized — `invoice_date` or `payment_date`.
- `cogs_recognition` (string): Controls when Cost of Goods Sold is posted — options include `on_sale`, `on_dispatch`, `on_delivery`.
- `auto_record_cash_sales` / `auto_record_customer_payments` / `auto_record_supplier_payments` (boolean): Flags to enable automatic recording of cash sales and payments.


### Sales Recognition Triggers

| Trigger | When Entry is Created | Use Case |
|---------|----------------------|----------|
| `order_created` | When sales order is created | Advance billing, subscriptions |
| `order_completed` | When order is fulfilled | Service businesses |
| `order_dispatched` | When goods are dispatched | Wholesale/distribution |
| `order_delivered` | When delivery is confirmed | Proof of delivery required |
| `invoice_created` | When invoice is created | Early revenue recognition |
| `invoice_sent` | When invoice is sent to customer | **Recommended default** |
| `invoice_approved` | When invoice is approved | Companies requiring approval |
| `payment_received` | When payment is received | Cash basis accounting |
| `manual` | No automatic entries | Full manual control |

### Purchase Recognition Triggers

| Trigger | When Entry is Created |
|---------|----------------------|
| `purchase_created` | When PO is created |
| `purchase_approved` | When PO is approved |
| `goods_received` | When goods are received (recommended) |
| `payment_made` | When payment is made (cash basis) |
| `manual` | No automatic entries |

### Expense Recognition Triggers

| Trigger | When Entry is Created |
|---------|----------------------|
| `expense_created` | When expense is submitted |
| `expense_approved` | When expense is approved (recommended) |
| `expense_paid` | When expense is paid (cash basis) |
| `manual` | No automatic entries |

---

## Sales Recognition Triggers

### When to Use Each Trigger

#### `invoice_sent` (Default - Recommended)
Best for most businesses. Creates Accounts Receivable entry when invoice is sent.

```
Flow:
1. Create Order → No entry
2. Create Invoice → No entry  
3. Send Invoice → DR A/R, CR Revenue
4. Receive Payment → DR Bank, CR A/R
```

#### `order_delivered` (Delivery Confirmation)
For businesses requiring proof of delivery before recognizing revenue.

```
Flow:
1. Create Order → No entry
2. Dispatch Order → No entry
3. Mark Delivered → DR A/R, CR Revenue
4. Receive Payment → DR Bank, CR A/R
```

This is useful for:
- E-commerce with high return rates
- Businesses with delivery verification requirements
- Compliance with revenue recognition standards (ASC 606, IFRS 15)

#### `payment_received` (Cash Basis)
For cash basis accounting or businesses that want conservative revenue recognition.

```
Flow:
1. Create Order → No entry
2. Send Invoice → No entry
3. Receive Payment → DR Bank, CR Revenue
```

---

## API Reference

### Get Accounting Settings

```http
GET /api/finance/accounting-settings
```

**Response:**
```json
{
  "status": "success",
  "message": "Accounting settings retrieved successfully",
  "data": {
    "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "company_id": "b7a1c3d2-9e8f-4a1b-9f2d-1234567890ab",
    "accounting_method": "accrual",
    "sales_recognition_trigger": "invoice_sent",
    "purchase_recognition_trigger": "goods_received",
    "expense_recognition_trigger": "expense_approved",
    "auto_record_cash_sales": true,
    "credit_sales_on_invoice_send": true,
    "auto_record_customer_payments": true,
    "auto_record_supplier_payments": true,
    "require_expense_approval": true,
    "expense_approval_threshold": 10000,
    "accounting_integration_enabled": true,
    "vat_recognition": "invoice_date",
    "cogs_recognition": "on_sale",
    "soft_fail_on_accounting_error": true,
    "record_proforma_invoices": false,
    "record_draft_invoices": false,
    "perpetual_inventory": true,
    "require_invoice_approval": false,
    "require_journal_approval": false,
    "log_failed_entries": true,
    "financial_year_start_month": 1,
    "lock_closed_periods": true,
    "current_period_end": null,
    "created_at": "2025-12-01T12:34:56Z",
    "updated_at": "2026-01-11T09:00:00Z"
  },
  "options": {
    "sales_recognition_triggers": {
      "order_created": "When Order is Created",
      "order_completed": "When Order is Completed",
      "order_dispatched": "When Order is Dispatched",
      "order_delivered": "When Order is Delivered (Dispatch Confirmed)",
      "invoice_created": "When Invoice is Created",
      "invoice_sent": "When Invoice is Sent (Recommended)",
      "invoice_approved": "When Invoice is Approved",
      "payment_received": "When Payment is Received (Cash Basis)"
    },
    "purchase_recognition_triggers": {
      "purchase_created": "When Purchase Order is Created",
      "purchase_approved": "When Purchase Order is Approved",
      "goods_received": "When Goods are Received (Recommended)",
      "payment_made": "When Payment is Made (Cash Basis)"
    },
    "expense_recognition_triggers": {
      "expense_created": "When Expense is Created",
      "expense_approved": "When Expense is Approved (Recommended)",
      "expense_paid": "When Expense is Paid (Cash Basis)"
    },
    "accounting_methods": {
      "accrual": "Accrual Basis (Record when earned/incurred)",
      "cash": "Cash Basis (Record when paid/received)"
    },
    "vat_recognition_options": {
      "invoice_date": "When Invoice is Issued",
      "payment_date": "When Payment is Received"
    },
    "cogs_recognition_options": {
      "on_sale": "When Sale is Made",
      "on_dispatch": "When Goods are Dispatched",
      "on_delivery": "When Delivery is Confirmed"
    }

---

### Update Accounting Settings

```http
PUT /api/finance/accounting-settings
Content-Type: application/json

{
    "accounting_method": "accrual",
    "sales_recognition_trigger": "order_delivered",
    "purchase_recognition_trigger": "goods_received",
    "expense_recognition_trigger": "expense_approved",
    "auto_record_cash_sales": false,
    "credit_sales_on_invoice_send": true,
    "auto_record_customer_payments": true,
    "auto_record_supplier_payments": true,
    "require_expense_approval": true,
    "expense_approval_threshold": 10000,
    "accounting_integration_enabled": true,
    "vat_recognition": "invoice_date",
    "cogs_recognition": "on_dispatch",
    "soft_fail_on_accounting_error": false
}
```

**Available Fields:**

| Field | Type | Values |
|-------|------|--------|
| `accounting_method` | string | `accrual`, `cash` |
| `sales_recognition_trigger` | string | See triggers table |
| `purchase_recognition_trigger` | string | See triggers table |
| `expense_recognition_trigger` | string | See triggers table |
| `auto_record_cash_sales` | boolean | true/false |
| `auto_record_customer_payments` | boolean | true/false |
| `auto_record_supplier_payments` | boolean | true/false |
| `require_expense_approval` | boolean | true/false |
| `expense_approval_threshold` | number | Amount threshold |
| `accounting_integration_enabled` | boolean | true/false |
| `vat_recognition` | string | `invoice_date`, `payment_date` |
| `cogs_recognition` | string | `on_sale`, `on_dispatch`, `on_delivery` |
| `soft_fail_on_accounting_error` | boolean | true/false |

**Response:**
```json
{
  "status": "success",
        "company_id": "b7a1c3d2-9e8f-4a1b-9f2d-1234567890ab",
        "accounting_method": "accrual",
        "sales_recognition_trigger": "order_delivered",
        "purchase_recognition_trigger": "goods_received",
        "expense_recognition_trigger": "expense_approved",
        "auto_record_cash_sales": false,
        "credit_sales_on_invoice_send": true,
        "auto_record_customer_payments": true,
        "auto_record_supplier_payments": true,
        "require_expense_approval": true,
        "expense_approval_threshold": 10000,
        "accounting_integration_enabled": true,
        "vat_recognition": "invoice_date",
        "cogs_recognition": "on_dispatch",
        "soft_fail_on_accounting_error": false,
        "updated_at": "2026-01-11T10:15:00Z"
    }
}
```

---

### Reset to Defaults

```http
POST /api/finance/accounting-settings/reset
```

**Response:**
```json
{
  "status": "success",
  "message": "Settings reset to defaults",
  "data": {
    "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "company_id": "b7a1c3d2-9e8f-4a1b-9f2d-1234567890ab",
    "accounting_method": "accrual",
    "sales_recognition_trigger": "invoice_sent",
    "purchase_recognition_trigger": "goods_received",
    "expense_recognition_trigger": "expense_approved",
    "auto_record_cash_sales": true,
    "credit_sales_on_invoice_send": true,
    "auto_record_customer_payments": true,
    "auto_record_supplier_payments": true,
    "require_expense_approval": true,
    "expense_approval_threshold": null,
    "accounting_integration_enabled": true,
    "vat_recognition": "invoice_date",
    "cogs_recognition": "on_sale",
    "soft_fail_on_accounting_error": true,
    "updated_at": "2026-01-11T10:20:00Z"
  }
}
```

---

### Get Settings Summary

```http
GET /api/finance/accounting-settings/summary
```

**Response:**
```json
{
    "enabled": true,
    "method": "accrual",
    "summary": [
        "🟢 **Accounting integration is ENABLED**",
        "📊 Using **Accrual Basis** accounting",
        "🧾 **Sales** are recorded when invoice is sent",
        "💸 **Expenses** are recorded when approved"
    ]
}
```

---

## Common Configurations

### Standard Accrual Accounting (Default)

```json
{
    "accounting_method": "accrual",
    "sales_recognition_trigger": "invoice_sent",
    "purchase_recognition_trigger": "goods_received",
    "expense_recognition_trigger": "expense_approved"
}
```

### Cash Basis Accounting

```json
{
    "accounting_method": "cash",
    "sales_recognition_trigger": "payment_received",
    "purchase_recognition_trigger": "payment_made",
    "expense_recognition_trigger": "expense_paid"
}
```

### Revenue on Delivery Confirmation

```json
{
    "accounting_method": "accrual",
    "sales_recognition_trigger": "order_delivered",
    "cogs_recognition": "on_delivery"
}
```

### Manual Control Only

```json
{
    "sales_recognition_trigger": "manual",
    "purchase_recognition_trigger": "manual",
    "expense_recognition_trigger": "manual"
}
```

### High-Value Expense Approval

```json
{
    "require_expense_approval": true,
    "expense_approval_threshold": 10000
}
```

---

## Integration Examples

### Invoice Workflow (invoice_sent trigger)

```
Step 1: Create Invoice
  → Invoice created (status: draft)
  → No accounting entry

Step 2: Send Invoice  
  → Invoice status changes to 'sent'
  → Accounting entry created:
      DR Accounts Receivable  $1,000.00
          CR Sales Revenue            $1,000.00

Step 3: Customer Pays
  → Payment recorded
  → Accounting entry created:
      DR Bank                 $1,000.00
          CR Accounts Receivable      $1,000.00
```

### Dispatch Workflow (order_delivered trigger)

```
Step 1: Create Order
  → Order created
  → No accounting entry

Step 2: Dispatch Order
  → Dispatch created, status: 'in_transit'
  → No accounting entry

Step 3: Mark Delivered
  POST /api/order-dispatches/{id}/delivered
  {
      "items": [{
          "item_id": "uuid",
          "delivered_quantity": 10,
          "damaged_quantity": 0
      }]
  }
  → Dispatch status: 'delivered'
  → Accounting entry created:
      DR Accounts Receivable  $1,000.00
          CR Sales Revenue            $1,000.00

Step 4: Customer Pays
  → Accounting entry created:
      DR Bank                 $1,000.00
          CR Accounts Receivable      $1,000.00
```

### Expense Workflow (expense_approved trigger)

```
Step 1: Create Expense
  POST /api/expenses
  {
      "amount": 500,
      "payment_method": "card",
      "description": "Office supplies"
  }
  → Expense created (status: pending)
  → No accounting entry

Step 2: Approve Expense
  POST /api/expenses/{id}/approve
  → Expense status: 'approved'
  → Accounting entry created:
      DR Office Supplies Expense  $500.00
          CR Credit Card Payable          $500.00
```

---

## Troubleshooting

### Entry Not Created

**Check:**
1. Is `accounting_integration_enabled` set to `true`?
2. Is the correct trigger configured?
3. Are the required account mappings in place?

```bash
# Check settings
GET /api/finance/accounting-settings

# Validate account mappings
GET /api/finance/account-mappings/validate
```

### Wrong Account Used

**Check:**
1. Verify account mappings are correct
2. Check payment method specific mappings

```bash
# List all mappings
GET /api/finance/account-mappings

# Update specific mapping
POST /api/finance/account-mappings
{
    "mapping_key": "sales_revenue",
    "chart_of_account_id": "correct-account-uuid"
}
```

### Entry Created at Wrong Time

**Solution:** Update the trigger configuration:

```bash
PUT /api/finance/accounting-settings
{
    "sales_recognition_trigger": "order_delivered"
}
```

---

## Error Handling

By default, accounting errors don't stop business operations:

- `soft_fail_on_accounting_error: true` - Business transaction completes, error is logged
- `soft_fail_on_accounting_error: false` - Business transaction fails if accounting fails

Failed entries can be reviewed and reconciled later through the journal entries API.

---

## Related Documentation

- [Account Mappings Guide](./ACCOUNTING_INTEGRATION_SERVICE.md)
- [Journal Entries API](./Journal_Entries.postman_collection.json)
- [Chart of Accounts Setup](./Chart_of_Accounts.md)

---

## Postman Collection

Import the Postman collection for testing:

`docs/Accounting_Settings.postman_collection.json`

The collection includes:
- All accounting settings endpoints
- Example configurations
- Business workflow examples
