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
import { Separator } from "@/components/ui/separator";
import { 
  Wrench, 
  User, 
  Calendar, 
  Package, 
  FileText, 
  CheckCircle, 
  XCircle,
  Edit,
  Trash2,
  Settings,
  Clock,
  AlertTriangle,
  DollarSign,
  Tag,
  Zap,
  UserCheck,
  UserPlus
} from "lucide-react";
import { type Repair } from "@/lib/repairs";
import { useToast } from "@/hooks/use-toast";

interface RepairModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repair: Repair | null;
  onClose: () => void;
  onRefresh?: () => void;
  onEditRepair?: (repair: Repair) => void;
  onUpdateStatus?: (repair: Repair) => void;
  onDeleteRepair?: (repair: Repair) => void;
  onApproveRepair?: (repair: Repair) => void;
  onAssignRepair?: (repair: Repair) => void;
}

export function RepairModal({
  open,
  onOpenChange,
  repair: initialRepair,
  onClose,
  onRefresh,
  onEditRepair,
  onUpdateStatus,
  onDeleteRepair,
  onApproveRepair,
  onAssignRepair,
}: RepairModalProps) {
  const [currentRepair, setCurrentRepair] = useState<Repair | null>(initialRepair);
  const { toast } = useToast();

  useEffect(() => {
    setCurrentRepair(initialRepair);
  }, [initialRepair]);

  // Helper function to check if an item is assigned
  const isItemAssigned = (item: any) => {
    return item.assigned_to && (
      typeof item.assigned_to === 'object' || 
      typeof item.assigned_to === 'string'
    );
  };

  const canEdit = currentRepair?.status === "reported" || currentRepair?.status === "in_progress";
  const canDelete = currentRepair?.status === "reported";
  const canUpdateStatus = currentRepair && ["reported", "in_progress"].includes(currentRepair.status);
  const canApprove = currentRepair?.approval_status === "pending" && onApproveRepair;
  
  // Can assign if repair is approved and has ANY repairable items that are not yet assigned
  const hasUnassignedRepairableItems = currentRepair?.items?.some(item => 
    item.is_repairable && !isItemAssigned(item)
  );
  const canAssign = currentRepair?.approval_status === "approved" && 
                   hasUnassignedRepairableItems && 
                   onAssignRepair;

  const getStatusBadge = (status: string | null | undefined) => {
    if (!status) {
      return <Badge variant="secondary" className="bg-gray-100 text-gray-800">No Status</Badge>;
    }
    
    switch (status.toLowerCase()) {
      case "pending":
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case "reported":
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800"><Clock className="h-3 w-3 mr-1" />Reported</Badge>;
      case "in_progress":
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800"><Wrench className="h-3 w-3 mr-1" />In Progress</Badge>;
      case "completed":
        return <Badge variant="secondary" className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
      case "failed":
        return <Badge variant="secondary" className="bg-red-100 text-red-800"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      case "cancelled":
        return <Badge variant="secondary" className="bg-gray-100 text-gray-800"><XCircle className="h-3 w-3 mr-1" />Cancelled</Badge>;
      case "resolved":
        return <Badge variant="secondary" className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Resolved</Badge>;
      case "approved":
        return <Badge variant="secondary" className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case "rejected":
        return <Badge variant="secondary" className="bg-red-100 text-red-800"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="outline" className="capitalize">{status}</Badge>;
    }
  };

  const getRepairabilityBadge = (isRepairable: boolean) => {
    return isRepairable ? (
      <Badge variant="secondary" className="bg-green-100 text-green-800">
        <CheckCircle className="h-3 w-3 mr-1" />
        Repairable
      </Badge>
    ) : (
      <Badge variant="secondary" className="bg-red-100 text-red-800">
        <XCircle className="h-3 w-3 mr-1" />
        Non-repairable
      </Badge>
    );
  };

  const getApprovalStatusBadge = (approval_status: string | null | undefined) => {
    if (!approval_status) {
      return <Badge variant="outline" className="border-gray-300 text-gray-600">Pending</Badge>;
    }
    
    switch (approval_status.toLowerCase()) {
      case "pending":
        return <Badge variant="outline" className="border-yellow-300 text-yellow-700 bg-yellow-50"><Clock className="h-3 w-3 mr-1" />Pending Approval</Badge>;
      case "approved":
        return <Badge variant="secondary" className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case "rejected":
        return <Badge variant="secondary" className="bg-red-100 text-red-800"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="outline">{approval_status}</Badge>;
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg md:max-w-xl lg:max-w-2xl flex flex-col h-full">
        <SheetHeader className="flex-shrink-0">
          <SheetTitle>Repair Details</SheetTitle>
          <SheetDescription>
            {currentRepair ? `Repair ${currentRepair.repair_number}` : "View repair details"}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {currentRepair ? (
            <>
              {/* Repair Header */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Wrench className="h-5 w-5" />
                      <span>{currentRepair.repair_number}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getStatusBadge(currentRepair.status)}
                      {getApprovalStatusBadge(currentRepair.approval_status)}
                      
                    </div>
                  </CardTitle>
                  <CardDescription>
                    Created on {format(new Date(currentRepair.created_at), "MMMM dd, yyyy 'at' HH:mm")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Reporter Information */}
                    <div className="space-y-2">
                      <h4 className="font-semibold flex items-center space-x-2">
                        <User className="h-4 w-4" />
                        <span>Reporter</span>
                      </h4>
                      <div className="flex items-center space-x-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-[#E30040]/10 text-[#E30040] text-sm">
                            {currentRepair.reporter?.first_name?.[0] || 'U'}
                            {currentRepair.reporter?.last_name?.[0] || 'N'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">
                            {currentRepair.reporter?.first_name} {currentRepair.reporter?.last_name}
                          </p>
                          <p className="text-sm text-gray-500">{currentRepair.reporter?.email}</p>
                        </div>
                      </div>
                    </div>

                    {/* Approver Information */}
                    <div className="space-y-2">
                      <h4 className="font-semibold flex items-center space-x-2">
                        <UserCheck className="h-4 w-4" />
                        <span>Approver</span>
                      </h4>
                      {currentRepair.approver ? (
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-green-500/10 text-green-700 text-sm">
                              {currentRepair.approver.first_name?.[0] || 'A'}
                              {currentRepair.approver.last_name?.[0] || 'P'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">
                              {currentRepair.approver.first_name} {currentRepair.approver.last_name}
                            </p>
                            <p className="text-sm text-gray-500">{currentRepair.approver.email}</p>
                            {currentRepair.approved_at && (
                              <p className="text-xs text-gray-400">
                                Approved on {format(new Date(currentRepair.approved_at), "MMM dd, yyyy")}
                              </p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-gray-100 text-gray-400 text-sm">
                              ?
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-gray-500">Pending Assignment</p>
                            <p className="text-sm text-gray-400">Awaiting approver assignment</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <Separator />

                  {/* Repair Status and Dates */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h4 className="font-semibold flex items-center space-x-2">
                        <Calendar className="h-4 w-4" />
                        <span>Timeline</span>
                      </h4>
                      <div className="space-y-1 text-sm">
                        {currentRepair.estimated_completion_date && (
                          <p>
                            <span className="font-medium">Estimated:</span>{" "}
                            {format(new Date(currentRepair.estimated_completion_date), "MMM dd, yyyy")}
                          </p>
                        )}
                        {currentRepair.actual_completion_date && (
                          <p>
                            <span className="font-medium">Completed:</span>{" "}
                            {format(new Date(currentRepair.actual_completion_date), "MMM dd, yyyy")}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Cost Information */}
                    {currentRepair.cost && (
                      <div className="space-y-2">
                        <h4 className="font-semibold flex items-center space-x-2">
                          <DollarSign className="h-4 w-4" />
                          <span>Repair Cost</span>
                        </h4>
                        <p className="text-lg font-semibold text-green-600">
                          ${currentRepair.cost.toFixed(2)}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  {currentRepair.description && (
                    <div className="space-y-2">
                      <h4 className="font-semibold flex items-center space-x-2">
                        <FileText className="h-4 w-4" />
                        <span>Description</span>
                      </h4>
                      <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-md">
                        {currentRepair.description}
                      </p>
                    </div>
                  )}

                  {/* Issue Description */}
                  {currentRepair.notes && (
                    <div className="space-y-2">
                      <h4 className="font-semibold flex items-center space-x-2">
                        <FileText className="h-4 w-4" />
                        <span>Issue Description</span>
                      </h4>
                      <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-md">
                        {currentRepair.notes}
                      </p>
                    </div>
                  )}

                  {/* Repair Notes */}
                  {currentRepair.repair_notes && (
                    <div className="space-y-2">
                      <h4 className="font-semibold flex items-center space-x-2">
                        <Wrench className="h-4 w-4" />
                        <span>Repair Notes</span>
                      </h4>
                      <p className="text-sm text-gray-700 bg-blue-50 p-3 rounded-md">
                        {currentRepair.repair_notes}
                      </p>
                    </div>
                  )}

                </CardContent>
              </Card>

              {/* Repair Items */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Package className="h-5 w-5" />
                    <span>Repair Items ({currentRepair?.items?.length || 0})</span>
                  </CardTitle>
                  <CardDescription>
                    Products included in this repair request
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {currentRepair?.items && currentRepair.items.length > 0 ? (
                    <div className="space-y-4">
                      {currentRepair.items.map((item, index) => (
                        <div key={item.id || index} className="border rounded-lg p-4">
                          <div className="space-y-3">
                            {/* Item Header */}
                            <div className="flex items-center justify-between">
                              <h5 className="font-medium text-gray-900">
                                Item #{index + 1}
                              </h5>
                              <div className="flex items-center space-x-2">
                                {getRepairabilityBadge(item.is_repairable)}
                                {item.repaired && (
                                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Repaired
                                  </Badge>
                                )}
                                {isItemAssigned(item) && item.is_repairable && (
                                  <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                                    <UserCheck className="h-3 w-3 mr-1" />
                                    Assigned
                                  </Badge>
                                )}
                              </div>
                            </div>

                            {/* Item Details */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <div className="text-sm">
                                  <span className="font-medium text-gray-600">Product:</span>
                                  <p className="text-gray-900">
                                    {item.product?.name || item.product_name || item.product_id}
                                  </p>
                                </div>
                                {(item.variant?.name || item.variant_name || item.product_variant) && (
                                  <div className="text-sm">
                                    <span className="font-medium text-gray-600">Variant:</span>
                                    <p className="text-gray-900">
                                      {item.variant?.name || item.variant_name || item.product_variant}
                                    </p>
                                  </div>
                                )}
                                {item.product?.sku && (
                                  <div className="text-sm">
                                    <span className="font-medium text-gray-600">SKU:</span>
                                    <p className="text-gray-900">{item.product.sku}</p>
                                  </div>
                                )}
                              </div>
                              <div className="space-y-2">
                                <div className="text-sm">
                                  <span className="font-medium text-gray-600">Quantity:</span>
                                  <p className="text-gray-900">{item.quantity}</p>
                                </div>
                                {item.unique_identifier && (
                                  <div className="text-sm">
                                    <span className="font-medium text-gray-600">Identifier:</span>
                                    <p className="text-gray-900">{item.unique_identifier}</p>
                                  </div>
                                )}
                                {item.product?.category && (
                                  <div className="text-sm">
                                    <span className="font-medium text-gray-600">Category:</span>
                                    <p className="text-gray-900">{item.product.category}</p>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Assignment Information for Repairable Items */}
                            {item.is_repairable && isItemAssigned(item) && (
                              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                <h6 className="font-medium text-blue-900 mb-2 flex items-center space-x-2">
                                  <UserCheck className="h-4 w-4" />
                                  <span>Assignment Details</span>
                                </h6>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                  <div>
                                    <span className="font-medium text-blue-700">Assigned to:</span>
                                    <p className="text-blue-800">
                                      {typeof item.assigned_to === 'object' && item.assigned_to?.first_name ? 
                                        `${item.assigned_to.first_name} ${item.assigned_to.last_name}` : 
                                        item.assignedUser ? 
                                        `${item.assignedUser.first_name} ${item.assignedUser.last_name}` : 
                                        typeof item.assigned_to === 'string' ? item.assigned_to : 'Unknown'
                                      }
                                    </p>
                                  </div>
                                  <div>
                                    <span className="font-medium text-blue-700">Status:</span>
                                    <p className="text-blue-800 capitalize">
                                      {item.status === "assigned_repair" ? "Assigned for Repair" : item.status || "Pending"}
                                    </p>
                                  </div>
                                  {item.repaired_by && (
                                    <div>
                                      <span className="font-medium text-blue-700">Repaired by:</span>
                                      <p className="text-blue-800">{item.repaired_by}</p>
                                    </div>
                                  )}
                                  {item.repaired_at && (
                                    <div>
                                      <span className="font-medium text-blue-700">Repaired on:</span>
                                      <p className="text-blue-800">
                                        {format(new Date(item.repaired_at), "MMM dd, yyyy 'at' HH:mm")}
                                      </p>
                                    </div>
                                  )}
                                </div>
                                {item.repair_notes && (
                                  <div className="mt-2">
                                    <span className="font-medium text-blue-700 text-sm">Repair Notes:</span>
                                    <p className="text-blue-800 text-sm bg-blue-100 p-2 rounded mt-1">
                                      {item.repair_notes}
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Item Notes */}
                            {item.notes && (
                              <div className="space-y-1">
                                <span className="text-sm font-medium text-gray-600">Notes:</span>
                                <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">
                                  {item.notes}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                      <p>No items found for this repair</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="flex items-center justify-center h-64">
              <p className="text-gray-500">No repair selected</p>
            </div>
          )}
        </div>

        <Separator />

        <SheetFooter className="flex-shrink-0 border-t pt-4 mt-auto">
          <div className="flex justify-between w-full">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            {currentRepair && (
              <div className="flex items-center space-x-2">
                {canApprove && (
                  <Button
                    onClick={() => onApproveRepair!(currentRepair)}
                    className="bg-green-600 hover:bg-green-700"
                    size="sm"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve/Reject
                  </Button>
                )}
                {canAssign && (
                  <Button
                    onClick={() => onAssignRepair!(currentRepair)}
                    className="bg-blue-600 hover:bg-blue-700"
                    size="sm"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Assign Items
                  </Button>
                )}
                {canEdit && onEditRepair && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEditRepair(currentRepair)}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                )}
                {canUpdateStatus && onUpdateStatus && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onUpdateStatus(currentRepair)}
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Update Status
                  </Button>
                )}
                {canDelete && onDeleteRepair && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => onDeleteRepair(currentRepair)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                )}
              </div>
            )}
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}