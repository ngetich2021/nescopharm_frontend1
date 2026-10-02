# 📦 Hierarchical Packaging System - Frontend Integration Guide

## Overview

The new hierarchical packaging system allows users to define product packaging units in a parent-child relationship, making it intuitive to set up complex packaging hierarchies. The system automatically calculates base unit quantities based on the hierarchy.

---

## 🎯 Key Features

### 1. **Intuitive Parent-Child Relationships**
- Define each packaging level relative to its immediate parent
- No more manual calculation of base unit quantities
- System auto-calculates conversions through the entire hierarchy

### 2. **Backward Compatible**
- All existing products work without changes
- `base_unit_quantity` still exists and works as before
- Can still define units directly relative to base unit

### 3. **Flexible Definition**
- Option 1: Build a hierarchy (Bottle → Pack → Carton)
- Option 2: Define directly to base unit (legacy mode)
- Mix both approaches in the same product

---

## 📊 Data Structure

### Updated `PackagingUnit` Interface

```typescript
export interface PackagingUnit {
  // Existing fields
  id?: string
  unit_name: string
  unit_abbreviation: string
  base_unit_quantity: number | string
  is_base_unit: boolean
  is_sellable?: boolean
  is_purchasable?: boolean
  display_order?: number
  price_per_unit?: number | string | null
  cost_per_unit?: number | string | null
  barcode?: string | null
  
  // New hierarchical fields
  parent_unit_reference?: string | null     // Name of the parent unit
  units_per_parent?: number | null          // How many parent units fit in this unit
}
```

---

## 🔄 How It Works

### Example: Bottled Water Product

```
Bottle (base unit)
  ↓ 6 bottles per pack
Pack
  ↓ 4 packs per carton
Carton (= 24 bottles, auto-calculated)
```

### Sample Data

```json
{
  "name": "Premium Bottled Water",
  "has_packaging": true,
  "base_unit": "Bottle",
  "packaging_units": [
    {
      "unit_name": "Bottle",
      "unit_abbreviation": "BTL",
      "is_base_unit": true,
      "base_unit_quantity": 1,
      "is_sellable": true,
      "display_order": 3
    },
    {
      "unit_name": "Pack",
      "unit_abbreviation": "PACK",
      "is_base_unit": false,
      "parent_unit_reference": "Bottle",
      "units_per_parent": 6,
      "base_unit_quantity": 6,        // Auto-calculated: 6 × 1 = 6
      "is_sellable": true,
      "is_purchasable": true,
      "display_order": 2
    },
    {
      "unit_name": "Carton",
      "unit_abbreviation": "CTN",
      "is_base_unit": false,
      "parent_unit_reference": "Pack",
      "units_per_parent": 4,
      "base_unit_quantity": 24,       // Auto-calculated: 4 × 6 = 24
      "is_sellable": true,
      "is_purchasable": true,
      "display_order": 1
    }
  ]
}
```

---

## 🎨 UI Components

### 1. **Parent Unit Selector**

Users see a dropdown with available parent units:

```tsx
<Select
  value={unit.parent_unit_reference || ""}
  onValueChange={(value) => handlePackagingUnitChange(index, "parent_unit_reference", value || null)}
>
  <SelectItem value="">No parent (relative to base unit)</SelectItem>
  <SelectItem value="Bottle">Bottle (Base)</SelectItem>
  <SelectItem value="Pack">Pack</SelectItem>
</Select>
```

### 2. **Dynamic Label for Units Per Parent**

The input label changes based on the selected parent:

- **With parent**: "Bottles per Pack" or "Packs per Carton"
- **Without parent**: "Base Units per Package"

### 3. **Auto-Calculated Base Quantity**

A read-only field shows the calculated base unit quantity:

```tsx
<Input
  value={unit.base_unit_quantity}
  disabled
  className="bg-muted"
/>
<p className="text-xs text-muted-foreground">
  Automatically calculated from hierarchy
</p>
```

### 4. **Hierarchical Preview**

Real-time preview showing:
- Parent-child relationship
- Total conversion to base units
- Visual hierarchy tree

```tsx
{!unit.is_base_unit && (
  <div className="p-3 bg-gradient-to-r from-primary/10 to-blue-50 rounded-md">
    <p>📦 Hierarchy: 1 Carton = 4 Pack (6 Bottle each)</p>
    <p>🔢 Total Conversion: 1 Carton = 24 Bottle</p>
  </div>
)}
```

### 5. **Visual Hierarchy Tree**

Shows the complete packaging structure:

```
● Bottle
  ↳ Pack (= 6 Bottle)
    ↳ Carton (= 24 Bottle)
```

---

## 🔧 Implementation Details

### Auto-Calculation Logic

```typescript
const calculateBaseUnitQuantity = (units: PackagingUnit[], targetIndex: number): number => {
  const targetUnit = units[targetIndex]
  
  // Base unit always has quantity of 1
  if (targetUnit.is_base_unit) {
    return 1
  }
  
  // If no parent reference, use units_per_parent directly
  if (!targetUnit.parent_unit_reference) {
    return Number(targetUnit.units_per_parent || 1)
  }
  
  // Find the parent unit
  const parentUnit = units.find(u => u.unit_name === targetUnit.parent_unit_reference)
  if (!parentUnit) {
    return Number(targetUnit.units_per_parent || 1)
  }
  
  // Recursively get parent's base quantity
  const parentIndex = units.findIndex(u => u.unit_name === targetUnit.parent_unit_reference)
  const parentBaseQty = calculateBaseUnitQuantity(units, parentIndex)
  
  // Multiply: parent's base quantity × units per parent
  return parentBaseQty * Number(targetUnit.units_per_parent || 1)
}
```

### State Management

When any packaging unit changes, the system:
1. Updates the specific field
2. Recalculates all `base_unit_quantity` values
3. Re-renders the hierarchy preview

```typescript
const handlePackagingUnitChange = (index: number, field: keyof PackagingUnit, value: any) => {
  setPackagingUnits(prev => {
    const updated = prev.map((unit, i) => {
      if (i === index) {
        // Handle specific field updates
        if (field === 'is_base_unit' && value === true) {
          return { 
            ...unit, 
            is_base_unit: true, 
            base_unit_quantity: 1,
            parent_unit_reference: null,
            units_per_parent: null
          }
        }
        // ... other field handlers
      }
      return unit
    })
    
    // Recalculate all base quantities
    return updated.map((unit, i) => ({
      ...unit,
      base_unit_quantity: calculateBaseUnitQuantity(updated, i)
    }))
  })
}
```

---

## ✅ Validation Rules

### Required Validations

1. **Single Base Unit**
   - Exactly one unit must be marked as `is_base_unit: true`
   - Base unit must have `base_unit_quantity: 1`

2. **Valid Parent References**
   - `parent_unit_reference` must point to an existing unit name
   - Cannot reference self
   - Should not create circular dependencies (optional check)

3. **Units Per Parent**
   - Must be a positive integer (≥ 1)
   - Required if `parent_unit_reference` is set

4. **Base Unit Constraints**
   - Base unit cannot have a parent reference
   - Base unit cannot have `units_per_parent`

### Example Validation Code

```typescript
// Validate packaging units before submission
if (productData.has_packaging) {
  const baseUnits = productData.packaging_units.filter(u => u.is_base_unit)
  
  if (baseUnits.length !== 1) {
    throw new Error("Exactly one unit must be marked as base unit")
  }
  
  if (baseUnits[0].base_unit_quantity !== 1) {
    throw new Error("Base unit must have base_unit_quantity of 1")
  }
  
  // Validate parent references
  productData.packaging_units.forEach(unit => {
    if (!unit.is_base_unit && unit.parent_unit_reference) {
      const parentExists = productData.packaging_units.some(
        u => u.unit_name === unit.parent_unit_reference
      )
      if (!parentExists) {
        throw new Error(`Invalid parent reference: ${unit.parent_unit_reference}`)
      }
    }
  })
}
```

---

## 🎯 User Workflows

### Workflow 1: Creating a Hierarchical Product

1. Enable "Enable Packaging" toggle
2. Define base unit (e.g., "Bottle")
3. Add new packaging unit (e.g., "Pack")
   - Select "Bottle" as parent
   - Enter "6" as units per parent
   - System shows: "1 Pack = 6 Bottles"
4. Add another unit (e.g., "Carton")
   - Select "Pack" as parent
   - Enter "4" as units per parent
   - System shows: "1 Carton = 4 Packs = 24 Bottles"

### Workflow 2: Mixed Mode (Legacy + Hierarchical)

1. Define base unit (e.g., "Piece")
2. Add "Box"
   - No parent selected
   - Enter "12" as base units per package
   - System shows: "1 Box = 12 Pieces"
3. Add "Carton"
   - Select "Box" as parent
   - Enter "10" as units per parent
   - System shows: "1 Carton = 10 Boxes = 120 Pieces"

---

## 🔍 Testing Scenarios

### Test Case 1: Simple Two-Level Hierarchy

```json
{
  "packaging_units": [
    {"unit_name": "Piece", "is_base_unit": true, "base_unit_quantity": 1},
    {"unit_name": "Box", "parent_unit_reference": "Piece", "units_per_parent": 12, "base_unit_quantity": 12}
  ]
}
```

**Expected**: 1 Box = 12 Pieces

### Test Case 2: Three-Level Hierarchy

```json
{
  "packaging_units": [
    {"unit_name": "Bottle", "is_base_unit": true, "base_unit_quantity": 1},
    {"unit_name": "Pack", "parent_unit_reference": "Bottle", "units_per_parent": 6, "base_unit_quantity": 6},
    {"unit_name": "Carton", "parent_unit_reference": "Pack", "units_per_parent": 4, "base_unit_quantity": 24}
  ]
}
```

**Expected**: 
- 1 Pack = 6 Bottles
- 1 Carton = 4 Packs = 24 Bottles

### Test Case 3: Complex Hierarchy with Multiple Branches

```json
{
  "packaging_units": [
    {"unit_name": "Piece", "is_base_unit": true, "base_unit_quantity": 1},
    {"unit_name": "Small Box", "parent_unit_reference": "Piece", "units_per_parent": 10, "base_unit_quantity": 10},
    {"unit_name": "Large Box", "parent_unit_reference": "Piece", "units_per_parent": 50, "base_unit_quantity": 50},
    {"unit_name": "Pallet", "parent_unit_reference": "Large Box", "units_per_parent": 20, "base_unit_quantity": 1000}
  ]
}
```

**Expected**:
- 1 Small Box = 10 Pieces
- 1 Large Box = 50 Pieces
- 1 Pallet = 20 Large Boxes = 1000 Pieces

---

## 🚀 Migration Guide

### Existing Products

All existing products continue to work without changes:
- `base_unit_quantity` is still respected
- No `parent_unit_reference` = legacy mode
- API still returns both fields for compatibility

### Updating Existing Products

To convert an existing product to hierarchical:

1. Identify current packaging units
2. Determine parent-child relationships
3. Update each unit:
   - Set `parent_unit_reference`
   - Calculate `units_per_parent`
   - Remove manual `base_unit_quantity` (system will calculate)

**Example Migration:**

Before (Legacy):
```json
{
  "unit_name": "Carton",
  "base_unit_quantity": 300
}
```

After (Hierarchical):
```json
{
  "unit_name": "Carton",
  "parent_unit_reference": "Box",
  "units_per_parent": 15,
  "base_unit_quantity": 300  // Auto-calculated if Box has 20 pieces
}
```

---

## 📱 Mobile Considerations

- Dropdown menus are touch-friendly
- Hierarchy tree is scrollable on small screens
- Real-time preview helps validate on mobile
- Compact layout for packaging cards

---

## 🎨 Design Patterns

### Visual Indicators

- **Base Unit Badge**: Primary color badge showing "Base Unit"
- **Hierarchy Arrows**: Visual `↳` showing parent-child relationships
- **Auto-calc Highlight**: Primary color for calculated values
- **Gradient Previews**: Gradient backgrounds for conversion previews

### User Feedback

- **Real-time calculation**: Updates as user types
- **Visual hierarchy tree**: Shows complete structure
- **Inline conversions**: Shows relationships within each unit card
- **Helper text**: Contextual guidance for each field

---

## 🐛 Common Issues & Solutions

### Issue 1: Base quantity not updating

**Cause**: Not triggering recalculation after parent change  
**Solution**: Ensure `handlePackagingUnitChange` recalculates all units

### Issue 2: Circular dependencies

**Cause**: Unit A references Unit B, Unit B references Unit A  
**Solution**: Add validation to prevent circular references

### Issue 3: Missing parent unit

**Cause**: Parent unit was deleted but reference remains  
**Solution**: Validate parent references before save, show warning

---

## 📚 Additional Resources

- **API Documentation**: See backend API docs for full payload structure
- **Component Source**: `/app/inventory/products/components/create-product-sheet.tsx`
- **Type Definitions**: `/lib/products.ts`
- **Example Products**: See test data in `/lib/mock-data.ts`

---

## 🎉 Benefits Summary

✅ **Intuitive**: Define packaging the way you think about it  
✅ **Error-free**: No manual calculation mistakes  
✅ **Flexible**: Support both simple and complex hierarchies  
✅ **Visual**: See the structure as you build it  
✅ **Backward compatible**: Existing products work unchanged  
✅ **Scalable**: Support unlimited nesting levels  

---

## 📞 Support

For questions or issues with the hierarchical packaging system:
- Check this guide first
- Review example products in the system
- Contact the development team
- Submit bug reports with example data

---

**Last Updated**: October 22, 2025  
**Version**: 1.0.0  
**Author**: Development Team
