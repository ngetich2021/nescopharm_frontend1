"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { ExportMenu, useTableExport } from "@/components/export-menu"
import { displayDate, displayDateTime } from "@/lib/date-format"
import type { TableExport } from "@/lib/table-export"
import {
  AlertTriangle, BookCheck, CheckCircle2, ChevronLeft, ChevronRight, History, Loader2, RotateCcw, Send, Settings2, XCircle,
} from "lucide-react"
import {
  fetchDepreciationJournal, postDepreciationJournal, postMissingDepreciation, reverseDepreciationJournal, setupDepreciationAccounts,
  type DepreciationJournal as Journal, type DepRun,
} from "@/lib/depreciation-journal"

const money = (n: number | null | undefined) => Number(n || 0).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const day = (d?: string | null) => (d ? displayDate(d) : "")
const monthKey = (d: string) => d.slice(0, 7)
const thisMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}
const shiftMonth = (key: string, by: number) => {
  const [y, m] = key.split("-").map(Number)
  const d = new Date(y, m - 1 + by, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

const STATUS_STYLE: Record<string, string> = {
  "READY TO POST": "bg-emerald-100 text-emerald-800 border-emerald-200",
  POSTED: "bg-blue-100 text-blue-800 border-blue-200",
  "DO NOT POST - FIX CHECKS": "bg-red-100 text-red-800 border-red-200",
  "NOTHING TO POST": "bg-gray-100 text-gray-700 border-gray-200",
}

const th = "[&>th]:whitespace-nowrap [&>th]:border-b [&>th]:px-2 [&>th]:py-1.5"
const td = "[&>td]:border-b [&>td]:px-2 [&>td]:py-1.5"
const num = "text-right tabular-nums"

/**
 * Assets > Depreciation Journal: the accountant's Monthly Depreciation Journal workbook, live from the
 * Fixed Asset Register. One journal a month, DEP/YYYY/MM dated the month-end: Dr Depreciation - <class>
 * (6700xx) / Cr Accumulated Depreciation - <class> (1007xx). Checks must pass before it can be posted;
 * a wrong month is reversed in full and posted again.
 */
export function DepreciationJournal() {
  const { toast } = useToast()
  const [month, setMonth] = useState(thisMonth)
  const [data, setData] = useState<Journal | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState("voucher")
  const [busy, setBusy] = useState(false)
  const [dialog, setDialog] = useState<null | "post" | "missing" | "reverse">(null)
  const [reviewer, setReviewer] = useState("")
  const [postingDate, setPostingDate] = useState("")
  const [reason, setReason] = useState("")
  const [reverseRun, setReverseRun] = useState<DepRun | null>(null)
  const [calcClass, setCalcClass] = useState("all")
  const [calcSearch, setCalcSearch] = useState("")

  const load = useCallback(async (m: string) => {
    setLoading(true)
    setError(null)
    try {
      setData(await fetchDepreciationJournal(m))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the depreciation journal")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(month) }, [month, load])

  const run = async (action: () => Promise<string>, title: string) => {
    setBusy(true)
    try {
      const message = await action()
      toast({ title, description: message })
      setDialog(null)
      setReason("")
      await load(month)
    } catch (e) {
      toast({ title: "Not done", description: e instanceof Error ? e.message : String(e), variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  const missingUpTo = useMemo(() => {
    if (!data) return []
    return data.log.filter((l) => l.status === "not_posted" && l.period_end <= data.period_end)
  }, [data])

  const assetsShown = useMemo(() => {
    if (!data) return []
    const q = calcSearch.trim().toLowerCase()
    return data.assets.filter((a) => (calcClass === "all" || a.category === calcClass)
      && (!q || `${a.asset_code} ${a.name}`.toLowerCase().includes(q)))
  }, [data, calcClass, calcSearch])

  const onExport = useTableExport(() => {
    const d = data!
    const t = d.totals
    const r = d.reconciliation
    const control: TableExport = {
      fileName: "", title: `Monthly Depreciation Journal - Control Sheet`, sheetName: "Control",
      headers: ["Item", "Value"],
      rows: [
        ["Journal month-end date", day(d.period_end)],
        ["Posting date in ERP", day(d.posting_date)],
        ["Journal reference", d.reference],
        ["Narration", d.narration],
        ["Currency", d.currency],
        ["Prepared by", d.posted?.prepared_by ?? ""],
        ["Reviewed / approved by", d.posted?.reviewed_by ?? ""],
        ["Entry No.", d.posted?.entry_number ?? ""],
        ["", ""],
        ["CHECKS", ""],
        ...d.checks.map((c) => [c.label, c.result]),
        ["Overall status", d.status],
      ],
    }
    const voucher: TableExport = {
      fileName: "", title: `Journal Voucher - Monthly Depreciation ${d.period}`, sheetName: "Journal Voucher",
      details: [["Journal reference", d.reference], ["Posting date", day(d.posting_date)], ["Period", d.period], ["Currency", d.currency], ["Narration", d.narration], ["Posting status", d.status]],
      headers: ["Line", "Class code", "GL code", "Account name", "Dr / Cr", "Debit (KES)", "Credit (KES)"],
      moneyColumns: [5, 6],
      rows: d.lines.map((l) => [l.line, l.class_code, l.account_code, l.account_name, l.side, l.side === "Dr" ? l.debit : null, l.side === "Cr" ? l.credit : null]),
      footer: [["TOTAL", "", "", "", "", d.total_debit, d.total_credit]],
    }
    const upload: TableExport = {
      fileName: "", title: "ERP Journal Upload File", sheetName: "ERP Upload",
      headers: ["Journal No", "Line No", "Posting Date", "Account Code", "Account Name", "Debit", "Credit", "Cost Centre", "Narration", "Source"],
      moneyColumns: [5, 6],
      rows: d.lines.filter((l) => l.debit || l.credit).map((l, i) => [d.reference, i + 1, day(d.posting_date), l.account_code, l.account_name, l.debit, l.credit, "", d.narration, d.source]),
    }
    const summary: TableExport = {
      fileName: "", title: `Depreciation Summary and Roll-forward by Asset Class - month ended ${day(d.period_end)}`, sheetName: "Class Summary",
      headers: ["S/No", "Asset class", "Class code", "Cost", "Acc. Dep. Opening", "Charge for Month", "Acc. Dep. Closing", "NBV Closing", "Check"],
      moneyColumns: [3, 4, 5, 6, 7],
      rows: d.classes.map((c, i) => [i + 1, c.class, c.class_code ?? "", c.cost, c.opening, c.charge, c.closing, c.nbv, Math.abs(c.opening + c.charge - c.closing) < 0.01 ? "OK" : "DIFF"]),
      footer: [["", "TOTAL", "", t.cost, t.opening, t.charge, t.closing, t.nbv, ""]],
    }
    const calc: TableExport = {
      fileName: "", title: `Monthly Depreciation Calculation by Asset - ${d.period} (opening ${day(d.opening_date)}, closing ${day(d.period_end)})`, sheetName: "Monthly Calc",
      headers: ["S/No", "Asset ID", "Description", "Asset Class", "Dep. Start Date", "Cost (KES)", "Depreciable Amount", "Life (Months)", "Disposal Date", "Months - Opening", "Months - Closing", "Acc. Dep. Opening", "Charge for Month", "Acc. Dep. Closing", "NBV Closing", "Status"],
      moneyColumns: [5, 6, 11, 12, 13, 14],
      rows: d.assets.map((a) => [a.sno, a.asset_code ?? "", a.name, a.category, day(a.start_date), a.cost, a.depreciable_amount, a.life_months, day(a.disposal_date), a.months_opening, a.months_closing, a.opening, a.charge, a.closing, a.nbv, a.status]),
      footer: [["", "TOTAL", "", "", "", d.assets.reduce((s, a) => s + a.cost, 0), d.assets.reduce((s, a) => s + a.depreciable_amount, 0), "", "", "", "", t.opening, t.asset_charge, t.closing, d.assets.reduce((s, a) => s + a.nbv, 0), ""]],
    }
    const fs: TableExport = {
      fileName: "", title: `How the Depreciation Journal Appears in the Financial Statements - ${d.period}`, sheetName: "FS Impact",
      headers: ["Line item", "Opening", "Movement", "Closing", "Presentation"],
      moneyColumns: [1, 2, 3],
      rows: [
        ["Dr Depreciation expense (all classes)", null, t.charge, null, "Statement of Profit or Loss - non-cash operating expense"],
        ["Cr Accumulated depreciation (all classes)", null, -t.charge, null, "Statement of Financial Position - contra-asset"],
        ["Operating profit", null, -t.charge, null, "Falls by the depreciation charge"],
        ["Property, plant & equipment - cost", t.cost, 0, t.cost, "Unchanged by depreciation"],
        ["Less: accumulated depreciation", -t.opening, -t.charge, -t.closing, "Increases (shown as a deduction)"],
        ["Property, plant & equipment - net book value", t.cost - t.opening, -t.charge, t.nbv, "Net amount on the face of the statement"],
        ["Cash flow - add back depreciation", null, t.charge, null, "Operating activities - non-cash item; net cash effect ZERO"],
        ["Retained earnings", null, -t.charge, null, "Reduced through profit for the period"],
      ],
    }
    const log: TableExport = {
      fileName: "", title: "Posting Log - every month since depreciation began", sheetName: "Posting Log",
      headers: ["S/No", "Month", "Month-end", "Reference", "Charge (register)", "Status", "Entry No.", "Posted Charge", "Prepared by", "Reviewed by", "Posted at"],
      moneyColumns: [4, 7],
      rows: d.log.map((l, i) => [i + 1, l.period, day(l.period_end), l.reference, l.charge, l.status === "posted" ? (l.differs ? "Posted - differs from register" : "Posted") : l.status === "not_posted" ? "Not posted" : "Nothing to post", l.run?.entry_number ?? "", l.run ? l.run.total_charge : null, l.run?.prepared_by ?? "", l.run?.reviewed_by ?? "", l.run?.posted_at ? displayDateTime(l.run.posted_at) : ""]),
    }
    const recon: TableExport = {
      fileName: "", title: `Register to GL Reconciliation at ${day(d.period_end)} (${r.basis === "closing" ? "after posting" : "before posting - register opening"})`, sheetName: "GL Reconciliation",
      headers: ["S/No", "Asset class", "Register acc. dep.", "GL acc. dep.", "Difference"],
      moneyColumns: [2, 3, 4],
      rows: r.rows.map((x, i) => [i + 1, x.class, x.register_accumulated, x.gl_accumulated, x.difference]),
      footer: [["", "TOTAL", r.totals.register_accumulated, r.totals.gl_accumulated, r.totals.difference]],
    }
    return {
      fileName: `Monthly Depreciation Journal ${d.reference.replace(/\//g, "-")}`,
      title: `Monthly Depreciation Journal - ${d.period}`,
      headers: [], rows: [],
      sheets: [control, voucher, upload, summary, calc, fs, log, recon],
    }
  })

  const monthOptions = useMemo(() => {
    const keys = new Set<string>((data?.log ?? []).map((l) => monthKey(l.period_end)))
    keys.add(month)
    return Array.from(keys).sort().reverse()
  }, [data, month])

  if (error && !data) return <p className="text-sm text-red-600">{error}</p>
  if (!data) return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Working out the depreciation journal...</p>

  const d = data
  const t = d.totals
  const r = d.reconciliation
  const canAct = d.can_post_permission
  const firstMonth = d.log[0] ? monthKey(d.log[0].period_end) : month
  const lastMonth = thisMonth()

  return (
    <div className="space-y-4">
      {/* Month, status and actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button size="icon" variant="outline" disabled={month <= firstMonth || loading} onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {monthOptions.map((k) => {
                const l = d.log.find((x) => monthKey(x.period_end) === k)
                return (
                  <SelectItem key={k} value={k}>
                    {l ? l.period : k} {l?.status === "posted" ? "· posted" : l?.status === "not_posted" ? "· not posted" : ""}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
          <Button size="icon" variant="outline" disabled={month >= lastMonth || loading} onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </Button>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={`px-3 py-1 text-sm font-semibold ${STATUS_STYLE[d.status] ?? ""}`}>{d.status}</Badge>
          <ExportMenu onExport={onExport} label="Export workbook" />
          {canAct && !d.accounts_ready && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => run(setupDepreciationAccounts, "Chart of accounts")}>
              <Settings2 className="mr-2 h-4 w-4" /> Set up accounts
            </Button>
          )}
          {canAct && d.posted && (
            <Button size="sm" variant="outline" className="text-red-700" disabled={busy} onClick={() => { setReverseRun(d.posted); setDialog("reverse") }}>
              <RotateCcw className="mr-2 h-4 w-4" /> Reverse
            </Button>
          )}
          {canAct && !d.posted && (
            <Button size="sm" disabled={busy || !d.can_post} onClick={() => { setPostingDate(d.period_end); setDialog("post") }}>
              <Send className="mr-2 h-4 w-4" /> Post {d.reference}
            </Button>
          )}
        </div>
      </div>

      {/* Banners */}
      {!d.accounts_ready && (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            The PPE account structure is not in the chart of accounts yet: under 1007 Property Plant and Equipment the cost (100701-100708) and
            accumulated depreciation (100711-100718) accounts per class, and under 6700 Depreciation Expense one account per class (670001-670008).
            {canAct ? ' Click "Set up accounts" to add the ones missing (nothing already there is changed).' : " Ask Finance to set them up."}
          </div>
        </div>
      )}
      {d.earlier_not_posted.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          <div className="flex items-start gap-2">
            <History className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <span className="font-semibold">{d.earlier_not_posted.length} earlier month{d.earlier_not_posted.length === 1 ? "" : "s"} not posted</span>{" "}
              ({d.earlier_not_posted[0]}{d.earlier_not_posted.length > 1 ? ` - ${d.earlier_not_posted[d.earlier_not_posted.length - 1]}` : ""}).
              Until they are, the GL accumulated depreciation stays below the register by {money(r.totals.difference)}.
            </div>
          </div>
          {canAct && d.accounts_ready && missingUpTo.length > 0 && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setDialog("missing")}>
              <BookCheck className="mr-2 h-4 w-4" /> Post all {missingUpTo.length} up to {d.period}
            </Button>
          )}
        </div>
      )}
      {d.posted && d.log.find((l) => l.period_end === d.period_end)?.differs && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          The register now gives {money(t.charge)} for {d.period}, but {money(d.posted.total_charge)} was posted (an asset changed since).
          Reverse the journal and post it again so the books follow the register.
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          ["Charge for the month", t.charge, "Dr 6700 / Cr 1007 accumulated"],
          ["Acc. dep. opening", t.opening, `at ${day(d.opening_date)}`],
          ["Acc. dep. closing", t.closing, `at ${day(d.period_end)}`],
          ["Cost (in use)", t.cost, "assets depreciating, not disposed"],
          ["Net book value", t.nbv, `at ${day(d.period_end)}`],
        ].map(([label, value, hint]) => (
          <Card key={label as string}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-xl font-bold tabular-nums">{money(value as number)}</p>
              <p className="text-[11px] text-muted-foreground">{hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Control: inputs + checks */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Journal</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {[
              ["Journal month-end date", day(d.period_end)],
              ["Posting date", day(d.posting_date)],
              ["Journal reference", d.reference],
              ["Currency", d.currency],
              ["Narration", d.narration],
              ["Prepared by", d.posted?.prepared_by || "-"],
              ["Reviewed / approved by", d.posted?.reviewed_by || "-"],
            ].map(([k, v]) => (
              <div key={k} className="grid grid-cols-[170px_1fr] gap-2">
                <span className="text-muted-foreground">{k}</span>
                <span className="font-medium">{v}</span>
              </div>
            ))}
            {d.posted && (
              <div className="grid grid-cols-[170px_1fr] gap-2">
                <span className="text-muted-foreground">Ledger entry</span>
                <span className="font-medium">
                  {d.posted.journal_entry_id
                    ? <Link className="text-blue-700 underline" href={`/finance/journal-entries/${d.posted.journal_entry_id}`}>{d.posted.entry_number}</Link>
                    : d.posted.entry_number}
                  {d.posted.posted_at && <span className="ml-2 font-normal text-muted-foreground">posted {displayDateTime(d.posted.posted_at)}</span>}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Checks</CardTitle></CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            {d.checks.map((c) => (
              <div key={c.key} className="flex items-start justify-between gap-3">
                <span className="flex items-center gap-2">
                  {c.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-red-600" />}
                  {c.label}
                </span>
                <span className={`text-right font-medium ${c.ok ? "text-emerald-700" : "text-red-700"}`}>{c.result}</span>
              </div>
            ))}
            <div className="mt-2 flex items-center justify-between border-t pt-2 font-semibold">
              <span>Overall status</span>
              <span className={d.status === "DO NOT POST - FIX CHECKS" ? "text-red-700" : d.status === "POSTED" ? "text-blue-700" : "text-emerald-700"}>{d.status}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-2">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="voucher">Journal Voucher</TabsTrigger>
          <TabsTrigger value="summary">Class Summary</TabsTrigger>
          <TabsTrigger value="calc">Monthly Calc ({d.assets.length})</TabsTrigger>
          <TabsTrigger value="fs">FS Impact</TabsTrigger>
          <TabsTrigger value="log">Posting Log</TabsTrigger>
          <TabsTrigger value="recon">GL Reconciliation</TabsTrigger>
          <TabsTrigger value="mapping">Account Mapping</TabsTrigger>
        </TabsList>

        {/* Journal Voucher */}
        <TabsContent value="voucher">
          <div className="overflow-auto rounded border">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-600">
                <tr className={th}>
                  <th className="text-left">Line</th><th className="text-left">Class code</th><th className="text-left">GL code</th>
                  <th className="text-left">Account name</th><th className="text-left">Dr / Cr</th>
                  <th className="text-right">Debit (KES)</th><th className="text-right">Credit (KES)</th>
                </tr>
              </thead>
              <tbody>
                {d.lines.map((l) => (
                  <tr key={l.line} className={`${td} ${!l.debit && !l.credit ? "text-muted-foreground" : ""}`}>
                    <td>{l.line}</td>
                    <td>{l.class_code}</td>
                    <td className={l.account_exists ? "" : "text-red-600"}>{l.account_code}</td>
                    <td className={`whitespace-nowrap font-medium ${l.side === "Cr" ? "pl-6" : ""}`}>{l.account_name}{!l.account_exists && <span className="ml-2 text-red-600">(not in chart)</span>}</td>
                    <td>{l.side}</td>
                    <td className={num}>{l.side === "Dr" ? money(l.debit) : ""}</td>
                    <td className={num}>{l.side === "Cr" ? money(l.credit) : ""}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="font-bold">
                <tr className={td}>
                  <td colSpan={5}>TOTAL</td>
                  <td className={num}>{money(d.total_debit)}</td>
                  <td className={num}>{money(d.total_credit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Zero lines (classes with nothing to charge) are shown but not posted. The ERP Upload sheet in the export is the same journal in a flat layout.
          </p>
        </TabsContent>

        {/* Class Summary */}
        <TabsContent value="summary">
          <div className="overflow-auto rounded border">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-600">
                <tr className={th}>
                  <th className="text-left">S/No</th><th className="text-left">Asset class</th><th className="text-left">Class code</th><th className="text-right">Assets</th>
                  <th className="text-right">Cost</th><th className="text-right">Acc. Dep. Opening</th><th className="text-right">Charge for Month</th>
                  <th className="text-right">Acc. Dep. Closing</th><th className="text-right">NBV Closing</th><th className="text-left">Opening + Charge = Closing</th>
                </tr>
              </thead>
              <tbody>
                {d.classes.map((c, i) => (
                  <tr key={c.class} className={td}>
                    <td className="text-muted-foreground">{i + 1}</td>
                    <td className="whitespace-nowrap font-medium">{c.class}{!c.mapped && <span className="ml-2 text-red-600">(no GL account)</span>}</td>
                    <td>{c.class_code}</td>
                    <td className={num}>{c.assets}</td>
                    <td className={num}>{money(c.cost)}</td>
                    <td className={num}>{money(c.opening)}</td>
                    <td className={`${num} font-semibold`}>{money(c.charge)}</td>
                    <td className={num}>{money(c.closing)}</td>
                    <td className={num}>{money(c.nbv)}</td>
                    <td className={Math.abs(c.opening + c.charge - c.closing) < 0.01 ? "text-emerald-700" : "text-red-600"}>{Math.abs(c.opening + c.charge - c.closing) < 0.01 ? "OK" : "DIFF"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="font-bold">
                <tr className={td}>
                  <td colSpan={3}>TOTAL</td>
                  <td className={num}>{d.classes.reduce((s, c) => s + c.assets, 0)}</td>
                  <td className={num}>{money(t.cost)}</td><td className={num}>{money(t.opening)}</td><td className={num}>{money(t.charge)}</td>
                  <td className={num}>{money(t.closing)}</td><td className={num}>{money(t.nbv)}</td><td />
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Cost counts only assets whose depreciation has started and which are not disposed.</p>
        </TabsContent>

        {/* Monthly Calc */}
        <TabsContent value="calc" className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={calcClass} onValueChange={setCalcClass}>
              <SelectTrigger className="w-[230px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All classes</SelectItem>
                {d.classes.map((c) => <SelectItem key={c.class} value={c.class}>{c.class}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input className="w-[240px]" placeholder="Search Asset ID or description" value={calcSearch} onChange={(e) => setCalcSearch(e.target.value)} />
            <span className="text-xs text-muted-foreground">
              Straight line; a full month in the start month; stops once fully charged or in the month of disposal.
            </span>
          </div>
          <div className="max-h-[520px] overflow-auto rounded border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-50 text-gray-600">
                <tr className={th}>
                  <th className="text-left">S/No</th><th className="text-left">Asset ID</th><th className="text-left">Description</th><th className="text-left">Asset Class</th>
                  <th className="text-left">Dep. Start Date</th><th className="text-right">Cost (KES)</th><th className="text-right">Life (Months)</th><th className="text-left">Disposal Date</th>
                  <th className="text-right">Months Opening</th><th className="text-right">Months Closing</th><th className="text-right">Acc. Dep. Opening</th>
                  <th className="text-right">Charge for Month</th><th className="text-right">Acc. Dep. Closing</th><th className="text-right">NBV Closing</th><th className="text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {assetsShown.map((a, i) => (
                  <tr key={a.id} className={td}>
                    <td className="text-muted-foreground">{i + 1}</td>
                    <td className="whitespace-nowrap font-medium">{a.asset_code}</td>
                    <td className="min-w-[180px]">{a.name}</td>
                    <td className="whitespace-nowrap">{a.category}</td>
                    <td className="whitespace-nowrap">{day(a.start_date)}</td>
                    <td className={num}>{money(a.cost)}</td>
                    <td className={num}>{a.life_months}</td>
                    <td className="whitespace-nowrap">{day(a.disposal_date)}</td>
                    <td className={num}>{a.months_opening}</td>
                    <td className={num}>{a.months_closing}</td>
                    <td className={num}>{money(a.opening)}</td>
                    <td className={`${num} font-semibold`}>{money(a.charge)}</td>
                    <td className={num}>{money(a.closing)}</td>
                    <td className={num}>{money(a.nbv)}</td>
                    <td className={`whitespace-nowrap ${a.status === "Depreciating" ? "text-emerald-700" : a.status === "Disposed" ? "text-red-600" : "text-muted-foreground"}`}>{a.status}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="sticky bottom-0 bg-white font-bold">
                <tr className={td}>
                  <td colSpan={5}>TOTAL ({assetsShown.length})</td>
                  <td className={num}>{money(assetsShown.reduce((s, a) => s + a.cost, 0))}</td>
                  <td colSpan={4} />
                  <td className={num}>{money(assetsShown.reduce((s, a) => s + a.opening, 0))}</td>
                  <td className={num}>{money(assetsShown.reduce((s, a) => s + a.charge, 0))}</td>
                  <td className={num}>{money(assetsShown.reduce((s, a) => s + a.closing, 0))}</td>
                  <td className={num}>{money(assetsShown.reduce((s, a) => s + a.nbv, 0))}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </TabsContent>

        {/* FS Impact */}
        <TabsContent value="fs">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Statement of Profit or Loss</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                <FsRow label="Revenue / Cost of sales" value={0} note="No effect" />
                <FsRow label="Operating expenses - depreciation of PPE" value={-t.charge} note="Separate line or within admin expenses; total disclosed in the notes" />
                <FsRow label="Operating profit" value={-t.charge} note="Falls by the depreciation charge" bold />
                <FsRow label="Income tax" note="Depreciation is not tax-deductible; wear & tear (capital) allowances are claimed instead - a temporary difference (deferred tax). Confirm with the tax advisor." />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Statement of Financial Position</CardTitle></CardHeader>
              <CardContent className="text-sm">
                <table className="w-full">
                  <thead className="text-xs text-muted-foreground"><tr><th className="text-left font-normal" /><th className="text-right font-normal">Opening</th><th className="text-right font-normal">Movement</th><th className="text-right font-normal">Closing</th></tr></thead>
                  <tbody className="[&>tr>td]:py-1">
                    <tr><td>PPE - cost</td><td className={num}>{money(t.cost)}</td><td className={num}>{money(0)}</td><td className={num}>{money(t.cost)}</td></tr>
                    <tr><td>Less: accumulated depreciation</td><td className={num}>({money(t.opening)})</td><td className={num}>({money(t.charge)})</td><td className={num}>({money(t.closing)})</td></tr>
                    <tr className="font-semibold"><td>PPE - net book value</td><td className={num}>{money(t.cost - t.opening)}</td><td className={num}>({money(t.charge)})</td><td className={num}>{money(t.nbv)}</td></tr>
                    <tr><td>Retained earnings (pre-tax)</td><td /><td className={num}>({money(t.charge)})</td><td /></tr>
                  </tbody>
                </table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Statement of Cash Flows (indirect)</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                <FsRow label="Profit before tax" value={-t.charge} />
                <FsRow label="Add back: depreciation (non-cash)" value={t.charge} />
                <FsRow label="Net effect on cash from operations" value={0} note="ZERO - depreciation moves no cash" bold />
                <FsRow label="Investing activities" value={0} note="Cash goes out only when assets are bought" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">PPE note (IAS 16) and useful lives</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <FsRow label="Cost - closing (assets in use)" value={t.cost} />
                <FsRow label="Accumulated depreciation - opening" value={t.opening} />
                <FsRow label="Depreciation charge for the month" value={t.charge} />
                <FsRow label="Accumulated depreciation - closing" value={t.closing} />
                <FsRow label="Net book value - closing" value={t.nbv} bold />
                <table className="mt-2 w-full text-xs">
                  <thead className="text-muted-foreground"><tr className={th}><th className="text-left">Asset class</th><th className="text-right">Life (months)</th><th className="text-right">No. of assets</th></tr></thead>
                  <tbody>
                    {d.classes.map((c) => (
                      <tr key={c.class} className={td}><td>{c.class}</td><td className={num}>{c.min_life === c.max_life ? c.min_life ?? "" : `${c.min_life}-${c.max_life}`}</td><td className={num}>{c.assets}</td></tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Posting Log */}
        <TabsContent value="log" className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Every month since depreciation began. One journal per month; a wrong month is reversed in full (same period) and posted again, never overwritten.
          </p>
          <div className="max-h-[520px] overflow-auto rounded border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-50 text-gray-600">
                <tr className={th}>
                  <th className="text-left">S/No</th><th className="text-left">Month</th><th className="text-left">Month-end</th><th className="text-left">Reference</th>
                  <th className="text-right">Charge (register)</th><th className="text-left">Status</th><th className="text-left">Entry No.</th>
                  <th className="text-left">Prepared by</th><th className="text-left">Reviewed by</th><th className="text-left">Posted at</th><th />
                </tr>
              </thead>
              <tbody>
                {d.log.map((l, i) => (
                  <tr key={l.period_end} className={`${td} ${l.period_end === d.period_end ? "bg-blue-50/60" : ""}`}>
                    <td className="text-muted-foreground">{i + 1}</td>
                    <td className="whitespace-nowrap font-medium">
                      <button className="text-blue-700 hover:underline" onClick={() => setMonth(monthKey(l.period_end))}>{l.period}</button>
                    </td>
                    <td className="whitespace-nowrap">{day(l.period_end)}</td>
                    <td className="whitespace-nowrap">{l.reference}</td>
                    <td className={num}>{money(l.charge)}</td>
                    <td className="whitespace-nowrap">
                      {l.status === "posted"
                        ? <Badge className={l.differs ? "bg-red-100 text-red-800" : "bg-blue-100 text-blue-800"}>{l.differs ? `Posted ${money(l.run?.total_charge)} - differs` : "Posted"}</Badge>
                        : l.status === "not_posted" ? <Badge variant="outline" className="border-amber-300 text-amber-800">Not posted</Badge>
                          : <span className="text-muted-foreground">Nothing to post</span>}
                      {l.reversals > 0 && <span className="ml-1 text-muted-foreground">({l.reversals} reversed)</span>}
                    </td>
                    <td className="whitespace-nowrap">
                      {l.run?.journal_entry_id ? <Link className="text-blue-700 underline" href={`/finance/journal-entries/${l.run.journal_entry_id}`}>{l.run.entry_number}</Link> : ""}
                    </td>
                    <td className="whitespace-nowrap">{l.run?.prepared_by ?? ""}</td>
                    <td className="whitespace-nowrap">{l.run?.reviewed_by ?? ""}</td>
                    <td className="whitespace-nowrap">{l.run?.posted_at ? displayDateTime(l.run.posted_at) : ""}</td>
                    <td className="whitespace-nowrap text-right">
                      {canAct && l.run && (
                        <Button size="sm" variant="ghost" className="h-7 text-red-700" onClick={() => { setReverseRun(l.run); setDialog("reverse") }}>
                          <RotateCcw className="mr-1 h-3 w-3" /> Reverse
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="font-bold">
                <tr className={td}>
                  <td colSpan={4}>TOTAL ({d.log.filter((l) => l.status === "posted").length} of {d.log.filter((l) => l.status !== "nothing").length} posted)</td>
                  <td className={num}>{money(d.log.reduce((s, l) => s + l.charge, 0))}</td>
                  <td colSpan={6} className="font-normal text-muted-foreground">Posted: {money(d.log.reduce((s, l) => s + (l.run?.total_charge ?? 0), 0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          {d.history.some((h) => h.status === "reversed") && (
            <div className="rounded border p-3 text-xs">
              <p className="mb-1 font-semibold">{d.period}: reversed journals</p>
              {d.history.filter((h) => h.status === "reversed").map((h) => (
                <p key={h.id} className="text-muted-foreground">
                  {h.entry_number} ({money(h.total_charge)}) reversed {h.reversed_at ? displayDateTime(h.reversed_at) : ""} by {h.reversed_by ?? "-"}: {h.reversal_reason}
                </p>
              ))}
            </div>
          )}
        </TabsContent>

        {/* GL Reconciliation */}
        <TabsContent value="recon" className="space-y-2">
          <p className="text-xs text-muted-foreground">
            The register&apos;s accumulated depreciation must equal the GL accumulated depreciation accounts (control e).
            Compared at {day(d.period_end)} {r.basis === "closing" ? "after this month's journal" : "before posting this month, so against the register's opening"}.
          </p>
          <div className="overflow-auto rounded border">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-600">
                <tr className={th}>
                  <th className="text-left">S/No</th><th className="text-left">Asset class</th>
                  <th className="text-right">Register acc. dep.</th><th className="text-right">GL acc. dep. (1007 1x)</th><th className="text-right">Difference</th>
                </tr>
              </thead>
              <tbody>
                {r.rows.map((x, i) => (
                  <tr key={x.class} className={td}>
                    <td className="text-muted-foreground">{i + 1}</td>
                    <td className="whitespace-nowrap font-medium">{x.class}</td>
                    <td className={num}>{money(x.register_accumulated)}</td>
                    <td className={num}>{money(x.gl_accumulated)}</td>
                    <td className={`${num} font-semibold ${Math.abs(x.difference) < 0.005 ? "text-emerald-700" : "text-red-600"}`}>{money(x.difference)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="font-bold">
                <tr className={td}>
                  <td colSpan={2}>TOTAL</td>
                  <td className={num}>{money(r.totals.register_accumulated)}</td><td className={num}>{money(r.totals.gl_accumulated)}</td>
                  <td className={`${num} ${Math.abs(r.totals.difference) < 0.005 ? "text-emerald-700" : "text-red-600"}`}>{money(r.totals.difference)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </TabsContent>

        {/* Account Mapping */}
        <TabsContent value="mapping">
          <div className="overflow-auto rounded border">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-600">
                <tr className={th}>
                  <th className="text-left">S/No</th><th className="text-left">Asset class</th><th className="text-left">Class code</th>
                  <th className="text-left">Depreciation expense (Dr)</th><th className="text-left">Accumulated depreciation (Cr)</th><th className="text-left">Cost account</th>
                </tr>
              </thead>
              <tbody>
                {d.mapping.map((m, i) => (
                  <tr key={m.class} className={td}>
                    <td className="text-muted-foreground">{i + 1}</td>
                    <td className="whitespace-nowrap font-medium">{m.class}</td>
                    <td>{m.class_code}</td>
                    {[m.expense, m.accumulated, m.cost].map((a) => (
                      <td key={a.code} className={`whitespace-nowrap ${a.exists ? "" : "text-red-600"}`}>{a.code} {a.name}{!a.exists && " (missing)"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Groups: 1007 Property Plant and Equipment (Statement of Financial Position; accumulated depreciation is a contra-asset, normal balance credit) and 6700 Depreciation Expense (Statement of Profit or Loss).
          </p>
        </TabsContent>
      </Tabs>

      {/* Post one month */}
      <Dialog open={dialog === "post"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Post {d.reference}</DialogTitle>
            <DialogDescription>
              Dr Depreciation (6700xx) / Cr Accumulated Depreciation (1007xx), KES {money(t.charge)} for {d.period}, {d.lines.filter((l) => l.debit || l.credit).length} lines.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="dep-posting-date">Posting date</Label>
              <Input id="dep-posting-date" type="date" className="w-[180px]" value={postingDate} onChange={(e) => setPostingDate(e.target.value)} />
              <p className="text-xs text-muted-foreground">Default: the month-end, {day(d.period_end)}.</p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="dep-reviewer">Reviewed / approved by</Label>
              <Input id="dep-reviewer" placeholder="e.g. Finance Manager's name" value={reviewer} onChange={(e) => setReviewer(e.target.value)} />
              <p className="text-xs text-muted-foreground">You are recorded as the preparer.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button disabled={busy} onClick={() => run(() => postDepreciationJournal(d.period_end, reviewer, postingDate), "Depreciation journal posted")}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Post KES {money(t.charge)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Catch up */}
      <Dialog open={dialog === "missing"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Post {missingUpTo.length} month{missingUpTo.length === 1 ? "" : "s"}</DialogTitle>
            <DialogDescription>One DEP journal per month, oldest first, each dated its own month-end.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[260px] overflow-auto rounded border">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-600"><tr className={th}><th className="text-left">S/No</th><th className="text-left">Reference</th><th className="text-left">Month-end</th><th className="text-right">Charge</th></tr></thead>
              <tbody>
                {missingUpTo.map((l, i) => (
                  <tr key={l.period_end} className={td}><td>{i + 1}</td><td>{l.reference}</td><td>{day(l.period_end)}</td><td className={num}>{money(l.charge)}</td></tr>
                ))}
              </tbody>
              <tfoot className="font-bold"><tr className={td}><td colSpan={3}>TOTAL</td><td className={num}>{money(missingUpTo.reduce((s, l) => s + l.charge, 0))}</td></tr></tfoot>
            </table>
          </div>
          <div className="space-y-1">
            <Label htmlFor="dep-reviewer-all">Reviewed / approved by</Label>
            <Input id="dep-reviewer-all" value={reviewer} onChange={(e) => setReviewer(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button disabled={busy} onClick={() => run(() => postMissingDepreciation(d.period_end, reviewer), "Depreciation journals posted")}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Post all
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reverse */}
      <Dialog open={dialog === "reverse"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reverse {reverseRun?.reference}</DialogTitle>
            <DialogDescription>
              Entry {reverseRun?.entry_number} (KES {money(reverseRun?.total_charge)}) is reversed in full in the same period ({day(reverseRun?.posting_date)}). The month can then be posted again.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label htmlFor="dep-reason">Reason</Label>
            <Textarea id="dep-reason" placeholder="e.g. disposal of FUR-012 not entered" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button variant="destructive" disabled={busy || reason.trim().length < 3 || !reverseRun}
              onClick={() => reverseRun && run(() => reverseDepreciationJournal(reverseRun.id, reason.trim()), "Journal reversed")}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Reverse
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FsRow({ label, value, note, bold }: { label: string; value?: number; note?: string; bold?: boolean }) {
  return (
    <div className={`grid grid-cols-[1fr_auto] gap-x-3 ${bold ? "font-semibold" : ""}`}>
      <span>{label}</span>
      <span className="text-right tabular-nums">{value === undefined ? "" : value < 0 ? `(${money(-value)})` : money(value)}</span>
      {note && <span className="col-span-2 text-xs font-normal text-muted-foreground">{note}</span>}
    </div>
  )
}
