"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlarmClock, Loader2, Wallet, ChevronDown, ChevronRight } from "lucide-react"
import { displayDate } from "@/lib/date-format"
import { getBillsDue, type BillDue, type BillsDueResponse } from "@/lib/supplier-payments"
import { usePermissions } from "@/hooks/use-permissions"
import { ExportMenu } from "@/components/export-menu"
import { exportTable, type ExportFormat } from "@/lib/table-export"
import { useOptionalAuth } from "@/lib/auth-context"
import CreateSupplierPaymentSheet from "./create-supplier-payment-sheet"

const money = (n: number) => Number(n || 0).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmt = (d: string | null) => (d ? displayDate(new Date(d)) : "")
const todayString = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}
const keyOf = (b: BillDue) => `${b.type}:${b.id}`

type Show = "due" | "by_date" | "all"

/**
 * Bills Due for Payment: every supplier's unpaid bills and delivery invoices, each due on its date plus
 * that supplier's credit days (Imevo: 30). Tick the ones to pay and Pay opens the payment form with them.
 */
export function BillsDue({ supplierId }: { supplierId?: string } = {}) {
  const { hasPermission } = usePermissions()
  const canPay = hasPermission("can_create_payments")
  const company = useOptionalAuth()?.userProfile?.company
  const [data, setData] = useState<BillsDueResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [payBy, setPayBy] = useState(todayString())
  const [show, setShow] = useState<Show>("due")
  // On a supplier's statement: that supplier only.
  const [supplierFilter, setSupplierFilter] = useState(supplierId ?? "all")
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [preset, setPreset] = useState<{ supplierId: string; invoices: { type: string; id: string; amount: number }[] } | null>(null)

  const load = async (date = payBy) => {
    setLoading(true)
    setError(null)
    try {
      const res = await getBillsDue(date)
      if (supplierId) {
        // The cards then add up this supplier's bills only.
        const mine = res.rows.filter((r) => r.supplier_id === supplierId)
        const part = (st: BillDue["status"]) => {
          const rs = mine.filter((r) => r.status === st)
          return { count: rs.length, amount: rs.reduce((t, r) => t + r.to_pay, 0) }
        }
        const dueNow = part("Due")
        const dueBy = part("Due by pay date")
        res.rows = mine
        res.summary = {
          due_now: dueNow,
          due_by_pay_date: dueBy,
          to_pay: { count: dueNow.count + dueBy.count, amount: dueNow.amount + dueBy.amount },
          not_yet_due: part("Not yet due"),
          cheques_pending: mine.reduce((t, r) => t + r.cheque_pending, 0),
          outstanding: mine.reduce((t, r) => t + r.balance, 0),
        }
      }
      setData(res)
      setSelected({})
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load bills due")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const refresh = () => load()
    window.addEventListener("supplier-payment-created", refresh)
    return () => window.removeEventListener("supplier-payment-created", refresh)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const rows = useMemo(() => {
    const all = data?.rows ?? []
    return all.filter(
      (r) =>
        (supplierFilter === "all" || r.supplier_id === supplierFilter) &&
        (show === "all" || r.status === "Due" || (show === "by_date" && r.status === "Due by pay date"))
    )
  }, [data, show, supplierFilter])

  const groups = useMemo(() => {
    const map = new Map<string, { id: string; name: string; terms: number; rows: BillDue[] }>()
    for (const r of rows) {
      if (!map.has(r.supplier_id)) map.set(r.supplier_id, { id: r.supplier_id, name: r.supplier_name ?? "Supplier", terms: r.terms_days, rows: [] })
      map.get(r.supplier_id)!.rows.push(r)
    }
    // The supplier owed the most (to pay) first.
    return [...map.values()].sort((a, b) => b.rows.reduce((s, r) => s + r.to_pay, 0) - a.rows.reduce((s, r) => s + r.to_pay, 0))
  }, [rows])

  const suppliers = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of data?.rows ?? []) m.set(r.supplier_id, r.supplier_name ?? "Supplier")
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [data])

  const pay = (supplierId: string, bills: BillDue[]) => {
    const invoices = bills.filter((b) => b.to_pay > 0).map((b) => ({ type: b.type, id: b.id, amount: b.to_pay }))
    setPreset({ supplierId, invoices })
  }

  const s = data?.summary
  const totalShown = rows.reduce((t, r) => t + r.to_pay, 0)

  const handleExport = async (format: ExportFormat) => {
    await exportTable(format, {
      fileName: `Bills Due for Payment ${(data?.today ?? todayString())}`,
      title: "Bills Due for Payment",
      subtitle: `As at ${fmt(data?.today ?? null)}${show !== "due" ? `, pay by ${fmt(data?.pay_by ?? null)}` : ""} - due date = bill date + the supplier's credit days`,
      details: s
        ? [
            ["Due now", `${s.due_now.count} bills, KES ${money(s.due_now.amount)}`],
            ["Falling due by " + fmt(data?.pay_by ?? null), `${s.due_by_pay_date.count} bills, KES ${money(s.due_by_pay_date.amount)}`],
            ["Total to pay", `KES ${money(s.to_pay.amount)}`],
          ]
        : [],
      headers: ["S/No", "Supplier", "Terms (days)", "Bill Date", "Due Date", "Reference", "Description", "Bill Amount", "Paid", "Balance", "Cheque Pending", "To Pay", "Days Overdue", "Status"],
      moneyColumns: [7, 8, 9, 10, 11],
      rows: groups.flatMap((g) => g.rows).map((r, i) => [
        i + 1, r.supplier_name, r.terms_days, fmt(r.date), fmt(r.due_date), r.number, r.description, r.total, r.paid, r.balance,
        r.cheque_pending || null, r.to_pay, r.days_overdue >= 0 ? r.days_overdue : "", r.status,
      ]),
      footer: [["", "Total", "", "", "", "", "", "", "", rows.reduce((t, r) => t + r.balance, 0), "", totalShown, "", ""]],
    }, company)
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <AlarmClock className="h-5 w-5 text-red-600" />
            Bills Due for Payment
          </span>
          <div className="flex flex-wrap items-center gap-2 text-sm font-normal">
            <Select value={show} onValueChange={(v) => setShow(v as Show)}>
              <SelectTrigger className="h-8 w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="due">Due now (past credit days)</SelectItem>
                <SelectItem value="by_date">Due by the pay-by date</SelectItem>
                <SelectItem value="all">All unpaid bills</SelectItem>
              </SelectContent>
            </Select>
            {!supplierId && <Select value={supplierFilter} onValueChange={setSupplierFilter}>
              <SelectTrigger className="h-8 w-[220px]"><SelectValue placeholder="All suppliers" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All suppliers</SelectItem>
                {suppliers.map(([id, name]) => (
                  <SelectItem key={id} value={id}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>}
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              Pay by
              <Input
                type="date"
                className="h-8 w-[150px]"
                value={payBy}
                onChange={(e) => {
                  if (!e.target.value) return
                  setPayBy(e.target.value)
                  setShow("by_date")
                  load(e.target.value)
                }}
              />
            </label>
            <ExportMenu onExport={handleExport} label="Export" disabled={loading || rows.length === 0} />
          </div>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Each bill is due on its date plus that supplier&apos;s credit days (Payment Terms Days on the supplier). Tick bills and press Pay to pay them.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {s && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2">
              <div className="text-red-700">Due now</div>
              <div className="text-base font-semibold tabular-nums text-red-800">KES {money(s.due_now.amount)}</div>
              <div className="text-red-700">{s.due_now.count} bills past their credit days</div>
            </div>
            <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2">
              <div className="text-amber-700">Falling due by {fmt(data!.pay_by)}</div>
              <div className="text-base font-semibold tabular-nums text-amber-800">KES {money(s.due_by_pay_date.amount)}</div>
              <div className="text-amber-700">{s.due_by_pay_date.count} bills</div>
            </div>
            <div className="rounded border bg-gray-50 px-3 py-2">
              <div className="text-gray-600">Total to pay by {fmt(data!.pay_by)}</div>
              <div className="text-base font-bold tabular-nums">KES {money(s.to_pay.amount)}</div>
              <div className="text-gray-600">{s.to_pay.count} bills</div>
            </div>
            <div className="rounded border border-blue-200 bg-blue-50 px-3 py-2">
              <div className="text-blue-700">Not yet due (within terms)</div>
              <div className="text-base font-semibold tabular-nums text-blue-800">KES {money(s.not_yet_due.amount)}</div>
              <div className="text-blue-700">{s.not_yet_due.count} bills</div>
            </div>
            <div className="rounded border px-3 py-2">
              <div className="text-gray-600">Cheques written, not cleared</div>
              <div className="text-base font-semibold tabular-nums">KES {money(s.cheques_pending)}</div>
              <div className="text-gray-600">already taken off To Pay</div>
            </div>
          </div>
        )}

        {loading && !data ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading bills due...</div>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {show === "due" ? "Nothing is due: every bill is paid or still within its supplier's credit days." : "No unpaid bills."}
          </p>
        ) : (
          <div className="max-h-[560px] overflow-auto rounded border">
            <table className="w-full text-xs tabular-nums">
              <thead className="sticky top-0 z-10 bg-gray-50 text-gray-600">
                <tr className="[&>th]:whitespace-nowrap [&>th]:px-2 [&>th]:py-1.5">
                  <th className="w-8"></th>
                  <th className="text-left">S/No</th>
                  <th className="text-left">Bill Date</th>
                  <th className="text-left">Due Date</th>
                  <th className="text-left">Reference</th>
                  <th className="text-left">Description</th>
                  <th className="text-right">Bill Amount</th>
                  <th className="text-right">Paid</th>
                  <th className="text-right">Balance</th>
                  <th className="text-right">To Pay</th>
                  <th className="text-right">Days Overdue</th>
                  <th className="text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => {
                  const picked = g.rows.filter((r) => selected[keyOf(r)])
                  const all = g.rows.length > 0 && picked.length === g.rows.length
                  const groupToPay = g.rows.reduce((t, r) => t + r.to_pay, 0)
                  const pickedTotal = picked.reduce((t, r) => t + r.to_pay, 0)
                  const isCollapsed = collapsed[g.id]
                  return [
                    <tr key={g.id} className="border-t bg-slate-100 font-semibold [&>td]:px-2 [&>td]:py-1.5">
                      <td>
                        <Checkbox
                          checked={all ? true : picked.length ? "indeterminate" : false}
                          onCheckedChange={(v) =>
                            setSelected((prev) => {
                              const next = { ...prev }
                              g.rows.forEach((r) => (next[keyOf(r)] = v === true))
                              return next
                            })
                          }
                        />
                      </td>
                      <td colSpan={5}>
                        <button className="inline-flex items-center gap-1" onClick={() => setCollapsed((c) => ({ ...c, [g.id]: !c[g.id] }))}>
                          {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          {g.name}
                        </button>
                        <span className="ml-2 font-normal text-gray-500">Net {g.terms} days, {g.rows.length} bills</span>
                      </td>
                      <td colSpan={3} className="text-right">KES {money(groupToPay)}</td>
                      <td colSpan={3} className="text-right">
                        {canPay && (
                          <Button size="sm" className="h-7" onClick={() => pay(g.id, picked.length ? picked : g.rows)}>
                            <Wallet className="h-3.5 w-3.5 mr-1.5" />
                            {picked.length ? `Pay ${picked.length} selected (KES ${money(pickedTotal)})` : `Pay all (KES ${money(groupToPay)})`}
                          </Button>
                        )}
                      </td>
                    </tr>,
                    ...(isCollapsed
                      ? []
                      : g.rows.map((r, i) => (
                          <tr key={keyOf(r)} className="border-t [&>td]:px-2 [&>td]:py-1">
                            <td>
                              <Checkbox checked={!!selected[keyOf(r)]} onCheckedChange={(v) => setSelected((p) => ({ ...p, [keyOf(r)]: v === true }))} />
                            </td>
                            <td className="text-gray-500">{i + 1}</td>
                            <td className="whitespace-nowrap">{fmt(r.date)}</td>
                            <td className="whitespace-nowrap">{fmt(r.due_date)}</td>
                            <td className="whitespace-nowrap">{r.number}</td>
                            <td>{r.description}</td>
                            <td className="text-right">{money(r.total)}</td>
                            <td className="text-right">{r.paid ? money(r.paid) : "—"}</td>
                            <td className="text-right">{money(r.balance)}</td>
                            <td className="text-right font-medium">
                              {money(r.to_pay)}
                              {r.cheque_pending > 0 && (
                                <div className="text-[10px] font-normal text-amber-700">cheque {r.cheque_refs} KES {money(r.cheque_pending)} not cleared</div>
                              )}
                            </td>
                            <td className={`text-right ${r.days_overdue > 0 ? "font-semibold text-red-700" : ""}`}>
                              {r.days_overdue > 0 ? r.days_overdue : r.days_overdue === 0 ? "due today" : `in ${-r.days_overdue}`}
                            </td>
                            <td className={`whitespace-nowrap ${r.status === "Due" ? "text-red-700" : r.status === "Due by pay date" ? "text-amber-700" : "text-blue-700"}`}>
                              {r.status === "Due" ? (r.days_overdue > 0 ? "Overdue" : "Due today") : r.status}
                            </td>
                          </tr>
                        ))),
                  ]
                })}
                <tr className="border-t bg-gray-50 font-semibold [&>td]:px-2 [&>td]:py-1.5">
                  <td colSpan={8}>Total ({rows.length} bills)</td>
                  <td className="text-right">{money(rows.reduce((t, r) => t + r.balance, 0))}</td>
                  <td className="text-right">{money(totalShown)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <CreateSupplierPaymentSheet
        isOpen={!!preset}
        onOpenChange={(open) => { if (!open) setPreset(null) }}
        preset={preset}
        onPaymentCreated={() => window.dispatchEvent(new Event("supplier-payment-created"))}
      />
    </Card>
  )
}
