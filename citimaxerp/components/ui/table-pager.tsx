"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChevronLeft, ChevronRight } from "lucide-react"

// Client-side paging for a plain table: rows-per-page choices plus "All".
export const ALL_ROWS = 0
const DEFAULT_SIZES = [10, 25, 50, 100]

export function usePaged<T>(rows: T[], initialSize = 10) {
  const [pageSize, setPageSize] = useState(initialSize)
  const [page, setPage] = useState(1)
  const size = pageSize === ALL_ROWS ? Math.max(rows.length, 1) : pageSize
  const pageCount = Math.max(1, Math.ceil(rows.length / size))
  // Back to a page that exists when the rows shrink (filters, search).
  useEffect(() => { if (page > pageCount) setPage(pageCount) }, [page, pageCount])
  const start = (Math.min(page, pageCount) - 1) * size
  return {
    pageRows: rows.slice(start, start + size),
    start, // index of the first row shown, for S/No
    pager: { total: rows.length, page: Math.min(page, pageCount), pageCount, pageSize, start, shown: Math.min(size, rows.length - start), setPage, setPageSize },
  }
}

interface TablePagerProps {
  total: number
  page: number
  pageCount: number
  pageSize: number
  start: number
  shown: number
  setPage: (page: number) => void
  setPageSize: (size: number) => void
  sizes?: number[]
}

export function TablePager({ total, page, pageCount, pageSize, start, shown, setPage, setPageSize, sizes = DEFAULT_SIZES }: TablePagerProps) {
  if (total === 0) return null
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 text-sm text-muted-foreground">
      <div className="flex items-center gap-3">
        <span>Showing {start + 1}–{start + shown} of {total}</span>
        <span className="flex items-center gap-2">
          Rows per page
          <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1) }}>
            <SelectTrigger className="h-8 w-[80px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {sizes.map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
              <SelectItem value={String(ALL_ROWS)}>All</SelectItem>
            </SelectContent>
          </Select>
        </span>
      </div>
      {pageCount > 1 && (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage(page - 1)} disabled={page <= 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span>Page {page} of {pageCount}</span>
          <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={page >= pageCount}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
