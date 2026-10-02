# 🎨 Hierarchical Packaging - Visual Examples

This document shows real-world examples of how to use the hierarchical packaging system.

---

## Example 1: Bottled Water 💧

### Packaging Structure

```
Bottle (500ml)              ← Base Unit
  ↓ 6 bottles per pack
Pack (3L)
  ↓ 4 packs per carton
Carton (12L, 24 bottles)
```

### UI Flow

#### Step 1: Define Base Unit
![Base Unit](docs/images/packaging-base-unit.png)

**Fields:**
- Unit Name: `Bottle`
- Abbreviation: `BTL`
- Is Base Unit: ✅ `true`
- Base Unit Quantity: `1` (auto-set)
- Sellable: ✅ `true`

---

#### Step 2: Add Pack Level
![Add Pack](docs/images/packaging-pack-level.png)

**Fields:**
- Unit Name: `Pack`
- Abbreviation: `PACK`
- Parent Unit: `Bottle` (select from dropdown)
- Bottles per Pack: `6`
- Base Unit Quantity: `6` (auto-calculated) 🎯
- Sellable: ✅ `true`
- Purchasable: ✅ `true`

**Preview Box Shows:**
```
📦 Hierarchy: 1 Pack = 6 Bottle
🔢 Total Conversion: 1 Pack = 6 Bottle
```

---

#### Step 3: Add Carton Level
![Add Carton](docs/images/packaging-carton-level.png)

**Fields:**
- Unit Name: `Carton`
- Abbreviation: `CTN`
- Parent Unit: `Pack` (select from dropdown)
- Packs per Carton: `4`
- Base Unit Quantity: `24` (auto-calculated) 🎯
- Sellable: ✅ `true`
- Purchasable: ✅ `true`

**Preview Box Shows:**
```
📦 Hierarchy: 1 Carton = 4 Pack (6 Bottle each)
🔢 Total Conversion: 1 Carton = 24 Bottle
```

---

#### Final Hierarchy Tree

```
Current Hierarchy:
● Bottle
  ↳ Pack (= 6 Bottle)
    ↳ Carton (= 24 Bottle)
```

---

## Example 2: Canned Soda 🥫

### Packaging Structure

```
Can (330ml)                 ← Base Unit
  ↓ 6 cans per 6-pack
6-Pack
  ↓ 4 six-packs per case
Case (24 cans)
  ↓ 20 cases per pallet
Pallet (480 cans)
```

### API Payload

```json
{
  "name": "Cola 330ml",
  "has_packaging": true,
  "base_unit": "Can",
  "packaging_units": [
    {
      "unit_name": "Can",
      "unit_abbreviation": "CAN",
      "is_base_unit": true,
      "base_unit_quantity": 1,
      "is_sellable": true,
      "is_purchasable": false,
      "display_order": 4,
      "price_per_unit": 1.50,
      "cost_per_unit": 0.75
    },
    {
      "unit_name": "6-Pack",
      "unit_abbreviation": "6PK",
      "is_base_unit": false,
      "parent_unit_reference": "Can",
      "units_per_parent": 6,
      "base_unit_quantity": 6,
      "is_sellable": true,
      "is_purchasable": true,
      "display_order": 3,
      "price_per_unit": 8.00,
      "cost_per_unit": 4.00
    },
    {
      "unit_name": "Case",
      "unit_abbreviation": "CASE",
      "is_base_unit": false,
      "parent_unit_reference": "6-Pack",
      "units_per_parent": 4,
      "base_unit_quantity": 24,
      "is_sellable": true,
      "is_purchasable": true,
      "display_order": 2,
      "price_per_unit": 30.00,
      "cost_per_unit": 15.00
    },
    {
      "unit_name": "Pallet",
      "unit_abbreviation": "PLT",
      "is_base_unit": false,
      "parent_unit_reference": "Case",
      "units_per_parent": 20,
      "base_unit_quantity": 480,
      "is_sellable": false,
      "is_purchasable": true,
      "display_order": 1,
      "price_per_unit": 0,
      "cost_per_unit": 300.00
    }
  ]
}
```

### Hierarchy Visualization

```
● Can
  ↳ 6-Pack (= 6 Can)
    ↳ Case (= 24 Can)
      ↳ Pallet (= 480 Can)
```

---

## Example 3: Electronics (Mixed Mode) 📱

### Scenario
A phone accessory that can be sold individually or in bulk, with different packaging options.

```
Unit (single item)          ← Base Unit
  ↓ Direct to base
Retail Pack (2 units)       ← No parent, direct to base
  ↓ Uses hierarchy
Display Box (5 retail packs = 10 units)
  ↓ Uses hierarchy
Master Carton (10 display boxes = 100 units)
```

### API Payload

```json
{
  "name": "USB-C Cable 2m",
  "has_packaging": true,
  "base_unit": "Unit",
  "packaging_units": [
    {
      "unit_name": "Unit",
      "unit_abbreviation": "UNIT",
      "is_base_unit": true,
      "base_unit_quantity": 1,
      "is_sellable": true,
      "display_order": 4,
      "price_per_unit": 12.99
    },
    {
      "unit_name": "Retail Pack",
      "unit_abbreviation": "RP",
      "is_base_unit": false,
      "parent_unit_reference": null,
      "units_per_parent": 2,
      "base_unit_quantity": 2,
      "is_sellable": true,
      "is_purchasable": false,
      "display_order": 3,
      "price_per_unit": 22.99
    },
    {
      "unit_name": "Display Box",
      "unit_abbreviation": "DBOX",
      "is_base_unit": false,
      "parent_unit_reference": "Retail Pack",
      "units_per_parent": 5,
      "base_unit_quantity": 10,
      "is_sellable": false,
      "is_purchasable": true,
      "display_order": 2,
      "cost_per_unit": 50.00
    },
    {
      "unit_name": "Master Carton",
      "unit_abbreviation": "MSTR",
      "is_base_unit": false,
      "parent_unit_reference": "Display Box",
      "units_per_parent": 10,
      "base_unit_quantity": 100,
      "is_sellable": false,
      "is_purchasable": true,
      "display_order": 1,
      "cost_per_unit": 450.00
    }
  ]
}
```

**Note**: "Retail Pack" has no parent (legacy mode), while "Display Box" and "Master Carton" use the hierarchy.

---

## Example 4: Food Product (Complex Hierarchy) 🍫

### Scenario
Chocolate bars with multiple packaging tiers for wholesale distribution.

```
Bar (50g)                   ← Base Unit
  ↓ 12 bars
Box (600g, 12 bars)
  ↓ 6 boxes
Inner Case (3.6kg, 72 bars)
  ↓ 4 inner cases
Outer Case (14.4kg, 288 bars)
  ↓ 40 outer cases
Pallet (576kg, 11,520 bars)
```

### API Payload

```json
{
  "name": "Chocolate Bar 50g",
  "has_packaging": true,
  "base_unit": "Bar",
  "packaging_units": [
    {
      "unit_name": "Bar",
      "unit_abbreviation": "BAR",
      "is_base_unit": true,
      "base_unit_quantity": 1,
      "is_sellable": true,
      "display_order": 5,
      "price_per_unit": 1.50,
      "weight": 50
    },
    {
      "unit_name": "Box",
      "unit_abbreviation": "BOX",
      "parent_unit_reference": "Bar",
      "units_per_parent": 12,
      "base_unit_quantity": 12,
      "is_sellable": true,
      "is_purchasable": true,
      "display_order": 4,
      "price_per_unit": 16.00,
      "weight": 600
    },
    {
      "unit_name": "Inner Case",
      "unit_abbreviation": "IC",
      "parent_unit_reference": "Box",
      "units_per_parent": 6,
      "base_unit_quantity": 72,
      "is_sellable": true,
      "is_purchasable": true,
      "display_order": 3,
      "price_per_unit": 90.00,
      "weight": 3600
    },
    {
      "unit_name": "Outer Case",
      "unit_abbreviation": "OC",
      "parent_unit_reference": "Inner Case",
      "units_per_parent": 4,
      "base_unit_quantity": 288,
      "is_sellable": false,
      "is_purchasable": true,
      "display_order": 2,
      "cost_per_unit": 200.00,
      "weight": 14400
    },
    {
      "unit_name": "Pallet",
      "unit_abbreviation": "PLT",
      "parent_unit_reference": "Outer Case",
      "units_per_parent": 40,
      "base_unit_quantity": 11520,
      "is_sellable": false,
      "is_purchasable": true,
      "display_order": 1,
      "cost_per_unit": 7500.00,
      "weight": 576000
    }
  ]
}
```

### Calculation Breakdown

| Unit | Units per Parent | Parent's Base Qty | Calculation | Total Base Units |
|------|------------------|-------------------|-------------|------------------|
| Bar | - | - | - | 1 |
| Box | 12 | 1 | 12 × 1 | **12** |
| Inner Case | 6 | 12 | 6 × 12 | **72** |
| Outer Case | 4 | 72 | 4 × 72 | **288** |
| Pallet | 40 | 288 | 40 × 288 | **11,520** |

---

## Example 5: Liquid Product (Different Units) 🧴

### Scenario
Shampoo bottles with varying sizes.

```
Milliliter (ml)             ← Base Unit
  ↓ 250 ml per bottle
Bottle (250ml)
  ↓ 12 bottles
Carton (3L, 12 bottles)
```

**Alternative**: Some products use the bottle as base unit instead.

### Option A: ML as Base Unit

```json
{
  "name": "Premium Shampoo",
  "has_packaging": true,
  "base_unit": "Milliliter",
  "packaging_units": [
    {
      "unit_name": "Milliliter",
      "unit_abbreviation": "ML",
      "is_base_unit": true,
      "base_unit_quantity": 1
    },
    {
      "unit_name": "Bottle",
      "unit_abbreviation": "BTL",
      "parent_unit_reference": "Milliliter",
      "units_per_parent": 250,
      "base_unit_quantity": 250,
      "price_per_unit": 8.99
    },
    {
      "unit_name": "Carton",
      "unit_abbreviation": "CTN",
      "parent_unit_reference": "Bottle",
      "units_per_parent": 12,
      "base_unit_quantity": 3000,
      "cost_per_unit": 60.00
    }
  ]
}
```

### Option B: Bottle as Base Unit (More Common)

```json
{
  "name": "Premium Shampoo",
  "has_packaging": true,
  "base_unit": "Bottle",
  "packaging_units": [
    {
      "unit_name": "Bottle",
      "unit_abbreviation": "BTL",
      "is_base_unit": true,
      "base_unit_quantity": 1,
      "price_per_unit": 8.99
    },
    {
      "unit_name": "Carton",
      "unit_abbreviation": "CTN",
      "parent_unit_reference": "Bottle",
      "units_per_parent": 12,
      "base_unit_quantity": 12,
      "cost_per_unit": 60.00
    }
  ]
}
```

---

## UI State Examples

### Empty State
```
┌─────────────────────────────────────┐
│ 📦 Packaging Units                  │
│ ○ Enable Packaging                  │
└─────────────────────────────────────┘
```

### With Base Unit Only
```
┌─────────────────────────────────────┐
│ 📦 Packaging Units                  │
│ ● Enable Packaging                  │
├─────────────────────────────────────┤
│ Unit 1 [Base Unit]                  │
│ Name: Piece                         │
│ Abbr: PC                            │
│ Base Qty: 1 (auto)                  │
├─────────────────────────────────────┤
│ [+ Add Unit]                        │
└─────────────────────────────────────┘
```

### With Complete Hierarchy
```
┌─────────────────────────────────────┐
│ 📦 Packaging Units                  │
│ ● Enable Packaging                  │
├─────────────────────────────────────┤
│ Unit 1 [Base Unit]                  │
│ Name: Bottle                        │
│ Abbr: BTL                           │
│ Base Qty: 1 (auto)                  │
├─────────────────────────────────────┤
│ Unit 2                              │
│ Name: Pack                          │
│ Abbr: PACK                          │
│ Parent: Bottle                      │
│ Bottles per Pack: 6                 │
│ Base Qty: 6 (auto) 🎯              │
│                                     │
│ 📦 1 Pack = 6 Bottle                │
│ 🔢 Total: 1 Pack = 6 Bottle         │
├─────────────────────────────────────┤
│ Unit 3                              │
│ Name: Carton                        │
│ Abbr: CTN                           │
│ Parent: Pack                        │
│ Packs per Carton: 4                 │
│ Base Qty: 24 (auto) 🎯             │
│                                     │
│ 📦 1 Carton = 4 Pack (6 Bottle each)│
│ 🔢 Total: 1 Carton = 24 Bottle      │
├─────────────────────────────────────┤
│ Current Hierarchy:                  │
│ ● Bottle                            │
│   ↳ Pack (= 6 Bottle)               │
│     ↳ Carton (= 24 Bottle)          │
├─────────────────────────────────────┤
│ [+ Add Unit]                        │
└─────────────────────────────────────┘
```

---

## Common Patterns

### Pattern 1: Retail → Wholesale
```
Individual Item → Retail Pack → Wholesale Box → Distribution Carton
```

### Pattern 2: Manufacturing → Distribution
```
Unit → Inner Box → Master Carton → Pallet → Container
```

### Pattern 3: Food & Beverage
```
Serving → Package → Case → Pallet
```

### Pattern 4: Bulk Liquids
```
Liter → Bottle → Case → Drum
```

---

## Tips for Best UX

1. **Use Descriptive Names**: "6-Pack" is better than "Pack"
2. **Logical Display Order**: Largest units first (lowest number)
3. **Sellable Flags**: Mark what customers can actually buy
4. **Purchasable Flags**: Mark what you order from suppliers
5. **Pricing**: Set prices for sellable units, costs for purchasable units

---

**Last Updated**: October 22, 2025  
**For More Examples**: Contact the product team
