"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ChartSkeleton } from "@/components/ui/skeletons"
import { Progress } from "@/components/ui/progress"
import { 
  Calculator, 
  Download, 
  Printer, 
  Calendar,
  TrendingUp,
  TrendingDown,
  Target,
  Activity,
  DollarSign,
  BarChart3
} from "lucide-react"
import { financeApi, type FinancialRatios } from "@/lib/finance"

export default function FinancialRatiosPage() {
  const [financialRatios, setFinancialRatios] = useState<FinancialRatios | null>(null)
  const [loading, setLoading] = useState(false)
  const [asOfDate, setAsOfDate] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })
  const [fromDate, setFromDate] = useState(() => {
    const date = new Date()
    date.setMonth(date.getMonth() - 12) // Last 12 months for period ratios
    return date.toISOString().split('T')[0]
  })

  const fetchFinancialRatios = async () => {
    try {
      setLoading(true)
      const data = await financeApi.getFinancialRatios({
        as_of_date: asOfDate,
        date_from: fromDate,
        company_id: undefined // Will use default company
      })
      
      // Transform the API response to match our interface
      const transformedData: FinancialRatios = {
        status: 'success',
        message: 'Financial ratios loaded successfully',
        liquidityRatios: {
          currentRatio: data.liquidity_ratios?.current_ratio || 0,
          quickRatio: data.liquidity_ratios?.quick_ratio || 0,
          cashRatio: data.liquidity_ratios?.cash_ratio || 0,
        },
        profitabilityRatios: {
          grossProfitMargin: data.profitability_ratios?.gross_profit_margin || 0,
          netProfitMargin: data.profitability_ratios?.net_profit_margin || 0,
          returnOnAssets: data.profitability_ratios?.return_on_assets || 0,
          returnOnEquity: data.profitability_ratios?.return_on_equity || 0,
        },
        leverageRatios: {
          debtToEquity: data.leverage_ratios?.debt_to_equity || 0,
          debtToAssets: data.leverage_ratios?.debt_to_assets || 0,
          equityRatio: data.leverage_ratios?.equity_ratio || 0,
        },
        efficiencyRatios: {
          assetTurnover: data.efficiency_ratios?.asset_turnover || 0,
          inventoryTurnover: data.efficiency_ratios?.inventory_turnover || 0,
          receivableTurnover: data.efficiency_ratios?.receivable_turnover || 0,
        }
      }
      
      setFinancialRatios(transformedData)
    } catch (error) {
      console.error('Error fetching financial ratios:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFinancialRatios()
  }, [asOfDate, fromDate])

  const handleExport = () => {
    if (!financialRatios) return
    
    const csvContent = [
      ['Financial Ratios Analysis', ''],
      [`As of: ${asOfDate}`, ''],
      [`Period: ${fromDate} to ${asOfDate}`, ''],
      ['', ''],
      ['LIQUIDITY RATIOS', ''],
      ['Current Ratio', financialRatios.liquidityRatios.currentRatio.toFixed(2)],
      ['Quick Ratio', financialRatios.liquidityRatios.quickRatio.toFixed(2)],
      ['Cash Ratio', financialRatios.liquidityRatios.cashRatio.toFixed(2)],
      ['', ''],
      ['PROFITABILITY RATIOS', ''],
      ['Gross Profit Margin', `${(financialRatios.profitabilityRatios.grossProfitMargin * 100).toFixed(1)}%`],
      ['Net Profit Margin', `${(financialRatios.profitabilityRatios.netProfitMargin * 100).toFixed(1)}%`],
      ['Return on Assets', `${(financialRatios.profitabilityRatios.returnOnAssets * 100).toFixed(1)}%`],
      ['Return on Equity', `${(financialRatios.profitabilityRatios.returnOnEquity * 100).toFixed(1)}%`],
      ['', ''],
      ['LEVERAGE RATIOS', ''],
      ['Debt to Equity', financialRatios.leverageRatios.debtToEquity.toFixed(2)],
      ['Debt to Assets', `${(financialRatios.leverageRatios.debtToAssets * 100).toFixed(1)}%`],
      ['Equity Ratio', `${(financialRatios.leverageRatios.equityRatio * 100).toFixed(1)}%`],
      ['', ''],
      ['EFFICIENCY RATIOS', ''],
      ['Asset Turnover', financialRatios.efficiencyRatios.assetTurnover.toFixed(2)],
      ['Inventory Turnover', financialRatios.efficiencyRatios.inventoryTurnover.toFixed(2)],
      ['Receivable Turnover', financialRatios.efficiencyRatios.receivableTurnover.toFixed(2)],
    ]

    const csv = csvContent.map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `financial-ratios-${asOfDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handlePrint = () => {
    window.print()
  }

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(1)}%`
  }

  const formatRatio = (value: number) => {
    return value.toFixed(2)
  }

  const getRatioStatus = (value: number, good: number, excellent: number) => {
    if (value >= excellent) return { status: 'excellent', color: 'text-green-600', bgColor: 'bg-green-100' }
    if (value >= good) return { status: 'good', color: 'text-blue-600', bgColor: 'bg-blue-100' }
    return { status: 'needs improvement', color: 'text-red-600', bgColor: 'bg-red-100' }
  }

  const renderRatioCard = (title: string, value: number, format: 'ratio' | 'percentage', benchmark: {good: number, excellent: number}, description: string) => {
    const formattedValue = format === 'percentage' ? formatPercentage(value) : formatRatio(value)
    const status = getRatioStatus(value, benchmark.good, benchmark.excellent)
    
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xl font-bold">{formattedValue}</span>
            <Badge className={`${status.bgColor} ${status.color} border-0`}>
              {status.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mb-3">{description}</p>
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Poor</span>
              <span>Good</span>
              <span>Excellent</span>
            </div>
            <Progress 
              value={Math.min((value / benchmark.excellent) * 100, 100)} 
              className="h-2" 
            />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Financial Ratios</h1>
          <p className="text-muted-foreground">
            Key financial ratios and performance indicators
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
            Analysis Period
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
              <Label htmlFor="asOfDate">As of Date</Label>
              <Input
                id="asOfDate"
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
              />
            </div>
            <Button onClick={fetchFinancialRatios} disabled={loading}>
              Generate Analysis
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Financial Ratios */}
      {financialRatios && (
        <div className="space-y-8 print:shadow-none">
          {/* Liquidity Ratios */}
          <div>
            <div className="flex items-center gap-2 mb-6">
              <DollarSign className="h-6 w-6 text-blue-600" />
              <h2 className="text-2xl font-semibold">Liquidity Ratios</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {renderRatioCard(
                "Current Ratio",
                financialRatios.liquidityRatios.currentRatio,
                "ratio",
                { good: 1.5, excellent: 2.0 },
                "Measures ability to pay short-term obligations"
              )}
              {renderRatioCard(
                "Quick Ratio",
                financialRatios.liquidityRatios.quickRatio,
                "ratio",
                { good: 1.0, excellent: 1.5 },
                "Measures ability to pay short-term debts with liquid assets"
              )}
              {renderRatioCard(
                "Cash Ratio",
                financialRatios.liquidityRatios.cashRatio,
                "ratio",
                { good: 0.2, excellent: 0.5 },
                "Measures ability to pay short-term debts with cash"
              )}
            </div>
          </div>

          {/* Profitability Ratios */}
          <div>
            <div className="flex items-center gap-2 mb-6">
              <TrendingUp className="h-6 w-6 text-green-600" />
              <h2 className="text-2xl font-semibold">Profitability Ratios</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {renderRatioCard(
                "Gross Profit Margin",
                financialRatios.profitabilityRatios.grossProfitMargin,
                "percentage",
                { good: 0.3, excellent: 0.5 },
                "Percentage of revenue remaining after cost of goods sold"
              )}
              {renderRatioCard(
                "Net Profit Margin",
                financialRatios.profitabilityRatios.netProfitMargin,
                "percentage",
                { good: 0.1, excellent: 0.2 },
                "Percentage of revenue remaining after all expenses"
              )}
              {renderRatioCard(
                "Return on Assets",
                financialRatios.profitabilityRatios.returnOnAssets,
                "percentage",
                { good: 0.05, excellent: 0.15 },
                "Efficiency in using assets to generate profit"
              )}
              {renderRatioCard(
                "Return on Equity",
                financialRatios.profitabilityRatios.returnOnEquity,
                "percentage",
                { good: 0.1, excellent: 0.2 },
                "Return generated on shareholders' equity"
              )}
            </div>
          </div>

          {/* Leverage Ratios */}
          <div>
            <div className="flex items-center gap-2 mb-6">
              <BarChart3 className="h-6 w-6 text-purple-600" />
              <h2 className="text-2xl font-semibold">Leverage Ratios</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {renderRatioCard(
                "Debt to Equity",
                financialRatios.leverageRatios.debtToEquity,
                "ratio",
                { good: 1.0, excellent: 0.5 },
                "Amount of debt relative to equity"
              )}
              {renderRatioCard(
                "Debt to Assets",
                financialRatios.leverageRatios.debtToAssets,
                "percentage",
                { good: 0.4, excellent: 0.2 },
                "Percentage of assets financed by debt"
              )}
              {renderRatioCard(
                "Equity Ratio",
                financialRatios.leverageRatios.equityRatio,
                "percentage",
                { good: 0.5, excellent: 0.7 },
                "Percentage of assets financed by equity"
              )}
            </div>
          </div>

          {/* Efficiency Ratios */}
          <div>
            <div className="flex items-center gap-2 mb-6">
              <Activity className="h-6 w-6 text-orange-600" />
              <h2 className="text-2xl font-semibold">Efficiency Ratios</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {renderRatioCard(
                "Asset Turnover",
                financialRatios.efficiencyRatios.assetTurnover,
                "ratio",
                { good: 1.0, excellent: 2.0 },
                "Efficiency in using assets to generate revenue"
              )}
              {renderRatioCard(
                "Inventory Turnover",
                financialRatios.efficiencyRatios.inventoryTurnover,
                "ratio",
                { good: 6.0, excellent: 12.0 },
                "How quickly inventory is sold and replaced"
              )}
              {renderRatioCard(
                "Receivable Turnover",
                financialRatios.efficiencyRatios.receivableTurnover,
                "ratio",
                { good: 8.0, excellent: 12.0 },
                "How quickly accounts receivable are collected"
              )}
            </div>
          </div>
        </div>
      )}

      {loading && (
        <ChartSkeleton height="h-[400px]" />
      )}
    </div>
  )
}
