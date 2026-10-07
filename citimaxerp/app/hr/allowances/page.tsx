"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import * as XLSX from "xlsx"
import { format } from "date-fns"
import { ArrowDown, ArrowUp, ArrowUpDown, Download, Loader2, RefreshCw, Search, Users, Wallet, ListChecks } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { getDisbursedAllowances, type DisbursedAllowance } from "@/lib/employees"

type SortKey = "employee_number" | "employee_name" | "department" | "name" | "amount" | "is_taxable" | "updated_at"

const COLUMNS: { key: SortKey; label: string; align?: "right" }[] = [
  { key: "employee_number", label: "Employee #" },
  { key: "employee_name", label: "Employee" },
  { key: "department", label: "Department" },
  { key: "name", label: "Allowance" },
  { key: "amount", label: "Amount (KES)", align: "right" },
  { key: "is_taxable", label: "Taxable" },
  { key: "updated_at", label: "Last Updated" },
]

const kes = (n: number) => n.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function AllowancesPage() {
  const { toast } = useToast()
  const [month, setMonth] = useState(() => format(new Date(), "yyyy-MM"))
  const [rows, setRows] = useState<DisbursedAllowance[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("employee_name")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getDisbursedAllowances(month)
      setRows(res.data || [])
    } catch (error: any) {
      toast({ title: "Failed to load allowances", description: error.message, variant: "destructive" })
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [month, toast])

  useEffect(() => {
    load()
  }, [load])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = q
      ? rows.filter((r) =>
          [r.employee_number, r.employee_name, r.department, r.position, r.name].some((v) => v?.toLowerCase().includes(q)),
        )
      : rows

    return [...filtered].sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      let cmp: number
      if (typeof av === "number" && typeof bv === "number") cmp = av - bv
      else if (typeof av === "boolean" && typeof bv === "boolean") cmp = Number(av) - Number(bv)
      else cmp = String(av ?? "").localeCompare(String(bv ?? ""), undefined, { numeric: true, sensitivity: "base" })
      return sortDir === "asc" ? cmp : -cmp
    })
  }, [rows, search, sortKey, sortDir])

  const total = visible.reduce((sum, r) => sum + r.amount, 0)
  const employeeCount = new Set(visible.map((r) => r.employee_id)).size
  const monthLabel = format(new Date(`${month}-01T00:00:00`), "MMMM yyyy")

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else {
      setSortKey(key)
      setSortDir(key === "amount" ? "desc" : "asc")
    }
  }

  const exportExcel = () => {
    const data = visible.map((r, i) => ({
      "S/No": i + 1,
      "Employee #": r.employee_number ?? "",
      Employee: r.employee_name,
      Department: r.department ?? "",
      Position: r.position ?? "",
      Allowance: r.name,
      "Amount (KES)": r.amount,
      Taxable: r.is_taxable ? "Yes" : "No",
      "Last Updated": r.updated_at ? format(new Date(r.updated_at), "dd MMM yyyy HH:mm") : "",
    }))
    data.push({ "S/No": "" as any, "Employee #": "", Employee: "TOTAL", Department: "", Position: "", Allowance: "", "Amount (KES)": total, Taxable: "", "Last Updated": "" })

    const sheet = XLSX.utils.json_to_sheet(data)
    sheet["!cols"] = [{ wch: 6 }, { wch: 12 }, { wch: 26 }, { wch: 18 }, { wch: 18 }, { wch: 22 }, { wch: 14 }, { wch: 9 }, { wch: 18 }]
    const book = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(book, sheet, "Disbursed Allowances")
    XLSX.writeFile(book, `disbursed-allowances-${month}.xlsx`)
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Allowances</h1>
          <p className="text-muted-foreground">
            Allowances already paid out to employees outside payroll (marked &ldquo;Disbursed&rdquo; on the employee).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="w-[170px]" aria-label="Month" />
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={exportExcel} disabled={loading || visible.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export Excel
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-start justify-between p-5">
            <div>
              <p className="text-sm text-muted-foreground">Total disbursed · {monthLabel}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">KES {kes(total)}</p>
            </div>
            <div className="rounded-lg bg-emerald-100 p-2 text-emerald-700"><Wallet className="h-5 w-5" /></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-start justify-between p-5">
            <div>
              <p className="text-sm text-muted-foreground">Employees</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{employeeCount}</p>
            </div>
            <div className="rounded-lg bg-blue-100 p-2 text-blue-700"><Users className="h-5 w-5" /></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-start justify-between p-5">
            <div>
              <p className="text-sm text-muted-foreground">Allowance lines</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{visible.length}</p>
            </div>
            <div className="rounded-lg bg-slate-100 p-2 text-slate-600"><ListChecks className="h-5 w-5" /></div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <CardTitle>Disbursed allowances · {monthLabel}</CardTitle>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search employee, department, allowance..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14">S/No</TableHead>
                  {COLUMNS.map((col) => (
                    <TableHead key={col.key} className={col.align === "right" ? "text-right" : ""}>
                      <button
                        type="button"
                        onClick={() => toggleSort(col.key)}
                        className={`inline-flex items-center gap-1 hover:text-foreground ${col.align === "right" ? "flex-row-reverse" : ""}`}
                      >
                        {col.label}
                        {sortKey !== col.key ? (
                          <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
                        ) : sortDir === "asc" ? (
                          <ArrowUp className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={COLUMNS.length + 1} className="py-10 text-center">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : visible.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={COLUMNS.length + 1} className="py-10 text-center text-muted-foreground">
                      {search
                        ? "No allowances match your search."
                        : `No disbursed allowances for ${monthLabel}. Set an allowance's frequency to "Disbursed" on the employee to track it here.`}
                    </TableCell>
                  </TableRow>
                ) : (
                  visible.map((r, i) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium">{r.employee_number ?? "—"}</TableCell>
                      <TableCell>
                        <div>{r.employee_name}</div>
                        {r.position && <div className="text-xs text-muted-foreground">{r.position}</div>}
                      </TableCell>
                      <TableCell>{r.department ?? "—"}</TableCell>
                      <TableCell>{r.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{kes(r.amount)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={r.is_taxable ? "border-amber-200 bg-amber-50 text-amber-700" : ""}>
                          {r.is_taxable ? "Yes" : "No"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.updated_at ? format(new Date(r.updated_at), "dd MMM yyyy, HH:mm") : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              {!loading && visible.length > 0 && (
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={5} className="font-semibold">Total</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{kes(total)}</TableCell>
                    <TableCell colSpan={2} />
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
