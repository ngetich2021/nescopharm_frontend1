"use client";

import { InvoiceTotals } from "@/components/invoices/invoice-totals"
import { displayDate } from "@/lib/date-format"
import { useEffect, useState, type ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ExportMenu, useTableExport } from "@/components/export-menu";
import { ALL_ROWS, TablePager } from "@/components/ui/table-pager";
import { deleteSupplierBill, getSupplierBills, type SupplierBill } from "@/lib/supplier-payments";
import { ImportHistoryDialog } from "@/components/import-history-dialog";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { RecordSupplierInvoice, SupplierInvoicesImport } from "./supplier-invoices-actions";

// 12/07/2026
const shortDate = (date?: string | null) => {
  if (!date) return "—";
  const d = new Date(date);
  if (isNaN(d.getTime())) return date;
  return displayDate(d);
};

// 15/10/2026 - day first, the format the import reads back.
const sheetDate = (date?: string | null) => {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return date;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

const money = (n: number) => `KES ${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

const STATUS: Record<SupplierBill["status"], { label: string; className: string }> = {
  paid: { label: "paid", className: "bg-green-100 text-green-800" },
  part_paid: { label: "part paid", className: "bg-blue-100 text-blue-800" },
  unpaid: { label: "unpaid", className: "bg-amber-100 text-amber-800" },
  debit_note: { label: "debit note", className: "bg-gray-100 text-gray-800" },
};

const METHOD_LABELS: Record<string, string> = { bank_transfer: "Bank Transfer", cash: "Cash", mpesa: "M-Pesa", cheque: "Cheque" };

/** "PV-161, PV-162" - the payments that paid a bill. */
const paidByLabel = (bill: SupplierBill) => bill.payments.map((p) => p.payment_number || p.reference || "payment").join(", ");

/**
 * What suppliers billed us (bills, e.g. PUR-131) and their debit notes, with what each payment put on
 * them. Bills are paid from Supplier Payments; this tab is where the invoices those payments pay are seen.
 */
export function SupplierInvoicesTable({ fixedKind, actions, reloadKey = 0 }: {
  // "debit_note": the Debit Notes tab - only debit notes, no invoice filters or invoice buttons.
  fixedKind?: "debit_note";
  actions?: ReactNode; // shown in place of the invoice buttons
  reloadKey?: number;
} = {}) {
  const { toast } = useToast();
  const [bills, setBills] = useState<SupplierBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<string>(fixedKind ?? "bill");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [pagination, setPagination] = useState({ total: 0, per_page: 20, current_page: 1, last_page: 1, from: 0, to: 0 });
  const [totals, setTotals] = useState({ billed: 0, paid: 0, owed: 0, debit_notes: 0 });
  const [viewing, setViewing] = useState<SupplierBill | null>(null);
  const [reload, setReload] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const refresh = () => setReload((n) => n + 1);

  // A debit note for returned goods as its own document (logo-headed), for the supplier.
  const exportDebitNote = useTableExport(() => {
    const b = viewing!;
    const goods = round2(b.total - (b.tax_amount || 0));
    const footer: (string | number | null)[][] = [["", "Goods", "", b.lines.reduce((s, l) => s + l.quantity, 0), "", goods]];
    if (b.tax_amount) footer.push(["", "VAT", "", null, "", b.tax_amount]);
    footer.push(["", "Total debited", "", null, "", b.total]);
    return {
      fileName: `debit-note-${b.invoice_number.replace(/\//g, "-")}`,
      title: `Debit Note ${b.invoice_number}`,
      details: [
        ["Supplier", b.supplier_name || "-"],
        ["Date", shortDate(b.invoice_date)],
        ["Goods received", b.returns_receipt_number || "-"],
        ["Supplier's credit note", b.supplier_invoice_number || "-"],
        ["Reason", b.reason || "-"],
      ],
      headers: ["S/No", "Description", "Batch", "Qty", "Unit Cost", "Amount"],
      moneyColumns: [4, 5],
      rows: b.lines.map((l, i) => [i + 1, l.name, l.batch_number || "", l.quantity, l.unit_price, l.amount]),
      footer,
    };
  });

  const removeBill = async (bill: SupplierBill) => {
    const returns = bill.lines.length > 0;
    if (!window.confirm(returns
      ? `Delete debit note ${bill.invoice_number}? The returned stock goes back into its batches and the supplier is owed the ${money(bill.total)} again.`
      : `Delete supplier invoice ${bill.invoice_number}? Its entry in the books is removed too.`)) return;
    setDeleting(true);
    try {
      const res = await deleteSupplierBill(bill.id);
      toast({ title: "Deleted", description: res.message });
      setViewing(null);
      refresh();
    } catch (e: any) {
      toast({ title: "Could not delete", description: e?.message || "Nothing was changed", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const filters = () => ({
    search: query || undefined,
    kind: kind === "all" ? undefined : kind,
    status: status === "all" ? undefined : status,
  });

  // Search as you type, a moment after the last key.
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); setQuery(search.trim()); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); }, [kind, status, pageSize]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getSupplierBills({ ...filters(), page, per_page: pageSize === ALL_ROWS ? "all" : pageSize })
      .then((res) => {
        if (cancelled) return;
        setBills(res.data ?? []);
        setPagination(res.pagination);
        setTotals(res.totals);
      })
      .catch((e) => toast({ title: "Error", description: e?.message || "Failed to load supplier invoices", variant: "destructive" }))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, kind, status, page, pageSize, reload, reloadKey]);

  // The import template's columns first (an exported sheet can be edited and imported back: a row
  // keeps its Invoice No. and updates that invoice), then what has been paid, which the import ignores.
  const exportColumns = ["S/No.", "Invoice No.", "Type", "Supplier Name", "Supplier Invoice No.", "Invoice Date", "Due Date", "Amount", "VAT",
    "Description", "Account Code", "Total", "Paid", "Balance", "Status", "Paid By"];
  const exportRow = (b: SupplierBill, i: number) => [
    i + 1, b.invoice_number, b.kind === "debit_note" ? "Debit Note" : "Invoice", b.supplier_name || "", b.supplier_invoice_number || "",
    sheetDate(b.invoice_date), sheetDate(b.due_date), round2(b.total - (b.tax_amount || 0)), b.tax_amount || null, b.description || "",
    b.account_code || "", b.total, b.paid, b.balance, STATUS[b.status]?.label ?? b.status, paidByLabel(b),
  ];

  // Every invoice matching the filters, all pages.
  const exportList = useTableExport(async () => {
    const res = await getSupplierBills({ ...filters(), per_page: "all" });
    return {
      fileName: `supplier-invoices-${new Date().toISOString().slice(0, 10)}`,
      title: kind === "debit_note" ? "Supplier Debit Notes" : "Supplier Invoices",
      subtitle: query ? `Search: ${query}` : undefined,
      headers: exportColumns,
      moneyColumns: [7, 8, 11, 12, 13],
      rows: res.data.map(exportRow),
      footer: kind === "debit_note" ? undefined
        : [["", "", "", "", "", "", "", "", "", "", "Total", res.totals.billed, res.totals.paid, res.totals.owed, "", ""]],
    };
  });

  return (
    <div className="space-y-4">
      <InvoiceTotals
        loading={loading}
        count={pagination.total}
        total={kind === "debit_note" ? totals.debit_notes : totals.billed}
        paid={totals.paid}
        unpaid={totals.owed}
        unpaidNote={kind === "all" && totals.debit_notes > 0 ? `Debit notes of ${money(totals.debit_notes)} are listed apart` : undefined}
      />

      {totals.owed > 0 && kind !== "debit_note" && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          <strong>{money(totals.owed)}</strong> still owed to suppliers on these invoices. Pay them from Supplier Payments (Record Payment, then tick the invoices).
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[220px]">
              <Label htmlFor="supplier-invoice-search" className="text-xs text-muted-foreground mb-1 block">Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="supplier-invoice-search"
                  placeholder="Invoice #, supplier, description, payment (PV-161)..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            {!fixedKind && (
              <>
                <Select value={kind} onValueChange={setKind}>
                  <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bill">Invoices</SelectItem>
                    <SelectItem value="debit_note">Debit notes</SelectItem>
                    <SelectItem value="all">Invoices + debit notes</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="unpaid">Unpaid</SelectItem>
                    <SelectItem value="part_paid">Part paid</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </>
            )}
            <ExportMenu onExport={exportList} disabled={bills.length === 0} />
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            {actions ?? (
              <>
                <RecordSupplierInvoice onSaved={refresh} />
                <SupplierInvoicesImport onImported={refresh} />
                <ImportHistoryDialog kind="supplier_invoices" title="Supplier Invoice" />
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : bills.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">{fixedKind ? "No debit notes" : "No supplier invoices"}{query || status !== "all" ? " match" : " yet"}.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">S/NO</TableHead>
                  <TableHead>Invoice #</TableHead>
                  <TableHead className="whitespace-nowrap">Date</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Paid By</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bills.map((bill, index) => (
                  <TableRow key={bill.id} className="cursor-pointer" onClick={() => setViewing(bill)}>
                    <TableCell className="text-sm text-muted-foreground">{(pagination.current_page - 1) * pagination.per_page + index + 1}</TableCell>
                    <TableCell className="font-medium whitespace-nowrap">
                      {bill.invoice_number}
                      {bill.supplier_invoice_number && <span className="block text-xs text-muted-foreground">their inv {bill.supplier_invoice_number}</span>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{shortDate(bill.invoice_date)}</TableCell>
                    <TableCell>{bill.supplier_name || "—"}</TableCell>
                    <TableCell className="text-right font-semibold whitespace-nowrap">{money(bill.total)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">{bill.kind === "debit_note" ? "—" : money(bill.paid)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">{bill.kind === "debit_note" ? "—" : money(bill.balance)}</TableCell>
                    <TableCell className="max-w-[200px]">
                      <span className="block truncate" title={paidByLabel(bill)}>{paidByLabel(bill) || "—"}</span>
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS[bill.status]?.className}>{STATUS[bill.status]?.label ?? bill.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {!loading && (
            <TablePager
              total={pagination.total}
              page={page}
              pageCount={Math.max(1, pagination.last_page)}
              pageSize={pageSize}
              start={(pagination.current_page - 1) * pagination.per_page}
              shown={bills.length}
              setPage={setPage}
              setPageSize={setPageSize}
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={!!viewing} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{viewing?.kind === "debit_note" ? "Supplier Debit Note" : "Supplier Invoice"} {viewing?.invoice_number}</DialogTitle>
            <DialogDescription>{viewing?.supplier_name}</DialogDescription>
          </DialogHeader>
          {viewing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                <div><Label className="text-xs text-muted-foreground">Date</Label><p className="font-medium">{shortDate(viewing.invoice_date)}</p></div>
                <div><Label className="text-xs text-muted-foreground">Due</Label><p className="font-medium">{shortDate(viewing.due_date)}</p></div>
                <div><Label className="text-xs text-muted-foreground">Supplier's Invoice No.</Label><p className="font-medium">{viewing.supplier_invoice_number || "—"}</p></div>
                <div><Label className="text-xs text-muted-foreground">Total</Label><p className="font-bold">{money(viewing.total)}</p></div>
                {viewing.kind !== "debit_note" && (
                  <>
                    <div><Label className="text-xs text-muted-foreground">Paid</Label><p className="font-medium">{money(viewing.paid)}</p></div>
                    <div><Label className="text-xs text-muted-foreground">Balance</Label><p className="font-bold text-primary">{money(viewing.balance)}</p></div>
                    {viewing.debited > 0 && (
                      <div><Label className="text-xs text-muted-foreground">Debit notes (returns)</Label><p className="font-medium">{money(viewing.debited)}</p></div>
                    )}
                  </>
                )}
                {viewing.returns_receipt_number && (
                  <div><Label className="text-xs text-muted-foreground">Goods received</Label><p className="font-medium">{viewing.returns_receipt_number}</p></div>
                )}
                {viewing.description && (
                  <div className="col-span-2 sm:col-span-3"><Label className="text-xs text-muted-foreground">Description</Label><p>{viewing.description}</p></div>
                )}
                <div className="col-span-2 sm:col-span-3 text-xs text-muted-foreground">
                  {viewing.from_receipt
                    ? "Raised by goods received: its amount follows the receipt (edit the receipt to change it)."
                    : viewing.source ? `Source: ${viewing.source}` : null}
                </div>
              </div>

              {viewing.lines.length > 0 && (
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Goods returned</Label>
                    <ExportMenu onExport={exportDebitNote} />
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">S/No</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Batch</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Unit Cost</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewing.lines.map((l, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                          <TableCell>{l.name}</TableCell>
                          <TableCell>{l.batch_number || "—"}</TableCell>
                          <TableCell className="text-right">{l.quantity}</TableCell>
                          <TableCell className="text-right whitespace-nowrap">{money(l.unit_price)}</TableCell>
                          <TableCell className="text-right whitespace-nowrap">{money(l.amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {viewing.tax_amount > 0 && <p className="text-sm text-right mt-2">VAT {money(viewing.tax_amount)} · Total {money(viewing.total)}</p>}
                </div>
              )}

              {viewing.kind !== "debit_note" && (
                <div className="border-t pt-4">
                  <Label className="text-sm font-semibold">Payments</Label>
                  {viewing.payments.length === 0 ? (
                    <p className="text-sm text-muted-foreground mt-2">No payment has been put on this invoice yet.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">S/No</TableHead>
                          <TableHead>Payment</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Method</TableHead>
                          <TableHead className="text-right">Amount on this invoice</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {viewing.payments.map((p, i) => (
                          <TableRow key={p.id}>
                            <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                            <TableCell>
                              <span className="font-medium">{p.payment_number || "—"}</span>
                              {p.reference && <span className="block text-xs text-muted-foreground">{p.reference}</span>}
                              {!p.applied && <span className="block text-xs text-amber-700">not applied yet ({p.status})</span>}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">{shortDate(p.date)}</TableCell>
                            <TableCell>{METHOD_LABELS[p.method] ?? p.method}</TableCell>
                            <TableCell className="text-right whitespace-nowrap">{money(p.amount)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              )}

              {!viewing.from_receipt && viewing.paid <= 0 && viewing.payments.length === 0 && (
                <div className="flex justify-end border-t pt-3">
                  <Button variant="outline" size="sm" className="text-red-600" disabled={deleting} onClick={() => removeBill(viewing)}>
                    {deleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                    {viewing.kind === "debit_note" ? "Delete Debit Note" : "Delete Invoice"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
