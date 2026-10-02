"use client"

import { useState, useEffect } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { 
  Calendar, 
  CreditCard, 
  FileText, 
  Store, 
  Tag, 
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Pencil,
  Receipt,
  User,
  Building2,
  X,
  DollarSign,
  Layers,
  ImageIcon,
  AlertCircle
} from "lucide-react"
import Image from "next/image"
import { getExpenseById } from "@/lib/expenses"
import { formatCurrency } from "@/lib/utils"
import type { Expense } from "@/types/expenses"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

interface ExpenseDetailsSheetProps {
  expenseId: string
  isOpen: boolean
  onClose: () => void
  onEditClick?: () => void
}

export function ExpenseDetailsSheet({ expenseId, isOpen, onClose, onEditClick }: ExpenseDetailsSheetProps) {
  const [expense, setExpense] = useState<Expense | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isOpen && expenseId) {
      fetchExpenseDetails()
    }
  }, [isOpen, expenseId])

  async function fetchExpenseDetails() {
    setLoading(true)
    try {
      const data = await getExpenseById(expenseId)
      if (data) {
        setExpense(data)
      }
    } catch (error) {
      console.error("Error fetching expense details:", error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "approved": return "bg-green-500"
      case "paid": return "bg-blue-500"
      case "pending": return "bg-amber-500"
      case "rejected": return "bg-red-500"
      default: return "bg-gray-500"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case "approved":
      case "paid":
        return <CheckCircle2 className="h-4 w-4" />
      case "pending":
        return <Clock className="h-4 w-4" />
      case "rejected":
        return <XCircle className="h-4 w-4" />
      default:
        return <AlertCircle className="h-4 w-4" />
    }
  }

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase()
  }

  // Format date helper
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (!expense && !loading) {
    return (
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto bg-gradient-to-br from-gray-50 to-gray-100 p-0">
          <div className="flex flex-col items-center justify-center h-full space-y-4 p-8">
            <div className="p-4 bg-gray-100 rounded-full">
              <FileText className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="font-semibold text-lg">Expense not found</h3>
            <p className="text-muted-foreground text-sm text-center">This expense may have been deleted or you don't have permission to view it.</p>
            <Button onClick={onClose} variant="outline">Close</Button>
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto bg-gradient-to-br from-gray-50 to-gray-100 p-0">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
            <p className="text-muted-foreground text-sm">Loading expense details...</p>
          </div>
        ) : expense && (
          <>
            {/* Header with gradient background */}
            <div className="bg-gradient-to-r from-white to-white p-6 text-white relative overflow-hidden">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiPjxkZWZzPjxwYXR0ZXJuIGlkPSJwYXR0ZXJuIiB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHBhdHRlcm5Vbml0cz0idXNlclNwYWNlT25Vc2UiIHBhdHRlcm5UcmFuc2Zvcm09InJvdGF0ZSg0NSkiPjxjaXJjbGUgY3g9IjIwIiBjeT0iMjAiIHI9IjAuNSIgZmlsbD0id2hpdGUiIGZpbGwtb3BhY2l0eT0iMC4xNSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNwYXR0ZXJuKSIvPjwvc3ZnPg==')] opacity-20"></div>
              <SheetHeader className="relative z-10">
                <div className="flex items-center justify-between">
                  <SheetTitle className="flex items-center gap-3 text-2xl font-bold">
                    <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                      <Receipt className="h-6 w-6" />
                    </div>
                    Expense Details
                  </SheetTitle>
                </div>
              </SheetHeader>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Hero Section with Modern Card */}
              <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
                <div className="p-6">
                  {/* Vendor and Status */}
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                        {expense.vendor_name?.charAt(0) || "?"}
                      </div>
                      <div>
                        <h1 className="text-2xl font-bold text-gray-900">{expense.vendor_name || "Unknown Vendor"}</h1>
                        <p className="text-sm text-gray-500">#{expense.id?.slice(0, 8) || "N/A"}</p>
                      </div>
                    </div>
                    <div className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-semibold text-white flex items-center gap-1.5 shadow-lg",
                      getStatusColor(expense.status)
                    )}>
                      {getStatusIcon(expense.status)}
                      <span className="capitalize">{expense.status}</span>
                    </div>
                  </div>
                  
                  {/* Amount Card */}
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-5 border border-green-200 shadow-sm mb-6">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                      <div>
                        <p className="text-sm text-green-700 mb-1">Total Amount</p>
                        <p className="text-3xl font-bold text-green-900">{formatCurrency(expense.amount)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-green-600 mb-1">Expense Date</p>
                        <p className="text-lg font-semibold text-green-800">
                          {format(new Date(expense.expense_date), "MMM d, yyyy")}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Quick Stats */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-3 border border-blue-100">
                      <div className="flex items-center space-x-2">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <CreditCard className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">Payment Method</p>
                          <p className="text-sm font-bold text-gray-900 capitalize">{expense.payment_method?.replace(/_/g, " ") || "N/A"}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-3 border border-purple-100">
                      <div className="flex items-center space-x-2">
                        <div className="p-2 rounded-lg" style={{ backgroundColor: expense.category?.color ? `${expense.category.color}20` : '#f3f4f6' }}>
                          <Tag className="h-4 w-4" style={{ color: expense.category?.color || '#6b7280' }} />
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">Category</p>
                          <p className="text-sm font-bold text-gray-900">{expense.category?.name || "Uncategorized"}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Description Card */}
              <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Layers className="h-5 w-5 text-violet-600" />
                  Description
                </h3>
                <div className="prose prose-sm max-w-none">
                  <p className="text-gray-700 leading-relaxed">{expense.description || "No description provided"}</p>
                </div>
              </div>
              
              {/* Notes Card */}
              {expense.notes && (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl shadow-lg p-6 border border-amber-200">
                  <h3 className="text-xl font-bold text-amber-900 mb-4 flex items-center gap-2">
                    <FileText className="h-5 w-5 text-amber-600" />
                    Notes
                  </h3>
                  <p className="text-amber-800 leading-relaxed italic">"{expense.notes}"</p>
                </div>
              )}
              
              {/* Expense Details Card */}
              <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-blue-600" />
                  Expense Details
                </h3>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-600">Date</span>
                    <span className="font-medium">{format(new Date(expense.expense_date), "PPP")}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-600">Payment Method</span>
                    <Badge variant="outline" className="capitalize">{expense.payment_method?.replace(/_/g, " ") || "N/A"}</Badge>
                  </div>
                  {(expense.store_id || expense.store_name) && (
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="text-gray-600 flex items-center gap-1">
                        <Building2 className="h-4 w-4" /> Store
                      </span>
                      <span className="font-medium">{expense.store_name || "N/A"}</span>
                    </div>
                  )}
                  {expense.is_recurring && (
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="text-gray-600 flex items-center gap-1">
                        <RefreshCw className="h-4 w-4" /> Recurring
                      </span>
                      <Badge className="bg-purple-100 text-purple-800 border-purple-200 capitalize">
                        {expense.recurring_frequency}
                      </Badge>
                    </div>
                  )}
                  <div className="flex justify-between items-center py-2">
                    <span className="text-gray-600">Created</span>
                    <span className="text-sm text-gray-500">{formatDate(expense.created_at)}</span>
                  </div>
                </div>
              </div>
              
              {/* Tags Card */}
              {expense.tags && expense.tags.length > 0 && (
                <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
                  <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Tag className="h-5 w-5 text-violet-600" />
                    Tags
                  </h3>
                  
                  <div className="flex flex-wrap gap-2">
                    {expense.tags.map((tag, index) => (
                      <Badge
                        key={index}
                        className="bg-gradient-to-r from-violet-50 to-purple-50 border-violet-200 text-violet-700 hover:from-violet-100 hover:to-purple-100 transition-all duration-300 text-xs"
                      >
                        <Tag className="w-3 h-3 mr-1" />
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Activity Card */}
              <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
                <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <User className="h-5 w-5 text-gray-600" />
                  Activity
                </h3>
                
                <div className="space-y-6">
                  {/* Created By */}
                  <div className="flex items-start gap-4">
                    <Avatar className="w-10 h-10 border-2 border-gray-200">
                      <AvatarImage src={expense.created_by.avatar_url || ""} />
                      <AvatarFallback className="bg-gray-100 text-gray-600">
                        {getInitials(expense.created_by.first_name, expense.created_by.last_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">
                          {expense.created_by.first_name} {expense.created_by.last_name}
                        </span>
                        <Badge variant="outline" className="text-xs">Created</Badge>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{formatDate(expense.created_at)}</p>
                    </div>
                  </div>
                  
                  {/* Approved By */}
                  {expense.approved_by && (
                    <>
                      <Separator />
                      <div className="flex items-start gap-4">
                        <Avatar className="w-10 h-10 border-2 border-green-200">
                          <AvatarImage src={expense.approved_by.avatar_url || ""} />
                          <AvatarFallback className="bg-green-50 text-green-700">
                            {getInitials(expense.approved_by.first_name, expense.approved_by.last_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-green-700">
                              {expense.approved_by.first_name} {expense.approved_by.last_name}
                            </span>
                            <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">Approved</Badge>
                          </div>
                          <p className="text-sm text-gray-500 mt-1">{formatDate(expense.updated_at)}</p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
            
            {/* Footer */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4">
              <div className="flex justify-end">
                <Button 
                  variant="outline" 
                  onClick={onClose}
                >
                  <X className="h-4 w-4 mr-2" />
                  Close
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
