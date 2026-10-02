"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { CustomerAccountsTable } from "./CustomerAccountsTable";
import { CustomerAccountsSummary } from "./CustomerAccountsSummary";
import { ViewAccountModal } from "./ViewAccountModal";
import { EditAccountModal } from "./EditAccountModal";
import { CreateAccountModal } from "./CreateAccountModal";
import { DeleteAccountConfirmationDialog } from "./DeleteAccountConfirmationDialog";
import { ApprovalModal } from "./ApprovalModal";
import { CreditLimitRequestModal } from "@/components/modals/credit-limit-request-modal";
import { CreditLimitApprovalModal } from "@/components/modals/credit-limit-approval-modal";
import { getCustomerAccounts, type CustomerAccountWithDetails } from "@/lib/customer-accounts";
import { useAuth } from "@/lib/auth-context";
import { hasPermission } from "@/lib/rbac";
import { Loader2 } from "lucide-react";

export function CustomerAccountsPage() {
  const [accounts, setAccounts] = useState<CustomerAccountWithDetails[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<CustomerAccountWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [permissionChecked, setPermissionChecked] = useState(false);
  const [hasViewPermission, setHasViewPermission] = useState(false);
  
  // Modal states
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editAccount, setEditAccount] = useState<CustomerAccountWithDetails | null>(null);
  const [deleteAccount, setDeleteAccount] = useState<CustomerAccountWithDetails | null>(null);
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [approvalAction, setApprovalAction] = useState<"approve" | "reject">("approve");
  const [approvalAccount, setApprovalAccount] = useState<CustomerAccountWithDetails | null>(null);
  const [creditLimitRequestModalOpen, setCreditLimitRequestModalOpen] = useState(false);
  const [creditLimitRequestAccount, setCreditLimitRequestAccount] = useState<CustomerAccountWithDetails | null>(null);
  const [creditLimitApprovalModalOpen, setCreditLimitApprovalModalOpen] = useState(false);
  const [creditLimitApprovalAccount, setCreditLimitApprovalAccount] = useState<CustomerAccountWithDetails | null>(null);
  const [creditLimitApprovalId, setCreditLimitApprovalId] = useState<string>("");
  const [creditLimitApprovalAction, setCreditLimitApprovalAction] = useState<"approved" | "rejected">("approved");

  const { toast } = useToast();
  const { userProfile, isLoading: authLoading } = useAuth();

  // Check permissions on mount
  useEffect(() => {
    if (!authLoading && userProfile) {
      // Check for any of the required permissions
      const canView = hasPermission(userProfile, "can_view_customers_menu");
      const canManageSystem = hasPermission(userProfile, "can_manage_system");
      const canManageCompany = hasPermission(userProfile, "can_manage_company");
      
      // User has access if they have any of these permissions
      const hasAccess = canView || canManageSystem || canManageCompany;
      
      setHasViewPermission(hasAccess);
      setPermissionChecked(true);
      
      if (!hasAccess) {
        toast({
          title: "Access Denied",
          description: "You do not have permission to view customer accounts. Please contact your administrator.",
          variant: "destructive",
        });
      }
    }
  }, [userProfile, authLoading, toast]);

  // Fetch customer accounts
  useEffect(() => {
    if (permissionChecked && hasViewPermission) {
      fetchCustomerAccounts();
    }
  }, [permissionChecked, hasViewPermission]);

  const fetchCustomerAccounts = async () => {
    try {
      setLoading(true);
      console.log("Fetching customer accounts...");
      const data = await getCustomerAccounts();
      console.log("Customer accounts data received:", data);
      // Ensure we always have an array, even if null or undefined is returned
      setAccounts(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.error("Error fetching customer accounts:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to load customer accounts",
        variant: "destructive",
      });
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  };

  // Show loading state while checking auth/permissions
  if (authLoading || !permissionChecked) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Show access denied message if user doesn't have permission
  if (!hasViewPermission) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <h2 className="text-2xl font-bold">Access Denied</h2>
        <p className="text-gray-500 text-center">
          You do not have permission to view customer accounts.<br />
          Please contact your administrator to request access.
        </p>
      </div>
    );
  }

  // Filter accounts by search
  const filteredAccounts = accounts.filter((account) => {
    const searchLower = search.toLowerCase();
    const customerName = account.customer
      ? (account.customer.business_name
          || `${account.customer.first_name || ""} ${account.customer.last_name || ""}`.trim()
          || account.customer.name
          || "")
      : "";

    return (
      account.account_number?.toLowerCase().includes(searchLower) ||
      customerName.toLowerCase().includes(searchLower) ||
      account.customer?.business_name?.toLowerCase().includes(searchLower) ||
      account.customer?.email?.toLowerCase().includes(searchLower)
    );
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredAccounts.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedAccounts = filteredAccounts.slice(startIndex, startIndex + rowsPerPage);

  // Event handlers
  const handleViewAccount = (account: CustomerAccountWithDetails) => {
    setSelectedAccount(account);
    setViewModalOpen(true);
  };

  const handleEditAccount = (account: CustomerAccountWithDetails) => {
    setEditAccount(account);
    setEditModalOpen(true);
  };

  const handleDeleteAccount = (account: CustomerAccountWithDetails) => {
    setDeleteAccount(account);
    setDeleteDialogOpen(true);
  };

  const handleCreateSuccess = () => {
    setCreateModalOpen(false);
    fetchCustomerAccounts();
    toast({
      title: "Success",
      description: "Customer account created successfully.",
    });
  };

  const handleEditSuccess = () => {
    setEditModalOpen(false);
    setEditAccount(null);
    fetchCustomerAccounts();
    toast({
      title: "Success",
      description: "Customer account updated successfully.",
    });
  };

  const handleDeleteSuccess = () => {
    setDeleteDialogOpen(false);
    setDeleteAccount(null);
    fetchCustomerAccounts();
    toast({
      title: "Success",
      description: "Customer account deleted successfully.",
    });
  };

  const handleCloseViewModal = () => {
    setViewModalOpen(false);
    setSelectedAccount(null);
  };

  const handleApproveAccount = (account: CustomerAccountWithDetails) => {
    setApprovalAccount(account);
    setApprovalAction("approve");
    setApprovalModalOpen(true);
  };

  const handleRejectAccount = (account: CustomerAccountWithDetails) => {
    setApprovalAccount(account);
    setApprovalAction("reject");
    setApprovalModalOpen(true);
  };

  const handleCreditLimitRequest = (account: CustomerAccountWithDetails) => {
    setCreditLimitRequestAccount(account);
    setCreditLimitRequestModalOpen(true);
  };

  const handleApproveCreditLimit = (account: CustomerAccountWithDetails, approvalId: string) => {
    setCreditLimitApprovalAccount(account);
    setCreditLimitApprovalId(approvalId);
    setCreditLimitApprovalAction("approved");
    setCreditLimitApprovalModalOpen(true);
  };

  const handleRejectCreditLimit = (account: CustomerAccountWithDetails, approvalId: string) => {
    setCreditLimitApprovalAccount(account);
    setCreditLimitApprovalId(approvalId);
    setCreditLimitApprovalAction("rejected");
    setCreditLimitApprovalModalOpen(true);
  };

  const handleApprovalSuccess = () => {
    setApprovalModalOpen(false);
    setApprovalAccount(null);
    fetchCustomerAccounts();
  };

  const handleRefresh = () => {
    fetchCustomerAccounts();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Customer Accounts</h1>
        <p className="text-muted-foreground">Manage customer credit accounts and approvals</p>
      </div>

      <CustomerAccountsSummary accounts={accounts} loading={loading} />
      
            <CustomerAccountsTable
        accounts={accounts}
        loading={loading}
        search=""
        onSearchChange={() => {}}
        currentPage={1}
        totalPages={1}
        rowsPerPage={10}
        onPageChange={() => {}}
        onRowsPerPageChange={() => {}}
        totalItems={accounts.length}
        onRefresh={handleRefresh}
        onCreateNew={() => setCreateModalOpen(true)}
        onViewAccount={handleViewAccount}
        onEditAccount={handleEditAccount}
        onDeleteAccount={handleDeleteAccount}
        onApproveAccount={handleApproveAccount}
        onRejectAccount={handleRejectAccount}
        onCreditLimitRequest={handleCreditLimitRequest}
        onApproveCreditLimit={handleApproveCreditLimit}
        onRejectCreditLimit={handleRejectCreditLimit}
      />

      {/* View Account Modal */}
      <ViewAccountModal 
        open={viewModalOpen} 
        onOpenChange={setViewModalOpen} 
        account={selectedAccount} 
        onRefresh={handleRefresh}
      />

      {/* Create Account Modal */}
      <CreateAccountModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onSuccess={handleCreateSuccess}
      />

      {/* Edit Account Modal */}
      <EditAccountModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        account={editAccount}
        onSuccess={handleEditSuccess}
      />

      {/* Delete Account Confirmation Dialog */}
      <DeleteAccountConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        account={deleteAccount}
        onSuccess={handleDeleteSuccess}
      />

      {/* Approval Modal */}
      <ApprovalModal
        open={approvalModalOpen}
        onOpenChange={setApprovalModalOpen}
        account={approvalAccount}
        action={approvalAction}
        onSuccess={handleApprovalSuccess}
      />

      {/* Credit Limit Request Modal */}
      {creditLimitRequestAccount && (
        <CreditLimitRequestModal
          isOpen={creditLimitRequestModalOpen}
          onClose={() => {
            setCreditLimitRequestModalOpen(false);
            setCreditLimitRequestAccount(null);
          }}
          onSuccess={() => {
            setCreditLimitRequestModalOpen(false);
            setCreditLimitRequestAccount(null);
            fetchCustomerAccounts();
            toast({
              title: "Success",
              description: "Credit limit update request submitted successfully.",
            });
          }}
          customerAccountId={creditLimitRequestAccount.id}
          currentCreditLimit={parseFloat(creditLimitRequestAccount.credit_required || "0")}
          currentCreditDays={creditLimitRequestAccount.credit_days ?? null}
        />
      )}

      {/* Credit Limit Approval Modal */}
      {creditLimitApprovalAccount && (
        <CreditLimitApprovalModal
          isOpen={creditLimitApprovalModalOpen}
          onClose={() => {
            setCreditLimitApprovalModalOpen(false);
            setCreditLimitApprovalAccount(null);
            setCreditLimitApprovalId("");
          }}
          onSuccess={() => {
            setCreditLimitApprovalModalOpen(false);
            setCreditLimitApprovalAccount(null);
            setCreditLimitApprovalId("");
            fetchCustomerAccounts();
            toast({
              title: "Success",
              description: `Credit limit update ${creditLimitApprovalAction} successfully.`,
            });
          }}
          customerAccountId={creditLimitApprovalAccount.id}
          approvalId={creditLimitApprovalId}
          action={creditLimitApprovalAction}
          currentCreditLimit={parseFloat(creditLimitApprovalAccount.credit_required || "0")}
          requestedCreditLimit={
            creditLimitApprovalAccount.approvals?.find(
              approval => approval.id === creditLimitApprovalId
            )?.new_credit_limit ? 
            parseFloat(creditLimitApprovalAccount.approvals.find(
              approval => approval.id === creditLimitApprovalId
            )?.new_credit_limit || "0") : 0
          }
          currentCreditDays={creditLimitApprovalAccount.credit_days ?? null}
          requestedCreditDays={
            creditLimitApprovalAccount.approvals?.find(
              approval => approval.id === creditLimitApprovalId
            )?.new_credit_days ?? null
          }
          requestReason={
            creditLimitApprovalAccount.approvals?.find(
              approval => approval.id === creditLimitApprovalId
            )?.notes || undefined
          }
        />
      )}
    </div>
  );
}