# Serial Number Handling Examples

## Overview
The system now supports three different scenarios for serial number tracking:

1. **Products with Pre-existing Serial Numbers** (from manufacturer/supplier)
2. **Products requiring Auto-generated Serial Numbers** 
3. **Mixed scenarios** (some items with serials, some without)

## Scenario 1: Products with Pre-existing Serial Numbers

When products come with manufacturer serial numbers (e.g., electronics, equipment):

```json
{
  "product_receipt_number": "PR-2025-001",
  "company_id": "company-uuid",
  "store_id": "store-uuid",
  "supplier_id": "supplier-uuid",
  "received_by": "user-uuid",
  "receipt_date": "2025-09-11",
  "items": [
    {
      "product_id": "laptop-product-uuid",
      "quantity": 3,
      "unit_price": 1200.00,
      "serial_numbers": [
        "DELL123456789",
        "DELL987654321", 
        "DELL456789123"
      ],
      "warranty_months": 24,
      "batch_number": "BATCH-DELL-2025-Q3",
      "notes": "Dell Laptops with manufacturer serials"
    }
  ]
}
```

**Key Points:**
- ✅ `serial_numbers` array must match `quantity` (3 serials for 3 units)
- ✅ System validates no duplicate serials in the batch
- ✅ System checks if serials already exist in database
- ✅ Each serial is linked to the inventory batch
- ✅ Warranty expiry calculated automatically

## Scenario 2: Auto-generated Serial Numbers

When products need tracking but don't have pre-existing serials:

```json
{
  "product_receipt_number": "PR-2025-002",
  "company_id": "company-uuid",
  "store_id": "store-uuid",
  "supplier_id": "supplier-uuid", 
  "received_by": "user-uuid",
  "receipt_date": "2025-09-11",
  "items": [
    {
      "product_id": "widget-product-uuid",
      "quantity": 5,
      "unit_price": 25.00,
      "track_serials": true,
      "serial_prefix": "WDG",
      "warranty_months": 12,
      "batch_number": "BATCH-WDG-2025-001"
    }
  ]
}
```

**Generated Serials Example:**
- `WDG-250911-0001`
- `WDG-250911-0002` 
- `WDG-250911-0003`
- `WDG-250911-0004`
- `WDG-250911-0005`

## Scenario 3: Mixed Receipt

Some products with existing serials, some requiring generation:

```json
{
  "product_receipt_number": "PR-2025-003",
  "company_id": "company-uuid",
  "store_id": "store-uuid",
  "supplier_id": "supplier-uuid",
  "received_by": "user-uuid", 
  "receipt_date": "2025-09-11",
  "items": [
    {
      "product_id": "iphone-product-uuid",
      "quantity": 2,
      "unit_price": 999.00,
      "serial_numbers": [
        "APPLE123456789012",
        "APPLE210987654321"
      ],
      "warranty_months": 12,
      "notes": "iPhones with Apple serials"
    },
    {
      "product_id": "cable-product-uuid", 
      "quantity": 10,
      "unit_price": 15.00,
      "track_serials": true,
      "serial_prefix": "CBL",
      "warranty_months": 6,
      "notes": "Generic cables - auto-generate serials"
    },
    {
      "product_id": "basic-item-uuid",
      "quantity": 50,
      "unit_price": 2.00,
      "notes": "No serial tracking needed"
    }
  ]
}
```

## Validation Rules

### For Pre-existing Serials:
1. **Quantity Match**: `serial_numbers` count must equal `quantity`
2. **No Duplicates**: No duplicate serials within the same batch
3. **Uniqueness**: Serials must not exist in database already
4. **Format**: Serials are trimmed of whitespace

### For Auto-generated Serials:
1. **Flag Required**: `track_serials: true` must be set
2. **Prefix Optional**: Defaults to first 3 letters of product name
3. **Format**: `PREFIX-YYMMDD-NNNN` (e.g., `PRD-250911-0001`)

### Error Examples:

**Quantity Mismatch:**
```json
{
  "status": "failed",
  "message": "Product 'Dell Laptop': Serial numbers count (2) must match quantity (3)"
}
```

**Duplicate Serials:**
```json
{
  "status": "failed", 
  "message": "Product 'Dell Laptop': Duplicate serial numbers found: DELL123456789"
}
```

**Existing Serials:**
```json
{
  "status": "failed",
  "message": "Product 'Dell Laptop': Serial numbers already exist: DELL123456789, DELL987654321"
}
```

## Database Structure

Each serial number creates an `InventorySerial` record with:

```sql
- id (UUID)
- company_id
- store_id  
- product_id
- variant_id (nullable)
- batch_id (links to InventoryBatch if applicable)
- serial_number (unique identifier)
- barcode (nullable)
- status ('active', 'sold', 'damaged', etc.)
- unit_cost
- unit_price
- received_date
- warranty_expiry_date (calculated from warranty_months)
- purchase_reference (receipt number)
- notes
- created_by
```

## Best Practices

1. **Always validate serial numbers** before receipt processing
2. **Use meaningful prefixes** for auto-generated serials
3. **Include warranty information** when available
4. **Link to batches** for better inventory tracking
5. **Handle errors gracefully** with clear error messages

This system provides complete flexibility for handling any combination of serial number scenarios in your warehouse operations.
