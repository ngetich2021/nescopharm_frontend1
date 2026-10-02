"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { TableSkeleton } from "@/components/ui/skeletons"
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  Plus, 
  Search, 
  Building2, 
  DollarSign, 
  CreditCard,
  Eye,
  History,
  Settings
} from "lucide-react"
import { financeApi, type BankAccount } from "@/lib/finance"

export default function BankAccountsPage() {
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [accountTypeFilter, setAccountTypeFilter] = useState<string>("all")
  const [activeFilter, setActiveFilter] = useState<string>("all")

  const fetchBankAccounts = async () => {
    try {
      setLoading(true)
      const params = {
        ...(accountTypeFilter !== "all" && { account_type: accountTypeFilter }),
        ...(activeFilter !== "all" && { is_active: activeFilter === "active" }),
        ...(searchTerm && { search: searchTerm })
      }
      
      const response = await financeApi.getBankAccounts(params)
      setBankAccounts(response.accounts)
    } catch (error) {
      console.error('Error fetching bank accounts:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBankAccounts()
  }, [searchTerm, accountTypeFilter, activeFilter])

  const formatCurrency = (amount: string) => {
    const numAmount = parseFloat(amount)
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(numAmount)
  }

  const getAccountTypeColor = (type: string) => {
    const colors = {
      checking: 'bg-blue-100 text-blue-800',
      savings: 'bg-green-100 text-green-800',
      money_market: 'bg-purple-100 text-purple-800',
      certificate_of_deposit: 'bg-orange-100 text-orange-800',
      other: 'bg-gray-100 text-gray-800',
    }
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800'
  }

  const getStatusColor = (isActive: boolean) => {
    return isActive 
      ? 'bg-green-100 text-green-800' 
      : 'bg-red-100 text-red-800'
  }

  const filteredAccounts = bankAccounts.filter(account => {
    const matchesSearch = account.account_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         account.bank_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         account.account_number.includes(searchTerm)
    return matchesSearch
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Bank Accounts</h1>
          <p className="text-muted-foreground">
            Manage your bank accounts and monitor balances
          </p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Bank Account
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Bank Account</DialogTitle>
            </DialogHeader>
            <CreateBankAccountForm onSuccess={fetchBankAccounts} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Accounts</p>
                <p className="text-2xl font-bold">{bankAccounts.length}</p>
              </div>
              <Building2 className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Accounts</p>
                <p className="text-2xl font-bold">
                  {bankAccounts.filter(acc => acc.is_active).length}
                </p>
              </div>
              <CreditCard className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Balance</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(
                    bankAccounts.reduce((total, acc) => total + acc.current_balance, 0).toString()
                  )}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Average Balance</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(
                    bankAccounts.length > 0 
                      ? (bankAccounts.reduce((total, acc) => total + acc.current_balance, 0) / bankAccounts.length).toString()
                      : "0"
                  )}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by account name, bank name, or account number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Account Type</Label>
              <Select value={accountTypeFilter} onValueChange={setAccountTypeFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="checking">Checking</SelectItem>
                  <SelectItem value="savings">Savings</SelectItem>
                  <SelectItem value="money_market">Money Market</SelectItem>
                  <SelectItem value="certificate_of_deposit">Certificate of Deposit</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={activeFilter} onValueChange={setActiveFilter}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bank Accounts Table */}
      <Card>
        <CardHeader>
          <CardTitle>Bank Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <TableSkeleton columns={7} rows={5} showHeader={false} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account Details</TableHead>
                  <TableHead>Bank</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Current Balance</TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAccounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{account.account_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {account.account_number}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{account.bank_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {account.branch_name || 'Main Branch'}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getAccountTypeColor(account.account_type)}>
                        {account.account_type.replace('_', ' ').toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono">
                      {formatCurrency(account.current_balance.toString())}
                    </TableCell>
                    <TableCell className="font-mono">
                      {account.currency_code || 'KES'}
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(account.is_active)}>
                        {account.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm">
                          <History className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm">
                          <Settings className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// Create Bank Account Form Component
function CreateBankAccountForm({ onSuccess }: { onSuccess: () => void }) {
  const [formData, setFormData] = useState<Partial<BankAccount>>({
    account_name: '',
    account_number: '',
    bank_name: '',
    branch_name: '',
    account_type: 'checking' as const,
    currency_code: 'KES',
    current_balance: 0,
    opening_balance: 0,
    opening_date: new Date().toISOString().split('T')[0],
    is_active: true
  })
  const [mpesaPaybill, setMpesaPaybill] = useState('')
  const [mpesaAccount, setMpesaAccount] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setLoading(true)
      const payload: Partial<BankAccount> = { ...formData }
      if (mpesaPaybill.trim() || mpesaAccount.trim()) {
        payload.bank_details = {
          ...(mpesaPaybill.trim() && { mpesa_paybill: mpesaPaybill.trim() }),
          ...(mpesaAccount.trim() && { mpesa_account: mpesaAccount.trim() }),
        }
      }
      await financeApi.createBankAccount(payload)
      onSuccess()
      setFormData({
        account_name: '',
        account_number: '',
        bank_name: '',
        branch_name: '',
        account_type: 'checking',
        currency_code: 'KES',
        current_balance: 0,
        opening_balance: 0,
        opening_date: new Date().toISOString().split('T')[0],
        is_active: true
      })
      setMpesaPaybill('')
      setMpesaAccount('')
    } catch (error) {
      console.error('Error creating bank account:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="account_name">Account Name *</Label>
          <Input
            id="account_name"
            value={formData.account_name}
            onChange={(e) => setFormData(prev => ({ ...prev, account_name: e.target.value }))}
            placeholder="Main Business Account"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="account_number">Account Number *</Label>
          <Input
            id="account_number"
            value={formData.account_number}
            onChange={(e) => setFormData(prev => ({ ...prev, account_number: e.target.value }))}
            placeholder="1234567890"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="bank_name">Bank Name *</Label>
          <Input
            id="bank_name"
            value={formData.bank_name}
            onChange={(e) => setFormData(prev => ({ ...prev, bank_name: e.target.value }))}
            placeholder="Bank of America"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="branch_name">Branch Name</Label>
          <Input
            id="branch_name"
            value={formData.branch_name || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, branch_name: e.target.value }))}
            placeholder="Downtown Branch"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="account_type">Account Type</Label>
          <Select 
            value={formData.account_type} 
            onValueChange={(value: 'checking' | 'savings' | 'money_market' | 'certificate_of_deposit' | 'other') => 
              setFormData(prev => ({ ...prev, account_type: value }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="checking">Checking</SelectItem>
              <SelectItem value="savings">Savings</SelectItem>
              <SelectItem value="money_market">Money Market</SelectItem>
              <SelectItem value="certificate_of_deposit">Certificate of Deposit</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="currency_code">Currency</Label>
          <Select
            value={formData.currency_code || 'KES'}
            onValueChange={(value) => setFormData(prev => ({ ...prev, currency_code: value }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="KES">KES</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="EUR">EUR</SelectItem>
              <SelectItem value="GBP">GBP</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="current_balance">Current Balance</Label>
          <Input
            id="current_balance"
            type="number"
            step="0.01"
            value={formData.current_balance || 0}
            onChange={(e) => setFormData(prev => ({ ...prev, current_balance: parseFloat(e.target.value) || 0 }))}
            placeholder="0.00"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="opening_balance">Opening Balance</Label>
          <Input
            id="opening_balance"
            type="number"
            step="0.01"
            value={formData.opening_balance || 0}
            onChange={(e) => setFormData(prev => ({ ...prev, opening_balance: parseFloat(e.target.value) || 0 }))}
            placeholder="0.00"
          />
        </div>
      </div>

      <div className="space-y-2 rounded-md border p-3">
        <p className="text-sm font-medium">M-Pesa (optional)</p>
        <p className="text-xs text-muted-foreground">
          Shown alongside these bank details at the bottom of every invoice.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="mpesa_paybill">Paybill Number</Label>
            <Input
              id="mpesa_paybill"
              value={mpesaPaybill}
              onChange={(e) => setMpesaPaybill(e.target.value)}
              placeholder="982800"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mpesa_account">Account Number</Label>
            <Input
              id="mpesa_account"
              value={mpesaAccount}
              onChange={(e) => setMpesaAccount(e.target.value)}
              placeholder="NESEXP"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={loading}>
          {loading ? 'Creating...' : 'Create Account'}
        </Button>
      </div>
    </form>
  )
}
