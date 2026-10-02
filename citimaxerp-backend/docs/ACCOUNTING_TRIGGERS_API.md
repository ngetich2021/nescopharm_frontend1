# Database-Driven Accounting Triggers API

## Overview

This API provides a fully database-driven accounting trigger configuration system. Companies can create, manage, and configure their own triggers without any code changes. The system comes pre-seeded with standard accounting triggers that can be used as-is or extended.

## Key Concepts

### Categories
Trigger categories group related triggers together:
- **Sales Recognition** (`sales`) - Triggers for recognizing sales revenue
- **Purchase Recognition** (`purchase`) - Triggers for recognizing purchases
- **Expense Recognition** (`expense`) - Triggers for recognizing expenses

### Triggers
Each trigger defines:
- When accounting entries should be created (the event)
- What model and status triggers the event
- Which accounts should be debited/credited
- Whether it's a system (read-only) or custom trigger

### System vs Custom Triggers
- **System triggers**: Pre-defined, cannot be deleted, only `is_active` and `is_default` can be changed
- **Custom triggers**: Company-specific, fully editable, can be deleted

## Base URL
```
/api/finance/accounting-triggers
```

---

## Endpoints

### 1. Get Trigger Categories
Returns all available trigger categories with their triggers.

**Request**
```http
GET /api/finance/accounting-triggers/categories
Authorization: Bearer {token}
```

**Response**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "code": "sales",
      "name": "Sales Recognition",
      "description": "Triggers for recognizing sales revenue",
      "is_active": true,
      "sort_order": 1,
      "active_triggers": [
        {
          "id": "uuid",
          "trigger_key": "invoice_sent",
          "trigger_name": "When Invoice is Sent",
          "is_default": true,
          "is_system": true
        }
      ]
    }
  ]
}
```

---

### 2. List All Triggers
Returns all triggers available for the company.

**Request**
```http
GET /api/finance/accounting-triggers
Authorization: Bearer {token}
```

**Query Parameters**
| Parameter | Type | Description |
|-----------|------|-------------|
| `category` | string | Filter by category code (sales, purchase, expense) |
| `include_inactive` | boolean | Include inactive triggers (default: false) |

**Response**
```json
{
  "success": true,
  "data": {
    "triggers": [...],
    "grouped": {
      "sales": [...],
      "purchase": [...],
      "expense": [...]
    }
  }
}
```

---

### 3. Get Available Trigger Keys
Returns trigger keys for dropdown selections.

**Request**
```http
GET /api/finance/accounting-triggers/available-keys
Authorization: Bearer {token}
```

**Query Parameters**
| Parameter | Type | Description |
|-----------|------|-------------|
| `category` | string | Filter by category code |

**Response**
```json
{
  "success": true,
  "data": [
    {
      "value": "invoice_sent",
      "label": "When Invoice is Sent",
      "id": "uuid",
      "is_default": true,
      "is_system": true
    }
  ]
}
```

---

### 4. Get Default Triggers
Returns the default trigger for each category.

**Request**
```http
GET /api/finance/accounting-triggers/defaults
Authorization: Bearer {token}
```

**Response**
```json
{
  "success": true,
  "data": {
    "sales": {
      "category": {...},
      "default_trigger": {
        "id": "uuid",
        "trigger_key": "invoice_sent",
        "trigger_name": "When Invoice is Sent"
      }
    },
    "purchase": {...},
    "expense": {...}
  }
}
```

---

### 5. Get Single Trigger
Returns details of a specific trigger.

**Request**
```http
GET /api/finance/accounting-triggers/{id}
Authorization: Bearer {token}
```

**Response**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "company_id": null,
    "category_id": "uuid",
    "trigger_key": "invoice_sent",
    "trigger_name": "When Invoice is Sent",
    "description": "Record revenue when invoice is sent to customer",
    "model_class": "App\\Models\\Invoice",
    "model_status": "sent",
    "journal_type": "sales",
    "debit_accounts": ["accounts_receivable"],
    "credit_accounts": ["sales_revenue", "vat_output"],
    "is_system": true,
    "is_active": true,
    "is_default": true,
    "sort_order": 6,
    "category": {...}
  }
}
```

---

### 6. Create Custom Trigger
Creates a new company-specific trigger.

**Request**
```http
POST /api/finance/accounting-triggers
Authorization: Bearer {token}
Content-Type: application/json

{
  "category_code": "sales",
  "trigger_key": "custom_delivery_confirmed",
  "trigger_name": "When Delivery is Confirmed via App",
  "description": "Record revenue when driver confirms delivery via mobile app",
  "model_class": "App\\Models\\DeliveryConfirmation",
  "model_status": "confirmed",
  "journal_type": "sales",
  "debit_accounts": ["accounts_receivable"],
  "credit_accounts": ["sales_revenue", "vat_output"],
  "is_active": true,
  "is_default": false,
  "sort_order": 50
}
```

**Required Fields**
| Field | Type | Description |
|-------|------|-------------|
| `category_code` | string | Category code (sales, purchase, expense) |
| `trigger_key` | string | Unique key within category (max 50 chars) |
| `trigger_name` | string | Display name (max 100 chars) |

**Optional Fields**
| Field | Type | Description |
|-------|------|-------------|
| `description` | string | Detailed description |
| `event_class` | string | Laravel event class to listen for |
| `model_class` | string | Model class that triggers this |
| `model_status` | string | Status that triggers (e.g., 'sent', 'delivered') |
| `conditions` | array | Additional conditions (JSON) |
| `journal_type` | string | Type of journal entry (default: 'standard') |
| `debit_accounts` | array | Account mapping keys for debits |
| `credit_accounts` | array | Account mapping keys for credits |
| `is_active` | boolean | Whether trigger is active (default: true) |
| `is_default` | boolean | Set as default for category (default: false) |
| `sort_order` | integer | Sort order in lists |

**Response**
```json
{
  "success": true,
  "message": "Trigger configuration created successfully",
  "data": {...}
}
```

---

### 7. Update Trigger
Updates a trigger configuration.

**Request**
```http
PUT /api/finance/accounting-triggers/{id}
Authorization: Bearer {token}
Content-Type: application/json

{
  "trigger_name": "Updated Name",
  "is_active": false
}
```

**Note**: System triggers can only have `is_active` and `is_default` modified.

**Response**
```json
{
  "success": true,
  "message": "Trigger configuration updated successfully",
  "data": {...}
}
```

---

### 8. Delete Trigger
Deletes a company-specific trigger.

**Request**
```http
DELETE /api/finance/accounting-triggers/{id}
Authorization: Bearer {token}
```

**Response**
```json
{
  "success": true,
  "message": "Trigger configuration deleted successfully"
}
```

**Error Response (System Trigger)**
```json
{
  "success": false,
  "message": "System triggers cannot be deleted"
}
```

---

### 9. Set Default Trigger
Sets a trigger as the default for its category.

**Request**
```http
POST /api/finance/accounting-triggers/{id}/set-default
Authorization: Bearer {token}
```

**Response**
```json
{
  "success": true,
  "message": "Trigger set as default successfully",
  "data": {...}
}
```

---

### 10. Bulk Update Status
Enable or disable multiple triggers at once.

**Request**
```http
POST /api/finance/accounting-triggers/bulk-update-status
Authorization: Bearer {token}
Content-Type: application/json

{
  "trigger_ids": ["uuid1", "uuid2", "uuid3"],
  "is_active": false
}
```

**Response**
```json
{
  "success": true,
  "message": "Updated 3 trigger(s)",
  "updated_count": 3
}
```

---

## Pre-Seeded Triggers

### Sales Recognition Triggers
| Key | Name | Description |
|-----|------|-------------|
| `order_created` | When Order is Created | Record revenue when sales order is created |
| `order_completed` | When Order is Completed | Record revenue when order is marked complete |
| `order_dispatched` | When Order is Dispatched | Record revenue when goods are dispatched |
| `order_delivered` | When Order is Delivered | Record revenue when delivery is confirmed |
| `invoice_created` | When Invoice is Created | Record revenue when invoice is created |
| `invoice_sent` | When Invoice is Sent | Record revenue when invoice is sent (**DEFAULT**) |
| `invoice_approved` | When Invoice is Approved | Record revenue when invoice is approved |
| `payment_received` | When Payment is Received | Record revenue only when payment is received (Cash Basis) |
| `manual` | Manual Entry Only | No automatic entries |

### Purchase Recognition Triggers
| Key | Name | Description |
|-----|------|-------------|
| `purchase_created` | When PO is Created | Record liability when PO is created |
| `purchase_approved` | When PO is Approved | Record liability when PO is approved |
| `goods_received` | When Goods are Received | Record liability when goods arrive (**DEFAULT**) |
| `payment_made` | When Payment is Made | Record expense only when payment is made (Cash Basis) |
| `manual` | Manual Entry Only | No automatic entries |

### Expense Recognition Triggers
| Key | Name | Description |
|-----|------|-------------|
| `expense_created` | When Expense is Created | Record expense when submitted |
| `expense_approved` | When Expense is Approved | Record expense when approved (**DEFAULT**) |
| `expense_paid` | When Expense is Paid | Record expense only when paid (Cash Basis) |
| `manual` | Manual Entry Only | No automatic entries |

---

## Usage Examples

### Example 1: Creating a Custom Trigger for Mobile Delivery Confirmation

```javascript
// Frontend code to create a custom trigger
const response = await fetch('/api/finance/accounting-triggers', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    category_code: 'sales',
    trigger_key: 'mobile_delivery_confirmed',
    trigger_name: 'When Driver Confirms Delivery via Mobile',
    description: 'Revenue is recognized when the delivery driver confirms delivery using the mobile app with GPS verification',
    model_class: 'App\\Models\\MobileDeliveryConfirmation',
    model_status: 'confirmed',
    journal_type: 'sales',
    debit_accounts: ['accounts_receivable'],
    credit_accounts: ['sales_revenue', 'vat_output'],
    is_active: true
  })
});
```

### Example 2: Building a Trigger Selection Dropdown

```javascript
// Get available triggers for sales category
const response = await fetch('/api/finance/accounting-triggers/available-keys?category=sales', {
  headers: { 'Authorization': 'Bearer ' + token }
});

const { data: triggers } = await response.json();

// Use in dropdown
triggers.forEach(trigger => {
  const option = document.createElement('option');
  option.value = trigger.value;
  option.textContent = trigger.label;
  if (trigger.is_default) option.selected = true;
  dropdown.appendChild(option);
});
```

### Example 3: Setting Company's Preferred Default Trigger

```javascript
// Company wants to recognize revenue when order is delivered instead of invoice sent
const deliverTrigger = triggers.find(t => t.trigger_key === 'order_delivered');

await fetch(`/api/finance/accounting-triggers/${deliverTrigger.id}/set-default`, {
  method: 'POST',
  headers: { 'Authorization': 'Bearer ' + token }
});
```

---

## Integration with Accounting Workflow Service

The trigger configurations should be used by the `AccountingWorkflowService` to determine when to create accounting entries. Here's how to query the active trigger:

```php
use App\Models\AccountingTriggerConfig;

// Get the company's selected trigger for sales recognition
$salesTrigger = AccountingTriggerConfig::getDefaultForCategory('sales', $companyId);

// Check if current event matches the trigger
if ($salesTrigger && $salesTrigger->matches(Invoice::class, 'sent')) {
    // Create the accounting entry
    $this->accountingService->recordSale(...);
}
```

---

## Error Responses

### 404 Not Found
```json
{
  "success": false,
  "message": "Trigger configuration not found"
}
```

### 422 Validation Error
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": {
    "trigger_key": ["The trigger key field is required."]
  }
}
```

### 403 Forbidden
```json
{
  "success": false,
  "message": "System triggers cannot be deleted"
}
```

---

## Database Schema

### accounting_trigger_categories
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| company_id | uuid | Null for system categories |
| code | string | Category code |
| name | string | Display name |
| description | text | Description |
| is_active | boolean | Active status |
| sort_order | integer | Sort order |

### accounting_trigger_configs
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| company_id | uuid | Null for system triggers |
| category_id | uuid | Foreign key to categories |
| trigger_key | string | Unique trigger identifier |
| trigger_name | string | Display name |
| description | text | Description |
| model_class | string | Laravel model class |
| model_status | string | Status that triggers |
| journal_type | string | Type of journal entry |
| debit_accounts | json | Account keys to debit |
| credit_accounts | json | Account keys to credit |
| is_system | boolean | System trigger flag |
| is_active | boolean | Active status |
| is_default | boolean | Default for category |
| sort_order | integer | Sort order |
