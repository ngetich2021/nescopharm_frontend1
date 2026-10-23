import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// The rates the server accepts on an order line (it snaps anything else to these).
const ORDER_VAT_RATES = [16, 8, 0]

// Per-line VAT on an order: starts at the product's rate and can be changed for this order,
// e.g. when an item that used to carry VAT no longer does.
export function OrderVatSelect({ value, onChange, label }: { value: number; onChange: (rate: number) => void; label?: string }) {
  return (
    <Select value={String(Number(value) || 0)} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger className="h-8 w-24" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ORDER_VAT_RATES.map((rate) => (
          <SelectItem key={rate} value={String(rate)}>
            {rate > 0 ? `${rate}%` : "No VAT"}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
