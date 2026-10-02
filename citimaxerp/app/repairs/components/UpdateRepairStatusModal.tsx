"use client";

import { useState, useEffect } from "react";
import { updateRepairItemsStatus, type Repair } from "@/lib/repairs";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Settings, 
  CheckCircle, 
  XCircle,
  Clock,
  Wrench,
  Loader2,
  AlertTriangle,
  Calendar,
  User
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface UpdateRepairStatusModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repair: Repair | null;
  onSuccess: () => void;
}

interface ItemStatusUpdate {
  id: string;
  status: "pending" | "in_progress" | "completed" | "failed" | "cancelled" | "assigned_repair";
}

interface FormData {
  items: ItemStatusUpdate[];
  repair_status?: "pending" | "reported" | "in_progress" | "completed" | "failed" | "cancelled";
}

interface FormErrors {
  items?: string;
  repair_status?: string;
}

const ITEM_STATUSES = [
  { value: "pending", label: "Pending", icon: Clock, color: "bg-blue-100 text-blue-800" },
  { value: "in_progress", label: "In Progress", icon: Wrench, color: "bg-yellow-100 text-yellow-800" },
  { value: "completed", label: "Completed", icon: CheckCircle, color: "bg-green-100 text-green-800" },
  { value: "failed", label: "Failed", icon: XCircle, color: "bg-red-100 text-red-800" },
  { value: "cancelled", label: "Cancelled", icon: XCircle, color: "bg-gray-100 text-gray-800" },
  { value: "assigned_repair", label: "Assigned for Repair", icon: Settings, color: "bg-purple-100 text-purple-800" }
] as const;

const REPAIR_STATUSES = [
  "pending",
  "reported", 
  "in_progress",
  "completed",
  "failed",
  "cancelled"
] as const;

export function UpdateRepairStatusModal({
  open,
  onOpenChange,
  onSuccess,
  repair,
}: UpdateRepairStatusModalProps) {
  const [formData, setFormData] = useState<FormData>({
    items: [],
    repair_status: undefined,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && repair) {
      // Initialize form data with current item statuses
      setFormData({
        items: repair.items.map(item => ({
          id: item.id,
          status: item.status,
        })),
        repair_status: repair.status as any,
      });
      setErrors({});
    } else if (!open) {
      setFormData({
        items: [],
        repair_status: undefined,
      });
      setErrors({});
    }
  }, [open, repair]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!repair || formData.items.length === 0) {
      newErrors.items = "No items to update";
    }

    // Check if any changes were made
    if (repair) {
      const hasItemChanges = formData.items.some((item, index) => 
        item.status !== repair.items[index]?.status
      );
      const hasRepairStatusChange = formData.repair_status && formData.repair_status !== repair.status;
      
      if (!hasItemChanges && !hasRepairStatusChange) {
        newErrors.items = "No changes detected";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm() || !repair) return;

    setLoading(true);
    try {
      const payload = {
        items: formData.items,
        // Only include repair_status if it's different from current status
        repair_status: formData.repair_status !== repair.status ? formData.repair_status : undefined
      };

      await updateRepairItemsStatus(repair.id, payload);
      
      toast({
        title: "Success",
        description: "Repair item statuses updated successfully.",
      });
      
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating repair item statuses:", error);
      toast({
        title: "Error",
        description: "Failed to update repair item statuses. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateItemStatus = (itemId: string, status: string) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map(item => 
        item.id === itemId 
          ? { ...item, status: status as any }
          : item
      )
    }));
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = ITEM_STATUSES.find(s => s.value === status);
    if (!statusConfig) {
      return <Badge variant="outline" className="capitalize">{status}</Badge>;
    }
    
    const Icon = statusConfig.icon;
    return (
      <Badge variant="secondary" className={statusConfig.color}>
        <Icon className="h-3 w-3 mr-1" />
        {statusConfig.label}
      </Badge>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg md:max-w-xl lg:max-w-2xl flex flex-col h-full">
        <SheetHeader className="flex-shrink-0">
          <SheetTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5 text-blue-600" />
            <span>Update Repair Item Status</span>
          </SheetTitle>
          <SheetDescription>
            {repair ? `Update individual item statuses for repair ${repair.repair_number}` : "Update repair item statuses"}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-6">
          {/* Repair Summary */}
          {repair && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center space-x-2">
                  <Wrench className="h-5 w-5 text-blue-600" />
                  <span>Repair Summary</span>
                </CardTitle>
                <CardDescription>
                  Review and update the status of individual items in this repair
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium">Repair Number</Label>
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-[#E30040]">{repair.repair_number}</span>
                        {getStatusBadge(repair.status)}
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Date Reported</Label>
                      <div className="flex items-center space-x-2 text-sm text-gray-700">
                        <Calendar className="h-4 w-4" />
                        <span>{format(new Date(repair.created_at), "MMM dd, yyyy 'at' HH:mm")}</span>
                      </div>
                    </div>
                  </div>

                  {/* Reporter Info */}
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium">Reported By</Label>
                      <div className="flex items-center space-x-2 text-sm text-gray-700">
                        <User className="h-4 w-4" />
                        <span>
                          {repair.reporter?.first_name} {repair.reporter?.last_name}
                        </span>
                      </div>
                    </div>
                    {repair.description && (
                      <div>
                        <Label className="text-sm font-medium">Description</Label>
                        <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded">{repair.description}</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Individual Item Status Updates */}
          {repair && repair.items.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Item Status Updates</CardTitle>
                <CardDescription>
                  Update the status of each individual item in this repair
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {errors.items && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-600">{errors.items}</p>
                  </div>
                )}
                
                <div className="space-y-4">
                  {repair.items.map((item, index) => {
                    const currentFormItem = formData.items.find(fi => fi.id === item.id);
                    const currentStatus = currentFormItem?.status || item.status;
                    
                    return (
                      <div key={item.id} className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <p className="font-medium">{item.product?.name}</p>
                            {item.variant && (
                              <p className="text-sm text-gray-600">Variant: {item.variant.name}</p>
                            )}
                            <p className="text-xs text-gray-500">ID: {item.unique_identifier}</p>
                            <p className="text-xs text-gray-500">Quantity: {item.quantity}</p>
                          </div>
                          <div className="text-right">
                            <div className="mb-2">
                              <Label className="text-xs text-gray-500">Current Status</Label>
                              <div>{getStatusBadge(item.status)}</div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">New Status</Label>
                          <Select 
                            value={currentStatus} 
                            onValueChange={(value) => updateItemStatus(item.id, value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select new status" />
                            </SelectTrigger>
                            <SelectContent>
                              {ITEM_STATUSES.map((status) => {
                                const Icon = status.icon;
                                return (
                                  <SelectItem key={status.value} value={status.value}>
                                    <div className="flex items-center space-x-2">
                                      <Icon className="h-4 w-4" />
                                      <span>{status.label}</span>
                                    </div>
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        {item.notes && (
                          <div className="mt-3">
                            <Label className="text-xs text-gray-500">Item Notes</Label>
                            <p className="text-sm text-gray-700 bg-white p-2 rounded border">{item.notes}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Overall Repair Status (Optional) */}
          {repair && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Overall Repair Status (Optional)</CardTitle>
                <CardDescription>
                  Optionally update the overall repair status
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Overall Repair Status</Label>
                  <Select 
                    value={formData.repair_status || repair.status} 
                    onValueChange={(value) => setFormData(prev => ({ 
                      ...prev, 
                      repair_status: value as any
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select repair status" />
                    </SelectTrigger>
                    <SelectContent>
                      {REPAIR_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          <div className="flex items-center space-x-2">
                            <span className="capitalize">{status.replace('_', ' ')}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    Current status: <span className="font-medium capitalize">{repair.status.replace('_', ' ')}</span>
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <SheetFooter className="flex-shrink-0 border-t pt-4">
          <div className="flex justify-between w-full">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Settings className="h-4 w-4 mr-2" />
                  Update Status
                </>
              )}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}