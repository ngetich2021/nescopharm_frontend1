"use client"

import { useCallback, useEffect, useState, type ReactNode } from "react"
import { format, startOfMonth, startOfWeek, subDays } from "date-fns"
import { Loader2, RefreshCw, TrendingUp, Wallet, Receipt, FileText } from "lucide-react"
import { PermissionGuard } from "@/components/PermissionGuard"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ExportMenu, useTableExport } from "@/components/export-menu"
import { useToast } from "@/hooks/use-toast"
import { displayDate } from "@/lib/date-format"
import { getRepRoi, type RepRoiResponse, type RepRoiRow } from "@/lib/employees"

type Group = "day" | "week" | "month"
const iso = (d: Date) => format(d, "yyyy-MM-dd")
const kes = (n: number) => n.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const roiText = (r: number | null) => (r === null ? "—" : `${r.toLocaleString("en-KE", { maximumFractionDigits: 2 })}x`)
const dmy = (s?: string) => (s ? displayDate(new Date(`${s}T00:00:00`)) : "")

function periodLabel(row: RepRoiRow, group: Group) {
  if (group === "day") return dmy(row.period_start)
  if (group === "month") return row.period_start ? format(new Date(`${row.period_start}T00:00:00`), "MMMM yyyy") : row.period ?? ""
  return `${dmy(row.period_start)} - ${dmy(row.period_end)}`
}

// Green when the rep invoices well over the allowance, red when under it.
function RoiBadge({ roi }: { roi: number | null }) {
  if (roi === null) return <span className="text-muted-foreground">—</span>
  const cls = roi >= 10 ? "bg-green-100 text-green-800" : roi >= 1 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"
  return <Badge className={cls}>{roiText(roi)}</Badge>
}

/**
 * ROI for Reps: allowances paid to each sales rep outside payroll (one-time ones from HR > Allowances,
 * monthly disbursed ones) against what was invoiced under the rep, by day, week or month.
 */
export default function RepRoiPage() {
  const { toast } = useToast()
  const [from, setFrom] = useState(() => iso(startOfMonth(new Date())))
  const [to, setTo] = useState(() => iso(new Date()))
  const [group, setGroup] = useState<Group>("week")
  const [data, setData] = useState<RepRoiResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData(await getRepRoi({ date_from: from, date_to: to, group }))
    } catch (e: any) {
      toast({ title: "Could not load ROI for Reps", description: e?.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [from, to, group, toast])

  useEffect(() => { load() }, [load])

  const preset = (p: string) => {
    const today = new Date()
    if (p === "today") { setFrom(iso(today)); setTo(iso(today)); setGroup("day") }
    if (p === "week") { setFrom(iso(startOfWeek(today, { weekStartsOn: 1 }))); setTo(iso(today)); setGroup("day") }
    if (p === "month") { setFrom(iso(startOfMonth(today))); setTo(iso(today)); setGroup("week") }
    if (p === "90") { setFrom(iso(subDays(today, 89))); setTo(iso(today)); setGroup("month") }
  }

  const range = `${dmy(from)} to ${dmy(to)}`
  const exportReport = useTableExport(() => ({
    fileName: `roi-for-reps-${from}-to-${to}`,
    title: "ROI for Reps",
    subtitle: `${range} · by ${group}`,
    headers: ["S/No", "Period", "Rep", "Employee #", "Allowance (KES)", "Invoices", "Invoiced (KES)", "ROI"],
    moneyColumns: [4, 6],
    rows: (data?.rows ?? []).map((r, i) => [i + 1, periodLabel(r, group), r.name, r.employee_number ?? "", r.allowance, r.invoices, r.invoiced, roiText(r.roi)]),
    footer: data ? [["", "", "Total", "", data.totals.allowance, data.totals.invoices, data.totals.invoiced, roiText(data.totals.roi)]] : undefined,
  }))

  return (
    <PermissionGuard permissions={["can_view_reports_menu", "can_view_employees", "can_manage_system", "can_manage_company"]}>
      <div className="space-y-6 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">ROI for Reps</h1>
            <p className="text-muted-foreground">
              Allowances paid to each sales rep against the invoices raised under them. ROI = invoiced ÷ allowance (KES invoiced per KES 1 paid).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <ExportMenu onExport={exportReport} size="default" disabled={loading || !data?.rows.length} />
          </div>
        </div>

        <Card>
          <CardContent className="flex flex-wrap items-end gap-3 pt-6">
            <div>
              <Label className="text-xs text-muted-foreground">Quick range</Label>
              <Select onValueChange={preset}>
                <SelectTrigger className="w-[150px]"><SelectValue placeholder="Choose..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This week</SelectItem>
                  <SelectItem value="month">This month</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">From</Label>
              <Input type="date" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} className="w-[160px]" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">To</Label>
              <Input type="date" value={to} onChange={(e) => e.target.value && setTo(e.target.value)} className="w-[160px]" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Show by</Label>
              <Select value={group} onValueChange={(v) => setGroup(v as Group)}>
                <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Day</SelectItem>
                  <SelectItem value="week">Week</SelectItem>
                  <SelectItem value="month">Month</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-4">
          <Stat icon={<Wallet className="h-5 w-5" />} tone="bg-emerald-100 text-emerald-700" label="Allowances paid" value={`KES ${kes(data?.totals.allowance ?? 0)}`} />
          <Stat icon={<Receipt className="h-5 w-5" />} tone="bg-blue-100 text-blue-700" label="Invoiced under reps" value={`KES ${kes(data?.totals.invoiced ?? 0)}`} />
          <Stat icon={<FileText className="h-5 w-5" />} tone="bg-slate-100 text-slate-600" label="Invoices" value={String(data?.totals.invoices ?? 0)} />
          <Stat icon={<TrendingUp className="h-5 w-5" />} tone="bg-rose-100 text-rose-700" label="Overall ROI" value={roiText(data?.totals.roi ?? null)} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>By rep</CardTitle>
            <CardDescription>{range}</CardDescription>
          </CardHeader>
          <CardContent>
            <RoiTable loading={loading} rows={data?.reps ?? []} totals={data?.totals} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>By {group}</CardTitle>
            <CardDescription>Each rep&apos;s allowance and invoices in each {group}.</CardDescription>
          </CardHeader>
          <CardContent>
            <RoiTable loading={loading} rows={data?.rows ?? []} periodOf={(r) => periodLabel(r, group)} />
          </CardContent>
        </Card>
      </div>
    </PermissionGuard>
  )
}

function Stat({ icon, tone, label, value }: { icon: ReactNode; tone: string; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between p-5">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
        </div>
        <div className={`rounded-lg p-2 ${tone}`}>{icon}</div>
      </CardContent>
    </Card>
  )
}

function RoiTable({ loading, rows, totals, periodOf }: {
  loading: boolean
  rows: RepRoiRow[]
  totals?: RepRoiResponse["totals"]
  periodOf?: (r: RepRoiRow) => string
}) {
  const cols = periodOf ? 7 : 6
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-14">S/No</TableHead>
            {periodOf && <TableHead>Period</TableHead>}
            <TableHead>Rep</TableHead>
            <TableHead className="text-right">Allowance (KES)</TableHead>
            <TableHead className="text-right">Invoices</TableHead>
            <TableHead className="text-right">Invoiced (KES)</TableHead>
            <TableHead className="text-right">ROI</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow><TableCell colSpan={cols} className="py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></TableCell></TableRow>
          ) : rows.length === 0 ? (
            <TableRow><TableCell colSpan={cols} className="py-10 text-center text-muted-foreground">No allowances or rep invoices in this range.</TableCell></TableRow>
          ) : (
            rows.map((r, i) => (
              <TableRow key={`${r.rep_key}-${r.period ?? ""}`}>
                <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                {periodOf && <TableCell className="whitespace-nowrap">{periodOf(r)}</TableCell>}
                <TableCell>
                  <div className="font-medium">{r.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {[r.employee_number, r.position].filter(Boolean).join(" · ")}
                    {!r.linked && <span className="text-amber-700"> · no user account linked, so no invoices can be counted</span>}
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">{r.allowance ? kes(r.allowance) : "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{r.invoices || "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{r.invoiced ? kes(r.invoiced) : "—"}</TableCell>
                <TableCell className="text-right"><RoiBadge roi={r.roi} /></TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
        {!loading && totals && rows.length > 0 && (
          <TableFooter>
            <TableRow>
              <TableCell colSpan={2} className="font-semibold">Total</TableCell>
              <TableCell className="text-right font-semibold tabular-nums">{kes(totals.allowance)}</TableCell>
              <TableCell className="text-right font-semibold tabular-nums">{totals.invoices}</TableCell>
              <TableCell className="text-right font-semibold tabular-nums">{kes(totals.invoiced)}</TableCell>
              <TableCell className="text-right"><RoiBadge roi={totals.roi} /></TableCell>
            </TableRow>
          </TableFooter>
        )}
      </Table>
    </div>
  )
}
