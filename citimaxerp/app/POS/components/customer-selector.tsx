"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { User, Plus, Search } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/lib/auth-context"
import type { Customer } from "@/lib/customers"
import { getCustomers, getCustomerDisplayName } from "@/lib/customers"
import { usePermissions } from "@/hooks/use-permissions"
import { CreateCustomerModal } from "@/app/customers/components/CreateCustomerModal"
import { useCart } from "./pos-interface"

interface CustomerSelectorProps {
  selectedCustomer: Customer | null
  onCustomerSelect: (customer: Customer | null) => void
}

export function CustomerSelector({ selectedCustomer, onCustomerSelect }: CustomerSelectorProps) {
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [customers, setCustomers] = useState<Customer[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()
  const { companyId } = useAuth()
  const { hasPermission } = usePermissions()
  const { bumpActivityVersion } = useCart()

  // Check if user has permission to view customers
  const canViewCustomers = hasPermission("can_view_customers")

  // Load customers when component mounts or modal opens
  useEffect(() => {
    if (showCustomerModal && canViewCustomers) {
      loadCustomers()
    }
  }, [showCustomerModal, canViewCustomers])

  const loadCustomers = async () => {
    try {
      setIsLoading(true)
      const fetchedCustomers = await getCustomers()
      setCustomers(fetchedCustomers)
    } catch (error) {
      console.error("Failed to load customers:", error)
      toast({
        title: "Error",
        description: "Failed to load customers",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const filteredCustomers = customers.filter(
    (customer: Customer) =>
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.phone?.includes(searchTerm),
  )

  const handleCustomerSelect = (customer: Customer) => {
    onCustomerSelect(customer)
    setShowCustomerModal(false)
  }

  const walkInCustomer: Customer = {
    id: "walk-in",
    name: "Walk-in Customer",
    email: null,
    phone: null,
    address: null,
    city: null,
    state: null,
    country: null,
    postal_code: null,
    status: "active",
    company: null,
    notes: null,
    tags: [],
    preferred_communication_channel: null,
    last_contact_date: null,
    customer_type: null,
    total_spend: "0",
    total_orders: 0,
    loyalty_points: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    company_id: "", // Set to empty string instead of conditional value
    first_name: "Walk-in",
    last_name: "Customer",
  }

  // If user doesn't have permission to view customers, show a message
  if (!canViewCustomers) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <User className="h-4 w-4" />
            Customer
          </h3>
        </div>
        <div className="p-3 bg-gray-100 rounded-lg border border-gray-200">
          <p className="text-gray-500 text-sm">You don't have permission to view customers</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <User className="h-4 w-4" />
          Customer
        </h3>
      </div>

      {selectedCustomer ? (
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{getCustomerDisplayName(selectedCustomer)}</p>
              {selectedCustomer.email && <p className="text-sm text-gray-600">{selectedCustomer.email}</p>}
              {selectedCustomer.phone && <p className="text-sm text-gray-600">{selectedCustomer.phone}</p>}
            </div>
            <Button variant="outline" size="sm" onClick={() => onCustomerSelect(null)}>
              Change
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <Dialog open={showCustomerModal} onOpenChange={setShowCustomerModal}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full justify-start bg-transparent">
                <Search className="h-4 w-4 mr-2" />
                Select Customer
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Select Customer</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Input
                  placeholder="Search customers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />

                <div className="space-y-2 max-h-60 overflow-y-auto">
                  <Button
                    variant="outline"
                    className="w-full justify-start bg-transparent"
                    onClick={() => handleCustomerSelect(walkInCustomer)}
                  >
                    Walk-in Customer
                  </Button>

                  {isLoading ? (
                    <div className="text-center py-4">Loading customers...</div>
                  ) : (
                    filteredCustomers.map((customer: Customer) => (
                      <Button
                        key={customer.id}
                        variant="outline"
                        className="w-full justify-start bg-transparent"
                        onClick={() => handleCustomerSelect(customer)}
                      >
                        <div className="text-left">
                          <p className="font-medium">{getCustomerDisplayName(customer)}</p>
                          {customer.email && <p className="text-xs text-gray-500">{customer.email}</p>}
                        </div>
                      </Button>
                    ))
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/*
            Reps creating a customer here need the fuller Credit Appraisal
            capture form (Company Details, Accounts Contact, and - only for
            Sales Reps - the Directors/Trade References/Bank Details/Credit
            Terms application), so this reuses the same CreateCustomerModal
            used on the Customers page rather than a stripped-down inline
            form. It renders its own Sheet, so it's a sibling here rather
            than nested inside the "Select Customer" Dialog above.
          */}
          <Button
            variant="outline"
            className="w-full justify-start bg-transparent"
            onClick={() => setShowNewCustomerModal(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Customer
          </Button>

          <CreateCustomerModal
            open={showNewCustomerModal}
            onOpenChange={setShowNewCustomerModal}
            onSuccess={(customer) => {
              if (!customer) return
              setCustomers((prev) => [customer, ...prev])
              bumpActivityVersion()
              // A Sales Rep's submission is pending review and stays hidden
              // from normal customer pickers/search until approved - don't
              // auto-select it into the current sale, just let the modal's
              // own "submitted for review" confirmation stand.
              if (customer.approval_status !== "pending_stage1") {
                onCustomerSelect(customer)
              }
            }}
          />
        </div>
      )}
    </div>
  )
}
