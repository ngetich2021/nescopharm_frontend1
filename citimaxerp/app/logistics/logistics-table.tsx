"use client"

import { useState, useEffect, useCallback } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  MoreHorizontal,
  Search,
  TruckIcon,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Loader2,
  Eye,
  Upload,
  File,
  Download,
  CheckCircle2,
  RotateCcw,
} from "lucide-react"
import { getLogisticsPaginated, updateLogistics, uploadDeliveryNote, reviewDeliveryNote, type Logistics } from "@/lib/logistics"
import { format } from "date-fns"
import { useToast } from "@/hooks/use-toast"
import { usePermissions } from "@/hooks/use-permissions"

function reviewerName(entry: Logistics) {
  const r = entry.delivery_note_reviewed_by
  if (!r || typeof r === "string") return null
  return [r.first_name, r.last_name].filter(Boolean).join(" ") || null
}

function DeliveryNoteCell({ entry }: { entry: Logistics }) {
  if (!entry.delivery_note_file) {
    return <Badge className="bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-100">No</Badge>
  }
  const status = entry.delivery_note_status
  return (
    <div className="flex items-center gap-2">
      <Badge className="bg-green-100 text-green-800 border-green-500 hover:bg-green-100">Yes</Badge>
      {entry.delivery_note_url && (
        <a
          href={entry.delivery_note_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-muted-foreground hover:text-primary"
          title="Download delivery note"
        >
          <Download className="h-4 w-4" />
        </a>
      )}
      {status === "approved" && <span className="text-xs font-medium text-green-700">Approved</span>}
      {status === "pending_review" && <span className="text-xs font-medium text-amber-700">Awaiting review</span>}
      {status === "resubmit_requested" && <span className="text-xs font-medium text-red-700">Resubmit</span>}
    </div>
  )
}

function getStatusBadge(status: string) {
  const s = (status || "").toLowerCase()
  if (s.includes("deliver")) return <Badge className="bg-green-100 text-green-800 border-green-500 hover:bg-green-100">{capitalize(status)}</Badge>
  if (s.includes("transit")) return <Badge className="bg-blue-100 text-blue-800 border-blue-500 hover:bg-blue-100">{capitalize(status)}</Badge>
  if (s.includes("dispatch")) return <Badge className="bg-indigo-100 text-indigo-800 border-indigo-500 hover:bg-indigo-100">{capitalize(status)}</Badge>
  if (s.includes("pending")) return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-500 hover:bg-yellow-100">{capitalize(status)}</Badge>
  if (s.includes("fail") || s.includes("cancel")) return <Badge className="bg-red-100 text-red-800 border-red-500 hover:bg-red-100">{capitalize(status)}</Badge>
  if (s.includes("return")) return <Badge className="bg-purple-100 text-purple-800 border-purple-500 hover:bg-purple-100">{capitalize(status)}</Badge>
  return <Badge className="bg-gray-100 text-gray-800 border-gray-500 hover:bg-gray-100">{capitalize(status)}</Badge>
}

function capitalize(str: string) {
  return (str || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatDate(dateString: string | null) {
  if (!dateString) return "—"
  try {
    return format(new Date(dateString), "MMM dd, yyyy HH:mm")
  } catch {
    return dateString
  }
}

export function LogisticsTable() {
  const { toast } = useToast()

  // Data
  const [logistics, setLogistics] = useState<Logistics[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [totalItems, setTotalItems] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  // Filters
  const [search, setSearch] = useState("")
  const [searchDebounced, setSearchDebounced] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)

  // Update dialog
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false)
  const [updateEntry, setUpdateEntry] = useState<Logistics | null>(null)
  const [updateStatus, setUpdateStatus] = useState("")
  const [updateNotes, setUpdateNotes] = useState("")
  const [updating, setUpdating] = useState(false)

  // View details dialog
  const [viewDetailsOpen, setViewDetailsOpen] = useState(false)
  const [viewingEntry, setViewingEntry] = useState<Logistics | null>(null)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const [resubmitComment, setResubmitComment] = useState("")
  const [showResubmitForm, setShowResubmitForm] = useState(false)

  const { userProfile, isCompanyAdmin, isSystemAdmin } = usePermissions()
  const roleName = ((userProfile as any)?.role?.name || "").toLowerCase()
  const canReviewDeliveryNote = roleName === "gm" || roleName === "director" || isCompanyAdmin() || isSystemAdmin()

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else if (logistics.length === 0) setLoading(true)
    else setRefreshing(true)
    try {
      const res = await getLogisticsPaginated({
        status: statusFilter !== "all" ? statusFilter : undefined,
        search: searchDebounced || undefined,
        page: currentPage,
        per_page: rowsPerPage,
      })
      setLogistics(res.data)
      setTotalItems(res.meta.total)
      setTotalPages(res.meta.last_page)
    } catch {
      if (!isRefresh) setLogistics([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [statusFilter, searchDebounced, currentPage, rowsPerPage])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchDebounced(search)
      setCurrentPage(1)
    }, 400)
    return () => clearTimeout(timer)
  }, [search])

  const paginatedLogistics = logistics

  const handleSearchChange = (value: string) => {
    setSearch(value)
  }

  const openUpdateDialog = (entry: Logistics) => {
    setUpdateEntry(entry)
    setUpdateStatus(entry.delivery_status || "pending")
    setUpdateNotes((entry as any).notes || "")
    setUpdateDialogOpen(true)
  }

  const openViewDetails = (entry: Logistics) => {
    setViewingEntry(entry)
    setShowResubmitForm(false)
    setResubmitComment("")
    setViewDetailsOpen(true)
  }

  const handleReview = async (action: "approve" | "resubmit") => {
    if (!viewingEntry) return
    if (action === "resubmit" && !resubmitComment.trim()) {
      toast({ title: "Reason required", description: "Say what is wrong with the uploaded note so the right one can be uploaded.", variant: "destructive" })
      return
    }
    setReviewing(true)
    try {
      const updated = await reviewDeliveryNote(viewingEntry.id, action, action === "resubmit" ? resubmitComment.trim() : undefined)
      toast({
        title: "Success",
        description: action === "approve" ? "Delivery note approved." : "Resubmission requested.",
      })
      setViewingEntry({ ...viewingEntry, ...updated })
      setShowResubmitForm(false)
      setResubmitComment("")
      fetchData(true)
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed to review delivery note.", variant: "destructive" })
    } finally {
      setReviewing(false)
    }
  }

  const handleFileUpload = async (file: File) => {
    if (!viewingEntry) return
    setUploadingFile(true)
    try {
      await uploadDeliveryNote(viewingEntry.id, file)
      toast({ title: "Success", description: "Delivery note uploaded successfully." })
      // Refresh the data
      fetchData(true)
      setViewDetailsOpen(false)
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed to upload file.", variant: "destructive" })
    } finally {
      setUploadingFile(false)
    }
  }

  const handleUpdateStatus = async () => {
    if (!updateEntry) return
    setUpdating(true)
    try {
      const data: any = {
        delivery_status: updateStatus,
        notes: updateNotes || undefined,
      }
      if (updateStatus === "delivered") {
        data.actual_delivery_time = new Date().toISOString()
        data.update_order_status = true
      }
      await updateLogistics(updateEntry.id, data)
      toast({ title: "Success", description: `Status updated to ${capitalize(updateStatus)}.` })
      setUpdateDialogOpen(false)
      fetchData(true)
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed to update status.", variant: "destructive" })
    } finally {
      setUpdating(false)
    }
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-auto">
            <Input
              className="pl-8 w-full sm:max-w-sm"
              placeholder="Search by name, tracking #, destination..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1) }}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="dispatched">Dispatched</SelectItem>
              <SelectItem value="in_transit">In Transit</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="returned">Returned</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchData(true)} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Table */}
      <div className={`rounded-md border transition-opacity duration-200 ${refreshing ? "opacity-50 pointer-events-none" : ""}`}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Dispatch #</TableHead>
              <TableHead>Recipient</TableHead>
              <TableHead>Driver</TableHead>
              <TableHead>Tracking #</TableHead>
              <TableHead>Destination</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Delivery Note</TableHead>
              <TableHead>Dispatched</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Loading logistics...
                  </div>
                </TableCell>
              </TableRow>
            ) : paginatedLogistics.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center">
                  <div className="text-muted-foreground">
                    <TruckIcon className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p className="font-medium">No logistics found</p>
                    <p className="text-sm">
                      {search || statusFilter !== "all"
                        ? "Try adjusting your search or filter."
                        : "Logistics entries will appear here when dispatches are created."}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedLogistics.map((entry) => {
                const isDelivered = (entry.delivery_status || "").toLowerCase().includes("deliver")
                const needsResubmit = entry.delivery_note_status === "resubmit_requested"
                const isUnconfirmed = isDelivered && (!entry.delivery_note_file || needsResubmit)
                return (
                <TableRow
                  key={entry.id}
                  onClick={() => openViewDetails(entry)}
                  className={`cursor-pointer ${isUnconfirmed ? "bg-red-50 hover:bg-red-100" : "hover:bg-gray-50"}`}
                  title={
                    needsResubmit
                      ? "The uploaded delivery note was rejected - upload the correct one"
                      : isUnconfirmed
                        ? "Delivered but no stamped delivery note has been uploaded yet"
                        : undefined
                  }
                >
                  <TableCell className="font-semibold text-primary">
                    {entry.order?.order_number || entry.order_dispatch?.dispatch_number || "—"}
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{entry.recipient_name || "N/A"}</div>
                      <div className="text-sm text-muted-foreground">{entry.recipient_phone || ""}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">
                        {(entry.delivery_person as any)?.full_name || (entry.delivery_person as any)?.name || entry.driver_name || "—"}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {(entry.delivery_person as any)?.phone_number || (entry.delivery_person as any)?.phone || entry.vehicle_registration || ""}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{entry.tracking_number || "—"}</TableCell>
                  <TableCell className="max-w-[200px] truncate" title={entry.delivery_location || ""}>
                    {entry.delivery_location || "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(entry.delivery_status)}
                      {isUnconfirmed && (
                        <span className="text-xs font-medium text-red-700">Unconfirmed</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <DeliveryNoteCell entry={entry} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(entry.dispatch_time)}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openViewDetails(entry) }}>
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                        {canReviewDeliveryNote && entry.delivery_note_status === "pending_review" && (
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openViewDetails(entry) }}>
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Review Delivery Note
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openUpdateDialog(entry) }}>
                          Update Status
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )})
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <p className="text-sm font-medium">Rows per page</p>
          <Select
            value={rowsPerPage.toString()}
            onValueChange={(value) => { setRowsPerPage(Number(value)); setCurrentPage(1) }}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent side="top">
              {[5, 10, 20, 30, 40, 50].map((size) => (
                <SelectItem key={size} value={size.toString()}>{size}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            {totalItems > 0
              ? `Showing ${(currentPage - 1) * rowsPerPage + 1}–${Math.min(currentPage * rowsPerPage, totalItems)} of ${totalItems}`
              : "No results"}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <div className="text-sm font-medium">
            Page {currentPage} of {totalPages || 1}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages || 1))}
            disabled={currentPage >= totalPages}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* View Details Dialog */}
      <Dialog open={viewDetailsOpen} onOpenChange={setViewDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Dispatch Details</DialogTitle>
            <DialogDescription>
              {viewingEntry && (
                <span>
                  {viewingEntry.order?.order_number || viewingEntry.order_dispatch?.dispatch_number || "Logistics Entry"}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {viewingEntry && (
            <div className="space-y-6 py-4">
              {/* Recipient Information */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Recipient Name</Label>
                  <p className="font-medium">{viewingEntry.recipient_name || "—"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Recipient Phone</Label>
                  <p className="font-medium">{viewingEntry.recipient_phone || "—"}</p>
                </div>
              </div>

              {/* Delivery Address */}
              <div className="space-y-2 border-t pt-4">
                <Label className="text-sm font-semibold">Delivery Address</Label>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Street Address</p>
                    <p>{viewingEntry.delivery_address || "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Destination</p>
                    <p>{viewingEntry.delivery_location || "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">City</p>
                    <p>{viewingEntry.city || "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Region</p>
                    <p>{viewingEntry.region || "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">State/County</p>
                    <p>{viewingEntry.state || "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Country</p>
                    <p>{viewingEntry.country || "—"}</p>
                  </div>
                </div>
              </div>

              {/* Driver & Vehicle */}
              <div className="grid grid-cols-2 gap-4 border-t pt-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Driver Name</Label>
                  <p className="font-medium">
                    {(viewingEntry.delivery_person as any)?.full_name || (viewingEntry.delivery_person as any)?.name || viewingEntry.driver_name || "—"}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Driver Phone</Label>
                  <p className="font-medium">
                    {(viewingEntry.delivery_person as any)?.phone_number || (viewingEntry.delivery_person as any)?.phone || "—"}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Vehicle Type</Label>
                  <p className="font-medium">{viewingEntry.vehicle_type || "—"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Vehicle ID</Label>
                  <p className="font-medium">{viewingEntry.vehicle_id || "—"}</p>
                </div>
              </div>

              {/* Tracking & Status */}
              <div className="grid grid-cols-2 gap-4 border-t pt-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Tracking Number</Label>
                  <p className="font-medium">{viewingEntry.tracking_number || "—"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <div className="mt-1">{getStatusBadge(viewingEntry.delivery_status)}</div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Dispatched</Label>
                  <p className="font-medium">{formatDate(viewingEntry.dispatch_time)}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Estimated Delivery</Label>
                  <p className="font-medium">{formatDate(viewingEntry.estimated_delivery_time)}</p>
                </div>
              </div>

              {/* Delivery Cost */}
              <div className="grid grid-cols-2 gap-4 border-t pt-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Delivery Cost</Label>
                  <p className="font-medium">{viewingEntry.delivery_cost ? `KES ${Number(viewingEntry.delivery_cost).toLocaleString()}` : "—"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Amount Paid</Label>
                  <p className="font-medium">{viewingEntry.amount_paid ? `KES ${Number(viewingEntry.amount_paid).toLocaleString()}` : "—"}</p>
                </div>
              </div>

              {/* Notes */}
              {viewingEntry.notes && (
                <div className="border-t pt-4">
                  <Label className="text-sm font-semibold">Notes</Label>
                  <p className="text-sm mt-2 p-3 bg-muted rounded">{viewingEntry.notes}</p>
                </div>
              )}

              {/* Delivery Note Upload */}
              <div className="border-t pt-4">
                <Label className="text-sm font-semibold mb-3 block">Stamped Delivery Note (Proof of Receipt)</Label>
                <div className="border-2 border-dashed rounded-lg p-6 text-center">
                  {viewingEntry.delivery_note_file && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-center gap-2 text-green-600">
                        <File className="h-5 w-5" />
                        <span className="font-medium">Stamped Delivery Note Uploaded</span>
                      </div>
                      {viewingEntry.delivery_note_uploaded_at && (
                        <p className="text-xs text-muted-foreground">Uploaded {formatDate(viewingEntry.delivery_note_uploaded_at)}</p>
                      )}
                      {viewingEntry.delivery_note_url && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={viewingEntry.delivery_note_url} target="_blank" rel="noopener noreferrer" download>
                            <Download className="mr-2 h-4 w-4" />
                            Download Delivery Note
                          </a>
                        </Button>
                      )}

                      {viewingEntry.delivery_note_status === "approved" && (
                        <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-800">
                          <CheckCircle2 className="inline h-4 w-4 mr-1" />
                          Approved{reviewerName(viewingEntry) ? ` by ${reviewerName(viewingEntry)}` : ""}
                          {viewingEntry.delivery_note_reviewed_at ? ` on ${formatDate(viewingEntry.delivery_note_reviewed_at)}` : ""}
                        </div>
                      )}

                      {viewingEntry.delivery_note_status === "resubmit_requested" && (
                        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800 text-left">
                          <p className="font-medium">
                            Resubmission requested{reviewerName(viewingEntry) ? ` by ${reviewerName(viewingEntry)}` : ""}
                          </p>
                          {viewingEntry.delivery_note_review_comment && (
                            <p className="mt-1">Reason: {viewingEntry.delivery_note_review_comment}</p>
                          )}
                        </div>
                      )}

                      {viewingEntry.delivery_note_status === "pending_review" && (
                        canReviewDeliveryNote ? (
                          <div className="space-y-3 pt-2 border-t text-left">
                            <p className="text-sm font-medium text-center">Confirm this is the correct stamped delivery note</p>
                            {showResubmitForm ? (
                              <div className="space-y-2">
                                <Label className="text-xs">What is wrong with it?</Label>
                                <Textarea
                                  value={resubmitComment}
                                  onChange={(e) => setResubmitComment(e.target.value)}
                                  placeholder="e.g. Not stamped, wrong dispatch, unreadable photo..."
                                  rows={2}
                                />
                                <div className="flex justify-center gap-2">
                                  <Button variant="outline" size="sm" onClick={() => setShowResubmitForm(false)} disabled={reviewing}>
                                    Cancel
                                  </Button>
                                  <Button variant="destructive" size="sm" onClick={() => handleReview("resubmit")} disabled={reviewing}>
                                    {reviewing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
                                    Request Resubmit
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex justify-center gap-2">
                                <Button variant="outline" size="sm" onClick={() => setShowResubmitForm(true)} disabled={reviewing}>
                                  <RotateCcw className="mr-2 h-4 w-4" />
                                  Resubmit
                                </Button>
                                <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleReview("approve")} disabled={reviewing}>
                                  {reviewing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                                  Approve
                                </Button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-amber-700">Awaiting confirmation by the GM or Director.</p>
                        )
                      )}
                    </div>
                  )}

                  {(!viewingEntry.delivery_note_file || viewingEntry.delivery_note_status === "resubmit_requested") && (
                    <div className={`space-y-3 ${viewingEntry.delivery_note_file ? "mt-4 pt-4 border-t" : ""}`}>
                      {!viewingEntry.delivery_note_file && (
                        <div className="flex items-center justify-center gap-2 text-amber-600">
                          <File className="h-5 w-5" />
                          <span>No stamped delivery note uploaded yet</span>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {viewingEntry.delivery_note_file
                          ? "Upload the correct stamped delivery note to replace the rejected one."
                          : "Upload a photo of the delivery note once the client has stamped or signed it, to confirm the order was received."}
                      </p>
                      <input
                        type="file"
                        id="delivery-note-upload"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            handleFileUpload(e.target.files[0])
                          }
                        }}
                        disabled={uploadingFile}
                        className="hidden"
                      />
                      <label htmlFor="delivery-note-upload">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={uploadingFile}
                          asChild
                          className="mt-2 cursor-pointer"
                        >
                          <span>
                            <Upload className="mr-2 h-4 w-4" />
                            {uploadingFile ? "Uploading..." : viewingEntry.delivery_note_file ? "Upload Correct Delivery Note" : "Upload Delivery Note"}
                          </span>
                        </Button>
                      </label>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDetailsOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Status Dialog */}
      <Dialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Update Delivery Status</DialogTitle>
            <DialogDescription>
              {updateEntry && (
                <span>
                  {updateEntry.order?.order_number || updateEntry.order_dispatch?.dispatch_number || "Logistics Entry"} — {updateEntry.recipient_name || "N/A"}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={updateStatus} onValueChange={setUpdateStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="dispatched">Dispatched</SelectItem>
                  <SelectItem value="in_transit">In Transit</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="returned">Returned</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                value={updateNotes}
                onChange={(e) => setUpdateNotes(e.target.value)}
                placeholder="Add delivery notes..."
                rows={3}
              />
            </div>
            {updateStatus === "delivered" && (
              <p className="text-xs text-muted-foreground">
                Marking as delivered will set the delivery time to now and update the associated order status.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpdateDialogOpen(false)} disabled={updating}>
              Cancel
            </Button>
            <Button onClick={handleUpdateStatus} disabled={updating}>
              {updating ? "Updating..." : "Update Status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
