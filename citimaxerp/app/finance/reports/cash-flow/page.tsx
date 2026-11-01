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
  Calendar,
  TrendingUp,
  TrendingDown,
  DollarSign
} from "lucide-react"
import { financeApi, type CashFlowStatement } from "@/lib/finance"
import { documentFileName, filePeriod, sessionCompanyName } from "@/lib/document-names"
import { DownloadButton } from "@/components/download-button"
import type { ExportCell, TableExport } from "@/lib/table-export"

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

  // Operating, investing and financing activities with their net totals, then the cash position.
  const buildExport = (): TableExport => {
    const s = cashFlowStatement!
    const rows: ExportCell[][] = []
    const section = (label: string, items: any[]) => {
      rows.push(["", label.toUpperCase(), null])
      items.forEach((item, i) => rows.push([i + 1, item.accountName, Number(item.amount) || 0]))
      rows.push(["", `Net Cash from ${label}`, calculateSectionTotal(items)])
    }
    section("Operating Activities", s.operatingActivities)
    section("Investing Activities", s.investingActivities)
    section("Financing Activities", s.financingActivities)
    return {
      fileName: documentFileName([sessionCompanyName(), `Cash Flow Statement ${filePeriod(fromDate, toDate)}`]),
      title: "Cash Flow Statement",
      subtitle: `For the period ${new Date(fromDate).toLocaleDateString("en-GB")} to ${new Date(toDate).toLocaleDateString("en-GB")}`,
      headers: ["S/No", "Account", "Amount"],
      moneyColumns: [2],
      rows,
      footer: [
        ["", "Net Change in Cash", s.netCashFlow],
        ["", "Beginning Cash Balance", s.beginningCash],
        ["", "Ending Cash Balance", s.endingCash],
      ],
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES'
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
        <DownloadButton title="Cash Flow Statement" build={buildExport} disabled={!cashFlowStatement} />
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
