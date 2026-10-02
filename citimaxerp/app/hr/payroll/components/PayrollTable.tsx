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
  CheckCircle,
  XCircle,
  Clock,
  CreditCard,
  DollarSign,
  MessageSquare
} from "lucide-react";
import { formatCurrency } from "@/lib/finance";
import { PayrollRecord } from "@/lib/payroll";

interface PayrollTableProps {
  payrollRecords: PayrollRecord[];
  loading: boolean;
  onViewPayroll: (payroll: PayrollRecord) => void;
  onEditPayroll: (payroll: PayrollRecord) => void;
  onDeletePayroll: (payroll: PayrollRecord) => void;
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

export function PayrollTable({
  payrollRecords,
  loading,
  onViewPayroll,
  onEditPayroll,
  onDeletePayroll,
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
}: PayrollTableProps) {
  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "draft":
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Draft</Badge>;
      case "approved":
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Approved</Badge>;
      case "paid":
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Paid</Badge>;
      case "cancelled":
        return <Badge variant="secondary" className="bg-red-100 text-red-800">Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case "draft":
        return <Clock className="h-4 w-4" />;
      case "approved":
        return <CheckCircle className="h-4 w-4" />;
      case "paid":
        return <CreditCard className="h-4 w-4" />;
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
                placeholder="Search payroll records..."
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
              />
            </div>
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" size="sm" asChild>
              <a href="/hr/payroll/bulk">
                <DollarSign className="mr-2 h-4 w-4" />
                Bulk Processing
              </a>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onCreateNew}
              className="border-primary text-primary hover:bg-primary/10"
            >
              <Plus className="mr-2 h-4 w-4" />
              New Payroll
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
                <TableHead className="font-semibold">Payroll Number</TableHead>
                <TableHead className="font-semibold">Pay Period</TableHead>
                <TableHead className="font-semibold">Employees</TableHead>
                <TableHead className="font-semibold">Gross Pay</TableHead>
                <TableHead className="font-semibold">Deductions</TableHead>
                <TableHead className="font-semibold">Net Pay</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold">Pay Date</TableHead>
                <TableHead className="text-right font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center">
                  <div className="flex items-center justify-center space-x-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                    <span>Loading payroll records...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : payrollRecords.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center">
                  <div className="text-gray-500">
                    <p className="font-semibold">No payroll records found</p>
                    <p className="text-sm">Create your first payroll record to get started</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              payrollRecords.map((record) => {
                return (
                  <TableRow 
                    key={record.id} 
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => onViewPayroll(record)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-primary">
                          {record.payroll_number}
                        </span>
                        <span className="text-xs text-gray-500">
                          Created {format(new Date(record.created_at), 'MMM d, yyyy')}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">
                          {format(new Date(record.pay_period_start), 'MMM d')} - {format(new Date(record.pay_period_end), 'MMM d, yyyy')}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-medium">{record.employee_count}</span>
                        <span className="text-xs text-gray-500">employees</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {formatCurrency(parseFloat(record.total_gross_pay))}
                    </TableCell>
                    <TableCell>
                      {formatCurrency(parseFloat(record.total_deductions))}
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(parseFloat(record.total_net_pay))}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {getStatusIcon(record.status)}
                        {getStatusBadge(record.status)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {format(new Date(record.pay_date), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <ActionsDropdown
                        payrollRecord={record}
                        onView={() => onViewPayroll(record)}
                        onEdit={() => onEditPayroll(record)}
                        onDelete={() => onDeletePayroll(record)}
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
  payrollRecord,
  onView,
  onEdit,
  onDelete
}: { 
  payrollRecord: PayrollRecord;
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
          <Edit className="h-4 w-4 mr-2" /> Edit Payroll
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onDelete} className="text-red-600 focus:text-red-600">
          <Trash2 className="h-4 w-4 mr-2" /> Delete Payroll
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}