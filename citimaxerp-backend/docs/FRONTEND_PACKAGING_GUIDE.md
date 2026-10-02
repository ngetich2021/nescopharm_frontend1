# Frontend Packaging Implementation Guide

## Overview
Users can now order products in different packaging units (Cartons, Boxes, Pieces) instead of only pieces. The system automatically calculates smart breakdowns for warehouse fulfillment.

## What This Achieves
- ✅ **Flexible Ordering**: Users order by Carton, Box, or Piece
- ✅ **Decimal Quantities**: Accept "2.5 Cartons"
- ✅ **Smart Breakdown**: "2.5 Cartons" → "2 CTN + 12 BTL"
- ✅ **Mixed Units**: Different products can use different units in same quote/order
- ✅ **Unit-Based Pricing**: Each unit (Carton/Box/Piece) has its own price

---

---

## Process Flow

### Flow 1: Creating a Quote/Order with Packaging

```
1. Fetch Product → 2. Show Unit Selector → 3. User Selects Unit & Quantity → 4. Submit Quote/Order → 5. Display Results
```

#### Step 1: Fetch Product with Packaging Units

**Endpoint:** `GET /api/products/{productId}`

**Sample Response:**
```json
{
  "id": "prod-123",
  "name": "Coca Cola 500ml",
  "price": 60,
  "has_packaging": true,
  "base_unit": "bottle",
  "sellablePackagingUnits": [
    {
      "id": "unit-carton",
      "unit_name": "Carton",
      "unit_abbreviation": "CTN",
      "base_unit_quantity": 24,
      "price_per_unit": 1400,
      "is_base_unit": false,
      "display_order": 1
    },
    {
      "id": "unit-pack",
      "unit_name": "Pack",
      "unit_abbreviation": "PK",
      "base_unit_quantity": 6,
      "price_per_unit": 350,
      "is_base_unit": false,
      "display_order": 2
    },
    {
      "id": "unit-bottle",
      "unit_name": "Bottle",
      "unit_abbreviation": "BTL",
      "base_unit_quantity": 1,
      "price_per_unit": 60,
      "is_base_unit": true,
      "display_order": 3
    }
  ]
}
```

**What to do:**
- Check `has_packaging` flag
- If `true` and `sellablePackagingUnits` exists → Show unit selector dropdown
- If `false` → Show regular quantity input (pieces only)

---

#### Step 2: (Optional) Preview Packaging Breakdown

**Endpoint:** `POST /api/products/{productId}/packaging/calculate-breakdown`

**Payload:**
```json
{
  "base_quantity": 60
}
```
*Note: `base_quantity = user_quantity × selected_unit.base_unit_quantity`*  
*Example: 2.5 Cartons × 24 = 60 bottles*

**Sample Response:**
```json
{
  "status": "success",
  "data": {
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
  }
}
```

**What to do:**
- Show `display_text` to user: "2 CTN + 12 BTL"
- This helps users understand how their order will be packed

---

#### Step 3: Create Quote

**Endpoint:** `POST /api/quotes`

**Payload:**
```json
{
  "customer_id": "customer-uuid",
  "status": "pending",
  "valid_until": "2025-12-31",
  "currency": "KES",
  "items": [
    {
      "product_id": "prod-123",
      "unit_id": "unit-carton",
      "quantity": 2.5,
      "unit_price": 1400
    }
  ]
}
```

**Key Changes:**
- `unit_id`: **NEW** - ID of selected packaging unit (optional, can be null)
- `quantity`: **CHANGED** - Now accepts decimals (was integer)
- `unit_price`: Price per selected unit

**Sample Response:**
```json
{
  "status": "success",
  "message": "Quote created successfully.",
  "quote": {
    "id": "quote-789",
    "quote_number": "QUO-12345678-0001",
    "total_amount": 3500,
    "final_amount": 3500,
    "status": "pending",
    "quoteItems": [
      {
        "id": "item-001",
        "product_id": "prod-123",
        "unit_id": "unit-carton",
        "quantity": 2.5,
        "unit_quantity": 2.5,
        "base_quantity": 60,
        "packaging_breakdown": {
          "total_base_quantity": 60,
          "breakdown": [
            {
              "unit_name": "Carton",
              "unit_abbreviation": "CTN",
              "quantity": 2
            },
            {
              "unit_name": "Bottle",
              "unit_abbreviation": "BTL",
              "quantity": 12
            }
          ],
          "display_text": "2 CTN + 12 BTL"
        },
        "unit_price": 1400,
        "total_price": 3500,
        "product": {
          "id": "prod-123",
          "name": "Coca Cola 500ml",
          "has_packaging": true,
          "sellablePackagingUnits": [...]
        },
        "packagingUnit": {
          "id": "unit-carton",
          "unit_name": "Carton",
          "unit_abbreviation": "CTN",
          "base_unit_quantity": 24,
          "price_per_unit": 1400
        }
      }
    ]
  }
}
```

**Response Fields Explained:**
- `unit_id`: Which unit was selected
- `quantity`: Original quantity entered (2.5)
- `unit_quantity`: Same as quantity when unit selected
- `base_quantity`: Converted to base units (60 bottles)
- `packaging_breakdown`: Smart breakdown for display/fulfillment
- `packagingUnit`: Details of selected unit
- `product.sellablePackagingUnits`: Available units for this product

---

#### Step 4: View Quote Details

**Endpoint:** `GET /api/quotes/{quoteId}`

**Sample Response:**
```json
{
  "status": "success",
  "quote": {
    "id": "quote-789",
    "quote_number": "QUO-12345678-0001",
    "quoteItems": [
      {
        "id": "item-001",
        "quantity": 2.5,
        "unit_quantity": 2.5,
        "base_quantity": 60,
        "packaging_breakdown": {
          "display_text": "2 CTN + 12 BTL"
        },
        "unit_price": 1400,
        "total_price": 3500,
        "packagingUnit": {
          "unit_name": "Carton",
          "unit_abbreviation": "CTN"
        },
        "product": {
          "name": "Coca Cola 500ml",
          "sellablePackagingUnits": [...]
        }
      }
    ]
  }
}
```

**What to display:**
- **Simple view**: `2.5 CTN @ KES 1,400 = KES 3,500`
- **Detailed view**: `2.5 Cartons (2 CTN + 12 BTL) @ KES 1,400`
- **Warehouse view**: `Pack as: 2 Cartons + 12 Bottles`

---

### Flow 2: Creating an Order Directly

**Endpoint:** `POST /api/orders`

**Payload:** (Same structure as quotes)
```json
{
  "customer_id": "customer-uuid",
  "status": "pending",
  "payment_status": "unpaid",
  "items": [
    {
      "product_id": "prod-123",
      "unit_id": "unit-pack",
      "quantity": 5,
      "unit_price": 350
    }
  ]
}
```

**Sample Response:** (Similar to quote response)
```json
{
  "status": "success",
  "message": "Order created successfully.",
  "order": {
    "id": "order-456",
    "order_number": "ORD-12345678-0001",
    "orderItems": [
      {
        "id": "item-002",
        "unit_id": "unit-pack",
        "quantity": 5,
        "unit_quantity": 5,
        "base_quantity": 30,
        "packaging_breakdown": {
          "display_text": "5 PK"
        },
        "unit_price": 350,
        "total_price": 1750,
        "packagingUnit": {
          "unit_name": "Pack",
          "unit_abbreviation": "PK"
        }
      }
    ]
  }
}
```

---

### Flow 3: Converting Quote to Order

**Endpoint:** `POST /api/quotes/{quoteId}/convert-to-order`

**Payload:**
```json
{
  "delivery_location_id": "location-uuid",
  "delivery_instructions": "Call before delivery"
}
```

**Sample Response:**
```json
{
  "status": "success",
  "message": "Quote converted to order successfully.",
  "order": {
    "id": "order-789",
    "order_number": "ORD-12345678-0002",
    "orderItems": [
      {
        "unit_id": "unit-carton",
        "quantity": 2.5,
        "unit_quantity": 2.5,
        "base_quantity": 60,
        "packaging_breakdown": {
          "display_text": "2 CTN + 12 BTL"
        },
        "packagingUnit": {
          "unit_name": "Carton",
          "unit_abbreviation": "CTN"
        }
      }
    ]
  }
}
```

**What happens:**
- All packaging data transfers from quote to order
- `unit_id`, `unit_quantity`, `base_quantity`, `packaging_breakdown` preserved

---

### Flow 4: Updating a Quote

**Endpoint:** `PUT /api/quotes/{quoteId}`

**Payload:**
```json
{
  "items": [
    {
      "id": "existing-item-uuid",
      "product_id": "prod-123",
      "unit_id": "unit-bottle",
      "quantity": 100,
      "unit_price": 60
    }
  ]
}
```

**What happens:**
- Can change unit (from Carton to Bottle)
- System recalculates `base_quantity` and `packaging_breakdown`

---

## Displaying Data

### Display Options

**1. Simple Display (Order Entry)**
```
Coca Cola 500ml
2.5 CTN @ KES 1,400 = KES 3,500
```

**2. Detailed Display (Quote/Order View)**
```
Coca Cola 500ml
Quantity: 2.5 Cartons
Breakdown: 2 CTN + 12 BTL (60 bottles total)
Price: KES 1,400 per Carton
Total: KES 3,500
```

**3. Warehouse Display (Fulfillment)**
```
Coca Cola 500ml
Pick and pack:
  ☐ 2 Cartons (24 bottles each)
  ☐ 12 Loose bottles
Total: 60 bottles
```

### Using the Response Data

```javascript
// Get display text
const displayQty = item.packagingUnit 
  ? `${item.unit_quantity} ${item.packagingUnit.unit_abbreviation}`
  : `${item.quantity} PCS`;

// Get breakdown
const breakdown = item.packaging_breakdown?.display_text || '';

// Get total pieces
const totalPieces = item.base_quantity;

// Display examples:
console.log(displayQty);        // "2.5 CTN"
console.log(breakdown);          // "2 CTN + 12 BTL"
console.log(totalPieces);        // 60
```

---

## Backward Compatibility

### Products Without Packaging

If `has_packaging` is `false` or `sellablePackagingUnits` is empty:

**Payload:**
```json
{
  "items": [
    {
      "product_id": "prod-456",
      "quantity": 100,
      "unit_price": 50
    }
  ]
}
```
*Note: No `unit_id` field*

**Response:**
```json
{
  "quoteItems": [
    {
      "product_id": "prod-456",
      "unit_id": null,
      "quantity": 100,
      "unit_quantity": null,
      "base_quantity": 100,
      "packaging_breakdown": null,
      "packagingUnit": null
    }
  ]
}
```

### Handling Null Values

```javascript
// Always check if fields exist
const displayText = item.packaging_breakdown?.display_text || `${item.quantity} PCS`;
const unitName = item.packagingUnit?.unit_abbreviation || 'PCS';
```

---

## Key Payload Fields

### Request (Creating Quote/Order Item)
| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `product_id` | UUID | Yes | Product ID | `"prod-123"` |
| `unit_id` | UUID | No | Packaging unit ID | `"unit-carton"` |
| `quantity` | Decimal | Yes | Quantity in selected unit | `2.5` |
| `unit_price` | Decimal | Yes | Price per unit | `1400` |
| `variant_id` | UUID | No | Product variant | `"variant-456"` |

### Response (Quote/Order Item)
| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `unit_id` | UUID | Selected packaging unit | `"unit-carton"` |
| `quantity` | Decimal | Original quantity entered | `2.5` |
| `unit_quantity` | Decimal | Same as quantity (when unit selected) | `2.5` |
| `base_quantity` | Integer | Converted to base units | `60` |
| `packaging_breakdown` | JSON | Smart breakdown object | See below |
| `packagingUnit` | Object | Selected unit details | See below |

### Packaging Breakdown Structure
```json
{
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
}
```

---

## API Endpoints Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/products/{id}` | GET | Get product with packaging units |
| `/api/products/{id}/packaging/calculate-breakdown` | POST | Preview breakdown (optional) |
| `/api/quotes` | POST | Create quote with packaging |
| `/api/quotes/{id}` | GET | Get quote details |
| `/api/quotes/{id}` | PUT | Update quote items |
| `/api/quotes/{id}/convert-to-order` | POST | Convert to order |
| `/api/orders` | POST | Create order directly |
| `/api/orders/{id}` | GET | Get order details |

---

## Common Scenarios

### Scenario 1: Order by Carton
```
User selects: 3 Cartons @ KES 1,400
Payload: { unit_id: "carton", quantity: 3, unit_price: 1400 }
Result: base_quantity = 72, display = "3 CTN"
```

### Scenario 2: Order by Mixed Units
```
Item 1: 2 Cartons of Product A
Item 2: 5 Packs of Product A  
Item 3: 20 Bottles of Product A
Each item has different unit_id
```

### Scenario 3: Partial Carton
```
User selects: 2.5 Cartons @ KES 1,400
Payload: { unit_id: "carton", quantity: 2.5, unit_price: 1400 }
Result: base_quantity = 60, display = "2 CTN + 12 BTL"
Warehouse picks: 2 full cartons + 12 loose bottles
```

### Scenario 4: No Packaging Unit
```
Product doesn't have packaging
Payload: { quantity: 100, unit_price: 50 }
Result: Treated as 100 pieces
```

---

## Implementation Checklist

- [ ] Fetch product and check `has_packaging` flag
- [ ] Show unit selector if packaging enabled
- [ ] Accept decimal quantities (2.5)
- [ ] Include `unit_id` in payload when creating quote/order
- [ ] Display `packaging_breakdown.display_text` in UI
- [ ] Handle null values for products without packaging
- [ ] Show unit name (`packagingUnit.unit_abbreviation`) in quantity display
- [ ] Test with partial quantities (e.g., 2.5 cartons)
- [ ] Test products with and without packaging

---

## Need Help?

**Backend Documentation:** `PACKAGING_IMPLEMENTATION_GUIDE.md`  
**API Team:** Contact for packaging unit setup and troubleshooting
