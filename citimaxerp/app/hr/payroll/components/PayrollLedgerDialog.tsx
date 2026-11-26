"use client"

import { useCallback, useEffect, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BookOpen, Loader2, RefreshCw } from "lucide-react"
import { ExportMenu, useTableExport } from "@/components/export-menu"
import { displayDate } from "@/lib/date-format"
import {
  fetchPayrollLedger,
  fetchPayrollLedgerAccounts,
  type PayrollLedgerAccount,
  type PayrollLedgerDetail,
} from "@/lib/payroll-runs"
import { PayrollMonthJournal } from "./PayrollMonthJournal"

const money = (n: number) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const day = (d?: string | null) => (d ? displayDate(d) : "")

/**
 * Payroll > Open Ledger: each payroll payable account (Net Salaries, PAYE, NSSF, SHIF, Housing Levy, HELB,
 * NITA, Other Deductions) with its balance; for the one picked, its ledger in the Tally layout (as the
 * supplier ledger) and its payees - who it is owed to, what was paid and what is left.
 */
export function PayrollLedgerDialog({ open, onOpenChange, runId, runLabel }: {
  open: boolean
  onOpenChange: (v: boolean) => void
  // From a payroll month's page: opens on that month's journal (Payroll Data / Journals / Ledger Summary).
  runId?: string
  runLabel?: string
}) {
  const [view, setView] = useState<"month" | "accounts">(runId ? "month" : "accounts")
  const [accounts, setAccounts] = useState<PayrollLedgerAccount[]>([])
  const [key, setKey] = useState("salaries_payable")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [corrections, setCorrections] = useState(false)
  const [tab, setTab] = useState("ledger")
  const [data, setData] = useState<PayrollLedgerDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    fetchPayrollLedgerAccounts().then(setAccounts).catch(() => setAccounts([]))
  }, [open])

  const load = useCallback(async (k: string, p: { from: string; to: string; corrections: boolean }) => {
    setLoading(true)
    setError(null)
    try {
      setData(await fetchPayrollLedger(k, p))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the ledger")
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) load(key, { from, to, corrections })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, key])

  const l = data?.ledger
  const period = l?.date_from || l?.date_to
    ? `${l?.date_from ? day(l.date_from) : "Start"} to ${l?.date_to ? day(l.date_to) : "date"}`
    : "All time"
  // Totals include the opening balance on its side, as Tally adds it in.
  const totalDebit = (l?.totals.debit ?? 0) + (l?.opening_balance.side === "Dr" ? l.opening_balance.amount : 0)
  const totalCredit = (l?.totals.credit ?? 0) + (l?.opening_balance.side === "Cr" ? l?.opening_balance.amount ?? 0 : 0)

  const statutory = data?.payees.kind === "statutory"
  const payees = data?.payees.rows ?? []
  const payeeTotals = payees.reduce((t, r) => ({ amount: t.amount + r.amount, paid: t.paid + r.paid, balance: t.balance + r.balance }), { amount: 0, paid: 0, balance: 0 })

  const onExport = useTableExport(() => {
    const d = data!
    if (tab === "payees") {
      return {
        fileName: `Payees ${d.label} ${new Date().toISOString().slice(0, 10)}`,
        title: `Payees: ${d.label}`,
        subtitle: `${d.account} · ${period}`,
        headers: statutory
          ? ["S/No", "Paid To", "Period", "Employee Share", "Employer Share", "Amount Due", "Paid", "Balance", "Status", "Due Date", "Paid Date", "Reference"]
          : ["S/No", "Payee", "Employee No.", "Period", "Amount", "Paid", "Balance", "Status", "Paid Date", "Reference"],
        moneyColumns: statutory ? [3, 4, 5, 6, 7] : [4, 5, 6],
        rows: payees.map((r, i) => statutory
          ? [i + 1, r.payee, r.period, r.employee_share ?? 0, r.employer_share ?? 0, r.amount, r.paid, r.balance, r.status, day(r.due_date), day(r.paid_date), r.reference ?? ""]
          : [i + 1, r.payee, r.employee_number ?? "", r.period, r.amount, r.paid, r.balance, r.status, day(r.paid_date), r.reference ?? ""]),
        footer: [statutory
          ? ["", "Total", "", "", "", payeeTotals.amount, payeeTotals.paid, payeeTotals.balance, "", "", "", ""]
          : ["", "Total", "", "", payeeTotals.amount, payeeTotals.paid, payeeTotals.balance, "", "", ""]],
      }
    }
    const g = d.ledger
    return {
      fileName: `Ledger ${d.label} ${new Date().toISOString().slice(0, 10)}`,
      title: `Ledger Account: ${d.account}`,
      subtitle: period,
      headers: ["S/No", "Date", "Dr/Cr", "Particulars", "Vch Type", "Vch No.", "Debit", "Credit"],
      moneyColumns: [6, 7],
      rows: [
        ["", day(g.date_from), g.opening_balance.side, "Opening Balance", "", "",
          g.opening_balance.side === "Dr" ? g.opening_balance.amount : null, g.opening_balance.side === "Cr" ? g.opening_balance.amount : null],
        ...g.rows.map((r, i) => [i + 1, day(r.date), r.side, r.particulars, r.voucher_type, r.voucher_no, r.debit || null, r.credit || null]),
      ],
      footer: [
        ["", "", "", "Total", "", "", totalDebit, totalCredit],
        ["", "", g.closing_balance.side, "Closing Balance", "", "",
          g.closing_balance.side === "Cr" ? g.closing_balance.amount : null, g.closing_balance.side === "Dr" ? g.closing_balance.amount : null],
      ],
    }
  })

  const cell = "[&>td]:border-b [&>td]:px-2 [&>td]:py-1.5"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5" /> Payroll Ledger</DialogTitle>
          <DialogDescription>
            The payroll accounts in the books: what is owed to staff and to each statutory body, every entry (Dr/Cr), and the payees.
          </DialogDescription>
        </DialogHeader>

        {runId && (
          <Tabs value={view} onValueChange={(v) => setView(v as "month" | "accounts")}>
            <TabsList>
              <TabsTrigger value="month">{runLabel ? `${runLabel} Journal` : "This Month"}</TabsTrigger>
              <TabsTrigger value="accounts">Payable Accounts</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
        {runId && view === "month" && open && <PayrollMonthJournal runId={runId} />}

        {(!runId || view === "accounts") && (<div className="space-y-4">
        {/* The payroll payable accounts - pick one */}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {accounts.map((a) => (
            <button
              key={a.key}
              type="button"
              onClick={() => setKey(a.key)}
              className={`rounded-lg border p-3 text-left transition hover:bg-muted/50 ${key === a.key ? "border-primary ring-1 ring-primary" : ""}`}
            >
              <div className="text-xs text-muted-foreground">{a.account_code} · {a.paid_to}</div>
              <div className="text-sm font-medium">{a.label}</div>
              <div className={`mt-1 font-mono text-sm font-semibold ${a.balance.side === "Cr" && a.balance.amount > 0 ? "text-red-600" : "text-green-700"}`}>
                {money(a.balance.amount)} {a.balance.side}
              </div>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div>
            <Label htmlFor="pl_from" className="text-xs">From</Label>
            <Input id="pl_from" type="date" className="h-8 w-[150px]" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="pl_to" className="text-xs">To</Label>
            <Input id="pl_to" type="date" className="h-8 w-[150px]" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <Button size="sm" onClick={() => load(key, { from, to, corrections })} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Apply
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setFrom(""); setTo(""); load(key, { from: "", to: "", corrections }) }}>All Time</Button>
          <label className="flex items-center gap-2 text-xs">
            <Switch checked={corrections} onCheckedChange={(v) => { setCorrections(v); load(key, { from, to, corrections: v }) }} />
            Show edits &amp; reversals
          </label>
          <ExportMenu onExport={onExport} disabled={!data} />
        </div>

        {loading && !data ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading ledger...</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : data && l && (
          <Tabs value={tab} onValueChange={setTab}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <TabsList>
                <TabsTrigger value="ledger">Ledger</TabsTrigger>
                <TabsTrigger value="payees">Payees ({payees.length})</TabsTrigger>
              </TabsList>
              <span className={`text-sm font-semibold ${l.closing_balance.side === "Cr" && l.closing_balance.amount > 0 ? "text-red-600" : "text-green-700"}`}>
                {data.account}: {money(l.closing_balance.amount)} {l.closing_balance.side}
              </span>
            </div>

            <TabsContent value="ledger" className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {period} · Credit: owed by payroll (each approved month). Debit: paid out (salaries, or the statutory body). Particulars is the
                other side of each entry. Closing balance Cr = still owed to {data.paid_to}.
              </p>
              <div className="max-h-[460px] overflow-auto rounded border">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-gray-50 text-gray-600">
                    <tr className="[&>th]:whitespace-nowrap [&>th]:border-b [&>th]:px-2 [&>th]:py-1.5">
                      <th className="text-left">S/No</th>
                      <th className="text-left">Date</th>
                      <th className="text-left">Dr/Cr</th>
                      <th className="text-left">Particulars</th>
                      <th className="text-left">Vch Type</th>
                      <th className="text-left">Vch No.</th>
                      <th className="text-right">Debit</th>
                      <th className="text-right">Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className={`bg-muted/40 font-semibold ${cell}`}>
                      <td />
                      <td className="whitespace-nowrap">{day(l.date_from)}</td>
                      <td>{l.opening_balance.side}</td>
                      <td>Opening Balance</td>
                      <td />
                      <td />
                      <td className="text-right tabular-nums">{l.opening_balance.side === "Dr" ? money(l.opening_balance.amount) : ""}</td>
                      <td className="text-right tabular-nums">{l.opening_balance.side === "Cr" ? money(l.opening_balance.amount) : ""}</td>
                    </tr>
                    {l.rows.length === 0 && (
                      <tr><td colSpan={8} className="px-2 py-3 text-center text-muted-foreground">No entries in this period.</td></tr>
                    )}
                    {l.rows.map((r, i) => (
                      <tr key={r.id} className={`align-top ${cell} ${r.reversed ? "text-muted-foreground line-through" : ""}`}>
                        <td className="text-muted-foreground">{i + 1}</td>
                        <td className="whitespace-nowrap">{day(r.date)}</td>
                        <td>{r.side}</td>
                        <td className="min-w-[160px]">
                          <span className="font-semibold">{r.particulars}</span>
                          {r.other_accounts.length > 0 && <span className="block text-[10px] text-muted-foreground">{r.other_accounts.join(" · ")}</span>}
                        </td>
                        <td className="whitespace-nowrap">{r.voucher_type}</td>
                        <td className="whitespace-nowrap">{r.voucher_no}</td>
                        <td className="text-right tabular-nums font-medium">{r.debit ? money(r.debit) : ""}</td>
                        <td className="text-right tabular-nums font-medium">{r.credit ? money(r.credit) : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="font-bold">
                    <tr className={cell}>
                      <td colSpan={6}>Total</td>
                      <td className="text-right tabular-nums">{money(totalDebit)}</td>
                      <td className="text-right tabular-nums">{money(totalCredit)}</td>
                    </tr>
                    <tr className="bg-muted/40 [&>td]:px-2 [&>td]:py-1.5">
                      <td />
                      <td />
                      <td>{l.closing_balance.side}</td>
                      <td colSpan={3}>Closing Balance</td>
                      {/* Tally writes the closing balance on the other column, the figure that balances the two. */}
                      <td className="text-right tabular-nums">{l.closing_balance.side === "Cr" ? money(l.closing_balance.amount) : ""}</td>
                      <td className="text-right tabular-nums">{l.closing_balance.side === "Dr" ? money(l.closing_balance.amount) : ""}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </TabsContent>

            <TabsContent value="payees" className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {statutory
                  ? `What each payroll month owes ${data.paid_to}, what was paid and the balance (pay it in the Statutory Payments tab).`
                  : data.payees.kind === "employees"
                    ? "Net pay owed to each employee, month by month - paid once the month's salaries are confirmed paid."
                    : "Other deductions held from each employee's pay, month by month, until paid over."}
                {" "}Payroll months that post to the books only (past &quot;Record&quot; months are not in the ledger).
              </p>
              <div className="max-h-[460px] overflow-auto rounded border">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-gray-50 text-gray-600">
                    <tr className="[&>th]:whitespace-nowrap [&>th]:border-b [&>th]:px-2 [&>th]:py-1.5">
                      <th className="text-left">S/No</th>
                      <th className="text-left">{statutory ? "Paid To" : "Payee"}</th>
                      {!statutory && <th className="text-left">Employee No.</th>}
                      <th className="text-left">Period</th>
                      {statutory && <th className="text-right">Employee Share</th>}
                      {statutory && <th className="text-right">Employer Share</th>}
                      <th className="text-right">{statutory ? "Amount Due" : "Amount"}</th>
                      <th className="text-right">Paid</th>
                      <th className="text-right">Balance</th>
                      <th className="text-left">Status</th>
                      {statutory && <th className="text-left">Due Date</th>}
                      <th className="text-left">Paid Date</th>
                      <th className="text-left">Reference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payees.length === 0 && (
                      <tr><td colSpan={13} className="px-2 py-3 text-center text-muted-foreground">Nothing owed in this period.</td></tr>
                    )}
                    {payees.map((r, i) => (
                      <tr key={`${r.payee}-${r.period}-${i}`} className={cell}>
                        <td className="text-muted-foreground">{i + 1}</td>
                        <td className="font-medium">{r.payee}</td>
                        {!statutory && <td>{r.employee_number ?? ""}</td>}
                        <td className="whitespace-nowrap">{r.period}</td>
                        {statutory && <td className="text-right tabular-nums">{money(r.employee_share ?? 0)}</td>}
                        {statutory && <td className="text-right tabular-nums">{money(r.employer_share ?? 0)}</td>}
                        <td className="text-right tabular-nums font-medium">{money(r.amount)}</td>
                        <td className="text-right tabular-nums">{money(r.paid)}</td>
                        <td className={`text-right tabular-nums font-medium ${r.balance > 0 ? "text-red-600" : "text-green-700"}`}>{money(r.balance)}</td>
                        <td className="whitespace-nowrap">{r.status}</td>
                        {statutory && <td className="whitespace-nowrap">{day(r.due_date)}</td>}
                        <td className="whitespace-nowrap">{day(r.paid_date)}</td>
                        <td className="whitespace-nowrap">{r.reference ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                  {payees.length > 0 && (
                    <tfoot className="font-bold">
                      <tr className={cell}>
                        <td colSpan={statutory ? 5 : 4}>Total</td>
                        <td className="text-right tabular-nums">{money(payeeTotals.amount)}</td>
                        <td className="text-right tabular-nums">{money(payeeTotals.paid)}</td>
                        <td className="text-right tabular-nums">{money(payeeTotals.balance)}</td>
                        <td colSpan={statutory ? 4 : 3} />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </TabsContent>
          </Tabs>
        )}
        </div>)}
      </DialogContent>
    </Dialog>
  )
}
