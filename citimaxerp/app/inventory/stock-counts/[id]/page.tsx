"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { PermissionGuard } from "@/components/PermissionGuard"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ArrowLeft, Save, CheckCircle, Search, PackagePlus, Trash2 } from "lucide-react"
import { FoundStockDialog, type FoundStock } from "../components/found-stock-dialog"
import { useToast } from "@/hooks/use-toast"
import {
  getStockCountDetails,
  updateStockCount,
  updateStockCountStatus,
  getStatusColor,
  getVarianceColor,
  formatVariance,
} from "@/lib/stock-counts"
import type { StockCount, StockCountItem } from "@/app/types"
import { format } from "date-fns"
import { ExportMenu } from "@/components/export-menu"
import { TablePager, usePaged } from "@/components/ui/table-pager"
import { exportTable, type ExportFormat } from "@/lib/table-export"
import { useOptionalAuth } from "@/lib/auth-context"
import { documentFileName } from "@/lib/document-names"

export default function StockCountDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [stockCount, setStockCount] = useState<StockCount | null>(null)
  const company = useOptionalAuth()?.userProfile?.company
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [items, setItems] = useState<StockCountItem[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [showApproveDialog, setShowApproveDialog] = useState(false)
  const [showCompleteDialog, setShowCompleteDialog] = useState(false)
  const [showFoundDialog, setShowFoundDialog] = useState(false)

  useEffect(() => {
    fetchStockCount()
  }, [params.id])

  const fetchStockCount = async () => {
    try {
      setLoading(true)
      const data = await getStockCountDetails(params.id as string)
      setStockCount(data)
      setItems(data?.items || [])
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch stock count details",
        variant: "destructive",
      })
      router.push("/inventory/stock-counts")
    } finally {
      setLoading(false)
    }
  }

  const handleCountedQuantityChange = (itemId: string, value: string) => {
    const quantity = parseInt(value) || 0
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              counted_quantity: quantity,
              is_counted: true,
            }
          : item
      )
    )
  }

  const handleNotesChange = (itemId: string, value: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, notes: value } : item))
    )
  }

  // Stock found that is on no line: added as its own line with the batch number on the pack.
  const handleAddFound = (found: FoundStock) => {
    setItems((prev) => [...prev, {
      id: `found-${Date.now()}`,
      product_id: found.product_id,
      variant_id: found.variant_id,
      product_name: found.product_name,
      product_sku: null,
      product_category: null,
      batch_id: null,
      batch_number: found.batch_number,
      expiry_date: found.expiry_date,
      manufacture_date: found.manufacture_date ?? null,
      is_new_batch: true,
      expected_quantity: 0,
      counted_quantity: found.counted_quantity,
      is_counted: true,
      notes: found.existing_batch ? "Found - existing batch" : "Found - new batch",
      variance_value: null,
    } as unknown as StockCountItem])
  }

  const handleRemoveItem = (itemId: string) => setItems((prev) => prev.filter((i) => i.id !== itemId))

  const handleSaveItems = async () => {
    try {
      setSaving(true)
      const updatedItems = items.map((item) => ({
        // Lines added here have no id yet; the server creates them.
        ...(item.id.startsWith("found-") ? {} : { id: item.id }),
        product_id: item.product_id,
        variant_id: item.variant_id ?? null,
        batch_id: item.batch_id ?? null,
        batch_number: item.batch_number ?? null,
        expiry_date: item.expiry_date ?? null,
        manufacture_date: item.manufacture_date ?? null,
        is_new_batch: !!item.is_new_batch,
        expected_quantity: item.expected_quantity,
        counted_quantity: item.counted_quantity ?? null,
        is_counted: item.is_counted || false,
        notes: item.notes || "",
      }))

      await updateStockCount(params.id as string, { items: updatedItems })
      
      toast({
        title: "Success",
        description: "Stock count items updated successfully",
      })
      
      fetchStockCount()
    } catch (error: any) {
      console.error("Failed to update stock count:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to update stock count items",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleStartCount = async () => {
    try {
      await updateStockCountStatus(params.id as string, "in_progress", {
        started_at: new Date().toISOString(),
      })
      toast({
        title: "Success",
        description: "Stock count started",
      })
      fetchStockCount()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to start stock count",
        variant: "destructive",
      })
    }
  }

  const handleCompleteCount = async () => {
    try {
      await updateStockCountStatus(params.id as string, "completed", {
        completed_at: new Date().toISOString(),
      })
      toast({
        title: "Success",
        description: "Stock count completed",
      })
      setShowCompleteDialog(false)
      fetchStockCount()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to complete stock count",
        variant: "destructive",
      })
    }
  }

  const handleApproveCount = async () => {
    try {
      await updateStockCountStatus(params.id as string, "approved", {
        approved_at: new Date().toISOString(),
      })
      toast({
        title: "Success",
        description: "Stock count approved. Inventory has been updated.",
      })
      setShowApproveDialog(false)
      fetchStockCount()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to approve stock count",
        variant: "destructive",
      })
    }
  }

  // Search: every word typed, in any order, ignoring spaces and marks - "syringe 20ml" finds
  // "Disposable Syringes Without Needles 20ml"; batch numbers and SKUs match too.
  const loose = (v: string) => v.toLowerCase().replace(/[^a-z0-9.]/g, "")
  const words = searchQuery.toLowerCase().split(/\s+/).map(loose).filter(Boolean)
  const filteredItems = words.length === 0 ? items : items.filter((item) => {
    const text = loose(`${item.product_name} ${item.batch_number ?? ""} ${item.product_sku ?? ""}`)
    return words.every((w) => text.includes(w))
  })
  const paged = usePaged(filteredItems, 20, searchQuery)

  if (loading) {
    return (
      <PermissionGuard permissions={["can_view_stock_counts_menu"]}>
        <div className="container mx-auto px-4 py-8">
          <p className="text-center text-muted-foreground">Loading stock count...</p>
        </div>
      </PermissionGuard>
    )
  }

  if (!stockCount) {
    return null
  }

  const canEdit = stockCount.status === "draft" || stockCount.status === "in_progress"
  const canComplete = stockCount.status === "in_progress"
  const canApprove = stockCount.status === "completed"


  // Export the lines shown (following the search) for tracking: Excel / PDF / CSV, logo-headed.
  const handleExport = async (fmt: ExportFormat) => {
    const d = (v?: string | null) => (v ? format(new Date(v), "dd/MM/yyyy") : "")
    const lineStatus = (i: StockCountItem) =>
      i.is_new_batch ? "Found" : i.counted_quantity === null || i.counted_quantity === undefined ? "Not counted" : "Counted"
    const counted = filteredItems.filter((i) => i.counted_quantity !== null && i.counted_quantity !== undefined)
    const sum = (f: (i: StockCountItem) => number) => filteredItems.reduce((s, i) => s + f(i), 0)
    await exportTable(fmt, {
      fileName: documentFileName([stockCount.count_number, stockCount.name, "Stock Count"]),
      title: "Stock Count",
      subtitle: `${stockCount.name} (${stockCount.count_number})`,
      details: [
        ["Store", stockCount.store?.name || "-"],
        ["Status", stockCount.status.replace(/_/g, " ")],
        ["Lines counted", `${counted.length} of ${filteredItems.length}`],
        ["Exported", format(new Date(), "dd/MM/yyyy HH:mm")],
      ],
      headers: ["S/No", "Product", "Batch", "Mfg. Date", "Expiry", "Expected", "Counted", "Variance", "Value (KSh)", "Status", "Notes"],
      moneyColumns: [8],
      rows: filteredItems.map((i, n) => {
        const hasCount = i.counted_quantity !== null && i.counted_quantity !== undefined
        return [
          n + 1,
          i.product_name,
          i.batch_number || "No batch",
          d(i.manufacture_date),
          d(i.expiry_date),
          i.expected_quantity,
          hasCount ? i.counted_quantity : "",
          hasCount ? (i.counted_quantity as number) - i.expected_quantity : "",
          i.variance_value ? parseFloat(String(i.variance_value)) : "",
          lineStatus(i),
          i.notes || "",
        ]
      }),
      footer: [["", "Total", "", "", "",
        sum((i) => i.expected_quantity),
        counted.reduce((s, i) => s + (i.counted_quantity as number), 0),
        counted.reduce((s, i) => s + (i.counted_quantity as number) - i.expected_quantity, 0),
        sum((i) => (i.variance_value ? parseFloat(String(i.variance_value)) : 0)),
        "", ""]],
    }, company)
  }

  return (
    <PermissionGuard permissions={["can_view_stock_counts_menu"]}>
      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/inventory/stock-counts")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{stockCount.name}</h1>
              <Badge className={getStatusColor(stockCount.status)}>
                {stockCount.status.replace("_", " ")}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{stockCount.count_number}</p>
          </div>
          <div className="flex gap-2">
            {stockCount.status === "draft" && (
              <Button onClick={handleStartCount}>Start Count</Button>
            )}
            {canEdit && (
              <Button onClick={handleSaveItems} disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            )}
            {canComplete && (
              <Button onClick={() => setShowCompleteDialog(true)} variant="default">
                <CheckCircle className="mr-2 h-4 w-4" />
                Complete
              </Button>
            )}
            {canApprove && (
              <Button onClick={() => setShowApproveDialog(true)} variant="default">
                <CheckCircle className="mr-2 h-4 w-4" />
                Approve
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-6 mb-6 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Products</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stockCount.total_products_expected}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Products Counted</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stockCount.total_products_counted}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Variances</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stockCount.total_variances}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Variance Value</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                KSh {parseFloat(stockCount.total_variance_value).toFixed(2)}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Type</p>
                <p className="capitalize">{stockCount.count_type.replace("_", " ")}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Location</p>
                <p>{stockCount.location || "-"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Store</p>
                <p>{stockCount.store?.name || "-"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Created</p>
                <p>{format(new Date(stockCount.created_at), "dd/MM/yyyy")}</p>
              </div>
              {stockCount.started_at && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Started</p>
                  <p>{format(new Date(stockCount.started_at), "dd/MM/yyyy HH:mm")}</p>
                </div>
              )}
              {stockCount.completed_at && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Completed</p>
                  <p>{format(new Date(stockCount.completed_at), "dd/MM/yyyy HH:mm")}</p>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-muted-foreground">Created By</p>
                <p>{stockCount.creator?.full_name || stockCount.created_by || "System"}</p>
              </div>
              {stockCount.assigned_user && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Assigned To</p>
                  <p>{stockCount.assigned_user.full_name}</p>
                </div>
              )}
              {stockCount.approver && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Approved By</p>
                  <p>{stockCount.approver.full_name}</p>
                </div>
              )}
            </div>
            {stockCount.description && (
              <div className="mt-4">
                <p className="text-sm font-medium text-muted-foreground">Description</p>
                <p>{stockCount.description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Items</CardTitle>
              <div className="flex items-center gap-2">
                <ExportMenu onExport={handleExport} size="sm" />
                {canEdit && (
                  <Button variant="outline" size="sm" onClick={() => setShowFoundDialog(true)}>
                    <PackagePlus className="mr-2 h-4 w-4" /> Add found stock
                  </Button>
                )}
              <div className="relative w-64">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  className="pl-8"
                  placeholder="Search products or batches..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">S/No</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead>Mfg. Date</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead className="text-right">Expected</TableHead>
                    <TableHead className="text-right">Counted</TableHead>
                    <TableHead className="text-right">Variance</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.pageRows.map((item, index) => {
                    const variance = item.counted_quantity !== null
                      ? item.counted_quantity - item.expected_quantity
                      : null

                    return (
                      <TableRow key={item.id}>
                        <TableCell className="text-muted-foreground">{paged.start + index + 1}</TableCell>
                        <TableCell className="font-medium">
                          {item.product_name}
                          {item.is_new_batch && (
                            <Badge variant="outline" className="ml-2 border-amber-300 bg-amber-50 text-[10px] text-amber-800">Found</Badge>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{item.batch_number || <span className="text-muted-foreground">No batch</span>}</TableCell>
                        <TableCell className="whitespace-nowrap">{item.manufacture_date ? format(new Date(item.manufacture_date), "dd/MM/yyyy") : "-"}</TableCell>
                        <TableCell className="whitespace-nowrap">{item.expiry_date ? format(new Date(item.expiry_date), "dd/MM/yyyy") : "-"}</TableCell>
                        <TableCell className="text-right">{item.expected_quantity}</TableCell>
                        <TableCell className="text-right">
                          {canEdit ? (
                            <Input
                              type="number"
                              value={item.counted_quantity ?? ""}
                              onChange={(e) =>
                                handleCountedQuantityChange(item.id, e.target.value)
                              }
                              className="w-24 text-right"
                              min="0"
                            />
                          ) : (
                            item.counted_quantity ?? "-"
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {variance !== null && (
                            <Badge className={getVarianceColor(variance)}>
                              {formatVariance(variance)}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.variance_value
                            ? `KSh ${parseFloat(item.variance_value).toFixed(2)}`
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {canEdit ? (
                            <Textarea
                              value={item.notes || ""}
                              onChange={(e) => handleNotesChange(item.id, e.target.value)}
                              className="min-w-[200px]"
                              rows={1}
                            />
                          ) : (
                            item.notes || "-"
                          )}
                        </TableCell>
                        <TableCell>
                          {canEdit && item.is_new_batch && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Remove" onClick={() => handleRemoveItem(item.id)}>
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
            <TablePager {...paged.pager} />
          </CardContent>
        </Card>
      </div>

      <FoundStockDialog open={showFoundDialog} onOpenChange={setShowFoundDialog} onAdd={handleAddFound} />

      <AlertDialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete Stock Count?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the stock count as completed. You can still approve it later to
              update inventory.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleCompleteCount}>Complete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Stock Count?</AlertDialogTitle>
            <AlertDialogDescription>
              Each batch is set to the quantity counted for it, found stock goes into its batch (a new
              batch is created for a new batch number), and every change is recorded as a stock movement.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleApproveCount}
              className="bg-purple-600 hover:bg-purple-700"
            >
              Approve & Update Inventory
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PermissionGuard>
  )
}
