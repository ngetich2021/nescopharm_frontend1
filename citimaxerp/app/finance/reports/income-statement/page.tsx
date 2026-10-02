"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ChartSkeleton } from "@/components/ui/skeletons"
import { 
  FileText, 
  Download, 
  Printer, 
  Calendar,
  TrendingUp,
  TrendingDown
} from "lucide-react"
import { financeApi, type IncomeStatement } from "@/lib/finance"

export default function IncomeStatementPage() {
  const [incomeStatement, setIncomeStatement] = useState<IncomeStatement | null>(null)
  const [loading, setLoading] = useState(false)
  const [fromDate, setFromDate] = useState(() => {
    const date = new Date()
    date.setMonth(date.getMonth() - 12) // Last 12 months
    return date.toISOString().split('T')[0]
  })
  const [toDate, setToDate] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })

  const fetchIncomeStatement = async () => {
    try {
      setLoading(true)
      const data = await financeApi.getIncomeStatement({
        date_from: fromDate,
        date_to: toDate,
        company_id: undefined // Will use default company
      })
      
      // Transform the API response to match our interface
      const transformedData: IncomeStatement = {
        status: 'success',
        message: 'Income statement loaded successfully',
        totalRevenue: data.total_revenue || 0,
        totalExpenses: data.total_expenses || 0,
        netIncome: data.net_income || 0,
        revenue: data.revenue || [],
        expenses: data.expenses || []
      }
      
      setIncomeStatement(transformedData)
    } catch (error) {
      console.error('Error fetching income statement:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchIncomeStatement()
  }, [fromDate, toDate])

  const handleExport = () => {
    if (!incomeStatement) return
    
    const csvContent = [
      ['Income Statement', '', ''],
      [`Period: ${fromDate} to ${toDate}`, '', ''],
      ['', '', ''],
      ['Account', 'Amount', 'Percentage'],
      ['REVENUE', '', ''],
      ...incomeStatement.revenue.map((item: any) => [
        `  ${item.accountName}`,
        item.amount.toLocaleString(),
        `${((item.amount / incomeStatement.totalRevenue) * 100).toFixed(1)}%`
      ]),
      ['Total Revenue', incomeStatement.totalRevenue.toLocaleString(), '100.0%'],
      ['', '', ''],
      ['EXPENSES', '', ''],
      ...incomeStatement.expenses.map((item: any) => [
        `  ${item.accountName}`,
        item.amount.toLocaleString(),
        `${((item.amount / incomeStatement.totalExpenses) * 100).toFixed(1)}%`
      ]),
      ['Total Expenses', incomeStatement.totalExpenses.toLocaleString(), '100.0%'],
      ['', '', ''],
      ['NET INCOME', incomeStatement.netIncome.toLocaleString(), ''],
    ]

    const csv = csvContent.map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `income-statement-${fromDate}-to-${toDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handlePrint = () => {
    window.print()
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const getPercentage = (amount: number, total: number) => {
    if (total === 0) return 0
    return ((amount / total) * 100).toFixed(1)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Income Statement</h1>
          <p className="text-muted-foreground">
            Profit and loss statement showing revenues and expenses
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleExport} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button onClick={handlePrint} variant="outline" size="sm">
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
        </div>
      </div>

      {/* Date Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Report Period
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="fromDate">From Date</Label>
              <Input
                id="fromDate"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="toDate">To Date</Label>
              <Input
                id="toDate"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
            <Button onClick={fetchIncomeStatement} disabled={loading}>
              Generate Report
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Income Statement */}
      {incomeStatement && (
        <div className="print:shadow-none">
          <Card>
            <CardHeader>
              <CardTitle className="text-center">Income Statement</CardTitle>
              <p className="text-center text-muted-foreground">
                For the period from {new Date(fromDate).toLocaleDateString()} to {new Date(toDate).toLocaleDateString()}
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Revenue Section */}
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  REVENUE
                </h3>
                <div className="space-y-2">
                  {incomeStatement.revenue.map((item: any, index: number) => (
                    <div key={index} className="flex justify-between items-center py-1">
                      <span className="pl-4">{item.accountName}</span>
                      <div className="text-right">
                        <span className="font-medium">{formatCurrency(item.amount)}</span>
                        <Badge variant="secondary" className="ml-2 text-xs">
                          {getPercentage(item.amount, incomeStatement.totalRevenue)}%
                        </Badge>
                      </div>
                    </div>
                  ))}
                  <Separator />
                  <div className="flex justify-between items-center py-2 font-semibold">
                    <span>Total Revenue</span>
                    <span className="text-green-600">{formatCurrency(incomeStatement.totalRevenue)}</span>
                  </div>
                </div>
              </div>

              <Separator className="my-6" />

              {/* Expenses Section */}
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-red-600" />
                  EXPENSES
                </h3>
                <div className="space-y-2">
                  {incomeStatement.expenses.map((item: any, index: number) => (
                    <div key={index} className="flex justify-between items-center py-1">
                      <span className="pl-4">{item.accountName}</span>
                      <div className="text-right">
                        <span className="font-medium">{formatCurrency(item.amount)}</span>
                        <Badge variant="secondary" className="ml-2 text-xs">
                          {getPercentage(item.amount, incomeStatement.totalExpenses)}%
                        </Badge>
                      </div>
                    </div>
                  ))}
                  <Separator />
                  <div className="flex justify-between items-center py-2 font-semibold">
                    <span>Total Expenses</span>
                    <span className="text-red-600">{formatCurrency(incomeStatement.totalExpenses)}</span>
                  </div>
                </div>
              </div>

              <Separator className="my-6" />

              {/* Net Income */}
              <div className="bg-muted/50 p-4 rounded-lg">
                <div className="flex justify-between items-center text-xl font-bold">
                  <span>NET INCOME</span>
                  <span className={incomeStatement.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {formatCurrency(incomeStatement.netIncome)}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground mt-2">
                  Net Income Margin: {getPercentage(incomeStatement.netIncome, incomeStatement.totalRevenue)}%
                </div>
              </div>

              {/* Summary Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <Card>
                  <CardContent className="p-4">
                    <div className="text-sm text-muted-foreground">Gross Profit</div>
                    <div className="text-lg font-semibold">
                      {formatCurrency(incomeStatement.totalRevenue)}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-sm text-muted-foreground">Total Expenses</div>
                    <div className="text-lg font-semibold text-red-600">
                      {formatCurrency(incomeStatement.totalExpenses)}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-sm text-muted-foreground">Net Margin</div>
                    <div className="text-lg font-semibold">
                      {getPercentage(incomeStatement.netIncome, incomeStatement.totalRevenue)}%
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {loading && (
        <ChartSkeleton height="h-[400px]" />
      )}
    </div>
  )
}
