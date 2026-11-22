"use client"

import { CalendarRange } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { displayDate } from "@/lib/date-format"

// A period picker for lists: All time, This month, Last month, This year or Custom (From / To).
// Values are yyyy-mm-dd days; a list keeps a row when its date falls inside (both ends included).

export type PeriodPreset = "all" | "this-month" | "last-month" | "this-year" | "custom"

export interface Period {
  preset: PeriodPreset
  from: string // yyyy-mm-dd, "" = open
  to: string
}

export const ALL_TIME: Period = { preset: "all", from: "", to: "" }

const pad = (n: number) => String(n).padStart(2, "0")
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export function presetPeriod(preset: PeriodPreset, today = new Date()): Period {
  const y = today.getFullYear()
  const m = today.getMonth()
  switch (preset) {
    case "this-month":
      return { preset, from: dayKey(new Date(y, m, 1)), to: dayKey(new Date(y, m + 1, 0)) }
    case "last-month":
      return { preset, from: dayKey(new Date(y, m - 1, 1)), to: dayKey(new Date(y, m, 0)) }
    case "this-year":
      return { preset, from: `${y}-01-01`, to: `${y}-12-31` }
    case "custom":
      return { preset, from: dayKey(new Date(y, m, 1)), to: dayKey(today) }
    default:
      return ALL_TIME
  }
}

/** The calendar day (yyyy-mm-dd) of an API date: "2026-11-04" stays that day; a timestamp uses local time. */
export function toDayKey(value: string | null | undefined): string {
  if (!value) return ""
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const d = new Date(value)
  return isNaN(d.getTime()) ? String(value).slice(0, 10) : dayKey(d)
}

export function inPeriod(value: string | null | undefined, period: Period): boolean {
  if (!period.from && !period.to) return true
  const day = toDayKey(value)
  if (!day) return false
  return (!period.from || day >= period.from) && (!period.to || day <= period.to)
}

/** "01/11/2026 to 30/11/2026", or "All time". */
export function periodLabel(period: Period): string {
  if (!period.from && !period.to) return "All time"
  if (!period.to) return `From ${displayDate(period.from)}`
  if (!period.from) return `Up to ${displayDate(period.to)}`
  return `${displayDate(period.from)} to ${displayDate(period.to)}`
}

const PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "this-month", label: "This month" },
  { value: "last-month", label: "Last month" },
  { value: "this-year", label: "This year" },
  { value: "custom", label: "Custom range" },
]

interface PeriodFilterProps {
  value: Period
  onChange: (period: Period) => void
}

export function PeriodFilter({ value, onChange }: PeriodFilterProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <CalendarRange className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
        <Select value={value.preset} onValueChange={(p) => onChange(presetPeriod(p as PeriodPreset))}>
          <SelectTrigger className="w-[160px] pl-8" aria-label="Period">
            <SelectValue placeholder="Period" />
          </SelectTrigger>
          <SelectContent>
            {PRESETS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {value.preset === "custom" && (
        <div className="flex items-center gap-2">
          <Input
            type="date"
            aria-label="From"
            className="w-[150px]"
            value={value.from}
            max={value.to || undefined}
            onChange={(e) => onChange({ ...value, from: e.target.value })}
          />
          <span className="text-sm text-muted-foreground">to</span>
          <Input
            type="date"
            aria-label="To"
            className="w-[150px]"
            value={value.to}
            min={value.from || undefined}
            onChange={(e) => onChange({ ...value, to: e.target.value })}
          />
        </div>
      )}
    </div>
  )
}
