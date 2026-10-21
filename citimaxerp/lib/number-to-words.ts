const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
]

const TENS = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
]

// Kenya groups in thousands (Thousand / Million / Billion), not the Lakh/Crore of the Tally
// template this was first modelled on - KES 150,000 is "One Hundred Fifty Thousand".
const SCALES = ["", "Thousand", "Million", "Billion", "Trillion"]

function chunkToWords(n: number): string {
  if (n === 0) return ""
  if (n < 20) return ONES[n]
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? "-" + ONES[n % 10] : "")
  return ONES[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " and " + chunkToWords(n % 100) : "")
}

function integerToWords(value: number): string {
  if (value === 0) return "Zero"

  const parts: string[] = []
  for (let scale = 0; value > 0; scale++, value = Math.floor(value / 1000)) {
    const chunk = value % 1000
    if (chunk) parts.unshift(chunkToWords(chunk) + (SCALES[scale] ? " " + SCALES[scale] : ""))
  }
  return parts.join(" ")
}

/**
 * Spells out a currency amount for "Amount Chargeable (in words)", e.g. 154939.20 ->
 * "Kenya Shillings One Hundred and Fifty-Four Thousand Nine Hundred and Thirty-Nine and Twenty Cents Only".
 */
export function amountInWords(amount: number | string, currencyName = "Kenya Shillings"): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount
  if (!isFinite(num)) return ""

  // Work in whole cents so 0.995-style float noise can't produce "100 cents".
  const totalCents = Math.round(Math.abs(num) * 100)
  const whole = Math.floor(totalCents / 100)
  const cents = totalCents % 100

  let result = `${currencyName} ${integerToWords(whole)}`
  if (cents > 0) result += ` and ${integerToWords(cents)} ${cents === 1 ? "Cent" : "Cents"}`

  return `${result} Only`
}
