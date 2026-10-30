"use client"

import * as React from "react"
import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useOptionalAuth } from "@/lib/auth-context"
import { exportTable, type ExportCell, type ExportFormat } from "@/lib/table-export"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Download, FileDown, FileSpreadsheet, FileText, Loader2 } from "lucide-react"

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  filterColumn?: string // Optional prop for column to filter by
  exportFileName?: string // Optional prop for export file name
  onExport?: (data: TData[]) => void // Optional callback for custom export logic
  hideSearch?: boolean // Hide the search input
  hideExport?: boolean // Hide the export button
  hideColumns?: boolean // Hide the columns dropdown
  pageSizeOptions?: number[] // Rows-per-page choices (first is the default), plus "All"
  footer?: React.ReactNode // Footer rows (<TableRow>s) under the table, e.g. totals
  exportTitle?: string // Heading on exports (default: from exportFileName)
  exportSubtitle?: string // e.g. the period
  exportFooter?: ExportCell[][] // Rows under the exported table, e.g. totals
}

// "All" rows on one page.
const ALL_ROWS = Number.MAX_SAFE_INTEGER

export function DataTable<TData, TValue>({
  columns,
  data,
  filterColumn,
  exportFileName = "data",
  onExport,
  hideSearch = false,
  hideExport = false,
  hideColumns = false,
  pageSizeOptions,
  footer,
  exportTitle,
  exportSubtitle,
  exportFooter,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = React.useState({})

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    initialState: pageSizeOptions?.length ? { pagination: { pageIndex: 0, pageSize: pageSizeOptions[0] } } : undefined,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  })

  const company = useOptionalAuth()?.userProfile?.company
  const [exporting, setExporting] = React.useState(false)

  // Every row matching the search and sort (not just the page shown), as CSV, Excel or PDF
  // headed with the company letterhead.
  const handleExport = async (format: ExportFormat) => {
    const cols = table
      .getAllColumns()
      .filter((column) => column.getIsVisible() && column.accessorFn && !["select", "actions"].includes(column.id))
    const label = (column: (typeof cols)[number]) => {
      const meta = column.columnDef.meta as { exportHeader?: string } | undefined
      const header = column.columnDef.header
      return meta?.exportHeader ?? (header as { exportLabel?: string } | undefined)?.exportLabel ?? (typeof header === "string" ? header : column.id.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()))
    }
    const value = (v: unknown): ExportCell => {
      if (v == null) return ""
      if (typeof v === "number") return v
      if (typeof v === "object") return JSON.stringify(v)
      // Amounts sent as strings ("1200.50") export as numbers; codes like "0712..." stay text.
      return /^-?\d+\.\d+$/.test(String(v)) ? Number(v) : String(v)
    }
    setExporting(true)
    try {
      await exportTable(format, {
        fileName: exportFileName,
        title: exportTitle ?? exportFileName.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        subtitle: exportSubtitle,
        headers: cols.map(label),
        rows: table.getPrePaginationRowModel().rows.map((row) => cols.map((c) => value(row.getValue(c.id)))),
        footer: exportFooter,
      }, company)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="w-full">
      {(!hideSearch || !hideExport || !hideColumns) && (
        <div className="flex items-center py-4">
          {!hideSearch && filterColumn && (
            <Input
              placeholder={`Search ${filterColumn}...`}
              value={(table.getColumn(filterColumn)?.getFilterValue() as string) ?? ""}
              onChange={(event) => table.getColumn(filterColumn)?.setFilterValue(event.target.value)}
              className="max-w-sm"
            />
          )}
          {(!hideExport || !hideColumns) && (
            <div className="ml-auto flex space-x-2">
              {!hideExport && onExport && (
                <Button variant="outline" onClick={() => onExport(data)} size="sm">
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
              )}
              {!hideExport && !onExport && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" disabled={exporting}>
                      {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                      Export
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleExport("xlsx")}>
                      <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel (.xlsx)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExport("pdf")}>
                      <FileText className="mr-2 h-4 w-4" /> PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExport("csv")}>
                      <FileDown className="mr-2 h-4 w-4" /> CSV
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {!hideColumns && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      Columns
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {table
                      .getAllColumns()
                      .filter((column) => column.getCanHide())
                      .map((column) => {
                        return (
                          <DropdownMenuCheckboxItem
                            key={column.id}
                            className="capitalize"
                            checked={column.getIsVisible()}
                            onCheckedChange={(value) => column.toggleVisibility(!!value)}
                          >
                            {column.id}
                          </DropdownMenuCheckboxItem>
                        )
                      })}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          )}
        </div>
      )}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          {footer && <TableFooter>{footer}</TableFooter>}
        </Table>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2 py-4">
        {pageSizeOptions?.length ? (
          (() => {
            const { pageIndex, pageSize } = table.getState().pagination
            const total = table.getFilteredRowModel().rows.length
            const from = total ? pageIndex * pageSize + 1 : 0
            const to = Math.min(total, (pageIndex + 1) * pageSize)
            return (
              <div className="flex flex-1 flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span>Showing {from}–{to} of {total}</span>
                <span className="flex items-center gap-2">
                  Rows per page
                  <Select
                    value={String(pageSize)}
                    onValueChange={(v) => { table.setPageSize(Number(v)); table.setPageIndex(0) }}
                  >
                    <SelectTrigger className="h-8 w-[80px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {pageSizeOptions.map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                      <SelectItem value={String(ALL_ROWS)}>All</SelectItem>
                    </SelectContent>
                  </Select>
                </span>
                {table.getPageCount() > 1 && <span>Page {pageIndex + 1} of {table.getPageCount()}</span>}
              </div>
            )
          })()
        ) : (
          <div className="flex-1 text-sm text-muted-foreground">
            {table.getFilteredSelectedRowModel().rows.length} of {table.getFilteredRowModel().rows.length} row(s)
            selected.
          </div>
        )}
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
