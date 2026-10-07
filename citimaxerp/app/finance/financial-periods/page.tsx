"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
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
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  Plus,
  Calendar,
  Lock,
  Unlock,
  CheckCircle2,
  AlertCircle,
  CalendarDays,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { PermissionGuard } from "@/components/PermissionGuard"
import apiCall from "@/lib/api"

interface FinancialPeriod {
  id: string
  company_id: string
  name: string
  period_type: "monthly" | "quarterly" | "semi_annual" | "annual"
  start_date: string
  end_date: string
  status: "open" | "closed" | "locked"
  is_current: boolean
  description: string | null
  closed_by: string | null
  closed_at: string | null
}

const PERIOD_TYPE_LABELS: Record<string, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  semi_annual: "Semi-Annual",
  annual: "Annual",
}

const STATUS_STYLES: Record<string, string> = {
  open: "bg-green-100 text-green-800 ring-1 ring-inset ring-green-600/10",
  closed: "bg-red-100 text-red-800 ring-1 ring-inset ring-red-600/10",
  locked: "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-500/10",
}

const PERIOD_TYPE_STYLES: Record<string, string> = {
  monthly: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/10",
  quarterly: "bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-600/10",
  semi_annual: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/10",
  annual: "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-600/10",
}

const YEARS = [2024, 2025, 2026, 2027]

export default function FinancialPeriodsPage() {
  const [periods, setPeriods] = useState<FinancialPeriod[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [yearFilter, setYearFilter] = useState<string>(new Date().getFullYear().toString())
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmAction, setConfirmAction] = useState<{ type: "close" | "reopen"; period: FinancialPeriod } | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const { toast } = useToast()

  const [formData, setFormData] = useState({
    name: "",
    period_type: "monthly" as string,
    start_date: "",
    end_date: "",
    description: "",
  })

  useEffect(() => {
    fetchPeriods()
  }, [yearFilter, statusFilter])

  const fetchPeriods = async () => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams()
      if (yearFilter) params.append("year", yearFilter)
      if (statusFilter !== "all") params.append("status", statusFilter)
      const queryString = params.toString()
      const response = await apiCall<{ status: string; periods: FinancialPeriod[] }>(
        `/finance/financial-periods${queryString ? `?${queryString}` : ""}`,
        "GET"
      )
      const sorted = (response.periods || []).sort(
        (a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
      )
      setPeriods(sorted)
    } catch (error) {
      console.error("Error fetching financial periods:", error)
      toast({
        title: "Error",
        description: "Failed to load financial periods.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreatePeriod = async () => {
    if (!formData.name || !formData.start_date || !formData.end_date) return
    try {
      setSaving(true)
      await apiCall("/finance/financial-periods", "POST", {
        name: formData.name,
        period_type: formData.period_type,
        start_date: formData.start_date,
        end_date: formData.end_date,
        ...(formData.description && { description: formData.description }),
      })
      toast({
        title: "Success",
        description: "Financial period created successfully.",
      })
      setShowCreateDialog(false)
      setFormData({ name: "", period_type: "monthly", start_date: "", end_date: "", description: "" })
      fetchPeriods()
    } catch (error: any) {
      console.error("Error creating period:", error)
      toast({
        title: "Error",
        description: error?.message || "Failed to create financial period.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleClosePeriod = async (period: FinancialPeriod) => {
    try {
      setActionLoading(true)
      await apiCall(`/finance/financial-periods/${period.id}/close`, "POST")
      toast({
        title: "Success",
        description: `"${period.name}" has been closed.`,
      })
      setConfirmAction(null)
      fetchPeriods()
    } catch (error: any) {
      console.error("Error closing period:", error)
      toast({
        title: "Error",
        description: error?.message || "Failed to close the period.",
        variant: "destructive",
      })
    } finally {
      setActionLoading(false)
    }
  }

  const handleReopenPeriod = async (period: FinancialPeriod) => {
    try {
      setActionLoading(true)
      await apiCall(`/finance/financial-periods/${period.id}/reopen`, "POST")
      toast({
        title: "Success",
        description: `"${period.name}" has been reopened.`,
      })
      setConfirmAction(null)
      fetchPeriods()
    } catch (error: any) {
      console.error("Error reopening period:", error)
      toast({
        title: "Error",
        description: error?.message || "Failed to reopen the period.",
        variant: "destructive",
      })
    } finally {
      setActionLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  if (isLoading) {
    return <FinanceTableSkeleton />
  }

  return (
    <PermissionGuard permissions={["can_view_financial_periods"]}>
      <div className="space-y-6">
        {/* Header Banner */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 p-8 text-white shadow-lg">
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
                  <CalendarDays className="h-5 w-5 text-cyan-100" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight">Financial Periods</h1>
              </div>
              <p className="text-cyan-100 max-w-xl text-sm">
                Manage your accounting periods. Open, close, and lock periods to control when transactions can be posted.
              </p>
            </div>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-cyan-700 hover:bg-cyan-800 text-white border-0 shadow-sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Period
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Create Financial Period</DialogTitle>
                  <DialogDescription>
                    Define a new financial period for your organization.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., January 2026"
                    />
                  </div>
                  <div>
                    <Label htmlFor="period_type">Period Type</Label>
                    <Select
                      value={formData.period_type}
                      onValueChange={(value) => setFormData({ ...formData, period_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="semi_annual">Semi-Annual</SelectItem>
                        <SelectItem value="annual">Annual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="start_date">Start Date</Label>
                      <Input
                        id="start_date"
                        type="date"
                        value={formData.start_date}
                        onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="end_date">End Date</Label>
                      <Input
                        id="end_date"
                        type="date"
                        value={formData.end_date}
                        onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="description">Description (Optional)</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Optional notes about this period"
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreatePeriod}
                    disabled={saving || !formData.name || !formData.start_date || !formData.end_date}
                  >
                    {saving ? "Creating..." : "Create Period"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Filters */}
        <Card className="border-slate-200 shadow-sm">
          <div className="p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center bg-slate-50/50">
            <div className="flex gap-2">
              <Select value={yearFilter} onValueChange={setYearFilter}>
                <SelectTrigger className="w-[130px] bg-white">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px] bg-white">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* Periods Table */}
        <Card>
          <CardHeader>
            <CardTitle>Periods ({periods.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">S/No</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Current</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {periods.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No financial periods found. Create your first period to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  periods.map((period, index) => (
                    <TableRow key={period.id}>
                      <TableCell className="font-medium text-muted-foreground">
                        {index + 1}
                      </TableCell>
                      <TableCell className="font-medium">{period.name}</TableCell>
                      <TableCell>
                        <Badge className={PERIOD_TYPE_STYLES[period.period_type] || "bg-gray-50 text-gray-600"}>
                          {PERIOD_TYPE_LABELS[period.period_type] || period.period_type}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(period.start_date)}</TableCell>
                      <TableCell>{formatDate(period.end_date)}</TableCell>
                      <TableCell>
                        <Badge className={STATUS_STYLES[period.status] || "bg-gray-100 text-gray-600"}>
                          {period.status === "open" && <Unlock className="h-3 w-3 mr-1" />}
                          {period.status === "closed" && <Lock className="h-3 w-3 mr-1" />}
                          {period.status.charAt(0).toUpperCase() + period.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {period.is_current ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {period.status === "open" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => setConfirmAction({ type: "close", period })}
                          >
                            <Lock className="h-3.5 w-3.5 mr-1" />
                            Close
                          </Button>
                        )}
                        {period.status === "closed" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => setConfirmAction({ type: "reopen", period })}
                          >
                            <Unlock className="h-3.5 w-3.5 mr-1" />
                            Reopen
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Confirmation Dialog */}
        <Dialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>
                {confirmAction?.type === "close" ? "Close Period" : "Reopen Period"}
              </DialogTitle>
              <DialogDescription>
                {confirmAction?.type === "close"
                  ? `Are you sure you want to close "${confirmAction?.period.name}"? No new transactions can be posted to a closed period.`
                  : `Are you sure you want to reopen "${confirmAction?.period.name}"? This will allow new transactions to be posted again.`}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmAction(null)} disabled={actionLoading}>
                Cancel
              </Button>
              <Button
                variant={confirmAction?.type === "close" ? "destructive" : "default"}
                onClick={() => {
                  if (!confirmAction) return
                  if (confirmAction.type === "close") {
                    handleClosePeriod(confirmAction.period)
                  } else {
                    handleReopenPeriod(confirmAction.period)
                  }
                }}
                disabled={actionLoading}
              >
                {actionLoading
                  ? confirmAction?.type === "close"
                    ? "Closing..."
                    : "Reopening..."
                  : confirmAction?.type === "close"
                    ? "Close Period"
                    : "Reopen Period"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PermissionGuard>
  )
}
