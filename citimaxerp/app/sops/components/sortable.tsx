"use client"

import { useMemo, useState } from "react"
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"
import { TableHead } from "@/components/ui/table"

type SortValue = string | number | null | undefined

/** Rows sorted by the clicked column; click again to flip. Blanks always go last. */
export function useSorted<T, K extends string>(rows: T[], value: (row: T, key: K) => SortValue, initialKey: K, initialDir: "asc" | "desc" = "desc") {
  const [sortKey, setSortKey] = useState<K>(initialKey)
  const [sortDir, setSortDir] = useState<"asc" | "desc">(initialDir)

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1
    return [...rows].sort((a, b) => {
      const av = value(a, sortKey), bv = value(b, sortKey)
      const aBlank = av === null || av === undefined || av === "", bBlank = bv === null || bv === undefined || bv === ""
      if (aBlank || bBlank) return aBlank === bBlank ? 0 : aBlank ? 1 : -1
      const cmp = typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av).localeCompare(String(bv), undefined, { sensitivity: "base", numeric: true })
      return cmp * dir
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sortKey, sortDir])

  const toggle = (key: K) => {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else { setSortKey(key); setSortDir("asc") }
  }

  return { sorted, sortKey, sortDir, toggle }
}

export function SortHead<K extends string>({ label, column, sortKey, sortDir, onSort, className }: {
  label: string
  column: K
  sortKey: K
  sortDir: "asc" | "desc"
  onSort: (key: K) => void
  className?: string
}) {
  return (
    <TableHead className={className}>
      <button type="button" className="inline-flex items-center gap-1 font-semibold hover:text-foreground" onClick={() => onSort(column)}>
        {label}
        {sortKey !== column ? <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
          : sortDir === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
      </button>
    </TableHead>
  )
}
