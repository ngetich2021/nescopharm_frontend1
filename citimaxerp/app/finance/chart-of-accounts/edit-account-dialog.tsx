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

interface EditAccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  account: ChartOfAccount | null
}

export default function EditAccountDialog({ open, onOpenChange, onSuccess, account }: EditAccountDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const [formData, setFormData] = useState({
    account_code: '',
    account_name: '',
    account_type: '' as 'asset' | 'liability' | 'equity' | 'income' | 'expense' | 'cost_of_sales' | '',
    account_subtype: '',
    description: '',
    is_active: true,
    opening_balance: '0',
    currency_code: 'USD',
    normal_balance: '' as 'debit' | 'credit' | ''
  })

  // Update form data when account changes
  useEffect(() => {
    if (account) {
      setFormData({
        account_code: account.account_code || '',
        account_name: account.account_name || '',
        account_type: account.account_type || '',
        account_subtype: account.account_subtype || '',
        description: account.description || '',
        is_active: account.is_active ?? true,
        opening_balance: account.opening_balance || '0',
        currency_code: account.currency_code || 'KES',
        normal_balance: account.normal_balance || 'debit'
      })
    }
  }, [account])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!account || !formData.account_name || !formData.account_type || !formData.normal_balance) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      })
      return
    }

    try {
      setIsLoading(true)
      await financeApi.updateChartOfAccount(account.id, {
        account_code: formData.account_code,
        account_name: formData.account_name,
        account_type: formData.account_type,
        account_subtype: formData.account_subtype,
        description: formData.description,
        is_active: formData.is_active,
        opening_balance: formData.opening_balance,
        currency_code: formData.currency_code,
        ...(formData.normal_balance && { normal_balance: formData.normal_balance as 'debit' | 'credit' })
      })
      
      toast({
        title: "Success",
        description: "Account updated successfully"
      })
      
      onSuccess()
      onOpenChange(false)
    } catch (error) {
      console.error('Error updating account:', error)
      toast({
        title: "Error",
        description: "Failed to update account",
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

  if (!account) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Account</DialogTitle>
          <DialogDescription>
            Update account information
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
              <Input
                id="account_subtype"
                value={formData.account_subtype}
                onChange={(e) => handleInputChange('account_subtype', e.target.value)}
                placeholder="current_asset"
              />
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
            <div className="space-y-2">
              <Label htmlFor="current_balance">Current Balance</Label>
              <Input
                id="current_balance"
                type="number"
                step="0.01"
                value={account.current_balance || formData.opening_balance}
                readOnly
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

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
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
              {isLoading ? 'Updating...' : 'Update Account'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
