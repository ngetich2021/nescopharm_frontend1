"use client"

import { displayDate } from "@/lib/date-format"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ArrowDownToLine, Calculator, ExternalLink, Loader2, Plus, RefreshCw, Trash2, Wallet } from "lucide-react"
import { ExportMenu, useTableExport } from "@/components/export-menu"
import { FileLink } from "@/components/file-preview"
import { useToast } from "@/hooks/use-toast"
import apiCall from "@/lib/api"
import { documentFileName, sessionCompanyName } from "@/lib/document-names"

type Side = "Dr" | "Cr"
type Status = "balanced" | "shortage" | "surplus" | "not_counted"
type BookRow = {
  id: string
  date: string
  side: Side
  particulars: string
  account: string | null
  other_accounts: string[]
  voucher_type: string
  voucher_no: string
  narration: string | null
  reversed: boolean
  debit: number
  credit: number
  balance: number
  balance_side: Side
  kind: "withdrawal" | "receipt" | "expense" | "transfer_out"
  expense_id: string | null
  category: string | null
  receipt_url: string | null
}
type CountRow = {
  id: string
  count_date: string
  counted_amount: number
  system_balance: number
  difference: number
  status: Exclude<Status, "not_counted">
  denominations: Record<string, number> | null
  notes: string | null
  counted_by: string | null
}
type ReconLine = {
  period: string
  opening: number
  received_from_bank: number
  other_receipts: number
  spent: number
  transferred_out: number
  closing: number
  entries: number
  counted: number | null
  system_at_count: number | null
  difference: number | null
  status: Status
}
type PettyCash = {
  account: { id: string; code: string; name: string }
  date_from: string
  date_to: string
  period: "day" | "month"
  balance_now: number
  summary: {
    opening: number
    received_from_bank: number
    other_receipts: number
    spent: number
    transferred_out: number
    closing: number
    last_count: CountRow | null
  }
  by_account: { account: string; count: number; amount: number }[]
  book: {
    opening_balance: { amount: number; side: Side }
    rows: BookRow[]
    totals: { debit: number; credit: number }
    closing_balance: { amount: number; side: Side }
  }
  reconciliation: ReconLine[]
  counts: CountRow[]
}
type MoneyAccount = { id: string; code: string; name: string; label: string; balance: number }

const money = (n: number | null | undefined) => Number(n || 0).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const signed = (n: number) => `${money(Math.abs(n))} ${n < 0 ? "Cr" : "Dr"}`
const date = (d?: string | null) => (d ? displayDate(new Date(d)) : "")
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const periodLabel = (p: string) => (p.length === 7 ? `${MONTHS[Number(p.slice(5, 7)) - 1]} ${p.slice(0, 4)}` : date(p))
const NOTES = [1000, 500, 200, 100, 50, 40, 20, 10, 5, 1]
const STATUS: Record<Status, { label: string; className: string }> = {
  balanced: { label: "Balanced", className: "bg-green-100 text-green-800" },
  shortage: { label: "Shortage", className: "bg-red-100 text-red-800" },
  surplus: { label: "Surplus", className: "bg-amber-100 text-amber-800" },
  not_counted: { label: "Not counted", className: "bg-gray-100 text-gray-600" },
}

/**
 * Expenses > Petty Cash: the cash box as its own book. Cash in = withdrawals from Prime Bank
 * (transfers, never expenses); cash out = expenses paid in cash, each charged to its expense
 * account. A running balance, physical counts against the books (shortage / surplus), and a daily or
 * monthly reconciliation that exports to Excel/PDF.
 */
export function PettyCashTab({ onAddExpense, refreshKey = 0 }: { onAddExpense?: () => void; refreshKey?: number }) {
  const { toast } = useToast()
  const now = new Date()
  const [from, setFrom] = useState(ymd(new Date(now.getFullYear(), now.getMonth(), 1)))
  const [to, setTo] = useState(ymd(now))
  const [period, setPeriod] = useState<"day" | "month">("day")
  const [corrections, setCorrections] = useState(false)
  const [data, setData] = useState<PettyCash | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [banks, setBanks] = useState<MoneyAccount[]>([])

  const load = useCallback(async (p = { from, to, period, corrections }) => {
    setLoading(true)
    setError(null)
    try {
      const q = new URLSearchParams({ date_from: p.from, date_to: p.to, period: p.period })
      if (p.corrections) q.set("show_corrections", "1")
      const res = await apiCall<{ data: PettyCash }>(`/petty-cash?${q}`, "GET")
      setData(res.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load petty cash")
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { load() }, [load, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    apiCall<{ data: MoneyAccount[] }>("/finance/bank-transfers/accounts", "GET")
      .then((r) => setBanks(r.data.filter((a) => !/cash|petty/i.test(a.name))))
      .catch(() => setBanks([]))
  }, [])

  const apply = (patch: Partial<{ from: string; to: string; period: "day" | "month"; corrections: boolean }> = {}) =>
    load({ from, to, period, corrections, ...patch })

  // ---- Cash received from the bank
  const [wOpen, setWOpen] = useState(false)
  const [wSaving, setWSaving] = useState(false)
  const blankW = () => ({ transfer_date: ymd(new Date()), from_account_id: banks[0]?.id ?? "", amount: "", charges: "", reference: "", purpose: "", notes: "" })
  const [w, setW] = useState(blankW())
  const saveWithdrawal = async () => {
    setWSaving(true)
    try {
      const res = await apiCall<{ message: string }>("/petty-cash/withdrawals", "POST", {
        ...w, from_account_id: w.from_account_id || undefined, amount: Number(w.amount), charges: w.charges === "" ? 0 : Number(w.charges),
      })
      toast({ title: "Cash received", description: res.message })
      setWOpen(false)
      apply()
    } catch (e: any) {
      toast({ title: "Could not record it", description: e?.message, variant: "destructive" })
    } finally {
      setWSaving(false)
    }
  }

  // ---- Physical cash count
  const [cOpen, setCOpen] = useState(false)
  const [cSaving, setCSaving] = useState(false)
  const [c, setC] = useState({ count_date: ymd(new Date()), counted_amount: "", notes: "" })
  const [notes, setNotes] = useState<Record<number, string>>({})
  const notesTotal = useMemo(() => NOTES.reduce((s, n) => s + n * (Number(notes[n]) || 0), 0), [notes])
  const usingNotes = Object.values(notes).some((v) => Number(v) > 0)
  const counted = usingNotes ? notesTotal : Number(c.counted_amount) || 0
  const saveCount = async () => {
    setCSaving(true)
    try {
      const res = await apiCall<{ message: string }>("/petty-cash/counts", "POST", {
        count_date: c.count_date,
        counted_amount: counted,
        denominations: usingNotes ? Object.fromEntries(NOTES.map((n) => [String(n), Number(notes[n]) || 0])) : undefined,
        notes: c.notes || undefined,
      })
      toast({ title: "Cash count saved", description: res.message })
      setCOpen(false)
      apply()
    } catch (e: any) {
      toast({ title: "Could not save the count", description: e?.message, variant: "destructive" })
    } finally {
      setCSaving(false)
    }
  }
  const removeCount = async (row: CountRow) => {
    if (!confirm(`Delete the cash count of ${date(row.count_date)}?`)) return
    try {
      await apiCall(`/petty-cash/counts/${row.id}`, "DELETE")
      apply()
    } catch (e: any) {
      toast({ title: "Could not delete", description: e?.message, variant: "destructive" })
    }
  }

  const rangeText = data ? `${date(data.date_from)} to ${date(data.date_to)}` : ""
  const company = sessionCompanyName()

  const exportHistory = useTableExport(() => {
    const d = data!
    return {
      fileName: documentFileName([company, "Petty Cash Book", `${d.date_from} to ${d.date_to}`]),
      title: `Petty Cash Book - ${d.account.name}`,
      subtitle: rangeText,
      headers: ["S/No", "Date", "Dr/Cr", "Particulars", "Category", "Vch Type", "Vch No.", "Cash In (Debit)", "Cash Out (Credit)", "Balance"],
      moneyColumns: [7, 8],
      rows: [
        ["", date(d.date_from), d.book.opening_balance.side, "Opening Balance", "", "", "",
          d.book.opening_balance.side === "Dr" ? d.book.opening_balance.amount : null, d.book.opening_balance.side === "Cr" ? d.book.opening_balance.amount : null,
          `${money(d.book.opening_balance.amount)} ${d.book.opening_balance.side}`],
        ...d.book.rows.map((r, i) => [i + 1, date(r.date), r.side, r.particulars + (r.narration ? ` - ${r.narration}` : ""), r.category ?? "", r.voucher_type, r.voucher_no,
          r.debit || null, r.credit || null, `${money(r.balance)} ${r.balance_side}`]),
      ],
      footer: [
        ["", "", "", "Total", "", "", "", d.book.totals.debit, d.book.totals.credit, ""],
        ["", "", d.book.closing_balance.side, "Closing Balance", "", "", "", null, null, `${money(d.book.closing_balance.amount)} ${d.book.closing_balance.side}`],
      ],
    }
  })

  const exportRecon = useTableExport(() => {
    const d = data!
    const r = d.reconciliation
    const total = (f: keyof ReconLine) => r.reduce((s, l) => s + Number(l[f] || 0), 0)
    return {
      fileName: documentFileName([company, `Petty Cash ${d.period === "month" ? "Monthly" : "Daily"} Reconciliation`, `${d.date_from} to ${d.date_to}`]),
      title: `Petty Cash ${d.period === "month" ? "Monthly" : "Daily"} Reconciliation`,
      subtitle: `${d.account.name} · ${rangeText}`,
      headers: ["S/No", d.period === "month" ? "Month" : "Date", "Opening", "From Bank", "Other Cash In", "Spent", "Transferred Out", "Closing (Books)", "Counted", "Difference", "Status"],
      moneyColumns: [2, 3, 4, 5, 6, 7, 8, 9],
      rows: r.map((l, i) => [i + 1, periodLabel(l.period), l.opening, l.received_from_bank, l.other_receipts, l.spent, l.transferred_out, l.closing,
        l.counted, l.difference, STATUS[l.status].label]),
      footer: [["", "Total", r[0]?.opening ?? d.summary.opening, total("received_from_bank"), total("other_receipts"), total("spent"), total("transferred_out"),
        r[r.length - 1]?.closing ?? d.summary.closing, null, null, ""]],
    }
  })

  const exportCounts = useTableExport(() => {
    const d = data!
    return {
      fileName: documentFileName([company, "Petty Cash Counts", `${d.date_from} to ${d.date_to}`]),
      title: "Petty Cash Counts",
      subtitle: rangeText,
      headers: ["S/No", "Date", "Counted", "Books Balance", "Difference", "Status", "Counted By", "Notes"],
      moneyColumns: [2, 3, 4],
      rows: d.counts.map((k, i) => [i + 1, date(k.count_date), k.counted_amount, k.system_balance, k.difference, STATUS[k.status].label, k.counted_by ?? "", k.notes ?? ""]),
    }
  })

  const exportByAccount = useTableExport(() => {
    const d = data!
    return {
      fileName: documentFileName([company, "Petty Cash Spending by Account", `${d.date_from} to ${d.date_to}`]),
      title: "Petty Cash Spending by Account",
      subtitle: rangeText,
      headers: ["S/No", "Expense Account", "Entries", "Amount"],
      moneyColumns: [3],
      rows: d.by_account.map((a, i) => [i + 1, a.account, a.count, a.amount]),
      footer: [["", "Total", d.by_account.reduce((s, a) => s + a.count, 0), d.by_account.reduce((s, a) => s + a.amount, 0)]],
    }
  })

  const s = data?.summary
  const last = s?.last_count

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <Label htmlFor="pc_from" className="text-xs">From</Label>
            <Input id="pc_from" type="date" className="h-8 w-[150px]" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="pc_to" className="text-xs">To</Label>
            <Input id="pc_to" type="date" className="h-8 w-[150px]" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Reconcile by</Label>
            <Select value={period} onValueChange={(v: "day" | "month") => { setPeriod(v); apply({ period: v }) }}>
              <SelectTrigger className="h-8 w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Day</SelectItem>
                <SelectItem value="month">Month</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" onClick={() => apply()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Apply
          </Button>
          <label className="flex items-center gap-2 text-xs">
            <Switch checked={corrections} onCheckedChange={(v) => { setCorrections(v); apply({ corrections: v }) }} />
            Show edits &amp; reversals
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => { setW(blankW()); setWOpen(true) }}>
            <ArrowDownToLine className="mr-2 h-4 w-4" /> Cash from Bank
          </Button>
          {onAddExpense && (
            <Button size="sm" variant="outline" onClick={onAddExpense}>
              <Plus className="mr-2 h-4 w-4" /> Cash Expense
            </Button>
          )}
          <Button size="sm" onClick={() => { setC({ count_date: ymd(new Date()), counted_amount: "", notes: "" }); setNotes({}); setCOpen(true) }}>
            <Calculator className="mr-2 h-4 w-4" /> Count Cash
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {data && s && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Opening Balance ({date(data.date_from)})</p>
                <p className="text-xl font-bold font-mono">{signed(s.opening)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Received from Bank</p>
                <p className="text-xl font-bold font-mono text-green-700">+{money(s.received_from_bank)}</p>
                {s.other_receipts > 0 && <p className="text-xs text-muted-foreground">Other cash in: {money(s.other_receipts)}</p>}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Spent (cash expenses)</p>
                <p className="text-xl font-bold font-mono text-red-700">-{money(s.spent)}</p>
                {s.transferred_out > 0 && <p className="text-xs text-muted-foreground">Transferred out: {money(s.transferred_out)}</p>}
              </CardContent>
            </Card>
            <Card className="border-primary">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Closing Balance ({date(data.date_to)})</p>
                <p className={`text-xl font-bold font-mono ${s.closing < 0 ? "text-red-600" : ""}`}>{signed(s.closing)}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Wallet className="h-3 w-3" /> Available now: {signed(data.balance_now)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Last Cash Count</p>
                {last ? (
                  <>
                    <p className="text-xl font-bold font-mono">{money(last.counted_amount)}</p>
                    <p className="text-xs">
                      {date(last.count_date)} · <Badge className={STATUS[last.status].className}>{STATUS[last.status].label}{last.status !== "balanced" ? ` ${money(Math.abs(last.difference))}` : ""}</Badge>
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground mt-1">No count in this period</p>
                )}
              </CardContent>
            </Card>
          </div>
          {s.closing < 0 && (
            <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
              The books show more cash paid out than ever came in. Record the cash withdrawn from the bank (Cash from Bank), or any
              expense that was really a withdrawal (open it and press &quot;Was a bank withdrawal&quot;), so every shilling spent has its source.
            </p>
          )}
        </>
      )}

      {loading && !data ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading petty cash...</p>
      ) : data && (
        <Tabs defaultValue="history">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="history">History (Cash Book)</TabsTrigger>
            <TabsTrigger value="reconciliation">{period === "month" ? "Monthly" : "Daily"} Reconciliation</TabsTrigger>
            <TabsTrigger value="accounts">Spent by Account</TabsTrigger>
            <TabsTrigger value="counts">Cash Counts ({data.counts.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="history">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">{data.account.code} {data.account.name} · {rangeText}</CardTitle>
                <ExportMenu onExport={exportHistory} />
              </CardHeader>
              <CardContent>
                <div className="max-h-[600px] overflow-auto rounded border">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-gray-50 text-gray-600">
                      <tr className="[&>th]:whitespace-nowrap [&>th]:border-b [&>th]:px-2 [&>th]:py-1.5">
                        <th className="text-left">S/No</th>
                        <th className="text-left">Date</th>
                        <th className="text-left">Dr/Cr</th>
                        <th className="text-left">Particulars</th>
                        <th className="text-left">Category</th>
                        <th className="text-left">Vch Type</th>
                        <th className="text-left">Vch No.</th>
                        <th className="text-left">Document</th>
                        <th className="text-right">Cash In (Debit)</th>
                        <th className="text-right">Cash Out (Credit)</th>
                        <th className="text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="bg-muted/40 font-semibold [&>td]:border-b [&>td]:px-2 [&>td]:py-1.5">
                        <td />
                        <td className="whitespace-nowrap">{date(data.date_from)}</td>
                        <td>{data.book.opening_balance.side}</td>
                        <td colSpan={5}>Opening Balance</td>
                        <td className="text-right tabular-nums">{data.book.opening_balance.side === "Dr" ? money(data.book.opening_balance.amount) : ""}</td>
                        <td className="text-right tabular-nums">{data.book.opening_balance.side === "Cr" ? money(data.book.opening_balance.amount) : ""}</td>
                        <td className="text-right tabular-nums whitespace-nowrap">{money(data.book.opening_balance.amount)} {data.book.opening_balance.side}</td>
                      </tr>
                      {data.book.rows.length === 0 && (
                        <tr><td colSpan={11} className="px-2 py-3 text-center text-muted-foreground">No cash movements in this period.</td></tr>
                      )}
                      {data.book.rows.map((r, i) => (
                        <tr key={r.id} className={`align-top [&>td]:border-b [&>td]:px-2 [&>td]:py-1.5 ${r.reversed ? "text-muted-foreground line-through" : ""} ${r.kind === "withdrawal" ? "bg-green-50/60" : ""}`}>
                          <td className="text-muted-foreground">{i + 1}</td>
                          <td className="whitespace-nowrap">{date(r.date)}</td>
                          <td>{r.side}</td>
                          <td className="min-w-[200px]">
                            <span className="font-semibold">{r.kind === "withdrawal" ? `Cash from ${r.particulars}` : r.particulars}</span>
                            {r.narration && <span className="block text-[10px] text-muted-foreground">{r.narration}</span>}
                          </td>
                          <td className="whitespace-nowrap">{r.category ?? ""}</td>
                          <td className="whitespace-nowrap">{r.voucher_type}</td>
                          <td className="whitespace-nowrap">
                            {r.expense_id ? <a className="text-primary hover:underline" href={`/expenses/${r.expense_id}`}>{r.voucher_no}</a> : r.voucher_no}
                          </td>
                          <td>
                            {r.receipt_url ? (
                              <FileLink href={r.receipt_url} className="inline-flex items-center gap-1 text-primary hover:underline">Receipt <ExternalLink className="h-3 w-3" /></FileLink>
                            ) : ""}
                          </td>
                          <td className="text-right tabular-nums font-medium text-green-700">{r.debit ? money(r.debit) : ""}</td>
                          <td className="text-right tabular-nums font-medium text-red-700">{r.credit ? money(r.credit) : ""}</td>
                          <td className={`text-right tabular-nums whitespace-nowrap ${r.balance_side === "Cr" && r.balance > 0 ? "text-red-600" : ""}`}>{money(r.balance)} {r.balance_side}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="font-bold">
                      <tr className="[&>td]:border-b [&>td]:px-2 [&>td]:py-1.5">
                        <td colSpan={8}>Total</td>
                        <td className="text-right tabular-nums">{money(data.book.totals.debit)}</td>
                        <td className="text-right tabular-nums">{money(data.book.totals.credit)}</td>
                        <td />
                      </tr>
                      <tr className="bg-muted/40 [&>td]:px-2 [&>td]:py-1.5">
                        <td />
                        <td />
                        <td>{data.book.closing_balance.side}</td>
                        <td colSpan={7}>Closing Balance</td>
                        <td className="text-right tabular-nums whitespace-nowrap">{money(data.book.closing_balance.amount)} {data.book.closing_balance.side}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reconciliation">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">{period === "month" ? "Monthly" : "Daily"} Petty Cash Reconciliation · {rangeText}</CardTitle>
                <ExportMenu onExport={exportRecon} disabled={!data.reconciliation.length} />
              </CardHeader>
              <CardContent>
                <p className="mb-2 text-xs text-muted-foreground">
                  Opening + From Bank + Other Cash In - Spent - Transferred Out = Closing (books). Counted is the physical count recorded for that{" "}
                  {period === "month" ? "month (the last one)" : "day"}; Difference = Counted - books at the time of the count (minus = shortage, plus = surplus).
                </p>
                <div className="overflow-auto rounded border">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr className="[&>th]:whitespace-nowrap [&>th]:border-b [&>th]:px-2 [&>th]:py-1.5">
                        <th className="text-left">S/No</th>
                        <th className="text-left">{period === "month" ? "Month" : "Date"}</th>
                        <th className="text-right">Opening</th>
                        <th className="text-right">From Bank</th>
                        <th className="text-right">Other Cash In</th>
                        <th className="text-right">Spent</th>
                        <th className="text-right">Transferred Out</th>
                        <th className="text-right">Closing (Books)</th>
                        <th className="text-right">Counted</th>
                        <th className="text-right">Difference</th>
                        <th className="text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.reconciliation.length === 0 && (
                        <tr><td colSpan={11} className="px-2 py-3 text-center text-muted-foreground">No cash movements or counts in this period.</td></tr>
                      )}
                      {data.reconciliation.map((l, i) => (
                        <tr key={l.period} className="[&>td]:border-b [&>td]:px-2 [&>td]:py-1.5">
                          <td className="text-muted-foreground">{i + 1}</td>
                          <td className="whitespace-nowrap">{periodLabel(l.period)}</td>
                          <td className="text-right tabular-nums">{signed(l.opening)}</td>
                          <td className="text-right tabular-nums text-green-700">{l.received_from_bank ? money(l.received_from_bank) : ""}</td>
                          <td className="text-right tabular-nums">{l.other_receipts ? money(l.other_receipts) : ""}</td>
                          <td className="text-right tabular-nums text-red-700">{l.spent ? money(l.spent) : ""}</td>
                          <td className="text-right tabular-nums">{l.transferred_out ? money(l.transferred_out) : ""}</td>
                          <td className={`text-right tabular-nums font-semibold ${l.closing < 0 ? "text-red-600" : ""}`}>{signed(l.closing)}</td>
                          <td className="text-right tabular-nums">{l.counted !== null ? money(l.counted) : ""}</td>
                          <td className={`text-right tabular-nums ${l.difference && l.difference < 0 ? "text-red-600" : l.difference ? "text-amber-700" : ""}`}>
                            {l.difference !== null ? money(l.difference) : ""}
                          </td>
                          <td><Badge className={STATUS[l.status].className}>{STATUS[l.status].label}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="accounts">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">Cash Spent by Expense Account · {rangeText}</CardTitle>
                <ExportMenu onExport={exportByAccount} disabled={!data.by_account.length} />
              </CardHeader>
              <CardContent>
                <div className="overflow-auto rounded border">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr className="[&>th]:border-b [&>th]:px-3 [&>th]:py-2">
                        <th className="text-left w-14">S/No</th>
                        <th className="text-left">Expense Account</th>
                        <th className="text-right">Entries</th>
                        <th className="text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.by_account.length === 0 && (
                        <tr><td colSpan={4} className="px-3 py-3 text-center text-muted-foreground">No cash spent in this period.</td></tr>
                      )}
                      {data.by_account.map((a, i) => (
                        <tr key={a.account} className="[&>td]:border-b [&>td]:px-3 [&>td]:py-2">
                          <td className="text-muted-foreground">{i + 1}</td>
                          <td>{a.account}</td>
                          <td className="text-right">{a.count}</td>
                          <td className="text-right tabular-nums">{money(a.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="font-bold">
                      <tr className="[&>td]:px-3 [&>td]:py-2">
                        <td />
                        <td>Total</td>
                        <td className="text-right">{data.by_account.reduce((x, a) => x + a.count, 0)}</td>
                        <td className="text-right tabular-nums">{money(data.by_account.reduce((x, a) => x + a.amount, 0))}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="counts">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">Physical Cash Counts · {rangeText}</CardTitle>
                <ExportMenu onExport={exportCounts} disabled={!data.counts.length} />
              </CardHeader>
              <CardContent>
                <div className="overflow-auto rounded border">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr className="[&>th]:whitespace-nowrap [&>th]:border-b [&>th]:px-3 [&>th]:py-2">
                        <th className="text-left w-14">S/No</th>
                        <th className="text-left">Date</th>
                        <th className="text-right">Counted</th>
                        <th className="text-right">Books Balance</th>
                        <th className="text-right">Difference</th>
                        <th className="text-left">Status</th>
                        <th className="text-left">Counted By</th>
                        <th className="text-left">Notes</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {data.counts.length === 0 && (
                        <tr><td colSpan={9} className="px-3 py-3 text-center text-muted-foreground">No cash counts in this period. Use Count Cash to record one.</td></tr>
                      )}
                      {data.counts.map((k, i) => (
                        <tr key={k.id} className="align-top [&>td]:border-b [&>td]:px-3 [&>td]:py-2">
                          <td className="text-muted-foreground">{i + 1}</td>
                          <td className="whitespace-nowrap">{date(k.count_date)}</td>
                          <td className="text-right tabular-nums">{money(k.counted_amount)}</td>
                          <td className="text-right tabular-nums">{signed(k.system_balance)}</td>
                          <td className={`text-right tabular-nums ${k.difference < 0 ? "text-red-600" : k.difference > 0 ? "text-amber-700" : ""}`}>{money(k.difference)}</td>
                          <td><Badge className={STATUS[k.status].className}>{STATUS[k.status].label}</Badge></td>
                          <td>{k.counted_by ?? ""}</td>
                          <td className="max-w-[260px]">
                            {k.notes}
                            {k.denominations && (
                              <span className="block text-[10px] text-muted-foreground">
                                {Object.entries(k.denominations).filter(([, n]) => n > 0).sort(([a], [b]) => Number(b) - Number(a)).map(([d, n]) => `${n} x ${d}`).join(", ")}
                              </span>
                            )}
                          </td>
                          <td>
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Delete" onClick={() => removeCount(k)}>
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={wOpen} onOpenChange={setWOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Cash Received from Bank</DialogTitle>
            <DialogDescription>
              A withdrawal is a transfer from the bank into petty cash, not an expense. It shows as a payment in the Bank Book and cash
              in here. Record what the cash is spent on as cash expenses.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" max={ymd(new Date())} value={w.transfer_date} onChange={(e) => setW({ ...w, transfer_date: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Cheque / slip no.</Label>
                <Input value={w.reference} onChange={(e) => setW({ ...w, reference: e.target.value })} placeholder="e.g. 000015" />
              </div>
            </div>
            {banks.length > 1 && (
              <div className="space-y-1.5">
                <Label>From bank</Label>
                <Select value={w.from_account_id} onValueChange={(v) => setW({ ...w, from_account_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Bank" /></SelectTrigger>
                  <SelectContent>{banks.map((b) => <SelectItem key={b.id} value={b.id}>{b.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {banks.length === 1 && <p className="text-sm text-muted-foreground">From: <b>{banks[0].label}</b></p>}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Amount (KES)</Label>
                <Input type="number" min="0" step="0.01" className="min-w-[140px]" value={w.amount} onChange={(e) => setW({ ...w, amount: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Bank charge (KES)</Label>
                <Input type="number" min="0" step="0.01" className="min-w-[140px]" placeholder="0.00" value={w.charges} onChange={(e) => setW({ ...w, charges: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Purpose</Label>
              <Input value={w.purpose} onChange={(e) => setW({ ...w, purpose: e.target.value })} placeholder="e.g. Petty cash top-up for the week" />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea rows={2} value={w.notes} onChange={(e) => setW({ ...w, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWOpen(false)} disabled={wSaving}>Cancel</Button>
            <Button onClick={saveWithdrawal} disabled={wSaving || !(Number(w.amount) > 0) || !w.transfer_date}>
              {wSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cOpen} onOpenChange={setCOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Count Cash</DialogTitle>
            <DialogDescription>
              Count the cash in the box and enter it by note/coin, or just the total. It is compared with what the books say should be
              there at the end of that day; the difference is a shortage (-) or surplus (+).
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label>Count date</Label>
              <Input type="date" max={ymd(new Date())} value={c.count_date} onChange={(e) => setC({ ...c, count_date: e.target.value })} />
            </div>
            <div className="rounded-md border p-3">
              <p className="mb-2 text-sm font-medium">Notes and coins (optional)</p>
              <div className="grid grid-cols-2 gap-2">
                {NOTES.map((n) => (
                  <div key={n} className="flex items-center gap-2">
                    <span className="w-14 text-right text-sm tabular-nums">{n.toLocaleString()} x</span>
                    <Input type="number" min="0" step="1" className="h-8 w-[90px]" value={notes[n] ?? ""} onChange={(e) => setNotes({ ...notes, [n]: e.target.value })} />
                    <span className="text-xs text-muted-foreground tabular-nums">{Number(notes[n]) > 0 ? money(n * Number(notes[n])) : ""}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Total counted (KES)</Label>
              {usingNotes ? (
                <p className="text-lg font-bold font-mono">{money(notesTotal)}</p>
              ) : (
                <Input type="number" min="0" step="0.01" className="min-w-[160px]" value={c.counted_amount} onChange={(e) => setC({ ...c, counted_amount: e.target.value })} />
              )}
            </div>
            {data && c.count_date === ymd(new Date()) && (
              <p className="rounded-md bg-muted p-3 text-sm">
                Books balance now: <b>{signed(data.balance_now)}</b>
                {(usingNotes || c.counted_amount !== "") && (
                  <> · Difference: <b className={counted - data.balance_now < 0 ? "text-red-600" : counted - data.balance_now > 0 ? "text-amber-700" : "text-green-700"}>
                    {money(counted - data.balance_now)}</b> ({Math.abs(counted - data.balance_now) < 0.005 ? "balanced" : counted - data.balance_now < 0 ? "shortage" : "surplus"})</>
                )}
              </p>
            )}
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea rows={2} value={c.notes} onChange={(e) => setC({ ...c, notes: e.target.value })} placeholder="Who counted with you, explanation of any difference" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCOpen(false)} disabled={cSaving}>Cancel</Button>
            <Button onClick={saveCount} disabled={cSaving || !c.count_date || (!usingNotes && c.counted_amount === "")}>
              {cSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Count
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
