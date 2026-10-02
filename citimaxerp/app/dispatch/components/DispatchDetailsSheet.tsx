"use client";

import { useState, useEffect } from "react";
import {
  type OrderDispatch,
  approveDispatch,
  rejectDispatch,
  canApproveDispatch,
  submitDispatchForApproval,
  canSubmitDispatch,
  canMarkDelivered,
  type ApproveDispatchRequest,
  type RejectDispatchRequest
} from "@/lib/order-dispatches";
import { usePermissions } from "@/hooks/use-permissions";
import { getCustomerDisplayName } from "@/lib/customers";
import { CreateLogisticsModal } from "./CreateDispatchModal";
import { MarkDeliveredModal } from "./MarkDeliveredModal";
import { getDeliveryNotes, DeliveryNote } from "@/lib/delivery-notes";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetClose
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  X,
  Package,
  User,
  Calendar,
  FileText,
  MapPin,
  Truck,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Ban,
  AlertTriangle,
  Loader2,
  Send,
  Eye,
  Download
} from "lucide-react";
import { format } from "date-fns";
import { cn, toSentenceCase } from "@/lib/utils";
import { VisuallyHidden } from "@/components/ui/visually-hidden";

interface DispatchDetailsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dispatch: OrderDispatch | null;
  onClose: () => void;
  onRefresh?: () => void;
  currentUserId?: string; // To check if user can approve
}

export function DispatchDetailsSheet({ 
  open, 
  onOpenChange, 
  dispatch, 
  onClose, 
  onRefresh,
  currentUserId
}: DispatchDetailsSheetProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [approveComments, setApproveComments] = useState("");
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
  const [markDeliveredModalOpen, setMarkDeliveredModalOpen] = useState(false);

  const { isSystemAdmin, isCompanyAdmin, hasPermission } = usePermissions();
  
  const [localDispatch, setLocalDispatch] = useState<OrderDispatch | null>(dispatch);
  const [deliveryNote, setDeliveryNote] = useState<DeliveryNote | null>(null);

  useEffect(() => {
    setLocalDispatch(dispatch);
  }, [dispatch]);

  useEffect(() => {
    if (!dispatch?.id) {
      setDeliveryNote(null);
      return;
    }
    getDeliveryNotes(dispatch.id)
      .then((notes) => setDeliveryNote(notes[0] || null))
      .catch(() => setDeliveryNote(null));
  }, [dispatch?.id]);

  if (!localDispatch) return null;

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const result = await submitDispatchForApproval(localDispatch!.id);
      if (result && result.data) {
        // Merge the response with existing data to preserve relationships like items.product
        setLocalDispatch(prev => ({
          ...prev!,
          ...result.data,
          items: result.data.items?.length && result.data.items[0]?.product 
            ? result.data.items 
            : prev!.items, // Keep existing items if response doesn't have populated products
        }));
      }
      toast({
        title: "Success",
        description: "Dispatch submitted for approval",
      });
      setSubmitDialogOpen(false);
      onRefresh?.();
    } catch (error) {
      console.error("Error submitting dispatch:", error);
      toast({
        title: "Error",
        description: "Failed to submit dispatch",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    setLoading(true);
    try {
      const result = await approveDispatch(localDispatch!.id, { comments: approveComments });
      if (result && result.data) {
        // Merge the response with existing data to preserve relationships
        setLocalDispatch(prev => ({
          ...prev!,
          ...result.data,
          items: result.data.items?.length && result.data.items[0]?.product 
            ? result.data.items 
            : prev!.items,
        }));
      }
      toast({
        title: "Success",
        description: "Dispatch approved successfully",
      });
      setApproveDialogOpen(false);
      onRefresh?.();
    } catch (error) {
      console.error("Error approving dispatch:", error);
      toast({
        title: "Error",
        description: "Failed to approve dispatch",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast({
        title: "Error",
        description: "Rejection reason is required",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const result = await rejectDispatch(localDispatch!.id, { reason: rejectReason });
      if (result && result.data) {
        // Merge the response with existing data to preserve relationships
        setLocalDispatch(prev => ({
          ...prev!,
          ...result.data,
          items: result.data.items?.length && result.data.items[0]?.product 
            ? result.data.items 
            : prev!.items,
        }));
      }
      toast({
        title: "Success",
        description: "Dispatch rejected successfully",
      });
      setRejectDialogOpen(false);
      onRefresh?.();
    } catch (error) {
      console.error("Error rejecting dispatch:", error);
      toast({
        title: "Error",
        description: "Failed to reject dispatch",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      "pending": "bg-yellow-100 text-yellow-800",
      "draft": "bg-gray-100 text-gray-800",
      "approved": "bg-green-100 text-green-800",
      "rejected": "bg-red-100 text-red-800",
      "in_transit": "bg-purple-100 text-purple-800",
      "delivered": "bg-green-100 text-green-800",
      "cancelled": "bg-red-100 text-red-800",
    };
    
    return (
      <Badge className={variants[status] || "bg-gray-100 text-gray-800"}>
        {toSentenceCase(status)}
      </Badge>
    );
  };
  
  const getApprovalBadge = (status: string) => {
    const variants: Record<string, string> = {
      "pending": "text-yellow-600 border-yellow-200",
      "approved": "text-green-600 border-green-200",
      "rejected": "text-red-600 border-red-200",
      "draft": "text-gray-600 border-gray-200",
      "in_progress": "text-blue-600 border-blue-200",
    };

    return (
      <Badge variant="outline" className={cn("capitalize", variants[status] || "text-gray-600 border-gray-200")}>
        {toSentenceCase(status)}
      </Badge>
    );
  };

  // Determine if the current user can approve using centralized logic
  const isApprover = currentUserId ? canApproveDispatch(localDispatch, currentUserId) : false;
  
  // Admins or users with specific permission can also approve if status is pending/in_progress
  const hasAdminPrivileges = isSystemAdmin() || isCompanyAdmin() || hasPermission('can_approve_dispatch');
  const canApprove = (isApprover || hasAdminPrivileges) && (localDispatch.approval_status === 'pending' || localDispatch.approval_status === 'in_progress');

  // Can submit if draft and has items/approvers
  const canSubmit = canSubmitDispatch(localDispatch);

  // Can dispatch if approved and not yet dispatched. Checking both the
  // logistic relation AND the dispatch status guards against a dispatch
  // that's already in_transit/delivered but whose logistic relation wasn't
  // loaded on this response - showing "Dispatch Order" again would create
  // a second logistics record for the same order.
  const canDispatch = localDispatch.approval_status === 'approved'
    && !localDispatch.logistic
    && !['in_transit', 'delivered', 'cancelled'].includes(localDispatch.status);

  // Can mark delivered once in transit with logistics assigned; the delivery
  // note itself is enforced inside MarkDeliveredModal/the backend, not here.
  const canDeliver = canMarkDelivered(localDispatch);
  const hasDeliveryNote = !!localDispatch.logistic?.delivery_note_file;
  const customerDisplayName = localDispatch.order?.customer
    ? getCustomerDisplayName(localDispatch.order.customer)
    : "N/A";

  const formatDateTime = (value?: string | null) => {
    if (!value) return "Not available";

    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "Not available"
      : format(date, "MMM dd, yyyy 'at' HH:mm");
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-2xl md:max-w-3xl lg:max-w-4xl overflow-y-auto p-0 gap-0 bg-gray-50/50">
          <VisuallyHidden>
            <SheetTitle>Dispatch Details - {localDispatch.dispatch_number}</SheetTitle>
          </VisuallyHidden>
          
          {/* Header Section with Gradient */}
          <div className="bg-white border-b sticky top-0 z-20">
             <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6 text-white">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 backdrop-blur-sm rounded-xl">
                      <Package className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold tracking-tight">Dispatch #{localDispatch.dispatch_number}</h2>
                      <p className="text-blue-100 text-sm">Created by {localDispatch.created_by?.first_name} {localDispatch.created_by?.last_name}</p>
                    </div>
                  </div>
                  <SheetClose className="rounded-full bg-white/20 p-2 hover:bg-white/30 text-white transition-colors">
                    <X className="h-5 w-5" />
                    <span className="sr-only">Close</span>
                  </SheetClose>
                </div>
                
                <div className="flex items-center gap-3">
                   {getApprovalBadge(localDispatch.approval_status)}
                   {getStatusBadge(localDispatch.status)}
                </div>
             </div>
          </div>

          <div className="p-8 space-y-8">
            {/* Action Bar for Draft (Submit) */}
            {canSubmit && (
               <div className="bg-white border border-blue-200 shadow-sm rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-6 relative overflow-hidden">
                 <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                 <div className="flex items-start gap-4">
                   <div className="p-3 bg-blue-100 text-blue-700 rounded-full">
                      <Send className="h-6 w-6" />
                   </div>
                   <div>
                     <h3 className="text-lg font-semibold text-gray-900">Draft Dispatch</h3>
                     <p className="text-gray-500">This dispatch is in draft. Submit it for approval.</p>
                   </div>
                 </div>
                 <Button 
                   className="bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200"
                   onClick={() => setSubmitDialogOpen(true)}
                 >
                   <Send className="h-4 w-4 mr-2" />
                   Submit for Approval
                 </Button>
               </div>
            )}

            {/* Action Bar for Pending Approval */}
            {canApprove && (
              <div className="bg-white border border-yellow-200 shadow-sm rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-yellow-400"></div>
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-yellow-100 text-yellow-700 rounded-full">
                     <AlertTriangle className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Approval Required</h3>
                    <p className="text-gray-500">You are assigned to review this dispatch.</p>
                  </div>
                </div>
                <div className="flex gap-3 w-full sm:w-auto">
                  <Button 
                    variant="outline" 
                    className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 hover:border-red-300 min-w-[100px]"
                    onClick={() => setRejectDialogOpen(true)}
                  >
                    <Ban className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                  <Button 
                    className="bg-green-600 hover:bg-green-700 text-white shadow-md shadow-green-200 min-w-[120px]"
                    onClick={() => setApproveDialogOpen(true)}
                  >
                    <ShieldCheck className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                </div>
              </div>
            )}

            {/* Action Bar for Approved but Not Dispatched */}
            {canDispatch && (
               <div className="bg-white border border-green-200 shadow-sm rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-6 relative overflow-hidden">
                 <div className="absolute top-0 left-0 w-1 h-full bg-green-500"></div>
                 <div className="flex items-start gap-4">
                   <div className="p-3 bg-green-100 text-green-700 rounded-full">
                      <Truck className="h-6 w-6" />
                   </div>
                   <div>
                     <h3 className="text-lg font-semibold text-gray-900">Ready for Dispatch</h3>
                     <p className="text-gray-500">Order has been approved. Assign driver to dispatch.</p>
                   </div>
                 </div>
                 <Button
                   className="bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200"
                   onClick={() => setDispatchModalOpen(true)}
                 >
                   <Truck className="h-4 w-4 mr-2" />
                   Dispatch Order
                 </Button>
               </div>
            )}

            {/* Action Bar for In Transit -> Delivered */}
            {canDeliver && (
               <div className="bg-white border border-green-200 shadow-sm rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-6 relative overflow-hidden">
                 <div className="absolute top-0 left-0 w-1 h-full bg-green-500"></div>
                 <div className="flex items-start gap-4">
                   <div className="p-3 bg-green-100 text-green-700 rounded-full">
                      <CheckCircle2 className="h-6 w-6" />
                   </div>
                   <div>
                     <h3 className="text-lg font-semibold text-gray-900">In Transit</h3>
                     <p className="text-gray-500">
                       {hasDeliveryNote
                         ? "Stamped delivery note on file. Confirm quantities to mark as delivered."
                         : "Upload the customer-stamped delivery note to confirm receipt before marking as delivered."}
                     </p>
                   </div>
                 </div>
                 <Button
                   className="bg-green-600 hover:bg-green-700 text-white shadow-md shadow-green-200"
                   onClick={() => setMarkDeliveredModalOpen(true)}
                 >
                   <CheckCircle2 className="h-4 w-4 mr-2" />
                   Mark as Delivered
                 </Button>
               </div>
            )}

            {/* Grid Layout for Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Order Info */}
               <Card className="border-none shadow-md bg-white overflow-hidden group">
                 <div className="h-1 w-full bg-blue-500"></div>
                 <CardHeader className="pb-3 bg-slate-50/50 border-b border-slate-100">
                    <CardTitle className="text-base font-semibold flex items-center gap-2 text-gray-800">
                       <FileText className="h-4 w-4 text-blue-500" />
                       Order Details
                    </CardTitle>
                 </CardHeader>
                 <CardContent className="pt-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                       <div>
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Order Number</p>
                          <p className="mt-1 font-semibold text-gray-900">{localDispatch.order?.order_number}</p>
                       </div>
                       <div>
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</p>
                          <p className="mt-1 font-medium text-gray-900">{customerDisplayName}</p>
                       </div>
                       <div className="col-span-2">
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Payment Status</p>
                          <div className="mt-1">
                             <Badge variant="outline" className={cn(
                                "capitalize",
                                localDispatch.order?.payment_status === 'paid' ? "text-green-600 border-green-200 bg-green-50" :
                                localDispatch.order?.payment_status === 'partial' ? "text-orange-600 border-orange-200 bg-orange-50" :
                                "text-red-600 border-red-200 bg-red-50"
                             )}>
                                {localDispatch.order?.payment_status ? toSentenceCase(localDispatch.order.payment_status) : 'Unknown'}
                             </Badge>
                          </div>
                       </div>
                    </div>
                 </CardContent>
              </Card>

              {/* Delivery Info */}
              <Card className="border-none shadow-md bg-white overflow-hidden">
                 <div className="h-1 w-full bg-indigo-500"></div>
                 <CardHeader className="pb-3 bg-slate-50/50 border-b border-slate-100">
                    <CardTitle className="text-base font-semibold flex items-center gap-2 text-gray-800">
                       <MapPin className="h-4 w-4 text-indigo-500" />
                       Delivery Information
                    </CardTitle>
                 </CardHeader>
                 <CardContent className="pt-4 space-y-3">
                    {(() => {
                      // The dispatch may have a structured delivery_location record,
                      // or the destination may only have been captured as free-text
                      // fields on the logistic record when it was dispatched. Prefer
                      // the structured one, fall back to the logistic's.
                      const loc = localDispatch.delivery_location;
                      const log = localDispatch.logistic;
                      const recipientName = log?.recipient_name;
                      const recipientPhone = log?.recipient_phone;
                      const destination = loc?.landmark || log?.delivery_location;
                      const streetAddress = loc
                        ? [loc.house_number, loc.street].filter(Boolean).join(' ')
                        : log?.delivery_address;
                      const city = loc?.city || log?.city;
                      const region = log?.region || log?.state;
                      const country = loc?.country || log?.country;

                      if (!loc && !log) {
                        return <p className="text-gray-500">No delivery location set</p>;
                      }

                      return (
                        <>
                          {(recipientName || recipientPhone) && (
                            <div>
                               <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Recipient</p>
                               <p className="mt-1 font-semibold text-gray-900">{recipientName || 'N/A'}</p>
                               {recipientPhone && <p className="text-sm text-gray-600">{recipientPhone}</p>}
                            </div>
                          )}
                          <div>
                             <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Destination</p>
                             <p className="mt-1 font-semibold text-gray-900">{destination || 'N/A'}</p>
                          </div>
                          <div>
                             <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Street Address</p>
                             <p className="mt-1 text-sm text-gray-600">{streetAddress || 'N/A'}</p>
                          </div>
                          {loc?.estate && (
                            <div>
                               <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Estate/Area</p>
                               <p className="mt-1 text-sm text-gray-600">{loc.estate}</p>
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-3">
                             <div>
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">City</p>
                                <p className="mt-1 text-sm text-gray-600">{city || 'N/A'}</p>
                             </div>
                             <div>
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{loc ? 'Country' : 'Region'}</p>
                                <p className="mt-1 text-sm text-gray-600">{loc ? (country || 'N/A') : (region || country || 'N/A')}</p>
                             </div>
                          </div>
                          {loc?.location_note && (
                            <div>
                               <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</p>
                               <p className="mt-1 text-sm text-gray-600">{loc.location_note}</p>
                            </div>
                          )}
                        </>
                      );
                    })()}
                 </CardContent>
              </Card>

              {/* Logistics */}
              <Card className="border-none shadow-md bg-white overflow-hidden">
                 <div className="h-1 w-full bg-orange-500"></div>
                 <CardHeader className="pb-3 bg-slate-50/50 border-b border-slate-100">
                    <CardTitle className="text-base font-semibold flex items-center gap-2 text-gray-800">
                       <Truck className="h-4 w-4 text-orange-500" />
                       Logistics
                    </CardTitle>
                 </CardHeader>
                 <CardContent className="pt-4 space-y-3">
                    {localDispatch.logistic ? (
                      <>
                        <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
                           <div>
                              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Tracking Number</p>
                              <p className="text-sm font-semibold mt-1">{localDispatch.logistic.tracking_number || 'N/A'}</p>
                           </div>
                           <Badge variant="default">
                              {toSentenceCase(localDispatch.logistic.delivery_status || localDispatch.logistic.status || 'pending')}
                           </Badge>
                        </div>
                        {localDispatch.logistic.delivery_status === 'pending_payment' && (
                           <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                              Awaiting payment of the delivery invoice from accounting. The dispatch will proceed automatically once paid.
                           </div>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                           <div>
                              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Driver</p>
                              <p className="mt-1 text-sm font-medium text-gray-900">
                                {localDispatch.logistic.delivery_person?.full_name || localDispatch.logistic.driver_name || 'N/A'}
                              </p>
                              {(localDispatch.logistic.delivery_person?.phone_number || localDispatch.logistic.driver_contact) && (
                                <p className="text-xs text-gray-500">
                                  {localDispatch.logistic.delivery_person?.phone_number || localDispatch.logistic.driver_contact}
                                </p>
                              )}
                           </div>
                           <div>
                              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Vehicle</p>
                              <p className="mt-1 text-sm font-medium text-gray-900">
                                {localDispatch.logistic.vehicle_type || 'N/A'}
                              </p>
                              {(localDispatch.logistic.vehicle_id || localDispatch.logistic.vehicle_registration) && (
                                <p className="text-xs text-gray-500">
                                  {localDispatch.logistic.vehicle_id || localDispatch.logistic.vehicle_registration}
                                </p>
                              )}
                           </div>
                        </div>
                        {localDispatch.logistic.logistics_provider && (
                          <div>
                             <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Provider</p>
                             <p className="mt-1 text-sm text-gray-600">{localDispatch.logistic.logistics_provider}</p>
                          </div>
                        )}
                        {localDispatch.logistic.estimated_delivery_time && (
                          <div>
                             <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Estimated Delivery</p>
                             <p className="mt-1 text-sm text-gray-600">{formatDateTime(localDispatch.logistic.estimated_delivery_time)}</p>
                          </div>
                        )}
                        {localDispatch.logistic.notes && (
                          <div>
                             <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Dispatch Notes</p>
                             <p className="mt-1 text-sm text-gray-600">{localDispatch.logistic.notes}</p>
                          </div>
                        )}
                        {hasDeliveryNote && (
                          <div className="border-t border-gray-100 pt-3">
                             <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Stamped Delivery Note</p>
                             <div className="flex items-center justify-between">
                                <Badge className="bg-green-100 text-green-800 border-green-300">
                                  {toSentenceCase(localDispatch.logistic.delivery_note_status || 'pending_review')}
                                </Badge>
                                {localDispatch.logistic.delivery_note_url && (
                                  <div className="flex gap-2">
                                     <a href={localDispatch.logistic.delivery_note_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-xs text-blue-600 hover:underline">
                                        <Eye className="h-3.5 w-3.5 mr-1" /> View
                                     </a>
                                     <a href={localDispatch.logistic.delivery_note_url} download className="inline-flex items-center text-xs text-blue-600 hover:underline">
                                        <Download className="h-3.5 w-3.5 mr-1" /> Download
                                     </a>
                                  </div>
                                )}
                             </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-6 text-gray-500">
                        <p className="font-medium mb-2">Not yet assigned</p>
                        <p className="text-sm">Click "Dispatch Order" above to assign a driver and create the logistics record.</p>
                      </div>
                    )}
                 </CardContent>
              </Card>

              {/* Delivery Note - auto-generated once the dispatch is delivered */}
              {deliveryNote && (
                <Card className="border-none shadow-md bg-white overflow-hidden">
                   <div className="h-1 w-full bg-indigo-500"></div>
                   <CardHeader className="pb-3 bg-slate-50/50 border-b border-slate-100">
                      <CardTitle className="text-base font-semibold flex items-center gap-2 text-gray-800">
                         <FileText className="h-4 w-4 text-indigo-500" />
                         Delivery Note
                      </CardTitle>
                   </CardHeader>
                   <CardContent className="pt-4 space-y-3">
                      <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
                         <div>
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Note Number</p>
                            <p className="text-sm font-semibold mt-1">{deliveryNote.note_number}</p>
                         </div>
                         <Badge variant="default">{toSentenceCase(deliveryNote.status)}</Badge>
                      </div>
                      <div className="space-y-2">
                         {deliveryNote.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between text-sm border-b border-gray-100 pb-2 last:border-0">
                               <span className="text-gray-700">{item.product_name}</span>
                               <span className="font-medium">{item.quantity_dispatched ?? item.delivered_quantity ?? 0} pcs</span>
                            </div>
                         ))}
                      </div>
                   </CardContent>
                </Card>
              )}

              {/* Timeline */}
              <Card className="border-none shadow-md bg-white overflow-hidden">
                 <div className="h-1 w-full bg-teal-500"></div>
                 <CardHeader className="pb-3 bg-slate-50/50 border-b border-slate-100">
                    <CardTitle className="text-base font-semibold flex items-center gap-2 text-gray-800">
                       <Clock className="h-4 w-4 text-teal-500" />
                       Timeline
                    </CardTitle>
                 </CardHeader>
                 <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                       <div className="flex flex-col items-center">
                          <div className="w-2 h-2 rounded-full bg-teal-500 ring-4 ring-teal-100"></div>
                          <div className="w-0.5 h-full bg-gray-200 my-1"></div>
                       </div>
                       <div className="pb-4">
                          <p className="text-sm font-medium text-gray-900">Created</p>
                          <p className="text-xs text-gray-500">{formatDateTime(localDispatch.created_at)}</p>
                       </div>
                    </div>
                    {localDispatch.final_approved_at && (
                        <div className="flex items-start gap-3">
                           <div className="flex flex-col items-center">
                              <div className="w-2 h-2 rounded-full bg-green-500 ring-4 ring-green-100"></div>
                           </div>
                           <div>
                              <p className="text-sm font-medium text-gray-900">Approved</p>
                              <p className="text-xs text-gray-500">{formatDateTime(localDispatch.final_approved_at)}</p>
                           </div>
                        </div>
                    )}
                 </CardContent>
              </Card>
            </div>

            {/* Notes */}
            {localDispatch.notes && (
              <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-5 shadow-sm">
                 <h4 className="flex items-center gap-2 text-sm font-semibold text-yellow-800 mb-2">
                    <FileText className="h-4 w-4" />
                    Additional Notes
                 </h4>
                 <p className="text-sm text-yellow-900/80 leading-relaxed">{localDispatch.notes}</p>
              </div>
            )}

            <div className="border-t border-gray-200 pt-8"></div>

            {/* Approval Progress */}
            {localDispatch.approval_progress && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                 <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900">Approval Workflow</h3>
                    <Badge variant="outline">{localDispatch.approval_progress.approved} of {localDispatch.approval_progress.total} Approved</Badge>
                 </div>
                 
                 <div className="w-full bg-gray-100 rounded-full h-2.5 mb-6 overflow-hidden">
                    <div 
                      className="bg-green-500 h-2.5 rounded-full transition-all duration-500 ease-out" 
                      style={{ width: `${localDispatch.approval_progress.percentage}%` }}
                    />
                 </div>
                  
                 {localDispatch.approver_details && localDispatch.approver_details.length > 0 && (
                    <div className="space-y-3">
                      {localDispatch.approver_details.map((approver, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-100">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white",
                              approver.status === 'approved' ? "bg-green-500" :
                              approver.status === 'rejected' ? "bg-red-500" : "bg-gray-400"
                            )}>
                               {approver.user
                                 ? `${approver.user.first_name?.[0] || "?"}${approver.user.last_name?.[0] || ""}`
                                 : "?"}
                            </div>
                            <div>
                               <p className="text-sm font-medium text-gray-900">
                                 {approver.user
                                   ? `${approver.user.first_name} ${approver.user.last_name}`
                                   : "Former user"}
                               </p>
                               <p className="text-xs text-gray-500">Approver</p>
                            </div>
                          </div>
                          <div className="text-right">
                             {approver.status === 'approved' ? (
                                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700">
                                   Approved
                                   {approver.approved_at && (
                                      <span className="ml-1 opacity-75">• {formatDateTime(approver.approved_at)}</span>
                                   )}
                                </span>
                             ) : approver.status === 'rejected' ? (
                                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-700">
                                   Rejected
                                </span>
                             ) : (
                                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600">Pending</span>
                             )}
                          </div>
                        </div>
                      ))}
                    </div>
                 )}
              </div>
            )}

             {/* Dispatch Items */}
             <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-xl text-gray-900 flex items-center gap-2">
                    <Package className="h-5 w-5 text-gray-500" />
                    Items
                  </h3>
                  <Badge variant="secondary" className="px-3 py-1 text-sm">{localDispatch.items?.length || 0} Items</Badge>
                </div>

                <div className="grid grid-cols-1 gap-4">
                   {localDispatch.items?.map((item, index) => (
                    <div key={item.product_id + index} className="group flex items-start justify-between p-5 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all duration-200">
                      <div className="flex gap-4">
                         <div className="h-12 w-12 rounded-lg bg-gray-100 flex items-center justify-center">
                            {/* Placeholder for product image if available, else icon */}
                            <Package className="h-6 w-6 text-gray-400 group-hover:text-blue-500 transition-colors" />
                         </div>
                         <div className="space-y-1">
                           <div className="font-semibold text-gray-900">{item.product?.name || "Unavailable product"}</div>
                           <div className="flex items-center gap-2 text-sm text-gray-500">
                             <span className="bg-gray-100 px-2 py-0.5 rounded text-xs font-mono">SKU: {item.product?.sku || "N/A"}</span>
                             {item.variant && <span className="text-xs">• {item.variant.name}</span>}
                           </div>
                           {item.batch_allocations && item.batch_allocations.length > 0 && (
                             <div className="text-xs text-gray-500">
                               {item.batch_allocations.map((a) => (
                                 <div key={a.batch_id}>
                                   Pick from Batch {a.batch_number}
                                   {a.expiry_date && ` · Exp ${new Date(a.expiry_date).toLocaleDateString()}`}
                                   {item.batch_allocations!.length > 1 && ` (${a.quantity})`}
                                 </div>
                               ))}
                             </div>
                           )}
                         </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{item.quantity}</div>
                        <div className="text-xs font-medium text-gray-500 uppercase">Units</div>
                      </div>
                    </div>
                  ))}
                  {(!localDispatch.items || localDispatch.items.length === 0) && (
                     <div className="flex flex-col items-center justify-center py-12 px-4 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                        <Package className="h-12 w-12 text-gray-300 mb-3" />
                        <p className="text-gray-500 font-medium">No items in this dispatch</p>
                      </div>
                  )}
                </div>
             </div>

             {/* Delivery Note - kept as a compact reference here; the full printable document (matching the invoice's layout) lives at its own route */}
             {localDispatch.logistic && !deliveryNote && (
               <Card className="border-none shadow-md bg-white overflow-hidden border-l-4 border-l-amber-400">
                 <CardContent className="py-4 px-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                       <div className="p-2 bg-amber-100 text-amber-700 rounded-lg">
                          <FileText className="h-5 w-5" />
                       </div>
                       <div>
                          <p className="font-semibold text-gray-900">Delivery Note</p>
                          <p className="text-xs text-gray-500">Printable packing list for the warehouse and the client's signature/stamp</p>
                       </div>
                    </div>
                    <div className="flex gap-2">
                       <Link href={`/dispatch/${localDispatch.id}/delivery-note`}>
                          <Button size="sm" variant="outline">View</Button>
                       </Link>
                       <Link href={`/dispatch/${localDispatch.id}/delivery-note?autoprint=1`}>
                          <Button size="sm" variant="outline">Print</Button>
                       </Link>
                    </div>
                 </CardContent>
               </Card>
             )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Approve Confirmation Dialog */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 mb-3 mt-2">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
          </div>
          <DialogHeader>
            <DialogTitle className="text-center">Approve Dispatch</DialogTitle>
            <DialogDescription className="text-center">
              Are you sure you want to approve this dispatch? This will move it to the next stage.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <label className="text-sm font-medium text-gray-700">Comments (Optional)</label>
            <Textarea 
              placeholder="Add any additional comments here..." 
              value={approveComments}
              onChange={(e) => setApproveComments(e.target.value)}
              className="resize-none focus-visible:ring-green-500"
            />
          </div>
          <DialogFooter className="sm:justify-center gap-2">
            <Button variant="outline" onClick={() => setApproveDialogOpen(false)} className="w-full sm:w-auto">Cancel</Button>
            <Button onClick={handleApprove} className="bg-green-600 hover:bg-green-700 w-full sm:w-auto shadow-sm">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirm Approval
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Reject Confirmation Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Dispatch</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this dispatch.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <label className="text-sm font-medium">Rejection Reason *</label>
            <Textarea 
              placeholder="Why is this dispatch being rejected?" 
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className={!rejectReason ? "border-red-300" : ""}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleReject} 
              variant="destructive"
              disabled={!rejectReason.trim()}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Ban className="h-4 w-4 mr-2" />}
              Reject Dispatch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 mb-3 mt-2">
            <Send className="h-6 w-6 text-blue-600" />
          </div>
          <DialogHeader>
            <DialogTitle className="text-center">Submit for Approval</DialogTitle>
            <DialogDescription className="text-center">
              Are you sure you want to submit this dispatch for approval? You won't be able to edit it while it's pending.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center gap-2">
            <Button variant="outline" onClick={() => setSubmitDialogOpen(false)} className="w-full sm:w-auto">Cancel</Button>
            <Button onClick={handleSubmit} className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto shadow-sm">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirm Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <CreateLogisticsModal
        open={dispatchModalOpen}
        onOpenChange={setDispatchModalOpen}
        dispatch={localDispatch}
        onSuccess={() => {
          // Reload delivery notes for this dispatch after payment
          if (localDispatch?.id) {
            getDeliveryNotes(localDispatch.id)
              .then((notes) => setDeliveryNote(notes[0] || null))
              .catch(() => setDeliveryNote(null));
          }
          onRefresh?.();
        }}
      />
      {localDispatch.logistic && (
        <MarkDeliveredModal
          open={markDeliveredModalOpen}
          onOpenChange={setMarkDeliveredModalOpen}
          dispatch={localDispatch}
          onSuccess={() => onRefresh?.()}
        />
      )}
    </>
  );
}
