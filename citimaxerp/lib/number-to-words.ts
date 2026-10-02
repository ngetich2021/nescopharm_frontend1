const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
]

const TENS = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
]

function chunkToWords(n: number): string {
  if (n === 0) return ""
  if (n < 20) return ONES[n]
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : "")
  return ONES[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + chunkToWords(n % 100) : "")
}

/** Indian-style grouping (Crore/Lakh) matches the Tally invoice format this is modeled on. */
function integerToWords(value: number): string {
  if (value === 0) return "Zero"

  const crore = Math.floor(value / 10000000)
  value %= 10000000
  const lakh = Math.floor(value / 100000)
  value %= 100000
  const thousand = Math.floor(value / 1000)
  value %= 1000
  const hundred = value

  const parts: string[] = []
  if (crore) parts.push(chunkToWords(crore) + " Crore")
  if (lakh) parts.push(chunkToWords(lakh) + " Lakh")
  if (thousand) parts.push(chunkToWords(thousand) + " Thousand")
  if (hundred) parts.push(chunkToWords(hundred))

  return parts.join(" ")
}

/**
 * Spells out a currency amount the way Kenyan/Tally-style invoices print
 * "Amount Chargeable (in words)", e.g. 4939.20 ->
 * "Kenyan Shilling Four Thousand Nine Hundred Thirty Nine and Twenty Cent Only".
 */
export function amountInWords(amount: number | string, currencyName = "Kenyan Shilling"): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount
  if (!isFinite(num)) return ""

  const whole = Math.floor(Math.abs(num))
  const cents = Math.round((Math.abs(num) - whole) * 100)

  const wholeWords = integerToWords(whole)
  let result = `${currencyName} ${wholeWords}`

  if (cents > 0) {
    result += ` and ${integerToWords(cents)} Cent`
  }

  return `${result} Only`
}
