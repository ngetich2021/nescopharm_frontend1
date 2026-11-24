"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronRight, Landmark, Paperclip, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { displayDate } from "@/lib/date-format";
import { ExportMenu, useTableExport } from "@/components/export-menu";
import { documentFileName, sessionCompanyName } from "@/lib/document-names";
import {
  MoneyAccount,
  PAYMENT_METHODS,
  StatutoryLine,
  StatutoryMonth,
  StatutoryObligations,
  deleteStatutoryPayment,
  fetchPaymentAccounts,
  fetchStatutoryObligations,
  formatKES,
  paymentMethodLabel,
  recordStatutoryPayment,
} from "@/lib/payroll-runs";

function statusBadge(line: StatutoryLine) {
  if (line.status === "Fully Paid") return <Badge className="bg-green-100 text-green-800" variant="secondary">Fully Paid</Badge>;
  if (line.overdue) return <Badge className="bg-red-100 text-red-800" variant="secondary">{line.status} - overdue {line.days_late}d</Badge>;
  if (line.status === "Partially Paid") return <Badge className="bg-amber-100 text-amber-800" variant="secondary">Partially Paid</Badge>;
  if (line.status === "Nothing due") return <Badge variant="secondary">Nothing due</Badge>;
  return <Badge className="bg-yellow-100 text-yellow-800" variant="secondary">Pending</Badge>;
}

/**
 * Payroll > Statutory Payments: what each approved payroll month owes KRA, NSSF, SHA, HELB and NITA
 * (filled from the payroll), employee and employer shares apart, each item with its own status, and
 * the payments made - each posts DR the payable / CR the bank it came from.
 */
export function StatutoryPaymentsTab() {
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const canPay = hasPermission("can_process_payroll");
  const [year, setYear] = useState<string>("all");
  const [data, setData] = useState<StatutoryObligations | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [paying, setPaying] = useState<{ month: StatutoryMonth; line: StatutoryLine } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchStatutoryObligations(year === "all" ? undefined : Number(year)));
    } catch (err: any) {
      toast({ title: "Error", description: err?.message ?? "Could not load statutory obligations.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => { load(); }, [load]);

  const remove = async (id: string, label: string) => {
    if (!confirm(`Delete this ${label} payment? Its ledger entry is reversed and the amount is owed again.`)) return;
    try {
      toast({ title: "Deleted", description: await deleteStatutoryPayment(id) });
      load();
    } catch (err: any) {
      toast({ title: "Error", description: err?.message ?? "Could not delete the payment.", variant: "destructive" });
    }
  };

  const months = data?.months ?? [];
  const thisYear = new Date().getFullYear();

  const onExport = useTableExport(() => {
    const rows = months.flatMap((m) =>
      m.lines.map((l) => [m.period_label, l.label, l.authority, l.employee_share, l.employer_share, l.due, l.paid, l.balance, displayDate(l.due_date), l.overdue ? `${l.status} (overdue ${l.days_late} days)` : l.status]),
    ).map((r, i) => [i + 1, ...r]);
    return {
      fileName: documentFileName([sessionCompanyName(), "Statutory Obligations"]),
      title: "Statutory Obligations & Payments",
      subtitle: year === "all" ? "All payroll months" : `Payroll months ${year}`,
      headers: ["S/No", "Month", "Item", "Authority", "Employee share", "Employer share", "Total due", "Paid", "Balance", "Due date", "Status"],
      rows,
      footer: [["", "Total", "", "", "", "", data?.totals.due ?? 0, data?.totals.paid ?? 0, data?.totals.balance ?? 0, "", ""]],
      moneyColumns: [4, 5, 6, 7, 8],
    };
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-3 sm:grid-cols-3 flex-1 min-w-[280px]">
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total due</p><p className="text-xl font-semibold font-mono">{formatKES(data?.totals.due ?? 0)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Paid</p><p className="text-xl font-semibold font-mono text-green-700">{formatKES(data?.totals.paid ?? 0)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Balance owed</p><p className="text-xl font-semibold font-mono text-red-700">{formatKES(data?.totals.balance ?? 0)}</p></CardContent></Card>
        </div>
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Year</Label>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All years</SelectItem>
                {[thisYear + 1, thisYear, thisYear - 1, thisYear - 2].map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <ExportMenu onExport={onExport} disabled={loading || months.length === 0} />
        </div>
      </div>

      {loading ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Loading...</CardContent></Card>
      ) : months.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No approved payroll yet. Statutory amounts appear here once a payroll month is approved.</CardContent></Card>
      ) : (
        months.map((m) => (
          <Card key={m.payroll_run_id}>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base font-medium">{m.period_label}</CardTitle>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="text-muted-foreground">
                    Net salaries KES {formatKES(m.net_salaries.amount)}:{" "}
                    <span className={m.net_salaries.status === "Paid" ? "text-green-700 font-medium" : "text-amber-700 font-medium"}>{m.net_salaries.status}</span>
                    {m.net_salaries.payment_date && ` on ${displayDate(m.net_salaries.payment_date)}`}
                    {m.net_salaries.account && ` from ${m.net_salaries.account}`}
                    {m.net_salaries.reference && ` (ref ${m.net_salaries.reference})`}
                  </span>
                  {!m.posts_to_ledger && <Badge variant="outline" title="Salaries for this month were booked as expenses; payments here are tracked but not posted">Not posted to ledger</Badge>}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">S/No</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Authority</TableHead>
                    <TableHead className="text-right">Employee share</TableHead>
                    <TableHead className="text-right">Employer share</TableHead>
                    <TableHead className="text-right">Total due</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Due date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {m.lines.map((l, i) => {
                    const key = `${m.payroll_run_id}|${l.item}`;
                    return (
                      <Fragment key={key}>
                        <TableRow>
                          <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                          <TableCell className="font-medium">
                            <button className="inline-flex items-center gap-1 hover:underline disabled:no-underline" disabled={!l.payments.length} onClick={() => setOpen((o) => ({ ...o, [key]: !o[key] }))}>
                              {l.payments.length ? (open[key] ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />) : null}
                              {l.label}
                            </button>
                            {l.payments.length > 0 && <span className="ml-1 text-xs text-muted-foreground">({l.payments.length} payment{l.payments.length > 1 ? "s" : ""})</span>}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{l.authority}</TableCell>
                          <TableCell className="text-right font-mono">{l.employee_share ? formatKES(l.employee_share) : "-"}</TableCell>
                          <TableCell className="text-right font-mono">{l.employer_share ? formatKES(l.employer_share) : "-"}</TableCell>
                          <TableCell className="text-right font-mono font-medium">{formatKES(l.due)}</TableCell>
                          <TableCell className="text-right font-mono text-green-700">{formatKES(l.paid)}</TableCell>
                          <TableCell className="text-right font-mono">{formatKES(l.balance)}</TableCell>
                          <TableCell className="whitespace-nowrap">{displayDate(l.due_date)}</TableCell>
                          <TableCell>{statusBadge(l)}</TableCell>
                          <TableCell className="text-right">
                            {canPay && l.balance > 0 && (
                              <Button size="sm" variant="outline" onClick={() => setPaying({ month: m, line: l })}>
                                <Landmark className="h-3.5 w-3.5 mr-1" /> Pay
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                        {open[key] && l.payments.map((p) => (
                          <TableRow key={p.id} className="bg-muted/30 text-sm">
                            <TableCell />
                            <TableCell colSpan={2} className="pl-8 text-muted-foreground">
                              Paid {displayDate(p.payment_date)} - ref {p.reference}
                              {p.recorded_by && ` - by ${p.recorded_by}`}
                            </TableCell>
                            <TableCell colSpan={3} className="text-muted-foreground">{p.account ?? "-"} ({paymentMethodLabel(p.payment_method)})</TableCell>
                            <TableCell className="text-right font-mono">{formatKES(p.amount)}</TableCell>
                            <TableCell colSpan={3} className="text-muted-foreground truncate max-w-[240px]">
                              {p.attachment_url && (
                                <a href={p.attachment_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-700 hover:underline mr-2">
                                  <Paperclip className="h-3 w-3" /> Receipt
                                </a>
                              )}
                              {p.notes}
                            </TableCell>
                            <TableCell className="text-right">
                              {canPay && (
                                <Button size="icon" variant="ghost" title="Delete this payment" onClick={() => remove(p.id, l.label)}>
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </Fragment>
                    );
                  })}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell />
                    <TableCell colSpan={4} className="font-semibold">Total {m.period_label}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">{formatKES(m.totals.due)}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">{formatKES(m.totals.paid)}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">{formatKES(m.totals.balance)}</TableCell>
                    <TableCell colSpan={3} />
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>
        ))
      )}

      <StatutoryPayDialog target={paying} onClose={() => setPaying(null)} onDone={load} />
    </div>
  );
}

function StatutoryPayDialog({
  target,
  onClose,
  onDone,
}: {
  target: { month: StatutoryMonth; line: StatutoryLine } | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<MoneyAccount[]>([]);
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState("bank_transfer");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!target) return;
    setAmount(String(target.line.balance));
    setDate(new Date().toISOString().slice(0, 10));
    setMethod("bank_transfer");
    setReference("");
    setNotes("");
    setFile(null);
    fetchPaymentAccounts().then((list) => {
      setAccounts(list);
      setAccountId((cur) => cur || (list.find((a) => /bank/i.test(a.name)) ?? list[0])?.id || "");
    }).catch(() => setAccounts([]));
  }, [target]);

  if (!target) return null;
  const { month, line } = target;

  const submit = async () => {
    const amt = Number(amount);
    if (!(amt > 0)) return toast({ title: "Amount needed", description: "Enter the amount paid.", variant: "destructive" });
    if (amt > line.balance + 0.001) return toast({ title: "Too much", description: `Only KES ${formatKES(line.balance)} is left to pay on ${line.label}.`, variant: "destructive" });
    if (!accountId) return toast({ title: "Choose an account", description: "Pick the bank account (or petty cash) this was paid from.", variant: "destructive" });
    if (!reference.trim()) return toast({ title: "Reference needed", description: "Enter the payment reference (e.g. KRA payment slip or bank reference).", variant: "destructive" });
    setSaving(true);
    try {
      const msg = await recordStatutoryPayment({
        payroll_run_id: month.payroll_run_id,
        item: line.item,
        amount: amt,
        payment_date: date,
        account_id: accountId,
        payment_method: method,
        reference: reference.trim(),
        notes: notes.trim() || undefined,
        attachment: file,
      });
      toast({ title: "Payment recorded", description: msg });
      onDone();
      onClose();
    } catch (err: any) {
      toast({ title: "Not saved", description: err?.message ?? "The payment could not be saved.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Pay {line.label} - {month.period_label}</DialogTitle>
          <DialogDescription>
            To {line.authority}. Confirming posts Debit {line.label} Payable / Credit the account below
            {line.employer_share > 0 ? " (the employer share was already expensed when the payroll was approved)" : ""}.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-md border bg-muted/40 p-3 text-sm grid grid-cols-2 gap-y-1">
          <span className="text-muted-foreground">Employee share</span><span className="text-right font-mono">{formatKES(line.employee_share)}</span>
          <span className="text-muted-foreground">Employer share</span><span className="text-right font-mono">{formatKES(line.employer_share)}</span>
          <span className="text-muted-foreground">Already paid</span><span className="text-right font-mono">{formatKES(line.paid)}</span>
          <span className="font-medium">Balance</span><span className="text-right font-mono font-semibold">{formatKES(line.balance)}</span>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Amount (KES)</Label>
              <Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="font-mono min-w-[140px]" />
              <p className="text-xs text-muted-foreground">max {formatKES(line.balance)}</p>
            </div>
            <div className="space-y-1">
              <Label>Payment date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Paid from</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger><SelectValue placeholder="Choose account" /></SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.code} {a.label} (balance {formatKES(a.balance)})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Payment reference</Label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. KRA slip no." />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Receipt / payment slip (optional)</Label>
            <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <div className="space-y-1">
            <Label>Notes (optional)</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Saving..." : "Confirm payment"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
