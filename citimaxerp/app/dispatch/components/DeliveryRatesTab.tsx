"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Plus, Check, X, Eye, Trash2, ChevronLeft, ChevronRight, MoreVertical, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { hasPermission } from "@/lib/rbac";
import {
  DeliveryRate,
  DeliveryZone,
  getDeliveryRates,
  createDeliveryRate,
  approveDeliveryRate,
  rejectDeliveryRate,
  deleteDeliveryRate,
} from "@/lib/delivery-rates";

const STATUS_STYLES: Record<string, string> = {
  approved: "bg-green-100 text-green-800",
  pending: "bg-amber-100 text-amber-800",
  rejected: "bg-red-100 text-red-800",
};

type SortField = "transporter_name" | "zone" | "rate_per_carton" | "status";
type SortOrder = "asc" | "desc";

export function DeliveryRatesTab() {
  const { toast } = useToast();
  const { userProfile } = useAuth();
  const [allRates, setAllRates] = useState<DeliveryRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("transporter_name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null);
  const [rejectionNotes, setRejectionNotes] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewingRate, setViewingRate] = useState<DeliveryRate | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approvalNotes, setApprovalNotes] = useState("");

  const [form, setForm] = useState<{ transporter_name: string; zone: DeliveryZone | ""; rate_per_carton: string; description: string }>({
    transporter_name: "",
    zone: "",
    rate_per_carton: "",
    description: "",
  });

  const canCreate = hasPermission(userProfile as any, "can_create_delivery_rates");
  const canApprove = hasPermission(userProfile as any, "can_approve_delivery_rates");
  const canDelete = canCreate || canApprove;

  useEffect(() => {
    loadRates();
  }, []);

  const loadRates = async () => {
    setLoading(true);
    try {
      const data = await getDeliveryRates();
      setAllRates(data);
    } catch (error) {
      console.error("Failed to load delivery rates", error);
    } finally {
      setLoading(false);
    }
  };

  // Filter rates by search
  const filteredRates = allRates.filter((rate) =>
    rate.transporter_name.toLowerCase().includes(search.toLowerCase()) ||
    rate.zone.toLowerCase().includes(search.toLowerCase()) ||
    String(rate.rate_per_carton).includes(search) ||
    rate.status.toLowerCase().includes(search.toLowerCase())
  );

  // Sort rates
  const sortedRates = [...filteredRates].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    return sortOrder === "asc" ? comparison : -comparison;
  });

  // Paginate
  const totalPages = Math.ceil(sortedRates.length / itemsPerPage);
  const paginatedRates = sortedRates.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleCreate = async () => {
    if (!form.transporter_name.trim() || !form.zone || !form.rate_per_carton) {
      toast({ title: "Missing Information", description: "Transporter, zone and rate are required.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      await createDeliveryRate({
        transporter_name: form.transporter_name.trim(),
        zone: form.zone as DeliveryZone,
        rate_per_carton: Number(form.rate_per_carton),
        description: form.description || undefined,
      });
      toast({ title: "Success", description: "Delivery rate submitted for approval." });
      setShowCreateModal(false);
      setForm({ transporter_name: "", zone: "", rate_per_carton: "", description: "" });
      loadRates();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to create delivery rate.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (id: string) => {
    setApprovingId(id);
    try {
      await approveDeliveryRate(id, approvalNotes);
      toast({ title: "Success", description: "Delivery rate approved." });
      setViewingRate(null);
      setApprovalNotes("");
      loadRates();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to approve delivery rate.", variant: "destructive" });
    } finally {
      setApprovingId(null);
    }
  };

  const handleReject = async () => {
    if (!showRejectModal) return;
    setRejectingId(showRejectModal);
    try {
      await rejectDeliveryRate(showRejectModal, rejectionNotes);
      toast({ title: "Success", description: "Delivery rate rejected." });
      setShowRejectModal(null);
      setRejectionNotes("");
      loadRates();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to reject delivery rate.", variant: "destructive" });
    } finally {
      setRejectingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteDeliveryRate(id);
      toast({ title: "Success", description: "Delivery rate deleted." });
      setDeletingId(null);
      loadRates();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to delete delivery rate.", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const exportToCSV = () => {
    const headers = ["#", "Transporter", "Zone", "Rate per Carton", "Status", "Created By", "Created At"];
    const rows = sortedRates.map((rate, index) => [
      String(index + 1),
      rate.transporter_name,
      rate.zone,
      `${Number(rate.rate_per_carton).toFixed(2)}`,
      rate.status,
      rate.created_by ? `${rate.created_by.first_name} ${rate.created_by.last_name}` : "",
      new Date(rate.created_at).toLocaleString(),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `delivery-rates-${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Delivery Rates</h3>
          <p className="text-sm text-muted-foreground">
            Per-transporter, per-zone rates used to auto-calculate delivery invoices.
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setShowCreateModal(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Add Rate
          </Button>
        )}
      </div>

      {/* Search and Sorting Controls */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Input
          placeholder="Search by transporter, zone, rate, or status..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setCurrentPage(1);
          }}
          className="flex-1"
        />
        <Select value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="transporter_name">Transporter</SelectItem>
            <SelectItem value="zone">Zone</SelectItem>
            <SelectItem value="rate_per_carton">Rate</SelectItem>
            <SelectItem value="status">Status</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
        >
          {sortOrder === "asc" ? "↑ Asc" : "↓ Desc"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={exportToCSV}
          disabled={filteredRates.length === 0}
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          Download CSV
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredRates.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              {search ? "No rates match your search." : "No delivery rates configured yet."}
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">S/No</TableHead>
                    <TableHead>Transporter</TableHead>
                    <TableHead>Zone</TableHead>
                    <TableHead>Rate/Carton</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created By</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRates.map((rate, index) => (
                    <TableRow key={rate.id}>
                      <TableCell className="font-medium text-muted-foreground">
                        {(currentPage - 1) * itemsPerPage + index + 1}
                      </TableCell>
                      <TableCell className="font-medium">{rate.transporter_name}</TableCell>
                      <TableCell className="capitalize">{rate.zone}</TableCell>
                      <TableCell>KES {Number(rate.rate_per_carton).toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge className={STATUS_STYLES[rate.status] || "bg-gray-100 text-gray-800"}>
                          {rate.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {rate.created_by ? `${rate.created_by.first_name} ${rate.created_by.last_name}` : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setViewingRate(rate)} className="font-semibold">
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            {canDelete && (
                              <DropdownMenuItem onClick={() => setDeletingId(rate.id)} className="text-red-600">
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Showing {Math.min((currentPage - 1) * itemsPerPage + 1, sortedRates.length)}–{Math.min(currentPage * itemsPerPage, sortedRates.length)} of {sortedRates.length}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }).map((_, i) => (
                        <Button
                          key={i + 1}
                          variant={currentPage === i + 1 ? "default" : "outline"}
                          size="sm"
                          className="w-10"
                          onClick={() => setCurrentPage(i + 1)}
                        >
                          {i + 1}
                        </Button>
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* View Modal */}
      <Dialog open={!!viewingRate} onOpenChange={(open) => !open && setViewingRate(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Delivery Rate Details</DialogTitle>
          </DialogHeader>
          {viewingRate && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Transporter</Label>
                  <p className="font-semibold">{viewingRate.transporter_name}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Zone</Label>
                  <p className="font-semibold capitalize">{viewingRate.zone}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Rate per Carton</Label>
                  <p className="font-semibold">KES {Number(viewingRate.rate_per_carton).toLocaleString()}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <Badge className={STATUS_STYLES[viewingRate.status]}>{viewingRate.status}</Badge>
                </div>
              </div>
              {viewingRate.description && (
                <div>
                  <Label className="text-xs text-muted-foreground">Description</Label>
                  <p className="text-sm">{viewingRate.description}</p>
                </div>
              )}
              {viewingRate.approval_notes && (
                <div className="bg-blue-50 border border-blue-200 rounded p-3">
                  <Label className="text-xs text-muted-foreground">Comments</Label>
                  <p className="text-sm mt-1">{viewingRate.approval_notes}</p>
                </div>
              )}
              <div className="border-t pt-4 text-sm text-muted-foreground space-y-1">
                <p>Created: {new Date(viewingRate.created_at).toLocaleString()}</p>
                {viewingRate.approved_at && <p>Approved: {new Date(viewingRate.approved_at).toLocaleString()}</p>}
                {viewingRate.approved_by && (
                  <p>By: {viewingRate.approved_by.first_name} {viewingRate.approved_by.last_name}</p>
                )}
              </div>

              {canApprove && viewingRate.status === "pending" && (
                <div className="border-t pt-4 space-y-4">
                  <div>
                    <Label htmlFor="approval_notes" className="text-xs text-muted-foreground">Comments (optional)</Label>
                    <Textarea
                      id="approval_notes"
                      placeholder="Add notes about this rate..."
                      rows={2}
                      value={approvalNotes}
                      onChange={(e) => setApprovalNotes(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleApprove(viewingRate.id)}
                      disabled={approvingId !== null}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      {approvingId === viewingRate.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Approve
                    </Button>
                    <Button
                      onClick={() => setShowRejectModal(viewingRate.id)}
                      disabled={approvingId !== null}
                      variant="destructive"
                      className="flex-1"
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingRate(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Rate Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Add Delivery Rate</DialogTitle>
            <DialogDescription>This will be sent to the GM/Director for approval before it can be used.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="transporter_name">Transporter Name</Label>
              <Input
                id="transporter_name"
                placeholder="e.g. FedEx, DHL"
                value={form.transporter_name}
                onChange={(e) => setForm({ ...form, transporter_name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="zone">Zone</Label>
              <Select value={form.zone} onValueChange={(value) => setForm({ ...form, zone: value as DeliveryZone })}>
                <SelectTrigger id="zone">
                  <SelectValue placeholder="Select zone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nairobi">Nairobi</SelectItem>
                  <SelectItem value="upcountry">Upcountry</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="rate_per_carton">Rate per Carton (KES)</Label>
              <Input
                id="rate_per_carton"
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 300"
                value={form.rate_per_carton}
                onChange={(e) => setForm({ ...form, rate_per_carton: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                placeholder="Additional notes about this rate..."
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit for Approval
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Modal */}
      <Dialog open={!!showRejectModal} onOpenChange={(open) => !open && setShowRejectModal(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Reject Delivery Rate</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="rejection_notes">Reason (optional)</Label>
            <Textarea
              id="rejection_notes"
              rows={3}
              value={rejectionNotes}
              onChange={(e) => setRejectionNotes(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectModal(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={!!rejectingId}>
              {rejectingId && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={!!deletingId && deletingId !== "confirm"} onOpenChange={(open) => !open && setDeletingId(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete Delivery Rate</DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => {
              const rateId = deletingId;
              setDeletingId(null);
              if (rateId && rateId !== "confirm") handleDelete(rateId);
            }}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
