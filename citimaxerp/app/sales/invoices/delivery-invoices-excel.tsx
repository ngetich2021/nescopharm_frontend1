"use client";

import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileSpreadsheet, Upload, Loader2, ScrollText, Download, Printer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fetchImportSchema, downloadTemplate } from "@/lib/data-import";
import { importDeliveryInvoices, getTransporters, Transporter, exportDeliveryInvoicesToExcel } from "@/lib/delivery-invoices";
import { getSupplierStatement, SupplierStatement } from "@/lib/suppliers";
import { documentFileName, todayFileDate, sessionCompanyName } from "@/lib/document-names";
import { printHtml } from "@/lib/print-frame";

const money = (n: number) => Number(n || 0).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// 12-Jul-26
const shortDate = (date: string) => {
  const d = new Date(date);
  if (isNaN(d.getTime())) return date;
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()];
  return `${String(d.getDate()).padStart(2, "0")}-${month}-${String(d.getFullYear()).slice(-2)}`;
};

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

/** Template download and Import (preview first) for delivery invoices. */
export function DeliveryInvoicesImport({ onImported }: { onImported: () => void }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [file, setFile] = useState<File | null>(null);

  const handleTemplate = async () => {
    try {
      downloadTemplate(await fetchImportSchema("delivery_invoices"), { fileName: "Delivery Invoices Import Template.xlsx" });
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
      setPreview(await importDeliveryInvoices(picked, true));
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
      const result = await importDeliveryInvoices(file, false);
      setPreview(null);
      setFile(null);
      onImported();
      toast({
        title: "Delivery invoices imported",
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
      <input type="file" id="import-delivery-invoices-file" className="hidden" accept=".csv,.xlsx,.xls" onChange={handleFile} />
      <Button variant="outline" size="sm" disabled={busy} onClick={() => document.getElementById("import-delivery-invoices-file")?.click()}>
        {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
        Import
      </Button>

      <Dialog open={!!preview} onOpenChange={(open) => { if (!open && !busy) { setPreview(null); setFile(null); } }}>
        <DialogContent className="max-w-4xl max-h-[88vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Import Preview - Delivery Invoices</DialogTitle>
          </DialogHeader>
          {preview && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Nothing is saved yet. Paid rows also record the payment to the transporter (Payments page); invoices and payments post to the books.
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
                      <th>Transporter</th>
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
                <Button disabled={busy || saving === 0} onClick={handleConfirm}>
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

/**
 * One transporter's account: delivery invoices billed, payments made and the running balance owed,
 * for any period - viewable here, downloadable to Excel and printable.
 */
export function TransporterStatement() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [transporters, setTransporters] = useState<Transporter[] | null>(null);
  const [supplierId, setSupplierId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [statement, setStatement] = useState<SupplierStatement | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    getTransporters()
      .then((list) => {
        setTransporters(list);
        if (!supplierId && list.length === 1) setSupplierId(list[0].supplier_id);
      })
      .catch((err) => {
        setTransporters([]);
        toast({ title: "Could not load transporters", description: err.message, variant: "destructive" });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || !supplierId) return;
    setLoading(true);
    getSupplierStatement(supplierId, { from: from || undefined, to: to || undefined })
      .then(setStatement)
      .catch((err) => {
        setStatement(null);
        toast({ title: "Could not load the statement", description: err.message, variant: "destructive" });
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, supplierId, from, to]);

  const transporter = transporters?.find((t) => t.supplier_id === supplierId);
  const periodLabel = from || to ? `${from ? shortDate(from) : "start"} to ${to ? shortDate(to) : "today"}` : "All time";

  const downloadExcel = () => {
    if (!statement || !transporter) return;
    const rows = [
      ["Transporter Statement", transporter.name],
      ["Period", periodLabel],
      [],
      ["S/No.", "Date", "Reference", "Description", "Billed", "Paid", "Balance"],
      ...statement.entries.map((e, i) => [i + 1, shortDate(e.date), e.reference, e.description, e.billed || "", e.paid || "", e.balance]),
      ["", "", "", "Total", statement.totals.billed, statement.totals.paid, statement.totals.balance],
    ];
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet["!cols"] = [{ wch: 7 }, { wch: 11 }, { wch: 14 }, { wch: 60 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Statement");
    XLSX.writeFile(book, documentFileName([sessionCompanyName(), transporter.name, "Transporter Statement", todayFileDate()], "xlsx"));
  };

  const print = () => {
    if (!statement || !transporter) return;
    const body = statement.entries.map((e, i) => `<tr><td>${i + 1}</td><td>${shortDate(e.date)}</td><td>${escapeHtml(e.reference ?? "")}</td>`
      + `<td>${escapeHtml(e.description ?? "")}</td><td class="n">${e.billed ? money(e.billed) : "—"}</td>`
      + `<td class="n">${e.paid ? money(e.paid) : "—"}</td><td class="n">${money(e.balance)}</td></tr>`).join("");
    printHtml(`<!DOCTYPE html><html><head><title>Transporter Statement</title><style>
      @page { size: A4; margin: 10mm } body { font-family: Arial, sans-serif; font-size: 10px; color: #111 }
      h1 { font-size: 15px; margin: 0 0 2px } .sub { color: #555; margin-bottom: 10px }
      table { width: 100%; border-collapse: collapse } th, td { border-bottom: 1px solid #ddd; padding: 3px 4px; text-align: left; vertical-align: top }
      th { background: #f3f3f3 } .n { text-align: right; white-space: nowrap } tfoot td { font-weight: bold; border-top: 2px solid #333 }
    </style></head><body>
      <h1>${escapeHtml(sessionCompanyName() || "")} - Transporter Statement</h1>
      <div class="sub"><b>${escapeHtml(transporter.name)}</b> &nbsp;|&nbsp; ${periodLabel} &nbsp;|&nbsp; Balance owed: KES ${money(statement.totals.balance)}</div>
      <table><thead><tr><th>S/No.</th><th>Date</th><th>Reference</th><th>Description</th><th class="n">Billed</th><th class="n">Paid</th><th class="n">Balance</th></tr></thead>
      <tbody>${body}</tbody>
      <tfoot><tr><td colspan="4">Total</td><td class="n">${money(statement.totals.billed)}</td><td class="n">${money(statement.totals.paid)}</td><td class="n">${money(statement.totals.balance)}</td></tr></tfoot></table>
    </body></html>`, "Transporter Statement");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ScrollText className="h-4 w-4 mr-2" />
          Transporter Statement
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Transporter Statement</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="md:col-span-2">
              <Label className="text-xs text-muted-foreground">Transporter</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger>
                  <SelectValue placeholder={transporters === null ? "Loading..." : transporters.length ? "Choose a transporter" : "No transporters yet"} />
                </SelectTrigger>
                <SelectContent>
                  {(transporters ?? []).map((t) => (
                    <SelectItem key={t.supplier_id} value={t.supplier_id}>
                      {t.name} - owed KES {money(t.balance)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>

          {!supplierId ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Choose a transporter to see their statement.</p>
          ) : loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : statement && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm">
                  <span className="text-muted-foreground">{periodLabel} · </span>
                  Billed <b>KES {money(statement.totals.billed)}</b> · Paid <b>KES {money(statement.totals.paid)}</b> ·{" "}
                  <span className={statement.totals.balance > 0 ? "font-semibold text-red-600" : "font-semibold text-green-700"}>
                    Owed KES {money(statement.totals.balance)}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={downloadExcel}><Download className="h-4 w-4 mr-2" />Statement (Excel)</Button>
                  <Button variant="outline" size="sm" onClick={() => exportDeliveryInvoicesToExcel({ supplierId }).catch((e) =>
                    toast({ title: "Export failed", description: e.message, variant: "destructive" }))}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />Their Invoices (Excel)
                  </Button>
                  <Button variant="outline" size="sm" onClick={print}><Printer className="h-4 w-4 mr-2" />Print</Button>
                </div>
              </div>
              {statement.entries.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Nothing recorded for this transporter in this period.</p>
              ) : (
                <div className="max-h-[480px] overflow-auto rounded border">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-gray-50 text-gray-600">
                      <tr className="[&>th]:whitespace-nowrap [&>th]:px-3 [&>th]:py-2">
                        <th className="text-left">S/No.</th>
                        <th className="text-left">Date</th>
                        <th className="text-left">Reference</th>
                        <th className="text-left">Description</th>
                        <th className="text-right">Billed</th>
                        <th className="text-right">Paid</th>
                        <th className="text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statement.entries.map((e, i) => (
                        <tr key={i} className="border-t [&>td]:px-3 [&>td]:py-1.5">
                          <td className="text-gray-500">{i + 1}</td>
                          <td className="whitespace-nowrap">{shortDate(e.date)}</td>
                          <td className="whitespace-nowrap">{e.reference}</td>
                          <td>{e.description}</td>
                          <td className="text-right tabular-nums">{e.billed ? money(e.billed) : "—"}</td>
                          <td className="text-right tabular-nums">{e.paid ? money(e.paid) : "—"}</td>
                          <td className="text-right tabular-nums font-medium">{money(e.balance)}</td>
                        </tr>
                      ))}
                      <tr className="border-t bg-gray-50 font-semibold [&>td]:px-3 [&>td]:py-2">
                        <td colSpan={4}>Total</td>
                        <td className="text-right tabular-nums">{money(statement.totals.billed)}</td>
                        <td className="text-right tabular-nums">{money(statement.totals.paid)}</td>
                        <td className="text-right tabular-nums">{money(statement.totals.balance)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
