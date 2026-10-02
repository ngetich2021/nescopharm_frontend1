# 📦 Hierarchical Packaging - Quick Reference Card

## TL;DR

**Before**: Users calculate: "1 Carton = 300 pieces" (15 boxes × 20 pieces)  
**Now**: Users enter: "1 Carton = 15 Boxes" → System calculates 300 automatically

---

## 🎯 Quick API Payload

```json
{
  "name": "Product Name",
  "has_packaging": true,
  "base_unit": "Piece",
  "packaging_units": [
    {
      "unit_name": "Piece",
      "unit_abbreviation": "PC",
      "is_base_unit": true,
      "base_unit_quantity": 1
    },
    {
      "unit_name": "Box",
      "unit_abbreviation": "BOX",
      "parent_unit_reference": "Piece",
      "units_per_parent": 20,
      "base_unit_quantity": 20  // Auto-calculated
    },
    {
      "unit_name": "Carton",
      "unit_abbreviation": "CTN",
      "parent_unit_reference": "Box",
      "units_per_parent": 15,
      "base_unit_quantity": 300  // Auto-calculated: 15 × 20
    }
  ]
}
```

---

## 🔑 Key Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `parent_unit_reference` | string \| null | No | Name of parent unit |
| `units_per_parent` | number \| null | No | How many parent units in this unit |
| `base_unit_quantity` | number | Yes | Auto-calculated from hierarchy |
| `is_base_unit` | boolean | Yes | Only one unit can be true |

---

## ✅ Validation Checklist

- [ ] Exactly ONE unit marked as `is_base_unit: true`
- [ ] Base unit has `base_unit_quantity: 1`
- [ ] Base unit has no `parent_unit_reference`
- [ ] All `parent_unit_reference` values point to existing units
- [ ] `units_per_parent` is a positive integer when parent is set
- [ ] No circular dependencies

---

## 🔄 Calculation Formula

```
base_unit_quantity = units_per_parent × parent's base_unit_quantity
```

**Example**:
- Bottle (base): 1
- Pack = 6 × Bottle: 6 × 1 = **6**
- Carton = 4 × Pack: 4 × 6 = **24**

---

## 🎨 UI Components Used

```tsx
// Parent selector
<Select
  value={unit.parent_unit_reference || ""}
  onValueChange={(value) => handlePackagingUnitChange(index, "parent_unit_reference", value)}
>
  <SelectItem value="">No parent (relative to base unit)</SelectItem>
  {otherUnits.map(u => (
    <SelectItem value={u.unit_name}>{u.unit_name}</SelectItem>
  ))}
</Select>

// Units per parent input
<Input
  type="number"
  value={unit.units_per_parent || 1}
  onChange={(e) => handlePackagingUnitChange(index, "units_per_parent", parseInt(e.target.value))}
/>

// Auto-calculated base quantity (read-only)
<Input
  value={unit.base_unit_quantity}
  disabled
  className="bg-muted"
/>
```

---

## 🧪 Test Cases

### ✅ Valid: Simple Hierarchy
```json
[
  {"unit_name": "Piece", "is_base_unit": true},
  {"unit_name": "Box", "parent_unit_reference": "Piece", "units_per_parent": 12}
]
```

### ✅ Valid: Three Levels
```json
[
  {"unit_name": "Bottle", "is_base_unit": true},
  {"unit_name": "Pack", "parent_unit_reference": "Bottle", "units_per_parent": 6},
  {"unit_name": "Carton", "parent_unit_reference": "Pack", "units_per_parent": 4}
]
```

### ✅ Valid: Mixed (Legacy + Hierarchical)
```json
[
  {"unit_name": "Piece", "is_base_unit": true},
  {"unit_name": "SmallBox", "units_per_parent": 10},  // No parent = legacy
  {"unit_name": "BigBox", "parent_unit_reference": "SmallBox", "units_per_parent": 5}
]
```

### ❌ Invalid: No Base Unit
```json
[
  {"unit_name": "Box", "is_base_unit": false}
]
// Error: Must have exactly one base unit
```

### ❌ Invalid: Multiple Base Units
```json
[
  {"unit_name": "Piece", "is_base_unit": true},
  {"unit_name": "Box", "is_base_unit": true}
]
// Error: Only one unit can be base
```

### ❌ Invalid: Invalid Parent Reference
```json
[
  {"unit_name": "Piece", "is_base_unit": true},
  {"unit_name": "Box", "parent_unit_reference": "NonExistent", "units_per_parent": 10}
]
// Error: Parent unit not found
```

---

## 🚀 Migration Cheat Sheet

### Old Format → New Format

**Before (Legacy)**:
```json
{
  "unit_name": "Carton",
  "base_unit_quantity": 300,
  "is_base_unit": false
}
```

**After (Hierarchical)**:
```json
{
  "unit_name": "Carton",
  "parent_unit_reference": "Box",
  "units_per_parent": 15,
  "base_unit_quantity": 300,  // Auto-calculated
  "is_base_unit": false
}
```

---

## 💡 Pro Tips

1. **Start with base unit**: Always define the smallest unit first
2. **Build bottom-up**: Define smaller units before larger ones
3. **Use descriptive names**: "Pack of 6" is clearer than "Pack"
4. **Set display order**: Control dropdown order with `display_order`
5. **Test calculations**: Verify auto-calculated values in preview

---

## 🐛 Debug Checklist

If calculations seem wrong:

1. Check base unit is marked correctly
2. Verify parent references match unit names exactly
3. Ensure `units_per_parent` is a number, not string
4. Look for circular dependencies
5. Check if `calculateBaseUnitQuantity()` is called after changes

---

## 📞 Quick Help

**UI Component**: `/app/inventory/products/components/create-product-sheet.tsx`  
**Type Definitions**: `/lib/products.ts` (line 46)  
**Full Guide**: `/docs/HIERARCHICAL_PACKAGING_GUIDE.md`  

---

**Version**: 1.0.0 | **Updated**: Oct 22, 2025
