"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
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
  Search,
} from "lucide-react"
import apiCall from "@/lib/api"
import { formatCurrency } from "@/lib/finance"
import { PermissionGuard } from "@/components/PermissionGuard"
import { ExportMenu, useTableExport } from "@/components/export-menu"
import { useToast } from "@/hooks/use-toast"
import { matchesDocNumber } from "@/lib/utils"
import { TablePager, usePaged } from "@/components/ui/table-pager"
import { listCollectionNotes, promiseState, PROMISE_META, type CollectionAction, type CollectionNote } from "@/lib/collection-notes"
import { PartySheet, type PartyView } from "./party-sheet"
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

type BucketKey = keyof AgingBuckets

interface AgingEntry {
  id: string
  invoice_number: string
  invoice_date: string
  due_date: string
  total_amount: number
  paid_amount: number
  credited_amount?: number
  balance_amount: number
  status: string
}

type Party = { id: string | null; name: string }

interface AgingDetail {
  receivable?: AgingEntry & { customer: Party }
  payable?: AgingEntry & { supplier: Party }
  terms_days: number
  age_days: number
  days_past_due: number
  days_to_due: number
  bucket: BucketKey
  status: "overdue" | "due_soon" | "not_yet_due"
}

interface AgingReport {
  aging_buckets: AgingBuckets
  detail_report: AgingDetail[]
  pd_cheques: Record<string, number>
  summary: {
    total_outstanding: number
    total_invoices: number
    overdue: number
    not_yet_due: number
    pd_cheques_held: number
    as_of_date: string
  }
}

type ActiveTab = "receivables" | "payables"
type ActiveView = "summary" | "tracker"

// One invoice as the tracker lists it.
interface TrackerRow {
  id: string
  partyId: string | null
  party: string
  number: string
  invoiceDate: string
  terms: number
  dueDate: string
  amount: number
  paid: number
  credited: number
  balance: number
  age: number
  daysOverdue: number
  daysToDue: number
  notYetDue: number
  overdue: number
  bucket: BucketKey
  status: AgingDetail["status"]
}

// One customer or supplier as the summary lists it.
interface SummaryRow {
  partyId: string | null
  party: string
  terms: number
  balance: number
  notYetDue: number
  overdue: number
  buckets: Record<BucketKey, number>
  oldestOverdue: number
  nextDue: string | null
  pdCheques: number
  overdueNetOfPd: number
  action: string
  invoices: number
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const BUCKET_KEYS: BucketKey[] = ["current", "31_60", "61_90", "over_90"]

const BUCKET_META: Record<BucketKey, { label: string; short: string; color: string; icon: React.ElementType }> = {
  current: { label: "Current (0-30)", short: "0-30 days", color: "bg-emerald-100 text-emerald-600", icon: Clock },
  "31_60": { label: "31 - 60 days", short: "31-60 days", color: "bg-yellow-100 text-yellow-600", icon: Clock },
  "61_90": { label: "61 - 90 days", short: "61-90 days", color: "bg-orange-100 text-orange-600", icon: AlertTriangle },
  over_90: { label: "Over 90 days", short: ">90 days", color: "bg-red-100 text-red-600", icon: AlertTriangle },
}

const STATUS_META: Record<AgingDetail["status"], { label: string; className: string }> = {
  overdue: { label: "Overdue", className: "bg-red-100 text-red-700 border-red-200" },
  due_soon: { label: "Due within 7 days", className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  not_yet_due: { label: "Not yet due", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
}

const money = (n: number) => n.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const day = (d: string | null) => (d ? format(new Date(d), "dd/MM/yyyy") : "-")
const pct = (part: number, whole: number) => (whole ? `${((part / whole) * 100).toFixed(1)}%` : "0.0%")

function toTrackerRows(details: AgingDetail[]): TrackerRow[] {
  return details.map((d) => {
    const entry = (d.receivable ?? d.payable)!
    const party = d.receivable?.customer ?? d.payable?.supplier
    const overdue = d.days_past_due > 0 ? entry.balance_amount : 0
    return {
      id: entry.id,
      partyId: party?.id ?? null,
      party: party?.name ?? "-",
      number: entry.invoice_number,
      invoiceDate: entry.invoice_date,
      terms: d.terms_days,
      dueDate: entry.due_date,
      amount: entry.total_amount,
      paid: entry.paid_amount,
      credited: entry.credited_amount ?? 0,
      balance: entry.balance_amount,
      age: d.age_days,
      daysOverdue: d.days_past_due,
      daysToDue: d.days_to_due,
      notYetDue: entry.balance_amount - overdue,
      overdue,
      bucket: d.bucket,
      status: d.status,
    }
  })
}

function toSummaryRows(rows: TrackerRow[], pdCheques: Record<string, number>): SummaryRow[] {
  const byParty = new Map<string, SummaryRow>()
  for (const r of rows) {
    const key = r.partyId ?? r.party
    let s = byParty.get(key)
    if (!s) {
      s = {
        partyId: r.partyId, party: r.party, terms: r.terms, balance: 0, notYetDue: 0, overdue: 0,
        buckets: { current: 0, "31_60": 0, "61_90": 0, over_90: 0 },
        oldestOverdue: 0, nextDue: null, pdCheques: r.partyId ? pdCheques[r.partyId] ?? 0 : 0,
        overdueNetOfPd: 0, action: "", invoices: 0,
      }
      byParty.set(key, s)
    }
    s.balance += r.balance
    s.notYetDue += r.notYetDue
    s.overdue += r.overdue
    s.buckets[r.bucket] += r.balance
    s.oldestOverdue = Math.max(s.oldestOverdue, r.daysOverdue)
    s.terms = Math.max(s.terms, r.terms)
    s.invoices++
    if (r.notYetDue > 0 && (!s.nextDue || r.dueDate < s.nextDue)) s.nextDue = r.dueDate
  }
  return [...byParty.values()]
    .map((s) => {
      const net = Math.max(0, s.overdue - s.pdCheques)
      const action = s.overdue <= 0
        ? ""
        : s.pdCheques > 0 && net <= 0.009
          ? "Overdue covered by PD cheque"
          : s.oldestOverdue > 90 ? "Escalate - over 90 days overdue" : "Follow up"
      return { ...s, overdueNetOfPd: net, action }
    })
    // Most overdue first, then by what is owed.
    .sort((a, b) => b.overdue - a.overdue || b.balance - a.balance)
}

/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */

// ?tab=payables&view=tracker opens straight on that view (the Reports menu links here).
export default function AgingPage() {
  return (
    <Suspense fallback={<FinanceTableSkeleton />}>
      <AgingContent />
    </Suspense>
  )
}

function AgingContent() {
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<ActiveTab>(searchParams.get("tab") === "payables" ? "payables" : "receivables")
  const [activeView, setActiveView] = useState<ActiveView>(searchParams.get("view") === "tracker" ? "tracker" : "summary")
  const [search, setSearch] = useState("")
  const [asOfDate, setAsOfDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [receivableData, setReceivableData] = useState<AgingReport | null>(null)
  const [payableData, setPayableData] = useState<AgingReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()
  const [notes, setNotes] = useState<CollectionNote[]>([])
  // The customer/supplier whose panel is open (and the invoice it was opened from, if any).
  const [openParty, setOpenParty] = useState<{ key: string; invoiceId: string | null } | null>(null)

  const [actions, setActions] = useState<Record<string, CollectionAction>>({})

  const loadNotes = async (tab: ActiveTab) => {
    try {
      const res = await listCollectionNotes(tab === "receivables" ? "customer" : "supplier")
      setNotes(res.data ?? [])
      setActions(res.actions ?? {})
    } catch {
      setNotes([])
      setActions({})
    }
  }
  useEffect(() => { loadNotes(activeTab) }, [activeTab])

  // Following the other Reports link while already here switches the tab.
  const tabParam = searchParams.get("tab")
  useEffect(() => {
    if (tabParam === "payables" || tabParam === "receivables") {
      setActiveTab(tabParam)
      setSearch("")
    }
  }, [tabParam])

  /* ---------- fetch ---------- */

  const fetchData = async (tab: ActiveTab, date: string) => {
    try {
      setIsLoading(true)
      setError(null)

      const endpoint =
        tab === "receivables"
          ? `/finance/accounts-receivable/aging-report?as_of_date=${date}`
          : `/finance/accounts-payable/aging-report?as_of_date=${date}`

      const res = await apiCall<AgingReport>(endpoint, "GET")
      if (tab === "receivables") {
        setReceivableData(res)
      } else {
        setPayableData(res)
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
  const partyLabel = activeTab === "receivables" ? "Customer" : "Supplier"

  const trackerRows = useMemo(() => {
    const rows = toTrackerRows(data?.detail_report ?? [])
    // Grouped by customer/supplier, oldest invoice first - as the collection tracker reads.
    return rows.sort((a, b) => a.party.localeCompare(b.party) || a.invoiceDate.localeCompare(b.invoiceDate))
  }, [data])
  // An Action set by a collector replaces the suggested one; the suggestion is kept for the panel.
  const summaryRows = useMemo(
    () => toSummaryRows(trackerRows, data?.pd_cheques ?? {}).map((r) => {
      const set = r.partyId ? actions[r.partyId] : undefined
      return { ...r, suggestedAction: r.action, action: set?.action ?? r.action, actionSet: set ?? null }
    }),
    [trackerRows, data, actions],
  )

  const q = search.trim().toLowerCase()
  const shownTracker = useMemo(
    () => (q ? trackerRows.filter((r) => r.party.toLowerCase().includes(q) || matchesDocNumber(r.number, search) || r.number.toLowerCase().includes(q)) : trackerRows),
    [trackerRows, q, search],
  )
  const shownSummary = useMemo(
    () => (q ? summaryRows.filter((r) => r.party.toLowerCase().includes(q)) : summaryRows),
    [summaryRows, q],
  )

  const sum = <T,>(rows: T[], f: (r: T) => number) => rows.reduce((s, r) => s + f(r), 0)
  const summaryTotals = {
    balance: sum(shownSummary, (r) => r.balance),
    notYetDue: sum(shownSummary, (r) => r.notYetDue),
    overdue: sum(shownSummary, (r) => r.overdue),
    buckets: Object.fromEntries(BUCKET_KEYS.map((k) => [k, sum(shownSummary, (r) => r.buckets[k])])) as Record<BucketKey, number>,
    pdCheques: sum(shownSummary, (r) => r.pdCheques),
    overdueNetOfPd: sum(shownSummary, (r) => r.overdueNetOfPd),
  }
  const trackerTotals = {
    amount: sum(shownTracker, (r) => r.amount),
    paid: sum(shownTracker, (r) => r.paid),
    credited: sum(shownTracker, (r) => r.credited),
    balance: sum(shownTracker, (r) => r.balance),
    notYetDue: sum(shownTracker, (r) => r.notYetDue),
    overdue: sum(shownTracker, (r) => r.overdue),
    buckets: Object.fromEntries(BUCKET_KEYS.map((k) => [k, sum(shownTracker, (r) => (r.bucket === k ? r.balance : 0))])) as Record<BucketKey, number>,
  }

  // Notes are newest first, so each party's first is its latest.
  const notesByParty = useMemo(() => {
    const map = new Map<string, CollectionNote[]>()
    for (const n of notes) map.set(n.party_id, [...(map.get(n.party_id) ?? []), n])
    return map
  }, [notes])
  const latestPromise = (r: SummaryRow) => (r.partyId ? notesByParty.get(r.partyId)?.find((n) => n.promise_date) : undefined)
  const latestNote = (r: SummaryRow) => (r.partyId ? notesByParty.get(r.partyId)?.[0] : undefined)
  const noteText = (r: SummaryRow) => {
    const n = latestNote(r)
    if (!n) return ""
    const p = latestPromise(r)
    const state = p ? promiseState(p, asOfDate, r.overdue > 0) : null
    return [p && state ? `${PROMISE_META[state].label} ${day(p.promise_date)}` : "", n.note].filter(Boolean).join(" - ")
  }

  const summaryPager = usePaged(shownSummary, 20, `${activeTab}|${q}`)
  const trackerPager = usePaged(shownTracker, 20, `${activeTab}|${q}`)

  const partyKey = (r: { partyId: string | null; party: string }) => r.partyId ?? r.party
  const openView: PartyView | null = useMemo(() => {
    if (!openParty) return null
    const s = summaryRows.find((r) => partyKey(r) === openParty.key)
    if (!s) return null
    return {
      ...s,
      buckets: BUCKET_KEYS.map((k) => ({ label: BUCKET_META[k].short, amount: s.buckets[k] })),
      invoices: trackerRows.filter((r) => partyKey(r) === openParty.key).map((r) => ({
        id: r.id, number: r.number, invoiceDate: r.invoiceDate, dueDate: r.dueDate, balance: r.balance, daysOverdue: r.daysOverdue,
        statusLabel: STATUS_META[r.status].label, statusClass: STATUS_META[r.status].className,
      })),
    }
  }, [openParty, summaryRows, trackerRows])

  /* ---------- export ---------- */

  const title = activeTab === "receivables" ? "Receivables" : "Payables"
  const onExport = useTableExport(() => {
    const asAt = `As at ${day(asOfDate)}${q ? ` - search "${search.trim()}"` : ""}`
    if (activeView === "summary") {
      return {
        fileName: `${title.toLowerCase()}-ageing-summary-${asOfDate}`,
        title: `${title} Ageing - ${activeTab === "receivables" ? "Collection" : "Supplier"} Summary`,
        subtitle: asAt,
        headers: ["S/No", partyLabel, "Terms (days)", "Total Balance Due", "Not Yet Due", "Total Overdue", "0-30 days", "31-60 days", "61-90 days", ">90 days", "Oldest Days Overdue", "Next Due Date", "PD Cheques Held", "Overdue Net of PD Cheques", "Action", "Collection Notes / Promise Date"],
        rows: shownSummary.map((r, i) => [
          i + 1, r.party, r.terms, r.balance, r.notYetDue, r.overdue, r.buckets.current, r.buckets["31_60"], r.buckets["61_90"], r.buckets.over_90,
          r.oldestOverdue || "", r.nextDue ? day(r.nextDue) : "", r.pdCheques || "", r.pdCheques ? r.overdueNetOfPd : "", r.action, noteText(r),
        ]),
        footer: [
          ["", "TOTAL", "", summaryTotals.balance, summaryTotals.notYetDue, summaryTotals.overdue, summaryTotals.buckets.current, summaryTotals.buckets["31_60"], summaryTotals.buckets["61_90"], summaryTotals.buckets.over_90, "", "", summaryTotals.pdCheques, summaryTotals.overdueNetOfPd, "", ""],
          ["", "% of total", "", "", pct(summaryTotals.notYetDue, summaryTotals.balance), pct(summaryTotals.overdue, summaryTotals.balance), ...BUCKET_KEYS.map((k) => pct(summaryTotals.buckets[k], summaryTotals.balance)), "", "", "", "", "", ""],
        ],
        moneyColumns: [3, 4, 5, 6, 7, 8, 9, 12, 13],
      }
    }
    return {
      fileName: `${title.toLowerCase()}-invoice-tracker-${asOfDate}`,
      title: `${title} Ageing - Invoice Tracker`,
      subtitle: asAt,
      headers: ["S/No", partyLabel, "Invoice / Ref", "Invoice Date", "Terms (days)", "Due Date", "Amount", "Paid", "Credit Notes", "Balance Due", "Invoice Age (days)", "Days Overdue", "Days to Due", "Not Yet Due", "Overdue Amount", "0-30 days", "31-60 days", "61-90 days", ">90 days", "Status"],
      rows: shownTracker.map((r, i) => [
        i + 1, r.party, r.number, day(r.invoiceDate), r.terms, day(r.dueDate), r.amount, r.paid, r.credited, r.balance,
        r.age, r.daysOverdue, r.daysToDue, r.notYetDue, r.overdue,
        ...BUCKET_KEYS.map((k) => (r.bucket === k ? r.balance : 0)), STATUS_META[r.status].label,
      ]),
      footer: [[
        "", "TOTAL", "", "", "", "", trackerTotals.amount, trackerTotals.paid, trackerTotals.credited, trackerTotals.balance, "", "", "",
        trackerTotals.notYetDue, trackerTotals.overdue, ...BUCKET_KEYS.map((k) => trackerTotals.buckets[k]), "",
      ]],
      moneyColumns: [6, 7, 8, 9, 13, 14, 15, 16, 17, 18],
    }
  })

  /* ---------- render helpers ---------- */

  function renderKpiCards(buckets: AgingBuckets) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {BUCKET_KEYS.map((key) => {
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
                  {bucket.count} {bucket.count === 1 ? "invoice" : "invoices"} · by invoice age
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>
    )
  }

  function renderSummaryCard(summary: AgingReport["summary"]) {
    const stats = [
      { label: "Not Yet Due", value: formatCurrency(summary.not_yet_due ?? 0), className: "text-emerald-700" },
      { label: "Overdue", value: formatCurrency(summary.overdue ?? 0), className: "text-red-700" },
      { label: "% Overdue", value: pct(summary.overdue ?? 0, summary.total_outstanding), className: "text-red-700" },
      { label: "PD Cheques Held", value: formatCurrency(summary.pd_cheques_held ?? 0), className: "text-slate-800" },
      { label: "Total Invoices", value: String(summary.total_invoices), className: "text-slate-800" },
    ]
    return (
      <Card className="border-none shadow-md">
        <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-4 py-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-full bg-blue-100 text-blue-600">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Outstanding</p>
              <p className="text-2xl font-bold text-slate-800 tabular-nums">{formatCurrency(summary.total_outstanding)}</p>
            </div>
          </div>
          {stats.map((s) => (
            <div key={s.label}>
              <p className="text-sm font-medium text-muted-foreground">{s.label}</p>
              <p className={`text-xl font-bold tabular-nums ${s.className}`}>{s.value}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  const emptyState = (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
      <FileText className="h-12 w-12 mb-4 opacity-40" />
      <p className="text-lg font-medium">{q ? "Nothing matches your search" : "No outstanding invoices"}</p>
      <p className="text-sm">
        {q ? "Try another name or invoice number." : `There are no ${activeTab === "receivables" ? "receivable" : "payable"} invoices as of this date.`}
      </p>
    </div>
  )

  const num = "text-right tabular-nums whitespace-nowrap"
  const rowClick = "cursor-pointer"

  function promiseBadge(r: SummaryRow) {
    const p = latestPromise(r)
    const state = p ? promiseState(p, asOfDate, r.overdue > 0) : null
    if (!p || !state) {
      const n = latestNote(r)
      return n ? <span className="text-xs text-muted-foreground line-clamp-2">{n.note}</span> : <span className="text-xs text-muted-foreground">-</span>
    }
    return (
      <Badge variant="outline" className={`whitespace-nowrap ${PROMISE_META[state].className}`}>
        {PROMISE_META[state].label} · {day(p.promise_date)}
      </Badge>
    )
  }

  // Every column of the collection workbook; the table scrolls sideways inside its own box
  // (scrollbar always in view). A click opens the customer's panel with its notes.
  function renderSummaryTable() {
    if (shownSummary.length === 0) return emptyState
    return (
      <>
        <Table scroll>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px] text-center">S/No</TableHead>
              <TableHead className="min-w-[220px]">{partyLabel}</TableHead>
              <TableHead className="text-right">Terms (days)</TableHead>
              <TableHead className="text-right">Total Balance Due</TableHead>
              <TableHead className="text-right">Not Yet Due</TableHead>
              <TableHead className="text-right">Total Overdue</TableHead>
              {BUCKET_KEYS.map((k) => <TableHead key={k} className="text-right whitespace-nowrap">{BUCKET_META[k].short}</TableHead>)}
              <TableHead className="text-right">Oldest Days Overdue</TableHead>
              <TableHead>Next Due Date</TableHead>
              <TableHead className="text-right">PD Cheques Held</TableHead>
              <TableHead className="text-right">Overdue Net of PD Cheques</TableHead>
              <TableHead className="min-w-[170px]">Action</TableHead>
              <TableHead className="min-w-[220px]">Collection Notes / Promise Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {summaryPager.pageRows.map((r, i) => (
              <TableRow key={partyKey(r)} className={rowClick} onClick={() => setOpenParty({ key: partyKey(r), invoiceId: null })}>
                <TableCell className="text-center">{summaryPager.start + i + 1}</TableCell>
                <TableCell className="font-medium">
                  <span className="text-primary hover:underline">{r.party}</span>
                  <span className="block text-xs text-muted-foreground">{r.invoices} {r.invoices === 1 ? "invoice" : "invoices"}</span>
                </TableCell>
                <TableCell className={num}>{r.terms}</TableCell>
                <TableCell className={`${num} font-semibold`}>{money(r.balance)}</TableCell>
                <TableCell className={num}>{money(r.notYetDue)}</TableCell>
                <TableCell className={`${num} ${r.overdue > 0 ? "text-red-700 font-semibold" : ""}`}>{money(r.overdue)}</TableCell>
                {BUCKET_KEYS.map((k) => <TableCell key={k} className={num}>{money(r.buckets[k])}</TableCell>)}
                <TableCell className={num}>{r.oldestOverdue || "-"}</TableCell>
                <TableCell className="whitespace-nowrap">{day(r.nextDue)}</TableCell>
                <TableCell className={num}>{r.pdCheques ? money(r.pdCheques) : "-"}</TableCell>
                <TableCell className={num}>{r.pdCheques ? money(r.overdueNetOfPd) : "-"}</TableCell>
                <TableCell className={`text-xs ${r.actionSet ? "font-semibold text-slate-800" : ""}`}>{r.action}</TableCell>
                <TableCell>{promiseBadge(r)}</TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted/50 font-bold hover:bg-muted/50">
              <TableCell />
              <TableCell>TOTAL ({shownSummary.length})</TableCell>
              <TableCell />
              <TableCell className={num}>{money(summaryTotals.balance)}</TableCell>
              <TableCell className={num}>{money(summaryTotals.notYetDue)}</TableCell>
              <TableCell className={num}>{money(summaryTotals.overdue)}</TableCell>
              {BUCKET_KEYS.map((k) => <TableCell key={k} className={num}>{money(summaryTotals.buckets[k])}</TableCell>)}
              <TableCell />
              <TableCell />
              <TableCell className={num}>{money(summaryTotals.pdCheques)}</TableCell>
              <TableCell className={num}>{money(summaryTotals.overdueNetOfPd)}</TableCell>
              <TableCell colSpan={2} />
            </TableRow>
            <TableRow className="text-muted-foreground hover:bg-transparent">
              <TableCell />
              <TableCell>% of total</TableCell>
              <TableCell />
              <TableCell />
              <TableCell className={num}>{pct(summaryTotals.notYetDue, summaryTotals.balance)}</TableCell>
              <TableCell className={num}>{pct(summaryTotals.overdue, summaryTotals.balance)}</TableCell>
              {BUCKET_KEYS.map((k) => <TableCell key={k} className={num}>{pct(summaryTotals.buckets[k], summaryTotals.balance)}</TableCell>)}
              <TableCell colSpan={6} />
            </TableRow>
          </TableBody>
        </Table>
        <TablePager {...summaryPager.pager} />
      </>
    )
  }

  function renderTrackerTable() {
    if (shownTracker.length === 0) return emptyState
    return (
      <>
        <Table scroll>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px] text-center">S/No</TableHead>
              <TableHead className="min-w-[220px]">{partyLabel}</TableHead>
              <TableHead>Invoice / Ref</TableHead>
              <TableHead>Invoice Date</TableHead>
              <TableHead className="text-right">Terms (days)</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Credit Notes</TableHead>
              <TableHead className="text-right">Balance Due</TableHead>
              <TableHead className="text-right">Invoice Age (days)</TableHead>
              <TableHead className="text-right">Days Overdue</TableHead>
              <TableHead className="text-right">Days to Due</TableHead>
              <TableHead className="text-right">Not Yet Due</TableHead>
              <TableHead className="text-right">Overdue Amount</TableHead>
              {BUCKET_KEYS.map((k) => <TableHead key={k} className="text-right whitespace-nowrap">{BUCKET_META[k].short}</TableHead>)}
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {trackerPager.pageRows.map((r, i) => (
              <TableRow key={r.id} className={rowClick} onClick={() => setOpenParty({ key: partyKey(r), invoiceId: r.id })}>
                <TableCell className="text-center">{trackerPager.start + i + 1}</TableCell>
                <TableCell className="font-medium"><span className="text-primary hover:underline">{r.party}</span></TableCell>
                <TableCell className="font-mono whitespace-nowrap">{r.number}</TableCell>
                <TableCell className="whitespace-nowrap">{day(r.invoiceDate)}</TableCell>
                <TableCell className={num}>{r.terms}</TableCell>
                <TableCell className="whitespace-nowrap">{day(r.dueDate)}</TableCell>
                <TableCell className={num}>{money(r.amount)}</TableCell>
                <TableCell className={num}>{money(r.paid)}</TableCell>
                <TableCell className={num}>{money(r.credited)}</TableCell>
                <TableCell className={`${num} font-semibold`}>{money(r.balance)}</TableCell>
                <TableCell className={num}>{r.age}</TableCell>
                <TableCell className={`${num} ${r.daysOverdue > 0 ? "text-red-700 font-semibold" : ""}`}>{r.daysOverdue}</TableCell>
                <TableCell className={num}>{r.daysToDue}</TableCell>
                <TableCell className={num}>{money(r.notYetDue)}</TableCell>
                <TableCell className={num}>{money(r.overdue)}</TableCell>
                {BUCKET_KEYS.map((k) => <TableCell key={k} className={num}>{r.bucket === k ? money(r.balance) : "-"}</TableCell>)}
                <TableCell>
                  <Badge variant="outline" className={`whitespace-nowrap ${STATUS_META[r.status].className}`}>{STATUS_META[r.status].label}</Badge>
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted/50 font-bold hover:bg-muted/50">
              <TableCell />
              <TableCell>TOTAL ({shownTracker.length})</TableCell>
              <TableCell colSpan={4} />
              <TableCell className={num}>{money(trackerTotals.amount)}</TableCell>
              <TableCell className={num}>{money(trackerTotals.paid)}</TableCell>
              <TableCell className={num}>{money(trackerTotals.credited)}</TableCell>
              <TableCell className={num}>{money(trackerTotals.balance)}</TableCell>
              <TableCell colSpan={3} />
              <TableCell className={num}>{money(trackerTotals.notYetDue)}</TableCell>
              <TableCell className={num}>{money(trackerTotals.overdue)}</TableCell>
              {BUCKET_KEYS.map((k) => <TableCell key={k} className={num}>{money(trackerTotals.buckets[k])}</TableCell>)}
              <TableCell />
            </TableRow>
          </TableBody>
        </Table>
        <TablePager {...trackerPager.pager} />
      </>
    )
  }

  /* ---------- main render ---------- */

  if (isLoading && !data) {
    return <FinanceTableSkeleton />
  }

  return (
    <PermissionGuard permissions={["can_view_accounts_receivable", "can_view_accounts_payable", "can_view_finance_menu", "can_view_financial_reports", "can_manage_system", "can_manage_company"]}>
      <div className="space-y-6">
        {/* Header banner */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 p-8 text-white shadow-lg">
          <div className="relative z-10 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Receivables & Payables</h1>
              <p className="mt-2 text-amber-100 max-w-2xl">
                Ageing and collection tracking: who owes you and who you owe, by customer or supplier and by invoice.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm">
              <Hourglass className="h-4 w-4 text-amber-200" />
              As of {day(asOfDate)}
            </div>
          </div>
          <div className="absolute right-0 top-0 h-full w-1/3 bg-white/5 skew-x-12 transform" />
        </div>

        {/* Controls: Tabs + Date */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <Tabs
            value={activeTab}
            onValueChange={(v) => { setActiveTab(v as ActiveTab); setSearch("") }}
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
            {renderKpiCards(data.aging_buckets)}
            {renderSummaryCard(data.summary)}

            <Card>
              <CardHeader className="space-y-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <Tabs value={activeView} onValueChange={(v) => setActiveView(v as ActiveView)}>
                    <TabsList>
                      <TabsTrigger value="summary">{activeTab === "receivables" ? "Collection Summary" : "Supplier Summary"}</TabsTrigger>
                      <TabsTrigger value="tracker">Invoice Tracker</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={activeView === "summary" ? `Search ${partyLabel.toLowerCase()}` : `Search ${partyLabel.toLowerCase()} or invoice (NSK/0427)`}
                        className="pl-8 w-72"
                      />
                    </div>
                    <ExportMenu onExport={onExport} />
                  </div>
                </div>
                <div>
                  <CardTitle>
                    {activeView === "summary"
                      ? `${activeTab === "receivables" ? "Collection" : "Supplier"} Summary`
                      : `${title} Invoice Tracker`}
                  </CardTitle>
                  <CardDescription>
                    {activeView === "summary"
                      ? `One line per ${partyLabel.toLowerCase()}, most overdue first. Click a ${partyLabel.toLowerCase()} for the full breakdown, invoices and collection notes. Export has every column.`
                      : `Every unpaid invoice, by ${partyLabel.toLowerCase()} and oldest first. Click a line to see its ${partyLabel.toLowerCase()} and add a note. Export has every column.`}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                {activeView === "summary" ? renderSummaryTable() : renderTrackerTable()}
              </CardContent>
            </Card>
          </>
        )}

        <PartySheet
          view={openView}
          partyType={activeTab === "receivables" ? "customer" : "supplier"}
          notes={openView?.partyId ? notesByParty.get(openView.partyId) ?? [] : []}
          asOf={asOfDate}
          invoiceId={openParty?.invoiceId}
          onClose={() => setOpenParty(null)}
          onChanged={() => loadNotes(activeTab)}
        />
      </div>
    </PermissionGuard>
  )
}
