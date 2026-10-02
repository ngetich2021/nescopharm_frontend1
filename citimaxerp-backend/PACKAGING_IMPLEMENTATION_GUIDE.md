# Packaging Implementation Guide

## Overview
This guide documents the implementation of packaging-aware quote and order management in the Cherry API.

## What Was Implemented

### 1. **QuoteController Updates**
- ✅ Injected `PackagingCalculatorService` for packaging calculations
- ✅ Updated validation to accept `unit_id` as optional field in quote items
- ✅ Changed `quantity` validation from `integer` to `numeric` (supports decimals like 2.5 cartons)
- ✅ Added automatic packaging breakdown calculation
- ✅ Enhanced responses to include `sellablePackagingUnits` and `packagingUnit` relationships

### 2. **OrderController Updates**
- ✅ Injected `PackagingCalculatorService` for packaging calculations
- ✅ Updated validation to accept `unit_id` as optional field in order items
- ✅ Changed `quantity` validation from `integer` to `numeric` (supports decimals)
- ✅ Added automatic packaging breakdown calculation
- ✅ Enhanced responses to include packaging unit information

## API Usage Examples

### Creating a Quote with Packaging Units

**Endpoint:** `POST /api/quotes`

#### Example 1: Order by Carton
```json
{
  "customer_id": "customer-uuid",
  "status": "pending",
  "valid_until": "2025-12-31",
  "items": [
    {
      "product_id": "product-uuid",
      "unit_id": "carton-unit-uuid",
      "quantity": 2.5,
      "unit_price": 5000
    }
  ]
}
```

**What happens:**
- User orders 2.5 cartons at 5000 per carton
- System calculates `base_quantity` (e.g., 2.5 × 24 = 60 bottles)
- System generates `packaging_breakdown`: "2 Cartons + 12 Bottles"
- Stores: `unit_id`, `unit_quantity: 2.5`, `base_quantity: 60`, `packaging_breakdown`

#### Example 2: Order in Base Units (No unit_id)
```json
{
  "customer_id": "customer-uuid",
  "status": "pending",
  "valid_until": "2025-12-31",
  "items": [
    {
      "product_id": "product-uuid",
      "quantity": 150,
      "unit_price": 60
    }
  ]
}
```

**What happens:**
- User orders 150 pieces (base units)
- If product has packaging, system still calculates breakdown: "1 Carton + 5 Boxes"
- Stores: `unit_id: null`, `base_quantity: 150`, `packaging_breakdown`

### Quote Response with Packaging

```json
{
  "status": "success",
  "quote": {
    "id": "quote-uuid",
    "quote_number": "QUO-12345678-0001",
    "quoteItems": [
      {
        "id": "item-uuid",
        "product_id": "product-uuid",
        "unit_id": "carton-unit-uuid",
        "quantity": 2.5,
        "unit_quantity": 2.5,
        "base_quantity": 60,
        "packaging_breakdown": {
          "total_base_quantity": 60,
          "breakdown": [
            {
              "unit_name": "Carton",
              "unit_abbreviation": "CTN",
              "quantity": 2,
              "base_unit_quantity": 24
            },
            {
              "unit_name": "Bottle",
              "unit_abbreviation": "BTL",
              "quantity": 12,
              "base_unit_quantity": 1
            }
          ],
          "display_text": "2 CTN + 12 BTL"
        },
        "unit_price": 5000,
        "total_price": 12500,
        "product": {
          "id": "product-uuid",
          "name": "Coca Cola 500ml",
          "has_packaging": true,
          "base_unit": "bottle",
          "sellablePackagingUnits": [
            {
              "id": "carton-unit-uuid",
              "unit_name": "Carton",
              "unit_abbreviation": "CTN",
              "base_unit_quantity": 24,
              "price_per_unit": 5000,
              "is_base_unit": false,
              "is_sellable": true
            },
            {
              "id": "pack-unit-uuid",
              "unit_name": "Pack",
              "unit_abbreviation": "PK",
              "base_unit_quantity": 6,
              "price_per_unit": 1200,
              "is_base_unit": false,
              "is_sellable": true
            },
            {
              "id": "bottle-unit-uuid",
              "unit_name": "Bottle",
              "unit_abbreviation": "BTL",
              "base_unit_quantity": 1,
              "price_per_unit": 60,
              "is_base_unit": true,
              "is_sellable": true
            }
          ]
        },
        "packagingUnit": {
          "id": "carton-unit-uuid",
          "unit_name": "Carton",
          "unit_abbreviation": "CTN",
          "base_unit_quantity": 24,
          "price_per_unit": 5000
        }
      }
    ]
  }
}
```

### Getting Quote Details

**Endpoint:** `GET /api/quotes/{quoteId}`

**Response includes:**
- Product details with `sellablePackagingUnits` (all available units for ordering)
- Quote item with selected `packagingUnit` (the unit customer chose)
- `packaging_breakdown` for fulfillment/dispatch view

### Creating Orders Directly

**Endpoint:** `POST /api/orders`

Same structure as quotes:
```json
{
  "customer_id": "customer-uuid",
  "status": "pending",
  "payment_status": "unpaid",
  "items": [
    {
      "product_id": "product-uuid",
      "unit_id": "box-unit-uuid",
      "quantity": 5,
      "unit_price": 550
    }
  ]
}
```

### Converting Quote to Order

**Endpoint:** `POST /api/quotes/{quoteId}/convert-to-order`

**What happens:**
- All packaging data transfers from quote items to order items
- `unit_id`, `unit_quantity`, `base_quantity`, `packaging_breakdown` preserved
- Order response includes packaging information

## Frontend Integration Guide

### Step 1: Fetch Product with Packaging Units

When displaying products for selection:
```javascript
// GET /api/products/{productId}
const product = await fetchProduct(productId);

if (product.has_packaging) {
  // Display packaging unit selector
  const units = product.sellablePackagingUnits;
  // Show dropdown: Carton, Box, Piece, etc.
}
```

### Step 2: User Selects Unit and Quantity

```javascript
const selectedUnit = units.find(u => u.id === selectedUnitId);
const quantity = 2.5; // User input

// Show price preview
const totalPrice = quantity * selectedUnit.price_per_unit;

// Optionally preview breakdown
const baseQty = quantity * selectedUnit.base_unit_quantity;
// Call: POST /api/products/{productId}/packaging/calculate-breakdown
// With: { base_quantity: baseQty }
```

### Step 3: Submit Quote/Order

```javascript
const quoteData = {
  customer_id: customerId,
  status: 'pending',
  valid_until: '2025-12-31',
  items: [
    {
      product_id: productId,
      unit_id: selectedUnitId,     // Optional
      quantity: quantity,           // Can be decimal
      unit_price: unitPrice
    }
  ]
};

// POST /api/quotes
const quote = await createQuote(quoteData);
```

### Step 4: Display Packaging Information

```javascript
// In quote/order view
quoteItems.forEach(item => {
  if (item.packagingUnit) {
    // Show: "2.5 Cartons"
    console.log(`${item.unit_quantity} ${item.packagingUnit.unit_abbreviation}`);
  }
  
  if (item.packaging_breakdown) {
    // Show: "2 CTN + 12 BTL"
    console.log(item.packaging_breakdown.display_text);
  }
  
  // For warehouse/dispatch
  item.packaging_breakdown.breakdown.forEach(b => {
    console.log(`${b.quantity} ${b.unit_abbreviation}`);
  });
});
```

## Database Fields Reference

### QuoteItem / OrderItem Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `unit_id` | UUID (nullable) | Selected packaging unit | "carton-uuid" |
| `quantity` | Decimal | Original quantity entered | 2.5 |
| `unit_quantity` | Decimal (nullable) | Same as quantity when unit selected | 2.5 |
| `base_quantity` | Integer (nullable) | Converted to base units | 60 |
| `packaging_breakdown` | JSONB (nullable) | Smart breakdown for display | See above |
| `unit_price` | Decimal | Price per unit | 5000 |
| `total_price` | Decimal | quantity × unit_price | 12500 |

## Key Features

### 1. **Flexible Unit Selection**
- Users can order in any sellable unit (Carton, Box, Piece, etc.)
- Each line item can have different units
- Example: 2 Cartons of Product A + 15 Pieces of Product B

### 2. **Automatic Calculations**
- System converts to base units for inventory validation
- Generates smart breakdown for fulfillment
- Example: 2.5 Cartons = "2 CTN + 12 BTL"

### 3. **Multiple Display Options**
Frontend can show:
- **Entry view:** "2.5 Cartons" (what user ordered)
- **Breakdown view:** "2 CTN + 12 BTL" (for picking)
- **Base view:** "60 Bottles" (total pieces)

### 4. **Backward Compatibility**
- If `unit_id` is not provided, works like before
- Existing quotes/orders without packaging continue to work
- Gradual migration possible

### 5. **Price Flexibility**
- Units can have specific prices (recommended)
- Or auto-calculated from base price
- Example: Carton price = 5000, or auto: 60 × 24 = 1440

## Business Use Cases

### Use Case 1: Retail Order
Customer orders: **3 Cartons of Coca Cola**
- Entered: 3 × Carton @ 5,000 = 15,000
- Stored: `unit_id=carton, quantity=3, base_quantity=72`
- Display: "3 CTN" or "72 Bottles"
- Warehouse sees: "3 Cartons"

### Use Case 2: Mixed Order
Customer orders:
- 2 Cartons of Product A
- 1 Box of Product A
- 15 Pieces of Product A

Each item stored with its own unit_id and breakdown.

### Use Case 3: Partial Unit
Customer orders: **2.5 Cartons**
- Entered: 2.5 × Carton @ 5,000 = 12,500
- Breakdown: "2 CTN + 12 BTL"
- Warehouse picks: 2 full cartons + 12 loose bottles

## Testing Checklist

- [ ] Create quote with packaging units
- [ ] Create quote without packaging (backward compatibility)
- [ ] Update quote items with packaging
- [ ] View quote with packaging details
- [ ] Convert quote to order (preserves packaging)
- [ ] Create order directly with packaging
- [ ] View order with packaging breakdown
- [ ] Test decimal quantities (2.5 cartons)
- [ ] Test products without packaging enabled
- [ ] Verify packaging breakdown display text

## Migration Notes

### For Existing Data
- Existing quotes/orders without packaging data will work fine
- `unit_id`, `unit_quantity`, `base_quantity`, `packaging_breakdown` are nullable
- Frontend should handle null values gracefully

### For New Products
1. Enable packaging: `has_packaging = true`
2. Set base unit: `base_unit = 'piece'`
3. Create packaging units via `/api/products/{id}/packaging/setup`
4. Mark units as sellable: `is_sellable = true`

## Support

For questions or issues, check:
- `PackagingCalculatorService` - Breakdown calculations
- `ProductPackagingService` - Unit management
- `ProductPackagingController` - Packaging API endpoints
- Models: `QuoteItem`, `OrderItem`, `ProductPackagingUnit`
