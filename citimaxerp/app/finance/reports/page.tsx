"use client"

import { useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  FileText, 
  TrendingUp, 
  DollarSign, 
  BarChart3,
  PieChart,
  Calculator,
  ArrowRight
} from "lucide-react"
import { PermissionGuard } from "@/components/PermissionGuard"

const reports = [
  {
    id: "balance-sheet",
    title: "Balance Sheet",
    description: "Statement of financial position showing assets, liabilities, and equity",
    icon: FileText,
    href: "/finance/reports/balance-sheet",
    category: "Financial Statements",
    color: "bg-blue-500",
    permission: "can_view_balance_sheet"
  },
  {
    id: "income-statement",
    title: "Income Statement",
    description: "Profit and loss statement showing revenues and expenses",
    icon: TrendingUp,
    href: "/finance/reports/income-statement",
    category: "Financial Statements",
    color: "bg-green-500",
    permission: "can_view_income_statement"
  },
  {
    id: "cash-flow",
    title: "Cash Flow Statement",
    description: "Statement of cash flows from operating, investing, and financing activities",
    icon: DollarSign,
    href: "/finance/reports/cash-flow",
    category: "Financial Statements",
    color: "bg-purple-500",
    permission: "can_view_cash_flow_statement"
  },
  {
    id: "financial-ratios",
    title: "Financial Ratios",
    description: "Key financial ratios and performance indicators",
    icon: Calculator,
    href: "/finance/reports/financial-ratios",
    category: "Analysis",
    color: "bg-orange-500",
    permission: "can_view_financial_ratios"
  },
  {
    id: "account-aging",
    title: "Account Aging Report",
    description: "Aging analysis of receivables and payables (Coming Soon)",
    icon: BarChart3,
    href: "#",
    category: "Analysis",
    color: "bg-red-500",
    comingSoon: true,
    permission: "can_view_account_aging"
  },
  {
    id: "budget-variance",
    title: "Budget vs Actual",
    description: "Budget variance analysis and performance tracking (Coming Soon)",
    icon: PieChart,
    href: "#",
    category: "Analysis",
    color: "bg-indigo-500",
    comingSoon: true,
    permission: "can_view_budget_variance"
  },
]

const categories = Array.from(new Set(reports.map(report => report.category)))

export default function FinancialReportsPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all")

  const filteredReports = selectedCategory === "all" 
    ? reports 
    : reports.filter(report => report.category === selectedCategory)

  return (
    <PermissionGuard permissions={["can_view_financial_reports", "can_manage_system", "can_manage_company"]}>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Financial Reports</h1>
          <p className="text-muted-foreground">
            Generate comprehensive financial statements and analysis reports
          </p>
        </div>

        {/* Category Filter */}
        <div className="flex gap-2">
          <Button
            variant={selectedCategory === "all" ? "default" : "outline"}
            onClick={() => setSelectedCategory("all")}
            size="sm"
          >
            All Reports
          </Button>
          {categories.map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? "default" : "outline"}
              onClick={() => setSelectedCategory(category)}
              size="sm"
            >
              {category}
            </Button>
          ))}
        </div>

        {/* Reports Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredReports.map((report) => (
            <PermissionGuard key={report.id} permissions={[report.permission, "can_manage_system", "can_manage_company"]}>
              <Card key={report.id} className="relative group hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${report.color} text-white`}>
                      <report.icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-lg">{report.title}</CardTitle>
                      <div className="text-xs text-muted-foreground">{report.category}</div>
                    </div>
                    {report.comingSoon && (
                      <div className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">
                        Coming Soon
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="mb-4">
                    {report.description}
                  </CardDescription>
                  
                  {report.comingSoon ? (
                    <Button disabled className="w-full">
                      Coming Soon
                    </Button>
                  ) : (
                    <Link href={report.href} className="block">
                      <Button className="w-full group-hover:bg-primary/90">
                        Generate Report
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </Link>
                  )}
                </CardContent>
              </Card>
            </PermissionGuard>
          ))}
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Common financial reporting tasks
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <PermissionGuard permissions={["can_view_balance_sheet", "can_manage_system", "can_manage_company"]} hideOnDenied>
                <Link href="/finance/reports/balance-sheet">
                  <Button variant="outline" className="w-full h-auto p-4 flex flex-col items-center gap-2">
                    <FileText className="h-6 w-6" />
                    <div className="text-center">
                      <div className="font-medium">Current Balance Sheet</div>
                      <div className="text-xs text-muted-foreground">As of today</div>
                    </div>
                  </Button>
                </Link>
              </PermissionGuard>
              
              <PermissionGuard permissions={["can_view_income_statement", "can_manage_system", "can_manage_company"]} hideOnDenied>
                <Link href="/finance/reports/income-statement">
                  <Button variant="outline" className="w-full h-auto p-4 flex flex-col items-center gap-2">
                    <TrendingUp className="h-6 w-6" />
                    <div className="text-center">
                      <div className="font-medium">YTD Income Statement</div>
                      <div className="text-xs text-muted-foreground">Year to date</div>
                    </div>
                  </Button>
                </Link>
              </PermissionGuard>
              
              <PermissionGuard permissions={["can_view_cash_flow_statement", "can_manage_system", "can_manage_company"]} hideOnDenied>
                <Link href="/finance/reports/cash-flow">
                  <Button variant="outline" className="w-full h-auto p-4 flex flex-col items-center gap-2">
                    <DollarSign className="h-6 w-6" />
                    <div className="text-center">
                      <div className="font-medium">Monthly Cash Flow</div>
                      <div className="text-xs text-muted-foreground">This month</div>
                    </div>
                  </Button>
                </Link>
              </PermissionGuard>
              
              <PermissionGuard permissions={["can_view_financial_ratios", "can_manage_system", "can_manage_company"]} hideOnDenied>
                <Link href="/finance/reports/financial-ratios">
                  <Button variant="outline" className="w-full h-auto p-4 flex flex-col items-center gap-2">
                    <Calculator className="h-6 w-6" />
                    <div className="text-center">
                      <div className="font-medium">Financial Ratios</div>
                      <div className="text-xs text-muted-foreground">Current period</div>
                    </div>
                  </Button>
                </Link>
              </PermissionGuard>
            </div>
          </CardContent>
        </Card>

        {/* Report Schedule Info */}
        <Card>
          <CardHeader>
            <CardTitle>Reporting Schedule</CardTitle>
            <CardDescription>
              Recommended frequency for financial reports
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h4 className="font-medium mb-2">Monthly Reports</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Income Statement</li>
                  <li>• Cash Flow Statement</li>
                  <li>• Trial Balance</li>
                  <li>• Financial Ratios</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">Quarterly/Yearly Reports</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Balance Sheet</li>
                  <li>• Comprehensive Financial Statements</li>
                  <li>• Budget vs Actual Analysis</li>
                  <li>• Account Aging Reports</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PermissionGuard>
  )
}