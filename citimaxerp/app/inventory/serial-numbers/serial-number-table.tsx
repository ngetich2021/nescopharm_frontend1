"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Eye, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  Package,
  RefreshCw,
  Download
} from "lucide-react";
import type { SerialNumber } from "@/types/serial-numbers";
import { SerialNumberDetailsSheet } from "@/app/inventory/serial-numbers/components/serial-number-details-sheet";
import { AddSerialNumberSheet } from "@/app/inventory/serial-numbers/components/add-serial-number-sheet";
import { EditSerialNumberSheet } from "@/app/inventory/serial-numbers/components/edit-serial-number-sheet";
import { AssignBatchSheet } from "@/app/inventory/serial-numbers/components/assign-batch-sheet";
import { deleteSerialNumber } from "@/lib/serial-numbers";
import { useToast } from "@/hooks/use-toast";

interface SerialNumberTableProps {
  serialNumbers: SerialNumber[];
  loading: boolean;
  onViewSerialNumber: (serialNumber: SerialNumber) => void;
  onEditSerialNumber: (serialNumber: SerialNumber) => void;
  onDeleteSerialNumber: (serialNumber: SerialNumber) => void;
  onAssignBatch: (serialNumber: SerialNumber) => void;
  search: string;
  onSearchChange: (search: string) => void;
  currentPage: number;
  totalPages: number;
  rowsPerPage: number;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (rowsPerPage: number) => void;
  totalItems: number;
  onRefresh: () => void;
  onCreateNew: () => void;
  onAddSerialNumber: () => void;
}

export function SerialNumberTable({
  serialNumbers,
  loading,
  onViewSerialNumber,
  onEditSerialNumber,
  onDeleteSerialNumber,
  onAssignBatch,
  search,
  onSearchChange,
  currentPage,
  totalPages,
  rowsPerPage,
  onPageChange,
  onRowsPerPageChange,
  totalItems,
  onRefresh,
  onCreateNew,
  onAddSerialNumber,
}: SerialNumberTableProps) {
  const { toast } = useToast();
  const [selectedSerialNumberId, setSelectedSerialNumberId] = useState<string | null>(null);
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
  const [isAssignBatchSheetOpen, setIsAssignBatchSheetOpen] = useState(false);
  const [editingSerialNumber, setEditingSerialNumber] = useState<SerialNumber | null>(null);

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Active</Badge>;
      case "inactive":
        return <Badge variant="secondary" className="bg-gray-100 text-gray-800">Inactive</Badge>;
      case "sold":
        return <Badge variant="secondary" className="bg-purple-100 text-purple-800">Sold</Badge>;
      case "returned":
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Returned</Badge>;
      case "damaged":
        return <Badge variant="secondary" className="bg-red-100 text-red-800">Damaged</Badge>;
      case "expired":
        return <Badge variant="secondary" className="bg-gray-100 text-gray-800">Expired</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handleDeleteSerialNumber = async (serialNumber: SerialNumber) => {
    try {
      await deleteSerialNumber(serialNumber.id);
      toast({
        title: "Success",
        description: "Serial number deleted successfully",
      });
      onDeleteSerialNumber(serialNumber);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete serial number",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex space-x-4">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500" />
              <Input
                className="pl-8 max-w-sm"
                placeholder="Search serial numbers..."
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
              />
            </div>
          </div>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onAddSerialNumber}
              className="border-[#1E2764] text-[#1E2764] hover:bg-[#1E2764]/10"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Serial Number
            </Button>
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button variant="outline" size="sm" onClick={onRefresh}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>
        <div className="rounded-md border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-semibold">Serial Number</TableHead>
                <TableHead className="font-semibold">Product</TableHead>
                <TableHead className="font-semibold">Batch</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold">Received Date</TableHead>
                <TableHead className="font-semibold">Warranty Expiry</TableHead>
                <TableHead className="text-right font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  <div className="flex items-center justify-center space-x-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#1E2764]"></div>
                    <span>Loading serial numbers...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : serialNumbers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  <div className="text-gray-500">
                    <p className="font-semibold">No serial numbers found</p>
                    <p className="text-sm">Add your first serial number to get started</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              serialNumbers.map((serialNumber) => {
                return (
                  <TableRow 
                    key={serialNumber.id} 
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => onViewSerialNumber(serialNumber)}
                  >
                    <TableCell className="font-medium">
                      {serialNumber.serial_number}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">
                          {serialNumber.product?.name || serialNumber.product_id}
                        </span>
                        {serialNumber.product?.sku && (
                          <span className="text-xs text-gray-500">
                            SKU: {serialNumber.product.sku}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {serialNumber.batch?.batch_number || serialNumber.batch_id || "-"}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(serialNumber.status)}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {format(new Date(serialNumber.received_date), "MMM dd, yyyy")}
                      </div>
                    </TableCell>
                    <TableCell>
                      {serialNumber.warranty_expiry_date ? (
                        <div className="text-sm">
                          {format(new Date(serialNumber.warranty_expiry_date), "MMM dd, yyyy")}
                        </div>
                      ) : (
                        <span>-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => onViewSerialNumber(serialNumber)}>
                            <Eye className="h-4 w-4 mr-2" /> View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            setEditingSerialNumber(serialNumber);
                            setIsEditSheetOpen(true);
                          }}>
                            <Edit className="h-4 w-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            setEditingSerialNumber(serialNumber);
                            setIsAssignBatchSheetOpen(true);
                          }}>
                            <Package className="h-4 w-4 mr-2" /> Assign Batch
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => handleDeleteSerialNumber(serialNumber)}
                            className="text-primary focus:text-primary"
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <p className="text-sm font-medium">Rows per page</p>
            <Select
              value={rowsPerPage.toString()}
              onValueChange={(value) => {
                onRowsPerPageChange(Number(value));
                onPageChange(1);
              }}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue placeholder={rowsPerPage} />
              </SelectTrigger>
              <SelectContent side="top">
                {[5, 10, 20, 30, 40, 50].map((pageSize) => (
                  <SelectItem key={pageSize} value={pageSize.toString()}>
                    {pageSize}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
              disabled={currentPage === 1}
              className="border-gray-200 hover:bg-[#1E2764]/10 hover:text-[#1E2764] hover:border-[#1E2764]"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <div className="flex items-center justify-center text-sm font-medium">
              Page {currentPage} of {totalPages || 1}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(Math.min(currentPage + 1, totalPages || 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="border-gray-200 hover:bg-[#1E2764]/10 hover:text-[#1E2764] hover:border-[#1E2764]"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Details Sheet */}
      {selectedSerialNumberId && (
        <SerialNumberDetailsSheet
          serialId={selectedSerialNumberId}
          open={!!selectedSerialNumberId}
          onOpenChange={(open: boolean) => {
            if (!open) setSelectedSerialNumberId(null)
          }}
          onSerialNumberUpdated={() => {}}
        />
      )}

      {/* Add Serial Number Sheet */}
      <AddSerialNumberSheet
        open={isAddSheetOpen}
        onOpenChange={setIsAddSheetOpen}
        onSerialNumberAdded={() => {}}
      />

      {/* Edit Serial Number Sheet */}
      {editingSerialNumber && (
        <EditSerialNumberSheet
          serialNumber={editingSerialNumber}
          open={isEditSheetOpen}
          onOpenChange={(open: boolean) => {
            if (!open) setEditingSerialNumber(null)
          }}
          onSerialNumberUpdated={() => {}}
        />
      )}

      {/* Assign Batch Sheet */}
      {editingSerialNumber && (
        <AssignBatchSheet
          serialNumber={editingSerialNumber}
          open={isAssignBatchSheetOpen}
          onOpenChange={(open: boolean) => {
            if (!open) setEditingSerialNumber(null)
          }}
          onBatchAssigned={() => {}}
        />
      )}
    </>
  );
}