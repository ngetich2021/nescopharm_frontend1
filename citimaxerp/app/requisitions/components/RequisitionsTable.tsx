"use client";

import { format } from "date-fns";
import { useAuth } from "@/lib/auth-context";
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
  CheckCircle, 
  XCircle, 
  Search,
  Filter,
  Download,
  Plus,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  RefreshCw,
  Package
} from "lucide-react";
import { type Requisition } from "@/lib/requisitions";

interface RequisitionsTableProps {
  requisitions: Requisition[];
  loading: boolean;
  onViewRequisition: (requisition: Requisition) => void;
  onEditRequisition: (requisition: Requisition) => void;
  onDeleteRequisition: (requisition: Requisition) => void;
  onApproveRequisition: (requisition: Requisition) => void;
  onCreateDispatch: (requisition: Requisition) => void;
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

export function RequisitionsTable({
  requisitions,
  loading,
  onViewRequisition,
  onEditRequisition,
  onDeleteRequisition,
  onApproveRequisition,
  onCreateDispatch,
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
}: RequisitionsTableProps) {
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
    <>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex space-x-4">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500" />
              <Input
                className="pl-8 max-w-sm"
                placeholder="Search requisitions..."
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
              className="border-primary text-primary hover:bg-primary/10"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Requisition
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
                <TableHead className="font-semibold">Requisition #</TableHead>
                <TableHead className="font-semibold">Requester</TableHead>
                <TableHead className="font-semibold">Items</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold">Approval Status</TableHead>
                <TableHead className="font-semibold">Approver</TableHead>
                <TableHead className="font-semibold">Created</TableHead>
                <TableHead className="text-right font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">
                  <div className="flex items-center justify-center space-x-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                    <span>Loading requisitions...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : requisitions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">
                  <div className="text-gray-500">
                    <p className="font-semibold">No requisitions found</p>
                    <p className="text-sm">Create your first requisition to get started</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              requisitions.map((requisition) => {
                return (
                  <TableRow 
                    key={requisition.id} 
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => onViewRequisition(requisition)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-primary">
                          {requisition.requisition_number}
                        </span>
                        {requisition.notes && (
                          <span className="text-xs text-gray-500 mt-1 truncate max-w-[150px]">
                            {requisition.notes}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">
                          {requisition.requester.first_name} {requisition.requester.last_name}
                        </span>
                        <span className="text-xs text-gray-500">
                          {requisition.requester.email}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">
                          {requisition.items.length} item{requisition.items.length !== 1 ? 's' : ''}
                        </span>
                        <span className="text-xs text-gray-500">
                          Total Qty: {requisition.items.reduce((sum, item) => sum + item.quantity, 0)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(requisition.status)}
                    </TableCell>
                    <TableCell>
                      {getApprovalStatusBadge(requisition.approval_status)}
                    </TableCell>
                    <TableCell>
                      {requisition.approver ? (
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">
                            {requisition.approver.first_name} {requisition.approver.last_name}
                          </span>
                          <span className="text-xs text-gray-500">
                            {requisition.approver.email}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-500">Not yet assigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {format(new Date(requisition.created_at), "MMM dd, yyyy")}
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(requisition.created_at), "HH:mm")}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <ActionsDropdown
                        requisition={requisition}
                        onView={() => onViewRequisition(requisition)}
                        onEdit={() => onEditRequisition(requisition)}
                        onDelete={() => onDeleteRequisition(requisition)}
                        onApprove={() => onApproveRequisition(requisition)}
                        onCreateDispatch={() => onCreateDispatch(requisition)}
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
    </>
  );
}

function ActionsDropdown({ 
  requisition,
  onView,
  onEdit,
  onDelete,
  onApprove,
  onCreateDispatch
}: { 
  requisition: Requisition;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onApprove: () => void;
  onCreateDispatch: () => void;
}) {
  const { hasPermission } = useAuth();
  const canEdit = requisition.status === "pending" && requisition.approval_status === "pending" && hasPermission("can_update_requisitions");
  const canDelete = requisition.status === "pending" && requisition.approval_status === "pending" && hasPermission("can_delete_requisitions");
  const canApprove = requisition.approval_status === "pending" && hasPermission("can_approve_requisitions");
  const canCreateDispatch = requisition.approval_status === "approved" && !requisition.dispatch_id;

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
        {canApprove && (
          <DropdownMenuItem onClick={onApprove} className="text-green-600 focus:text-green-600">
            <CheckCircle className="h-4 w-4 mr-2" /> Approve Requisition
          </DropdownMenuItem>
        )}
        {canCreateDispatch && (
          <DropdownMenuItem onClick={onCreateDispatch} className="text-blue-600 focus:text-blue-600">
            <Package className="h-4 w-4 mr-2" /> Create Dispatch
          </DropdownMenuItem>
        )}
        {canEdit && (
          <DropdownMenuItem onClick={onEdit}>
            <Edit className="h-4 w-4 mr-2" /> Edit Requisition
          </DropdownMenuItem>
        )}
        {canDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-red-600 focus:text-red-600">
              <Trash2 className="h-4 w-4 mr-2" /> Delete Requisition
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}