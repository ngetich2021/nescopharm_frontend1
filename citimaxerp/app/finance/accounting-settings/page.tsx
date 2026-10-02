"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { PermissionGuard } from "@/components/PermissionGuard"
import {
  getAccountingSettings,
  updateAccountingSettings,
  resetAccountingSettings,
  getAccountingSettingsSummary,
  formatCurrency,
  type AccountingSettings,
  type AccountingSettingsOptions,
  type AccountingSettingsSummary,
  type UpdateAccountingSettingsInput,
} from "@/lib/finance"
import {
  Settings,
  DollarSign,
  ShoppingCart,
  Receipt,
  Zap,
  FileText,
  Loader2,
  RotateCcw,
  Save,
} from "lucide-react"

// Helper function to convert Record<string, string> to Array<{key: string, description: string}>
const optionsToArray = (optionsObj: Record<string, string> | undefined): Array<{ key: string; description: string }> => {
  if (!optionsObj || typeof optionsObj !== 'object') {
    return []
  }
  return Object.entries(optionsObj).map(([key, description]) => ({ key, description }))
}

// Default options fallback if API doesn't return them
const DEFAULT_ACCOUNTING_METHODS: Array<{ key: string; description: string }> = [
  { key: 'accrual', description: 'Accrual Basis (Record when earned/incurred)' },
  { key: 'cash', description: 'Cash Basis (Record when paid/received)' }
]

export default function AccountingSettingsPage() {
  const [settings, setSettings] = useState<AccountingSettings | null>(null)
  const [options, setOptions] = useState<AccountingSettingsOptions | null>(null)
  const [summary, setSummary] = useState<AccountingSettingsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState<UpdateAccountingSettingsInput>({})
  const { toast } = useToast()

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      setLoading(true)
      const [settingsResponse, summaryResponse] = await Promise.all([
        getAccountingSettings(),
        getAccountingSettingsSummary(),
      ])
      
      // Handle potential response wrapping - API might wrap in 'data' property
      const data = settingsResponse.data || settingsResponse
      const optionsData = settingsResponse.options
      
      
      setSettings(data)
      setOptions(optionsData || null)
      setSummary(summaryResponse)
      
      // Initialize form data with current settings
      const settingsData = settingsResponse.data || settingsResponse
      setFormData({
        accounting_method: settingsData.accounting_method,
        sales_recognition_trigger: settingsData.sales_recognition_trigger,
        purchase_recognition_trigger: settingsData.purchase_recognition_trigger,
        expense_recognition_trigger: settingsData.expense_recognition_trigger,
        auto_record_cash_sales: settingsData.auto_record_cash_sales,
        credit_sales_on_invoice_send: settingsData.credit_sales_on_invoice_send,
        auto_record_customer_payments: settingsData.auto_record_customer_payments,
        auto_record_supplier_payments: settingsData.auto_record_supplier_payments,
        record_proforma_invoices: settingsData.record_proforma_invoices,
        record_draft_invoices: settingsData.record_draft_invoices,
        require_expense_approval: settingsData.require_expense_approval,
        require_invoice_approval: settingsData.require_invoice_approval,
        require_journal_approval: settingsData.require_journal_approval,
        expense_approval_threshold: settingsData.expense_approval_threshold,
        accounting_integration_enabled: settingsData.accounting_integration_enabled,
        vat_recognition: settingsData.vat_recognition,
        cogs_recognition: settingsData.cogs_recognition,
        perpetual_inventory: settingsData.perpetual_inventory,
        log_failed_entries: settingsData.log_failed_entries,
        soft_fail_on_accounting_error: settingsData.soft_fail_on_accounting_error,
        financial_year_start_month: settingsData.financial_year_start_month,
        lock_closed_periods: settingsData.lock_closed_periods,
        current_period_end: settingsData.current_period_end,
      })
    } catch (error: any) {
      console.error('Error fetching accounting settings:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to load accounting settings. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: keyof UpdateAccountingSettingsInput, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      const response = await updateAccountingSettings(formData)
      setSettings(response.data)
      toast({
        title: "Success",
        description: "Accounting settings updated successfully.",
      })
      // Refresh summary
      const summaryResponse = await getAccountingSettingsSummary()
      setSummary(summaryResponse)
    } catch (error: any) {
      console.error('Error updating accounting settings:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to update accounting settings. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    if (!confirm("Are you sure you want to reset all accounting settings to defaults? This action cannot be undone.")) {
      return
    }

    try {
      setSaving(true)
      const response = await resetAccountingSettings()
      setSettings(response.data)
      setFormData({
        accounting_method: response.data.accounting_method,
        sales_recognition_trigger: response.data.sales_recognition_trigger,
        purchase_recognition_trigger: response.data.purchase_recognition_trigger,
        expense_recognition_trigger: response.data.expense_recognition_trigger,
        auto_record_cash_sales: response.data.auto_record_cash_sales,
        credit_sales_on_invoice_send: response.data.credit_sales_on_invoice_send,
        auto_record_customer_payments: response.data.auto_record_customer_payments,
        auto_record_supplier_payments: response.data.auto_record_supplier_payments,
        record_proforma_invoices: response.data.record_proforma_invoices,
        record_draft_invoices: response.data.record_draft_invoices,
        require_expense_approval: response.data.require_expense_approval,
        require_invoice_approval: response.data.require_invoice_approval,
        require_journal_approval: response.data.require_journal_approval,
        expense_approval_threshold: response.data.expense_approval_threshold,
        accounting_integration_enabled: response.data.accounting_integration_enabled,
        vat_recognition: response.data.vat_recognition,
        cogs_recognition: response.data.cogs_recognition,
        perpetual_inventory: response.data.perpetual_inventory,
        log_failed_entries: response.data.log_failed_entries,
        soft_fail_on_accounting_error: response.data.soft_fail_on_accounting_error,
        financial_year_start_month: response.data.financial_year_start_month,
        lock_closed_periods: response.data.lock_closed_periods,
        current_period_end: response.data.current_period_end,
      })
      toast({
        title: "Success",
        description: "Accounting settings reset to defaults.",
      })
      // Refresh summary
      const summaryResponse = await getAccountingSettingsSummary()
      setSummary(summaryResponse)
    } catch (error: any) {
      console.error('Error resetting accounting settings:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to reset accounting settings. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>Failed to load accounting settings.</AlertDescription>
        </Alert>
      </div>
    )
  }


  return (
    <PermissionGuard permissions={["can_manage_accounting_settings"]}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Accounting Settings</h1>
            <p className="text-muted-foreground">
              Configure when and how business transactions are recorded in your accounting system
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={saving}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset to Defaults
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Settings Tabs */}
        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="sales">Sales</TabsTrigger>
            <TabsTrigger value="purchase">Purchase</TabsTrigger>
            <TabsTrigger value="expense">Expense</TabsTrigger>
            <TabsTrigger value="auto-recording">Auto-Recording</TabsTrigger>
            <TabsTrigger value="periods">Periods</TabsTrigger>
            <TabsTrigger value="summary">Summary</TabsTrigger>
          </TabsList>

          {/* General Settings Tab */}
          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  General Settings
                </CardTitle>
                <CardDescription>
                  Configure basic accounting method and integration settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="accounting_method">Accounting Method</Label>
                  <Select
                    value={formData.accounting_method || settings.accounting_method}
                    onValueChange={(value) => handleInputChange('accounting_method', value as 'accrual' | 'cash')}
                  >
                    <SelectTrigger id="accounting_method">
                      <SelectValue placeholder="Select accounting method" />
                    </SelectTrigger>
                    <SelectContent>
                      {(options?.accounting_methods ? optionsToArray(options.accounting_methods) : DEFAULT_ACCOUNTING_METHODS).map((method) => (
                        <SelectItem key={method.key} value={method.key}>
                          {method.description}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    {(options?.accounting_methods ? optionsToArray(options.accounting_methods) : DEFAULT_ACCOUNTING_METHODS).find(m => m.key === (formData.accounting_method || settings.accounting_method))?.description}
                  </p>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="accounting_integration_enabled">Accounting Integration</Label>
                    <p className="text-sm text-muted-foreground">
                      Enable automatic creation of accounting entries
                    </p>
                  </div>
                  <Switch
                    id="accounting_integration_enabled"
                    checked={formData.accounting_integration_enabled ?? settings.accounting_integration_enabled}
                    onCheckedChange={(checked) => handleInputChange('accounting_integration_enabled', checked)}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="soft_fail_on_accounting_error">Soft Fail on Errors</Label>
                    <p className="text-sm text-muted-foreground">
                      Allow business transactions to complete even if accounting entry creation fails
                    </p>
                  </div>
                  <Switch
                    id="soft_fail_on_accounting_error"
                    checked={formData.soft_fail_on_accounting_error ?? settings.soft_fail_on_accounting_error}
                    onCheckedChange={(checked) => handleInputChange('soft_fail_on_accounting_error', checked)}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="perpetual_inventory">Perpetual Inventory</Label>
                    <p className="text-sm text-muted-foreground">
                      Use perpetual inventory system for real-time inventory tracking
                    </p>
                  </div>
                  <Switch
                    id="perpetual_inventory"
                    checked={formData.perpetual_inventory ?? settings.perpetual_inventory ?? false}
                    onCheckedChange={(checked) => handleInputChange('perpetual_inventory', checked)}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="log_failed_entries">Log Failed Entries</Label>
                    <p className="text-sm text-muted-foreground">
                      Log accounting entries that fail to be created for review
                    </p>
                  </div>
                  <Switch
                    id="log_failed_entries"
                    checked={formData.log_failed_entries ?? settings.log_failed_entries ?? false}
                    onCheckedChange={(checked) => handleInputChange('log_failed_entries', checked)}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="require_invoice_approval">Require Invoice Approval</Label>
                    <p className="text-sm text-muted-foreground">
                      Require approval before invoices can be sent
                    </p>
                  </div>
                  <Switch
                    id="require_invoice_approval"
                    checked={formData.require_invoice_approval ?? settings.require_invoice_approval ?? false}
                    onCheckedChange={(checked) => handleInputChange('require_invoice_approval', checked)}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="require_journal_approval">Require Journal Entry Approval</Label>
                    <p className="text-sm text-muted-foreground">
                      Require approval before journal entries can be posted
                    </p>
                  </div>
                  <Switch
                    id="require_journal_approval"
                    checked={formData.require_journal_approval ?? settings.require_journal_approval ?? false}
                    onCheckedChange={(checked) => handleInputChange('require_journal_approval', checked)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sales Recognition Tab */}
          <TabsContent value="sales">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Sales Recognition
                </CardTitle>
                <CardDescription>
                  Configure when sales revenue is recognized in your books
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="sales_recognition_trigger">Sales Recognition Trigger</Label>
                  <Select
                    value={formData.sales_recognition_trigger || settings.sales_recognition_trigger}
                    onValueChange={(value) => handleInputChange('sales_recognition_trigger', value)}
                  >
                    <SelectTrigger id="sales_recognition_trigger">
                      <SelectValue placeholder="Select trigger" />
                    </SelectTrigger>
                    <SelectContent>
                      {optionsToArray(options?.sales_recognition_triggers).map((trigger) => (
                        <SelectItem key={trigger.key} value={trigger.key}>
                          {trigger.description}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    {optionsToArray(options?.sales_recognition_triggers).find(t => t.key === (formData.sales_recognition_trigger || settings.sales_recognition_trigger))?.description}
                  </p>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="credit_sales_on_invoice_send">Credit Sales on Invoice Send</Label>
                    <p className="text-sm text-muted-foreground">
                      Record credit sales when invoice is sent to customer
                    </p>
                  </div>
                  <Switch
                    id="credit_sales_on_invoice_send"
                    checked={formData.credit_sales_on_invoice_send ?? settings.credit_sales_on_invoice_send ?? false}
                    onCheckedChange={(checked) => handleInputChange('credit_sales_on_invoice_send', checked)}
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="vat_recognition">VAT Recognition</Label>
                  <Select
                    value={formData.vat_recognition || settings.vat_recognition || 'invoice_date'}
                    onValueChange={(value) => handleInputChange('vat_recognition', value as 'invoice_date' | 'payment_date')}
                  >
                    <SelectTrigger id="vat_recognition">
                      <SelectValue placeholder="Select VAT recognition" />
                    </SelectTrigger>
                    <SelectContent>
                      {optionsToArray(options?.vat_recognition_options).map((option) => (
                        <SelectItem key={option.key} value={option.key}>
                          {option.description}
                        </SelectItem>
                      ))}
                      {(!options?.vat_recognition_options || Object.keys(options.vat_recognition_options).length === 0) && (
                        <>
                          <SelectItem value="invoice_date">When Invoice is Issued</SelectItem>
                          <SelectItem value="payment_date">When Payment is Received</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    Controls when VAT is recognized in your accounting system
                  </p>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="cogs_recognition">COGS Recognition</Label>
                  <Select
                    value={formData.cogs_recognition || settings.cogs_recognition || 'on_sale'}
                    onValueChange={(value) => handleInputChange('cogs_recognition', value as 'on_sale' | 'on_dispatch' | 'on_delivery')}
                  >
                    <SelectTrigger id="cogs_recognition">
                      <SelectValue placeholder="Select COGS recognition" />
                    </SelectTrigger>
                    <SelectContent>
                      {optionsToArray(options?.cogs_recognition_options).map((option) => (
                        <SelectItem key={option.key} value={option.key}>
                          {option.description}
                        </SelectItem>
                      ))}
                      {(!options?.cogs_recognition_options || Object.keys(options.cogs_recognition_options).length === 0) && (
                        <>
                          <SelectItem value="on_sale">When Sale is Made</SelectItem>
                          <SelectItem value="on_dispatch">When Goods are Dispatched</SelectItem>
                          <SelectItem value="on_delivery">When Delivery is Confirmed</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    Controls when Cost of Goods Sold is posted to your accounting system
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Purchase Recognition Tab */}
          <TabsContent value="purchase">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Purchase Recognition
                </CardTitle>
                <CardDescription>
                  Configure when purchase transactions are recorded
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="purchase_recognition_trigger">Purchase Recognition Trigger</Label>
                  <Select
                    value={formData.purchase_recognition_trigger || settings.purchase_recognition_trigger}
                    onValueChange={(value) => handleInputChange('purchase_recognition_trigger', value)}
                  >
                    <SelectTrigger id="purchase_recognition_trigger">
                      <SelectValue placeholder="Select trigger" />
                    </SelectTrigger>
                    <SelectContent>
                      {optionsToArray(options?.purchase_recognition_triggers).map((trigger) => (
                        <SelectItem key={trigger.key} value={trigger.key}>
                          {trigger.description}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    {optionsToArray(options?.purchase_recognition_triggers).find(t => t.key === (formData.purchase_recognition_trigger || settings.purchase_recognition_trigger))?.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Expense Recognition Tab */}
          <TabsContent value="expense">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  Expense Recognition
                </CardTitle>
                <CardDescription>
                  Configure when expenses are recorded and approval requirements
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="expense_recognition_trigger">Expense Recognition Trigger</Label>
                  <Select
                    value={formData.expense_recognition_trigger || settings.expense_recognition_trigger}
                    onValueChange={(value) => handleInputChange('expense_recognition_trigger', value)}
                  >
                    <SelectTrigger id="expense_recognition_trigger">
                      <SelectValue placeholder="Select trigger" />
                    </SelectTrigger>
                    <SelectContent>
                      {optionsToArray(options?.expense_recognition_triggers).map((trigger) => (
                        <SelectItem key={trigger.key} value={trigger.key}>
                          {trigger.description}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    {optionsToArray(options?.expense_recognition_triggers).find(t => t.key === (formData.expense_recognition_trigger || settings.expense_recognition_trigger))?.description}
                  </p>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="require_expense_approval">Require Expense Approval</Label>
                    <p className="text-sm text-muted-foreground">
                      Require approval for expenses before recording
                    </p>
                  </div>
                  <Switch
                    id="require_expense_approval"
                    checked={formData.require_expense_approval ?? settings.require_expense_approval}
                    onCheckedChange={(checked) => handleInputChange('require_expense_approval', checked)}
                  />
                </div>

                {(formData.require_expense_approval ?? settings.require_expense_approval) && (
                  <div className="space-y-2">
                    <Label htmlFor="expense_approval_threshold">Approval Threshold</Label>
                    <Input
                      id="expense_approval_threshold"
                      type="number"
                      value={formData.expense_approval_threshold ?? settings.expense_approval_threshold ?? ''}
                      onChange={(e) => handleInputChange('expense_approval_threshold', e.target.value ? parseFloat(e.target.value) : undefined)}
                      placeholder="Enter threshold amount"
                    />
                    <p className="text-sm text-muted-foreground">
                      Expenses above this amount require approval
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Auto-Recording Tab */}
          <TabsContent value="auto-recording">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Auto-Recording Settings
                </CardTitle>
                <CardDescription>
                  Enable automatic recording of transactions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="auto_record_cash_sales">Auto-Record Cash Sales</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically record cash sales transactions
                    </p>
                  </div>
                  <Switch
                    id="auto_record_cash_sales"
                    checked={formData.auto_record_cash_sales ?? settings.auto_record_cash_sales}
                    onCheckedChange={(checked) => handleInputChange('auto_record_cash_sales', checked)}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="auto_record_customer_payments">Auto-Record Customer Payments</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically record customer payment transactions
                    </p>
                  </div>
                  <Switch
                    id="auto_record_customer_payments"
                    checked={formData.auto_record_customer_payments ?? settings.auto_record_customer_payments}
                    onCheckedChange={(checked) => handleInputChange('auto_record_customer_payments', checked)}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="auto_record_supplier_payments">Auto-Record Supplier Payments</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically record supplier payment transactions
                    </p>
                  </div>
                  <Switch
                    id="auto_record_supplier_payments"
                    checked={formData.auto_record_supplier_payments ?? settings.auto_record_supplier_payments}
                    onCheckedChange={(checked) => handleInputChange('auto_record_supplier_payments', checked)}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="record_proforma_invoices">Record Proforma Invoices</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically record proforma invoices in accounting system
                    </p>
                  </div>
                  <Switch
                    id="record_proforma_invoices"
                    checked={formData.record_proforma_invoices ?? settings.record_proforma_invoices ?? false}
                    onCheckedChange={(checked) => handleInputChange('record_proforma_invoices', checked)}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="record_draft_invoices">Record Draft Invoices</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically record draft invoices in accounting system
                    </p>
                  </div>
                  <Switch
                    id="record_draft_invoices"
                    checked={formData.record_draft_invoices ?? settings.record_draft_invoices ?? false}
                    onCheckedChange={(checked) => handleInputChange('record_draft_invoices', checked)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Periods Tab */}
          <TabsContent value="periods">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Financial Periods
                </CardTitle>
                <CardDescription>
                  Configure financial year and period locking settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="financial_year_start_month">Financial Year Start Month</Label>
                  <Select
                    value={String(formData.financial_year_start_month ?? settings.financial_year_start_month ?? 1)}
                    onValueChange={(value) => handleInputChange('financial_year_start_month', parseInt(value))}
                  >
                    <SelectTrigger id="financial_year_start_month">
                      <SelectValue placeholder="Select month" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">January</SelectItem>
                      <SelectItem value="2">February</SelectItem>
                      <SelectItem value="3">March</SelectItem>
                      <SelectItem value="4">April</SelectItem>
                      <SelectItem value="5">May</SelectItem>
                      <SelectItem value="6">June</SelectItem>
                      <SelectItem value="7">July</SelectItem>
                      <SelectItem value="8">August</SelectItem>
                      <SelectItem value="9">September</SelectItem>
                      <SelectItem value="10">October</SelectItem>
                      <SelectItem value="11">November</SelectItem>
                      <SelectItem value="12">December</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    The month when your financial year begins
                  </p>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="lock_closed_periods">Lock Closed Periods</Label>
                    <p className="text-sm text-muted-foreground">
                      Prevent modifications to transactions in closed accounting periods
                    </p>
                  </div>
                  <Switch
                    id="lock_closed_periods"
                    checked={formData.lock_closed_periods ?? settings.lock_closed_periods ?? false}
                    onCheckedChange={(checked) => handleInputChange('lock_closed_periods', checked)}
                  />
                </div>

                {(formData.lock_closed_periods ?? settings.lock_closed_periods) && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <Label htmlFor="current_period_end">Current Period End Date</Label>
                      <Input
                        id="current_period_end"
                        type="date"
                        value={formData.current_period_end || settings.current_period_end || ''}
                        onChange={(e) => handleInputChange('current_period_end', e.target.value || null)}
                      />
                      <p className="text-sm text-muted-foreground">
                        End date of the current accounting period. Transactions after this date will be locked if period locking is enabled.
                      </p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Summary Tab */}
          <TabsContent value="summary">
            <Card>
              <CardHeader>
                <CardTitle>Configuration Summary</CardTitle>
                <CardDescription>
                  Overview of your current accounting settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {settings && (
                  <div className="space-y-6">
                    {/* Status */}
                    <div className="flex items-center justify-between py-2 border-b">
                      <span className="text-sm font-medium">Accounting Integration</span>
                      <Badge variant={settings.accounting_integration_enabled ? "default" : "secondary"}>
                        {settings.accounting_integration_enabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>

                    {/* Accounting Method */}
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-gray-900">Accounting Method</h3>
                      <p className="text-sm text-gray-600 capitalize">
                        {settings.accounting_method === 'accrual' 
                          ? 'Accrual Basis - Record revenue when earned and expenses when incurred'
                          : 'Cash Basis - Record revenue when payment received and expenses when paid'}
                      </p>
                    </div>

                    <Separator />

                    {/* Recognition Triggers */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-gray-900">Recognition Triggers</h3>
                      <div className="space-y-3">
                        <div>
                          <span className="text-sm font-medium text-gray-700">Sales:</span>
                          <p className="text-sm text-gray-600 mt-1">
                            {options?.sales_recognition_triggers?.[settings.sales_recognition_trigger] || settings.sales_recognition_trigger}
                          </p>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-700">Purchase:</span>
                          <p className="text-sm text-gray-600 mt-1">
                            {options?.purchase_recognition_triggers?.[settings.purchase_recognition_trigger] || settings.purchase_recognition_trigger}
                          </p>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-700">Expense:</span>
                          <p className="text-sm text-gray-600 mt-1">
                            {options?.expense_recognition_triggers?.[settings.expense_recognition_trigger] || settings.expense_recognition_trigger}
                          </p>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* VAT and COGS */}
                    {(settings.vat_recognition || settings.cogs_recognition) && (
                      <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-gray-900">Additional Recognition Settings</h3>
                        <div className="space-y-3">
                          {settings.vat_recognition && (
                            <div>
                              <span className="text-sm font-medium text-gray-700">VAT Recognition:</span>
                              <p className="text-sm text-gray-600 mt-1">
                                {options?.vat_recognition_options?.[settings.vat_recognition] || 
                                 (settings.vat_recognition === 'invoice_date' ? 'When Invoice is Issued' : 'When Payment is Received')}
                              </p>
                            </div>
                          )}
                          {settings.cogs_recognition && (
                            <div>
                              <span className="text-sm font-medium text-gray-700">COGS Recognition:</span>
                              <p className="text-sm text-gray-600 mt-1">
                                {options?.cogs_recognition_options?.[settings.cogs_recognition] || settings.cogs_recognition}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {(settings.vat_recognition || settings.cogs_recognition) && <Separator />}

                    {/* Automation Settings */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-gray-900">Automation Settings</h3>
                      <div className="space-y-2">
                        {settings.auto_record_cash_sales && (
                          <p className="text-sm text-gray-600">• Automatically record cash sales</p>
                        )}
                        {settings.auto_record_customer_payments && (
                          <p className="text-sm text-gray-600">• Automatically record customer payments</p>
                        )}
                        {settings.auto_record_supplier_payments && (
                          <p className="text-sm text-gray-600">• Automatically record supplier payments</p>
                        )}
                        {settings.record_proforma_invoices && (
                          <p className="text-sm text-gray-600">• Record proforma invoices</p>
                        )}
                        {settings.record_draft_invoices && (
                          <p className="text-sm text-gray-600">• Record draft invoices</p>
                        )}
                        {!settings.auto_record_cash_sales && !settings.auto_record_customer_payments && 
                         !settings.auto_record_supplier_payments && !settings.record_proforma_invoices && 
                         !settings.record_draft_invoices && (
                          <p className="text-sm text-gray-500 italic">No automation settings enabled</p>
                        )}
                      </div>
                    </div>

                    <Separator />

                    {/* Approval Requirements */}
                    {(settings.require_expense_approval || settings.require_invoice_approval || settings.require_journal_approval) && (
                      <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-gray-900">Approval Requirements</h3>
                        <div className="space-y-2">
                          {settings.require_expense_approval && (
                            <p className="text-sm text-gray-600">
                              • Expenses require approval
                              {settings.expense_approval_threshold && (
                                <span className="ml-2 text-gray-500">
                                  (Threshold: {formatCurrency(settings.expense_approval_threshold)})
                                </span>
                              )}
                            </p>
                          )}
                          {settings.require_invoice_approval && (
                            <p className="text-sm text-gray-600">• Invoices require approval</p>
                          )}
                          {settings.require_journal_approval && (
                            <p className="text-sm text-gray-600">• Journal entries require approval</p>
                          )}
                        </div>
                      </div>
                    )}

                    {(settings.require_expense_approval || settings.require_invoice_approval || settings.require_journal_approval) && <Separator />}

                    {/* Additional Settings */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-gray-900">Additional Settings</h3>
                      <div className="space-y-2">
                        {settings.perpetual_inventory && (
                          <p className="text-sm text-gray-600">• Perpetual inventory system enabled</p>
                        )}
                        {settings.lock_closed_periods && (
                          <p className="text-sm text-gray-600">• Closed periods are locked</p>
                        )}
                        {settings.soft_fail_on_accounting_error && (
                          <p className="text-sm text-gray-600">• Business transactions continue even if accounting fails</p>
                        )}
                        {settings.log_failed_entries && (
                          <p className="text-sm text-gray-600">• Failed accounting entries are logged</p>
                        )}
                        {settings.financial_year_start_month && (
                          <p className="text-sm text-gray-600">
                            • Financial year starts in {
                              new Date(2000, (settings.financial_year_start_month || 1) - 1).toLocaleString('default', { month: 'long' })
                            }
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PermissionGuard>
  )
}
