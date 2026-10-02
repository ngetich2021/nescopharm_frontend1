"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DollarSign, Calendar, FileText, Search, ChevronDown, Download, Upload, Plus } from "lucide-react"
import * as XLSX from "xlsx"
import { ExpensesTable } from "./components/expenses-table"
import { CreateExpenseModal } from "./components/create-expense-modal"
import { ExpenseDetailsSheet } from "./components/expense-details-sheet"
import { useAuth } from "@/lib/auth-context"
import { getExpenses, getExpenseCategories } from "@/lib/expenses"
import type { Expense, ExpenseCategory, ExpenseStatus } from "@/types/expenses"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { ExpensesTableSkeleton } from "./components/expenses-table-skeleton"
import { PermissionGuard } from "@/components/PermissionGuard"

export function ExpensesClient() {
  const { user, userProfile, companyId } = useAuth()
  const { toast } = useToast()

  const [expenses, setExpenses] = useState<Expense[]>([])
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isDetailsSheetOpen, setIsDetailsSheetOpen] = useState(false)
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedStatus, setSelectedStatus] = useState<ExpenseStatus | "all">("all")
  const [selectedExpenses, setSelectedExpenses] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [isBulkActionOpen, setIsBulkActionOpen] = useState(false)

  const expenseStatuses: ExpenseStatus[] = ["pending", "approved", "rejected", "paid"]

  const fetchExpensesAndCategories = async () => {
    try {
      setLoading(true)
      
      // Don't fetch if we don't have a company ID
      if (!companyId) {
        console.warn('ExpensesClient: No company ID available, skipping fetch');
        setLoading(false);
        return;
      }
      
      const [expensesData, categoriesData] = await Promise.all([
        getExpenses({
          company_id: companyId,
          status: selectedStatus !== "all" ? selectedStatus : undefined,
          search: searchTerm || undefined
        }),
        getExpenseCategories(companyId),
      ])
      
      setExpenses(expensesData)
      setCategories(categoriesData)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load expenses or categories.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (typeof window !== "undefined" && companyId) {
      fetchExpensesAndCategories()
    }
  }, [companyId])

  // Re-fetch when filters change (with debounce for search term)
  useEffect(() => {
    if (!companyId) return; // Don't fetch if no company ID
    
    const timer = setTimeout(() => {
      fetchExpensesAndCategories()
    }, 500) // 500ms debounce

    return () => clearTimeout(timer)
  }, [selectedStatus, searchTerm, companyId])

  const handleExpenseCreatedOrUpdated = () => {
    fetchExpensesAndCategories()
    setIsCreateModalOpen(false)
  }

  const handleExpenseSelect = (expense: Expense) => {
    setSelectedExpense(expense)
    setIsDetailsSheetOpen(true)
  }

  const handleEditExpense = () => {
    if (selectedExpense) {
      setIsCreateModalOpen(true)
    }
  }

  const handleExport = () => {
    const data = filteredExpenses.map((e) => ({
      Date: e.expense_date,
      Description: e.description,
      Category: e.category?.name || "",
      Amount: e.amount,
      Status: e.status,
      Notes: e.notes || "",
      "Created By": `${e.created_by?.first_name || ""} ${e.created_by?.last_name || ""}`.trim(),
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Expenses")
    XLSX.writeFile(wb, `expenses-${new Date().toISOString().split("T")[0]}.xlsx`)
  }

  // Client-side filtering by vendor name and description
  const filteredExpenses = expenses.filter((expense) => {
    const searchLower = searchTerm.toLowerCase()
    const matchesSearch = 
      (expense.vendor_name || "").toLowerCase().includes(searchLower) ||
      (expense.description || "").toLowerCase().includes(searchLower)
    const matchesStatus = selectedStatus === "all" || expense.status === selectedStatus
    return matchesSearch && matchesStatus
  })

  // Calculate stats
  // Coerce amount to number and default to 0 if invalid
  const totalExpenses = expenses.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0)
  const pendingExpenses = expenses.filter((expense) => expense.status === "pending").length
  const approvedExpenses = expenses.filter((expense) => expense.status === "approved").length

  // Pagination logic
  const totalPages = Math.ceil(filteredExpenses.length / rowsPerPage)
  const paginatedExpenses = filteredExpenses.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage)

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Expense Management</h2>
      </div>
      <div className="space-y-4">
        <p className="text-muted-foreground">Track, manage, and analyze your company's expenditures in one place.</p>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
              <DollarSign className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="text-2xl font-bold">{formatCurrency(totalExpenses)}</div>
              )}
              <p className="text-xs text-muted-foreground">+15.2% from last month</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Expenses</CardTitle>
              <Calendar className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{pendingExpenses}</div>
              )}
              <p className="text-xs text-muted-foreground">awaiting approval</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Approved Expenses</CardTitle>
              <FileText className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{approvedExpenses}</div>
              )}
              <p className="text-xs text-muted-foreground">this month</p>
            </CardContent>
          </Card>
        </div>

        {/* Search, Filter, and Actions */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
            <div className="relative w-full md:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by vendor or description..."
                className="pl-9 w-full md:w-64"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="relative w-full md:w-auto">
              <Select value={selectedStatus} onValueChange={(value: any) => setSelectedStatus(value)}>
                <SelectTrigger className="w-[180px] pl-8">
                  <div className="flex items-center">
                    <ChevronDown className="mr-2 h-4 w-4" />
                    <span>
                      {selectedStatus === "all"
                        ? "All Statuses"
                        : `${selectedStatus.charAt(0).toUpperCase() + selectedStatus.slice(1)}`}
                    </span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {expenseStatuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex space-x-2 flex-wrap items-center">
            {selectedExpenses.length > 0 && (
              <Button
                variant="default"
                size="sm"
                className="bg-primary hover:bg-primary/90"
                onClick={() => setIsBulkActionOpen(true)}
              >
                {selectedExpenses.length} Selected
              </Button>
            )}
            <PermissionGuard permissions={["can_create_expenses", "can_manage_system", "can_manage_company"]} hideOnDenied>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCreateModalOpen(true)}
                className="border-primary text-primary hover:bg-primary/10"
              >
                <Plus className="mr-2 h-4 w-4" /> Add Expense
              </Button>
            </PermissionGuard>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" /> Export
            </Button>
            <Button variant="outline" size="sm">
              <Upload className="mr-2 h-4 w-4" /> Import
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-md border bg-white">
          {loading ? (
            <ExpensesTableSkeleton />
          ) : (
            <ExpensesTable
              expenses={paginatedExpenses}
              categories={categories}
              onExpenseChanged={fetchExpensesAndCategories}
              onExpenseSelect={handleExpenseSelect}
              selectedExpenses={selectedExpenses}
              onSelectionChange={setSelectedExpenses}
            />
          )}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <p className="text-sm font-medium">Rows per page</p>
            <Select
              value={rowsPerPage.toString()}
              onValueChange={(value) => {
                setRowsPerPage(Number(value))
                setCurrentPage(1)
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
              onClick={() => setCurrentPage((old) => Math.max(old - 1, 1))}
              disabled={currentPage === 1}
              className="border-gray-200 hover:bg-primary/10 hover:text-primary hover:border-primary"
            >
              Previous
            </Button>
            <div className="flex items-center justify-center text-sm font-medium">
              Page {currentPage} of {totalPages || 1}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((old) => Math.min(old + 1, totalPages || 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="border-gray-200 hover:bg-primary/10 hover:text-primary hover:border-primary"
            >
              Next
            </Button>
          </div>
        </div>

        <PermissionGuard permissions={["can_create_expenses", "can_manage_system", "can_manage_company"]} hideOnDenied>
          {/* Create Modal */}
          <CreateExpenseModal
            isOpen={isCreateModalOpen}
            onClose={() => {
              setIsCreateModalOpen(false)
              setSelectedExpense(null)
            }}
            onExpenseCreatedOrUpdated={handleExpenseCreatedOrUpdated}
            categories={categories}
            initialData={selectedExpense}
          />
        </PermissionGuard>

        {/* Details Sheet */}
        {selectedExpense && (
          <ExpenseDetailsSheet
            expenseId={selectedExpense.id}
            isOpen={isDetailsSheetOpen}
            onClose={() => {
              setIsDetailsSheetOpen(false)
              setSelectedExpense(null)
            }}
            onEditClick={handleEditExpense}
          />
        )}
      </div>
    </div>
  )
}