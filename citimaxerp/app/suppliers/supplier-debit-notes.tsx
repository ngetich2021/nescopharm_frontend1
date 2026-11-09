"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { displayDate } from "@/lib/date-format";
import { getDebitableReceipts, type DebitableReceipt } from "@/lib/productreceipt";
import { ReceiptDebitNoteDialog } from "@/app/product-receipt/components/ReceiptDebitNoteDialog";
import { SupplierInvoicesTable } from "./supplier-invoices-table";

const money = (n: number) => `KES ${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

/**
 * Suppliers > Debit Notes: goods sent back to suppliers (SDEB/0001). "Create Debit Note" picks the
 * goods receipt they came in on, then the quantities going back.
 */
export function SupplierDebitNotesTab() {
  const [pickOpen, setPickOpen] = useState(false);
  const [receipt, setReceipt] = useState<{ id: string; product_receipt_number?: string } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <>
      <SupplierInvoicesTable
        fixedKind="debit_note"
        reloadKey={reloadKey}
        actions={
          <Button onClick={() => setPickOpen(true)} className="bg-[#E30040] hover:bg-[#E30040]/90">
            <Plus className="h-4 w-4 mr-2" /> Create Debit Note
          </Button>
        }
      />
      <PickReceiptDialog
        open={pickOpen}
        onOpenChange={setPickOpen}
        onPick={(r) => { setPickOpen(false); setReceipt({ id: r.id, product_receipt_number: r.number }); }}
      />
      <ReceiptDebitNoteDialog
        receipt={receipt}
        open={!!receipt}
        onOpenChange={(v) => { if (!v) setReceipt(null); }}
        onDone={() => setReloadKey((k) => k + 1)}
      />
    </>
  );
}

function PickReceiptDialog({ open, onOpenChange, onPick }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPick: (r: DebitableReceipt) => void;
}) {
  const { toast } = useToast();
  const [rows, setRows] = useState<DebitableReceipt[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) return;
    setSearch("");
    setLoading(true);
    getDebitableReceipts()
      .then(setRows)
      .catch((e) => toast({ title: "Could not load receipts", description: e?.message, variant: "destructive" }))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? rows.filter((r) => [r.number, r.reference_number, r.supplier_name].some((v) => (v || "").toLowerCase().includes(q))) : rows;
  }, [rows, search]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Debit Note</DialogTitle>
          <DialogDescription>Pick the goods receipt the returned goods came in on.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Supplier, receipt # (RCPT-0016) or their invoice no..." value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
        </div>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : shown.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">No receipts{search ? " match" : ""}.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">S/No</TableHead>
                <TableHead>Receipt #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead className="text-right">Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((r, i) => (
                <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onPick(r)}>
                  <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="font-medium text-[#E30040]">
                    {r.number}
                    {r.reference_number && <span className="block text-xs text-muted-foreground">Ref: {r.reference_number}</span>}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{r.date ? displayDate(new Date(r.date)) : "—"}</TableCell>
                  <TableCell>{r.supplier_name || "—"}</TableCell>
                  <TableCell className="text-right">{r.items}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{money(r.goods)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}
