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
  UserCheck,
  UserX,
  Users
} from "lucide-react";
import { type Employee } from "@/lib/employees";

interface EmployeesTableProps {
  employees: Employee[];
  loading: boolean;
  onViewEmployee: (employee: Employee) => void;
  onEditEmployee: (employee: Employee) => void;
  onDeleteEmployee: (employee: Employee) => void;
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
  onTerminateEmployee?: (employee: Employee) => void;
  onExportExcel?: () => void;
}

export function EmployeesTable({
  employees,
  loading,
  onViewEmployee,
  onEditEmployee,
  onDeleteEmployee,
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
  onTerminateEmployee,
  onExportExcel,
}: EmployeesTableProps) {
  const getStatusBadge = (status: string | undefined) => {
    if (!status) {
      return <Badge variant="secondary">Unknown</Badge>;
    }
    
    switch (status.toLowerCase()) {
      case "active":
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Active</Badge>;
      case "inactive":
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Inactive</Badge>;
      case "terminated":
        return <Badge variant="secondary" className="bg-red-100 text-red-800">Terminated</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getStatusIcon = (status: string | undefined) => {
    if (!status) {
      return <Users className="h-4 w-4" />;
    }
    
    switch (status.toLowerCase()) {
      case "active":
        return <UserCheck className="h-4 w-4" />;
      case "inactive":
        return <UserX className="h-4 w-4" />;
      case "terminated":
        return <UserX className="h-4 w-4" />;
      default:
        return <Users className="h-4 w-4" />;
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
                placeholder="Search employees..."
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
              className="border-[#1E2764] text-[#1E2764] hover:bg-[#1E2764]/10"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Employee
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onExportExcel}
              className="border-[#1E2764] text-[#1E2764] hover:bg-[#1E2764]/10"
            >
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
                <TableHead className="font-semibold">Employee #</TableHead>
                <TableHead className="font-semibold">Name</TableHead>
                <TableHead className="font-semibold">Phone</TableHead>
                <TableHead className="font-semibold">Email</TableHead>
                <TableHead className="font-semibold">Gender</TableHead>
                <TableHead className="font-semibold">Department</TableHead>
                <TableHead className="font-semibold">Position</TableHead>
                <TableHead className="font-semibold">Created</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="text-right font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center">
                  <div className="flex items-center justify-center space-x-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#1E2764]"></div>
                    <span>Loading employees...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : employees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center">
                  <div className="text-gray-500">
                    <p className="font-semibold">No employees found</p>
                    <p className="text-sm">Add your first employee to get started</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              employees.map((employee) => {
                // Determine employment status based on is_active field
                const status = employee.employment_status || (employee.termination_date ? 'terminated' : employee.is_active ? 'active' : 'inactive');
                
                return (
                  <TableRow 
                    key={employee.id} 
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => onViewEmployee(employee)}
                  >
                    <TableCell className="font-semibold text-[#1E2764]">
                      {employee.employee_number}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-gray-500">
                          {[employee.first_name, employee.last_name].filter(Boolean).join(" ")}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm">{employee.phone}</span>
                      </div>
                    </TableCell>
                     <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm">{employee.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {employee.gender ? employee.gender.charAt(0).toUpperCase() + employee.gender.slice(1) : 'N/A'}
                    </TableCell>
                    <TableCell>
                      {employee.department}
                    </TableCell>
                    <TableCell>
                      {employee.position}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {employee.created_at ? new Date(employee.created_at).toLocaleDateString() : 'N/A'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {getStatusBadge(status)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <ActionsDropdown
                        employee={employee}
                        onView={() => onViewEmployee(employee)}
                        onEdit={() => onEditEmployee(employee)}
                        onTerminate={onTerminateEmployee ? () => onTerminateEmployee(employee) : undefined}
                        onDelete={() => onDeleteEmployee(employee)}
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
    </>
  );
}

function ActionsDropdown({ 
  employee,
  onView,
  onEdit,
  onTerminate,
  onDelete
}: { 
  employee: Employee;
  onView: () => void;
  onEdit: () => void;
  onTerminate?: () => void;
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
          <Edit className="h-4 w-4 mr-2" /> Edit Employee
        </DropdownMenuItem>
        {employee.employment_status !== "terminated" && onTerminate && (
          <DropdownMenuItem onClick={onTerminate}>
            <UserX className="h-4 w-4 mr-2" /> Terminate Employee
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onDelete} className="text-primary focus:text-primary">
          <Trash2 className="h-4 w-4 mr-2" /> Delete Employee
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
