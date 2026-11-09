"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { displayDate } from "@/lib/date-format";
import { createReceiptDebitNote, getReceiptDebitNoteLines, type ReceiptDebitNoteInfo } from "@/lib/productreceipt";

const money = (n: number) => `KES ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Debit note on a goods receipt: goods sent back to the supplier. Each line's quantity comes out of
 * that receipt's batch and the supplier is debited (what is owed on the receipt's invoice comes down).
 */
export function ReceiptDebitNoteDialog({ receipt, open, onOpenChange, onDone }: {
  receipt: { id: string; product_receipt_number?: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
}) {
  const { toast } = useToast();
  const [info, setInfo] = useState<ReceiptDebitNoteInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [qty, setQty] = useState<Record<string, string>>({});
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [supplierRef, setSupplierRef] = useState("");

  useEffect(() => {
    if (!open || !receipt) return;
    setInfo(null);
    setQty({});
    setReason("");
    setSupplierRef("");
    setDate(new Date().toISOString().slice(0, 10));
    setLoading(true);
    getReceiptDebitNoteLines(receipt.id)
      .then(setInfo)
      .catch((e) => toast({ title: "Could not load the receipt", description: e?.message, variant: "destructive" }))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, receipt?.id]);

  const lines = info?.lines ?? [];
  const goods = useMemo(
    () => round2(lines.reduce((s, l) => s + (Number(qty[l.receipt_item_id]) || 0) * l.unit_price, 0)),
    [lines, qty],
  );
  const vat = info?.vat_rate ? round2((goods * info.vat_rate) / 100) : 0;
  const total = round2(goods + vat);
  const tooMany = lines.some((l) => (Number(qty[l.receipt_item_id]) || 0) > l.returnable);
  const anyQty = lines.some((l) => (Number(qty[l.receipt_item_id]) || 0) > 0);

  const save = async () => {
    if (!receipt || !info) return;
    if (!reason.trim()) {
      toast({ title: "Reason needed", description: "Say why the goods are going back (e.g. damaged, expired, wrong item).", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await createReceiptDebitNote(receipt.id, {
        date,
        reason: reason.trim(),
        supplier_reference: supplierRef.trim() || undefined,
        items: lines
          .map((l) => ({ receipt_item_id: l.receipt_item_id, quantity: Number(qty[l.receipt_item_id]) || 0 }))
          .filter((i) => i.quantity > 0),
      });
      toast({ title: `Debit note ${res.data.invoice_number}`, description: res.message });
      onOpenChange(false);
      onDone?.();
    } catch (e: any) {
      toast({ title: "Debit note not saved", description: e?.message || "Nothing was changed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Debit Note - Return to Supplier {info ? `(${info.next_number})` : ""}</DialogTitle>
          <DialogDescription>
            {info
              ? `${info.supplier_name || "No supplier"} · receipt ${info.receipt_number}${info.reference_number ? ` (ref ${info.reference_number})` : ""}. The quantities go out of stock and the supplier is debited.`
              : "Goods sent back from this receipt."}
          </DialogDescription>
        </DialogHeader>

        {loading || !info ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-4">
            {!info.supplier_id && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                This receipt has no supplier. Add the supplier to the receipt before raising a debit note.
              </div>
            )}
            {info.debit_notes.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Already returned on: {info.debit_notes.map((n) => `${n.number} (${money(n.total)})`).join(", ")}
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label htmlFor="dn_date">Date</Label>
                <Input id="dn_date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="dn_ref">Supplier's credit note no. (optional)</Label>
                <Input id="dn_ref" value={supplierRef} onChange={(e) => setSupplierRef(e.target.value)} placeholder="e.g. CN-0045" />
              </div>
            </div>

            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">S/No</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead className="text-right">Received</TableHead>
                    <TableHead className="text-right">Returned</TableHead>
                    <TableHead className="text-right">In Stock</TableHead>
                    <TableHead className="w-28">Return Qty</TableHead>
                    <TableHead className="text-right">Unit Cost</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((l, i) => {
                    const q = Number(qty[l.receipt_item_id]) || 0;
                    const over = q > l.returnable;
                    return (
                      <TableRow key={l.receipt_item_id}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-medium">{l.name}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {l.batch_number || "—"}
                          {l.expiry_date && <span className="block text-xs text-muted-foreground">exp {displayDate(new Date(l.expiry_date))}</span>}
                        </TableCell>
                        <TableCell className="text-right">{l.received}</TableCell>
                        <TableCell className="text-right">{l.returned || "—"}</TableCell>
                        <TableCell className="text-right">{l.in_stock}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            max={l.returnable}
                            value={qty[l.receipt_item_id] ?? ""}
                            disabled={l.returnable <= 0 || !info.supplier_id}
                            onChange={(e) => setQty((p) => ({ ...p, [l.receipt_item_id]: e.target.value }))}
                            className={over ? "border-red-500" : ""}
                            placeholder={l.returnable > 0 ? `max ${l.returnable}` : "none"}
                          />
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">{money(l.unit_price)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{q > 0 ? money(q * l.unit_price) : "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end">
              <div className="w-64 space-y-1 text-sm">
                <div className="flex justify-between"><span>Goods</span><span>{money(goods)}</span></div>
                {info.vat_rate > 0 && <div className="flex justify-between"><span>VAT ({info.vat_rate}%)</span><span>{money(vat)}</span></div>}
                <div className="flex justify-between font-bold border-t pt-1"><span>Debit {info.supplier_name || "supplier"}</span><span>{money(total)}</span></div>
              </div>
            </div>

            <div>
              <Label htmlFor="dn_reason">Reason</Label>
              <Textarea id="dn_reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Damaged, expired, wrong item, short-dated..." rows={2} />
            </div>
            {tooMany && <p className="text-sm text-red-600">A quantity is more than can go back on that line.</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button
            onClick={save}
            disabled={saving || !info || !info.supplier_id || !anyQty || tooMany}
            className="bg-[#E30040] hover:bg-[#E30040]/90"
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Raise Debit Note {total > 0 ? money(total) : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
