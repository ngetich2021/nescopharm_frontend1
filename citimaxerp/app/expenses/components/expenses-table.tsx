"use client"

import { displayDate } from "@/lib/date-format"
import { useState } from "react"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { MoreHorizontal, Trash2, Pencil, Eye, Check } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { expenseAccountLabel, type Expense, type ExpenseCategory } from "@/types/expenses"
import { formatCurrency } from "@/lib/utils"
import { deleteExpense, approveExpense } from "@/lib/expenses"
import { useToast } from "@/hooks/use-toast"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { CreateExpenseModal } from "./create-expense-modal"
import { Badge } from "@/components/ui/badge"
import { PermissionGuard } from "@/components/PermissionGuard"
import { usePermissions } from "@/hooks/use-permissions"

interface ExpensesTableProps {
  expenses: Expense[]
  categories: ExpenseCategory[]
  onExpenseChanged: () => void
  onExpenseSelect: (expense: Expense) => void
  selectedExpenses: string[]
  onSelectionChange: (selected: string[]) => void
  /** S/No of the first row (pages after the first continue the count). */
  startIndex?: number
}

/** Petty Cash for cash, Prime Bank for a cheque / transfer. */
export function expensePaidFrom(method?: string | null): string {
  if (method === "check") return "Prime Bank (Cheque)"
  if (method === "bank_transfer" || method === "card") return "Prime Bank (Transfer)"
  return "Petty Cash"
}

export function ExpensesTable({
  expenses,
  categories,
  onExpenseChanged,
  onExpenseSelect,
  selectedExpenses,
  onSelectionChange,
  startIndex = 1,
}: ExpensesTableProps) {
  const { toast } = useToast()
  const { hasPermission } = usePermissions()
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null)

  const handleDelete = async (id: string) => {
    try {
      await deleteExpense(id)
      toast({
        title: "Success",
        description: "Expense deleted successfully.",
      })
      onExpenseChanged()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete expense.",
        variant: "destructive",
      })
    }
  }

  const handleEdit = (expense: Expense) => {
    setSelectedExpense(expense)
    setIsEditModalOpen(true)
  }

  const handleModalClose = () => {
    setIsEditModalOpen(false)
    setSelectedExpense(null)
  }

  const handleApprove = async (id: string) => {
    try {
      await approveExpense(id)
      toast({
        title: "Success",
        description: "Expense approved successfully.",
      })
      onExpenseChanged()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to approve expense.",
        variant: "destructive",
      })
    }
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case "approved":
        return "outline"
      case "paid":
        return "default"
      case "pending":
        return "secondary"
      case "rejected":
        return "destructive"
      default:
        return "outline"
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectionChange(expenses.map((expense) => expense.id))
    } else {
      onSelectionChange([])
    }
  }

  const handleSelectOne = (expenseId: string, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedExpenses, expenseId])
    } else {
      onSelectionChange(selectedExpenses.filter((id) => id !== expenseId))
    }
  }

  if (expenses.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No expenses recorded yet. Click "Add Expense" to get started!
      </div>
    )
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px]">
              <Checkbox
                checked={selectedExpenses.length === expenses.length && expenses.length > 0}
                onCheckedChange={handleSelectAll}
              />
            </TableHead>
            <TableHead className="w-[60px]">S/No</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Ledger Account</TableHead>
            <TableHead>Paid From</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created By</TableHead>
            <TableHead className="w-[100px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {expenses.map((expense, index) => (
            <TableRow
              key={expense.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => onExpenseSelect(expense)}
            >
              <TableCell className="w-[50px]" onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={selectedExpenses.includes(expense.id)}
                  onCheckedChange={(checked) => handleSelectOne(expense.id, !!checked)}
                />
              </TableCell>
              <TableCell className="text-muted-foreground">{startIndex + index}</TableCell>
              <TableCell className="whitespace-nowrap">{displayDate(new Date(expense.expense_date))}</TableCell>
              <TableCell className="max-w-[200px] truncate text-muted-foreground" title={expense.description || ""}>
                {expense.description || "-"}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {expense.account ? (
                  <span>
                    <span className="font-mono text-xs text-muted-foreground mr-1.5">{expense.account.account_code}</span>
                    {expense.account.account_name}
                  </span>
                ) : (
                  <span className="text-muted-foreground">{expenseAccountLabel(expense)}</span>
                )}
              </TableCell>
              <TableCell className="whitespace-nowrap text-sm">{expensePaidFrom(expense.payment_method)}</TableCell>
              <TableCell className="text-right">{formatCurrency(expense.amount)}</TableCell>
              <TableCell>
                {expense.status === "approved" ? (
                  <Badge variant="outline" className="capitalize bg-green-100 text-green-800 border-green-200">
                    {expense.status}
                  </Badge>
                ) : (
                  <Badge variant={getStatusBadgeVariant(expense.status)} className="capitalize">
                    {expense.status}
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {expense.created_by.first_name} {expense.created_by.last_name}
              </TableCell>
              <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                      <span className="sr-only">Open menu</span>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onExpenseSelect(expense)} className="flex items-center">
                      <Eye className="mr-2 h-4 w-4" /> View Details
                    </DropdownMenuItem>
                    <PermissionGuard permissions={["can_edit_expenses", "can_manage_system", "can_manage_company"]} hideOnDenied>
                      <DropdownMenuItem onClick={() => handleEdit(expense)} className="flex items-center">
                        <Pencil className="mr-2 h-4 w-4" /> Edit
                      </DropdownMenuItem>
                    </PermissionGuard>
                    {expense.status === "pending" && (
                      <PermissionGuard permissions={["can_approve_expenses", "can_manage_system", "can_manage_company"]} hideOnDenied>
                        <DropdownMenuItem onClick={() => handleApprove(expense.id)} className="flex items-center text-green-600">
                          <Check className="mr-2 h-4 w-4" /> Approve
                        </DropdownMenuItem>
                      </PermissionGuard>
                    )}
                    <PermissionGuard permissions={["can_delete_expenses", "can_manage_system", "can_manage_company"]} hideOnDenied>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <DropdownMenuItem
                            onSelect={(e) => e.preventDefault()}
                            className="flex items-center text-primary"
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will permanently delete the expense record.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(expense.id)}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </PermissionGuard>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <PermissionGuard permissions={["can_edit_expenses", "can_manage_system", "can_manage_company"]} hideOnDenied>
        {selectedExpense && (
          <CreateExpenseModal
            isOpen={isEditModalOpen}
            onClose={handleModalClose}
            onExpenseCreatedOrUpdated={onExpenseChanged}
            initialData={selectedExpense}
            categories={categories}
          />
        )}
      </PermissionGuard>
    </>
  )
}