"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  PayrollRun,
  MoneyAccount,
  PAYMENT_METHODS,
  fetchPaymentAccounts,
  formatKES,
  initiatePayrollPayment,
  markPayrollRunPaid,
  monthName,
} from "@/lib/payroll-runs";

/**
 * Paying the employees (Payroll Module Enhancement, stage 2):
 * - "initiate": the payment voucher is prepared - no bank entry yet.
 * - "confirm": the money has actually left the bank - posts DR Net Salaries Payable / CR the account.
 */
export function PayRunDialog({
  run,
  mode,
  onClose,
  onDone,
}: {
  run: PayrollRun | null;
  mode: "initiate" | "confirm";
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<MoneyAccount[]>([]);
  const [accountId, setAccountId] = useState("");
  const [method, setMethod] = useState("bank_transfer");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!run) return;
    setAccountId(run.payment_account_id ?? "");
    setMethod(run.payment_method ?? "bank_transfer");
    setDate(run.payment_date ? String(run.payment_date).slice(0, 10) : new Date().toISOString().slice(0, 10));
    setReference(run.payment_reference ?? "");
    fetchPaymentAccounts()
      .then((list) => {
        setAccounts(list);
        if (!run.payment_account_id && list.length) {
          // Default to the bank (not petty cash) - salaries are normally paid by transfer.
          const bank = list.find((a) => /bank/i.test(a.name)) ?? list[0];
          setAccountId(bank.id);
        }
      })
      .catch(() => setAccounts([]));
  }, [run]);

  if (!run) return null;
  const period = `${monthName(run.pay_month)} ${run.pay_year}`;
  const net = Number(run.total_net ?? 0);
  const selected = accounts.find((a) => a.id === accountId);

  const submit = async () => {
    if (!accountId) {
      toast({ title: "Choose an account", description: "Pick the bank account (or petty cash) the salaries are paid from.", variant: "destructive" });
      return;
    }
    if (mode === "confirm" && !reference.trim()) {
      toast({ title: "Payment reference needed", description: "Enter the bank transaction, cheque or M-Pesa reference.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const data = { account_id: accountId, payment_method: method, payment_date: date, payment_reference: reference.trim() || undefined };
      if (mode === "initiate") {
        await initiatePayrollPayment(run.id, data);
        toast({ title: "Payment initiated", description: `${period}: voucher prepared. Confirm it once the money has left the bank.` });
      } else {
        const res = await markPayrollRunPaid(run.id, data);
        toast({ title: "Salaries paid", description: res.message });
      }
      onDone();
      onClose();
    } catch (err: any) {
      toast({ title: "Not saved", description: err?.message ?? "The payment could not be saved.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!run} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "initiate" ? "Initiate salary payment" : "Confirm salaries paid"} - {period}</DialogTitle>
          <DialogDescription>
            {mode === "initiate"
              ? "Prepare the payment voucher. Nothing is posted to the bank until you confirm the payment."
              : "Confirm only once the money has actually left the account. This posts Debit Net Salaries Payable / Credit the account below, and it shows in the bank book and bank reconciliation."}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border bg-muted/40 p-3 text-sm grid grid-cols-2 gap-y-1">
          <span className="text-muted-foreground">Net salaries</span>
          <span className="text-right font-mono font-semibold">KES {formatKES(net)}</span>
          <span className="text-muted-foreground">Employees</span>
          <span className="text-right">{run.payslips_count ?? 0}</span>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Paid from (bank account or petty cash)</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger><SelectValue placeholder="Choose account" /></SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.code} {a.label} (balance {formatKES(a.balance)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selected && net > selected.balance && (
              <p className="text-xs text-amber-700">The ledger balance of {selected.name} is below the net salaries - check the account before paying.</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Payment date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Payment method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Payment reference {mode === "initiate" && <span className="text-muted-foreground">(optional now)</span>}</Label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. bank transaction ref, cheque no. or M-Pesa code" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Saving..." : mode === "initiate" ? "Initiate payment" : "Confirm paid & post"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
