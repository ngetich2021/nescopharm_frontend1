/**
 * Packaging Utilities
 * Utilities for calculating and displaying packaging breakdowns
 */

import { PackagingUnit } from "./products"

export interface PackagingBreakdownItem {
  unit_name: string
  unit_abbreviation: string
  quantity: number
  base_unit_quantity: number
  is_base_unit: boolean
}

export interface PackagingBreakdown {
  total_base_quantity: number
  breakdown: PackagingBreakdownItem[]
  display_text: string
}

/**
 * Calculate the optimal packaging breakdown for a given quantity
 * @param quantity The total quantity in base units
 * @param packagingUnits Array of packaging units for the product (sorted by display_order ascending)
 * @returns PackagingBreakdown object with breakdown details and display text
 */
export function calculatePackagingBreakdown(
  quantity: number,
  packagingUnits?: PackagingUnit[]
): PackagingBreakdown | null {
  if (!packagingUnits || packagingUnits.length === 0 || quantity <= 0) {
    return null
  }

  // Sort units by base_unit_quantity in descending order (largest to smallest)
  const sortedUnits = [...packagingUnits]
    .filter(unit => unit.is_sellable !== false) // Only consider sellable units
    .sort((a, b) => {
      const aQty = typeof a.base_unit_quantity === 'string' 
        ? parseFloat(a.base_unit_quantity) 
        : a.base_unit_quantity
      const bQty = typeof b.base_unit_quantity === 'string' 
        ? parseFloat(b.base_unit_quantity) 
        : b.base_unit_quantity
      return bQty - aQty // Descending order
    })

  if (sortedUnits.length === 0) {
    return null
  }

  const breakdown: PackagingBreakdownItem[] = []
  let remainingQuantity = quantity

  // Greedy algorithm: use the largest units first
  for (const unit of sortedUnits) {
    const baseQty = typeof unit.base_unit_quantity === 'string' 
      ? parseFloat(unit.base_unit_quantity) 
      : unit.base_unit_quantity

    if (baseQty <= 0) continue

    const unitCount = Math.floor(remainingQuantity / baseQty)
    
    if (unitCount > 0) {
      breakdown.push({
        unit_name: unit.unit_name,
        unit_abbreviation: unit.unit_abbreviation,
        quantity: unitCount,
        base_unit_quantity: baseQty,
        is_base_unit: unit.is_base_unit || false
      })
      
      remainingQuantity -= unitCount * baseQty
    }
  }

  // Build display text
  const displayParts = breakdown.map(item => 
    `${item.quantity} ${item.unit_abbreviation || item.unit_name}`
  )
  const display_text = displayParts.length > 0 
    ? displayParts.join(' + ') 
    : `${quantity} units`

  return {
    total_base_quantity: quantity,
    breakdown,
    display_text
  }
}

/**
 * Get a compact packaging display string
 * @param breakdown PackagingBreakdown object
 * @returns Formatted string like "2 CTN + 3 PACK + 4 BTL"
 */
export function getPackagingDisplayText(breakdown: PackagingBreakdown | null): string {
  if (!breakdown || breakdown.breakdown.length === 0) {
    return ''
  }
  return breakdown.display_text
}

/**
 * Get a detailed packaging display with full unit names
 * @param breakdown PackagingBreakdown object
 * @returns Formatted string like "2 Cartons + 3 Packs + 4 Bottles"
 */
export function getPackagingDetailedText(breakdown: PackagingBreakdown | null): string {
  if (!breakdown || breakdown.breakdown.length === 0) {
    return ''
  }
  
  const parts = breakdown.breakdown.map(item => {
    const unitName = item.quantity === 1 ? item.unit_name : `${item.unit_name}s`
    return `${item.quantity} ${unitName}`
  })
  
  return parts.join(' + ')
}

/**
 * Format packaging for display in a form or table
 * @param quantity The quantity in base units
 * @param packagingUnits Array of packaging units
 * @returns Object with breakdown and formatted strings
 */
export function formatPackagingForDisplay(
  quantity: number,
  packagingUnits?: PackagingUnit[]
): {
  breakdown: PackagingBreakdown | null
  shortText: string
  detailedText: string
  hasPackaging: boolean
} {
  const breakdown = calculatePackagingBreakdown(quantity, packagingUnits)
  
  return {
    breakdown,
    shortText: getPackagingDisplayText(breakdown),
    detailedText: getPackagingDetailedText(breakdown),
    hasPackaging: !!breakdown && breakdown.breakdown.length > 0
  }
}
