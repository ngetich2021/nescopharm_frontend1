"use client";

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
  CheckCircle, 
  XCircle, 
  Search,
  Download,
  Plus,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  RefreshCw,
  Package,
  Wrench,
  Settings,
  UserPlus
} from "lucide-react";
import { type Repair } from "@/lib/repairs";

interface RepairsTableProps {
  repairs: Repair[];
  loading: boolean;
  onViewRepair: (repair: Repair) => void;
  onEditRepair: (repair: Repair) => void;
  onDeleteRepair: (repair: Repair) => void;
  onUpdateStatus: (repair: Repair) => void;
  onApproveRepair?: (repair: Repair) => void;
  onAssignRepair?: (repair: Repair) => void;
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

export function RepairsTable({
  repairs,
  loading,
  onViewRepair,
  onEditRepair,
  onDeleteRepair,
  onUpdateStatus,
  onApproveRepair,
  onAssignRepair,
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
}: RepairsTableProps) {
  const getStatusBadge = (status: string | null | undefined) => {
    if (!status) {
      return <Badge variant="secondary" className="bg-gray-100 text-gray-800">No Status</Badge>;
    }
    
    switch (status.toLowerCase()) {
      case "pending":
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Pending</Badge>;
      case "reported":
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Reported</Badge>;
      case "in_progress":
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">In Progress</Badge>;
      case "completed":
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Completed</Badge>;
      case "failed":
        return <Badge variant="secondary" className="bg-red-100 text-red-800">Failed</Badge>;
      case "cancelled":
        return <Badge variant="secondary" className="bg-gray-100 text-gray-800">Cancelled</Badge>;
      case "resolved":
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Resolved</Badge>;
      case "approved":
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Approved</Badge>;
      case "rejected":
        return <Badge variant="secondary" className="bg-red-100 text-red-800">Rejected</Badge>;
      default:
        return <Badge variant="outline" className="capitalize">{status}</Badge>;
    }
  };

  const getApprovalStatusBadge = (approvalStatus: string | null | undefined) => {
    if (!approvalStatus) {
      return <Badge variant="outline" className="border-gray-300 text-gray-600">Pending</Badge>;
    }
    
    switch (approvalStatus.toLowerCase()) {
      case "pending":
        return <Badge variant="outline" className="border-yellow-300 text-yellow-700 bg-yellow-50">Pending Approval</Badge>;
      case "approved":
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Approved</Badge>;
      case "rejected":
        return <Badge variant="secondary" className="bg-red-100 text-red-800">Rejected</Badge>;
      default:
        return <Badge variant="outline" className="capitalize">{approvalStatus}</Badge>;
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
                placeholder="Search repairs..."
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
              Report Repair
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
                <TableHead className="font-semibold">Repair #</TableHead>
                <TableHead className="font-semibold">Reporter</TableHead>
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
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#E30040]"></div>
                    <span>Loading repairs...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : repairs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">
                  <div className="text-gray-500">
                    <p className="font-semibold">No repairs found</p>
                    <p className="text-sm">Create your first repair report to get started</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              repairs.map((repair) => {
                const repairableItemsCount = repair.items.filter(item => item.is_repairable).length;
                return (
                  <TableRow 
                    key={repair.id} 
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => onViewRepair(repair)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-[#E30040]">
                          {repair.repair_number}
                        </span>
                        {repair.description && (
                          <span className="text-xs text-gray-500 mt-1 truncate max-w-[150px]">
                            {repair.description}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">
                          {repair.reporter?.first_name} {repair.reporter?.last_name}
                        </span>
                        <span className="text-xs text-gray-500">
                          {repair.reporter?.email}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">
                          {repair.items.length} item{repair.items.length !== 1 ? 's' : ''}
                        </span>
                        <span className="text-xs text-gray-500">
                          {repairableItemsCount > 0 && (
                            <span className="text-green-600">
                              {repairableItemsCount} repairable
                            </span>
                          )}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(repair.status)}
                    </TableCell>
                    <TableCell>
                      {getApprovalStatusBadge(repair.approval_status)}
                    </TableCell>
                    <TableCell>
                      {repair.approver ? (
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">
                            {repair.approver.first_name} {repair.approver.last_name}
                          </span>
                          <span className="text-xs text-gray-500">
                            {repair.approver.email}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-500">Not yet assigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {format(new Date(repair.created_at), "MMM dd, yyyy")}
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(repair.created_at), "HH:mm")}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <ActionsDropdown
                        repair={repair}
                        onView={() => onViewRepair(repair)}
                        onEdit={() => onEditRepair(repair)}
                        onDelete={() => onDeleteRepair(repair)}
                        onUpdateStatus={() => onUpdateStatus(repair)}
                        onApprove={onApproveRepair ? () => onApproveRepair(repair) : undefined}
                        onAssign={onAssignRepair ? () => onAssignRepair(repair) : undefined}
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
  repair,
  onView,
  onEdit,
  onDelete,
  onUpdateStatus,
  onApprove,
  onAssign
}: { 
  repair: Repair;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onUpdateStatus: () => void;
  onApprove?: () => void;
  onAssign?: () => void;
}) {
  const canEdit = repair.status === "pending" && repair.approval_status === "pending";
  const canDelete = repair.status === "pending" && repair.approval_status === "pending";
  const canUpdateStatus = repair.approval_status === "approved";
  const canApprove = repair.approval_status === "pending" && onApprove;
  
  // Can assign if repair is approved and has unassigned repairable items
  const hasUnassignedRepairableItems = repair.items?.some(item => 
    item.is_repairable && !item.assigned_to
  );
  const canAssign = repair.approval_status === "approved" && 
                   hasUnassignedRepairableItems && 
                   onAssign;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <span className="sr-only">Open menu</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuItem onClick={onView}>
          <Eye className="mr-2 h-4 w-4" />
          View Details
        </DropdownMenuItem>
        
        {canApprove && (
          <DropdownMenuItem onClick={onApprove} className="text-green-600 focus:text-green-600">
            <CheckCircle className="mr-2 h-4 w-4" />
            Approve/Reject
          </DropdownMenuItem>
        )}
        
        {canAssign && (
          <DropdownMenuItem onClick={onAssign} className="text-blue-600 focus:text-blue-600">
            <UserPlus className="mr-2 h-4 w-4" />
            Assign Items
          </DropdownMenuItem>
        )}
        
        {(canEdit || canUpdateStatus) && (
          <>
            <DropdownMenuSeparator />
            {canEdit && (
              <DropdownMenuItem onClick={onEdit}>
                <Edit className="mr-2 h-4 w-4" />
                Edit Repair
              </DropdownMenuItem>
            )}
            {canUpdateStatus && (
              <DropdownMenuItem onClick={onUpdateStatus}>
                <Settings className="mr-2 h-4 w-4" />
                Update Status
              </DropdownMenuItem>
            )}
          </>
        )}
        
        {canDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-red-600">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}