"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { FinanceTableSkeleton } from "@/components/ui/skeletons"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { 
  Search, 
  Plus, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Eye,
  Filter,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  FolderTree
} from "lucide-react"
import { 
  getChartOfAccounts, 
  getChartOfAccount,
  deleteChartOfAccount, 
  getAccountTypeColor, 
  ChartOfAccount 
} from "@/lib/finance"
import { useToast } from "@/hooks/use-toast"
import CreateAccountDialog from "./create-account-dialog"
import EditAccountDialog from "./edit-account-dialog"
import ViewAccountDialog from "./view-account-dialog"
import { PermissionGuard } from "@/components/PermissionGuard"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"

export default function ChartOfAccountsPage() {
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([])
  const [filteredAccounts, setFilteredAccounts] = useState<ChartOfAccount[]>([])
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedAccountType, setSelectedAccountType] = useState<string>("all")
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<ChartOfAccount | null>(null)
  const [showViewDialog, setShowViewDialog] = useState(false)
  const [isViewLoading, setIsViewLoading] = useState(false)
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
    filterAccounts()
  }, [accounts, searchTerm, selectedAccountType])

  const fetchAccounts = async () => {
    try {
      setIsLoading(true)
      const response = await getChartOfAccounts()
      setAccounts(response.accounts || [])
    } catch (error) {
      console.error('Error fetching accounts:', error)
      toast({
        title: "Error",
        description: "Failed to fetch chart of accounts. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const filterAccounts = () => {
    let filtered = accounts

    if (searchTerm) {
      filtered = filtered.filter(account =>
        account.account_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        account.account_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        account.description?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (selectedAccountType !== "all") {
      filtered = filtered.filter(account => account.account_type === selectedAccountType)
    }

    setFilteredAccounts(filtered)
  }

  // Build a map of account children for quick lookup
  const getChildrenForAccount = (parentId: string | null): ChartOfAccount[] => {
    return accounts.filter(acc => acc.parent_id === parentId)
  }

  // Check if an account has children
  const hasChildren = (account: ChartOfAccount): boolean => {
    return getChildrenForAccount(account.id).length > 0
  }

  // Toggle expand/collapse for an account
  const toggleExpanded = (accountId: string) => {
    const newExpanded = new Set(expandedAccounts)
    if (newExpanded.has(accountId)) {
      newExpanded.delete(accountId)
    } else {
      newExpanded.add(accountId)
    }
    setExpandedAccounts(newExpanded)
  }

  // Render account row with hierarchy
  const renderAccountRow = (account: ChartOfAccount, parentIds: string[] = []): React.ReactNode[] => {
    const isExpanded = expandedAccounts.has(account.id)
    const hasChildAccounts = hasChildren(account)
    const children = getChildrenForAccount(account.id)
    
    // Only show if parent is expanded or is a root account (no parent)
    const shouldShow = !account.parent_id || expandedAccounts.has(account.parent_id)
    
    if (!shouldShow) return []

    const rows: React.ReactNode[] = [
      <div
        key={account.id}
        className="group flex items-center border-b hover:bg-slate-50 transition-colors py-2.5 px-4 text-sm"
      >
        {/* Expand/Collapse button */}
        <div className="w-8 flex justify-center flex-shrink-0">
          {hasChildAccounts ? (
            <button
              onClick={() => toggleExpanded(account.id)}
              className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-700 transition"
            >
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>
          ) : (
            <div className="w-6" />
          )}
        </div>

        {/* Account Code */}
        <div className="font-mono text-xs font-semibold text-slate-600 w-24 flex-shrink-0">
          {account.account_code}
        </div>

        {/* Account Name with indentation */}
        <div 
          className="flex-1 min-w-0 flex items-center"
          style={{ paddingLeft: `${Math.max(0, (account.level - 1) * 24)}px` }}
        >
          {account.level > 1 && <div className="w-4 border-l border-b h-4 -mt-4 mr-2 border-slate-300 opacity-50" />}
          <div className="truncate">
             <div className="font-medium text-slate-900 group-hover:text-primary transition-colors">{account.account_name}</div>
              {account.description && (
                <div className="text-[10px] text-muted-foreground truncate hidden md:block">{account.description}</div>
              )}
          </div>
        </div>

        {/* Type Badge */}
        <div className="w-32 flex-shrink-0 hidden sm:block">
          <Badge variant="outline" className={`text-[10px] uppercase tracking-wider font-semibold border-0 bg-opacity-10 ${getAccountTypeColor(account.account_type)}`}>
            {account.account_type}
          </Badge>
        </div>

        {/* Normal Balance */}
        <div className="w-24 text-xs text-slate-500 font-medium flex-shrink-0 hidden md:block capitalize">
          {account.normal_balance}
        </div>

        {/* Status */}
        <div className="w-20 flex-shrink-0">
          {account.is_active ? (
             <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20">Active</span>
          ) : (
             <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-gray-50 text-gray-600 ring-1 ring-inset ring-gray-500/10">Inactive</span>
          )}
        </div>

        {/* Actions */}
        <div className="w-10 flex justify-end flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-7 w-7 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleViewAccount(account.id)}>
                <Eye className="h-4 w-4 mr-2" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleEditAccount(account)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => handleDeleteAccount(account)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>,
    ]

    // Render children if expanded
    if (isExpanded && hasChildAccounts) {
      const sortedChildren = children.sort((a, b) => a.account_code.localeCompare(b.account_code))
      for (const child of sortedChildren) {
        rows.push(...renderAccountRow(child, [...parentIds, account.id]))
      }
    }

    return rows
  }

  const handleDeleteAccount = async (account: ChartOfAccount) => {
    if (!confirm(`Are you sure you want to delete "${account.account_name}"?`)) {
      return
    }

    try {
      await deleteChartOfAccount(account.id)
      toast({
        title: "Success",
        description: "Account deleted successfully.",
      })
      fetchAccounts() // Refresh the list
    } catch (error) {
      console.error('Error deleting account:', error)
      toast({
        title: "Error",
        description: "Failed to delete account. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleEditAccount = (account: ChartOfAccount) => {
    setSelectedAccount(account)
    setShowEditDialog(true)
  }

  const handleViewAccount = async (id: string) => {
    try {
      setIsViewLoading(true)
      const resp = await getChartOfAccount(id)
      setSelectedAccount(resp.account)
      setShowViewDialog(true)
    } catch (error) {
      console.error('Error fetching account details:', error)
      toast({ title: 'Error', description: 'Failed to fetch account details', variant: 'destructive' })
    } finally {
      setIsViewLoading(false)
    }
  }

  const openEditFromView = () => {
    setShowViewDialog(false)
    setShowEditDialog(true)
  }

  const handleAccountCreated = () => {
    setShowCreateDialog(false)
    fetchAccounts()
    toast({
      title: "Success",
      description: "Account created successfully.",
    })
  }

  const handleAccountUpdated = () => {
    setShowEditDialog(false)
    setSelectedAccount(null)
    fetchAccounts()
    toast({
      title: "Success",
      description: "Account updated successfully.",
    })
  }

  return (
    <PermissionGuard permissions={["can_view_chart_of_accounts"]}>
      <div className="space-y-6">
        {/* Header Section */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-blue-900 to-slate-900 p-8 text-white shadow-lg">
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                 <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
                   <FolderTree className="h-5 w-5 text-blue-200" />
                 </div>
                 <h1 className="text-2xl font-bold tracking-tight">Chart of Accounts</h1>
              </div>
              <p className="text-blue-100 max-w-xl text-sm">
                Define the financial structure of your organization. Manage assets, liabilities, equity, income, and expenses hierarchy.
              </p>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={fetchAccounts} 
                disabled={isLoading}
                variant="secondary"
                size="sm"
                className="shadow-sm"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
               <Button onClick={() => setShowCreateDialog(true)} size="sm" className="bg-blue-600 hover:bg-blue-500 text-white border-0">
                <Plus className="h-4 w-4 mr-2" />
                Add Account
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content Card */}
        <Card className="border-slate-200 shadow-sm">
           <div className="p-4 border-b flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50/50">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search by code, name or description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 bg-white"
                />
              </div>
              <div className="w-full sm:w-48">
                <Select value={selectedAccountType} onValueChange={setSelectedAccountType}>
                  <SelectTrigger className="bg-white">
                    <div className="flex items-center text-slate-600">
                      <Filter className="mr-2 h-4 w-4 opacity-70" />
                      <SelectValue placeholder="Filter type" />
                    </div>
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
            </div>

            <div className="relative min-h-[400px]">
              {isLoading && accounts.length === 0 ? (
                 <div className="p-8">
                   <FinanceTableSkeleton />
                 </div>
              ) : (
                <div className="overflow-x-auto">
                    {/* Header Row */}
                    <div className="flex items-center border-b bg-slate-50 py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <div className="w-8" />
                      <div className="w-24">Code</div>
                      <div className="flex-1 min-w-0">Account Name</div>
                      <div className="w-32 hidden sm:block">Type</div>
                      <div className="w-24 hidden md:block">Balance</div>
                      <div className="w-20">Status</div>
                      <div className="w-10"></div>
                    </div>

                    {/* Account Rows */}
                    <div className="bg-white divide-y divide-slate-100">
                      {filteredAccounts
                        .filter(acc => !acc.parent_id)
                        .sort((a, b) => a.account_code.localeCompare(b.account_code))
                        .flatMap(account => renderAccountRow(account))
                      }
                      
                      {filteredAccounts.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                          <div className="bg-slate-50 p-4 rounded-full mb-3">
                            <Search className="h-8 w-8 text-slate-300" />
                          </div>
                          <p className="text-slate-900 font-medium">No accounts found</p>
                          <p className="text-sm text-slate-500 max-w-xs mt-1">
                            We couldn't find any accounts matching your search criteria.
                          </p>
                          <Button 
                            variant="link" 
                            onClick={() => {setSearchTerm(''); setSelectedAccountType('all')}}
                            className="mt-2 text-blue-600"
                          >
                            Clear filters
                          </Button>
                        </div>
                      )}
                    </div>
                </div>
              )}
            </div>
            
             <div className="bg-slate-50 border-t p-3 text-xs text-slate-500 flex justify-between px-6">
                <div>
                   Showing {filteredAccounts.length} accounts
                </div>
                <div>
                  {filteredAccounts.filter(a => a.parent_id).length} sub-accounts &bull; {filteredAccounts.filter(a => !a.parent_id).length} root accounts
                </div>
             </div>
        </Card>

        {/* Create Account Dialog */}
        <CreateAccountDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onSuccess={handleAccountCreated}
        />

        {/* Edit Account Dialog */}
        {selectedAccount && (
          <EditAccountDialog
            open={showEditDialog}
            onOpenChange={setShowEditDialog}
            account={selectedAccount}
            onSuccess={handleAccountUpdated}
          />
        )}

        {/* View Account Dialog */}
        <ViewAccountDialog
          open={showViewDialog}
          onOpenChange={(open) => {
            setShowViewDialog(open)
            if (!open) setSelectedAccount(null)
          }}
          account={selectedAccount}
          onEdit={openEditFromView}
        />
      </div>
    </PermissionGuard>
  )
}
