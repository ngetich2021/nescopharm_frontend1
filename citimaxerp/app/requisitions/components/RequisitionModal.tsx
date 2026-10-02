"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  ClipboardList,
  User,
  Calendar,
  Package,
  FileText,
  Building2,
  CheckCircle,
  XCircle,
  Edit,
  Trash2,
  Loader2,
} from "lucide-react";
import { type Requisition, downloadOfficialPurpose } from "@/lib/requisitions";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { EditRequisitionModal } from "./EditRequisitionModal";
import { DeleteRequisitionConfirmationDialog } from "./DeleteRequisitionConfirmationDialog";
import { ApproveRequisitionModal } from "./ApproveRequisitionModal";

interface RequisitionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requisition: Requisition | null;
  onClose: () => void;
  onRefresh?: () => void;
  onDeleteRequisition?: (requisition: Requisition) => void;
  onCreateDispatch?: (requisition: Requisition) => void;
}

export function RequisitionModal({
  open,
  onOpenChange,
  requisition: initialRequisition,
  onClose,
  onRefresh,
  onDeleteRequisition,
  onCreateDispatch,
}: RequisitionModalProps) {
  const [currentRequisition, setCurrentRequisition] = useState<Requisition | null>(initialRequisition);
  const [loading, setLoading] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [downloadingSamples, setDownloadingSamples] = useState(false);
  const [downloadingOffice, setDownloadingOffice] = useState(false);
  const { toast } = useToast();
  const { hasPermission } = useAuth();

  useEffect(() => {
    setCurrentRequisition(initialRequisition);
  }, [initialRequisition]);

  const handleEditSuccess = () => {
    if (onRefresh) {
      onRefresh();
    }
    setEditModalOpen(false);
  };

  const handleDeleteSuccess = () => {
    if (onRefresh) {
      onRefresh();
    }
    setDeleteModalOpen(false);
    onOpenChange(false); // Close the main modal after deletion
  };

  const handleApproveSuccess = () => {
    if (onRefresh) {
      onRefresh();
    }
    setApproveModalOpen(false);
    // Keep the main modal open to show updated status
  };

  const handleRejectSuccess = () => {
    if (onRefresh) {
      onRefresh();
    }
    setRejectModalOpen(false);
    // Keep the main modal open to show updated status
  };

  const saveBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleDownloadOfficialPurpose = async (type: "stock" | "custom") => {
    if (!currentRequisition) return;
    const setDownloading = type === "stock" ? setDownloadingSamples : setDownloadingOffice;
    const filePrefix = type === "stock" ? "samples-requisition" : "office-maintenance-requisition";
    setDownloading(true);
    try {
      const blob = await downloadOfficialPurpose(currentRequisition.id, type);
      saveBlob(blob, `${filePrefix}-${currentRequisition.requisition_number}.pdf`);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to download requisition document.",
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  };

  const canEdit = currentRequisition?.status === "pending" && currentRequisition?.approval_status === "pending" && hasPermission("can_update_requisitions");
  const canDelete = currentRequisition?.status === "pending" && currentRequisition?.approval_status === "pending" && hasPermission("can_delete_requisitions");
  const canApprove = currentRequisition?.approval_status === "pending" && hasPermission("can_approve_requisitions");
  const canCreateDispatch = currentRequisition?.approval_status === "approved" && !currentRequisition?.dispatch_id;
  const hasStockItems = !!currentRequisition?.items?.some((item) => !!item.product_id);
  const hasCustomItems = !!currentRequisition?.items?.some((item) => !item.product_id);
  const canDownloadOfficial = currentRequisition?.approval_status === "approved";

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "pending":
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case "approved":
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Approved</Badge>;
      case "rejected":
        return <Badge variant="secondary" className="bg-red-100 text-red-800">Rejected</Badge>;
      case "fulfilled":
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Fulfilled</Badge>;
      case "dispatched":
        return <Badge variant="secondary" className="bg-purple-100 text-purple-800">Dispatched</Badge>;
      case "cancelled":
        return <Badge variant="secondary" className="bg-gray-100 text-gray-800">Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getApprovalStatusBadge = (approvalStatus: string) => {
    switch (approvalStatus.toLowerCase()) {
      case "pending":
        return <Badge variant="outline" className="border-yellow-500 text-yellow-700">Pending Approval</Badge>;
      case "approved":
        return <Badge variant="outline" className="border-green-500 text-green-700">Approved</Badge>;
      case "rejected":
        return <Badge variant="outline" className="border-red-500 text-red-700">Rejected</Badge>;
      default:
        return <Badge variant="outline">{approvalStatus}</Badge>;
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg md:max-w-xl lg:max-w-2xl flex flex-col h-full">
        <SheetHeader className="flex-shrink-0">
          <SheetTitle>Requisition Details</SheetTitle>
          <SheetDescription>
            {currentRequisition ? `Requisition ${currentRequisition.requisition_number}` : "View requisition details"}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-6">

          {currentRequisition ? (
            <>
              {/* Requisition Header */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <ClipboardList className="h-5 w-5" />
                      <span>{currentRequisition.requisition_number}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getStatusBadge(currentRequisition.status)}
                      {getApprovalStatusBadge(currentRequisition.approval_status)}
                    </div>
                  </CardTitle>
                  <CardDescription>
                    Created on {format(new Date(currentRequisition.created_at), "MMMM dd, yyyy 'at' HH:mm")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Requester Information */}
                    <div className="space-y-2">
                      <h4 className="font-semibold flex items-center space-x-2">
                        <User className="h-4 w-4" />
                        <span>Requester</span>
                      </h4>
                      <div className="flex items-center space-x-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary/10 text-primary text-sm">
                            {currentRequisition.requester.first_name[0]}
                            {currentRequisition.requester.last_name[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">
                            {currentRequisition.requester.first_name} {currentRequisition.requester.last_name}
                          </p>
                          <p className="text-sm text-gray-500">{currentRequisition.requester.email}</p>
                        </div>
                      </div>
                    </div>

                    {/* Approval Information */}
                    {currentRequisition.approver && (
                      <div className="space-y-2">
                        <h4 className="font-semibold flex items-center space-x-2">
                          <CheckCircle className="h-4 w-4" />
                          <span>Approver</span>
                        </h4>
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-green-100 text-green-800 text-sm">
                              {currentRequisition.approver.first_name[0]}
                              {currentRequisition.approver.last_name[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">
                              {currentRequisition.approver.first_name} {currentRequisition.approver.last_name}
                            </p>
                            <p className="text-sm text-gray-500">{currentRequisition.approver.email}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  {currentRequisition.notes && (
                    <div className="space-y-2">
                      <h4 className="font-semibold flex items-center space-x-2">
                        <FileText className="h-4 w-4" />
                        <span>Notes</span>
                      </h4>
                      <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-md">
                        {currentRequisition.notes}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Requisition Items */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Package className="h-5 w-5" />
                    <span>Requisition Items</span>
                  </CardTitle>
                  <CardDescription>
                    {currentRequisition.items?.length || 0} products in this requisition
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {currentRequisition.items && currentRequisition.items.length > 0 ? (
                    <div className="space-y-4">
                      {currentRequisition.items.map((item, index) => (
                        <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3">
                              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                                <Package className="h-6 w-6 text-gray-500" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-medium">{item.product?.name || item.custom_item_name}</h4>
                                  {!item.product && (
                                    <Badge variant="secondary" className="text-xs">Custom item</Badge>
                                  )}
                                </div>
                                <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
                                  {item.product && <span>SKU: {item.product.sku}</span>}
                                  {item.variant && <span>Variant: {item.variant.name}</span>}
                                  {item.product && <span>Category: {item.product.category}</span>}
                                </div>
                                {item.notes && (
                                  <p className="text-sm text-gray-600 mt-1">{item.notes}</p>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold">Qty: {item.quantity}</div>
                            <div className="text-sm text-gray-500">
                              {item.product?.unit_of_measurement}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>No items in this requisition</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <ClipboardList className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No requisition selected</p>
            </div>
          )}
        </div>

        {/* Footer with Action Buttons */}
        <SheetFooter className="flex-shrink-0 border-t pt-4 mt-auto">
          <div className="flex justify-between w-full">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <div className="flex space-x-2">
              {canDownloadOfficial && hasStockItems && (
                <Button
                  variant="outline"
                  onClick={() => handleDownloadOfficialPurpose("stock")}
                  disabled={downloadingSamples}
                >
                  {downloadingSamples ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4 mr-1" />
                  )}
                  Samples Requisition
                </Button>
              )}
              {canDownloadOfficial && hasCustomItems && (
                <Button
                  variant="outline"
                  onClick={() => handleDownloadOfficialPurpose("custom")}
                  disabled={downloadingOffice}
                >
                  {downloadingOffice ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4 mr-1" />
                  )}
                  Office Maintenance Requisition
                </Button>
              )}
              {canCreateDispatch && (
                <Button
                  onClick={() => {
                    if (onCreateDispatch && currentRequisition) {
                      onCreateDispatch(currentRequisition);
                    }
                  }}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Package className="h-4 w-4 mr-1" />
                  Create Dispatch
                </Button>
              )}
              {canApprove && (
                <Button
                  variant="outline"
                  onClick={() => setRejectModalOpen(true)}
                  className="border-red-500 text-red-600 hover:bg-red-50"
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Reject
                </Button>
              )}
              {canApprove && (
                <Button
                  onClick={() => setApproveModalOpen(true)}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Approve
                </Button>
              )}
              {canEdit && (
                <Button
                  onClick={() => setEditModalOpen(true)}
                  className="bg-primary hover:bg-primary/90"
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              )}
              {canDelete && (
                <Button
                  variant="destructive"
                  onClick={() => setDeleteModalOpen(true)}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              )}
            </div>
          </div>
        </SheetFooter>

        {/* Edit Modal */}
        <EditRequisitionModal
          open={editModalOpen}
          onOpenChange={setEditModalOpen}
          onSuccess={handleEditSuccess}
          requisition={currentRequisition}
        />

        {/* Delete Modal */}
        <DeleteRequisitionConfirmationDialog
          open={deleteModalOpen}
          onOpenChange={setDeleteModalOpen}
          onSuccess={handleDeleteSuccess}
          requisition={currentRequisition}
        />

        {/* Approve Modal */}
        <ApproveRequisitionModal
          open={approveModalOpen}
          onOpenChange={setApproveModalOpen}
          onSuccess={handleApproveSuccess}
          requisition={currentRequisition}
          mode="approve"
        />

        {/* Reject Modal */}
        <ApproveRequisitionModal
          open={rejectModalOpen}
          onOpenChange={setRejectModalOpen}
          onSuccess={handleRejectSuccess}
          requisition={currentRequisition}
          mode="reject"
        />
      </SheetContent>
    </Sheet>
  );
}