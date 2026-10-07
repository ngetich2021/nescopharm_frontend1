"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { FinanceDashboardSkeleton } from "@/components/ui/skeletons"
import {
  Calculator,
  BookOpen,
  TrendingUp,
  FileText,
  Banknote,
  BarChart3,
  PlusCircle,
  Target,
  Settings,
  ArrowRight,
  Wallet,
  HandCoins,
  Receipt,
  Scale,
  CheckCircle2,
  AlertTriangle,
  CalendarClock,
  Percent,
  Hourglass,
} from "lucide-react"
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { getFinanceSummary, formatCurrency, type FinanceSummary } from "@/lib/finance"
import { PermissionGuard } from "@/components/PermissionGuard"
import { cn } from "@/lib/utils"

const compact = (n: number) =>
  new Intl.NumberFormat("en-KE", { notation: "compact", maximumFractionDigits: 1 }).format(n)

function sourceLabel(sourceType: string | null): string {
  if (!sourceType) return "Manual"
  const name = sourceType.split("\\").pop() || ""
  const labels: Record<string, string> = {
    Invoice: "Invoice",
    Payment: "Receipt",
    PaymentRefund: "Refund",
    Expense: "Expense",
    ProductReceipt: "Goods received",
    OrderDispatch: "COGS",
    CreditNote: "Credit note",
    SupplierPayment: "Supplier payment",
    PayrollRun: "Payroll",
    JournalEntry: "Reversal",
  }
  return labels[name] ?? name
}

function Kpi({
  title,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  title: string
  value: string
  hint: string
  icon: React.ElementType
  tone: "emerald" | "blue" | "rose" | "amber" | "violet" | "slate"
}) {
  const tones: Record<string, string> = {
    emerald: "bg-emerald-100 text-emerald-600",
    blue: "bg-blue-100 text-blue-600",
    rose: "bg-rose-100 text-rose-600",
    amber: "bg-amber-100 text-amber-600",
    violet: "bg-violet-100 text-violet-600",
    slate: "bg-slate-100 text-slate-600",
  }
  return (
    <Card className="overflow-hidden border-none shadow-md">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={cn("p-2 rounded-full", tones[tone])}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-slate-800 tabular-nums">{value}</div>
        <p className="text-xs text-muted-foreground mt-1">{hint}</p>
      </CardContent>
    </Card>
  )
}

export default function FinancePage() {
  const [summary, setSummary] = useState<FinanceSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    getFinanceSummary()
      .then(setSummary)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load finance summary"))
      .finally(() => setIsLoading(false))
  }, [])

  const quickActions = [
    { title: "New Journal Entry", description: "Record a manual or opening-balance entry", href: "/finance/journal-entries/create", icon: PlusCircle, color: "bg-blue-500", permission: "can_create_journal_entries" },
    { title: "Financial Reports", description: "Balance sheet, P&L, cash flow", href: "/finance/reports", icon: BarChart3, color: "bg-purple-500", permission: "can_view_financial_reports" },
    { title: "Receivables & Payables", description: "Who owes you, who you owe", href: "/finance/aging", icon: Hourglass, color: "bg-amber-500", permission: "can_view_accounts_receivable" },
    { title: "Accounting Settings", description: "Posting rules and triggers", href: "/finance/accounting-settings", icon: Settings, color: "bg-slate-500", permission: "can_manage_accounting_settings" },
  ]

  const navigationCards = [
    { title: "Chart of Accounts", description: "Accounts and live balances", href: "/finance/chart-of-accounts", icon: BookOpen, color: "text-blue-600", bgColor: "bg-blue-50", permission: "can_view_chart_of_accounts" },
    { title: "Journal Entries", description: "Every posting, automatic and manual", href: "/finance/journal-entries", icon: FileText, color: "text-indigo-600", bgColor: "bg-indigo-50", permission: "can_view_journal_entries", count: summary?.posted_entries, badge: summary && summary.draft_entries > 0 ? `${summary.draft_entries} draft` : undefined },
    { title: "General Ledger", description: "Detailed account activity", href: "/finance/general-ledger", icon: Calculator, color: "text-teal-600", bgColor: "bg-teal-50", permission: "can_view_general_ledger" },
    { title: "Trial Balance", description: "Verify debits equal credits", href: "/finance/trial-balance", icon: Scale, color: "text-orange-600", bgColor: "bg-orange-50", permission: "can_view_trial_balance" },
    { title: "Receivables & Payables", description: "Aging by customer and supplier", href: "/finance/aging", icon: Hourglass, color: "text-amber-600", bgColor: "bg-amber-50", permission: "can_view_accounts_receivable" },
    { title: "Bank Accounts", description: "Accounts, transactions, reconciliation", href: "/finance/bank-accounts", icon: Banknote, color: "text-green-600", bgColor: "bg-green-50", permission: "can_view_bank_accounts" },
    { title: "Budgets", description: "Plan and compare to actuals", href: "/finance/budgets", icon: Target, color: "text-rose-600", bgColor: "bg-rose-50", permission: "can_view_budgets" },
    { title: "Financial Reports", description: "Statements and ratios", href: "/finance/reports", icon: BarChart3, color: "text-purple-600", bgColor: "bg-purple-50", permission: "can_view_financial_reports" },
    { title: "Financial Periods", description: "Open, close and lock periods", href: "/finance/financial-periods", icon: CalendarClock, color: "text-cyan-600", bgColor: "bg-cyan-50", permission: "can_view_financial_periods" },
    { title: "Tax Rates", description: "VAT and other tax rates", href: "/finance/tax-rates", icon: Percent, color: "text-fuchsia-600", bgColor: "bg-fuchsia-50", permission: "can_view_tax_rates" },
    { title: "Account Mapping", description: "Which account each transaction posts to", href: "/finance/account-mappings", icon: ArrowRight, color: "text-slate-600", bgColor: "bg-slate-50", permission: "can_manage_accounting_settings" },
  ]

  if (isLoading) {
    return <FinanceDashboardSkeleton />
  }

  return (
    <PermissionGuard permissions={["can_view_finance_dashboard_menu", "can_view_finance_menu", "can_manage_system", "can_manage_company"]}>
      <div className="space-y-8">
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 p-8 text-white shadow-lg">
          <div className="relative z-10 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Finance & Accounting</h1>
              <p className="mt-2 text-blue-100 max-w-2xl">
                Live books - every invoice, receipt, expense, purchase and payroll run posts to the ledger automatically.
              </p>
            </div>
            {summary && (
              <div className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm">
                {summary.books_balanced ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-300" /> Books balanced as of {summary.as_of}
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-4 w-4 text-amber-300" /> Debits and credits do not match
                  </>
                )}
              </div>
            )}
          </div>
          <div className="absolute right-0 top-0 h-full w-1/3 bg-white/5 skew-x-12 transform" />
        </div>

        {error && (
          <Card className="border-rose-200 bg-rose-50">
            <CardContent className="p-4 text-sm text-rose-700">{error}</CardContent>
          </Card>
        )}

        {summary && (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Kpi title="Cash & Bank" value={formatCurrency(summary.cash_and_bank)} hint="Cash, bank and M-Pesa balances" icon={Wallet} tone={summary.cash_and_bank < 0 ? "rose" : "emerald"} />
              <Kpi title="Receivables" value={formatCurrency(summary.accounts_receivable)} hint="Owed to you by customers" icon={HandCoins} tone="blue" />
              <Kpi title="Payables" value={formatCurrency(summary.accounts_payable)} hint="Owed to suppliers" icon={Receipt} tone="amber" />
              <Kpi
                title="Net Income (YTD)"
                value={formatCurrency(summary.net_income_ytd)}
                hint={`Since ${summary.financial_year_start}`}
                icon={TrendingUp}
                tone={summary.net_income_ytd < 0 ? "rose" : "violet"}
              />
            </div>

            {summary.cash_and_bank < 0 && (
              <Card className="border-amber-200 bg-amber-50">
                <CardContent className="p-4 text-sm text-amber-900 flex gap-3">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
                  <div>
                    Cash & Bank is negative because payments out have been recorded without the money that funded them
                    (opening balances, capital or director funding). Record them with a{" "}
                    <Link href="/finance/journal-entries/create" className="font-medium underline">
                      journal entry
                    </Link>{" "}
                    - e.g. debit Cash on Hand / Main Operating Account, credit Share Capital or Shareholder Loans.
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2 shadow-md border-none">
                <CardHeader>
                  <CardTitle className="text-base">Revenue vs Expenses</CardTitle>
                  <CardDescription>Last 12 months, from posted ledger entries</CardDescription>
                </CardHeader>
                <CardContent className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={summary.monthly} margin={{ left: 8, right: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={-30} textAnchor="end" height={50} />
                      <YAxis tickFormatter={compact} tick={{ fontSize: 11 }} width={56} />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      <Legend />
                      <Bar dataKey="revenue" name="Revenue" fill="#2563eb" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="expenses" name="Expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="shadow-md border-none">
                <CardHeader>
                  <CardTitle className="text-base">Position</CardTitle>
                  <CardDescription>Assets = Liabilities + Equity</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {[
                    ["Total assets", summary.total_assets],
                    ["Total liabilities", summary.total_liabilities],
                    ["Total equity", summary.total_equity],
                    ["of which earnings to date", summary.retained_earnings_to_date],
                    ["VAT payable", summary.vat_payable],
                    ["Revenue (YTD)", summary.revenue_ytd],
                    ["Expenses (YTD)", summary.expenses_ytd],
                  ].map(([label, value]) => (
                    <div key={label as string} className="flex justify-between gap-4">
                      <span className="text-muted-foreground">{label}</span>
                      <span className={cn("font-medium tabular-nums", (value as number) < 0 && "text-rose-600")}>
                        {formatCurrency(value as number)}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <Card className="shadow-md border-none">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">Recent ledger activity</CardTitle>
                  <CardDescription>Latest journal entries</CardDescription>
                </div>
                <Link href="/finance/journal-entries" className="text-sm text-primary hover:underline">
                  View all
                </Link>
              </CardHeader>
              <CardContent>
                {summary.recent_entries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No entries yet.</p>
                ) : (
                  <div className="divide-y">
                    {summary.recent_entries.map((e) => (
                      <Link
                        key={e.id}
                        href={`/finance/journal-entries/${e.id}`}
                        className="flex items-center justify-between gap-4 py-2.5 hover:bg-slate-50 rounded px-2 -mx-2"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{e.description}</div>
                          <div className="text-xs text-muted-foreground">
                            {e.entry_number} · {e.entry_date?.slice(0, 10)} · {sourceLabel(e.source_type)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {e.status !== "posted" && <Badge variant="outline">{e.status}</Badge>}
                          <span className="text-sm tabular-nums">{formatCurrency(e.total_debit)}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        <div>
          <h2 className="text-lg font-semibold mb-4 text-slate-800">Quick Actions</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {quickActions.map((action) => (
              <PermissionGuard key={action.href} permissions={[action.permission, "can_manage_system", "can_manage_company"]} hideOnDenied>
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

        <div>
          <h2 className="text-lg font-semibold mb-4 text-slate-800">Module Navigation</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {navigationCards.map((card) => (
              <PermissionGuard key={card.href} permissions={[card.permission, "can_manage_system", "can_manage_company"]} hideOnDenied>
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
                      <CardDescription className="line-clamp-2 mb-2">{card.description}</CardDescription>
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
