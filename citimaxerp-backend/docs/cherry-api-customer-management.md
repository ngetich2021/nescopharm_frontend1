# Cherry API - Customer Management Documentation

## 1. Customer Endpoints

### Create Customer
- **POST** `/api/customers`
- **Headers**: `Authorization: Bearer {token}`, `Content-Type: application/json`
- **Payload:**
```json
{
  "name": "Acme Ltd",                // required
  "email": "acme@example.com",        // optional
  "phone": "0712345678",             // optional
  "status": "active",                // optional (default: active)
  "company": "Acme Group",           // optional
  "address": "123 Main St",          // optional
  "city": "Nairobi",                 // optional
  "state": "Nairobi",                // optional
  "country": "Kenya",                // optional
  "postal_code": "00100",            // optional
  "notes": "Preferred customer",     // optional
  "tags": ["VIP", "Retail"],        // optional
  "preferred_communication_channel": "email", // optional
  "last_contact_date": "2025-09-01", // optional
  "customer_type": "company",        // required
  "payment_method": "cash",          // optional (default: cash)
  "contact_person_name": "John Doe", // optional
  "contact_person_phone": "0712345678", // optional
  "contact_person_email": "john.doe@acme.com", // optional
  "business_name": "Acme Ltd",       // optional
  "nature_of_business": "Retail",    // optional
  "pin_number": "P123456",           // optional
}
```
- **Sample Response:**
```json
{
  "status": "success",
  "message": "Customer created successfully.",
  "customer": {
    "id": "uuid",
    "company_id": "uuid",
    "customer_number": "CUST-096aa481-0001",
    "name": "Acme Ltd",
    "email": "acme@example.com",
    "phone": "254712345678",
    "status": "active",
    "company": "Acme Group",
    "address": "123 Main St",
    "city": "Nairobi",
    "state": "Nairobi",
    "country": "Kenya",
    "postal_code": "00100",
    "notes": "Preferred customer",
    "tags": ["VIP", "Retail"],
    "preferred_communication_channel": "email",
    "last_contact_date": "2025-09-01",
    "customer_type": "company",
    "payment_method": "cash",
    "contact_person_name": "John Doe",
    "contact_person_phone": "254712345678",
    "contact_person_email": "john.doe@acme.com",
    "business_name": "Acme Ltd",
    "nature_of_business": "Retail",
    "pin_number": "P123456",
    "timestamp": "2025-09-05T10:00:00Z",
    "created_by": "uuid"
  }
}
```

---

## 2. Customer Account Endpoints

### Create Customer Account
- **POST** `/api/customer-accounts`
- **Headers**: `Authorization: Bearer {token}`, `Content-Type: application/json`
- **Payload:**
```json
{
  "customer_id": "uuid",                       // required
  "certificate_of_incorporation_number": "C123456", // optional
  "company_type": "Limited",                   // optional
  "annual_turnover": 1000000,                   // optional
  "credit_required": 50000,                     // optional
  "credit_period_required": "30 days",         // optional
  "currently_defaulted": false,                 // optional (default: false)
  "credit_terms": "Net 30",                    // optional
  "notes": "Preferred customer",               // optional
  "directors": [                                // optional
    {
      "name": "John Doe",                      // required if directors present
      "id_passport_number": "A1234567",        // required if directors present
      "pin": "D123456",                        // optional
      "phone_number": "0712345678"             // optional
    }
  ],
  "authorised_purchase_persons": [              // optional
    {
      "name": "Jane Smith",                    // required if present
      "phone_number": "0723456789"             // optional
    }
  ],
  "suppliers": [                                // optional
    {
      "name": "Supplier Inc",                  // required if present
      "contact_person_name": "Mike Brown",     // optional
      "phone_number": "0734567890",            // optional
      "credit_limit": 20000                     // optional
    }
  ],
  "bank_details": [                             // optional
    {
      "bank_name": "Bank of Africa",           // required if present
      "branch": "Westlands",                   // optional
      "account_number": "1234567890"           // optional
    }
  ]
}
```
- **Sample Response:**
```json
{
  "status": "success",
  "message": "Customer account created successfully.",
  "data": {
    "id": "uuid",
    "customer_id": "uuid",
    "company_id": "uuid",
    "account_number": "ACC-096aa481-0001",
    "certificate_of_incorporation_number": "C123456",
    "company_type": "Limited",
    "annual_turnover": 1000000,
    "credit_required": 50000,
    "credit_period_required": "30 days",
    "currently_defaulted": false,
    "credit_terms": "Net 30",
    "notes": "Preferred customer",
    "directors": [
      {
        "name": "John Doe",
        "id_passport_number": "A1234567",
        "pin": "D123456",
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
        "name": "Supplier Inc",
        "contact_person_name": "Mike Brown",
        "phone_number": "0734567890",
        "credit_limit": 20000
      }
    ],
    "bank_details": [
      {
        "bank_name": "Bank of Africa",
        "branch": "Westlands",
        "account_number": "1234567890"
      }
    ],
    "created_by": "uuid"
  }
}
```

---

## 3. Document Endpoints

### Upload Document
- **POST** `/api/documents`
- **Headers**: `Authorization: Bearer {token}`
- **Payload (form-data):**
  - `document_name`: string (required)
  - `reference_number`: string (optional)
  - `expiry_date`: date (optional)
  - `regulatory_body`: string (optional)
  - `documentable_type`: string (required)
  - `documentable_id`: uuid (required)
  - `other_information`: string (optional)
  - `document_image`: file (any type, max 5MB) (optional)
- **Sample Response:**
```json
{
  "status": "success",
  "message": "Document created successfully.",
  "data": {
    "id": "uuid",
    "document_name": "Business License",
    "document_number": "DOC-096aa481-0001",
    "reference_number": "REF-12345",
    "expiry_date": "2025-12-31",
    "regulatory_body": "Regulatory Authority",
    "document_image": "https://...",
    "documentable_type": "App\\Models\\Customer",
    "documentable_id": "uuid",
    "company_id": "uuid",
    "created_by": "uuid",
    "other_information": "Additional info about the document"
  }
}
```

---

## 4. Customer Account Approval Endpoints

### Approve Customer Account
- **POST** `/api/customer-account-approvals`
- **Headers**: `Authorization: Bearer {token}`, `Content-Type: application/json`
- **Payload:**
```json
{
  "customer_account_id": "uuid",    // required
  "approved_by": "uuid",            // required
  "approval_status": "approved",    // required
  "approval_notes": "All documents verified." // optional
}
```
- **Sample Response:**
```json
{
  "status": "success",
  "message": "Customer account approved successfully.",
  "data": {
    "id": "uuid",
    "customer_account_id": "uuid",
    "approved_by": "uuid",
    "approval_status": "approved",
    "approval_notes": "All documents verified."
  }
}
```

---

## Notes
- All endpoints require authentication (`Bearer {token}`).
- All UUIDs must be valid and exist in the database.
- For file uploads, use `multipart/form-data` encoding.
- All responses include a `status` and `message` field for easy frontend handling.

---

For any additional details or custom queries, refer to the backend team or API source code.
