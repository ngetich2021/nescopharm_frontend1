"use client"

import { useEffect, useState, Fragment } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Calendar,
  CheckCircle,
  AlertTriangle
} from "lucide-react"
import { 
  getTrialBalance, 
  formatCurrency, 
  getAccountTypeColor, 
  TrialBalance 
} from "@/lib/finance"
import { useToast } from "@/hooks/use-toast"
import { format } from "date-fns"
import { documentFileName, filePeriod, sessionCompanyName } from "@/lib/document-names"
import { DownloadButton } from "@/components/download-button"
import type { ExportCell, TableExport } from "@/lib/table-export"

interface TrialBalanceData {
  accounts: TrialBalance[]
  totals: {
    total_debits: string
    total_credits: string
    difference: string
    is_balanced: boolean
  }
}

export default function TrialBalancePage() {
  const [trialBalanceData, setTrialBalanceData] = useState<TrialBalanceData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [asOfDate, setAsOfDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const { toast } = useToast()

  useEffect(() => {
    fetchTrialBalance()
  }, [asOfDate])

  const fetchTrialBalance = async () => {
    try {
      setIsLoading(true)
      const response = await getTrialBalance({ as_of_date: asOfDate })
      setTrialBalanceData({
        accounts: response.accounts || [],
        totals: response.totals || {
          total_debits: "0.00",
          total_credits: "0.00",
          difference: "0.00",
          is_balanced: true
        }
      })
    } catch (error) {
      console.error('Error fetching trial balance:', error)
      toast({
        title: "Error",
        description: "Failed to fetch trial balance data. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Accounts in the same type order as the screen, each with its debit or credit balance.
  const buildExport = (): TableExport => {
    const amount = (v: string) => (Number(v) > 0 ? Number(v) : null)
    const types = [...accountTypeOrder, ...Object.keys(groupedAccounts).filter((t) => !accountTypeOrder.includes(t))]
    const accounts = types.flatMap((type) => groupedAccounts[type] || [])
    const totals = trialBalanceData?.totals
    const footer: ExportCell[][] = [["", "", "", "Totals", Number(totals?.total_debits || 0), Number(totals?.total_credits || 0)]]
    if (totals && !totals.is_balanced) footer.push(["", "", "", "Difference", Number(totals.difference || 0), null])
    return {
      fileName: documentFileName([sessionCompanyName(), `Trial Balance ${filePeriod(null, asOfDate)}`]),
      title: "Trial Balance",
      subtitle: `As of ${format(new Date(asOfDate), 'dd/MM/yyyy')}`,
      headers: ["S/No", "Account Code", "Account Name", "Account Type", "Debit Balance", "Credit Balance"],
      moneyColumns: [4, 5],
      rows: accounts.map((a, i) => [i + 1, a.account_code, a.account_name, a.account_type, amount(a.debit_balance), amount(a.credit_balance)]),
      footer,
    }
  }

  // Group accounts by type for better organization
  const groupedAccounts = trialBalanceData?.accounts.reduce((groups, account) => {
    const type = account.account_type
    if (!groups[type]) {
      groups[type] = []
    }
    groups[type].push(account)
    return groups
  }, {} as Record<string, TrialBalance[]>) || {}

  const accountTypeOrder = ['asset', 'liability', 'equity', 'income', 'revenue', 'expense']

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Trial Balance</h1>
          <p className="text-muted-foreground">
            Verify that total debits equal total credits
          </p>
        </div>
        <DownloadButton title="Trial Balance" build={buildExport} size="default" disabled={!trialBalanceData?.accounts.length} />
      </div>

      {/* Date Filter */}
      <Card>
        <CardHeader>
          <CardTitle>Report Parameters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">As of Date</label>
              <div className="relative">
                <Calendar className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={asOfDate}
                  onChange={(e) => setAsOfDate(e.target.value)}
                  className="pl-8 w-48"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 mt-6">
              {trialBalanceData?.totals.is_balanced ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-sm text-green-600 font-medium">Trial Balance is Balanced</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  <span className="text-sm text-red-600 font-medium">Trial Balance is Out of Balance</span>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trial Balance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Trial Balance as of {format(new Date(asOfDate), 'dd/MM/yyyy')}</CardTitle>
          <CardDescription>
            All account balances grouped by account type
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account Code</TableHead>
                <TableHead>Account Name</TableHead>
                <TableHead>Account Type</TableHead>
                <TableHead className="text-right">Debit Balance</TableHead>
                <TableHead className="text-right">Credit Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accountTypeOrder.map((accountType) => {
                const accounts = groupedAccounts[accountType] || []
                if (accounts.length === 0) return null

                const typeDebits = accounts.reduce((sum, acc) => sum + parseFloat(acc.debit_balance || '0'), 0)
                const typeCredits = accounts.reduce((sum, acc) => sum + parseFloat(acc.credit_balance || '0'), 0)

                return (
                  <Fragment key={accountType}>
                    {/* Account Type Header */}
                    <TableRow className="bg-muted/50">
                      <TableCell colSpan={3} className="font-semibold">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className={getAccountTypeColor(accountType)}>
                            {accountType.toUpperCase()}
                          </Badge>
                          <span>{accountType.charAt(0).toUpperCase() + accountType.slice(1)} Accounts</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {typeDebits > 0 ? formatCurrency(typeDebits.toString()) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {typeCredits > 0 ? formatCurrency(typeCredits.toString()) : '-'}
                      </TableCell>
                    </TableRow>
                    
                    {/* Individual Accounts */}
                    {accounts.map((account) => (
                      <TableRow key={account.account_id}>
                        <TableCell className="font-mono pl-8">{account.account_code}</TableCell>
                        <TableCell className="pl-8">{account.account_name}</TableCell>
                        <TableCell></TableCell>
                        <TableCell className="font-mono text-right">
                          {parseFloat(account.debit_balance) > 0 ? formatCurrency(account.debit_balance) : '-'}
                        </TableCell>
                        <TableCell className="font-mono text-right">
                          {parseFloat(account.credit_balance) > 0 ? formatCurrency(account.credit_balance) : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </Fragment>
                )
              })}

              {/* Totals Row */}
              <TableRow className="border-t-2 border-black font-bold">
                <TableCell colSpan={3} className="font-bold text-lg">TOTALS</TableCell>
                <TableCell className="font-mono text-right text-lg">
                  {formatCurrency(trialBalanceData?.totals.total_debits || '0')}
                </TableCell>
                <TableCell className="font-mono text-right text-lg">
                  {formatCurrency(trialBalanceData?.totals.total_credits || '0')}
                </TableCell>
              </TableRow>

              {/* Difference Row (if not balanced) */}
              {!trialBalanceData?.totals.is_balanced && (
                <TableRow className="bg-red-50">
                  <TableCell colSpan={3} className="font-bold text-red-600">DIFFERENCE</TableCell>
                  <TableCell colSpan={2} className="font-mono text-right text-red-600 font-bold">
                    {formatCurrency(trialBalanceData?.totals.difference || '0')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Summary Stats */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{formatCurrency(trialBalanceData?.totals.total_debits || '0')}</div>
                <p className="text-xs text-muted-foreground">Total Debits</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{formatCurrency(trialBalanceData?.totals.total_credits || '0')}</div>
                <p className="text-xs text-muted-foreground">Total Credits</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold flex items-center gap-2">
                  {formatCurrency(trialBalanceData?.totals.difference || '0')}
                  {trialBalanceData?.totals.is_balanced ? (
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-6 w-6 text-red-600" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Difference</p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
