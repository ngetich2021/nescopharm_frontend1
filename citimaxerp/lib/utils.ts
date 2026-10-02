import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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
