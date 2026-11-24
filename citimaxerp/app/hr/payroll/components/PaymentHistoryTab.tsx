"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Paperclip } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { displayDate } from "@/lib/date-format";
import { ExportMenu, useTableExport } from "@/components/export-menu";
import { documentFileName, sessionCompanyName } from "@/lib/document-names";
import { PaymentHistoryRow, fetchPaymentHistory, formatKES, paymentMethodLabel } from "@/lib/payroll-runs";

/** Monthly history of every salary payment and statutory payment (audit trail). */
export function PaymentHistoryTab() {
  const { toast } = useToast();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rows, setRows] = useState<PaymentHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchPaymentHistory({ date_from: from || undefined, date_to: to || undefined }));
    } catch (err: any) {
      toast({ title: "Error", description: err?.message ?? "Could not load the payment history.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const total = useMemo(() => rows.reduce((s, r) => s + Number(r.amount || 0), 0), [rows]);

  const onExport = useTableExport(() => ({
    fileName: documentFileName([sessionCompanyName(), "Payroll Payment History"]),
    title: "Payroll & Statutory Payment History",
    subtitle: from || to ? `${from ? displayDate(from) : "start"} to ${to ? displayDate(to) : "today"}` : "All payments",
    headers: ["S/No", "Payment date", "Payment", "Payroll month", "Paid to", "Paid from", "Method", "Reference", "Amount", "Recorded by"],
    rows: rows.map((r, i) => [i + 1, displayDate(r.payment_date), r.type, r.period_label, r.paid_to, r.account, paymentMethodLabel(r.payment_method), r.reference, r.amount, r.recorded_by]),
    footer: [["", "", "Total", "", "", "", "", "", total, ""]],
    moneyColumns: [8],
  }));

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <CardTitle className="text-base font-medium">Payment History</CardTitle>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1"><Label className="text-xs">From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" /></div>
            <div className="space-y-1"><Label className="text-xs">To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" /></div>
            <ExportMenu onExport={onExport} disabled={loading || rows.length === 0} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table scroll>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14">S/No</TableHead>
              <TableHead>Payment date</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Payroll month</TableHead>
              <TableHead>Paid to</TableHead>
              <TableHead>Paid from</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Recorded by</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={10} className="text-center py-10 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={10} className="text-center py-10 text-muted-foreground">No salary or statutory payments recorded yet.</TableCell></TableRow>
            ) : (
              rows.map((r, i) => (
                <TableRow key={`${r.type}-${r.reference}-${i}`}>
                  <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="whitespace-nowrap">{displayDate(r.payment_date)}</TableCell>
                  <TableCell className="font-medium">{r.type}</TableCell>
                  <TableCell>{r.period_label ?? "-"}</TableCell>
                  <TableCell className="text-muted-foreground">{r.paid_to ?? "-"}</TableCell>
                  <TableCell>{r.account ?? "-"}</TableCell>
                  <TableCell>{paymentMethodLabel(r.payment_method)}</TableCell>
                  <TableCell>
                    {r.reference ?? "-"}
                    {r.attachment_url && (
                      <a href={r.attachment_url} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center text-blue-700" title="Receipt">
                        <Paperclip className="h-3 w-3" />
                      </a>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono">{formatKES(r.amount)}</TableCell>
                  <TableCell className="text-muted-foreground">{r.recorded_by ?? "-"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          {rows.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={8} className="font-semibold">Total ({rows.length} payments)</TableCell>
                <TableCell className="text-right font-mono font-semibold">{formatKES(total)}</TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </CardContent>
    </Card>
  );
}
