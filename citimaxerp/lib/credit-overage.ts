// How much a purchase exceeds a customer's available credit by, if at all.
// Returns 0 when there's no limit on file (nothing to exceed) or the purchase fits.
// Rounded to the cent so it matches what's shown on screen exactly - otherwise
// float noise from upstream tax/discount math (e.g. 39447.705999998) can make a
// figure that displays as "39,447.71" never actually equal 39447.71.
export function getCreditOverage(total: number, availableCredit: string | number | null | undefined): number {
  if (availableCredit === null || availableCredit === undefined) return 0
  const available = Number(availableCredit)
  if (!Number.isFinite(available)) return 0
  const overage = total - available
  return overage > 0 ? Math.round(overage * 100) / 100 : 0
}

// Whether a typed-in payment amount covers the overage, tolerant of float
// rounding noise (half a cent either way) so an amount that looks equal on
// screen is actually treated as equal.
export function coversOverage(paidAmount: number, overage: number): boolean {
  return paidAmount >= overage - 0.005
}
