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
import { ArrowLeft, Save, CheckCircle, Search } from "lucide-react"
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

export default function StockCountDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [stockCount, setStockCount] = useState<StockCount | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [items, setItems] = useState<StockCountItem[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [showApproveDialog, setShowApproveDialog] = useState(false)
  const [showCompleteDialog, setShowCompleteDialog] = useState(false)

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

  const handleSaveItems = async () => {
    try {
      setSaving(true)
      const updatedItems = items.map((item) => ({
        id: item.id,
        product_id: item.product_id,
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

  const filteredItems = items.filter(
    (item) =>
      item.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.product_sku && item.product_sku.toLowerCase().includes(searchQuery.toLowerCase()))
  )

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
                <p>{format(new Date(stockCount.created_at), "PPP")}</p>
              </div>
              {stockCount.started_at && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Started</p>
                  <p>{format(new Date(stockCount.started_at), "PPP p")}</p>
                </div>
              )}
              {stockCount.completed_at && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Completed</p>
                  <p>{format(new Date(stockCount.completed_at), "PPP p")}</p>
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
              <div className="relative w-64">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  className="pl-8"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Expected</TableHead>
                    <TableHead className="text-right">Counted</TableHead>
                    <TableHead className="text-right">Variance</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => {
                    const variance = item.counted_quantity !== null 
                      ? item.counted_quantity - item.expected_quantity 
                      : null
                    
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.product_name}</TableCell>
                        <TableCell>{item.product_sku || "-"}</TableCell>
                        <TableCell>{item.product_category || "-"}</TableCell>
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
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

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
              This will update the actual inventory quantities based on the counted values.
              This action cannot be undone.
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
