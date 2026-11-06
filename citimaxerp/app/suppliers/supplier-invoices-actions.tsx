"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, FileSpreadsheet, Loader2, Plus, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { fetchImportSchema, downloadTemplate } from "@/lib/data-import";
import { getSuppliers, type Supplier } from "@/lib/suppliers";
import { importSupplierBills, recordSupplierBill } from "@/lib/supplier-payments";

const today = () => new Date().toISOString().slice(0, 10);

/**
 * "Record Supplier Invoice" for a bill typed in (services, rent, a bill brought across). Goods
 * received raise their own invoice, so this is for everything else. It posts to the books.
 */
export function RecordSupplierInvoice({ onSaved }: { onSaved: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [pickOpen, setPickOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const blank = { supplier_id: "", supplier_invoice_number: "", invoice_date: today(), due_date: "", amount: "", tax_amount: "", description: "", account_code: "" };
  const [form, setForm] = useState(blank);
  const set = (k: keyof typeof blank, v: string) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (open && suppliers.length === 0) getSuppliers().then(setSuppliers).catch(() => setSuppliers([]));
  }, [open, suppliers.length]);

  const supplier = suppliers.find((s) => s.id === form.supplier_id);
  const total = (Number(form.amount) || 0) + (Number(form.tax_amount) || 0);

  const save = async () => {
    if (!form.supplier_id || !form.invoice_date || !(Number(form.amount) > 0)) {
      toast({ title: "Missing information", description: "Supplier, invoice date and an amount above 0 are required.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await recordSupplierBill({
        supplier_id: form.supplier_id,
        supplier_invoice_number: form.supplier_invoice_number.trim() || undefined,
        invoice_date: form.invoice_date,
        due_date: form.due_date || undefined,
        amount: Number(form.amount),
        tax_amount: form.tax_amount ? Number(form.tax_amount) : undefined,
        description: form.description.trim() || undefined,
        account_code: form.account_code.trim() || undefined,
      });
      toast({ title: "Supplier invoice recorded", description: res.message });
      setOpen(false);
      setForm(blank);
      onSaved();
    } catch (e) {
      toast({ title: "Could not record the invoice", description: e instanceof Error ? e.message : "Nothing was saved", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button size="sm" className="bg-[#E30040] hover:bg-[#E30040]/90 text-white" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-2" />
        Record Supplier Invoice
      </Button>
      <Dialog open={open} onOpenChange={(o) => !saving && setOpen(o)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Record Supplier Invoice</DialogTitle>
            <DialogDescription>
              For bills that are not goods received (services, rent, repairs...). Goods received create their own supplier invoice.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>Supplier *</Label>
              <Popover open={pickOpen} onOpenChange={setPickOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="justify-between font-normal">
                    <span className="truncate">{supplier?.name ?? "Pick a supplier"}</span>
                    <ChevronsUpDown className="ml-2 h-3.5 w-3.5 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[360px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search supplier..." />
                    <CommandList>
                      <CommandEmpty>No supplier found.</CommandEmpty>
                      <CommandGroup>
                        {[...suppliers].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "")).map((s) => (
                          <CommandItem key={s.id} value={`${s.name} ${s.id}`} onSelect={() => { set("supplier_id", s.id); setPickOpen(false); }}>
                            <Check className={cn("mr-2 h-4 w-4", form.supplier_id === s.id ? "opacity-100" : "opacity-0")} />
                            {s.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="si_theirs">Supplier Invoice No.</Label>
                <Input id="si_theirs" value={form.supplier_invoice_number} onChange={(e) => set("supplier_invoice_number", e.target.value)} placeholder="Their invoice no." />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="si_account">Account Code</Label>
                <Input id="si_account" value={form.account_code} onChange={(e) => set("account_code", e.target.value)} placeholder="Blank = Inventory" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="si_date">Invoice Date *</Label>
                <Input id="si_date" type="date" value={form.invoice_date} onChange={(e) => set("invoice_date", e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="si_due">Due Date</Label>
                <Input id="si_due" type="date" value={form.due_date} onChange={(e) => set("due_date", e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="si_amount">Amount *</Label>
                <Input id="si_amount" type="number" min="0" step="0.01" value={form.amount} onChange={(e) => set("amount", e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="si_vat">VAT</Label>
                <Input id="si_vat" type="number" min="0" step="0.01" value={form.tax_amount} onChange={(e) => set("tax_amount", e.target.value)} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="si_desc">Description</Label>
              <Textarea id="si_desc" rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="What the bill is for" />
            </div>
            <p className="text-xs text-muted-foreground">
              Total KES {total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. Due date blank = invoice date + the
              supplier&apos;s payment terms. It is numbered on from PUR- and can then be paid from Supplier Payments.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={saving} onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="bg-[#E30040] hover:bg-[#E30040]/90 text-white">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Record Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Template download and Import (preview first) for supplier invoices and debit notes. */
export function SupplierInvoicesImport({ onImported }: { onImported: () => void }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [file, setFile] = useState<File | null>(null);

  const handleTemplate = async () => {
    try {
      downloadTemplate(await fetchImportSchema("supplier_invoices"), { fileName: "Supplier Invoices Import Template.xlsx" });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to download the template", variant: "destructive" });
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    setBusy(true);
    try {
      setPreview(await importSupplierBills(picked, true));
      setFile(picked);
    } catch (err) {
      toast({ title: "Import failed", description: err instanceof Error ? err.message : "Could not read the file", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleConfirm = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const result = await importSupplierBills(file, false);
      setPreview(null);
      setFile(null);
      onImported();
      toast({
        title: "Supplier invoices imported",
        description: `${result.summary.created} added, ${result.summary.updated} updated, ${result.summary.unchanged} unchanged.`,
      });
    } catch (err) {
      toast({ title: "Import failed", description: err instanceof Error ? err.message : "Nothing was saved", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const saving = preview ? preview.summary.created + preview.summary.updated : 0;

  return (
    <>
      <Button variant="outline" size="sm" onClick={handleTemplate}>
        <FileSpreadsheet className="h-4 w-4 mr-2" />
        Template
      </Button>
      <input type="file" id="import-supplier-invoices-file" className="hidden" accept=".csv,.xlsx,.xls" onChange={handleFile} />
      <Button variant="outline" size="sm" disabled={busy} onClick={() => document.getElementById("import-supplier-invoices-file")?.click()}>
        {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
        Import
      </Button>

      <Dialog open={!!preview} onOpenChange={(open) => { if (!open && !busy) { setPreview(null); setFile(null); } }}>
        <DialogContent className="max-w-4xl max-h-[88vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Import Preview - Supplier Invoices</DialogTitle>
          </DialogHeader>
          {preview && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Nothing is saved yet. Saved invoices post to the books (the account, Inventory by default, against Payables) and can then be paid from Supplier Payments.
              </p>
              <div className="grid grid-cols-4 gap-3">
                {([
                  ["New invoices", preview.summary.created, "bg-blue-50", "text-blue-600"],
                  ["Updated", preview.summary.updated, "bg-green-50", "text-green-600"],
                  ["Unchanged", preview.summary.unchanged, "bg-yellow-50", "text-yellow-600"],
                  ["Errors", preview.summary.errors, "bg-red-50", "text-red-600"],
                ] as const).map(([label, value, bg, fg]) => (
                  <div key={label} className={`rounded p-3 ${bg}`}>
                    <div className={`text-2xl font-bold ${fg}`}>{value}</div>
                    <div className="text-sm text-gray-600">{label}</div>
                  </div>
                ))}
              </div>
              {preview.summary.errors > 0 && (
                <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  {preview.summary.errors} row(s) have problems and will be skipped; fix them in the sheet and import again.
                </div>
              )}
              <div className="max-h-[380px] overflow-auto rounded border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-100">
                    <tr className="[&>th]:whitespace-nowrap [&>th]:px-3 [&>th]:py-2 [&>th]:text-left">
                      <th>S/No.</th>
                      <th>Row</th>
                      <th>Invoice No.</th>
                      <th>Supplier</th>
                      <th>Result</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(preview.rows ?? []).map((row: any, i: number) => (
                      <tr key={i} className="border-t align-top [&>td]:px-3 [&>td]:py-2">
                        <td className="text-gray-500">{i + 1}</td>
                        <td>{row.row}</td>
                        <td className="whitespace-nowrap">{row.key}</td>
                        <td>{row.name}</td>
                        <td>
                          <span className={`rounded px-2 py-1 text-xs ${
                            row.status === "created" ? "bg-blue-100 text-blue-800"
                              : row.status === "updated" ? "bg-green-100 text-green-800"
                              : row.status === "unchanged" ? "bg-gray-100 text-gray-800"
                              : "bg-red-100 text-red-800"
                          }`}>{row.status}</span>
                        </td>
                        <td className="text-gray-600">
                          {row.message || (row.changes ?? []).map((c: any) => `${c.field}: ${c.from ?? "-"} → ${c.to ?? "-"}`).join("; ") || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" disabled={busy} onClick={() => { setPreview(null); setFile(null); }}>Cancel</Button>
                <Button onClick={handleConfirm} disabled={busy || saving === 0} className="bg-[#E30040] hover:bg-[#E30040]/90 text-white">
                  {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Import {saving} invoice(s)
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
