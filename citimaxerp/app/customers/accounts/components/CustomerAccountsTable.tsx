"use client";

import { useState } from "react";
import { format } from "date-fns";
import { getCustomerDisplayName } from "@/lib/customers";
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
  CheckCircle,
  XCircle,
  CreditCard,
  Loader2,
} from "lucide-react";
import { type CustomerAccountWithDetails } from "@/lib/customer-accounts";
import { CreditLimitRequestModal } from "@/components/modals/credit-limit-request-modal";
import { CreditLimitApprovalModal } from "@/components/modals/credit-limit-approval-modal";
import { PermissionGuard } from "@/components/PermissionGuard";

interface CustomerAccountsTableProps {
  accounts: CustomerAccountWithDetails[];
  loading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  currentPage: number;
  totalPages: number;
  rowsPerPage: number;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (value: number) => void;
  totalItems: number;
  onRefresh: () => void;
  onCreateNew: () => void;
  onViewAccount: (account: CustomerAccountWithDetails) => void;
  onEditAccount: (account: CustomerAccountWithDetails) => void;
  onDeleteAccount: (account: CustomerAccountWithDetails) => void;
  onApproveAccount: (account: CustomerAccountWithDetails) => void;
  onRejectAccount: (account: CustomerAccountWithDetails) => void;
  onCreditLimitRequest?: (account: CustomerAccountWithDetails) => void;
  onApproveCreditLimit?: (account: CustomerAccountWithDetails, approvalId: string) => void;
  onRejectCreditLimit?: (account: CustomerAccountWithDetails, approvalId: string) => void;
}

export function CustomerAccountsTable({
  accounts,
  loading,
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
  onViewAccount,
  onEditAccount,
  onDeleteAccount,
  onApproveAccount,
  onRejectAccount,
  onCreditLimitRequest,
  onApproveCreditLimit,
  onRejectCreditLimit,
}: CustomerAccountsTableProps) {
  console.log("CustomerAccountsTable received props - accounts:", accounts, "loading:", loading, "typeof accounts:", typeof accounts);
  
  // Ensure accounts is always an array
  const validAccounts = Array.isArray(accounts) ? accounts : [];
  console.log("Valid accounts array:", validAccounts, "length:", validAccounts.length);

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "approved":
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Approved</Badge>;
      case "pending":
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case "rejected":
        return <Badge variant="secondary" className="bg-red-100 text-red-800">Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
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
                placeholder="Search accounts..."
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
              Create Account
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
                <TableHead className="font-semibold">Account #</TableHead>
                <TableHead className="font-semibold">Customer</TableHead>
                <TableHead className="font-semibold">Credit Limit</TableHead>
                <TableHead className="font-semibold">Credit Period</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold">Pending Approvals</TableHead>
                <TableHead className="font-semibold">Created</TableHead>
                <TableHead className="text-right font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                                    <TableCell colSpan={8} className="h-24 text-center">
                    <div className="flex flex-col items-center">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <p className="mt-2 text-sm text-muted-foreground">Loading accounts...</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : accounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
                    <div className="text-gray-500">
                      <p className="font-semibold">No customer accounts found</p>
                      <p className="text-sm">Create your first account to get started</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                accounts.map((account) => (
                  <TableRow 
                    key={account.id} 
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => onViewAccount(account)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-primary">
                          {account.account_number}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {account.customer ? getCustomerDisplayName(account.customer) : "Unknown Customer"}
                          </span>
                          {(() => {
                            const pendingCreditLimitApprovals = account.approvals?.filter(
                              approval => approval.approval_type === "credit_limit_update" && approval.status === "pending"
                            ) || [];
                            
                            if (pendingCreditLimitApprovals.length > 0) {
                              return (
                                <div className="flex items-center">
                                  <div className="h-2 w-2 bg-orange-500 rounded-full animate-pulse" title="Has pending credit limit approval"></div>
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>
                        {account.customer?.email && (
                          <span className="text-xs text-gray-500">
                            {account.customer.email}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {account.credit_required ? `KES ${parseFloat(account.credit_required).toLocaleString()}` : "N/A"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {account.credit_period_required || "N/A"}
                      </div>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        // Determine account status based on available properties
                        if (account.is_approved) {
                          return getStatusBadge("approved");
                        } else if (account.approval_status) {
                          return getStatusBadge(account.approval_status);
                        } else {
                          return getStatusBadge("pending");
                        }
                      })()}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const pendingCreditLimitApprovals = account.approvals?.filter(
                          approval => approval.approval_type === "credit_limit_update" && approval.status === "pending"
                        ) || [];
                        
                        if (pendingCreditLimitApprovals.length > 0) {
                          const approval = pendingCreditLimitApprovals[0]; // Get the first pending approval
                          const requestedAmount = approval.new_credit_limit ? parseFloat(approval.new_credit_limit) : 0;
                          const currentAmount = approval.previous_credit_limit ? parseFloat(approval.previous_credit_limit) : 0;
                          const changeAmount = requestedAmount - currentAmount;
                          
                          return (
                            <div className="flex flex-col gap-1">
                              <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-xs w-fit">
                                <CreditCard className="h-3 w-3 mr-1" />
                                Credit Limit Update
                              </Badge>
                            </div>
                          );
                        }
                        
                        return (
                          <div className="text-xs text-gray-400">No pending approvals</div>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {account.created_at ? format(new Date(account.created_at), "MMM dd, yyyy") : "-"}
                        {account.created_at && (
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(account.created_at), "HH:mm")}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <ActionsDropdown
                        account={account}
                        onView={() => onViewAccount(account)}
                        onEdit={() => onEditAccount(account)}
                        onDelete={() => onDeleteAccount(account)}
                        onApprove={() => onApproveAccount(account)}
                        onReject={() => onRejectAccount(account)}
                        onCreditLimitRequest={onCreditLimitRequest ? () => onCreditLimitRequest(account) : undefined}
                        onApproveCreditLimit={onApproveCreditLimit ? (approvalId: string) => onApproveCreditLimit(account, approvalId) : undefined}
                        onRejectCreditLimit={onRejectCreditLimit ? (approvalId: string) => onRejectCreditLimit(account, approvalId) : undefined}
                      />
                    </TableCell>
                  </TableRow>
                ))
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
    </>
  );
}

function ActionsDropdown({ 
  account,
  onView,
  onEdit,
  onDelete,
  onApprove,
  onReject,
  onCreditLimitRequest,
  onApproveCreditLimit,
  onRejectCreditLimit
}: { 
  account: CustomerAccountWithDetails;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onApprove: () => void;
  onReject: () => void;
  onCreditLimitRequest?: () => void;
  onApproveCreditLimit?: (approvalId: string) => void;
  onRejectCreditLimit?: (approvalId: string) => void;
}) {
  // Define action availability based on account status/conditions
  const canEdit = true; // Can be modified based on account status
  const canDelete = true; // Can be modified based on account status
  const canApproveOrReject = account.approval_status !== "approved" && !account.is_approved;
  
  // Check for pending credit limit approvals
  const pendingCreditLimitApprovals = account.approvals?.filter(
    approval => approval.approval_type === "credit_limit_update" && approval.status === "pending"
  ) || [];
  const hasPendingCreditLimitApprovals = pendingCreditLimitApprovals.length > 0;

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
            <Edit className="h-4 w-4 mr-2" /> Edit Account
          </DropdownMenuItem>
        )}
        {onCreditLimitRequest && (
          <DropdownMenuItem onClick={onCreditLimitRequest}>
            <CreditCard className="h-4 w-4 mr-2" /> Request Credit Limit Update
          </DropdownMenuItem>
        )}
        {onApproveCreditLimit && onRejectCreditLimit && (
          <>
            <DropdownMenuSeparator />
            {hasPendingCreditLimitApprovals ? (
              // Show specific approval actions when there are pending approvals
              pendingCreditLimitApprovals.map((approval) => (
                <div key={approval.id}>
                  <DropdownMenuItem onClick={() => onApproveCreditLimit(approval.id)} className="text-green-600 focus:text-green-600">
                    <CheckCircle className="h-4 w-4 mr-2" /> Approve Credit Limit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onRejectCreditLimit(approval.id)} className="text-red-600 focus:text-red-600">
                    <XCircle className="h-4 w-4 mr-2" /> Reject Credit Limit
                  </DropdownMenuItem>
                </div>
              ))
            ) : (
              // Show general approval options when no specific pending approvals
              <>
                <DropdownMenuItem onClick={() => onApproveCreditLimit("")} className="text-green-600 focus:text-green-600">
                  <CheckCircle className="h-4 w-4 mr-2" /> Approve Credit Limit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onRejectCreditLimit("")} className="text-red-600 focus:text-red-600">
                  <XCircle className="h-4 w-4 mr-2" /> Reject Credit Limit
                </DropdownMenuItem>
              </>
            )}
          </>
        )}
        {canApproveOrReject && (
          <PermissionGuard permissions="can_approve_account" hideOnDenied>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onApprove} className="text-green-600 focus:text-green-600">
              <CheckCircle className="h-4 w-4 mr-2" /> Approve Account
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onReject} className="text-red-600 focus:text-red-600">
              <XCircle className="h-4 w-4 mr-2" /> Reject Account
            </DropdownMenuItem>
          </PermissionGuard>
        )}
        {canDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-red-600 focus:text-red-600">
              <Trash2 className="h-4 w-4 mr-2" /> Delete Account
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}