"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { CustomersTable } from "./CustomersTable";
import { CustomersSummary } from "./CustomersSummary";
import { CustomerProfileModal } from "./CustomerProfileModal";
import { CreateCustomerModal } from "./CreateCustomerModal";
import { EditCustomerModal } from "./EditCustomerModal";
import { DeleteCustomerConfirmationDialog } from "./DeleteCustomerConfirmationDialog";
import { ViewAccountModal } from "../accounts/components/ViewAccountModal";
import { getCustomers, type Customer } from "@/lib/customers";
import { getCustomerAccount, type CustomerAccountWithDetails } from "@/lib/customer-accounts";
import { useAuth } from "@/lib/auth-context";
import { Loader2 } from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";
import { PermissionGuard } from "@/components/PermissionGuard";

export function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<CustomerAccountWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  
  // Modal states
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [deleteCustomer, setDeleteCustomer] = useState<Customer | null>(null);

  const { toast } = useToast();
  const { userProfile, isLoading: authLoading } = useAuth();
  const { hasPermission, hasAnyPermission } = usePermissions();

  // Fetch customers on mount (only if user has permission)
  useEffect(() => {
    if (!authLoading && userProfile) {
      fetchCustomers();
    }
  }, [authLoading, userProfile]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      console.log("Fetching customers...");
      const data = await getCustomers({ include_pending: true });
      console.log("Data received in fetchCustomers:", data);
      // Ensure we always have an array, even if null or undefined is returned
      setCustomers(Array.isArray(data) ? data : []);
    } catch (e: any) {
      console.error("Error fetching customers:", e);
      setCustomers([]);
      toast({
        title: "Error",
        description: e.message || "Failed to load customers. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Filter customers by search; ordering (most recent first) comes from the API
  const filteredCustomers = customers
    .filter((customer) => {
    const searchLower = search.toLowerCase();
    return (
      customer.name?.toLowerCase().includes(searchLower) ||
      customer.email?.toLowerCase().includes(searchLower) ||
      customer.phone?.toLowerCase().includes(searchLower) ||
      customer.company?.toLowerCase().includes(searchLower)
    );
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredCustomers.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedCustomers = filteredCustomers.slice(startIndex, startIndex + rowsPerPage);

  // Event handlers
  const handleViewCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setViewModalOpen(true);
  };

  const handleEditCustomer = (customer: Customer) => {
    setEditCustomer(customer);
    setEditModalOpen(true);
  };

  const handleDeleteCustomer = (customer: Customer) => {
    setDeleteCustomer(customer);
    setDeleteDialogOpen(true);
  };

  const handleViewAccount = async (customer: Customer) => {
    try {
      if (customer.account_id) {
        setLoading(true);
        const accountData = await getCustomerAccount(customer.account_id);
        setSelectedAccount(accountData);
        setAccountModalOpen(true);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load account details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSuccess = () => {
    setCreateModalOpen(false);
    fetchCustomers();
    toast({
      title: "Success",
      description: "Customer created successfully.",
    });
  };

  const handleEditSuccess = () => {
    setEditModalOpen(false);
    setEditCustomer(null);
    fetchCustomers();
    toast({
      title: "Success",
      description: "Customer updated successfully.",
    });
  };

  const handleDeleteSuccess = () => {
    setDeleteDialogOpen(false);
    setDeleteCustomer(null);
    fetchCustomers();
    // Toast is handled in the DeleteCustomerConfirmationDialog
  };

  const handleCloseViewModal = () => {
    setViewModalOpen(false);
    setSelectedCustomer(null);
  };

  const handleRefresh = () => {
    fetchCustomers();
  };

  // Check if user has permission to view customers
  const canViewCustomers = hasAnyPermission([
    "can_view_customers_menu",
    "can_manage_system",
    "can_manage_company"
  ]);

  // Debug logging
  console.log('=== CUSTOMERS PAGE DEBUG ===');
  console.log('Auth Loading:', authLoading);
  console.log('User Profile:', userProfile);
  console.log('Can View Customers:', canViewCustomers);
  console.log('Has can_manage_system:', hasPermission('can_manage_system'));
  console.log('Has can_view_customers_menu:', hasPermission('can_view_customers_menu'));
  console.log('Has can_manage_company:', hasPermission('can_manage_company'));
  console.log('============================');

  // Show loading state while checking auth
  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <PermissionGuard permissions={["can_view_customers_menu", "can_manage_system", "can_manage_company"]}>
      <div className="space-y-6">
        <div className="flex flex-col space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
          <p className="text-muted-foreground">Manage and track your customer relationships and interactions</p>
        </div>

        <CustomersSummary customers={customers} loading={loading} />
        
        <CustomersTable
          customers={paginatedCustomers}
          loading={loading}
          onViewCustomer={handleViewCustomer}
          onEditCustomer={handleEditCustomer}
          onDeleteCustomer={handleDeleteCustomer}
          onViewAccount={handleViewAccount}
          search={search}
          onSearchChange={setSearch}
          currentPage={currentPage}
          totalPages={totalPages}
          rowsPerPage={rowsPerPage}
          onPageChange={setCurrentPage}
          onRowsPerPageChange={setRowsPerPage}
          totalItems={filteredCustomers.length}
          onRefresh={handleRefresh}
          onCreateNew={() => setCreateModalOpen(true)}
        />

        {/* View Customer Modal */}
        <CustomerProfileModal
          open={viewModalOpen}
          onOpenChange={setViewModalOpen}
          customer={selectedCustomer}
          onClose={handleCloseViewModal}
          onRefresh={handleRefresh}
          onEdit={handleEditCustomer}
          onViewAccount={handleViewAccount}
        />

        {/* Create Modal - Only show if user has create permission */}
        <PermissionGuard permissions={["can_create_customers", "can_manage_system", "can_manage_company"]} hideOnDenied>
          <CreateCustomerModal
            open={createModalOpen}
            onOpenChange={setCreateModalOpen}
            onSuccess={handleCreateSuccess}
          />
        </PermissionGuard>

        {/* Edit Modal - Only show if user has update permission */}
        <PermissionGuard permissions={["can_update_customers", "can_manage_system", "can_manage_company"]} hideOnDenied>
          <EditCustomerModal
            open={editModalOpen}
            onOpenChange={setEditModalOpen}
            onSuccess={handleEditSuccess}
            customer={editCustomer}
          />
        </PermissionGuard>

        {/* Delete Confirmation Dialog - Only show if user has delete permission */}
        <PermissionGuard permissions={["can_delete_customers", "can_manage_system", "can_manage_company"]} hideOnDenied>
          <DeleteCustomerConfirmationDialog
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
            customer={deleteCustomer}
            onSuccess={handleDeleteSuccess}
          />
        </PermissionGuard>

        {/* View Account Modal */}
        <ViewAccountModal 
          open={accountModalOpen} 
          onOpenChange={setAccountModalOpen} 
          account={selectedAccount} 
        />
      </div>
    </PermissionGuard>
  );
}