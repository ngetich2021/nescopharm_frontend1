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
  Search,
  Filter,
  Download,
  Plus,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Calendar,
  CheckCircle,
  XCircle,
  Clock
} from "lucide-react";

interface LeaveRequest {
  id: string;
  employee: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: string;
}

interface LeaveManagementTableProps {
  leaveRequests: LeaveRequest[];
  loading: boolean;
  onViewLeaveRequest: (leaveRequest: LeaveRequest) => void;
  onEditLeaveRequest: (leaveRequest: LeaveRequest) => void;
  onDeleteLeaveRequest: (leaveRequest: LeaveRequest) => void;
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

export function LeaveManagementTable({
  leaveRequests,
  loading,
  onViewLeaveRequest,
  onEditLeaveRequest,
  onDeleteLeaveRequest,
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
}: LeaveManagementTableProps) {
  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "pending":
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case "approved":
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Approved</Badge>;
      case "rejected":
        return <Badge variant="secondary" className="bg-red-100 text-red-800">Rejected</Badge>;
      case "cancelled":
        return <Badge variant="secondary" className="bg-gray-100 text-gray-800">Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case "pending":
        return <Clock className="h-4 w-4" />;
      case "approved":
        return <CheckCircle className="h-4 w-4" />;
      case "rejected":
        return <XCircle className="h-4 w-4" />;
      case "cancelled":
        return <XCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
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
                placeholder="Search leave requests..."
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
              Request Leave
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
                <TableHead className="font-semibold">Employee</TableHead>
                <TableHead className="font-semibold">Leave Type</TableHead>
                <TableHead className="font-semibold">Dates</TableHead>
                <TableHead className="font-semibold">Reason</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="text-right font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <div className="flex items-center justify-center space-x-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                    <span>Loading leave requests...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : leaveRequests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <div className="text-gray-500">
                    <p className="font-semibold">No leave requests found</p>
                    <p className="text-sm">Request your first leave to get started</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              leaveRequests.map((request) => {
                return (
                  <TableRow 
                    key={request.id} 
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => onViewLeaveRequest(request)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-primary">
                          {request.employee}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {request.leaveType}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm">
                          {format(new Date(request.startDate), "MMM dd, yyyy")}
                        </span>
                        <span className="text-xs text-gray-500">
                          to {format(new Date(request.endDate), "MMM dd, yyyy")}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[200px] truncate" title={request.reason}>
                        {request.reason}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {getStatusIcon(request.status)}
                        {getStatusBadge(request.status)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <ActionsDropdown
                        leaveRequest={request}
                        onView={() => onViewLeaveRequest(request)}
                        onEdit={() => onEditLeaveRequest(request)}
                        onDelete={() => onDeleteLeaveRequest(request)}
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
              className="border-gray-200 hover:bg-primary/10 hover:text-primary hover:border-primary"
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
              className="border-gray-200 hover:bg-primary/10 hover:text-primary hover:border-primary"
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
  leaveRequest,
  onView,
  onEdit,
  onDelete
}: { 
  leaveRequest: LeaveRequest;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
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
        <DropdownMenuItem onClick={onEdit}>
          <Edit className="h-4 w-4 mr-2" /> Edit Request
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onDelete} className="text-red-600 focus:text-red-600">
          <Trash2 className="h-4 w-4 mr-2" /> Delete Request
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}