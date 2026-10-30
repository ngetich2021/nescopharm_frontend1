import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Whether a document number matches what was typed, however it was typed: "NSK/0427",
// "nsk 427", "NSK427" and "0427" all find NSK/0427 (mirrors Invoice::scopeWhereNumberMatches).
export function matchesDocNumber(number: string | null | undefined, query: string): boolean {
  if (!number || !query.trim()) return false
  const squash = (s: string) => s.toLowerCase().replace(/[\s/-]/g, "")
  if (squash(number).includes(squash(query))) return true
  const typed = query.trim().match(/^(?:nsk\s*[/-]?\s*)?0*(\d+)$/i)
  const nsk = number.match(/^NSK\/0*(\d+)$/i)
  return !!typed && !!nsk && typed[1] === nsk[1]
}

export function formatCurrency(amount: number | string): string {
  // Convert to number and handle invalid amounts
  let numericAmount = Number(amount)
  if (isNaN(numericAmount) || !isFinite(numericAmount)) {
    numericAmount = 0
  }
  
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numericAmount).replace('KES', 'Ksh.')
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("en-KE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date))
}

export function toSentenceCase(str: string): string {
  if (!str) return str
  
  // Convert underscores and hyphens to spaces, then capitalize first letter of each word
  return str
    .replace(/[_-]/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}
