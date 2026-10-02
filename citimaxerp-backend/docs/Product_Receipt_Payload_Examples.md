# Product Receipt Creation Payload Examples

## Complete Payload Structure

Here are comprehensive examples of payloads for creating product receipts with all available variables:

## Example 1: Complete Receipt with All Variables

```json
{
  "company_id": "550e8400-e29b-41d4-a716-446655440000",
  "store_id": "550e8400-e29b-41d4-a716-446655440001",
  "supplier_id": "550e8400-e29b-41d4-a716-446655440002",
  "contractor_id": "550e8400-e29b-41d4-a716-446655440003",
  "document_type": "receipt",
  "reference_number": "SUP-INV-2025-001",
  "received_by": "550e8400-e29b-41d4-a716-446655440004",
  "document_url": "https://example.com/documents/receipt-001.pdf",
  "items": [
    {
      "product_id": "550e8400-e29b-41d4-a716-446655440010",
      "sku": "LAPTOP-DELL-001",
      "barcode": "123456789012",
      "variant_id": "550e8400-e29b-41d4-a716-446655440011",
      "quantity": 3,
      "unit_price": 1200.00,
      "unit_cost": 1000.00,
      "expiry_date": "2027-09-11",
      "notes": "Dell Laptops with manufacturer warranties",
      "batch_number": "BATCH-DELL-2025-Q3",
      "lot_number": "LOT-DEL-092025",
      "manufacture_date": "2025-08-15",
      "supplier": "Dell Technologies",
      "supplier_id": "550e8400-e29b-41d4-a716-446655440002",
      "serial_numbers": [
        "DELL123456789",
        "DELL987654321",
        "DELL456789123"
      ],
      "warranty_months": 24
    },
    {
      "product_id": "550e8400-e29b-41d4-a716-446655440020",
      "sku": "MOUSE-LOG-001",
      "barcode": "987654321098",
      "quantity": 10,
      "unit_price": 25.00,
      "unit_cost": 18.00,
      "notes": "Logitech wireless mice",
      "batch_number": "BATCH-LOG-2025-001",
      "manufacture_date": "2025-09-01",
      "supplier": "Logitech",
      "supplier_id": "550e8400-e29b-41d4-a716-446655440005",
      "track_serials": true,
      "serial_prefix": "LOG",
      "warranty_months": 12
    },
    {
      "sku": "CABLE-USB-001",
      "barcode": "456789123456",
      "name": "USB-C Cable",
      "quantity": 50,
      "unit_price": 5.00,
      "unit_cost": 3.00,
      "notes": "Generic USB-C cables - no serial tracking needed"
    }
  ]
}
```

## Example 2: Products with Pre-existing Serial Numbers

```json
{
  "company_id": "550e8400-e29b-41d4-a716-446655440000",
  "store_id": "550e8400-e29b-41d4-a716-446655440001",
  "supplier_id": "550e8400-e29b-41d4-a716-446655440002",
  "document_type": "invoice",
  "reference_number": "APPLE-INV-2025-001",
  "received_by": "550e8400-e29b-41d4-a716-446655440004",
  "items": [
    {
      "product_id": "550e8400-e29b-41d4-a716-446655440030",
      "quantity": 5,
      "unit_price": 999.00,
      "unit_cost": 800.00,
      "serial_numbers": [
        "APPLE123456789012",
        "APPLE210987654321",
        "APPLE345678901234",
        "APPLE456789012345",
        "APPLE567890123456"
      ],
      "warranty_months": 12,
      "batch_number": "BATCH-APPLE-2025-001",
      "manufacture_date": "2025-08-20",
      "supplier": "Apple Inc.",
      "notes": "iPhone 15 Pro with Apple serial numbers"
    }
  ]
}
```

## Example 3: Auto-generated Serial Numbers

```json
{
  "company_id": "550e8400-e29b-41d4-a716-446655440000",
  "store_id": "550e8400-e29b-41d4-a716-446655440001",
  "document_type": "delivery_note",
  "reference_number": "DELIVERY-2025-001",
  "received_by": "550e8400-e29b-41d4-a716-446655440004",
  "items": [
    {
      "sku": "WIDGET-001",
      "name": "Industrial Widget",
      "quantity": 20,
      "unit_price": 50.00,
      "unit_cost": 35.00,
      "track_serials": true,
      "serial_prefix": "WDG",
      "warranty_months": 6,
      "batch_number": "BATCH-WDG-2025-001",
      "lot_number": "LOT-WDG-092025",
      "manufacture_date": "2025-09-05",
      "notes": "Custom widgets requiring serial tracking"
    }
  ]
}
```

## Example 4: Minimal Required Fields

```json
{
  "store_id": "550e8400-e29b-41d4-a716-446655440001",
  "document_type": "receipt",
  "received_by": "550e8400-e29b-41d4-a716-446655440004",
  "items": [
    {
      "sku": "SIMPLE-001",
      "name": "Simple Product",
      "quantity": 1,
      "unit_price": 10.00
    }
  ]
}
```

## Field Descriptions

### **Receipt Level Fields**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `company_id` | UUID | Optional | Defaults to authenticated user's company |
| `store_id` | UUID | **Required** | Store receiving the products |
| `supplier_id` | UUID | Optional | Supplier providing the products |
| `contractor_id` | UUID | Optional | Contractor involved in delivery |
| `document_type` | String | **Required** | One of: `receipt`, `invoice`, `delivery_note`, `notification_note` |
| `reference_number` | String | Optional | External reference (invoice number, etc.) |
| `received_by` | UUID | **Required** | User receiving the products |
| `document_url` | String | Optional | URL to uploaded document |

### **Item Level Fields**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `product_id` | UUID | Optional | Existing product ID |
| `sku` | String | Optional | Product SKU (used to find/create product) |
| `barcode` | String | Optional | Product barcode |
| `name` | String | Optional | Product name (for auto-creation) |
| `variant_id` | UUID | Optional | Product variant ID |
| `quantity` | Integer | **Required** | Number of units received |
| `unit_price` | Decimal | Optional | Selling price per unit |
| `unit_cost` | Decimal | Optional | Cost price per unit |
| `expiry_date` | Date | Optional | Product expiry date |
| `notes` | String | Optional | Item-specific notes |

### **Batch Tracking Fields**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `batch_number` | String | Optional | Inventory batch number |
| `lot_number` | String | Optional | Manufacturing lot number |
| `manufacture_date` | Date | Optional | When the product was manufactured |
| `supplier` | String | Optional | Supplier name for this item |
| `supplier_id` | UUID | Optional | Supplier ID for this item |

### **Serial Number Fields**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `serial_numbers` | Array | Optional | Pre-existing serial numbers |
| `track_serials` | Boolean | Optional | Enable auto-generation of serials |
| `serial_prefix` | String | Optional | Prefix for auto-generated serials |
| `warranty_months` | Integer | Optional | Warranty period in months |

## Validation Rules

### **Serial Number Validation**
- If `serial_numbers` provided, count must match `quantity`
- No duplicate serial numbers within the same batch
- Serial numbers must be unique across the entire system
- If `track_serials: true` and no `serial_numbers`, serials are auto-generated

### **Product Creation**
- If `product_id` not provided, system will search by `sku` or `barcode`
- If product not found, new product is auto-created using provided fields
- Auto-created products use `company_id` and `store_id` from receipt

### **Batch Creation**
- Batches are created when `batch_number` or `lot_number` is provided
- If `batch_number` not provided but `lot_number` is, batch number is auto-generated
- Batches track quantities and link to the receipt

## Response Format

### **Success Response**
```json
{
  "status": "success",
  "message": "Product receipt created successfully.",
  "receipts": [
    {
      "id": "receipt-uuid",
      "product_receipt_number": "RCPT-12345678-0001",
      "company_id": "company-uuid",
      "store_id": "store-uuid",
      "supplier_id": "supplier-uuid",
      "document_type": "receipt",
      "reference_number": "REF-001",
      "received_by": "user-uuid",
      "document_url": "https://example.com/document.pdf",
      "created_at": "2025-09-11T10:30:00Z",
      "updated_at": "2025-09-11T10:30:00Z",
      "product_receipt_items": [
        {
          "id": "item-uuid",
          "product_id": "product-uuid",
          "variant_id": null,
          "quantity": 3,
          "unit_price": 1200.00,
          "batch_number": "BATCH-001",
          "lot_number": "LOT-001",
          "manufacture_date": "2025-08-15",
          "expiry_date": "2027-09-11",
          "notes": "Product notes"
        }
      ]
    }
  ]
}
```

### **Error Response**
```json
{
  "status": "failed",
  "message": "Product 'Dell Laptop': Serial numbers count (2) must match quantity (3)",
  "errors": {
    "items.0.serial_numbers": [
      "Serial count must match quantity"
    ]
  }
}
```

## Integration Notes

1. **File Upload**: Use `multipart/form-data` when uploading documents
2. **Batch Processing**: Wrap multiple receipts in `receipts` array for batch creation
3. **Auto-creation**: Products, variants, and batches are created automatically when not found
4. **Inventory Update**: Stock quantities are automatically updated for products/variants
5. **Serial Tracking**: Complete individual unit tracking with batch linking and warranty management
