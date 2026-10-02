"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Debt } from "@/types/debts"
import { MoreHorizontal, Plus, Search, Eye, CreditCard, Edit, Trash2 } from "lucide-react"
import { DebtDetailsSheet } from "./debt-details-sheet"
import { CreateDebtSheet } from "./components/create-debt-sheet"

interface DebtsTableProps {
  debts: Debt[]
}

export function DebtsTable({ debts: initialDebts }: DebtsTableProps) {
  const [debts, setDebts] = useState(initialDebts)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null)
  const [isCreateSheetOpen, setIsCreateSheetOpen] = useState(false)
  const [isDetailsSheetOpen, setIsDetailsSheetOpen] = useState(false)

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const getStatusBadge = (status: Debt["status"]) => {
    const variants = {
      pending: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
      partial: "bg-blue-100 text-blue-800 hover:bg-blue-100",
      paid: "bg-green-100 text-green-800 hover:bg-green-100",
      overdue: "bg-red-100 text-red-800 hover:bg-red-100",
    }

    const labels = {
      pending: "Pending",
      partial: "Partial",
      paid: "Paid",
      overdue: "Overdue",
    }

    return (
      <Badge variant="secondary" className={variants[status]}>
        {labels[status]}
      </Badge>
    )
  }

  const getPriorityBadge = (priority: Debt["priority"]) => {
    const variants = {
      low: "bg-gray-100 text-gray-800 hover:bg-gray-100",
      medium: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
      high: "bg-orange-100 text-orange-800 hover:bg-orange-100",
      urgent: "bg-red-100 text-red-800 hover:bg-red-100",
    }

    const labels = {
      low: "Low",
      medium: "Medium",
      high: "High",
      urgent: "Urgent",
    }

    return (
      <Badge variant="secondary" className={variants[priority]}>
        {labels[priority]}
      </Badge>
    )
  }

  const getCategoryLabel = (category: Debt["category"]) => {
    const labels = {
      customer_debt: "Customer Debt",
      supplier_debt: "Supplier Debt",
      loan: "Loan",
      other: "Other",
    }
    return labels[category]
  }

  const filteredDebts = debts.filter((debt) => {
    const matchesSearch =
      debt.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      debt.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
      debt.description.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === "all" || debt.status === statusFilter
    const matchesCategory = categoryFilter === "all" || debt.category === categoryFilter

    return matchesSearch && matchesStatus && matchesCategory
  })

  const handleViewDebt = (debt: Debt) => {
    setSelectedDebt(debt)
    setIsDetailsSheetOpen(true)
  }

  const handleRecordPayment = (debt: Debt) => {
    setSelectedDebt(debt)
    setIsDetailsSheetOpen(true)
  }

  const handleEditDebt = (debt: Debt) => {
    setSelectedDebt(debt)
    setIsCreateSheetOpen(true)
  }

  const handleDeleteDebt = (debt: Debt) => {
    // In a real app, this would show a confirmation dialog
    setDebts((prev) => prev.filter((d) => d.id !== debt.id))
  }

  const handleDebtCreated = (newDebt: Debt) => {
    setDebts((prev) => [newDebt, ...prev])
  }

  const handlePaymentRecorded = (updatedDebt: Debt) => {
    setDebts((prev) => prev.map((d) => (d.id === updatedDebt.id ? updatedDebt : d)))
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Debts</CardTitle>
            <Button onClick={() => setIsCreateSheetOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Debt
            </Button>
          </div>
          <div className="flex items-center space-x-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search debts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="customer_debt">Customer Debt</SelectItem>
                <SelectItem value="supplier_debt">Supplier Debt</SelectItem>
                <SelectItem value="loan">Loan</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredDebts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No debts found matching your criteria.</div>
          ) : (
            <div className="space-y-4">
              {/* Desktop Table View */}
              <div className="hidden md:block">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Customer/Reference</th>
                        <th className="text-left p-2">Description</th>
                        <th className="text-left p-2">Amount</th>
                        <th className="text-left p-2">Outstanding</th>
                        <th className="text-left p-2">Due Date</th>
                        <th className="text-left p-2">Status</th>
                        <th className="text-left p-2">Priority</th>
                        <th className="text-left p-2">Category</th>
                        <th className="text-left p-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDebts.map((debt) => (
                        <tr key={debt.id} className="border-b hover:bg-muted/50">
                          <td className="p-2">
                            <div>
                              <div className="font-medium">{debt.customerName}</div>
                              <div className="text-sm text-muted-foreground">{debt.reference}</div>
                            </div>
                          </td>
                          <td className="p-2">
                            <div className="max-w-xs truncate">{debt.description}</div>
                          </td>
                          <td className="p-2 font-medium">{formatCurrency(debt.amount)}</td>
                          <td className="p-2">
                            <span className="font-medium text-red-600">{formatCurrency(debt.outstandingAmount)}</span>
                          </td>
                          <td className="p-2">{new Date(debt.dueDate).toLocaleDateString()}</td>
                          <td className="p-2">{getStatusBadge(debt.status)}</td>
                          <td className="p-2">{getPriorityBadge(debt.priority)}</td>
                          <td className="p-2 text-sm">{getCategoryLabel(debt.category)}</td>
                          <td className="p-2">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleViewDebt(debt)}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  View Details
                                </DropdownMenuItem>
                                {debt.status !== "paid" && (
                                  <DropdownMenuItem onClick={() => handleRecordPayment(debt)}>
                                    <CreditCard className="mr-2 h-4 w-4" />
                                    Record Payment
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => handleEditDebt(debt)}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDeleteDebt(debt)} className="text-red-600">
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden space-y-4">
                {filteredDebts.map((debt) => (
                  <Card key={debt.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-medium">{debt.customerName}</h3>
                          <p className="text-sm text-muted-foreground">{debt.reference}</p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleViewDebt(debt)}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            {debt.status !== "paid" && (
                              <DropdownMenuItem onClick={() => handleRecordPayment(debt)}>
                                <CreditCard className="mr-2 h-4 w-4" />
                                Record Payment
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => handleEditDebt(debt)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDeleteDebt(debt)} className="text-red-600">
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      <p className="text-sm mb-3 text-muted-foreground">{debt.description}</p>

                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div>
                          <p className="text-xs text-muted-foreground">Total Amount</p>
                          <p className="font-medium">{formatCurrency(debt.amount)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Outstanding</p>
                          <p className="font-medium text-red-600">{formatCurrency(debt.outstandingAmount)}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          {getStatusBadge(debt.status)}
                          {getPriorityBadge(debt.priority)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Due: {new Date(debt.dueDate).toLocaleDateString()}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      <CreateDebtSheet
        open={isCreateSheetOpen}
        onOpenChange={setIsCreateSheetOpen}
        onDebtCreated={handleDebtCreated}
        editDebt={selectedDebt}
        onClose={() => setSelectedDebt(null)}
      />

      {selectedDebt && (
        <DebtDetailsSheet
          debt={selectedDebt}
          open={isDetailsSheetOpen}
          onOpenChange={setIsDetailsSheetOpen}
          onPaymentRecorded={handlePaymentRecorded}
        />
      )}
    </>
  )
}
