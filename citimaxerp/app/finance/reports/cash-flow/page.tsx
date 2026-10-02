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
  TrendingDown,
  DollarSign
} from "lucide-react"
import { financeApi, type CashFlowStatement } from "@/lib/finance"

export default function CashFlowStatementPage() {
  const [cashFlowStatement, setCashFlowStatement] = useState<CashFlowStatement | null>(null)
  const [loading, setLoading] = useState(false)
  const [fromDate, setFromDate] = useState(() => {
    const date = new Date()
    date.setMonth(date.getMonth() - 12) // Last 12 months
    return date.toISOString().split('T')[0]
  })
  const [toDate, setToDate] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })

  const fetchCashFlowStatement = async () => {
    try {
      setLoading(true)
      const data = await financeApi.getCashFlowStatement({
        date_from: fromDate,
        date_to: toDate,
        company_id: undefined // Will use default company
      })
      
      // Transform the API response to match our interface
      const transformedData: CashFlowStatement = {
        status: 'success',
        message: 'Cash flow statement loaded successfully',
        operatingActivities: data.operating_activities || [],
        investingActivities: data.investing_activities || [],
        financingActivities: data.financing_activities || [],
        netCashFlow: data.net_cash_flow || 0,
        beginningCash: data.beginning_cash || 0,
        endingCash: data.ending_cash || 0
      }
      
      setCashFlowStatement(transformedData)
    } catch (error) {
      console.error('Error fetching cash flow statement:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCashFlowStatement()
  }, [fromDate, toDate])

  const handleExport = () => {
    if (!cashFlowStatement) return
    
    const csvContent = [
      ['Cash Flow Statement', '', ''],
      [`Period: ${fromDate} to ${toDate}`, '', ''],
      ['', '', ''],
      ['OPERATING ACTIVITIES', '', ''],
      ...cashFlowStatement.operatingActivities.map((item: any) => [
        `  ${item.accountName}`,
        item.amount.toLocaleString(),
        ''
      ]),
      ['Net Cash from Operating Activities', '', ''],
      ['', '', ''],
      ['INVESTING ACTIVITIES', '', ''],
      ...cashFlowStatement.investingActivities.map((item: any) => [
        `  ${item.accountName}`,
        item.amount.toLocaleString(),
        ''
      ]),
      ['Net Cash from Investing Activities', '', ''],
      ['', '', ''],
      ['FINANCING ACTIVITIES', '', ''],
      ...cashFlowStatement.financingActivities.map((item: any) => [
        `  ${item.accountName}`,
        item.amount.toLocaleString(),
        ''
      ]),
      ['Net Cash from Financing Activities', '', ''],
      ['', '', ''],
      ['Net Change in Cash', cashFlowStatement.netCashFlow.toLocaleString(), ''],
      ['Beginning Cash Balance', cashFlowStatement.beginningCash.toLocaleString(), ''],
      ['Ending Cash Balance', cashFlowStatement.endingCash.toLocaleString(), ''],
    ]

    const csv = csvContent.map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cash-flow-statement-${fromDate}-to-${toDate}.csv`
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

  const calculateSectionTotal = (activities: any[]) => {
    return activities.reduce((total, activity) => total + activity.amount, 0)
  }

  const renderCashFlowSection = (title: string, activities: any[], icon: any) => {
    const Icon = icon
    const sectionTotal = calculateSectionTotal(activities)
    
    return (
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Icon className={`h-5 w-5 ${sectionTotal >= 0 ? 'text-green-600' : 'text-red-600'}`} />
          {title}
        </h3>
        <div className="space-y-2">
          {activities.map((item: any, index: number) => (
            <div key={index} className="flex justify-between items-center py-1">
              <span className="pl-4">{item.accountName}</span>
              <span className={`font-medium ${item.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(item.amount)}
              </span>
            </div>
          ))}
          <Separator />
          <div className="flex justify-between items-center py-2 font-semibold">
            <span>Net Cash from {title}</span>
            <span className={sectionTotal >= 0 ? 'text-green-600' : 'text-red-600'}>
              {formatCurrency(sectionTotal)}
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Cash Flow Statement</h1>
          <p className="text-muted-foreground">
            Statement of cash flows from operating, investing, and financing activities
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
            <Button onClick={fetchCashFlowStatement} disabled={loading}>
              Generate Report
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Cash Flow Statement */}
      {cashFlowStatement && (
        <div className="print:shadow-none">
          <Card>
            <CardHeader>
              <CardTitle className="text-center">Cash Flow Statement</CardTitle>
              <p className="text-center text-muted-foreground">
                For the period from {new Date(fromDate).toLocaleDateString()} to {new Date(toDate).toLocaleDateString()}
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Operating Activities */}
              {renderCashFlowSection("Operating Activities", cashFlowStatement.operatingActivities, TrendingUp)}

              <Separator className="my-6" />

              {/* Investing Activities */}
              {renderCashFlowSection("Investing Activities", cashFlowStatement.investingActivities, TrendingDown)}

              <Separator className="my-6" />

              {/* Financing Activities */}
              {renderCashFlowSection("Financing Activities", cashFlowStatement.financingActivities, DollarSign)}

              <Separator className="my-6" />

              {/* Net Cash Flow Summary */}
              <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Net Change in Cash</span>
                  <span className={`font-bold ${cashFlowStatement.netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(cashFlowStatement.netCashFlow)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Beginning Cash Balance</span>
                  <span className="font-medium">
                    {formatCurrency(cashFlowStatement.beginningCash)}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between items-center text-lg font-bold">
                  <span>Ending Cash Balance</span>
                  <span className={cashFlowStatement.endingCash >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {formatCurrency(cashFlowStatement.endingCash)}
                  </span>
                </div>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <Card>
                  <CardContent className="p-4">
                    <div className="text-sm text-muted-foreground">Operating Cash Flow</div>
                    <div className="text-lg font-semibold">
                      {formatCurrency(calculateSectionTotal(cashFlowStatement.operatingActivities))}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-sm text-muted-foreground">Investing Cash Flow</div>
                    <div className="text-lg font-semibold">
                      {formatCurrency(calculateSectionTotal(cashFlowStatement.investingActivities))}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-sm text-muted-foreground">Financing Cash Flow</div>
                    <div className="text-lg font-semibold">
                      {formatCurrency(calculateSectionTotal(cashFlowStatement.financingActivities))}
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
