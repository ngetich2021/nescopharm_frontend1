"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { financeApi, ChartOfAccount } from "@/lib/finance"
import { useToast } from "@/hooks/use-toast"

interface CreateAccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

const accountTypes = {
  asset: [
    { value: "current_asset", label: "Current Asset" },
    { value: "fixed_asset", label: "Fixed Asset" },
    { value: "other_asset", label: "Other Asset" },
  ],
  liability: [
    { value: "current_liability", label: "Current Liability" },
    { value: "long_term_liability", label: "Long Term Liability" },
    { value: "other_liability", label: "Other Liability" },
  ],
  equity: [
    { value: "owner_equity", label: "Owner Equity" },
    { value: "retained_earnings", label: "Retained Earnings" },
  ],
  income: [
    { value: "operating_income", label: "Operating Income" },
    { value: "other_income", label: "Other Income" },
  ],
  expense: [
    { value: "operating_expense", label: "Operating Expense" },
    { value: "other_expense", label: "Other Expense" },
  ],
  cost_of_sales: [
    { value: "cost_of_goods_sold", label: "Cost of Goods Sold" },
  ],
}

export default function CreateAccountDialog({ open, onOpenChange, onSuccess }: CreateAccountDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [parentAccounts, setParentAccounts] = useState<ChartOfAccount[]>([])
  const { toast } = useToast()

  const [formData, setFormData] = useState({
    account_code: '',
    account_name: '',
    account_type: '' as 'asset' | 'liability' | 'equity' | 'income' | 'expense' | 'cost_of_sales' | '',
    account_subtype: '',
    parent_id: '',
    description: '',
    is_active: true,
    opening_balance: '0',
    currency_code: 'USD',
    normal_balance: '' as 'debit' | 'credit' | ''
  })

  const fetchParentAccounts = async () => {
    try {
      const response = await financeApi.getChartOfAccounts()
      setParentAccounts(response.accounts)
    } catch (error) {
      console.error('Error fetching parent accounts:', error)
    }
  }

  useEffect(() => {
    if (open) {
      fetchParentAccounts()
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.account_name || !formData.account_type || !formData.normal_balance) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      })
      return
    }

    try {
      setIsLoading(true)
      await financeApi.createChartOfAccount({
        account_code: formData.account_code,
        account_name: formData.account_name,
        account_type: formData.account_type,
        account_subtype: formData.account_subtype,
        parent_id: formData.parent_id || null,
        description: formData.description,
        is_active: formData.is_active,
        opening_balance: formData.opening_balance,
        currency_code: formData.currency_code,
        normal_balance: formData.normal_balance
      })
      
      toast({
        title: "Success",
        description: "Account created successfully"
      })
      
      onSuccess()
      onOpenChange(false)
      
      // Reset form
      setFormData({
        account_code: '',
        account_name: '',
        account_type: '',
        account_subtype: '',
        parent_id: '',
        description: '',
        is_active: true,
        opening_balance: '0',
        currency_code: 'USD',
        normal_balance: ''
      })
    } catch (error) {
      console.error('Error creating account:', error)
      toast({
        title: "Error",
        description: "Failed to create account",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const getAvailableSubtypes = () => {
    if (!formData.account_type) return []
    return accountTypes[formData.account_type] || []
  }

  const getFilteredParentAccounts = () => {
    if (!formData.account_type) return []
    return parentAccounts.filter(account => account.account_type === formData.account_type)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New Account</DialogTitle>
          <DialogDescription>
            Add a new account to your chart of accounts
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="account_code">Account Code</Label>
              <Input
                id="account_code"
                value={formData.account_code}
                onChange={(e) => handleInputChange('account_code', e.target.value)}
                placeholder="1000"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="account_name">Account Name *</Label>
              <Input
                id="account_name"
                value={formData.account_name}
                onChange={(e) => handleInputChange('account_name', e.target.value)}
                placeholder="Cash and Cash Equivalents"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="account_type">Account Type *</Label>
              <Select
                value={formData.account_type}
                onValueChange={(value: 'asset' | 'liability' | 'equity' | 'income' | 'expense' | 'cost_of_sales') => {
                  handleInputChange('account_type', value)
                  handleInputChange('account_subtype', '') // Reset subtype
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select account type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asset">Asset</SelectItem>
                  <SelectItem value="liability">Liability</SelectItem>
                  <SelectItem value="equity">Equity</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="cost_of_sales">Cost of Sales</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="account_subtype">Account Subtype</Label>
              <Select
                value={formData.account_subtype}
                onValueChange={(value) => handleInputChange('account_subtype', value)}
                disabled={!formData.account_type}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select subtype" />
                </SelectTrigger>
                <SelectContent>
                  {getAvailableSubtypes().map((subtype) => (
                    <SelectItem key={subtype.value} value={subtype.value}>
                      {subtype.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="normal_balance">Normal Balance *</Label>
              <Select
                value={formData.normal_balance}
                onValueChange={(value: 'debit' | 'credit') => handleInputChange('normal_balance', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select normal balance" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="debit">Debit</SelectItem>
                  <SelectItem value="credit">Credit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="currency_code">Currency</Label>
              <Select
                value={formData.currency_code}
                onValueChange={(value) => handleInputChange('currency_code', value)}
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
              <Label htmlFor="parent_id">Parent Account</Label>
              <Select
                value={formData.parent_id}
                onValueChange={(value) => handleInputChange('parent_id', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select parent account (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {getFilteredParentAccounts().map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.account_code} - {account.account_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="opening_balance">Opening Balance</Label>
              <Input
                id="opening_balance"
                type="number"
                step="0.01"
                value={formData.opening_balance}
                onChange={(e) => handleInputChange('opening_balance', e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => handleInputChange('is_active', checked)}
              />
              <Label htmlFor="is_active">Active Account</Label>
            </div>
          </div>

          <div className="space-y-2">           <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Account description (optional)"
              rows={3}
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Create Account'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
