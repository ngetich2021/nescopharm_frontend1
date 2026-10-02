"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { FinanceDashboardSkeleton } from "@/components/ui/skeletons"
import { 
  Calculator, 
  BookOpen, 
  DollarSign, 
  TrendingUp, 
  FileText, 
  Banknote,
  BarChart3,
  CreditCard,
  PlusCircle,
  Users,
  Target,
  Settings,
  ArrowRight,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react"
import { getChartOfAccounts, getJournalEntries, getBankAccounts, formatCurrency } from "@/lib/finance"
import { PermissionGuard } from "@/components/PermissionGuard"
import { cn } from "@/lib/utils"

export default function FinancePage() {
  const [stats, setStats] = useState({
    totalAccounts: 0,
    totalJournalEntries: 0,
    totalBankAccounts: 0,
    pendingEntries: 0,
    totalAssets: "0.00",
    totalLiabilities: "0.00",
    totalEquity: "0.00",
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Fetch chart of accounts
        const accountsResponse = await getChartOfAccounts()
        const accounts = accountsResponse.accounts || []
        
        // Fetch journal entries
        const entriesResponse = await getJournalEntries()
        const entries = entriesResponse.entries || []
        
        // Fetch bank accounts
        const bankAccountsResponse = await getBankAccounts()
        const bankAccounts = bankAccountsResponse.accounts || []

        // Calculate totals
        const assetAccounts = accounts.filter(acc => acc.account_type === 'asset')
        const liabilityAccounts = accounts.filter(acc => acc.account_type === 'liability')
        const equityAccounts = accounts.filter(acc => acc.account_type === 'equity')

        const totalAssets = assetAccounts.reduce((sum, acc) => sum + parseFloat(acc.current_balance || '0'), 0)
        const totalLiabilities = liabilityAccounts.reduce((sum, acc) => sum + parseFloat(acc.current_balance || '0'), 0)
        const totalEquity = equityAccounts.reduce((sum, acc) => sum + parseFloat(acc.current_balance || '0'), 0)

        const pendingEntries = entries.filter(entry => entry.status === 'pending').length

        setStats({
          totalAccounts: accounts.length,
          totalJournalEntries: entries.length,
          totalBankAccounts: bankAccounts.length,
          pendingEntries,
          totalAssets: totalAssets.toFixed(2),
          totalLiabilities: totalLiabilities.toFixed(2),
          totalEquity: totalEquity.toFixed(2),
        })
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchDashboardData()
  }, [])

  const quickActions = [
    {
      title: "New Journal Entry",
      description: "Record transaction",
      href: "/finance/journal-entries/create",
      icon: PlusCircle,
      variant: "default" as const,
      color: "bg-blue-500",
      permission: "can_create_journal_entries"
    },
    {
      title: "Accounting Settings",
      description: "Configure system",
      href: "/finance/accounting-settings",
      icon: Settings,
      variant: "outline" as const,
      color: "bg-slate-500",
      permission: "can_manage_accounting_settings"
    },
    {
      title: "Chart of Accounts",
      description: "Manage accounts",
      href: "/finance/chart-of-accounts",
      icon: BookOpen,
      variant: "outline" as const,
      color: "bg-emerald-500",
      permission: "can_view_chart_of_accounts"
    },
    {
      title: "Financial Reports",
      description: "View statements",
      href: "/finance/reports",
      icon: BarChart3,
      variant: "outline" as const,
      color: "bg-purple-500",
      permission: "can_view_financial_reports"
    },
  ]

  const navigationCards = [
    {
      title: "Chart of Accounts",
      description: "Manage your accounting structure",
      href: "/finance/chart-of-accounts",
      icon: BookOpen,
      count: stats.totalAccounts,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      permission: "can_view_chart_of_accounts"
    },
    {
      title: "Journal Entries",
      description: "Record and manage transactions",
      href: "/finance/journal-entries",
      icon: FileText,
      count: stats.totalJournalEntries,
      badge: stats.pendingEntries > 0 ? `${stats.pendingEntries} pending` : undefined,
      color: "text-indigo-600",
      bgColor: "bg-indigo-50",
      permission: "can_view_journal_entries"
    },
    {
      title: "General Ledger",
      description: "View detailed account activity",
      href: "/finance/general-ledger",
      icon: Calculator,
      color: "text-teal-600",
      bgColor: "bg-teal-50",
      permission: "can_view_general_ledger"
    },
    {
      title: "Trial Balance",
      description: "Verify accounting equation balance",
      href: "/finance/trial-balance",
      icon: TrendingUp,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      permission: "can_view_trial_balance"
    },
    {
      title: "Bank Accounts",
      description: "Manage bank accounts and reconciliation",
      href: "/finance/bank-accounts",
      icon: Banknote,
      count: stats.totalBankAccounts,
      color: "text-green-600",
      bgColor: "bg-green-50",
      permission: "can_view_bank_accounts"
    },
    {
      title: "Financial Reports",
      description: "Generate balance sheets and income statements",
      href: "/finance/reports",
      icon: BarChart3,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      permission: "can_view_financial_reports"
    },
    {
      title: "Budgets",
      description: "Plan, track, and analyze your budgets",
      href: "/finance/budgets",
      icon: Target,
      color: "text-rose-600",
      bgColor: "bg-rose-50",
      permission: "can_view_budgets"
    },
    {
      title: "Account Mapping",
      description: "Map transaction types to accounts",
      href: "/finance/account-mappings",
      icon: ArrowRight,
      color: "text-slate-600",
      bgColor: "bg-slate-50",
      permission: "can_manage_accounting_settings"
    },
  ]

  if (isLoading) {
    return <FinanceDashboardSkeleton />
  }

  return (
    <PermissionGuard permissions={["can_view_finance_dashboard_menu", "can_manage_system", "can_manage_company"]}>
      <div className="space-y-8">
        {/* Header */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 p-8 text-white shadow-lg">
          <div className="relative z-10">
            <h1 className="text-3xl font-bold tracking-tight">Finance & Accounting</h1>
            <p className="mt-2 text-blue-100 max-w-2xl">
              Real-time financial overview, bookkeeping, and reporting for your organization.
            </p>
          </div>
          <div className="absolute right-0 top-0 h-full w-1/3 bg-white/5 skew-x-12 transform" />
        </div>

        {/* Financial Overview Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="overflow-hidden border-none shadow-md hover:shadow-lg transition-all">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-gradient-to-br from-white to-slate-50">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Assets</CardTitle>
              <div className="p-2 bg-emerald-100 rounded-full">
                <DollarSign className="h-4 w-4 text-emerald-600" />
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-slate-800">{formatCurrency(stats.totalAssets)}</div>
              <div className="flex items-center text-xs text-emerald-600 mt-1">
                <ArrowUpRight className="h-3 w-3 mr-1" />
                <span>Active Resources</span>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-none shadow-md hover:shadow-lg transition-all">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-gradient-to-br from-white to-slate-50">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Liabilities</CardTitle>
              <div className="p-2 bg-rose-100 rounded-full">
                <CreditCard className="h-4 w-4 text-rose-600" />
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-slate-800">{formatCurrency(stats.totalLiabilities)}</div>
              <div className="flex items-center text-xs text-rose-600 mt-1">
                <ArrowDownRight className="h-3 w-3 mr-1" />
                <span>Obligations</span>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-none shadow-md hover:shadow-lg transition-all">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-gradient-to-br from-white to-slate-50">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Equity</CardTitle>
              <div className="p-2 bg-blue-100 rounded-full">
                <TrendingUp className="h-4 w-4 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-slate-800">{formatCurrency(stats.totalEquity)}</div>
              <div className="flex items-center text-xs text-blue-600 mt-1">
                <ArrowUpRight className="h-3 w-3 mr-1" />
                <span>Net Value</span>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-none shadow-md hover:shadow-lg transition-all">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-gradient-to-br from-white to-slate-50">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Entries</CardTitle>
              <div className="p-2 bg-amber-100 rounded-full">
                <FileText className="h-4 w-4 text-amber-600" />
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-slate-800">{stats.pendingEntries}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Requires approval
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-lg font-semibold mb-4 text-slate-800">Quick Actions</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {quickActions.map((action) => (
              <PermissionGuard key={action.href} permissions={[action.permission, "can_manage_system", "can_manage_company"]}>
                <Link href={action.href}>
                  <Card className="group cursor-pointer border-dashed hover:border-solid hover:shadow-md transition-all h-full">
                    <CardContent className="p-6 flex items-center space-x-4">
                      <div className={cn("p-3 rounded-full text-white transition-transform group-hover:scale-110", action.color)}>
                        <action.icon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="font-semibold group-hover:text-primary transition-colors">{action.title}</div>
                        <div className="text-sm text-muted-foreground">{action.description}</div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </PermissionGuard>
            ))}
          </div>
        </div>

        {/* Navigation Cards */}
        <div>
          <h2 className="text-lg font-semibold mb-4 text-slate-800">Module Navigation</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {navigationCards.map((card) => (
              <PermissionGuard key={card.href} permissions={[card.permission, "can_manage_system", "can_manage_company"]}>
                <Link href={card.href} className="block h-full">
                  <Card className="h-full hover:shadow-md transition-all hover:border-blue-200 border border-slate-200">
                    <CardHeader className="flex flex-row items-center space-y-0 pb-2">
                      <div className={cn("p-2 rounded-lg mr-3", card.bgColor)}>
                        <card.icon className={cn("h-5 w-5", card.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base font-semibold truncate">{card.title}</CardTitle>
                      </div>
                      {card.count !== undefined && (
                        <Badge variant="secondary" className="ml-2">
                          {card.count}
                        </Badge>
                      )}
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="line-clamp-2 mb-2">
                        {card.description}
                      </CardDescription>
                      {card.badge && (
                        <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">
                          {card.badge}
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              </PermissionGuard>
            ))}
          </div>
        </div>
      </div>
    </PermissionGuard>
  )
}