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
  Plus,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  RefreshCw,
  Users,
  Download,
  CreditCard
} from "lucide-react";
import { type Customer, getCustomerDisplayName } from "@/lib/customers";
import { STATUS_META as APPROVAL_STATUS_META } from "@/app/customers/[id]/application-status-section";
import { PermissionGuard } from "@/components/PermissionGuard";

interface CustomersTableProps {
  customers: Customer[];
  loading: boolean;
  onViewCustomer: (customer: Customer) => void;
  onEditCustomer: (customer: Customer) => void;
  onDeleteCustomer: (customer: Customer) => void;
  onViewAccount: (customer: Customer) => void;
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

export function CustomersTable({
  customers,
  loading,
  onViewCustomer,
  onEditCustomer,
  onDeleteCustomer,
  onViewAccount,
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
}: CustomersTableProps) {
  console.log("CustomersTable received props - customers:", customers, "loading:", loading, "typeof customers:", typeof customers);
  
  // Ensure customers is always an array
  const validCustomers = Array.isArray(customers) ? customers : [];
  console.log("Valid customers array:", validCustomers, "length:", validCustomers.length);

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Active</Badge>;
      case "inactive":
        return <Badge variant="secondary" className="bg-gray-100 text-gray-800">Inactive</Badge>;
      case "lead":
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Lead</Badge>;
      case "churned":
        return <Badge variant="secondary" className="bg-red-100 text-red-800">Churned</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const canEdit = (customer: Customer) => {
    return true; // All customers can be edited
  };

  const canDelete = (customer: Customer) => {
    return customer.status !== "active" || customer.total_orders === 0; // Can't delete active customers with orders
  };

  return (
    <div className="space-y-4">
      {/* Header with Search and Actions */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 items-center space-x-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <Input
              placeholder="Search customers by name, email, or phone..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-8 w-full md:w-[300px]"
            />
          </div>
          <Select value="all" onValueChange={() => {}}>
            <SelectTrigger className="w-[150px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Customers</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="lead">Leads</SelectItem>
              <SelectItem value="churned">Churned</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center space-x-2">
          <PermissionGuard permissions={["can_create_customers", "can_manage_system", "can_manage_company"]} hideOnDenied>
            <Button
              onClick={onCreateNew}
              variant="outline"
              className="border-[primary] text-[primary] bg-white hover:bg-[primary]/10"
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Add Customer
            </Button>
          </PermissionGuard>
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

      {/* Table */}
      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-semibold">Customer #</TableHead>
              <TableHead className="font-semibold">Name</TableHead>
              <TableHead className="font-semibold">Contact</TableHead>
              <TableHead className="font-semibold">Type</TableHead>
              <TableHead className="font-semibold">Payment Method</TableHead>
              <TableHead className="font-semibold">Location</TableHead>
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
                    <span>Loading customers...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : customers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">
                  <div className="flex flex-col items-center justify-center space-y-3">
                    <Users className="h-12 w-12 text-gray-400" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-gray-900">No customers found</p>
                      <p className="text-sm text-gray-500">Get started by adding your first customer</p>
                    </div>
                    <PermissionGuard permissions={["can_create_customers", "can_manage_system", "can_manage_company"]} hideOnDenied>
                      <Button
                        onClick={onCreateNew}
                        size="sm"
                        variant="outline"
                        className="border-primary text-primary bg-white hover:bg-primary/10"
                      >
                        <UserPlus className="mr-2 h-4 w-4" />
                        Add Customer
                      </Button>
                    </PermissionGuard>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              customers.map((customer) => {
                console.log("Rendering customer row:", customer);
                return (
                <TableRow 
                  key={customer.id} 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => onViewCustomer(customer)}
                >
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-primary">
                        {customer.customer_number || "N/A"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span className="font-medium text-gray-900">
                        {getCustomerDisplayName(customer)}
                      </span>
                      {customer.business_name?.trim() && customer.name && (
                        <span className="text-xs text-gray-500">Contact: {customer.name}</span>
                      )}
                      {customer.approval_status && customer.approval_status !== "approved" && (
                        <Badge
                          variant="outline"
                          className={`w-fit text-[11px] font-normal ${
                            APPROVAL_STATUS_META[customer.approval_status]?.className || "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {APPROVAL_STATUS_META[customer.approval_status]?.label || customer.approval_status}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm">
                        {customer.email || "No email"}
                      </span>
                      <span className="text-xs text-gray-500">
                        {customer.phone || "No phone"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm capitalize">
                      {customer.customer_type || "N/A"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm capitalize">
                      {customer.payment_method || "N/A"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-gray-500">{customer.city || "No city"}</span>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {format(new Date(customer.created_at), "MMM dd, yyyy")}
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(customer.created_at), "HH:mm")}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <CustomerActionsDropdown
                      customer={customer}
                      onView={() => onViewCustomer(customer)}
                      onEdit={() => onEditCustomer(customer)}
                      onDelete={() => onDeleteCustomer(customer)}
                      onViewAccount={onViewAccount}
                      canEdit={canEdit(customer)}
                      canDelete={canDelete(customer)}
                    />
                  </TableCell>
                </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
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
            className="border-gray-200 hover:bg-[primary]/10 hover:text-[primary] hover:border-[primary]"
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
            className="border-gray-200 hover:bg-[primary]/10 hover:text-[primary] hover:border-[primary]"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

interface CustomerActionsDropdownProps {
  customer: Customer;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onViewAccount: (customer: Customer) => void;
  canEdit: boolean;
  canDelete: boolean;
}

function CustomerActionsDropdown({
  customer,
  onView,
  onEdit,
  onDelete,
  onViewAccount,
  canEdit,
  canDelete,
}: CustomerActionsDropdownProps) {
  const handleDropdownClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0" onClick={handleDropdownClick}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onView(); }}>
          <Eye className="h-4 w-4 mr-2" /> View Details
        </DropdownMenuItem>
        {customer.account_id && (
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onViewAccount(customer); }}>
            <CreditCard className="h-4 w-4 mr-2" /> View Account
          </DropdownMenuItem>
        )}
        <PermissionGuard permissions={["can_update_customers", "can_manage_system", "can_manage_company"]} hideOnDenied>
          {canEdit && (
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>
              <Edit className="h-4 w-4 mr-2" /> Edit Customer
            </DropdownMenuItem>
          )}
        </PermissionGuard>
        <PermissionGuard permissions={["can_delete_customers", "can_manage_system", "can_manage_company"]} hideOnDenied>
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-red-600 focus:text-red-600">
                <Trash2 className="h-4 w-4 mr-2" /> Delete Customer
              </DropdownMenuItem>
            </>
          )}
        </PermissionGuard>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}