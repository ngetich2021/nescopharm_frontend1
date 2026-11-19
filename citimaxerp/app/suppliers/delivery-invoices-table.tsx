"use client";

import { orderRef } from "@/lib/order-ref"
import { InvoiceTotals } from "@/components/invoices/invoice-totals"
import { displayDate } from "@/lib/date-format"
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Wallet, Eye, MoreHorizontal, FileText, Download, Search, ArrowUp, ArrowDown, Pencil, Trash2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { PaidFromPicker } from "@/components/paid-from-picker";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { hasPermission } from "@/lib/rbac";
import { DeliveryInvoice, getDeliveryInvoices, payDeliveryInvoice, updateDeliveryInvoice, deleteDeliveryInvoice, DeliveryInvoicesResponse } from "@/lib/delivery-invoices";
import { exportTable, type ExportFormat } from "@/lib/table-export";
import { ExportMenu, ExportSubMenu, useTableExport } from "@/components/export-menu";
import { DeliveryInvoicesImport, TransporterStatement } from "./delivery-invoices-excel";
import { ImportHistoryDialog } from "@/components/import-history-dialog";
import { ALL_ROWS, TablePager } from "@/components/ui/table-pager";

// The sale it delivered, by its NSK number. Imported invoices for deliveries made before the system have
// no order, only what the old records said, which is the customer/destination (shown under Customer).
const orderLabel = (invoice: DeliveryInvoice) =>
  orderRef(invoice.order_dispatch?.order as any) || "—";
const customerLabel = (invoice: DeliveryInvoice) => {
  const c: any = invoice.order_dispatch?.order?.customer;
  return c?.business_name || c?.display_name || c?.name || invoice.order_reference || "—";
};
// The rate it was charged at gives the zone when the invoice itself has none.
const zoneLabel = (invoice: DeliveryInvoice) => invoice.zone || (invoice as any).delivery_rate?.zone || "—";

// 12/07/2026
const shortDate = (date?: string | null) => {
  if (!date) return "—";
  const d = new Date(date);
  if (isNaN(d.getTime())) return date;
  return displayDate(d);
};

const STATUS_STYLES: Record<string, string> = {
  paid: "bg-green-100 text-green-800",
  pending: "bg-amber-100 text-amber-800",
  cancelled: "bg-gray-100 text-gray-800",
};


export function DeliveryInvoicesTable() {
  const router = useRouter();
  const { toast } = useToast();
  const { userProfile } = useAuth();
  const [invoices, setInvoices] = useState<DeliveryInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingInvoice, setPayingInvoice] = useState<DeliveryInvoice | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<DeliveryInvoice | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  // Cheque payment safeguards
  const [chequeNumber, setChequeNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [chequeMaturityDate, setChequeMaturityDate] = useState("");
  // Search, sorting, and pagination
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [pagination, setPagination] = useState({ total: 0, per_page: 20, current_page: 1, last_page: 0, from: 0, to: 0 });
  const [pendingCount, setPendingCount] = useState(0);
  const [totals, setTotals] = useState({ count: 0, total: 0, paid: 0, unpaid: 0 });

  const canPay = hasPermission(userProfile as any, "can_pay_delivery_invoices");
  // Accounting corrects the amount to what was actually agreed with the transporter (not rate x cartons).
  const [editing, setEditing] = useState<DeliveryInvoice | null>(null);
  const [edit, setEdit] = useState({ total_amount: "", number_of_cartons: "", transporter_invoice_number: "", invoice_date: "", notes: "" });
  const openEdit = (invoice: DeliveryInvoice) => {
    setEditing(invoice);
    setEdit({
      total_amount: String(Number(invoice.total_amount) || ""),
      number_of_cartons: invoice.number_of_cartons != null ? String(invoice.number_of_cartons) : "",
      transporter_invoice_number: invoice.transporter_invoice_number || "",
      invoice_date: (invoice.invoice_date || invoice.created_at || "").slice(0, 10),
      notes: invoice.notes || "",
    });
  };
  const handleSaveEdit = async () => {
    if (!editing) return;
    const amount = Number(edit.total_amount);
    if (!(amount > 0)) {
      toast({ title: "Check the amount", description: "Enter the amount agreed with the transporter (more than 0).", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { message } = await updateDeliveryInvoice(editing.id, {
        total_amount: amount,
        number_of_cartons: edit.number_of_cartons === "" ? null : Number(edit.number_of_cartons),
        transporter_invoice_number: edit.transporter_invoice_number.trim() || null,
        ...(edit.invoice_date ? { invoice_date: edit.invoice_date } : {}),
        notes: edit.notes.trim() || null,
      });
      toast({ title: "Saved", description: message });
      setEditing(null);
      loadInvoices();
    } catch (error: any) {
      toast({ title: "Could not save", description: error.message || "Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  // Delete a wrong (unpaid) invoice: its dispatch goes back to Dispatch Order to be entered again.
  const [deleting, setDeleting] = useState<DeliveryInvoice | null>(null);
  const handleDelete = async () => {
    if (!deleting) return;
    setSubmitting(true);
    try {
      const message = await deleteDeliveryInvoice(deleting.id);
      toast({ title: "Deleted", description: message });
      setDeleting(null);
      loadInvoices();
    } catch (error: any) {
      toast({ title: "Could not delete", description: error.message || "Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
    loadInvoices();
  }, [search, sortBy, sortOrder, perPage]);

  useEffect(() => {
    loadInvoices();
  }, [currentPage]);

  const loadInvoices = async () => {
    setLoading(true);
    try {
      const response = await getDeliveryInvoices({
        search: search || undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
        page: currentPage,
        per_page: perPage === ALL_ROWS ? "all" : perPage,
      });
      setInvoices(response.data || []);
      setPagination(response.pagination);
      setPendingCount(response.pending_count ?? response.data.filter((i) => i.status === "pending").length);
      if (response.totals) setTotals(response.totals);
    } catch (error) {
      console.error("Failed to load delivery invoices", error);
      toast({ title: "Error", description: "Failed to load delivery invoices", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const openPayModal = (invoice: DeliveryInvoice) => {
    setPayingInvoice(invoice);
    setPaymentMethod("cash");
    setPaymentReference("");
    setPaymentDate("");
    setChequeNumber("");
    setBankName("");
    setChequeMaturityDate("");
  };

  const handlePay = async () => {
    if (!payingInvoice) return;
    if (!paymentMethod) {
      toast({ title: "Missing Information", description: "Please select a payment method.", variant: "destructive" });
      return;
    }

    // Cheque payment safeguards - require cheque details
    if (paymentMethod === "cheque") {
      if (!chequeNumber.trim()) {
        toast({ title: "Missing Information", description: "Cheque number is required.", variant: "destructive" });
        return;
      }
      if (!bankName.trim()) {
        toast({ title: "Missing Information", description: "Bank name is required.", variant: "destructive" });
        return;
      }
      if (!chequeMaturityDate) {
        toast({ title: "Missing Information", description: "Cheque maturity date is required.", variant: "destructive" });
        return;
      }
    }

    setSubmitting(true);
    try {
      await payDeliveryInvoice(payingInvoice.id, {
        payment_method: paymentMethod,
        payment_reference: paymentReference || undefined,
        payment_date: paymentDate || undefined,
        cheque_number: chequeNumber || undefined,
        bank_name: bankName || undefined,
        cheque_maturity_date: chequeMaturityDate || undefined,
      });
      toast({ title: "Success", description: "Delivery invoice paid. The dispatch can now proceed." });
      setPayingInvoice(null);
      loadInvoices();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to record payment.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const exportColumns = ["S/No", "Invoice #", "Date", "Order", "Customer", "Transporter", "Transporter Inv.", "Zone", "Cartons", "Rate/Carton", "Total", "Status"];
  const exportRow = (invoice: DeliveryInvoice, i: number) => [
    i + 1,
    invoice.invoice_number,
    shortDate(invoice.invoice_date || invoice.created_at),
    orderLabel(invoice),
    customerLabel(invoice),
    invoice.transporter_name,
    invoice.transporter_invoice_number || "",
    zoneLabel(invoice),
    Number(invoice.number_of_cartons) || 0,
    Number(invoice.rate_per_carton) || 0,
    Number(invoice.total_amount) || 0,
    invoice.status,
  ];

  // Every delivery invoice matching the search, all pages.
  const exportList = useTableExport(async () => {
    const all = (await getDeliveryInvoices({ search: search || undefined, sort_by: sortBy, sort_order: sortOrder, per_page: "all" })).data;
    return {
      fileName: `delivery-invoices-${new Date().toISOString().slice(0, 10)}`,
      title: "Delivery Invoices",
      subtitle: search ? `Search: ${search}` : undefined,
      headers: exportColumns,
      moneyColumns: [9, 10],
      rows: all.map(exportRow),
      footer: [["", "", "", "", "", "", "", "Total", all.reduce((s, d) => s + (Number(d.number_of_cartons) || 0), 0), null,
        all.reduce((s, d) => s + (Number(d.total_amount) || 0), 0), ""]],
    };
  });

  // PDF is the delivery invoice document itself; Excel and CSV its one line.
  const handleDownload = async (invoice: DeliveryInvoice, format: ExportFormat) => {
    if (format === "pdf") {
      router.push(`/sales/invoices/delivery/${invoice.id}/document?download=1`);
      return;
    }
    await exportTable(format, {
      fileName: `delivery-invoice-${invoice.invoice_number}`,
      title: `Delivery Invoice ${invoice.invoice_number}`,
      headers: exportColumns,
      moneyColumns: [9, 10],
      rows: [exportRow(invoice, 0)],
    }, userProfile?.company);
  };

  const toggleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
  };

  const getSortIcon = (column: string) => {
    if (sortBy !== column) return null;
    return sortOrder === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  };

  return (
    <div className="space-y-4">
      <InvoiceTotals loading={loading} count={totals.count} total={totals.total} paid={totals.paid} unpaid={totals.unpaid} />

      {pendingCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          <strong>{pendingCount}</strong> delivery invoice{pendingCount > 1 ? "s" : ""} awaiting payment. Dispatches stay held until paid.
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          {/* Search and Controls Bar */}
          <div className="mb-6 space-y-4">
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Label htmlFor="search" className="text-xs text-muted-foreground mb-1 block">Search</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    type="text"
                    placeholder="Invoice #, order, transporter, zone..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <ExportMenu onExport={exportList} disabled={invoices.length === 0} />
            </div>
            <div className="flex flex-wrap gap-2">
              <TransporterStatement />
              {canPay && <DeliveryInvoicesImport onImported={loadInvoices} search={search} />}
              <ImportHistoryDialog kind="delivery_invoices" title="Delivery Invoice" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : invoices.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">No delivery invoices yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">S/NO</TableHead>
                  <TableHead className="cursor-pointer" onClick={() => toggleSort("invoice_number")}>
                    <div className="flex items-center gap-1">
                      Invoice # {getSortIcon("invoice_number")}
                    </div>
                  </TableHead>
                  <TableHead className="whitespace-nowrap">Date</TableHead>
                  <TableHead className="cursor-pointer" onClick={() => toggleSort("order_number")}>
                    <div className="flex items-center gap-1">
                      Order {getSortIcon("order_number")}
                    </div>
                  </TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="cursor-pointer" onClick={() => toggleSort("transporter_name")}>
                    <div className="flex items-center gap-1">
                      Transporter {getSortIcon("transporter_name")}
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => toggleSort("zone")}>
                    <div className="flex items-center gap-1">
                      Zone {getSortIcon("zone")}
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => toggleSort("number_of_cartons")}>
                    <div className="flex items-center gap-1">
                      Cartons {getSortIcon("number_of_cartons")}
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => toggleSort("total_amount")}>
                    <div className="flex items-center gap-1">
                      Total {getSortIcon("total_amount")}
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => toggleSort("status")}>
                    <div className="flex items-center gap-1">
                      Status {getSortIcon("status")}
                    </div>
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice, index) => {
                  const rowNumber = (pagination.current_page - 1) * pagination.per_page + index + 1;
                  return (
                  <TableRow key={invoice.id}>
                    <TableCell className="text-sm text-muted-foreground">{rowNumber}</TableCell>
                    <TableCell className="font-medium whitespace-nowrap">{invoice.invoice_number}</TableCell>
                    <TableCell className="whitespace-nowrap">{shortDate(invoice.invoice_date || invoice.created_at)}</TableCell>
                    <TableCell className="font-medium whitespace-nowrap">{orderLabel(invoice)}</TableCell>
                    <TableCell>{customerLabel(invoice)}</TableCell>
                    <TableCell>{invoice.transporter_name}</TableCell>
                    <TableCell className="capitalize">{zoneLabel(invoice)}</TableCell>
                    <TableCell>{invoice.number_of_cartons}</TableCell>
                    <TableCell className="font-semibold">KES {Number(invoice.total_amount).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_STYLES[invoice.status]}>{invoice.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setViewingInvoice(invoice)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => router.push(`/sales/invoices/delivery/${invoice.id}/document`)}>
                            <FileText className="mr-2 h-4 w-4" />
                            View Document
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <ExportSubMenu onExport={(format) => handleDownload(invoice, format)} />
                          {canPay && invoice.status !== "cancelled" && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => openEdit(invoice)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit Amount / Details
                              </DropdownMenuItem>
                            </>
                          )}
                          {canPay && invoice.status === "pending" && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => openPayModal(invoice)}>
                                <Wallet className="mr-2 h-4 w-4" />
                                Pay Invoice
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => setDeleting(invoice)}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete &amp; Re-dispatch
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {!loading && (
            <TablePager
              total={pagination.total}
              page={currentPage}
              pageCount={Math.max(1, pagination.last_page)}
              pageSize={perPage}
              start={(pagination.current_page - 1) * pagination.per_page}
              shown={invoices.length}
              setPage={setCurrentPage}
              setPageSize={setPerPage}
            />
          )}
        </CardContent>
      </Card>

      {/* View Details Dialog */}
      <Dialog open={!!viewingInvoice} onOpenChange={(open) => !open && setViewingInvoice(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Delivery Invoice Details</DialogTitle>
            <DialogDescription>
              {viewingInvoice?.invoice_number}
            </DialogDescription>
          </DialogHeader>

          {viewingInvoice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Invoice Number</Label>
                  <p className="font-medium">{viewingInvoice.invoice_number}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Order</Label>
                  <p className="font-medium">{orderLabel(viewingInvoice)}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Customer</Label>
                  <p className="font-medium">{customerLabel(viewingInvoice)}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Transporter</Label>
                  <p className="font-medium">{viewingInvoice.transporter_name}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Zone</Label>
                  <p className="font-medium capitalize">{zoneLabel(viewingInvoice)}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Number of Cartons</Label>
                  <p className="font-medium">{viewingInvoice.number_of_cartons}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Rate per Carton</Label>
                  <p className="font-medium">KES {Number(viewingInvoice.rate_per_carton).toLocaleString()}</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Total Amount</Label>
                    <p className="text-lg font-bold text-primary">KES {Number(viewingInvoice.total_amount).toLocaleString()}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <Badge className={`mt-1 ${STATUS_STYLES[viewingInvoice.status]}`}>
                      {viewingInvoice.status}
                    </Badge>
                  </div>
                </div>
              </div>

              {viewingInvoice.notes && (
                <div className="border-t pt-4">
                  <Label className="text-xs text-muted-foreground">Notes</Label>
                  <p className="whitespace-pre-line text-sm">{viewingInvoice.notes}</p>
                </div>
              )}

              {viewingInvoice.status === "paid" && (
                <div className="border-t pt-4 space-y-2">
                  <Label className="text-sm font-semibold">Payment Information</Label>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Payment Method</p>
                      <p className="font-medium capitalize">{viewingInvoice.payment_method || "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Payment Date</p>
                      <p className="font-medium">{viewingInvoice.payment_date ? displayDate(new Date(viewingInvoice.payment_date)) : "—"}</p>
                    </div>
                    {viewingInvoice.payment_reference && (
                      <div>
                        <p className="text-muted-foreground">Reference</p>
                        <p className="font-medium">{viewingInvoice.payment_reference}</p>
                      </div>
                    )}
                    {viewingInvoice.cheque_number && (
                      <>
                        <div>
                          <p className="text-muted-foreground">Cheque Number</p>
                          <p className="font-medium">{viewingInvoice.cheque_number}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Bank Name</p>
                          <p className="font-medium">{viewingInvoice.bank_name || "—"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Cheque Maturity</p>
                          <p className="font-medium">{viewingInvoice.cheque_maturity_date ? displayDate(new Date(viewingInvoice.cheque_maturity_date)) : "—"}</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingInvoice(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal (accounting): the amount actually agreed for this dispatch */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Edit Delivery Invoice</DialogTitle>
            <DialogDescription>
              {editing?.invoice_number} · {editing?.transporter_name}. Enter what was agreed with the transporter for this dispatch;
              it replaces rate x cartons.{editing?.status === "paid" ? " It is paid, so its payment is changed to the new amount too." : ""}
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit_amount">Amount (KES)</Label>
                  <Input id="edit_amount" type="number" inputMode="decimal" min="0" step="0.01" className="font-semibold tabular-nums"
                    value={edit.total_amount} onChange={(e) => setEdit((p) => ({ ...p, total_amount: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit_cartons">Cartons</Label>
                  <Input id="edit_cartons" type="number" min="0" step="1" className="tabular-nums"
                    value={edit.number_of_cartons} onChange={(e) => setEdit((p) => ({ ...p, number_of_cartons: e.target.value }))} />
                </div>
              </div>
              {Number(editing.rate_per_carton) > 0 && Number(edit.number_of_cartons) > 0 && (
                <p className="-mt-2 text-xs text-muted-foreground">
                  At the rate: {edit.number_of_cartons} x KES {Number(editing.rate_per_carton).toLocaleString()} = KES {(Number(edit.number_of_cartons) * Number(editing.rate_per_carton)).toLocaleString()}
                  {" · "}<button type="button" className="text-primary underline"
                    onClick={() => setEdit((p) => ({ ...p, total_amount: String(Number(p.number_of_cartons) * Number(editing.rate_per_carton)) }))}>Use the rate</button>
                </p>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit_trans_inv">Transporter Invoice No.</Label>
                  <Input id="edit_trans_inv" value={edit.transporter_invoice_number}
                    onChange={(e) => setEdit((p) => ({ ...p, transporter_invoice_number: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit_date">Invoice Date</Label>
                  <Input id="edit_date" type="date" value={edit.invoice_date}
                    onChange={(e) => setEdit((p) => ({ ...p, invoice_date: e.target.value }))} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit_notes">Notes</Label>
                <Textarea id="edit_notes" rows={3} placeholder="e.g. Negotiated KES 1,000 for the 4 cartons"
                  value={edit.notes} onChange={(e) => setEdit((p) => ({ ...p, notes: e.target.value }))} />
                <p className="text-xs text-muted-foreground">A change of amount is noted here automatically (from, to, who, when).</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Delete {deleting?.invoice_number}?</DialogTitle>
            <DialogDescription>
              {deleting && (deleting.order_dispatch
                ? `KES ${Number(deleting.total_amount).toLocaleString()} to ${deleting.transporter_name} for ${orderLabel(deleting)} is removed, and ${orderLabel(deleting)} goes back to Dispatches with "Dispatch Order" so it can be entered again with the right transporter, rate and cartons. Its stock and delivery note stay as they are.`
                : `KES ${Number(deleting.total_amount).toLocaleString()} to ${deleting.transporter_name} is removed from the transporter's account.`)}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pay Modal */}
      <Dialog open={!!payingInvoice} onOpenChange={(open) => !open && setPayingInvoice(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Pay Delivery Invoice</DialogTitle>
            <DialogDescription>
              {payingInvoice?.invoice_number} — KES {payingInvoice ? Number(payingInvoice.total_amount).toLocaleString() : 0}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <PaidFromPicker
              method={paymentMethod}
              onMethodChange={setPaymentMethod}
              supplierName={payingInvoice?.transporter_name ?? null}
            />
            <div className="grid gap-2">
              <Label htmlFor="payment_reference">Payment Reference (optional)</Label>
              <Input
                id="payment_reference"
                placeholder="e.g. M-Pesa code"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="payment_date">Payment Date (optional)</Label>
              <Input
                id="payment_date"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>

            {/* Cheque Payment Safeguards */}
            {paymentMethod === "cheque" && (
              <div className="border-t pt-4 mt-4 space-y-3">
                <div className="bg-blue-50 p-3 rounded text-xs text-blue-700 font-medium">
                  Cheque payment details required
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="cheque_number">Cheque Number *</Label>
                  <Input
                    id="cheque_number"
                    placeholder="e.g. 123456"
                    value={chequeNumber}
                    onChange={(e) => setChequeNumber(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="bank_name">Bank Name *</Label>
                  <Input
                    id="bank_name"
                    placeholder="e.g. Kenya Commercial Bank"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="cheque_maturity_date">Cheque Maturity Date *</Label>
                  <Input
                    id="cheque_maturity_date"
                    type="date"
                    value={chequeMaturityDate}
                    onChange={(e) => setChequeMaturityDate(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayingInvoice(null)}>Cancel</Button>
            <Button onClick={handlePay} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
