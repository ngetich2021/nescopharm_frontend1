"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { FinanceTableSkeleton } from "@/components/ui/skeletons"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  Search, 
  Filter,
  Download,
  Calendar
} from "lucide-react"
import { 
  getGeneralLedger, 
  getChartOfAccounts,
  formatCurrency, 
  getAccountTypeColor, 
  ChartOfAccount 
} from "@/lib/finance"
import { useToast } from "@/hooks/use-toast"
import { format } from "date-fns"

interface LedgerTransaction {
  id: string
  journal_entry_id: string
  date: string
  reference: string
  description: string
  debit_amount: string
  credit_amount: string
  running_balance: string
}

interface LedgerAccount {
  account: {
    id: string
    account_code: string
    account_name: string
    account_type: string
  }
  opening_balance: string
  transactions: LedgerTransaction[]
  totals: {
    total_debits: string
    total_credits: string
    closing_balance: string
  }
}

export default function GeneralLedgerPage() {
  const [ledgerData, setLedgerData] = useState<LedgerAccount[]>([])
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState(format(new Date(new Date().getFullYear(), 0, 1), 'yyyy-MM-dd'))
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [selectedAccountType, setSelectedAccountType] = useState<string>("all")
  const [selectedAccount, setSelectedAccount] = useState<string>("all")
  const [searchTerm, setSearchTerm] = useState("")
  const { toast } = useToast()

  const accountTypes = [
    { value: "all", label: "All Types" },
    { value: "asset", label: "Assets" },
    { value: "liability", label: "Liabilities" },
    { value: "equity", label: "Equity" },
    { value: "income", label: "Income" },
    { value: "expense", label: "Expenses" },
  ]

  useEffect(() => {
    fetchAccounts()
  }, [])

  useEffect(() => {
    if (accounts.length > 0) {
      fetchLedgerData()
    }
  }, [accounts, dateFrom, dateTo, selectedAccountType, selectedAccount])

  const fetchAccounts = async () => {
    try {
      const response = await getChartOfAccounts({ is_active: true })
      setAccounts(response.accounts || [])
    } catch (error) {
      console.error('Error fetching accounts:', error)
      toast({
        title: "Error",
        description: "Failed to fetch chart of accounts. Please try again.",
        variant: "destructive",
      })
    }
  }

  const fetchLedgerData = async () => {
    try {
      setIsLoading(true)
      const params: any = {
        date_from: dateFrom,
        date_to: dateTo,
      }

      if (selectedAccountType !== "all") {
        params.account_type = selectedAccountType
      }

      if (selectedAccount !== "all") {
        params.account_id = selectedAccount
      }

      const response = await getGeneralLedger(params)
      setLedgerData(response.ledger_data || [])
    } catch (error) {
      console.error('Error fetching general ledger:', error)
      toast({
        title: "Error",
        description: "Failed to fetch general ledger data. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const filteredAccounts = selectedAccountType === "all" 
    ? accounts 
    : accounts.filter(acc => acc.account_type === selectedAccountType)

  const filteredLedgerData = searchTerm
    ? ledgerData.filter(item =>
        item.account.account_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.account.account_code.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : ledgerData

  const exportToCSV = () => {
    // Implementation for CSV export
    toast({
      title: "Feature Coming Soon",
      description: "CSV export functionality will be available soon.",
    })
  }

  if (isLoading) {
    return <FinanceTableSkeleton />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">General Ledger</h1>
          <p className="text-muted-foreground">
            View detailed account activity and running balances
          </p>
        </div>
        <Button onClick={exportToCSV} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">From Date</label>
              <div className="relative">
                <Calendar className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">To Date</label>
              <div className="relative">
                <Calendar className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Account Type</label>
              <Select onValueChange={setSelectedAccountType} defaultValue={selectedAccountType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {accountTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Specific Account</label>
              <Select onValueChange={setSelectedAccount} defaultValue={selectedAccount}>
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Accounts</SelectItem>
                  {filteredAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.account_code} - {account.account_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Search</label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search accounts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ledger Data */}
      <div className="space-y-6">
        {filteredLedgerData.map((accountData) => (
          <Card key={accountData.account.id}>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="flex items-center gap-3">
                    <span className="font-mono">{accountData.account.account_code}</span>
                    <span>{accountData.account.account_name}</span>
                    <Badge variant="secondary" className={getAccountTypeColor(accountData.account.account_type)}>
                      {accountData.account.account_type.toUpperCase()}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Opening Balance: {formatCurrency(accountData.opening_balance)}
                  </CardDescription>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">
                    {formatCurrency(accountData.totals.closing_balance)}
                  </div>
                  <div className="text-sm text-muted-foreground">Closing Balance</div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {accountData.transactions.length > 0 ? (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Debit</TableHead>
                        <TableHead>Credit</TableHead>
                        <TableHead>Running Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {accountData.transactions.map((transaction) => (
                        <TableRow key={transaction.id}>
                          <TableCell>{format(new Date(transaction.date), 'MMM dd, yyyy')}</TableCell>
                          <TableCell className="font-mono">{transaction.reference}</TableCell>
                          <TableCell>{transaction.description}</TableCell>
                          <TableCell className="font-mono text-right">
                            {parseFloat(transaction.debit_amount) > 0 ? formatCurrency(transaction.debit_amount) : '-'}
                          </TableCell>
                          <TableCell className="font-mono text-right">
                            {parseFloat(transaction.credit_amount) > 0 ? formatCurrency(transaction.credit_amount) : '-'}
                          </TableCell>
                          <TableCell className="font-mono text-right font-medium">
                            {formatCurrency(transaction.running_balance)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  
                  {/* Account Totals */}
                  <div className="mt-4 border-t pt-4">
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="text-center">
                        <div className="font-medium">Total Debits</div>
                        <div className="font-mono">{formatCurrency(accountData.totals.total_debits)}</div>
                      </div>
                      <div className="text-center">
                        <div className="font-medium">Total Credits</div>
                        <div className="font-mono">{formatCurrency(accountData.totals.total_credits)}</div>
                      </div>
                      <div className="text-center">
                        <div className="font-medium">Net Change</div>
                        <div className="font-mono">
                          {formatCurrency((parseFloat(accountData.totals.total_debits) - parseFloat(accountData.totals.total_credits)).toString())}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No transactions found for the selected period
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        
        {filteredLedgerData.length === 0 && (
          <Card>
            <CardContent className="text-center py-8 text-muted-foreground">
              No ledger data found for the selected criteria
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
