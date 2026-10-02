"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DollarSign, TrendingUp, Calendar } from "lucide-react"
import { getExpenses } from "@/lib/expenses"
import { formatCurrency } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/lib/auth-context"

export function ExpensesSummary() {
  const { companyId } = useAuth()
  const [totalAmount, setTotalAmount] = useState(0)
  const [totalExpenses, setTotalExpenses] = useState(0)
  const [monthlyAmount, setMonthlyAmount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchExpenses() {
      try {
        setLoading(true)
        
        // Don't fetch if we don't have a company ID
        if (!companyId) {
          console.warn('ExpensesSummary: No company ID available, skipping fetch');
          setLoading(false);
          return;
        }
        
        const expenses = await getExpenses({ company_id: companyId })
        
        // Calculate summary metrics
        setTotalExpenses(expenses?.length || 0)
        const total = expenses?.reduce((sum, expense) => sum + (parseFloat(String(expense.amount)) || 0), 0) || 0
        setTotalAmount(total)
        
        // Get current month expenses
        const currentMonth = new Date().getMonth()
        const currentYear = new Date().getFullYear()
        const currentMonthExpenses = expenses?.filter((expense) => {
          const expenseDate = new Date(expense.expense_date || expense.created_at)
          return expenseDate.getMonth() === currentMonth && expenseDate.getFullYear() === currentYear
        }) || []
        
        const monthly = currentMonthExpenses.reduce((sum, expense) => sum + (parseFloat(String(expense.amount)) || 0), 0)
        setMonthlyAmount(monthly)
      } catch (error) {
        // console.error("Error fetching expenses for summary:", error)
      } finally {
        setLoading(false)
      }
    }
    
    if (companyId) {
      fetchExpenses()
    }
  }, [companyId])
  
  // Calculate percentage changes (mock data for now)
  const totalChange = "+15.2%"
  const monthlyChange = "+8.7%"
  const countChange = "+12.3%"

  return (
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
            <>
              <div className="text-2xl font-bold">{formatCurrency(totalAmount)}</div>
              <p className="text-xs text-muted-foreground">{totalChange} from previous period</p>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">This Month</CardTitle>
          <Calendar className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-8 w-24" />
          ) : (
            <>
              <div className="text-2xl font-bold">{formatCurrency(monthlyAmount)}</div>
              <p className="text-xs text-muted-foreground">{monthlyChange} from last month</p>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Entries</CardTitle>
          <TrendingUp className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <>
              <div className="text-2xl font-bold">{totalExpenses}</div>
              <p className="text-xs text-muted-foreground">{countChange} from previous period</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
