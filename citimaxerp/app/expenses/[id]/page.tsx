"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Pencil, Trash2, ExternalLink } from "lucide-react"
import Link from "next/link"
import { getExpenseById, deleteExpense } from "@/lib/expenses"
import type { Expense } from "@/types/expenses"
import { useToast } from "@/hooks/use-toast"
import { Skeleton } from "@/components/ui/skeleton"
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
import { CreateExpenseModal } from "../components/create-expense-modal" // Reusing for edit
import { formatCurrency } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { getExpenseCategories } from "@/lib/expenses"
import type { ExpenseCategory } from "@/types/expenses"

export default function ExpenseDetailsPage() {
  const params = useParams()
  const expenseId = params.id as string
  const { toast } = useToast()
  const [expense, setExpense] = useState<Expense | null>(null)
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)

  const fetchExpenseAndCategories = async () => {
    if (!expenseId) return
    setLoading(true)
    try {
      const [expenseData, categoriesData] = await Promise.all([
        getExpenseById(expenseId),
        getExpenseCategories(expense?.company_id || ""), // Fetch categories if company_id is available
      ])
      setExpense(expenseData)
      setCategories(categoriesData)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load expense details or categories.",
        variant: "destructive",
      })
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchExpenseAndCategories()
  }, [expenseId, expense?.company_id]) // Re-fetch if company_id changes (e.g., on initial load)

  const handleDelete = async () => {
    if (!expenseId) return
    try {
      await deleteExpense(expenseId)
      toast({
        title: "Success",
        description: "Expense deleted successfully.",
      })
      // Redirect to expenses list after deletion
      window.location.href = "/expenses"
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete expense.",
        variant: "destructive",
      })
      console.error(error)
    }
  }

  const handleExpenseUpdated = () => {
    fetchExpenseAndCategories() // Re-fetch to update details
    setIsEditModalOpen(false)
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4 p-4 md:p-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-[150px] w-full" />
          <Skeleton className="h-[150px] w-full" />
          <Skeleton className="h-[150px] w-full" />
        </div>
        <Skeleton className="h-[300px] w-full" />
      </div>
    )
  }

  if (!expense) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 md:p-6">
        <h2 className="text-xl font-semibold text-gray-700">Expense not found.</h2>
        <Link href="/expenses">
          <Button className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Expenses
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <Link href="/expenses">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Expenses
          </Button>
        </Link>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsEditModalOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" /> Edit
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete this expense record.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Expense Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-sm font-medium text-gray-500">Vendor Name</p>
            <p className="text-lg font-semibold">{expense.vendor_name}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Amount</p>
            <p className="text-lg font-semibold">{formatCurrency(expense.amount)}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Description</p>
            <p className="text-lg">{expense.description}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Category</p>
            <p className="text-lg">{expense.category_name}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Date</p>
            <p className="text-lg">{new Date(expense.expense_date).toLocaleDateString()}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Payment Method</p>
            <p className="text-lg capitalize">{expense.payment_method.replace(/_/g, " ")}</p>
          </div>
          {expense.store_id && (
            <div>
              <p className="text-sm font-medium text-gray-500">Store</p>
              <p className="text-lg">{expense.store_name}</p>
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-gray-500">Status</p>
            <p className="text-lg capitalize">{expense.status}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Recurring</p>
            <p className="text-lg">{expense.is_recurring ? "Yes" : "No"}</p>
          </div>
          {expense.is_recurring && expense.recurring_frequency && (
            <div>
              <p className="text-sm font-medium text-gray-500">Frequency</p>
              <p className="text-lg capitalize">{expense.recurring_frequency}</p>
            </div>
          )}
          {expense.tags && expense.tags.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-500">Tags</p>
              <div className="flex flex-wrap gap-1">
                {expense.tags.map((tag, index) => (
                  <Badge key={index} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {expense.notes && (
            <div>
              <p className="text-sm font-medium text-gray-500">Notes</p>
              <p className="text-lg">{expense.notes}</p>
            </div>
          )}
          {expense.receipt_url && (
            <div>
              <p className="text-sm font-medium text-gray-500">Receipt</p>
              <a
                href={expense.receipt_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline flex items-center gap-1"
              >
                View Receipt <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-gray-500">Created By</p>
            <p className="text-lg">{expense.created_by.first_name} {expense.created_by.last_name}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Created At</p>
            <p className="text-lg">{new Date(expense.created_at).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Last Updated</p>
            <p className="text-lg">{new Date(expense.updated_at).toLocaleString()}</p>
          </div>
        </CardContent>
      </Card>

      {expense && (
        <CreateExpenseModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onExpenseCreatedOrUpdated={handleExpenseUpdated}
          initialData={expense}
          categories={categories}
        />
      )}
    </div>
  )
}
