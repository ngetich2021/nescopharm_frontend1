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
  Calendar,
  Check,
  ChevronsUpDown,
} from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { getCustomers, getCustomerDisplayName, Customer } from "@/lib/customers"
import { getSuppliers, type Supplier } from "@/lib/suppliers"
import { cn } from "@/lib/utils"
import { 
  getGeneralLedger, 
  getChartOfAccounts,
  formatCurrency, 
  getAccountTypeColor, 
  ChartOfAccount 
} from "@/lib/finance"
import { useToast } from "@/hooks/use-toast"
import { format } from "date-fns"
import { DownloadButton } from "@/components/download-button"
import { TablePager, usePaged } from "@/components/ui/table-pager"
import type { ExportCell, TableExport } from "@/lib/table-export"
import { documentFileName, filePeriod, sessionCompanyName } from "@/lib/document-names"

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

const num = (v: string | number | null | undefined) => Number(v) || 0

// S/No, Account, Date, Reference, Description, Debit, Credit, Balance (blank Debit/Credit when nil).
function ledgerRow(t: LedgerTransaction, index: number, account = ""): ExportCell[] {
  return [
    index + 1,
    account,
    format(new Date(t.date), 'dd/MM/yyyy'),
    t.reference,
    t.description,
    num(t.debit_amount) > 0 ? num(t.debit_amount) : null,
    num(t.credit_amount) > 0 ? num(t.credit_amount) : null,
    num(t.running_balance),
  ]
}

function LedgerAccountCard({ accountData, buildExport, dateFrom, dateTo }: { accountData: LedgerAccount; buildExport: () => TableExport; dateFrom: string; dateTo: string }) {
  const { pageRows, start, pager } = usePaged(accountData.transactions)
  // The balance brought forward opens the first page and the balance carried closes the last.
  const firstPage = pager.page === 1
  const lastPage = pager.page >= pager.pageCount
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center gap-4">
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
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-2xl font-bold">
                {formatCurrency(accountData.totals.closing_balance)}
              </div>
              <div className="text-sm text-muted-foreground">Closing Balance</div>
            </div>
            <DownloadButton
              title={`${accountData.account.account_code} ${accountData.account.account_name}`}
              build={buildExport}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {(
          <>
            <Table scroll>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14 text-center">S/No</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead className="text-right">Running Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {firstPage && (
                  <TableRow className="bg-muted/40 font-medium">
                    <TableCell />
                    <TableCell>{dateFrom ? format(new Date(dateFrom), 'dd/MM/yyyy') : '-'}</TableCell>
                    <TableCell />
                    <TableCell>Opening Balance</TableCell>
                    <TableCell />
                    <TableCell />
                    <TableCell className="font-mono text-right">{formatCurrency(accountData.opening_balance)}</TableCell>
                  </TableRow>
                )}
                {accountData.transactions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">No entries in this period</TableCell>
                  </TableRow>
                )}
                {pageRows.map((transaction, i) => (
                  <TableRow key={transaction.id}>
                    <TableCell className="text-center text-muted-foreground tabular-nums">{start + i + 1}</TableCell>
                    <TableCell>{format(new Date(transaction.date), 'dd/MM/yyyy')}</TableCell>
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
                {lastPage && (
                  <TableRow className="bg-muted/40 font-semibold">
                    <TableCell />
                    <TableCell>{dateTo ? format(new Date(dateTo), 'dd/MM/yyyy') : '-'}</TableCell>
                    <TableCell />
                    <TableCell>Closing Balance</TableCell>
                    <TableCell className="font-mono text-right">{formatCurrency(accountData.totals.total_debits)}</TableCell>
                    <TableCell className="font-mono text-right">{formatCurrency(accountData.totals.total_credits)}</TableCell>
                    <TableCell className="font-mono text-right">{formatCurrency(accountData.totals.closing_balance)}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <TablePager {...pager} />

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
        )}
      </CardContent>
    </Card>
  )
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
  // Narrows the ledger to the journal entries touching one customer (both sides of each).
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customerId, setCustomerId] = useState<string>("all")
  const [customerOpen, setCustomerOpen] = useState(false)
  // Same for a supplier or transporter: its bills, delivery invoices, goods receipts and payments.
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [supplierId, setSupplierId] = useState<string>("all")
  const [supplierOpen, setSupplierOpen] = useState(false)
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
    // Linked from a customer's Account Balance: ?customer_id=...&date_from=...&date_to=...
    const params = new URLSearchParams(window.location.search)
    if (params.get("customer_id")) setCustomerId(params.get("customer_id")!)
    if (params.get("supplier_id")) setSupplierId(params.get("supplier_id")!)
    if (params.get("date_from")) setDateFrom(params.get("date_from")!)
    if (params.get("date_to")) setDateTo(params.get("date_to")!)
    fetchAccounts()
    getCustomers().then(setCustomers).catch(() => setCustomers([]))
    getSuppliers().then(setSuppliers).catch(() => setSuppliers([]))
  }, [])

  useEffect(() => {
    if (accounts.length > 0) {
      fetchLedgerData()
    }
  }, [accounts, dateFrom, dateTo, selectedAccountType, selectedAccount, customerId, supplierId])

  const customerLabel = (id: string) => {
    const c = customers.find((x) => x.id === id)
    return c ? getCustomerDisplayName(c) : "Selected customer"
  }

  const supplierLabel = (id: string) => suppliers.find((x) => x.id === id)?.name ?? "Selected supplier"

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

      if (customerId !== "all") {
        params.customer_id = customerId
      }

      if (supplierId !== "all") {
        params.supplier_id = supplierId
      }

      const response = await getGeneralLedger(params)
      // The API wraps the ledger in `data` and names the account fields code/name/type.
      const rows: any[] = response?.data?.ledger_data ?? response?.ledger_data ?? []
      setLedgerData(rows.map((row) => ({
        ...row,
        account: {
          id: row.account.id,
          account_code: row.account.account_code ?? row.account.code,
          account_name: row.account.account_name ?? row.account.name,
          account_type: row.account.account_type ?? row.account.type,
        },
      })))
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

  const periodLine = `${format(new Date(dateFrom), 'dd/MM/yyyy')} to ${format(new Date(dateTo), 'dd/MM/yyyy')}`
  const customerLine = (customerId !== "all" ? ` · ${customerLabel(customerId)}` : "")
    + (supplierId !== "all" ? ` · ${supplierLabel(supplierId)}` : "")

  // Every account shown, each opened and closed with its balance, in one table.
  const buildLedgerExport = (): TableExport => {
    const rows: ExportCell[][] = []
    for (const a of filteredLedgerData) {
      const name = `${a.account.account_code} ${a.account.account_name}`
      rows.push(["", name, "", "", "Opening balance", null, null, num(a.opening_balance)])
      a.transactions.forEach((t, i) => rows.push(ledgerRow(t, i, name)))
      rows.push(["", name, "", "", "Closing balance", num(a.totals.total_debits), num(a.totals.total_credits), num(a.totals.closing_balance)])
    }
    return {
      fileName: documentFileName([sessionCompanyName(), `General Ledger ${filePeriod(dateFrom, dateTo)}`]),
      title: "General Ledger",
      subtitle: `${periodLine}${customerLine}`,
      headers: ["S/No", "Account", "Date", "Reference", "Description", "Debit", "Credit", "Balance"],
      moneyColumns: [5, 6, 7],
      rows,
    }
  }

  const buildAccountExport = (a: LedgerAccount): TableExport => ({
    fileName: documentFileName([sessionCompanyName(), `Ledger ${a.account.account_code} ${a.account.account_name} ${filePeriod(dateFrom, dateTo)}`]),
    title: `${a.account.account_code} ${a.account.account_name}`,
    subtitle: `General Ledger · ${periodLine}${customerLine}`,
    details: [
      ["Account type", a.account.account_type],
      ["Opening balance", formatCurrency(a.opening_balance)],
      ["Closing balance", formatCurrency(a.totals.closing_balance)],
      ["Net change", formatCurrency(String(num(a.totals.total_debits) - num(a.totals.total_credits)))],
    ],
    headers: ["S/No", "Date", "Reference", "Description", "Debit", "Credit", "Running Balance"],
    moneyColumns: [4, 5, 6],
    rows: [
      ["", dateFrom, "", "Opening balance", null, null, num(a.opening_balance)],
      ...a.transactions.map((t, i) => { const r = ledgerRow(t, i); return [r[0], ...r.slice(2)] }),
    ],
    footer: [["", dateTo, "", "Closing balance", num(a.totals.total_debits), num(a.totals.total_credits), num(a.totals.closing_balance)]],
  })

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
        <DownloadButton title="General Ledger" build={buildLedgerExport} size="default" disabled={filteredLedgerData.length === 0} />
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
              <label className="text-sm font-medium mb-2 block">Customer</label>
              <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                    <span className="truncate">{customerId === "all" ? "All Customers" : customerLabel(customerId)}</span>
                    <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[320px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search customer..." />
                    <CommandList>
                      <CommandEmpty>No customer found.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem value="all customers" onSelect={() => { setCustomerId("all"); setCustomerOpen(false) }}>
                          <Check className={cn("mr-2 h-4 w-4", customerId === "all" ? "opacity-100" : "opacity-0")} />
                          All Customers
                        </CommandItem>
                        {[...customers]
                          .sort((a, b) => getCustomerDisplayName(a).localeCompare(getCustomerDisplayName(b)))
                          .map((c) => (
                            <CommandItem
                              key={c.id}
                              value={`${getCustomerDisplayName(c)} ${c.name} ${(c as any).customer_number ?? ""} ${(c as any).phone ?? ""} ${c.id}`}
                              onSelect={() => { setCustomerId(c.id); setCustomerOpen(false) }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", customerId === c.id ? "opacity-100" : "opacity-0")} />
                              <div className="min-w-0">
                                <p className="truncate">{getCustomerDisplayName(c)}</p>
                                {getCustomerDisplayName(c) !== c.name && <p className="truncate text-xs text-muted-foreground">{c.name}</p>}
                              </div>
                            </CommandItem>
                          ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Supplier / Transporter</label>
              <Popover open={supplierOpen} onOpenChange={setSupplierOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                    <span className="truncate">{supplierId === "all" ? "All Suppliers" : supplierLabel(supplierId)}</span>
                    <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[320px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search supplier or transporter..." />
                    <CommandList>
                      <CommandEmpty>No supplier found.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem value="all suppliers" onSelect={() => { setSupplierId("all"); setSupplierOpen(false) }}>
                          <Check className={cn("mr-2 h-4 w-4", supplierId === "all" ? "opacity-100" : "opacity-0")} />
                          All Suppliers
                        </CommandItem>
                        {[...suppliers]
                          .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""))
                          .map((s) => (
                            <CommandItem
                              key={s.id}
                              value={`${s.name} ${s.id}`}
                              onSelect={() => { setSupplierId(s.id); setSupplierOpen(false) }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", supplierId === s.id ? "opacity-100" : "opacity-0")} />
                              <span className="truncate">{s.name}</span>
                            </CommandItem>
                          ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
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
          {customerId !== "all" && (
            <p className="text-xs text-muted-foreground mt-3">
              Showing only {customerLabel(customerId)}&apos;s journal entries, with both sides of each entry. Balances are this
              customer&apos;s movements on each account, not the account&apos;s full balance.
            </p>
          )}
          {supplierId !== "all" && (
            <p className="text-xs text-muted-foreground mt-3">
              Showing only {supplierLabel(supplierId)}&apos;s journal entries (bills, delivery invoices, goods received, debit notes and
              payments), with both sides of each entry. The Payables account&apos;s closing balance is what is owed to them.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Ledger Data */}
      <div className="space-y-6">
        {filteredLedgerData.map((accountData) => (
          <LedgerAccountCard
            key={accountData.account.id}
            accountData={accountData}
            buildExport={() => buildAccountExport(accountData)}
            dateFrom={dateFrom}
            dateTo={dateTo}
          />
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
