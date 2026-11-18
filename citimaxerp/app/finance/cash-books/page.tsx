"use client"

import { displayDate } from "@/lib/date-format"
import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { ArrowLeft, BookOpen, Landmark, Loader2, RefreshCw, Wallet } from "lucide-react"
import { ExportMenu, useTableExport } from "@/components/export-menu"
import apiCall from "@/lib/api"
import { sessionCompanyName } from "@/lib/document-names"

type MoneyAccount = { id: string; code: string; name: string; label: string; balance: number }
type Side = "Dr" | "Cr"
type Book = {
  account: { id: string; code: string; name: string }
  date_from: string | null
  date_to: string | null
  opening_balance: { amount: number; side: Side }
  rows: Array<{
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
  }>
  totals: { debit: number; credit: number }
  closing_balance: { amount: number; side: Side }
}

const money = (n: number) => Number(n || 0).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const date = (d?: string | null) => (d ? displayDate(new Date(d)) : "")
const isCash = (a: MoneyAccount) => /cash|petty/i.test(a.name)

/**
 * Bank Book and Cash Book: Prime Bank and Cash at Hand / Petty Cash each kept as its own book with
 * a running balance. A cash withdrawal from the bank is a Contra (transfer): a payment in the Bank
 * Book and a receipt in the Cash Book. Expenses paid in cash come out of the Cash Book; cheques to
 * suppliers come out of the Bank Book. Each book reconciles on its own.
 */
export default function CashBooksPage() {
  const [accounts, setAccounts] = useState<MoneyAccount[]>([])
  const [selected, setSelected] = useState<string>("")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [corrections, setCorrections] = useState(false)
  const [book, setBook] = useState<Book | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiCall<{ data: MoneyAccount[] }>("/finance/bank-transfers/accounts", "GET")
      .then((res) => {
        // Bank first, then cash.
        const list = [...res.data].sort((a, b) => Number(isCash(a)) - Number(isCash(b)) || a.code.localeCompare(b.code))
        setAccounts(list)
        const wanted = new URLSearchParams(window.location.search).get("account")
        setSelected(list.find((a) => a.id === wanted || a.code === wanted)?.id ?? list[0]?.id ?? "")
        if (!list.length) setLoading(false)
      })
      .catch((e) => { setError(e instanceof Error ? e.message : "Could not load the accounts"); setLoading(false) })
  }, [])

  const load = useCallback(async (accountId: string, period: { from: string; to: string; corrections: boolean }) => {
    if (!accountId) return
    setLoading(true)
    setError(null)
    try {
      const q = new URLSearchParams()
      if (period.from) q.set("date_from", period.from)
      if (period.to) q.set("date_to", period.to)
      if (period.corrections) q.set("show_corrections", "1")
      const res = await apiCall<{ data: Book }>(`/finance/cash-books/${accountId}?${q}`, "GET")
      setBook(res.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the book")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (selected) load(selected, { from, to, corrections }) }, [selected]) // eslint-disable-line react-hooks/exhaustive-deps

  const current = accounts.find((a) => a.id === selected)
  const title = current ? `${isCash(current) ? "Cash Book" : "Bank Book"}: ${current.name}` : "Bank & Cash Books"
  const period = book?.date_from || book?.date_to ? `${book?.date_from ? date(book.date_from) : "Start"} to ${book?.date_to ? date(book.date_to) : "date"}` : "All time"
  // Tally adds the opening balance into the column it sits on.
  const totalDebit = (book?.totals.debit ?? 0) + (book?.opening_balance.side === "Dr" ? book.opening_balance.amount : 0)
  const totalCredit = (book?.totals.credit ?? 0) + (book?.opening_balance.side === "Cr" ? book?.opening_balance.amount ?? 0 : 0)

  const onExport = useTableExport(() => {
    const b = book!
    return {
      fileName: `${sessionCompanyName()} ${title} ${new Date().toISOString().slice(0, 10)}`.replace(/[:/\\]/g, " "),
      title,
      subtitle: period,
      headers: ["S/No", "Date", "Dr/Cr", "Particulars", "Vch Type", "Vch No.", "Receipts (Debit)", "Payments (Credit)", "Balance"],
      moneyColumns: [6, 7],
      rows: [
        ["", b.date_from ? date(b.date_from) : "", b.opening_balance.side, "Opening Balance", "", "",
          b.opening_balance.side === "Dr" ? b.opening_balance.amount : null, b.opening_balance.side === "Cr" ? b.opening_balance.amount : null,
          `${money(b.opening_balance.amount)} ${b.opening_balance.side}`],
        ...b.rows.map((r, i) => [i + 1, date(r.date), r.side, r.particulars, r.voucher_type, r.voucher_no, r.debit || null, r.credit || null, `${money(r.balance)} ${r.balance_side}`]),
      ],
      footer: [
        ["", "", "", "Total", "", "", totalDebit, totalCredit, ""],
        ["", "", b.closing_balance.side, "Closing Balance", "", "", null, null, `${money(b.closing_balance.amount)} ${b.closing_balance.side}`],
      ],
    }
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Link href="/finance">
          <Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-2" /> Finance</Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bank &amp; Cash Books</h1>
          <p className="text-muted-foreground">
            Each money account as its own book with a running balance. Withdrawals from the bank into cash are transfers
            (<Link className="underline" href="/finance/bank-accounts">Withdraw / Transfer</Link>), not expenses.
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
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {isCash(a) ? <Wallet className="h-4 w-4" /> : <Landmark className="h-4 w-4" />}
              {isCash(a) ? "Cash Book" : "Bank Book"} · {a.code}
            </div>
            <div className="mt-1 font-semibold">{a.label}</div>
            <div className={`mt-1 font-mono text-lg ${a.balance < 0 ? "text-red-600" : ""}`}>
              KES {money(Math.abs(a.balance))} {a.balance < 0 ? "Cr" : "Dr"}
            </div>
          </button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2"><BookOpen className="h-5 w-5" /> {title}</span>
            {book && (
              <span className={`text-base ${book.closing_balance.side === "Cr" && book.closing_balance.amount > 0 ? "text-red-600" : "text-green-700"}`}>
                {money(book.closing_balance.amount)} {book.closing_balance.side}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <Label htmlFor="cb_from" className="text-xs">From</Label>
              <Input id="cb_from" type="date" className="h-8 w-[150px]" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="cb_to" className="text-xs">To</Label>
              <Input id="cb_to" type="date" className="h-8 w-[150px]" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <Button size="sm" onClick={() => load(selected, { from, to, corrections })} disabled={loading || !selected}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Apply
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setFrom(""); setTo(""); load(selected, { from: "", to: "", corrections }) }}>All Time</Button>
            <label className="flex items-center gap-2 text-xs">
              <Switch checked={corrections} onCheckedChange={(v) => { setCorrections(v); load(selected, { from, to, corrections: v }) }} />
              Show edits &amp; reversals
            </label>
            <ExportMenu onExport={onExport} disabled={!book} />
          </div>

          {loading && !book ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</p>
          ) : error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : !book ? (
            <p className="text-sm text-muted-foreground">No bank or cash accounts are set up yet.</p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                {period} · {book.account.code} {book.account.name}. Receipts (Debit): money in. Payments (Credit): money out. Particulars is
                who paid or what it paid for; Contra is a transfer between bank and cash.
              </p>
              <div className="max-h-[600px] overflow-auto rounded border">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-gray-50 text-gray-600">
                    <tr className="[&>th]:whitespace-nowrap [&>th]:border-b [&>th]:px-2 [&>th]:py-1.5">
                      <th className="text-left">S/No</th>
                      <th className="text-left">Date</th>
                      <th className="text-left">Dr/Cr</th>
                      <th className="text-left">Particulars</th>
                      <th className="text-left">Vch Type</th>
                      <th className="text-left">Vch No.</th>
                      <th className="text-right">Receipts (Debit)</th>
                      <th className="text-right">Payments (Credit)</th>
                      <th className="text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-muted/40 font-semibold [&>td]:border-b [&>td]:px-2 [&>td]:py-1.5">
                      <td />
                      <td className="whitespace-nowrap">{date(book.date_from)}</td>
                      <td>{book.opening_balance.side}</td>
                      <td>Opening Balance</td>
                      <td />
                      <td />
                      <td className="text-right tabular-nums">{book.opening_balance.side === "Dr" ? money(book.opening_balance.amount) : ""}</td>
                      <td className="text-right tabular-nums">{book.opening_balance.side === "Cr" ? money(book.opening_balance.amount) : ""}</td>
                      <td className="text-right tabular-nums whitespace-nowrap">{money(book.opening_balance.amount)} {book.opening_balance.side}</td>
                    </tr>
                    {book.rows.length === 0 && (
                      <tr><td colSpan={9} className="px-2 py-3 text-center text-muted-foreground">No entries in this period.</td></tr>
                    )}
                    {book.rows.map((r, i) => (
                      <tr key={r.id} className={`align-top [&>td]:border-b [&>td]:px-2 [&>td]:py-1.5 ${r.reversed ? "text-muted-foreground line-through" : ""}`}>
                        <td className="text-muted-foreground">{i + 1}</td>
                        <td className="whitespace-nowrap">{date(r.date)}</td>
                        <td>{r.side}</td>
                        <td className="min-w-[180px]">
                          <span className="font-semibold">{r.particulars}</span>
                          {r.account && r.account !== r.particulars && <span className="block text-[10px] text-muted-foreground">{r.account}</span>}
                          {r.other_accounts.length > 0 && <span className="block text-[10px] text-muted-foreground">{r.other_accounts.join(" · ")}</span>}
                          {r.narration && <span className="block text-[10px] italic text-muted-foreground">{r.narration}</span>}
                        </td>
                        <td className="whitespace-nowrap">{r.voucher_type}</td>
                        <td className="whitespace-nowrap">{r.voucher_no}</td>
                        <td className="text-right tabular-nums font-medium">{r.debit ? money(r.debit) : ""}</td>
                        <td className="text-right tabular-nums font-medium">{r.credit ? money(r.credit) : ""}</td>
                        <td className={`text-right tabular-nums whitespace-nowrap ${r.balance_side === "Cr" && r.balance > 0 ? "text-red-600" : ""}`}>
                          {money(r.balance)} {r.balance_side}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="font-bold">
                    <tr className="[&>td]:border-b [&>td]:px-2 [&>td]:py-1.5">
                      <td colSpan={6}>Total</td>
                      <td className="text-right tabular-nums">{money(totalDebit)}</td>
                      <td className="text-right tabular-nums">{money(totalCredit)}</td>
                      <td />
                    </tr>
                    <tr className="bg-muted/40 [&>td]:px-2 [&>td]:py-1.5">
                      <td />
                      <td />
                      <td>{book.closing_balance.side}</td>
                      <td colSpan={5}>Closing Balance</td>
                      <td className="text-right tabular-nums whitespace-nowrap">{money(book.closing_balance.amount)} {book.closing_balance.side}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
