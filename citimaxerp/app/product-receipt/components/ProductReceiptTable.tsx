"use client";
import { useState } from "react";
import * as React from "react";
import { format } from "date-fns";
import { ProductReceiptDetailsModal } from "./ProductReceiptDetailsModal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Search,
  Download,
  Plus,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Package,
  Store,
  User
} from "lucide-react";

interface ProductReceiptTableProps {
  receipts: any[];
  loading: boolean;
  onViewReceipt: (receipt: any) => void;
  onEditReceipt: (receipt: any) => void;
  onDeleteReceipt: (receipt: any) => void;
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
}

export default function ProductReceiptTable({
  receipts,
  loading,
  onViewReceipt,
  onEditReceipt,
  onDeleteReceipt,
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
}: ProductReceiptTableProps) {
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const openDetails = (id: string) => {
    setSelectedId(id);
    setDetailsModalOpen(true);
  };

  const getDocumentTypeBadge = (documentType: string) => {
    switch (documentType?.toLowerCase()) {
      case "purchase_order":
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Purchase Order</Badge>;
      case "invoice":
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Invoice</Badge>;
      case "delivery_note":
        return <Badge variant="secondary" className="bg-purple-100 text-purple-800">Delivery Note</Badge>;
      case "manual":
        return <Badge variant="secondary" className="bg-orange-100 text-orange-800">Manual</Badge>;
      default:
        return <Badge variant="secondary">{documentType}</Badge>;
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
                placeholder="Search receipts..."
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
              />
            </div>
          </div>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onCreateNew}
              className="border-[#E30040] text-[#E30040] hover:bg-[#E30040]/10"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Receipt
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
                <TableHead className="font-semibold">Receipt #</TableHead>
                <TableHead className="font-semibold">Store</TableHead>
                <TableHead className="font-semibold">Supplier</TableHead>
                <TableHead className="font-semibold">Items</TableHead>
                <TableHead className="font-semibold">Document Type</TableHead>
                <TableHead className="font-semibold">Received By</TableHead>
                <TableHead className="font-semibold">Created</TableHead>
                <TableHead className="text-right font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
                    <div className="flex items-center justify-center space-x-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#E30040]"></div>
                      <span>Loading product receipts...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : receipts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
                    <div className="text-gray-500">
                      <p className="font-semibold">No product receipts found</p>
                      <p className="text-sm">Create your first receipt to get started</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                receipts.map((receipt) => {
                  return (
                    <TableRow 
                      key={receipt.id} 
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => openDetails(receipt.id)}
                    >
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-[#E30040]">
                            {receipt.product_receipt_number || receipt.reference_number}
                          </span>
                          {receipt.reference_number && receipt.product_receipt_number !== receipt.reference_number && (
                            <span className="text-xs text-gray-500 mt-1">
                              Ref: {receipt.reference_number}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">
                            {receipt.store?.name || "-"}
                          </span>
                          {receipt.store?.code && (
                            <span className="text-xs text-gray-500">
                              {receipt.store.code}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">
                            {receipt.supplier?.name || "-"}
                          </span>
                          {receipt.supplier?.email && (
                            <span className="text-xs text-gray-500">
                              {receipt.supplier.email}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">
                            {receipt.items_count || 0} item{(receipt.items_count || 0) !== 1 ? 's' : ''}
                          </span>
                          {receipt.product_receipt_items && (
                            <span className="text-xs text-gray-500">
                              Total Qty: {receipt.product_receipt_items.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0)}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {getDocumentTypeBadge(receipt.document_type)}
                      </TableCell>
                      <TableCell>
                        {receipt.recipient ? (
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">
                              {[receipt.recipient.first_name, receipt.recipient.last_name].filter(Boolean).join(" ") || "-"}
                            </span>
                            {receipt.recipient.email && (
                              <span className="text-xs text-gray-500">
                                {receipt.recipient.email}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-500">Not specified</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {receipt.created_at ? format(new Date(receipt.created_at), "MMM dd, yyyy") : "-"}
                          {receipt.created_at && (
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(receipt.created_at), "HH:mm")}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <ActionsDropdown
                          receipt={receipt}
                          onView={() => openDetails(receipt.id)}
                          onEdit={() => onEditReceipt(receipt)}
                          onDelete={() => onDeleteReceipt(receipt)}
                        />
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
              className="border-gray-200 hover:bg-[#E30040]/10 hover:text-[#E30040] hover:border-[#E30040]"
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
              className="border-gray-200 hover:bg-[#E30040]/10 hover:text-[#E30040] hover:border-[#E30040]"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      <ProductReceiptDetailsModal 
        open={detailsModalOpen} 
        onOpenChange={(v: boolean) => { 
          setDetailsModalOpen(v); 
          if (!v) setSelectedId(null); 
        }} 
        receiptId={selectedId}
        onEdit={(receiptId: string) => {
          // Find the receipt object and call the edit handler
          const receipt = receipts.find(r => r.id === receiptId);
          if (receipt) {
            onEditReceipt(receipt);
          }
        }}
      />
    </>
  );
}

function ActionsDropdown({ 
  receipt,
  onView,
  onEdit,
  onDelete
}: { 
  receipt: any;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  // Define action availability based on receipt status/conditions
  const canEdit = true; // Can be modified based on receipt status
  const canDelete = true; // Can be modified based on receipt status

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuItem onClick={onView}>
          <Eye className="h-4 w-4 mr-2" /> View Details
        </DropdownMenuItem>
        {canEdit && (
          <DropdownMenuItem onClick={onEdit}>
            <Edit className="h-4 w-4 mr-2" /> Edit Receipt
          </DropdownMenuItem>
        )}
        {canDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-red-600 focus:text-red-600">
              <Trash2 className="h-4 w-4 mr-2" /> Delete Receipt
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}