"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { FinanceTableSkeleton } from "@/components/ui/skeletons"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Hourglass,
  Calendar,
  AlertTriangle,
  DollarSign,
  Clock,
  FileText,
} from "lucide-react"
import apiCall from "@/lib/api"
import { formatCurrency } from "@/lib/finance"
import { PermissionGuard } from "@/components/PermissionGuard"
import { useToast } from "@/hooks/use-toast"
import { format } from "date-fns"

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface AgingBucket {
  min: number
  max: number | null
  amount: number
  count: number
}

interface AgingBuckets {
  current: AgingBucket
  "31_60": AgingBucket
  "61_90": AgingBucket
  over_90: AgingBucket
}

interface ReceivableDetail {
  receivable: {
    id: string
    customer: { name: string }
    invoice_number: string
    invoice_date: string
    due_date: string
    total_amount: number
    paid_amount: number
    balance_amount: number
    status: string
  }
  days_past_due: number
  bucket: string
}

interface PayableDetail {
  payable: {
    id: string
    supplier: { name: string }
    invoice_number: string
    invoice_date: string
    due_date: string
    total_amount: number
    paid_amount: number
    balance_amount: number
    status: string
  }
  days_past_due: number
  bucket: string
}

interface AgingReport<T> {
  aging_buckets: AgingBuckets
  detail_report: T[]
  summary: {
    total_outstanding: number
    total_invoices: number
    as_of_date: string
  }
}

type ActiveTab = "receivables" | "payables"

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const BUCKET_META: Record<string, { label: string; color: string; badgeClass: string; icon: React.ElementType }> = {
  current:  { label: "Current (0-30)",  color: "bg-emerald-100 text-emerald-600", badgeClass: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: Clock },
  "31_60":  { label: "31 - 60 days",    color: "bg-yellow-100 text-yellow-600",   badgeClass: "bg-yellow-100 text-yellow-700 border-yellow-200",     icon: Clock },
  "61_90":  { label: "61 - 90 days",    color: "bg-orange-100 text-orange-600",   badgeClass: "bg-orange-100 text-orange-700 border-orange-200",     icon: AlertTriangle },
  over_90:  { label: "Over 90 days",    color: "bg-red-100 text-red-600",         badgeClass: "bg-red-100 text-red-700 border-red-200",             icon: AlertTriangle },
}

function bucketBadge(bucket: string) {
  const meta = BUCKET_META[bucket] ?? BUCKET_META.current
  return (
    <Badge variant="outline" className={meta.badgeClass}>
      {meta.label}
    </Badge>
  )
}

/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */

export default function AgingPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("receivables")
  const [asOfDate, setAsOfDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [receivableData, setReceivableData] = useState<AgingReport<ReceivableDetail> | null>(null)
  const [payableData, setPayableData] = useState<AgingReport<PayableDetail> | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  /* ---------- fetch ---------- */

  const fetchData = async (tab: ActiveTab, date: string) => {
    try {
      setIsLoading(true)
      setError(null)

      const endpoint =
        tab === "receivables"
          ? `/finance/accounts-receivable/aging-report?as_of_date=${date}`
          : `/finance/accounts-payable/aging-report?as_of_date=${date}`

      const res = await apiCall<AgingReport<any>>(endpoint, "GET")
      if (tab === "receivables") {
        setReceivableData(res as AgingReport<ReceivableDetail>)
      } else {
        setPayableData(res as AgingReport<PayableDetail>)
      }
    } catch (err: any) {
      const msg = err?.message || "Failed to load aging report"
      setError(msg)
      toast({ title: "Error", description: msg, variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData(activeTab, asOfDate)
  }, [activeTab, asOfDate])

  /* ---------- derived ---------- */

  const data = activeTab === "receivables" ? receivableData : payableData

  const sortedDetails = [...(data?.detail_report ?? [])].sort(
    (a, b) => b.days_past_due - a.days_past_due
  )

  const bucketKeys: (keyof AgingBuckets)[] = ["current", "31_60", "61_90", "over_90"]

  /* ---------- render helpers ---------- */

  function renderKpiCards(buckets: AgingBuckets) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {bucketKeys.map((key) => {
          const bucket = buckets[key]
          const meta = BUCKET_META[key]
          const Icon = meta.icon
          return (
            <Card key={key} className="overflow-hidden border-none shadow-md">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{meta.label}</CardTitle>
                <div className={`p-2 rounded-full ${meta.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-slate-800 tabular-nums">
                  {formatCurrency(bucket.amount)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {bucket.count} {bucket.count === 1 ? "invoice" : "invoices"}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>
    )
  }

  function renderSummaryCard(summary: AgingReport<any>["summary"]) {
    return (
      <Card className="border-none shadow-md">
        <CardContent className="flex items-center gap-4 py-4">
          <div className="p-3 rounded-full bg-blue-100 text-blue-600">
            <DollarSign className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Total Outstanding</p>
            <p className="text-2xl font-bold text-slate-800 tabular-nums">
              {formatCurrency(summary.total_outstanding)}
            </p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-sm font-medium text-muted-foreground">Total Invoices</p>
            <p className="text-2xl font-bold text-slate-800 tabular-nums">{summary.total_invoices}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  function renderDetailTable() {
    if (sortedDetails.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <FileText className="h-12 w-12 mb-4 opacity-40" />
          <p className="text-lg font-medium">No outstanding invoices</p>
          <p className="text-sm">
            There are no {activeTab === "receivables" ? "receivable" : "payable"} invoices as of this date.
          </p>
        </div>
      )
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[60px]">S/No</TableHead>
            <TableHead>Invoice #</TableHead>
            <TableHead>{activeTab === "receivables" ? "Customer" : "Supplier"}</TableHead>
            <TableHead>Invoice Date</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Paid</TableHead>
            <TableHead className="text-right">Balance</TableHead>
            <TableHead className="text-right">Days Past Due</TableHead>
            <TableHead>Bucket</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedDetails.map((item: any, idx: number) => {
            const entry = activeTab === "receivables" ? item.receivable : item.payable
            const partyName =
              activeTab === "receivables"
                ? entry?.customer?.name
                : entry?.supplier?.name

            return (
              <TableRow key={entry?.id ?? idx}>
                <TableCell className="font-medium">{idx + 1}</TableCell>
                <TableCell className="font-mono">{entry?.invoice_number}</TableCell>
                <TableCell>{partyName}</TableCell>
                <TableCell>{entry?.invoice_date}</TableCell>
                <TableCell>{entry?.due_date}</TableCell>
                <TableCell className="text-right font-mono">
                  {formatCurrency(entry?.total_amount)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatCurrency(entry?.paid_amount)}
                </TableCell>
                <TableCell className="text-right font-mono font-semibold">
                  {formatCurrency(entry?.balance_amount)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {item.days_past_due}
                </TableCell>
                <TableCell>{bucketBadge(item.bucket)}</TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    )
  }

  /* ---------- main render ---------- */

  if (isLoading && !data) {
    return <FinanceTableSkeleton />
  }

  return (
    <PermissionGuard permissions={["can_view_accounts_receivable"]}>
      <div className="space-y-6">
        {/* Header banner */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 p-8 text-white shadow-lg">
          <div className="relative z-10 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Receivables & Payables</h1>
              <p className="mt-2 text-amber-100 max-w-2xl">
                Aging analysis showing who owes you and who you owe, broken down by how long each invoice has been outstanding.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm">
              <Hourglass className="h-4 w-4 text-amber-200" />
              As of {asOfDate}
            </div>
          </div>
          <div className="absolute right-0 top-0 h-full w-1/3 bg-white/5 skew-x-12 transform" />
        </div>

        {/* Controls: Tabs + Date */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as ActiveTab)}
            className="w-full sm:w-auto"
          >
            <TabsList>
              <TabsTrigger value="receivables">Receivables</TabsTrigger>
              <TabsTrigger value="payables">Payables</TabsTrigger>
            </TabsList>
          </Tabs>

          <div>
            <label className="text-sm font-medium mb-1 block text-muted-foreground">As of Date</label>
            <div className="relative">
              <Calendar className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                className="pl-8 w-48"
              />
            </div>
          </div>
        </div>

        {/* Error state */}
        {error && (
          <Card className="border-rose-200 bg-rose-50">
            <CardContent className="p-4 flex items-center gap-3 text-sm text-rose-700">
              <AlertTriangle className="h-5 w-5 flex-shrink-0" />
              {error}
            </CardContent>
          </Card>
        )}

        {/* Loading overlay for tab / date change */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-600" />
          </div>
        )}

        {/* Data content */}
        {!isLoading && data && (
          <>
            {/* KPI cards */}
            {renderKpiCards(data.aging_buckets)}

            {/* Summary card */}
            {renderSummaryCard(data.summary)}

            {/* Detail table */}
            <Card>
              <CardHeader>
                <CardTitle>
                  {activeTab === "receivables" ? "Receivable" : "Payable"} Invoice Details
                </CardTitle>
                <CardDescription>
                  Sorted by days past due (longest overdue first)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {renderDetailTable()}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </PermissionGuard>
  )
}
