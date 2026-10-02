"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowLeft, Loader2, CheckCircle, XCircle, Edit, Trash2, Package } from "lucide-react"
import { 
  getStockAdjustment, 
  getStockAdjustmentActivitiesById,
  type StockAdjustment,
  type StockAdjustmentActivity,
  type StockAdjustmentItem,
  getStatusColor,
  getReasonTypeLabel,
  getAdjustmentTypeLabel,
  formatCurrency,
  canEditAdjustment,
  canDeleteAdjustment,
  canSubmitAdjustment,
  canApproveAdjustment,
  canApplyAdjustment
} from "@/lib/stock-adjustments"
import { useToast } from "@/hooks/use-toast"
import { usePermissions } from "@/hooks/use-permissions"
import { PermissionGuard } from "@/components/PermissionGuard"
import { format } from "date-fns"
import Image from "next/image"
import { EditStockAdjustmentSheet } from "../components/edit-stock-adjustment-sheet"
import { ApproveAdjustmentDialog } from "../components/approve-adjustment-dialog"
import { RejectAdjustmentDialog } from "../components/reject-adjustment-dialog"
import { DeleteAdjustmentDialog } from "../components/delete-adjustment-dialog"
import { applyStockAdjustmentAction, submitStockAdjustmentAction } from "../actions"

export default function StockAdjustmentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const { hasPermission } = usePermissions()
  
  const [adjustment, setAdjustment] = useState<StockAdjustment | null>(null)
  const [activities, setActivities] = useState<StockAdjustmentActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false)
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false)
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const id = params.id as string

  useEffect(() => {
    fetchAdjustmentDetails()
  }, [id])

  const fetchAdjustmentDetails = async () => {
    try {
      setLoading(true)
      const [adjustmentData, activitiesData] = await Promise.all([
        getStockAdjustment(id, true),
        getStockAdjustmentActivitiesById(id, true),
      ])
      setAdjustment(adjustmentData)
      setActivities(activitiesData.activities)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load adjustment details",
        variant: "destructive",
      })
      router.push("/inventory/stock-adjustments")
    } finally {
      setLoading(false)
    }
  }

  const handleApply = async () => {
    if (!adjustment) return

    setIsApplying(true)
    try {
      const result = await applyStockAdjustmentAction(adjustment.id)
      if (result.success) {
        toast({
          title: "Success",
          description: "Stock adjustment applied successfully",
        })
        fetchAdjustmentDetails()
      } else {
        throw new Error(result.message)
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to apply adjustment",
        variant: "destructive",
      })
    } finally {
      setIsApplying(false)
    }
  }

  const handleSubmit = async () => {
    if (!adjustment) return

    setIsSubmitting(true)
    try {
      const result = await submitStockAdjustmentAction(adjustment.id)
      if (result.success) {
        toast({
          title: "Success",
          description: "Stock adjustment submitted for approval",
        })
        fetchAdjustmentDetails()
      } else {
        throw new Error(result.message)
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to submit adjustment",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const normalizeImageUrl = (url: string | undefined | null): string => {
    if (!url) return "/placeholder.svg"
    if (url.startsWith("http")) return url
    if (url.startsWith("/")) return url
    return `/${url}`
  }

  if (loading) {
    return (
      <PermissionGuard permissions={["can_view_products", "can_manage_system", "can_manage_company"]}>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </PermissionGuard>
    )
  }

  if (!adjustment) {
    return null
  }

  return (
    <PermissionGuard permissions={["can_view_products", "can_manage_system", "can_manage_company"]}>
      <div className="container mx-auto p-6 space-y-6 max-w-7xl">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold text-gray-900">
                  {adjustment.adjustment_number}
                </h1>
                <Badge className={getStatusColor(adjustment.status)}>
                  {adjustment.status.charAt(0).toUpperCase() + adjustment.status.slice(1)}
                </Badge>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                Stock Adjustment Details
              </p>
            </div>
          </div>
          
          {/* Actions Bar */}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {canEditAdjustment(adjustment.status) && hasPermission("can_update_products") && (
              <Button size="sm" variant="outline" onClick={() => setIsEditSheetOpen(true)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            )}
            {canSubmitAdjustment(adjustment.status) && hasPermission("can_update_products") && (
              <Button size="sm" onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Submit for Approval
              </Button>
            )}
            {canDeleteAdjustment(adjustment.status) && hasPermission("can_delete_products") && (
              <Button size="sm" variant="destructive" onClick={() => setIsDeleteDialogOpen(true)}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
            {canApproveAdjustment(adjustment.status) && hasPermission("can_approve_adjustments") && (
              <>
                <Button size="sm" onClick={() => setIsApproveDialogOpen(true)}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve
                </Button>
                <Button size="sm" variant="outline" onClick={() => setIsRejectDialogOpen(true)}>
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </Button>
              </>
            )}
            {canApplyAdjustment(adjustment.status) && hasPermission("can_update_products") && (
              <Button size="sm" onClick={handleApply} disabled={isApplying}>
                {isApplying && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <CheckCircle className="h-4 w-4 mr-2" />
                Apply to Inventory
              </Button>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* Adjustment Details */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Adjustment Information</CardTitle>
              <CardDescription>
                {adjustment.items && adjustment.items.length > 0 
                  ? `Bulk adjustment with ${adjustment.total_items || adjustment.items.length} item(s)`
                  : "Single product adjustment"
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Summary Section */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <h4 className="text-xs font-medium text-muted-foreground mb-1">Type</h4>
                  <Badge variant={adjustment.adjustment_type === "increase" ? "default" : adjustment.adjustment_type === "decrease" ? "destructive" : "secondary"}>
                    {getAdjustmentTypeLabel(adjustment.adjustment_type)}
                  </Badge>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <h4 className="text-xs font-medium text-muted-foreground mb-1">Reason</h4>
                  <p className="font-medium text-sm">{getReasonTypeLabel(adjustment.reason_type)}</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <h4 className="text-xs font-medium text-muted-foreground mb-1">Total Items</h4>
                  <p className="font-medium text-sm">{adjustment.total_items || (adjustment.items?.length || 1)}</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <h4 className="text-xs font-medium text-muted-foreground mb-1">Total Qty Adjusted</h4>
                  <p className={`font-medium text-sm ${(adjustment.total_quantity_adjusted || adjustment.quantity_adjusted || 0) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {((adjustment.total_quantity_adjusted || adjustment.quantity_adjusted || 0) > 0 ? '+' : '')}{adjustment.total_quantity_adjusted || adjustment.quantity_adjusted || 0}
                  </p>
                </div>
              </div>

              <Separator />

              {/* Single Product Display (legacy adjustments) */}
              {adjustment.product && (
                <>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Product</h4>
                    <div className="flex items-center gap-3">
                      <Image
                        src={normalizeImageUrl(adjustment.product.primary_image_url)}
                        alt={adjustment.product.name}
                        width={50}
                        height={50}
                        className="rounded object-cover"
                      />
                      <div>
                        <p className="font-medium">{adjustment.product.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {adjustment.variant ? adjustment.variant.name : (adjustment.product.sku || adjustment.product.product_code)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">Quantity Before</h4>
                      <p className="font-medium">{adjustment.quantity_before}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">Adjusted By</h4>
                      <p className={`font-medium ${(adjustment.quantity_adjusted || 0) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {(adjustment.quantity_adjusted || 0) > 0 ? '+' : ''}{adjustment.quantity_adjusted}
                      </p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">Quantity After</h4>
                      <p className="font-medium">{adjustment.quantity_after}</p>
                    </div>
                  </div>

                  <Separator />
                </>
              )}

              {/* Items Table (bulk adjustments) */}
              {adjustment.items && adjustment.items.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-3">Adjustment Items</h4>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">Before</TableHead>
                          <TableHead className="text-right">Adjusted</TableHead>
                          <TableHead className="text-right">After</TableHead>
                          <TableHead className="text-right">Value</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {adjustment.items.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Image
                                  src={normalizeImageUrl(item.product?.primary_image_url)}
                                  alt={item.product?.name || "Product"}
                                  width={36}
                                  height={36}
                                  className="rounded object-cover"
                                />
                                <div>
                                  <p className="font-medium text-sm">{item.product?.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {item.variant ? item.variant.name : (item.product?.sku || item.product?.product_code)}
                                  </p>
                                  {item.notes && (
                                    <p className="text-xs text-muted-foreground italic">{item.notes}</p>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={item.adjustment_type === "increase" ? "default" : item.adjustment_type === "decrease" ? "destructive" : "secondary"} className="text-xs">
                                {getAdjustmentTypeLabel(item.adjustment_type)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {item.quantity_before ?? "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              <span className={`font-mono text-sm ${item.quantity_adjusted < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {item.quantity_adjusted > 0 ? '+' : ''}{item.quantity_adjusted}
                              </span>
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {item.quantity_after ?? "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              <span className={`text-sm ${parseFloat(item.total_value || "0") < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {formatCurrency(item.total_value || "0")}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge variant={item.item_status === "completed" ? "default" : item.item_status === "failed" ? "destructive" : "secondary"} className="text-xs">
                                {item.item_status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Financial Summary */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Total Cost Impact</h4>
                  <p className={`text-lg font-semibold ${parseFloat(adjustment.total_cost) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(adjustment.total_cost)}
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Total Value Impact</h4>
                  <p className={`text-lg font-semibold ${parseFloat(adjustment.total_value) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(adjustment.total_value)}
                  </p>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Reason</h4>
                <p className="text-sm">{adjustment.reason}</p>
              </div>

              {adjustment.notes && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Notes</h4>
                  <p className="text-sm">{adjustment.notes}</p>
                </div>
              )}

              {adjustment.rejection_reason && (
                <div>
                  <h4 className="text-sm font-medium text-red-600 mb-1">Rejection Reason</h4>
                  <p className="text-sm text-red-600">{adjustment.rejection_reason}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Approval & Tracking Details */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Tracking Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {adjustment.store && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Store</h4>
                    <p className="font-medium">{adjustment.store.name}</p>
                  </div>
                )}

                <Separator />

                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Created By</h4>
                  <p className="font-medium">{adjustment.created_by.full_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(adjustment.created_at), "MMM dd, yyyy 'at' hh:mm a")}
                  </p>
                </div>

                {adjustment.approved_by && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Approved By</h4>
                    <p className="font-medium">{adjustment.approved_by.full_name}</p>
                    {adjustment.approved_at && (
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(adjustment.approved_at), "MMM dd, yyyy 'at' hh:mm a")}
                      </p>
                    )}
                  </div>
                )}

                {adjustment.rejected_by && (
                  <div>
                    <h4 className="text-sm font-medium text-red-600 mb-1">Rejected By</h4>
                    <p className="font-medium">{adjustment.rejected_by.full_name}</p>
                    {adjustment.rejected_at && (
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(adjustment.rejected_at), "MMM dd, yyyy 'at' hh:mm a")}
                      </p>
                    )}
                  </div>
                )}

                {adjustment.inventory_movement_id && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Inventory Movement ID</h4>
                    <p className="font-mono text-sm">{adjustment.inventory_movement_id}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Activity Timeline */}
            <Card>
              <CardHeader>
                <CardTitle>Activity History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {activities.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No activities recorded</p>
                  ) : (
                    activities.map((activity) => (
                      <div key={activity.id} className="flex gap-3">
                        <div className="mt-1">
                          <div className="h-2 w-2 rounded-full bg-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{activity.description}</p>
                          <div className="text-xs text-muted-foreground mt-1">
                            {activity.user.full_name} •{" "}
                            {format(new Date(activity.created_at), "MMM dd, yyyy 'at' hh:mm a")}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Dialogs and Sheets */}
      <EditStockAdjustmentSheet
        open={isEditSheetOpen}
        onOpenChange={setIsEditSheetOpen}
        adjustment={adjustment}
        onSuccess={fetchAdjustmentDetails}
      />

      <ApproveAdjustmentDialog
        open={isApproveDialogOpen}
        onOpenChange={setIsApproveDialogOpen}
        adjustment={adjustment}
        onSuccess={fetchAdjustmentDetails}
      />

      <RejectAdjustmentDialog
        open={isRejectDialogOpen}
        onOpenChange={setIsRejectDialogOpen}
        adjustment={adjustment}
        onSuccess={fetchAdjustmentDetails}
      />

      <DeleteAdjustmentDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        adjustment={adjustment}
        onSuccess={() => router.push("/inventory/stock-adjustments")}
      />
    </PermissionGuard>
  )
}
