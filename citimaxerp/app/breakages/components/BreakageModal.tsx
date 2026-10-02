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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  AlertTriangle, 
  User, 
  Calendar, 
  Package, 
  FileText, 
  CheckCircle, 
  XCircle,
  Edit,
  Trash2,
  RefreshCw
} from "lucide-react";
import { type Breakage } from "@/lib/breakages";
import { useToast } from "@/hooks/use-toast";

interface BreakageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  breakage: Breakage | null;
  onClose: () => void;
  onRefresh?: () => void;
  onEditBreakage?: (breakage: Breakage) => void;
  onDeleteBreakage?: (breakage: Breakage) => void;
  onApproveBreakage?: (breakage: Breakage) => void;
  onCreateDispatch?: (breakage: Breakage) => void;
}

export function BreakageModal({
  open,
  onOpenChange,
  breakage: initialBreakage,
  onClose,
  onRefresh,
  onEditBreakage,
  onDeleteBreakage,
  onApproveBreakage,
  onCreateDispatch,
}: BreakageModalProps) {
  const [currentBreakage, setCurrentBreakage] = useState<Breakage | null>(initialBreakage);
  const { toast } = useToast();

  useEffect(() => {
    setCurrentBreakage(initialBreakage);
  }, [initialBreakage]);

  const canEdit = currentBreakage?.status === "pending" && currentBreakage?.approval_status === "pending";
  const canDelete = currentBreakage?.status === "pending" && currentBreakage?.approval_status === "pending";
  const canApprove = currentBreakage?.approval_status === "pending";
  const canCreateDispatch = currentBreakage?.approval_status === "approved" && 
    currentBreakage.status !== "dispatch_initiated" &&
    currentBreakage.items.some(item => item.replacement_requested);

  const getStatusBadge = (status: string | null | undefined) => {
    if (!status) {
      return <Badge variant="secondary" className="bg-gray-100 text-gray-800">Unknown</Badge>;
    }
    
    switch (status.toLowerCase()) {
      case "pending":
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case "approved":
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Approved</Badge>;
      case "rejected":
        return <Badge variant="secondary" className="bg-red-100 text-red-800">Rejected</Badge>;
      case "replaced":
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Replaced</Badge>;
      case "resolved":
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Resolved</Badge>;
      case "dispatch_initiated":
        return <Badge variant="secondary" className="bg-purple-100 text-purple-800">Dispatch Initiated</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getApprovalStatusBadge = (approvalStatus: string | null | undefined) => {
    if (!approvalStatus) {
      return <Badge variant="outline" className="border-gray-500 text-gray-700">Unknown</Badge>;
    }
    
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
          <SheetTitle>Breakage Details</SheetTitle>
          <SheetDescription>
            {currentBreakage ? `Breakage ${currentBreakage.breakage_number}` : "View breakage details"}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-6">
          {currentBreakage ? (
            <>
              {/* Breakage Header */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <AlertTriangle className="h-5 w-5" />
                      <span>{currentBreakage.breakage_number}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getStatusBadge(currentBreakage.status)}
                      {getApprovalStatusBadge(currentBreakage.approval_status)}
                    </div>
                  </CardTitle>
                  <CardDescription>
                    Created on {format(new Date(currentBreakage.created_at), "MMMM dd, yyyy 'at' HH:mm")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Reporter Information */}
                    <div className="space-y-2">
                      <h4 className="font-semibold flex items-center space-x-2">
                        <User className="h-4 w-4" />
                        <span>Reporter</span>
                      </h4>
                      <div className="flex items-center space-x-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-[#1E2764]/10 text-[#1E2764] text-sm">
                            {currentBreakage.reporter?.first_name?.[0] || 'U'}
                            {currentBreakage.reporter?.last_name?.[0] || 'N'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">
                            {currentBreakage.reporter?.first_name} {currentBreakage.reporter?.last_name}
                          </p>
                          <p className="text-sm text-gray-500">{currentBreakage.reporter?.email}</p>
                        </div>
                      </div>
                    </div>

                    {/* Approver Information */}
                    {currentBreakage.approver && (
                      <div className="space-y-2">
                        <h4 className="font-semibold flex items-center space-x-2">
                          <CheckCircle className="h-4 w-4" />
                          <span>Approver</span>
                        </h4>
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-green-100 text-green-800 text-sm">
                              {currentBreakage.approver.first_name[0]}
                              {currentBreakage.approver.last_name[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">
                              {currentBreakage.approver.first_name} {currentBreakage.approver.last_name}
                            </p>
                            <p className="text-sm text-gray-500">{currentBreakage.approver.email}</p>
                            {currentBreakage.approved_at && (
                              <p className="text-xs text-gray-400">
                                Approved on {format(new Date(currentBreakage.approved_at), "MMM dd, yyyy 'at' HH:mm")}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  {currentBreakage.notes && (
                    <div className="space-y-2">
                      <h4 className="font-semibold flex items-center space-x-2">
                        <FileText className="h-4 w-4" />
                        <span>Notes</span>
                      </h4>
                      <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-md">
                        {currentBreakage.notes}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Breakage Items */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Package className="h-5 w-5" />
                    <span>Broken Items</span>
                  </CardTitle>
                  <CardDescription>
                    {currentBreakage.items?.length || 0} products in this breakage report
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {currentBreakage.items && currentBreakage.items.length > 0 ? (
                    <div className="space-y-4">
                      {currentBreakage.items.map((item, index) => (
                        <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3">
                              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                                <Package className="h-6 w-6 text-gray-500" />
                              </div>
                              <div className="flex-1">
                                <h4 className="font-medium">{item.product?.name || 'Product'}</h4>
                                <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
                                  <span>Cause: {item.cause}</span>
                                  {item.variant && <span>Variant: {item.variant.name}</span>}
                                  {item.replacement_requested && (
                                    <Badge variant="outline" className="border-orange-500 text-orange-700">
                                      Replacement Requested
                                    </Badge>
                                  )}
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
                              {item.product?.unit_of_measurement || 'units'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>No items in this breakage</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No breakage selected</p>
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
              {canCreateDispatch && (
                <Button
                  onClick={() => {
                    if (onCreateDispatch && currentBreakage) {
                      onCreateDispatch(currentBreakage);
                    }
                  }}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Create Replacement Dispatch
                </Button>
              )}
              {canApprove && (
                <Button
                  onClick={() => {
                    if (onApproveBreakage && currentBreakage) {
                      onApproveBreakage(currentBreakage);
                    }
                  }}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Approve/Reject
                </Button>
              )}
              {canEdit && (
                <Button
                  onClick={() => {
                    if (onEditBreakage && currentBreakage) {
                      onEditBreakage(currentBreakage);
                    }
                  }}
                  className="bg-[#1E2764] hover:bg-[#1E2764]/90"
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              )}
              {canDelete && (
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (onDeleteBreakage && currentBreakage) {
                      onDeleteBreakage(currentBreakage);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              )}
            </div>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}