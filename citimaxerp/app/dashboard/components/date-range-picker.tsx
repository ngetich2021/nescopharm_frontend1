"use client"

import { CalendarIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

interface DateRangePickerProps {
  value: string
  onChange: (value: string) => void
}

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const ranges = [
    { label: "Today", value: "today" },
    { label: "Yesterday", value: "yesterday" },
    { label: "Last 7 days", value: "7d" },
    { label: "Last 30 days", value: "30d" },
    { label: "This month", value: "this-month" },
    { label: "Last month", value: "last-month" },
    { label: "This quarter", value: "this-quarter" },
    { label: "This year", value: "this-year" },
  ]

  const getDisplayText = () => {
    const range = ranges.find((r) => r.value === value)
    return range ? range.label : "Last 30 days"
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1">
          <CalendarIcon className="h-4 w-4" />
          <span>{getDisplayText()}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {ranges.map((range) => (
          <DropdownMenuItem key={range.value} onClick={() => onChange(range.value)} className="cursor-pointer">
            {range.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
