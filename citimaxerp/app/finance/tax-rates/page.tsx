"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  RefreshCw,
  Percent,
} from "lucide-react"
import apiCall from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { PermissionGuard } from "@/components/PermissionGuard"

interface TaxRate {
  id: string
  name: string
  code: string
  description: string | null
  rate: number
  type: string
  calculation_method: string
  is_active: boolean
  is_default: boolean
  effective_from: string
  effective_to: string | null
  chart_of_account_id?: string | null
  created_at?: string
  updated_at?: string
}

interface TaxRateFormData {
  name: string
  code: string
  rate: string
  type: string
  calculation_method: string
  description: string
  is_active: boolean
  effective_from: string
  effective_to: string
  chart_of_account_id: string
}

const TAX_TYPES = [
  { value: "vat", label: "VAT" },
  { value: "sales_tax", label: "Sales Tax" },
  { value: "service_tax", label: "Service Tax" },
  { value: "withholding_tax", label: "Withholding Tax" },
  { value: "excise_tax", label: "Excise Tax" },
  { value: "other", label: "Other" },
]

const CALCULATION_METHODS = [
  { value: "percentage", label: "Percentage" },
  { value: "fixed_amount", label: "Fixed Amount" },
  { value: "tiered", label: "Tiered" },
]

const TYPE_BADGE_COLORS: Record<string, string> = {
  vat: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/10",
  sales_tax: "bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/10",
  withholding_tax: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/10",
  excise_tax: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/10",
  service_tax: "bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-600/10",
  other: "bg-slate-50 text-slate-700 ring-1 ring-inset ring-slate-600/10",
}

const emptyFormData: TaxRateFormData = {
  name: "",
  code: "",
  rate: "",
  type: "vat",
  calculation_method: "percentage",
  description: "",
  is_active: true,
  effective_from: "",
  effective_to: "",
  chart_of_account_id: "",
}

function getTypeBadgeColor(type: string): string {
  return TYPE_BADGE_COLORS[type] || TYPE_BADGE_COLORS.other
}

function formatTypeLabel(type: string): string {
  const found = TAX_TYPES.find((t) => t.value === type)
  return found ? found.label : type
}

function formatMethodLabel(method: string): string {
  const found = CALCULATION_METHODS.find((m) => m.value === method)
  return found ? found.label : method
}

export default function TaxRatesPage() {
  const [taxRates, setTaxRates] = useState<TaxRate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [activeFilter, setActiveFilter] = useState<string>("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [showDialog, setShowDialog] = useState(false)
  const [editingTaxRate, setEditingTaxRate] = useState<TaxRate | null>(null)
  const [formData, setFormData] = useState<TaxRateFormData>(emptyFormData)
  const [isSaving, setIsSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetchTaxRates()
  }, [typeFilter, activeFilter])

  const fetchTaxRates = async () => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams()
      if (typeFilter !== "all") params.append("type", typeFilter)
      if (activeFilter !== "all") params.append("is_active", activeFilter === "active" ? "1" : "0")
      const query = params.toString()
      const response = await apiCall<{ tax_rates: TaxRate[] }>(
        `/finance/tax-rates${query ? `?${query}` : ""}`,
        "GET"
      )
      setTaxRates(response.tax_rates || [])
    } catch (error) {
      console.error("Error fetching tax rates:", error)
      toast({
        title: "Error",
        description: "Failed to fetch tax rates. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const openCreateDialog = () => {
    setEditingTaxRate(null)
    setFormData(emptyFormData)
    setShowDialog(true)
  }

  const openEditDialog = (taxRate: TaxRate) => {
    setEditingTaxRate(taxRate)
    setFormData({
      name: taxRate.name,
      code: taxRate.code,
      rate: (taxRate.rate * 100).toString(),
      type: taxRate.type,
      calculation_method: taxRate.calculation_method,
      description: taxRate.description || "",
      is_active: taxRate.is_active,
      effective_from: taxRate.effective_from,
      effective_to: taxRate.effective_to || "",
      chart_of_account_id: taxRate.chart_of_account_id || "",
    })
    setShowDialog(true)
  }

  const handleSave = async () => {
    if (!formData.name || !formData.code || !formData.rate || !formData.effective_from) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      })
      return
    }

    const rateValue = parseFloat(formData.rate)
    if (isNaN(rateValue) || rateValue < 0 || rateValue > 100) {
      toast({
        title: "Validation Error",
        description: "Rate must be a number between 0 and 100.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSaving(true)
      const body: Record<string, unknown> = {
        name: formData.name,
        code: formData.code,
        rate: rateValue / 100,
        type: formData.type,
        calculation_method: formData.calculation_method,
        is_active: formData.is_active,
        effective_from: formData.effective_from,
      }
      if (formData.description) body.description = formData.description
      if (formData.effective_to) body.effective_to = formData.effective_to
      if (formData.chart_of_account_id) body.chart_of_account_id = formData.chart_of_account_id

      if (editingTaxRate) {
        await apiCall(`/finance/tax-rates/${editingTaxRate.id}`, "PUT", body)
        toast({
          title: "Success",
          description: "Tax rate updated successfully.",
        })
      } else {
        await apiCall("/finance/tax-rates", "POST", body)
        toast({
          title: "Success",
          description: "Tax rate created successfully.",
        })
      }

      setShowDialog(false)
      setEditingTaxRate(null)
      setFormData(emptyFormData)
      fetchTaxRates()
    } catch (error) {
      console.error("Error saving tax rate:", error)
      toast({
        title: "Error",
        description: editingTaxRate
          ? "Failed to update tax rate. Please try again."
          : "Failed to create tax rate. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (taxRate: TaxRate) => {
    if (!confirm(`Are you sure you want to delete "${taxRate.name}"?`)) {
      return
    }

    try {
      await apiCall(`/finance/tax-rates/${taxRate.id}`, "DELETE")
      toast({
        title: "Success",
        description: "Tax rate deleted successfully.",
      })
      fetchTaxRates()
    } catch (error) {
      console.error("Error deleting tax rate:", error)
      toast({
        title: "Error",
        description: "Failed to delete tax rate. Please try again.",
        variant: "destructive",
      })
    }
  }

  const filteredTaxRates = taxRates.filter((tr) => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      tr.name.toLowerCase().includes(term) ||
      tr.code.toLowerCase().includes(term) ||
      tr.description?.toLowerCase().includes(term)
    )
  })

  if (isLoading) {
    return <FinanceTableSkeleton />
  }

  return (
    <PermissionGuard permissions={["can_view_tax_rates"]}>
      <div className="space-y-6">
        {/* Header Banner */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 p-8 text-white shadow-lg">
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
                  <Percent className="h-5 w-5 text-fuchsia-200" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight">Tax Rates</h1>
              </div>
              <p className="text-fuchsia-100 max-w-xl text-sm">
                Configure and manage tax rates including VAT, withholding tax, and other tax types for your organization.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={fetchTaxRates}
                disabled={isLoading}
                variant="secondary"
                size="sm"
                className="shadow-sm"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button
                onClick={openCreateDialog}
                size="sm"
                className="bg-white/20 hover:bg-white/30 text-white border-0"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Tax Rate
              </Button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card className="border-slate-200 shadow-sm">
          <div className="p-4 border-b flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50/50">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by name or code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-white"
              />
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[160px] bg-white">
                  <SelectValue placeholder="Tax Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {TAX_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={activeFilter} onValueChange={setActiveFilter}>
                <SelectTrigger className="w-[140px] bg-white">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Table */}
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">S/No</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Effective From</TableHead>
                  <TableHead>Effective To</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTaxRates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                      No tax rates found. Click &quot;Add Tax Rate&quot; to create one.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTaxRates.map((taxRate, index) => (
                    <TableRow key={taxRate.id}>
                      <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                      <TableCell className="font-mono text-sm">{taxRate.code}</TableCell>
                      <TableCell className="font-medium">{taxRate.name}</TableCell>
                      <TableCell className="font-semibold">
                        {taxRate.calculation_method === "fixed_amount"
                          ? taxRate.rate.toLocaleString()
                          : `${(taxRate.rate * 100).toFixed(2).replace(/\.?0+$/, "")}%`}
                      </TableCell>
                      <TableCell>
                        <Badge className={getTypeBadgeColor(taxRate.type)} variant="outline">
                          {formatTypeLabel(taxRate.type)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatMethodLabel(taxRate.calculation_method)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(taxRate.effective_from).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {taxRate.effective_to
                          ? new Date(taxRate.effective_to).toLocaleDateString()
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {taxRate.is_active ? (
                          <Badge className="bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/10" variant="outline">
                            Active
                          </Badge>
                        ) : (
                          <Badge className="bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/10" variant="outline">
                            Inactive
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(taxRate)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(taxRate)}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Create / Edit Dialog */}
        <Dialog open={showDialog} onOpenChange={(open) => {
          if (!open) {
            setShowDialog(false)
            setEditingTaxRate(null)
            setFormData(emptyFormData)
          }
        }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingTaxRate ? "Edit Tax Rate" : "Add Tax Rate"}</DialogTitle>
              <DialogDescription>
                {editingTaxRate
                  ? "Update the details for this tax rate."
                  : "Create a new tax rate for your organization."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tax-name">
                    Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="tax-name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Standard VAT"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tax-code">
                    Code <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="tax-code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="e.g. VAT-16"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tax-rate">
                    Rate (%) <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="tax-rate"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={formData.rate}
                    onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                    placeholder="e.g. 16"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tax-type">Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => setFormData({ ...formData, type: value })}
                  >
                    <SelectTrigger id="tax-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {TAX_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="calc-method">Calculation Method</Label>
                <Select
                  value={formData.calculation_method}
                  onValueChange={(value) =>
                    setFormData({ ...formData, calculation_method: value })
                  }
                >
                  <SelectTrigger id="calc-method">
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    {CALCULATION_METHODS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="effective-from">
                    Effective From <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="effective-from"
                    type="date"
                    value={formData.effective_from}
                    onChange={(e) =>
                      setFormData({ ...formData, effective_from: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="effective-to">Effective To</Label>
                  <Input
                    id="effective-to"
                    type="date"
                    value={formData.effective_to}
                    onChange={(e) =>
                      setFormData({ ...formData, effective_to: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tax-description">Description</Label>
                <Textarea
                  id="tax-description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Optional description for this tax rate"
                  rows={3}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="tax-active" className="text-sm font-medium">
                    Active
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Enable this tax rate for use in transactions
                  </p>
                </div>
                <Switch
                  id="tax-active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_active: checked })
                  }
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowDialog(false)
                  setEditingTaxRate(null)
                  setFormData(emptyFormData)
                }}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving || !formData.name || !formData.code || !formData.rate || !formData.effective_from}
              >
                {isSaving
                  ? editingTaxRate
                    ? "Updating..."
                    : "Creating..."
                  : editingTaxRate
                    ? "Update Tax Rate"
                    : "Create Tax Rate"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PermissionGuard>
  )
}
