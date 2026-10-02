"use client";

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
import { Loader2, Wallet, Eye, MoreHorizontal, FileText, Download, Search, ArrowUp, ArrowDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { hasPermission } from "@/lib/rbac";
import { DeliveryInvoice, getDeliveryInvoices, payDeliveryInvoice, exportDeliveryInvoicesToExcel, DeliveryInvoicesResponse } from "@/lib/delivery-invoices";

const STATUS_STYLES: Record<string, string> = {
  paid: "bg-green-100 text-green-800",
  pending: "bg-amber-100 text-amber-800",
  cancelled: "bg-gray-100 text-gray-800",
};

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "mpesa", label: "M-Pesa" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "cheque", label: "Cheque" },
  { value: "other", label: "Other" },
];

export function DeliveryInvoicesTable() {
  const router = useRouter();
  const { toast } = useToast();
  const { userProfile } = useAuth();
  const [invoices, setInvoices] = useState<DeliveryInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingInvoice, setPayingInvoice] = useState<DeliveryInvoice | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<DeliveryInvoice | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("");
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

  const canPay = hasPermission(userProfile as any, "can_pay_delivery_invoices");

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
        per_page: perPage,
      });
      setInvoices(response.data || []);
      setPagination(response.pagination);
    } catch (error) {
      console.error("Failed to load delivery invoices", error);
      toast({ title: "Error", description: "Failed to load delivery invoices", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const openPayModal = (invoice: DeliveryInvoice) => {
    setPayingInvoice(invoice);
    setPaymentMethod("");
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

  const pendingCount = invoices.filter((i) => i.status === "pending").length;

  const handleDownloadCSV = (invoice: DeliveryInvoice) => {
    const headers = ["Invoice #", "Order", "Transporter", "Zone", "Cartons", "Rate/Carton", "Total", "Status"];
    const values = [
      invoice.invoice_number,
      invoice.order_dispatch?.order?.order_number || invoice.order_dispatch?.order_id || "",
      invoice.transporter_name,
      invoice.zone,
      invoice.number_of_cartons,
      invoice.rate_per_carton,
      invoice.total_amount,
      invoice.status,
    ];

    const csvContent = [headers.join(","), values.map((v) => `"${v}"`).join(",")].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `delivery-invoice-${invoice.invoice_number}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportToExcel = async () => {
    try {
      await exportDeliveryInvoicesToExcel({ search: search || undefined });
      toast({ title: "Success", description: "Delivery invoices exported to CSV" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to export delivery invoices", variant: "destructive" });
    }
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
              <Select value={perPage.toString()} onValueChange={(val) => setPerPage(parseInt(val))}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 per page</SelectItem>
                  <SelectItem value="20">20 per page</SelectItem>
                  <SelectItem value="50">50 per page</SelectItem>
                  <SelectItem value="100">100 per page</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={handleExportToExcel}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
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
                  <TableHead className="cursor-pointer" onClick={() => toggleSort("order_number")}>
                    <div className="flex items-center gap-1">
                      Order {getSortIcon("order_number")}
                    </div>
                  </TableHead>
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
                    <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                    <TableCell className="font-medium">{invoice.order_dispatch?.order?.order_number || invoice.order_dispatch?.order_id || "—"}</TableCell>
                    <TableCell>{invoice.transporter_name}</TableCell>
                    <TableCell className="capitalize">{invoice.zone}</TableCell>
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
                          <DropdownMenuItem onClick={() => router.push(`/sales/invoices/delivery/${invoice.id}/document?download=1`)}>
                            <Download className="mr-2 h-4 w-4" />
                            Download PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDownloadCSV(invoice)}>
                            <Download className="mr-2 h-4 w-4" />
                            Download CSV
                          </DropdownMenuItem>
                          {canPay && invoice.status === "pending" && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => openPayModal(invoice)}>
                                <Wallet className="mr-2 h-4 w-4" />
                                Pay Invoice
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

          {/* Pagination */}
          {invoices.length > 0 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                Showing {pagination.from} to {pagination.to} of {pagination.total} invoices
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                >
                  Previous
                </Button>
                <div className="flex items-center gap-2">
                  {Array.from({ length: pagination.last_page }, (_, i) => i + 1).map((page) => (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                      className="w-8 h-8 p-0"
                    >
                      {page}
                    </Button>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === pagination.last_page}
                  onClick={() => setCurrentPage(Math.min(pagination.last_page, currentPage + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
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
                  <Label className="text-xs text-muted-foreground">Order ID</Label>
                  <p className="font-medium">{viewingInvoice.order_dispatch?.order?.order_number || viewingInvoice.order_dispatch?.order_id || "—"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Transporter</Label>
                  <p className="font-medium">{viewingInvoice.transporter_name}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Zone</Label>
                  <p className="font-medium capitalize">{viewingInvoice.zone}</p>
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
                      <p className="font-medium">{viewingInvoice.payment_date ? new Date(viewingInvoice.payment_date).toLocaleDateString() : "—"}</p>
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
                          <p className="font-medium">{viewingInvoice.cheque_maturity_date ? new Date(viewingInvoice.cheque_maturity_date).toLocaleDateString() : "—"}</p>
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
            <div className="grid gap-2">
              <Label htmlFor="payment_method">Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger id="payment_method">
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
