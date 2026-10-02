# Customer and Customer Account Input Requirements

This document outlines which fields are **required** and **optional** when creating or updating customers and customer accounts in the Cherry API.

---

## Table of Contents
- [Customer Inputs](#customer-inputs)
  - [Create Customer](#create-customer)
  - [Update Customer](#update-customer)
- [Customer Account Inputs](#customer-account-inputs)
  - [Create Customer Account](#create-customer-account)
  - [Update Customer Account](#update-customer-account)
  - [Request Credit Limit Update](#request-credit-limit-update)

---

## Customer Inputs

### Create Customer

**Endpoint:** `POST /api/customers`

#### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string (max: 255) | Customer's full name or business name |

#### Optional Fields

| Field | Type | Default | Validation Rules | Description |
|-------|------|---------|------------------|-------------|
| `email` | string (max: 255) | null | Must be unique, valid email format | Customer's email address |
| `phone` | string (max: 50) | null | - | Customer's phone number (auto-formatted to include country code) |
| `status` | string | 'active' | Must be: active, inactive, or pending | Customer status |
| `address` | string | null | - | Street address |
| `city` | string (max: 100) | null | - | City |
| `state` | string (max: 100) | null | - | State/province |
| `country` | string (max: 100) | null | - | Country |
| `postal_code` | string (max: 20) | null | - | Postal/ZIP code |
| `notes` | string | null | - | Additional notes about the customer |
| `tags` | array | [] | Each tag max 50 chars | Array of tags for categorization |
| `preferred_communication_channel` | string | null | - | Preferred way to contact customer |
| `last_contact_date` | date | null | Valid date format | Last time customer was contacted |
| `customer_type` | string | null | Must be: individual or company | Type of customer |
| `business_name` | string (max: 255) | null | - | Registered business name (for company customers) |
| `nature_of_business` | string (max: 255) | null | - | What the business does |
| `pin_number` | string (max: 100) | null | - | Tax PIN number |
| `payment_method` | string | 'cash' | - | Default payment method |
| `contact_person_name` | string | null | - | Name of primary contact person |
| `contact_person_phone` | string | null | - | Phone of primary contact person |
| `contact_person_email` | string | null | - | Email of primary contact person |
| `timestamp` | string | null | - | Custom timestamp if needed |

#### Auto-Generated Fields

| Field | Description |
|-------|-------------|
| `id` | UUID automatically generated |
| `company_id` | Set from authenticated user's company |
| `customer_number` | Format: `CUST-{companyId8}-{sequential}` |
| `created_by` | Set from authenticated user |
| `created_at` | Timestamp of creation |
| `updated_at` | Timestamp of last update |

#### Batch Creation

You can create multiple customers at once by sending an array:

```json
{
  "customers": [
    { "name": "Customer 1", "email": "customer1@example.com" },
    { "name": "Customer 2", "email": "customer2@example.com" }
  ]
}
```

---

### Update Customer

**Endpoint:** `PUT /api/customers/{customerId}`

#### Required Fields

None (all fields are optional when updating)

#### Optional Fields

All fields from the create endpoint can be updated, with the following validation:

| Field | Type | Validation Rules | Description |
|-------|------|------------------|-------------|
| `name` | string (max: 255) | Required if provided | Customer's name |
| `email` | string (max: 255) | Must be unique (excluding current customer), valid email | Customer's email |
| `phone` | string (max: 50) | - | Phone number (auto-formatted) |
| `status` | string | Must be: active, inactive, or pending | Customer status |
| `company` | string (max: 255) | - | Company name |
| `address` | string | - | Street address |
| `city` | string (max: 100) | - | City |
| `state` | string (max: 100) | - | State/province |
| `country` | string (max: 100) | - | Country |
| `postal_code` | string (max: 20) | - | Postal code |
| `notes` | string | - | Notes |
| `tags` | array | Each tag max 50 chars | Tags array |
| `preferred_communication_channel` | string | Must be: email, phone, sms, or none | Communication preference |
| `last_contact_date` | date | Valid date format | Last contact date |
| `customer_type` | string | Must be: individual or company | Customer type |
| `payment_method` | string | - | Payment method |
| `contact_person_name` | string | - | Contact person name |
| `contact_person_phone` | string | - | Contact person phone |
| `contact_person_email` | string | - | Contact person email |
| `business_name` | string | - | Business name |
| `nature_of_business` | string | - | Nature of business |
| `pin_number` | string | - | Tax PIN |
| `timestamp` | string | - | Custom timestamp |

**Note:** Fields not included in the update request will retain their current values.

---

## Customer Account Inputs

### Create Customer Account

**Endpoint:** `POST /api/customer-accounts`

#### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `customer_id` | UUID | Must exist in customers table |

#### Optional Fields - Account Information

| Field | Type | Default | Validation Rules | Description |
|-------|------|---------|------------------|-------------|
| `certificate_of_incorporation_number` | string (max: 100) | null | - | Company registration number |
| `annual_turnover` | numeric | null | Min: 0 | Annual business turnover |
| `credit_required` | numeric | null | Min: 0 | Credit limit amount requested |
| `credit_period_required` | string (max: 100) | null | - | Credit period (e.g., "30 days", "60 days") |
| `currently_defaulted` | boolean | false | - | Whether customer has current defaults |
| `credit_terms` | string (max: 255) | null | - | Credit terms and conditions |
| `notes` | string | null | - | Additional notes |

#### Optional Fields - Directors

| Field | Type | Validation Rules | Description |
|-------|------|------------------|-------------|
| `directors` | array | - | Array of director objects |
| `directors.*.name` | string (max: 255) | Required if directors provided | Director's full name |
| `directors.*.id_passport_number` | string (max: 100) | Required if directors provided | ID or passport number |
| `directors.*.pin` | string (max: 100) | - | Director's tax PIN |
| `directors.*.phone_number` | string (max: 50) | - | Director's phone number |

#### Optional Fields - Authorized Purchase Persons

| Field | Type | Validation Rules | Description |
|-------|------|------------------|-------------|
| `authorised_purchase_persons` | array | - | Array of authorized persons |
| `authorised_purchase_persons.*.name` | string (max: 255) | Required if array provided | Person's full name |
| `authorised_purchase_persons.*.phone_number` | string (max: 50) | - | Person's phone number |

#### Optional Fields - Suppliers

| Field | Type | Validation Rules | Description |
|-------|------|------------------|-------------|
| `suppliers` | array | - | Array of supplier references |
| `suppliers.*.name` | string (max: 255) | Required if array provided | Supplier name |
| `suppliers.*.contact_person_name` | string (max: 255) | - | Supplier contact person |
| `suppliers.*.phone_number` | string (max: 50) | - | Supplier phone number |
| `suppliers.*.credit_limit` | numeric | Min: 0 | Credit limit with this supplier |

#### Optional Fields - Bank Details

| Field | Type | Validation Rules | Description |
|-------|------|------------------|-------------|
| `bank_details` | array | - | Array of bank account information |
| `bank_details.*.bank_name` | string (max: 255) | Required if array provided | Name of the bank |
| `bank_details.*.branch` | string (max: 255) | - | Bank branch name |
| `bank_details.*.account_number` | string (max: 100) | - | Bank account number |

#### Optional Fields - Documents

| Field | Type | Validation Rules | Description |
|-------|------|------------------|-------------|
| `documents` | array | - | Array of document metadata |
| `documents.*.document_name` | string (max: 255) | Required if documents provided | Name/type of document |
| `documents.*.reference_number` | string (max: 100) | - | Document reference number |
| `documents.*.expiry_date` | date | Valid date format | Document expiration date |
| `documents.*.regulatory_body` | string (max: 255) | - | Issuing regulatory body |
| `documents.*.other_information` | string | - | Additional document information |
| `document_images` | array | - | Array of uploaded files |
| `document_images.*` | file | Max: 5MB each | Document image/PDF files |

#### Auto-Generated Fields

| Field | Description |
|-------|-------------|
| `id` | UUID automatically generated |
| `company_id` | Set from authenticated user's company |
| `account_number` | Format: `ACC-{companyId8}-{sequential}` |
| `created_by` | Set from authenticated user |
| `created_at` | Timestamp of creation |
| `updated_at` | Timestamp of last update |

**Note:** When a customer account is created, the customer's `account_id` field is automatically updated to link to this account.

---

### Update Customer Account

**Endpoint:** `PUT /api/customer-accounts/{id}`

#### Required Fields

None (all fields are optional when updating)

#### Optional Fields - Account Information

| Field | Type | Validation Rules | Description |
|-------|------|------------------|-------------|
| `account_number` | string | Must be unique (excluding current account) | Account number |
| `registered_business_name` | string (max: 255) | Required if provided | Official business name |
| `nature_of_business` | string (max: 255) | - | Type of business |
| `certificate_of_incorporation_number` | string (max: 100) | - | Registration number |
| `pin_number` | string (max: 100) | - | Tax PIN number |
| `annual_turnover` | numeric | Min: 0 | Annual turnover |
| `credit_required` | numeric | Min: 0 | Credit limit |
| `credit_period_required` | string (max: 100) | - | Credit period |
| `currently_defaulted` | boolean | - | Default status |
| `credit_terms` | string (max: 255) | - | Credit terms |
| `notes` | string | - | Notes |

#### Optional Fields - Related Entities

When updating the following arrays, **all existing records are deleted and replaced** with the new data:

- `directors` - Same structure as create
- `authorised_purchase_persons` - Same structure as create
- `suppliers` - Same structure as create
- `bank_details` - Same structure as create

#### Optional Fields - Documents (Update Behavior)

| Field | Type | Validation Rules | Description |
|-------|------|------------------|-------------|
| `documents` | array | - | Array of document metadata |
| `documents.*.id` | string (UUID) | Must exist in documents table | If provided, updates existing document |
| `documents.*.document_name` | string (max: 255) | Required if documents provided | Document name |
| `documents.*.reference_number` | string (max: 100) | - | Reference number |
| `documents.*.expiry_date` | date | Valid date format | Expiration date |
| `documents.*.regulatory_body` | string (max: 255) | - | Regulatory body |
| `documents.*.other_information` | string | - | Additional info |
| `document_images` | array | - | Replacement files |
| `document_images.*` | file | Max: 5MB each | Document files |

**Document Update Behavior:**
- If `documents.*.id` is provided: Updates the existing document
- If `documents.*.id` is not provided: Creates a new document
- To delete documents, you need to call a separate delete endpoint

---

### Request Credit Limit Update

**Endpoint:** `POST /api/customer-accounts/{id}/request-credit-update`

This endpoint creates a pending approval request for changing the credit limit.

#### Required Fields

| Field | Type | Validation Rules | Description |
|-------|------|------------------|-------------|
| `requested_credit_limit` | numeric | Min: 0 | New credit limit amount being requested |

#### Optional Fields

| Field | Type | Validation Rules | Description |
|-------|------|------------------|-------------|
| `reason` | string (max: 500) | - | Brief reason for the change |
| `justification` | string (max: 1000) | - | Detailed justification for the change |
| `supporting_documents` | array | - | Array of document references or metadata |

#### Behavior

- Creates a pending approval record with `status: 'pending'`
- Sets `pending_credit_limit` on the account
- Stores current and new credit limit values
- Prevents multiple pending requests for the same account
- Requires approval before credit limit is actually changed

#### Auto-Generated Fields

| Field | Description |
|-------|-------------|
| `approval_id` | UUID for the approval request |
| `approval_type` | Set to 'credit_limit_update' |
| `previous_credit_limit` | Current credit limit from account |
| `new_credit_limit` | Requested credit limit |
| `created_by` | Set from authenticated user |
| `company_id` | Set from authenticated user's company |

---

## Validation Notes

### Phone Number Formatting

Phone numbers are automatically formatted:
- Removes non-digit characters
- If starts with '0', replaces with '254' (Kenya country code)
- If 9 digits, prepends '254'
- If already has 3-digit country code (254, 256, 255, 250), keeps as-is

### Email Validation

- Must be valid email format
- Must be unique across all customers in the database
- Can be null/empty
- Partial unique index ensures uniqueness only for non-empty emails

### Tags

- Stored as PostgreSQL JSONB array
- Each tag limited to 50 characters
- Empty array by default if not provided

### Currency/Decimal Fields

- All monetary amounts use `decimal(15, 2)` precision
- Must be non-negative (min: 0)
- Examples: `annual_turnover`, `credit_required`, `credit_limit`

### Document Upload Limits

- Maximum file size: 5MB (5120KB) per file
- Supported formats: Various (handled by storage service)
- Files stored via Supabase Storage Service

---

## Permission Requirements

### Customer Operations

| Operation | Required Permission |
|-----------|-------------------|
| Create Customer | `can_create_customers` |
| View Customers | `can_view_customers` |
| Update Customer | `can_update_customers` |
| Delete Customer | `can_delete_customers` |
| Create Customer Document | `can_create_documents` |

### Customer Account Operations

| Operation | Required Permission |
|-----------|-------------------|
| Create Account | `can_create_accounts` |
| View Accounts | `can_view_accounts` |
| Update Account | `can_update_accounts` |
| Delete Account | `can_delete_accounts` |
| Request Credit Update | `can_request_credit_updates` |

**Note:** Users with `can_manage_system` permission have access to all operations across all companies. Users with `can_manage_company` permission can only manage resources within their own company.

---

## Example Payloads

### Minimal Customer Creation

```json
{
  "name": "John Doe"
}
```

### Full Customer Creation

```json
{
  "name": "Acme Corporation",
  "email": "contact@acme.com",
  "phone": "0712345678",
  "status": "active",
  "customer_type": "company",
  "business_name": "Acme Corporation Ltd",
  "nature_of_business": "Manufacturing",
  "pin_number": "P051234567Z",
  "address": "123 Main Street",
  "city": "Nairobi",
  "state": "Nairobi County",
  "country": "Kenya",
  "postal_code": "00100",
  "contact_person_name": "Jane Smith",
  "contact_person_phone": "0723456789",
  "contact_person_email": "jane@acme.com",
  "preferred_communication_channel": "email",
  "payment_method": "credit",
  "tags": ["vip", "wholesale", "manufacturing"],
  "notes": "Preferred customer with monthly payment terms"
}
```

### Minimal Customer Account Creation

```json
{
  "customer_id": "123e4567-e89b-12d3-a456-426614174000"
}
```

### Full Customer Account Creation

```json
{
  "customer_id": "123e4567-e89b-12d3-a456-426614174000",
  "certificate_of_incorporation_number": "CPR/2023/12345",
  "annual_turnover": 5000000.00,
  "credit_required": 500000.00,
  "credit_period_required": "30 days",
  "currently_defaulted": false,
  "credit_terms": "Net 30 days from invoice date",
  "notes": "Approved for credit facility",
  "directors": [
    {
      "name": "John Doe",
      "id_passport_number": "12345678",
      "pin": "A012345678B",
      "phone_number": "0712345678"
    }
  ],
  "authorised_purchase_persons": [
    {
      "name": "Jane Smith",
      "phone_number": "0723456789"
    }
  ],
  "suppliers": [
    {
      "name": "ABC Supplies Ltd",
      "contact_person_name": "Bob Johnson",
      "phone_number": "0734567890",
      "credit_limit": 100000.00
    }
  ],
  "bank_details": [
    {
      "bank_name": "Kenya Commercial Bank",
      "branch": "Westlands Branch",
      "account_number": "1234567890"
    }
  ],
  "documents": [
    {
      "document_name": "Certificate of Incorporation",
      "reference_number": "CPR/2023/12345",
      "expiry_date": null,
      "regulatory_body": "Registrar of Companies",
      "other_information": "Original certificate on file"
    }
  ]
}
```

### Credit Limit Update Request

```json
{
  "requested_credit_limit": 750000.00,
  "reason": "Business expansion",
  "justification": "Customer has demonstrated consistent payment history over the past 12 months and is expanding operations to new region.",
  "supporting_documents": [
    "financial_statements_2024.pdf",
    "purchase_orders.pdf"
  ]
}
```

---

## Database Schema Summary

### Customers Table

- **Primary Key:** `id` (UUID)
- **Unique Constraints:** `email` (partial unique index for non-null values)
- **Foreign Keys:** `company_id` → `companies.id`
- **Soft Deletes:** Yes (uses `deleted_at`)
- **Indexes:** email, phone, company_id, customer_number, approval_status

### Customer Accounts Table

- **Primary Key:** `id` (UUID)
- **Unique Constraints:** `account_number`
- **Foreign Keys:** 
  - `customer_id` → `customers.id` (cascade delete)
  - `company_id` → `companies.id` (set null)
- **Soft Deletes:** No
- **Indexes:** approval_status, pending_credit_limit

---

## Status Values

### Customer Status
- `active` - Customer is active (default)
- `inactive` - Customer is inactive
- `pending` - Customer is pending approval

### Account Approval Status
- `draft` - Initial state (default)
- `pending` - Awaiting approval
- `in_progress` - Being reviewed
- `approved` - Fully approved
- `rejected` - Rejected

---

## Computed/Appended Attributes

### Customer Model

The following attributes are automatically calculated and included in API responses:

- `total_spend` - Sum of all order totals (formatted decimal)
- `total_orders` - Count of customer's orders

### Customer Account Model

The following attributes are automatically calculated and included in API responses:

- `approval_status` - Current approval status based on related approvals
- `is_approved` - Boolean indicating if approved
- `is_rejected` - Boolean indicating if rejected
- `approval_stats` - Detailed approval statistics
- `has_pending_credit_change` - Boolean indicating pending credit limit change
- `pending_credit_info` - Details of pending credit change
- `has_rejections` - Boolean indicating any rejections
- `has_multiple_approvals` - Boolean indicating multiple approvals
- `approved_by_users` - Collection of users who approved
- `rejected_by_users` - Collection of users who rejected

---

**Document Version:** 1.0  
**Last Updated:** October 27, 2025  
**Maintained By:** Cherry API Development Team
