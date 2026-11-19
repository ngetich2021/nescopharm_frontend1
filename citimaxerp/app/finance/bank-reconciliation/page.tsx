"use client"

import { displayDate } from "@/lib/date-format"
import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ArrowLeft, CheckCircle2, Landmark, Loader2, Lock, RefreshCw, Scale, XCircle } from "lucide-react"
import { ExportMenu, useTableExport } from "@/components/export-menu"
import { useToast } from "@/hooks/use-toast"
import apiCall from "@/lib/api"
import { sessionCompanyName } from "@/lib/document-names"

type BankAccount = { id: string; code: string; name: string; label: string; balance: number; last_reconciled: string | null }
type Row = {
  id: string
  date: string
  particulars: string
  account: string | null
  narration: string | null
  voucher_type: string
  voucher_no: string
  debit: number
  credit: number
  bank_date: string | null
  status: "cleared" | "not_in_bank" | "not_in_books" | "after"
  locked: boolean
}
type Summary = {
  book_balance: number
  deposits_not_credited: number
  payments_not_debited: number
  in_bank_not_in_books: number
  bank_balance_from_books: number
  statement_balance: number | null
  difference: number | null
  entries_cleared: number
}
type HistoryRow = {
  id: string
  statement_date: string
  statement_balance: string
  book_balance: string
  deposits_not_credited: string
  payments_not_debited: string
  in_bank_not_in_books: string
  difference: string
  entries_cleared: number
  notes: string | null
  reconciled_by_name: string | null
  reconciled_at: string | null
}
type Statement = { account: { id: string; code: string; name: string }; statement_date: string; rows: Row[]; summary: Summary; locked_to: string | null; history: HistoryRow[] }

const money = (n: number | string | null | undefined) =>
  Number(n || 0).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const signed = (n: number) => `${money(Math.abs(n))} ${n < 0 ? "Cr" : "Dr"}`
const date = (d?: string | null) => (d ? displayDate(new Date(d)) : "")
const today = () => new Date().toISOString().slice(0, 10)

const STATUS: Record<Row["status"], { label: string; cls: string }> = {
  cleared: { label: "In bank", cls: "bg-green-100 text-green-800" },
  not_in_bank: { label: "Not in bank yet", cls: "bg-amber-100 text-amber-800" },
  not_in_books: { label: "In bank, later in books", cls: "bg-blue-100 text-blue-800" },
  after: { label: "After statement", cls: "bg-gray-100 text-gray-700" },
}

/**
 * Bank Reconciliation Statement, as in Tally: give each Bank Book entry the date it went through the
 * bank, type the statement balance, and the screen shows Balance as per Books, what is not yet in the
 * bank, and Balance as per Bank - which must equal the statement. Saving locks those entries.
 */
export default function BankReconciliationPage() {
  const { toast } = useToast()
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [selected, setSelected] = useState("")
  const [canEdit, setCanEdit] = useState(false)
  const [statementDate, setStatementDate] = useState(today())
  const [statementBalance, setStatementBalance] = useState("")
  const [show, setShow] = useState<"uncleared" | "all">("uncleared")
  const [from, setFrom] = useState("")
  const [data, setData] = useState<Statement | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set())
  const [picked, setPicked] = useState<string[]>([])
  const [bulkDate, setBulkDate] = useState(today())
  const [notes, setNotes] = useState("")
  const [completing, setCompleting] = useState(false)
  const [reopenId, setReopenId] = useState<string | null>(null)

  useEffect(() => {
    apiCall<{ data: BankAccount[]; can_edit: boolean }>("/finance/brs/accounts", "GET")
      .then((res) => {
        setAccounts(res.data)
        setCanEdit(!!res.can_edit)
        setSelected(res.data[0]?.id ?? "")
        if (!res.data.length) setLoading(false)
      })
      .catch((e) => { setError(e instanceof Error ? e.message : "Could not load the bank accounts"); setLoading(false) })
  }, [])

  const load = useCallback(async (opts?: { quiet?: boolean }) => {
    if (!selected) return
    if (!opts?.quiet) setLoading(true)
    setError(null)
    try {
      const q = new URLSearchParams({ statement_date: statementDate, show })
      if (statementBalance.trim() !== "") q.set("statement_balance", statementBalance.replace(/,/g, ""))
      if (from) q.set("date_from", from)
      const res = await apiCall<{ data: Statement; can_edit: boolean }>(`/finance/brs/${selected}?${q}`, "GET")
      setData(res.data)
      setCanEdit(!!res.can_edit)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the reconciliation")
    } finally {
      setLoading(false)
    }
  }, [selected, statementDate, statementBalance, show, from])

  useEffect(() => { if (selected) { setPicked([]); load() } }, [selected]) // eslint-disable-line react-hooks/exhaustive-deps

  const saveBankDates = async (items: { journal_entry_id: string; bank_date: string | null }[]) => {
    setSavingIds((s) => new Set([...s, ...items.map((i) => i.journal_entry_id)]))
    try {
      await apiCall(`/finance/brs/${selected}/bank-dates`, "POST", { items })
      await load({ quiet: true })
    } catch (e) {
      toast({ title: "Bank date not saved", description: e instanceof Error ? e.message : String(e), variant: "destructive" })
    } finally {
      setSavingIds((s) => { const n = new Set(s); items.forEach((i) => n.delete(i.journal_entry_id)); return n })
    }
  }

  const bulk = async (mode: "date" | "own" | "clear") => {
    const rows = (data?.rows ?? []).filter((r) => picked.includes(r.id) && !r.locked)
    if (!rows.length) return
    await saveBankDates(rows.map((r) => ({
      journal_entry_id: r.id,
      bank_date: mode === "clear" ? null : mode === "own" ? r.date : bulkDate,
    })))
    setPicked([])
  }

  const complete = async () => {
    setCompleting(true)
    try {
      const res = await apiCall<{ message: string }>(`/finance/brs/${selected}/complete`, "POST", {
        statement_date: statementDate,
        statement_balance: Number(statementBalance.replace(/,/g, "")),
        notes: notes.trim() || null,
      })
      toast({ title: "Reconciliation saved", description: res.message })
      setNotes("")
      setAccounts((a) => a.map((x) => (x.id === selected ? { ...x, last_reconciled: statementDate } : x)))
      await load({ quiet: true })
    } catch (e) {
      toast({ title: "Not saved", description: e instanceof Error ? e.message : String(e), variant: "destructive" })
    } finally {
      setCompleting(false)
    }
  }

  const reopen = async () => {
    if (!reopenId) return
    try {
      const res = await apiCall<{ message: string }>(`/finance/brs/statements/${reopenId}`, "DELETE")
      toast({ title: "Reopened", description: res.message })
      const rest = (data?.history ?? []).filter((h) => h.id !== reopenId)
      setAccounts((a) => a.map((x) => (x.id === selected ? { ...x, last_reconciled: rest[0]?.statement_date ?? null } : x)))
      await load({ quiet: true })
    } catch (e) {
      toast({ title: "Not reopened", description: e instanceof Error ? e.message : String(e), variant: "destructive" })
    } finally {
      setReopenId(null)
    }
  }

  const current = accounts.find((a) => a.id === selected)
  const s = data?.summary
  const agrees = s?.difference !== null && s?.difference !== undefined && Math.abs(s.difference) < 0.005
  const editable = (data?.rows ?? []).filter((r) => !r.locked)
  const allPicked = editable.length > 0 && editable.every((r) => picked.includes(r.id))
  const totals = useMemo(() => (data?.rows ?? []).reduce((t, r) => ({ dr: t.dr + r.debit, cr: t.cr + r.credit }), { dr: 0, cr: 0 }), [data])

  const title = `Bank Reconciliation: ${current?.name ?? ""}`
  const onExport = useTableExport(() => {
    const d = data!
    const sum = d.summary
    return {
      fileName: `${sessionCompanyName()} Bank Reconciliation ${d.account.name} ${d.statement_date}`.replace(/[:/\\]/g, " "),
      title,
      subtitle: `As at ${date(d.statement_date)}`,
      headers: ["S/No", "Date", "Particulars", "Vch Type", "Vch No.", "Deposits (Debit)", "Withdrawals (Credit)", "Bank Date", "Status"],
      moneyColumns: [5, 6],
      rows: d.rows.map((r, i) => [i + 1, date(r.date), r.particulars, r.voucher_type, r.voucher_no, r.debit || null, r.credit || null, date(r.bank_date), STATUS[r.status].label]),
      footer: [
        ["", "", "Total", "", "", totals.dr, totals.cr, "", ""],
        ["", "", "Balance as per Company Books", "", "", null, null, signed(sum.book_balance), ""],
        ["", "", "Less: Deposits not yet credited by the bank", "", "", null, null, money(sum.deposits_not_credited), ""],
        ["", "", "Add: Payments not yet debited by the bank", "", "", null, null, money(sum.payments_not_debited), ""],
        ["", "", "Add / (Less): In the bank, not yet in the books", "", "", null, null, money(sum.in_bank_not_in_books), ""],
        ["", "", "Balance as per Bank (from the books)", "", "", null, null, signed(sum.bank_balance_from_books), ""],
        ["", "", "Balance as per Bank Statement", "", "", null, null, sum.statement_balance === null ? "" : signed(sum.statement_balance), ""],
        ["", "", "Difference", "", "", null, null, sum.difference === null ? "" : money(sum.difference), ""],
      ],
    }
  })

  const historyExport = useTableExport(() => ({
    fileName: `${sessionCompanyName()} Bank Reconciliations ${current?.name ?? ""}`.replace(/[:/\\]/g, " "),
    title: `Bank Reconciliations: ${current?.name ?? ""}`,
    headers: ["S/No", "Statement Date", "Statement Balance", "Book Balance", "Not Credited", "Not Debited", "In Bank Not Books", "Difference", "Entries Cleared", "Reconciled By", "Reconciled On", "Notes"],
    moneyColumns: [2, 3, 4, 5, 6, 7],
    rows: (data?.history ?? []).map((h, i) => [i + 1, date(h.statement_date), Number(h.statement_balance), Number(h.book_balance), Number(h.deposits_not_credited),
      Number(h.payments_not_debited), Number(h.in_bank_not_in_books), Number(h.difference), h.entries_cleared, h.reconciled_by_name || "", date(h.reconciled_at), h.notes || ""]),
  }))

  const line = (label: string, value: string, opts?: { strong?: boolean; muted?: boolean; cls?: string }) => (
    <div className={`flex items-center justify-between gap-4 py-1.5 ${opts?.strong ? "font-semibold" : ""} ${opts?.muted ? "text-muted-foreground" : ""} ${opts?.cls ?? ""}`}>
      <span>{label}</span>
      <span className="tabular-nums whitespace-nowrap">{value}</span>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Link href="/finance">
          <Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-2" /> Finance</Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bank Reconciliation</h1>
          <p className="text-muted-foreground">
            Give each Bank Book entry the date it went through the bank, type the statement balance, and save when the books agree.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {accounts.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setSelected(a.id)}
            className={`rounded-lg border p-4 text-left transition ${a.id === selected ? "border-primary ring-2 ring-primary/30 bg-primary/5" : "hover:bg-muted/50"}`}
          >
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Landmark className="h-4 w-4" /> Bank</div>
            <div className="mt-1 font-semibold">{a.name}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {a.last_reconciled ? `Reconciled to ${date(a.last_reconciled)}` : "Never reconciled"}
            </div>
          </button>
        ))}
        {!loading && accounts.length === 0 && !error && <p className="text-sm text-muted-foreground">No bank accounts are set up yet.</p>}
      </div>

      {selected && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <Card className="min-w-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Bank Book entries</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <Label htmlFor="brs_date" className="text-xs">Statement date (as at)</Label>
                  <Input id="brs_date" type="date" className="h-9 w-[160px]" max={today()} value={statementDate} onChange={(e) => setStatementDate(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="brs_bal" className="text-xs">Balance as per bank statement</Label>
                  <Input
                    id="brs_bal"
                    inputMode="decimal"
                    placeholder="e.g. 2,105,780.17"
                    className="h-9 w-[190px] text-right tabular-nums"
                    value={statementBalance}
                    onChange={(e) => setStatementBalance(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") load() }}
                  />
                </div>
                <div>
                  <Label className="text-xs">Show</Label>
                  <Select value={show} onValueChange={(v) => setShow(v as "uncleared" | "all")}>
                    <SelectTrigger className="h-9 w-[200px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="uncleared">Not yet in bank</SelectItem>
                      <SelectItem value="all">All entries</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {show === "all" && (
                  <div>
                    <Label htmlFor="brs_from" className="text-xs">From</Label>
                    <Input id="brs_from" type="date" className="h-9 w-[160px]" value={from} onChange={(e) => setFrom(e.target.value)} />
                  </div>
                )}
                <Button size="sm" className="h-9" onClick={() => load()} disabled={loading}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Apply
                </Button>
                <ExportMenu onExport={onExport} disabled={!data} />
              </div>

              {canEdit && picked.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 p-2 text-sm">
                  <span className="font-medium">{picked.length} selected:</span>
                  <Input type="date" className="h-8 w-[150px]" max={today()} value={bulkDate} onChange={(e) => setBulkDate(e.target.value)} />
                  <Button size="sm" variant="outline" className="h-8" onClick={() => bulk("date")}>Set bank date</Button>
                  <Button size="sm" variant="outline" className="h-8" onClick={() => bulk("own")}>Bank date = entry date</Button>
                  <Button size="sm" variant="ghost" className="h-8" onClick={() => bulk("clear")}>Clear bank date</Button>
                </div>
              )}

              {loading && !data ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</p>
              ) : error ? (
                <p className="text-sm text-red-600">{error}</p>
              ) : data ? (
                <>
                  <p className="text-xs text-muted-foreground">
                    {show === "uncleared"
                      ? `Entries up to ${date(data.statement_date)} that have not gone through the bank yet, and later entries the bank already shows.`
                      : `All entries up to ${date(data.statement_date)}${from ? ` from ${date(from)}` : ""}.`}{" "}
                    Type the date each one appears on the bank statement; it saves straight away.
                    {data.locked_to && ` Entries in the reconciliation to ${date(data.locked_to)} are locked.`}
                  </p>
                  <div className="max-h-[620px] overflow-auto rounded border">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 z-10 bg-gray-50 text-gray-600">
                        <tr className="[&>th]:whitespace-nowrap [&>th]:border-b [&>th]:px-2 [&>th]:py-1.5">
                          {canEdit && (
                            <th className="w-8">
                              <Checkbox checked={allPicked} onCheckedChange={(v) => setPicked(v ? editable.map((r) => r.id) : [])} aria-label="Select all" />
                            </th>
                          )}
                          <th className="text-left">S/No</th>
                          <th className="text-left">Date</th>
                          <th className="text-left">Particulars</th>
                          <th className="text-left">Vch Type</th>
                          <th className="text-left">Vch No.</th>
                          <th className="text-right">Deposits (Debit)</th>
                          <th className="text-right">Withdrawals (Credit)</th>
                          <th className="text-left">Bank Date</th>
                          <th className="text-left">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.rows.length === 0 && (
                          <tr><td colSpan={10} className="px-2 py-4 text-center text-muted-foreground">
                            {show === "uncleared" ? "Every entry up to this date has gone through the bank." : "No entries."}
                          </td></tr>
                        )}
                        {data.rows.map((r, i) => (
                          <tr key={r.id} className="align-top [&>td]:border-b [&>td]:px-2 [&>td]:py-1.5">
                            {canEdit && (
                              <td>
                                <Checkbox
                                  disabled={r.locked}
                                  checked={picked.includes(r.id)}
                                  onCheckedChange={(v) => setPicked((p) => (v ? [...p, r.id] : p.filter((x) => x !== r.id)))}
                                  aria-label={`Select ${r.voucher_no}`}
                                />
                              </td>
                            )}
                            <td className="text-muted-foreground">{i + 1}</td>
                            <td className="whitespace-nowrap">{date(r.date)}</td>
                            <td className="min-w-[180px]">
                              <span className="font-semibold">{r.particulars}</span>
                              {r.account && r.account !== r.particulars && <span className="block text-[10px] text-muted-foreground">{r.account}</span>}
                              {r.narration && <span className="block text-[10px] italic text-muted-foreground">{r.narration}</span>}
                            </td>
                            <td className="whitespace-nowrap">{r.voucher_type}</td>
                            <td className="whitespace-nowrap">{r.voucher_no}</td>
                            <td className="text-right tabular-nums font-medium">{r.debit ? money(r.debit) : ""}</td>
                            <td className="text-right tabular-nums font-medium">{r.credit ? money(r.credit) : ""}</td>
                            <td className="whitespace-nowrap">
                              {r.locked || !canEdit ? (
                                <span className="inline-flex items-center gap-1">
                                  {r.locked && <Lock className="h-3 w-3 text-muted-foreground" />}
                                  {date(r.bank_date) || "-"}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1">
                                  <Input
                                    type="date"
                                    className="h-7 w-[140px] text-xs"
                                    max={today()}
                                    defaultValue={r.bank_date ?? ""}
                                    key={`${r.id}-${r.bank_date}`}
                                    onBlur={(e) => {
                                      const v = e.target.value || null
                                      if (v !== r.bank_date) saveBankDates([{ journal_entry_id: r.id, bank_date: v }])
                                    }}
                                  />
                                  {savingIds.has(r.id) && <Loader2 className="h-3 w-3 animate-spin" />}
                                </span>
                              )}
                            </td>
                            <td><Badge variant="outline" className={`border-0 text-[10px] whitespace-nowrap ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</Badge></td>
                          </tr>
                        ))}
                      </tbody>
                      {data.rows.length > 0 && (
                        <tfoot className="font-bold">
                          <tr className="[&>td]:px-2 [&>td]:py-1.5">
                            {canEdit && <td />}
                            <td colSpan={5}>Total</td>
                            <td className="text-right tabular-nums">{money(totals.dr)}</td>
                            <td className="text-right tabular-nums">{money(totals.cr)}</td>
                            <td colSpan={2} />
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base"><Scale className="h-4 w-4" /> Reconciliation as at {date(statementDate)}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                {s ? (
                  <>
                    {line("Balance as per Company Books", signed(s.book_balance), { strong: true })}
                    {line("Less: Deposits not yet credited by the bank", money(s.deposits_not_credited), { muted: true })}
                    {line("Add: Payments not yet debited by the bank", money(s.payments_not_debited), { muted: true })}
                    {line("Add / (Less): In the bank, not yet in the books", money(s.in_bank_not_in_books), { muted: true })}
                    <div className="my-1 border-t" />
                    {line("Balance as per Bank (from the books)", signed(s.bank_balance_from_books), { strong: true })}
                    {line("Balance as per Bank Statement", s.statement_balance === null ? "Type it above" : signed(s.statement_balance), { muted: s.statement_balance === null })}
                    <div className="my-1 border-t" />
                    {s.difference === null ? (
                      <p className="py-2 text-xs text-muted-foreground">Type the statement balance and press Apply to see the difference.</p>
                    ) : (
                      <div className={`mt-1 flex items-center justify-between rounded-md px-3 py-2 font-semibold ${agrees ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>
                        <span className="flex items-center gap-2">{agrees ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />} Difference</span>
                        <span className="tabular-nums">{money(s.difference)}</span>
                      </div>
                    )}
                    <p className="mt-2 text-xs text-muted-foreground">{s.entries_cleared} entries up to this date are in the bank.</p>

                    {canEdit && (
                      <div className="mt-4 space-y-2">
                        <Textarea rows={2} placeholder="Notes (optional), e.g. statement page / reference" value={notes} onChange={(e) => setNotes(e.target.value)} />
                        <Button className="w-full" disabled={!agrees || completing || loading} onClick={complete}>
                          {completing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
                          Save reconciliation to {date(statementDate)}
                        </Button>
                        {!agrees && s.difference !== null && (
                          <p className="text-xs text-muted-foreground">Saving is possible once the difference is 0.00.</p>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-muted-foreground">Loading...</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">On the statement, not in the books?</CardTitle></CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                <p className="text-xs text-muted-foreground">Record it on its own screen; it then appears here to be given its bank date.</p>
                <Link className="block underline" href="/expenses">Bank charges / fees: Expenses &gt; Add Expense (Expenses &gt; Bank Charges, paid from Prime Bank)</Link>
                <Link className="block underline" href="/finance/bank-accounts">Cash withdrawal: Bank Accounts &gt; Withdraw / Transfer</Link>
                <Link className="block underline" href="/supplier-payments">Payment to a supplier: Supplier Payments</Link>
                <Link className="block underline" href="/finance/journal-entries">Anything else: Journal Entries</Link>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {data && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between gap-2 text-base">
              <span>Saved reconciliations: {current?.name}</span>
              <ExportMenu onExport={historyExport} disabled={!data.history.length} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.history.length === 0 ? (
              <p className="text-sm text-muted-foreground">None yet.</p>
            ) : (
              <div className="overflow-auto rounded border">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr className="[&>th]:whitespace-nowrap [&>th]:border-b [&>th]:px-2 [&>th]:py-1.5">
                      <th className="text-left">S/No</th>
                      <th className="text-left">Statement Date</th>
                      <th className="text-right">Statement Balance</th>
                      <th className="text-right">Book Balance</th>
                      <th className="text-right">Not Credited</th>
                      <th className="text-right">Not Debited</th>
                      <th className="text-right">In Bank Not Books</th>
                      <th className="text-right">Entries Cleared</th>
                      <th className="text-left">Reconciled By</th>
                      <th className="text-left">Reconciled On</th>
                      <th className="text-left">Notes</th>
                      {canEdit && <th />}
                    </tr>
                  </thead>
                  <tbody>
                    {data.history.map((h, i) => (
                      <tr key={h.id} className="[&>td]:border-b [&>td]:px-2 [&>td]:py-1.5">
                        <td className="text-muted-foreground">{i + 1}</td>
                        <td className="whitespace-nowrap font-medium">{date(h.statement_date)}</td>
                        <td className="text-right tabular-nums">{signed(Number(h.statement_balance))}</td>
                        <td className="text-right tabular-nums">{signed(Number(h.book_balance))}</td>
                        <td className="text-right tabular-nums">{money(h.deposits_not_credited)}</td>
                        <td className="text-right tabular-nums">{money(h.payments_not_debited)}</td>
                        <td className="text-right tabular-nums">{money(h.in_bank_not_in_books)}</td>
                        <td className="text-right">{h.entries_cleared}</td>
                        <td className="whitespace-nowrap">{h.reconciled_by_name || "-"}</td>
                        <td className="whitespace-nowrap">{date(h.reconciled_at)}</td>
                        <td className="max-w-[220px] truncate" title={h.notes || ""}>{h.notes || ""}</td>
                        {canEdit && (
                          <td>
                            {i === 0 && (
                              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setReopenId(h.id)}>Reopen</Button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <AlertDialog open={!!reopenId} onOpenChange={(o) => !o && setReopenId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reopen this reconciliation?</AlertDialogTitle>
            <AlertDialogDescription>
              The saved reconciliation is removed and its entries' bank dates can be changed again. The bank dates themselves are kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={reopen}>Reopen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
