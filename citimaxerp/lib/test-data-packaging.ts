/**
 * Test Data for Hierarchical Packaging System
 * 
 * Use these sample products to test the hierarchical packaging feature
 * in the create product form.
 */

export const hierarchicalPackagingTestData = {
  // Test Case 1: Simple 2-level hierarchy
  bottledWater: {
    name: "Premium Spring Water 500ml",
    product_code: "WATER-PREM-001",
    sku: "WATER-001",
    description: "Premium spring water in recyclable bottles",
    price: 1.50,
    unit_cost: 0.75,
    category: "Beverages",
    brand: "Crystal Springs",
    has_packaging: true,
    base_unit: "Bottle",
    track_inventory: true,
    is_active: true,
    packaging_units: [
      {
        unit_name: "Bottle",
        unit_abbreviation: "BTL",
        is_base_unit: true,
        is_sellable: true,
        is_purchasable: false,
        display_order: 3,
        base_unit_quantity: 1,
        price_per_unit: 1.50,
        cost_per_unit: 0.75
      },
      {
        unit_name: "Pack",
        unit_abbreviation: "PACK",
        is_base_unit: false,
        is_sellable: true,
        is_purchasable: true,
        parent_unit_reference: "Bottle",
        units_per_parent: 6,
        base_unit_quantity: 6, // Auto-calculated
        display_order: 2,
        price_per_unit: 8.50,
        cost_per_unit: 4.25
      },
      {
        unit_name: "Carton",
        unit_abbreviation: "CTN",
        is_base_unit: false,
        is_sellable: true,
        is_purchasable: true,
        parent_unit_reference: "Pack",
        units_per_parent: 4,
        base_unit_quantity: 24, // Auto-calculated: 4 × 6
        display_order: 1,
        price_per_unit: 32.00,
        cost_per_unit: 16.00
      }
    ]
  },

  // Test Case 2: 4-level hierarchy (complex)
  cannedSoda: {
    name: "Cola 330ml Can",
    product_code: "SODA-COLA-330",
    sku: "COLA-330",
    description: "Classic cola in 330ml cans",
    price: 1.50,
    unit_cost: 0.60,
    category: "Beverages",
    brand: "Cola Co",
    has_packaging: true,
    base_unit: "Can",
    track_inventory: true,
    is_active: true,
    packaging_units: [
      {
        unit_name: "Can",
        unit_abbreviation: "CAN",
        is_base_unit: true,
        is_sellable: true,
        is_purchasable: false,
        display_order: 4,
        base_unit_quantity: 1,
        price_per_unit: 1.50,
        cost_per_unit: 0.60,
        weight: 330
      },
      {
        unit_name: "6-Pack",
        unit_abbreviation: "6PK",
        is_base_unit: false,
        is_sellable: true,
        is_purchasable: true,
        parent_unit_reference: "Can",
        units_per_parent: 6,
        base_unit_quantity: 6,
        display_order: 3,
        price_per_unit: 8.00,
        cost_per_unit: 3.30,
        weight: 1980
      },
      {
        unit_name: "Case",
        unit_abbreviation: "CASE",
        is_base_unit: false,
        is_sellable: true,
        is_purchasable: true,
        parent_unit_reference: "6-Pack",
        units_per_parent: 4,
        base_unit_quantity: 24, // 4 × 6
        display_order: 2,
        price_per_unit: 30.00,
        cost_per_unit: 12.00,
        weight: 7920
      },
      {
        unit_name: "Pallet",
        unit_abbreviation: "PLT",
        is_base_unit: false,
        is_sellable: false,
        is_purchasable: true,
        parent_unit_reference: "Case",
        units_per_parent: 20,
        base_unit_quantity: 480, // 20 × 24
        display_order: 1,
        cost_per_unit: 230.00,
        weight: 158400
      }
    ]
  },

  // Test Case 3: Mixed mode (some units without parent)
  usbCable: {
    name: "USB-C Cable 2m Braided",
    product_code: "CABLE-USBC-2M",
    sku: "USBC-2M-001",
    description: "Durable braided USB-C cable, 2 meters long",
    price: 12.99,
    unit_cost: 5.50,
    category: "Electronics",
    brand: "TechGear",
    has_packaging: true,
    base_unit: "Unit",
    track_inventory: true,
    is_active: true,
    packaging_units: [
      {
        unit_name: "Unit",
        unit_abbreviation: "UNIT",
        is_base_unit: true,
        is_sellable: true,
        is_purchasable: false,
        display_order: 4,
        base_unit_quantity: 1,
        price_per_unit: 12.99,
        cost_per_unit: 5.50
      },
      {
        unit_name: "Retail Pack",
        unit_abbreviation: "RP",
        is_base_unit: false,
        is_sellable: true,
        is_purchasable: false,
        parent_unit_reference: null, // Direct to base (legacy mode)
        units_per_parent: 2,
        base_unit_quantity: 2,
        display_order: 3,
        price_per_unit: 22.99
      },
      {
        unit_name: "Display Box",
        unit_abbreviation: "DBOX",
        is_base_unit: false,
        is_sellable: false,
        is_purchasable: true,
        parent_unit_reference: "Retail Pack", // Uses hierarchy
        units_per_parent: 5,
        base_unit_quantity: 10, // 5 × 2
        display_order: 2,
        cost_per_unit: 50.00
      },
      {
        unit_name: "Master Carton",
        unit_abbreviation: "MSTR",
        is_base_unit: false,
        is_sellable: false,
        is_purchasable: true,
        parent_unit_reference: "Display Box",
        units_per_parent: 10,
        base_unit_quantity: 100, // 10 × 10
        display_order: 1,
        cost_per_unit: 450.00
      }
    ]
  },

  // Test Case 4: Food product with 5 levels
  chocolateBar: {
    name: "Chocolate Bar Dark 50g",
    product_code: "CHOC-DARK-50",
    sku: "CHOC-50G",
    description: "Premium dark chocolate bar, 70% cocoa",
    price: 1.50,
    unit_cost: 0.60,
    category: "Food",
    brand: "ChocoDelight",
    has_packaging: true,
    base_unit: "Bar",
    track_inventory: true,
    is_active: true,
    packaging_units: [
      {
        unit_name: "Bar",
        unit_abbreviation: "BAR",
        is_base_unit: true,
        is_sellable: true,
        is_purchasable: false,
        display_order: 5,
        base_unit_quantity: 1,
        price_per_unit: 1.50,
        cost_per_unit: 0.60,
        weight: 50
      },
      {
        unit_name: "Box",
        unit_abbreviation: "BOX",
        is_base_unit: false,
        is_sellable: true,
        is_purchasable: true,
        parent_unit_reference: "Bar",
        units_per_parent: 12,
        base_unit_quantity: 12,
        display_order: 4,
        price_per_unit: 16.00,
        cost_per_unit: 6.50,
        weight: 600
      },
      {
        unit_name: "Inner Case",
        unit_abbreviation: "IC",
        is_base_unit: false,
        is_sellable: true,
        is_purchasable: true,
        parent_unit_reference: "Box",
        units_per_parent: 6,
        base_unit_quantity: 72, // 6 × 12
        display_order: 3,
        price_per_unit: 90.00,
        cost_per_unit: 38.00,
        weight: 3600
      },
      {
        unit_name: "Outer Case",
        unit_abbreviation: "OC",
        is_base_unit: false,
        is_sellable: false,
        is_purchasable: true,
        parent_unit_reference: "Inner Case",
        units_per_parent: 4,
        base_unit_quantity: 288, // 4 × 72
        display_order: 2,
        cost_per_unit: 150.00,
        weight: 14400
      },
      {
        unit_name: "Pallet",
        unit_abbreviation: "PLT",
        is_base_unit: false,
        is_sellable: false,
        is_purchasable: true,
        parent_unit_reference: "Outer Case",
        units_per_parent: 40,
        base_unit_quantity: 11520, // 40 × 288
        display_order: 1,
        cost_per_unit: 5800.00,
        weight: 576000
      }
    ]
  },

  // Test Case 5: Simple product with bottle as base
  shampoo: {
    name: "Luxury Shampoo 250ml",
    product_code: "SHAMP-LUX-250",
    sku: "SHAMP-250",
    description: "Premium shampoo with natural ingredients",
    price: 8.99,
    unit_cost: 3.50,
    category: "Personal Care",
    brand: "LuxHair",
    has_packaging: true,
    base_unit: "Bottle",
    track_inventory: true,
    is_active: true,
    packaging_units: [
      {
        unit_name: "Bottle",
        unit_abbreviation: "BTL",
        is_base_unit: true,
        is_sellable: true,
        is_purchasable: false,
        display_order: 2,
        base_unit_quantity: 1,
        price_per_unit: 8.99,
        cost_per_unit: 3.50,
        weight: 250
      },
      {
        unit_name: "Carton",
        unit_abbreviation: "CTN",
        is_base_unit: false,
        is_sellable: true,
        is_purchasable: true,
        parent_unit_reference: "Bottle",
        units_per_parent: 12,
        base_unit_quantity: 12,
        display_order: 1,
        price_per_unit: 100.00,
        cost_per_unit: 40.00,
        weight: 3000
      }
    ]
  },

  // Test Case 6: Edge case - single unit product
  bulkRice: {
    name: "Basmati Rice Premium",
    product_code: "RICE-BASM-BULK",
    sku: "RICE-BULK-001",
    description: "Premium aged basmati rice sold by weight",
    price: 2.50,
    unit_cost: 1.20,
    category: "Food",
    brand: "RiceKing",
    has_packaging: true,
    base_unit: "Kilogram",
    track_inventory: true,
    is_active: true,
    packaging_units: [
      {
        unit_name: "Kilogram",
        unit_abbreviation: "KG",
        is_base_unit: true,
        is_sellable: true,
        is_purchasable: true,
        display_order: 1,
        base_unit_quantity: 1,
        price_per_unit: 2.50,
        cost_per_unit: 1.20
      }
    ]
  },

  // Test Case 7: Multiple branches (different paths from base)
  tshirt: {
    name: "Cotton T-Shirt Plain",
    product_code: "TSHIRT-COTTON-001",
    sku: "TSHIRT-001",
    description: "100% cotton plain t-shirt, various sizes",
    price: 9.99,
    unit_cost: 4.00,
    category: "Apparel",
    brand: "ComfortWear",
    has_packaging: true,
    base_unit: "Piece",
    track_inventory: true,
    is_active: true,
    packaging_units: [
      {
        unit_name: "Piece",
        unit_abbreviation: "PC",
        is_base_unit: true,
        is_sellable: true,
        is_purchasable: false,
        display_order: 5,
        base_unit_quantity: 1,
        price_per_unit: 9.99,
        cost_per_unit: 4.00
      },
      {
        unit_name: "Retail Pack",
        unit_abbreviation: "RP",
        is_base_unit: false,
        is_sellable: true,
        is_purchasable: false,
        parent_unit_reference: "Piece",
        units_per_parent: 3,
        base_unit_quantity: 3,
        display_order: 4,
        price_per_unit: 27.00
      },
      {
        unit_name: "Inner Box",
        unit_abbreviation: "IB",
        is_base_unit: false,
        is_sellable: false,
        is_purchasable: true,
        parent_unit_reference: "Piece",
        units_per_parent: 10,
        base_unit_quantity: 10,
        display_order: 3,
        cost_per_unit: 38.00
      },
      {
        unit_name: "Retail Carton",
        unit_abbreviation: "RC",
        is_base_unit: false,
        is_sellable: false,
        is_purchasable: true,
        parent_unit_reference: "Retail Pack",
        units_per_parent: 12,
        base_unit_quantity: 36, // 12 × 3
        display_order: 2,
        cost_per_unit: 140.00
      },
      {
        unit_name: "Master Carton",
        unit_abbreviation: "MC",
        is_base_unit: false,
        is_sellable: false,
        is_purchasable: true,
        parent_unit_reference: "Inner Box",
        units_per_parent: 20,
        base_unit_quantity: 200, // 20 × 10
        display_order: 1,
        cost_per_unit: 750.00
      }
    ]
  }
}

/**
 * Validation test cases
 */
export const invalidPackagingTestCases = {
  // Invalid: No base unit
  noBaseUnit: {
    name: "Invalid Product - No Base",
    has_packaging: true,
    packaging_units: [
      {
        unit_name: "Box",
        unit_abbreviation: "BOX",
        is_base_unit: false,
        base_unit_quantity: 10
      }
    ]
  },

  // Invalid: Multiple base units
  multipleBaseUnits: {
    name: "Invalid Product - Multiple Base",
    has_packaging: true,
    packaging_units: [
      {
        unit_name: "Piece",
        unit_abbreviation: "PC",
        is_base_unit: true,
        base_unit_quantity: 1
      },
      {
        unit_name: "Unit",
        unit_abbreviation: "UNIT",
        is_base_unit: true,
        base_unit_quantity: 1
      }
    ]
  },

  // Invalid: Parent reference to non-existent unit
  invalidParentReference: {
    name: "Invalid Product - Bad Parent",
    has_packaging: true,
    packaging_units: [
      {
        unit_name: "Piece",
        unit_abbreviation: "PC",
        is_base_unit: true,
        base_unit_quantity: 1
      },
      {
        unit_name: "Box",
        unit_abbreviation: "BOX",
        is_base_unit: false,
        parent_unit_reference: "NonExistent",
        units_per_parent: 10,
        base_unit_quantity: 10
      }
    ]
  },

  // Invalid: Base unit with parent reference
  baseUnitWithParent: {
    name: "Invalid Product - Base with Parent",
    has_packaging: true,
    packaging_units: [
      {
        unit_name: "Piece",
        unit_abbreviation: "PC",
        is_base_unit: true,
        parent_unit_reference: "Something",
        units_per_parent: 1,
        base_unit_quantity: 1
      }
    ]
  }
}

/**
 * Helper function to format test data for display
 */
export function formatPackagingHierarchy(packagingUnits: any[]): string {
  const baseUnit = packagingUnits.find(u => u.is_base_unit)
  if (!baseUnit) return "No base unit defined"

  const renderUnit = (unitName: string, level: number = 0): string[] => {
    const indent = "  ".repeat(level)
    const unit = packagingUnits.find(u => u.unit_name === unitName)
    if (!unit) return []

    const lines: string[] = []
    const prefix = level > 0 ? "↳ " : "● "
    const baseQty = unit.base_unit_quantity !== 1 ? ` (= ${unit.base_unit_quantity} ${baseUnit.unit_name})` : ""
    lines.push(`${indent}${prefix}${unit.unit_name}${baseQty}`)

    const children = packagingUnits.filter(u => u.parent_unit_reference === unitName)
    children.forEach(child => {
      lines.push(...renderUnit(child.unit_name, level + 1))
    })

    return lines
  }

  return renderUnit(baseUnit.unit_name).join("\n")
}

// Example usage:
// console.log(formatPackagingHierarchy(hierarchicalPackagingTestData.bottledWater.packaging_units))
