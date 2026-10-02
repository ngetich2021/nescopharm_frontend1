"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { PermissionGuard } from "@/components/PermissionGuard"
import * as accountMappings from "@/lib/account-mappings"
import { getChartOfAccounts, type ChartOfAccount } from "@/lib/finance"
import { Loader2, CheckCircle2, AlertTriangle, ArrowRight, Wallet, Save, RefreshCw } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export default function AccountMappingsPage() {
  const { toast } = useToast()
  const { companyId } = useAuth()
  
  // State
  const [activeTab, setActiveTab] = useState("unmapped")
  const [initializing, setInitializing] = useState(false)
  const [loadingValidation, setLoadingValidation] = useState(false)
  const [initializeResult, setInitializeResult] = useState<accountMappings.InitializeResponse | null>(null)
  const [validation, setValidation] = useState<any>(null)
  const [mappings, setMappings] = useState<accountMappings.AccountMapping[]>([])
  const [chartAccounts, setChartAccounts] = useState<ChartOfAccount[]>([])
  const [selectedAccountForKey, setSelectedAccountForKey] = useState<Record<string, string>>({})
  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const [loadingMappings, setLoadingMappings] = useState(false)
  const [savingMapping, setSavingMapping] = useState<string | null>(null)
  
  // Payment Methods State
  const [paymentMethods, setPaymentMethods] = useState<any[]>([])
  const [loadingPaymentMethods, setLoadingPaymentMethods] = useState(false)
  const [newPaymentMethod, setNewPaymentMethod] = useState({ method: '', mappingKey: '', accountCode: '' })
  const [savingPaymentMethod, setSavingPaymentMethod] = useState(false)

  // Initial Data Load
  useEffect(() => {
    if (companyId) {
      loadAllData()
    }
  }, [companyId])

  const loadAllData = async () => {
    await Promise.all([
      refreshValidation(),
      loadMappings(),
      loadChartAccounts(),
      loadPaymentMethodMappings()
    ])
  }

  // Actions
  const handleInitialize = async () => {
    try {
      setInitializing(true)
      setInitializeResult(null)
      const res = await accountMappings.initializeMappings(companyId || undefined)
      setInitializeResult(res)
      toast({ title: 'Initialization Complete', description: `Mapped ${res.mapped_count} keys. ${res.unmapped_count} keys need attention.` })
      await refreshValidation()
      await loadMappings()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to initialize mappings', variant: 'destructive' })
    } finally {
      setInitializing(false)
    }
  }

  const loadChartAccounts = async () => {
    try {
      setLoadingAccounts(true)
      const resp = await getChartOfAccounts(companyId ? { company_id: companyId, is_active: true } : undefined)
      setChartAccounts(resp.accounts || [])
    } catch (err: any) {
      toast({ title: 'Error', description: 'Failed to load chart of accounts', variant: 'destructive' })
    } finally {
      setLoadingAccounts(false)
    }
  }

  const loadMappings = async () => {
    try {
      setLoadingMappings(true)
      const resp = await accountMappings.getMappings(companyId ? { company_id: companyId } : undefined)
      setMappings(resp.mappings || [])
    } catch (err: any) {
      console.error(err)
      // Silent error or toast if needed
    } finally {
      setLoadingMappings(false)
    }
  }

  const loadPaymentMethodMappings = async () => {
    try {
      setLoadingPaymentMethods(true)
      const resp = await accountMappings.getPaymentMethodMappings(companyId || undefined)
      // Assuming response has a 'mappings' or similar property, check API response
      // Based on docs, it might return a list directly or wrapped. 
      // I need to be careful here. Let's assume it returns { data: [] } or just [] based on typical patterns.
      // Wait, let's look at lib/account-mappings.ts -> return apiCall<any>
      // Let's assume it returns an array of mappings.
      console.log("Payment methods response:", resp)
      setPaymentMethods(Array.isArray(resp) ? resp : (resp.data || [])) 
    } catch (err) {
      console.error("Failed to load payment methods", err)
    } finally {
      setLoadingPaymentMethods(false)
    }
  }

  const refreshValidation = async () => {
    try {
      setLoadingValidation(true)
      const resp = await accountMappings.validateMappings(companyId || undefined)
      setValidation(resp)
      
      // Auto-switch tabs if all valid
      if (resp?.is_valid && activeTab === 'unmapped') {
        // Don't auto switch, might be annoying.
      }
    } catch (err: any) {
      console.error('Validation check failed:', err)
    } finally {
      setLoadingValidation(false)
    }
  }

  const handleSaveMapping = async (mappingKey: string) => {
    const account_code = selectedAccountForKey[mappingKey]
    if (!account_code) {
      toast({ title: 'Validation Error', description: 'Please select an account first', variant: 'destructive' })
      return
    }

    try {
      setSavingMapping(mappingKey)
      await accountMappings.saveMapping({ 
        company_id: companyId || undefined, 
        mapping_key: mappingKey, 
        account_code,
        description: `Mapped via UI`
      })
      
      toast({ title: 'Saved', description: `Mapping for '${mappingKey}' updated successfully.` })
      
      // Clear selection
      setSelectedAccountForKey((p) => {
        const copy = { ...p }
        delete copy[mappingKey]
        return copy
      })
      
      await Promise.all([refreshValidation(), loadMappings()])
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to save mapping', variant: 'destructive' })
    } finally {
      setSavingMapping(null)
    }
  }

  const handleSavePaymentMethod = async () => {
    if (!newPaymentMethod.method || !newPaymentMethod.accountCode) {
       toast({ title: 'Validation Error', description: 'Method name and account are required', variant: 'destructive' })
       return
    }

    try {
      setSavingPaymentMethod(true)
      // Construct mapping key like 'payment_method_mpesa'
      const mappingKey = `payment_method_${newPaymentMethod.method.toLowerCase().replace(/\s+/g, '_')}`
      
      await accountMappings.savePaymentMethodMapping({
        company_id: companyId || undefined,
        payment_method: newPaymentMethod.method,
        mapping_key: mappingKey,
        description: `Payment method: ${newPaymentMethod.method}`
      })
      
      // Also need to save the actual account mapping
      await accountMappings.saveMapping({
        company_id: companyId || undefined,
        mapping_key: mappingKey,
        account_code: newPaymentMethod.accountCode,
        description: `Mapping for payment method: ${newPaymentMethod.method}`
      })

      toast({ title: 'Success', description: 'Payment method mapping added' })
      setNewPaymentMethod({ method: '', mappingKey: '', accountCode: '' })
      loadPaymentMethodMappings()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to add payment method mapping', variant: 'destructive' })
    } finally {
      setSavingPaymentMethod(false)
    }
  }

  // Derived State
  const unmappedKeys = initializeResult?.unmapped ? Object.keys(initializeResult.unmapped) : []
  const missingKeys = validation?.missing || []
  const displayUnmapped = unmappedKeys.length > 0 ? unmappedKeys : missingKeys

  const isValid = validation?.is_valid

  return (
    <PermissionGuard permissions={["can_manage_accounting_settings"]}>
      <div className="space-y-6">
        {/* Header Section */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 p-8 text-white shadow-lg">
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Account Configuration</h1>
              <p className="mt-2 text-slate-300 max-w-xl">
                Map your chart of accounts to system events and payment methods to automate your financial tracking.
              </p>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={handleInitialize} 
                disabled={initializing}
                variant="secondary"
                className="shadow-sm"
              >
                {initializing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Run Auto-Discovery
              </Button>
            </div>
          </div>
        </div>

        {/* Validation Status */}
        {validation && (
          <Alert variant={isValid ? "default" : "destructive"} className={isValid ? "border-green-200 bg-green-50 text-green-900" : "border-red-200 bg-red-50 text-red-900"}>
            {isValid ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <AlertTriangle className="h-4 w-4 text-red-600" />}
            <AlertTitle>{isValid ? "Configuration Valid" : "Configuration Incomplete"}</AlertTitle>
            <AlertDescription>
              {isValid 
                ? "All required system mappings are configured. Your accounting automation is ready." 
                : `${validation.missing?.length || 'Some'} required mappings are missing. Please configure them below.`
              }
            </AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-4">
          <div className="flex justify-between items-center">
             <TabsList className="bg-white border">
              <TabsTrigger value="unmapped" className="data-[state=active]:bg-slate-100">
                Required Actions
                {displayUnmapped.length > 0 && <Badge variant="destructive" className="ml-2 h-5 min-w-5 px-1">{displayUnmapped.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="payment_methods" className="data-[state=active]:bg-slate-100">
                Payment Methods
              </TabsTrigger>
              <TabsTrigger value="all" className="data-[state=active]:bg-slate-100">All System Mappings</TabsTrigger>
            </TabsList>
            <Button variant="outline" size="sm" onClick={loadAllData} disabled={loadingMappings}>
              <RefreshCw className={`h-3 w-3 mr-2 ${loadingMappings ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* Unmapped / Actions Tab */}
          <TabsContent value="unmapped" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Missing Configurations</CardTitle>
                <CardDescription>Resolve these items to ensure proper accounting function</CardDescription>
              </CardHeader>
              <CardContent>
                {displayUnmapped.length > 0 ? (
                  <div className="space-y-4">
                    {displayUnmapped.map((key: string) => (
                      <div key={key} className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 border rounded-lg bg-slate-50">
                        <div className="flex-1">
                          <div className="font-semibold text-slate-800 mb-1">{key}</div>
                          <div className="text-sm text-muted-foreground flex items-center">
                            <AlertTriangle className="h-3 w-3 mr-1 text-amber-500" />
                            Unmapped system key
                          </div>
                        </div>
                        <div className="flex flex-col md:flex-row gap-2 flex-1 md:max-w-lg">
                           <Select
                            value={selectedAccountForKey[key] || ''}
                            onValueChange={(val) => setSelectedAccountForKey(p => ({ ...p, [key]: val }))}
                          >
                            <SelectTrigger className="w-full bg-white">
                              <SelectValue placeholder="Select Account..." />
                            </SelectTrigger>
                            <SelectContent>
                              {chartAccounts.map((acc) => (
                                <SelectItem key={acc.id} value={acc.account_code}>
                                  {acc.account_code} - {acc.account_name} ({acc.account_type})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button 
                            onClick={() => handleSaveMapping(key)}
                            disabled={savingMapping === key || !selectedAccountForKey[key]}
                          >
                            {savingMapping === key ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="h-16 w-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                      <CheckCircle2 className="h-8 w-8" />
                    </div>
                    <h3 className="text-lg font-semibold">All Clear!</h3>
                    <p className="text-muted-foreground max-w-xs mt-2">All required system mappings are currently configured.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payment Methods Tab */}
          <TabsContent value="payment_methods" className="space-y-4">
             <div className="grid md:grid-cols-3 gap-6">
                {/* Create New Payment Method Form */}
                <Card className="md:col-span-1 h-fit">
                  <CardHeader>
                    <CardTitle className="text-lg">Add Payment Method</CardTitle>
                    <CardDescription>Map a new payment type</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                       <Label>Method Name</Label>
                       <Input 
                        placeholder="e.g., M-Pesa, Cash, Stripe" 
                        value={newPaymentMethod.method}
                        onChange={(e) => setNewPaymentMethod(p => ({ ...p, method: e.target.value }))}
                       />
                       <p className="text-[10px] text-muted-foreground">The exact name used in transactions</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Target Asset Account</Label>
                      <Select
                            value={newPaymentMethod.accountCode}
                            onValueChange={(val) => setNewPaymentMethod(p => ({ ...p, accountCode: val }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select Asset Account" />
                            </SelectTrigger>
                            <SelectContent>
                              {chartAccounts.filter(a => a.account_type === 'asset').map((acc) => (
                                <SelectItem key={acc.id} value={acc.account_code}>
                                  {acc.account_code} - {acc.account_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-[10px] text-muted-foreground">Where funds are deposited</p>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button className="w-full" onClick={handleSavePaymentMethod} disabled={savingPaymentMethod}>
                      {savingPaymentMethod ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                      Add Mapping
                    </Button>
                  </CardFooter>
                </Card>

                {/* Existing Payment Methods List */}
                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-lg">Configured Payment Methods</CardTitle>
                    <CardDescription>Current mappings between payment types and asset accounts</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loadingPaymentMethods ? (
                      <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                    ) : paymentMethods.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Payment Method</TableHead>
                            <TableHead>Mapped Account</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paymentMethods.map((pm: any, i: number) => (
                            <TableRow key={i}>
                              <TableCell className="font-medium">
                                <div className="flex items-center">
                                  <Wallet className="h-4 w-4 mr-2 text-slate-500" />
                                  {pm.payment_method || pm.mapping_key?.replace('payment_method_', '')}
                                </div>
                              </TableCell>
                              <TableCell>
                                {pm.account_code} 
                                {/* If we have the full account object, show name */}
                                {chartAccounts.find(a => a.account_code === pm.account_code)?.account_name && 
                                  ` - ${chartAccounts.find(a => a.account_code === pm.account_code)?.account_name}`
                                }
                              </TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="sm">Edit</Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="text-center py-12 text-muted-foreground">
                        <Wallet className="h-12 w-12 mx-auto mb-2 opacity-20" />
                        <p>No payment methods configured yet.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
             </div>
          </TabsContent>

          {/* All Mappings Tab */}
          <TabsContent value="all">
            <Card>
              <CardHeader>
                <CardTitle>System Mappings Registry</CardTitle>
                <CardDescription>Complete list of all active account mappings</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingMappings ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : mappings.length > 0 ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead>Mapping Key</TableHead>
                          <TableHead>Account Code</TableHead>
                          <TableHead>Account Name</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mappings.map((m) => (
                          <TableRow key={m.id}>
                            <TableCell className="font-medium font-mono text-xs">{m.mapping_key}</TableCell>
                            <TableCell>{m.account_code}</TableCell>
                            <TableCell>{m.chart_of_account?.account_name || '—'}</TableCell>
                            <TableCell>
                              {m.chart_of_account?.account_type && (
                                <Badge variant="outline" className="capitalize">
                                  {m.chart_of_account.account_type.replace(/_/g, ' ')}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {m.is_active ? (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  Active
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                  Inactive
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">No mappings configured yet</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PermissionGuard>
  )
}
