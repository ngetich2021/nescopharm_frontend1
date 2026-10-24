"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PermissionGuard } from "@/components/PermissionGuard"
import { useToast } from "@/hooks/use-toast"
import { CheckCircle2, Loader2, Pencil, Plus, Target, Trash2, Wallet, XCircle } from "lucide-react"
import apiCall from "@/lib/api"
import { cn } from "@/lib/utils"

type Account = { id: string; account_code: string; account_name: string; account_type: string }
type Period = { id: string; name: string; start_date: string; end_date: string }
type Line = {
  id?: string
  chart_of_account_id: string
  account_code?: string
  account_name?: string
  description?: string | null
  budgeted_amount: number
  actual_amount?: number
  variance?: number
  used_percentage?: number
}
type Budget = {
  id: string
  name: string
  description?: string | null
  budget_type: string
  status: string
  period: Period | null
  total_budgeted: number
  total_actual: number
  variance: number
  used_percentage: number
  line_count: number
  line_items?: Line[] | null
}

const kes = (v: unknown) => `KES ${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString("en-GB") : "-")
const STATUS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  approved: "bg-green-100 text-green-800",
  active: "bg-blue-100 text-blue-800",
  closed: "bg-slate-100 text-slate-700",
  cancelled: "bg-red-100 text-red-700",
}
const TYPES = ["operating", "capital", "cash_flow", "project", "department"]

// Spent against budget: green under 80%, amber to 100%, red over.
function UsedBar({ value }: { value: number }) {
  const v = Number(value || 0)
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-100">
        <div className={cn("h-full", v > 100 ? "bg-red-500" : v >= 80 ? "bg-amber-500" : "bg-green-500")} style={{ width: `${Math.min(v, 100)}%` }} />
      </div>
      <span className={cn("text-xs tabular-nums", v > 100 && "font-semibold text-red-600")}>{v.toFixed(1)}%</span>
    </div>
  )
}

const thisYear = new Date().getFullYear()
const EMPTY_FORM = {
  name: "",
  description: "",
  budget_type: "operating",
  period_mode: "dates" as "dates" | "period",
  financial_period_id: "",
  start_date: `${thisYear}-01-01`,
  end_date: `${thisYear}-12-31`,
  lines: [{ chart_of_account_id: "", budgeted_amount: 0, description: "" }] as Line[],
}

/**
 * Budgets: an amount per account for a period, against what the books show was actually spent.
 * (This page used to show built-in sample budgets and couldn't save one.)
 */
export default function BudgetsPage() {
  const { toast } = useToast()
  const [budgets, setBudgets] = useState<Budget[] | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [periods, setPeriods] = useState<Period[]>([])
  const [statusFilter, setStatusFilter] = useState("all")
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [detail, setDetail] = useState<Budget | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const load = useCallback(async () => {
    try {
      const [list, opts] = await Promise.all([
        apiCall<{ data: Budget[] }>(`/finance/budgets${statusFilter !== "all" ? `?status=${statusFilter}` : ""}`, "GET"),
        apiCall<{ periods: Period[]; accounts: Account[] }>("/finance/budgets/options", "GET"),
      ])
      setBudgets(list.data ?? [])
      setPeriods(opts.periods ?? [])
      setAccounts(opts.accounts ?? [])
    } catch (err: any) {
      setBudgets([])
      toast({ title: "Could not load budgets", description: err.message, variant: "destructive" })
    }
  }, [statusFilter, toast])

  useEffect(() => { load() }, [load])

  const totals = useMemo(() => {
    const live = (budgets ?? []).filter((b) => b.status !== "cancelled")
    const budgeted = live.reduce((s, b) => s + Number(b.total_budgeted || 0), 0)
    const actual = live.reduce((s, b) => s + Number(b.total_actual || 0), 0)
    return { count: live.length, budgeted, actual, used: budgeted > 0 ? (actual / budgeted) * 100 : 0, over: live.filter((b) => Number(b.used_percentage) > 100).length }
  }, [budgets])

  const openNew = () => {
    setEditingId(null)
    setForm({ ...EMPTY_FORM, lines: [{ chart_of_account_id: "", budgeted_amount: 0, description: "" }] })
    setFormOpen(true)
  }

  const openDetail = async (b: Budget) => {
    setDetail(b)
    setDetailLoading(true)
    try {
      const res = await apiCall<{ data: Budget }>(`/finance/budgets/${b.id}`, "GET")
      setDetail(res.data)
    } catch (err: any) {
      toast({ title: "Could not load the budget", description: err.message, variant: "destructive" })
    } finally {
      setDetailLoading(false)
    }
  }

  const openEdit = (b: Budget) => {
    setEditingId(b.id)
    setForm({
      name: b.name,
      description: b.description ?? "",
      budget_type: b.budget_type,
      period_mode: "period",
      financial_period_id: b.period?.id ?? "",
      start_date: b.period?.start_date ?? EMPTY_FORM.start_date,
      end_date: b.period?.end_date ?? EMPTY_FORM.end_date,
      lines: (b.line_items ?? []).map((l) => ({ chart_of_account_id: l.chart_of_account_id, budgeted_amount: Number(l.budgeted_amount), description: l.description ?? "" })),
    })
    setDetail(null)
    setFormOpen(true)
  }

  const setLine = (i: number, patch: Partial<Line>) =>
    setForm((f) => ({ ...f, lines: f.lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)) }))

  const formTotal = form.lines.reduce((s, l) => s + Number(l.budgeted_amount || 0), 0)
  const usedAccounts = new Set(form.lines.map((l) => l.chart_of_account_id))
  const formValid =
    form.name.trim() &&
    (form.period_mode === "period" ? !!form.financial_period_id : form.start_date && form.end_date && form.start_date < form.end_date) &&
    form.lines.length > 0 &&
    form.lines.every((l) => l.chart_of_account_id && Number(l.budgeted_amount) >= 0)

  const save = async () => {
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description || null,
        budget_type: form.budget_type,
        ...(form.period_mode === "period" ? { financial_period_id: form.financial_period_id } : { start_date: form.start_date, end_date: form.end_date }),
        line_items: form.lines.map((l) => ({ chart_of_account_id: l.chart_of_account_id, budgeted_amount: Number(l.budgeted_amount || 0), description: l.description || null })),
      }
      const res = await apiCall<{ message: string }>(editingId ? `/finance/budgets/${editingId}` : "/finance/budgets", editingId ? "PUT" : "POST", payload)
      toast({ title: editingId ? "Budget updated" : "Budget created", description: res.message })
      setFormOpen(false)
      load()
    } catch (err: any) {
      toast({ title: "Could not save the budget", description: err.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const act = async (b: Budget, action: "approve" | "reject" | "delete") => {
    if (action === "delete" && !confirm(`Delete budget "${b.name}"?`)) return
    if (action === "reject" && !confirm(`Cancel budget "${b.name}"?`)) return
    try {
      const res = await apiCall<{ message: string }>(
        action === "delete" ? `/finance/budgets/${b.id}` : `/finance/budgets/${b.id}/${action}`,
        action === "delete" ? "DELETE" : "POST",
      )
      toast({ title: "Done", description: res.message })
      setDetail(null)
      load()
    } catch (err: any) {
      toast({ title: "Could not update the budget", description: err.message, variant: "destructive" })
    }
  }

  const stat = (title: string, value: string | number, Icon: any, note?: string) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
      </CardContent>
    </Card>
  )

  return (
    <PermissionGuard permissions={["can_view_budgets", "can_manage_budgets", "can_manage_system", "can_manage_company"]}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Budgets</h1>
            <p className="text-sm text-muted-foreground">Set an amount per account for a period and track it against actual spending from the books.</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <PermissionGuard permissions={["can_manage_budgets", "can_manage_system", "can_manage_company"]} hideOnDenied>
              <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> New Budget</Button>
            </PermissionGuard>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          {stat("Budgets", totals.count, Target, "Excluding cancelled")}
          {stat("Budgeted", kes(totals.budgeted), Wallet)}
          {stat("Actual", kes(totals.actual), Wallet, `${totals.used.toFixed(1)}% of budget used`)}
          {stat("Over budget", totals.over, XCircle, "Budgets past 100%")}
        </div>

        <Card>
          <CardContent className="pt-6">
            {budgets === null ? (
              <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : budgets.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">No budgets yet. Create one to start tracking spending against it.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">S/No</TableHead>
                      <TableHead>Budget</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Budgeted</TableHead>
                      <TableHead className="text-right">Actual</TableHead>
                      <TableHead className="text-right">Remaining</TableHead>
                      <TableHead>Used</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {budgets.map((b, i) => (
                      <TableRow key={b.id} className="cursor-pointer hover:bg-gray-50" onClick={() => openDetail(b)}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell>
                          <p className="font-medium">{b.name}</p>
                          <p className="text-xs capitalize text-muted-foreground">{b.budget_type.replace("_", " ")} · {b.line_count} account{b.line_count === 1 ? "" : "s"}</p>
                        </TableCell>
                        <TableCell className="text-sm">
                          {b.period ? <>{b.period.name}<div className="text-xs text-muted-foreground">{fmtDate(b.period.start_date)} - {fmtDate(b.period.end_date)}</div></> : "-"}
                        </TableCell>
                        <TableCell><Badge variant="outline" className={cn("capitalize", STATUS[b.status])}>{b.status}</Badge></TableCell>
                        <TableCell className="text-right font-mono">{kes(b.total_budgeted)}</TableCell>
                        <TableCell className="text-right font-mono">{kes(b.total_actual)}</TableCell>
                        <TableCell className={cn("text-right font-mono", Number(b.variance) < 0 && "text-red-600")}>{kes(b.variance)}</TableCell>
                        <TableCell><UsedBar value={b.used_percentage} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Budget detail: each account's budget against its actual */}
        <Sheet open={detail !== null} onOpenChange={(o) => !o && setDetail(null)}>
          <SheetContent side="right" className="!w-full !max-w-full sm:!w-[760px] sm:!max-w-[760px] overflow-y-auto">
            {detail && (
              <>
                <SheetHeader>
                  <SheetTitle>{detail.name}</SheetTitle>
                </SheetHeader>
                <div className="mt-4 space-y-4">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge variant="outline" className={cn("capitalize", STATUS[detail.status])}>{detail.status}</Badge>
                    {detail.period && <span className="text-muted-foreground">{detail.period.name}: {fmtDate(detail.period.start_date)} - {fmtDate(detail.period.end_date)}</span>}
                  </div>
                  {detail.description && <p className="text-sm text-muted-foreground">{detail.description}</p>}
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div className="rounded border p-3"><p className="text-muted-foreground">Budgeted</p><p className="font-semibold">{kes(detail.total_budgeted)}</p></div>
                    <div className="rounded border p-3"><p className="text-muted-foreground">Actual</p><p className="font-semibold">{kes(detail.total_actual)}</p></div>
                    <div className="rounded border p-3"><p className="text-muted-foreground">Remaining</p><p className={cn("font-semibold", Number(detail.variance) < 0 && "text-red-600")}>{kes(detail.variance)}</p></div>
                  </div>
                  {detailLoading ? (
                    <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
                  ) : (
                    <div className="overflow-x-auto rounded border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">S/No</TableHead>
                            <TableHead>Account</TableHead>
                            <TableHead className="text-right">Budgeted</TableHead>
                            <TableHead className="text-right">Actual</TableHead>
                            <TableHead className="text-right">Remaining</TableHead>
                            <TableHead>Used</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(detail.line_items ?? []).map((l, i) => (
                            <TableRow key={l.id ?? i}>
                              <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                              <TableCell>
                                <p className="font-medium">{l.account_code} {l.account_name}</p>
                                {l.description && <p className="text-xs text-muted-foreground">{l.description}</p>}
                              </TableCell>
                              <TableCell className="text-right font-mono">{kes(l.budgeted_amount)}</TableCell>
                              <TableCell className="text-right font-mono">{kes(l.actual_amount)}</TableCell>
                              <TableCell className={cn("text-right font-mono", Number(l.variance) < 0 && "text-red-600")}>{kes(l.variance)}</TableCell>
                              <TableCell><UsedBar value={l.used_percentage ?? 0} /></TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                  <PermissionGuard permissions={["can_manage_budgets", "can_manage_system", "can_manage_company"]} hideOnDenied>
                    <div className="flex flex-wrap justify-end gap-2">
                      {detail.status === "draft" && (
                        <>
                          <Button variant="outline" onClick={() => act(detail, "delete")}><Trash2 className="mr-2 h-4 w-4" /> Delete</Button>
                          <Button variant="outline" onClick={() => openEdit(detail)} disabled={detailLoading}><Pencil className="mr-2 h-4 w-4" /> Edit</Button>
                          <Button onClick={() => act(detail, "approve")}><CheckCircle2 className="mr-2 h-4 w-4" /> Approve</Button>
                        </>
                      )}
                      {detail.status === "approved" && (
                        <Button variant="outline" onClick={() => act(detail, "reject")}><XCircle className="mr-2 h-4 w-4" /> Cancel budget</Button>
                      )}
                      {detail.status === "cancelled" && (
                        <Button variant="outline" onClick={() => act(detail, "delete")}><Trash2 className="mr-2 h-4 w-4" /> Delete</Button>
                      )}
                    </div>
                  </PermissionGuard>
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>

        {/* Create / edit */}
        <Dialog open={formOpen} onOpenChange={setFormOpen}>
          <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit budget" : "New budget"}</DialogTitle>
              <DialogDescription>Give each account an amount for the period. Actual spending comes from the books automatically.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Name *</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={`e.g. Operating budget ${thisYear}`} />
                </div>
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={form.budget_type} onValueChange={(v) => setForm({ ...form, budget_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t.replace("_", " ")}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Period *</Label>
                <div className="flex flex-wrap items-end gap-3">
                  <Select value={form.period_mode} onValueChange={(v) => setForm({ ...form, period_mode: v as "dates" | "period" })}>
                    <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dates">Choose dates</SelectItem>
                      <SelectItem value="period" disabled={periods.length === 0}>Existing period</SelectItem>
                    </SelectContent>
                  </Select>
                  {form.period_mode === "period" ? (
                    <Select value={form.financial_period_id} onValueChange={(v) => setForm({ ...form, financial_period_id: v })}>
                      <SelectTrigger className="w-[260px]"><SelectValue placeholder="Select period" /></SelectTrigger>
                      <SelectContent>
                        {periods.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} ({fmtDate(p.start_date)} - {fmtDate(p.end_date)})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <>
                      <Input type="date" className="w-[160px]" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                      <span className="pb-2 text-sm text-muted-foreground">to</span>
                      <Input type="date" className="w-[160px]" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Accounts *</Label>
                  <Button type="button" variant="outline" size="sm" onClick={() => setForm({ ...form, lines: [...form.lines, { chart_of_account_id: "", budgeted_amount: 0, description: "" }] })}>
                    <Plus className="mr-1 h-3.5 w-3.5" /> Add account
                  </Button>
                </div>
                <div className="space-y-2">
                  {form.lines.map((l, i) => (
                    <div key={i} className="grid grid-cols-[2rem_1fr_9rem_2rem] items-center gap-2">
                      <span className="text-sm text-muted-foreground">{i + 1}</span>
                      <Select value={l.chart_of_account_id} onValueChange={(v) => setLine(i, { chart_of_account_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                        <SelectContent className="max-h-72">
                          {accounts
                            .filter((a) => a.id === l.chart_of_account_id || !usedAccounts.has(a.id))
                            .map((a) => <SelectItem key={a.id} value={a.id}>{a.account_code} {a.account_name} <span className="text-xs capitalize text-muted-foreground">({a.account_type})</span></SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Input type="number" min="0" step="0.01" value={l.budgeted_amount || ""} placeholder="Amount" onChange={(e) => setLine(i, { budgeted_amount: Number(e.target.value) })} />
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={form.lines.length === 1}
                        onClick={() => setForm({ ...form, lines: form.lines.filter((_, idx) => idx !== i) })}>
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  ))}
                </div>
                <p className="text-right text-sm">Total: <span className="font-semibold">{kes(formTotal)}</span></p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</Button>
              <Button onClick={save} disabled={!formValid || saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {editingId ? "Save changes" : "Create budget"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PermissionGuard>
  )
}
