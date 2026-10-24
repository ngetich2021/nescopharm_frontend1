"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getLogisticsReport } from "@/lib/reports"
import { DataTable } from "@/components/ui/data-table"
import { PermissionGuard } from "@/components/PermissionGuard"
import { useToast } from "@/hooks/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Truck, Clock, CheckCircle, AlertCircle, ArrowUpDown, PackageCheck, Timer, Ban } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Period = "this_month" | "last_30_days" | "this_year" | "all"

// Local date (toISOString is UTC and shifts the day around midnight in Kenya).
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
const periodStart = (p: Period): string | undefined => {
  const now = new Date()
  if (p === "this_month") return ymd(new Date(now.getFullYear(), now.getMonth(), 1))
  if (p === "this_year") return ymd(new Date(now.getFullYear(), 0, 1))
  if (p === "last_30_days") { now.setDate(now.getDate() - 30); return ymd(now) }
  return undefined
}

// Numbers can arrive as strings from the database; never call number methods on raw values.
const hrs = (v: unknown) => (v === null || v === undefined || v === "" ? "-" : `${Number(v).toFixed(1)} h`)
const when = (v: unknown) => (v ? new Date(String(v).replace(" ", "T")).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-")

const sortable = (label: string) => ({ column }: any) => (
  <button type="button" className="inline-flex items-center gap-1 font-medium hover:text-foreground" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
    {label}
    <ArrowUpDown className="h-3.5 w-3.5 opacity-60" />
  </button>
)
// Missing values sort to the end.
const numOrNull = (key: string) => (row: any) => (row[key] === null || row[key] === undefined ? Number.POSITIVE_INFINITY : Number(row[key]))

const STATUS_STYLE: Record<string, string> = {
  delivered: "bg-green-100 text-green-800",
  in_transit: "bg-blue-100 text-blue-800",
  approved: "bg-indigo-100 text-indigo-800",
  pending: "bg-yellow-100 text-yellow-800",
  draft: "bg-gray-100 text-gray-700",
  cancelled: "bg-red-100 text-red-800",
  rejected: "bg-red-100 text-red-800",
}

export default function LogisticsReportPage() {
  const [reportType, setReportType] = useState<"efficiency" | "success_rate">("efficiency")
  const [period, setPeriod] = useState<Period>("this_year")
  // Each tab keeps its own data, so switching tabs never renders one tab's data with the other's layout.
  const [efficiency, setEfficiency] = useState<{ data: any[]; summary: any } | null>(null)
  const [success, setSuccess] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()
  const latestRequest = useRef(0)

  const fetchReport = useCallback(async () => {
    const requestId = ++latestRequest.current
    setLoading(true)
    try {
      const resp = await getLogisticsReport(reportType, periodStart(period))
      if (requestId !== latestRequest.current) return
      if (resp?.status !== "success") throw new Error(resp?.message || "Could not load the report")
      if (reportType === "efficiency") {
        setEfficiency({ data: Array.isArray(resp.data) ? resp.data : [], summary: resp.summary ?? {} })
      } else {
        setSuccess(resp.data ?? {})
      }
    } catch (error: any) {
      if (requestId !== latestRequest.current) return
      toast({ title: "Error", description: error.message || "Failed to fetch logistics report", variant: "destructive" })
    } finally {
      if (requestId === latestRequest.current) setLoading(false)
    }
  }, [reportType, period, toast])

  useEffect(() => {
    fetchReport()
  }, [fetchReport])

  const efficiencyColumns = [
    { accessorKey: "dispatch_number", header: sortable("Dispatch") },
    { accessorKey: "order_number", header: sortable("Order") },
    { accessorKey: "customer", header: sortable("Customer") },
    { accessorKey: "county", header: sortable("County"), cell: ({ row }: any) => row.original.county || "-" },
    {
      accessorKey: "status",
      header: sortable("Status"),
      cell: ({ row }: any) => (
        <span className={cn("rounded px-2 py-0.5 text-xs font-medium capitalize", STATUS_STYLE[row.original.status] ?? "bg-gray-100 text-gray-700")}>
          {String(row.original.status ?? "-").replace("_", " ")}
        </span>
      ),
    },
    { accessorKey: "raised_at", header: sortable("Raised"), cell: ({ row }: any) => when(row.original.raised_at) },
    { accessorKey: "approved_at", header: sortable("Approved"), cell: ({ row }: any) => when(row.original.approved_at) },
    { accessorKey: "delivered_at", header: sortable("Delivered"), cell: ({ row }: any) => when(row.original.delivered_at) },
    { id: "hours_to_approve", accessorFn: numOrNull("hours_to_approve"), header: sortable("To Approve"), cell: ({ row }: any) => hrs(row.original.hours_to_approve) },
    { id: "hours_to_deliver", accessorFn: numOrNull("hours_to_deliver"), header: sortable("To Deliver"), cell: ({ row }: any) => hrs(row.original.hours_to_deliver) },
  ]

  const stat = (title: string, value: any, Icon: any, color: string, note?: string) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={cn("h-4 w-4", color)} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value ?? 0}</div>
        {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
      </CardContent>
    </Card>
  )

  return (
    <PermissionGuard permissions={["can_view_reports_menu", "can_view_logistics_reports", "can_manage_system", "can_manage_company"]}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Logistics Reports</h1>
            <p className="text-sm text-gray-600">How quickly dispatches are approved and delivered, and how many arrive</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
              <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="this_month">This month</SelectItem>
                <SelectItem value="last_30_days">Last 30 days</SelectItem>
                <SelectItem value="this_year">This year</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={fetchReport} variant="outline" size="sm" disabled={loading}>Refresh</Button>
          </div>
        </div>

        <Tabs value={reportType} onValueChange={(v: any) => setReportType(v)}>
          <TabsList>
            <TabsTrigger value="efficiency">Efficiency</TabsTrigger>
            <TabsTrigger value="success_rate">Success Rate</TabsTrigger>
          </TabsList>

          <TabsContent value="efficiency" className="mt-6 space-y-4">
            {loading && !efficiency ? (
              <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-3">
                  {stat("Dispatches", efficiency?.summary?.dispatches, Truck, "text-muted-foreground", "Raised in the period")}
                  {stat("Avg time to approve", hrs(efficiency?.summary?.avg_hours_to_approve), Timer, "text-indigo-500", "From raised to final approval")}
                  {stat("Avg time to deliver", hrs(efficiency?.summary?.avg_hours_to_deliver), Clock, "text-blue-500", "From approval to delivery")}
                </div>
                <DataTable
                  columns={efficiencyColumns}
                  data={efficiency?.data ?? []}
                  filterColumn="customer"
                  exportFileName="logistics_efficiency_report"
                />
                <p className="text-xs text-muted-foreground">
                  Times show &quot;-&quot; where a step hasn&apos;t happened yet, or for past sales brought across from the old system (delivered before their dispatch record existed).
                </p>
              </>
            )}
          </TabsContent>

          <TabsContent value="success_rate" className="mt-6">
            {loading && !success ? (
              <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {stat("Delivery rate", `${Number(success?.delivery_rate ?? 0).toFixed(1)}%`, PackageCheck, "text-green-600", "Delivered, of dispatches not cancelled")}
                {stat("Total dispatches", success?.total_dispatches, Truck, "text-muted-foreground")}
                {stat("Delivered", success?.delivered, CheckCircle, "text-green-500")}
                {stat("In transit", success?.in_transit, Truck, "text-blue-500")}
                {stat("Approved, awaiting dispatch", success?.awaiting_dispatch, Clock, "text-indigo-500")}
                {stat("Pending approval", success?.pending, Clock, "text-yellow-500")}
                {stat("Failed / returned", success?.failed_or_returned, AlertCircle, "text-red-500")}
                {stat("Cancelled / rejected", success?.cancelled, Ban, "text-red-500")}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </PermissionGuard>
  )
}
