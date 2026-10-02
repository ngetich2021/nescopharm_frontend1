"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import {
  X,
  Calendar,
  User,
  MapPin,
  Package,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  FileText,
  BarChart3,
  ClipboardList,
  CheckCircle,
  Clock,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import type { StockCountDetails } from "@/types/stock-counts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"

interface StockCountDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  stockCountId: string | null
}

export function StockCountDetailsModal({ isOpen, onClose, stockCountId }: StockCountDetailsModalProps) {
  const { toast } = useToast()
  const [isVisible, setIsVisible] = useState(false)
  const [details, setDetails] = useState<StockCountDetails | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Animation control
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true)
      if (stockCountId) {
        fetchStockCountDetails(stockCountId)
      }
    } else {
      const timer = setTimeout(() => setIsVisible(false), 300)
      return () => clearTimeout(timer)
    }
  }, [isOpen, stockCountId])

  const fetchStockCountDetails = async (id: string) => {
    setLoading(true)
    setError(null)

    try {
      // Simulate API call for now
      // In production, replace with actual API call to fetch stock count details
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Mock data for demonstration
      const mockDetails: StockCountDetails = {
        overview: {
          id: id,
          company_id: "company-123",
          store_id: "store-456",
          count_number: "SC-" + id.substring(0, 6),
          name: "Monthly Inventory Count - " + new Date().toLocaleDateString(),
          count_type: "cycle_count",
          status: "in_progress",
          location: "Main Warehouse",
          scheduled_date: new Date().toISOString(),
          created_by: "John Doe",
          assigned_to: "Jane Smith",
          total_products_expected: 120,
          total_products_counted: 85,
          total_variances: 12,
          total_variance_value: -450.75,
          completion_percentage: 70.83,
          created_at: new Date(Date.now() - 86400000).toISOString(),
          updated_at: new Date().toISOString(),
        },
        variances: [
          {
            company_id: "company-123",
            store_id: "store-456",
            count_number: "SC-" + id.substring(0, 6),
            stock_count_name: "Monthly Inventory Count",
            product_name: "Wireless Headphones",
            product_sku: "WH-100-BLK",
            product_category: "Electronics",
            expected_quantity: 25,
            counted_quantity: 22,
            variance_quantity: -3,
            variance_value: -149.97,
            unit_cost: 49.99,
            counted_by: "Jane Smith",
            counted_at: new Date().toISOString(),
            notes: "Found some units in the returns area",
          },
          {
            company_id: "company-123",
            store_id: "store-456",
            count_number: "SC-" + id.substring(0, 6),
            stock_count_name: "Monthly Inventory Count",
            product_name: "USB-C Cable",
            product_sku: "USBC-01",
            product_category: "Accessories",
            expected_quantity: 50,
            counted_quantity: 45,
            variance_quantity: -5,
            variance_value: -74.95,
            unit_cost: 14.99,
            counted_by: "Jane Smith",
            counted_at: new Date().toISOString(),
            notes: null,
          },
          {
            company_id: "company-123",
            store_id: "store-456",
            count_number: "SC-" + id.substring(0, 6),
            stock_count_name: "Monthly Inventory Count",
            product_name: "Bluetooth Speaker",
            product_sku: "BS-200-RED",
            product_category: "Electronics",
            expected_quantity: 15,
            counted_quantity: 18,
            variance_quantity: 3,
            variance_value: 209.97,
            unit_cost: 69.99,
            counted_by: "Jane Smith",
            counted_at: new Date().toISOString(),
            notes: "Found additional units in the storage room",
          },
        ],
        full_details: {
          id: id,
          company_id: "company-123",
          store_id: "store-456",
          count_number: "SC-" + id.substring(0, 6),
          name: "Monthly Inventory Count - " + new Date().toLocaleDateString(),
          description: "Regular cycle count for the main warehouse focusing on electronics and accessories.",
          count_type: "cycle_count",
          status: "in_progress",
          location: "Main Warehouse",
          category_filter: "Electronics, Accessories",
          scheduled_date: new Date().toISOString(),
          started_at: new Date(Date.now() - 3600000).toISOString(),
          completed_at: null,
          approved_at: null,
          created_by: "John Doe",
          assigned_to: "Jane Smith",
          approved_by: null,
          total_products_expected: 120,
          total_products_counted: 85,
          total_variances: 12,
          total_variance_value: -450.75,
          created_at: new Date(Date.now() - 86400000).toISOString(),
          updated_at: new Date().toISOString(),
        },
      }

      mockDetails.overview.total_variance_value = -450.75
      mockDetails.variances[0].variance_value = -149.97
      mockDetails.variances[1].variance_value = -74.95
      mockDetails.variances[2].variance_value = 209.97

      setDetails(mockDetails)
    } catch (err) {
      setError("Failed to load stock count details")
      toast({
        title: "Error",
        description: "Failed to load stock count details",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case "draft":
        return "border-yellow-500 text-yellow-500 bg-yellow-50"
      case "in_progress":
        return "border-blue-500 text-blue-500 bg-blue-50"
      case "completed":
        return "border-green-500 text-green-500 bg-green-50"
      case "approved":
        return "border-purple-500 text-purple-500 bg-purple-50"
      case "cancelled":
        return "border-red-500 text-red-500 bg-red-50"
      default:
        return ""
    }
  }

  const formatStatusLabel = (status: string) => {
    switch (status) {
      case "in_progress":
        return "In Progress"
      default:
        return status.charAt(0).toUpperCase() + status.slice(1)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value).replace('KES', 'Ksh.')
  }

  if (!isVisible) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-black/50 z-50 transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0",
        )}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={cn(
          "fixed top-0 right-0 h-full w-full max-w-4xl bg-white shadow-2xl z-50 transition-transform duration-300 ease-in-out flex flex-col",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <ClipboardList className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Stock Count Details</h2>
              <p className="text-sm text-gray-500">View stock count information and variances</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="hover:bg-gray-100">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-6 space-y-6">
            {loading ? (
              <div className="space-y-6">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-64 w-full" />
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                  <p className="text-lg font-medium text-gray-900 mb-2">Error Loading Details</p>
                  <p className="text-gray-600">{error}</p>
                  <Button onClick={() => stockCountId && fetchStockCountDetails(stockCountId)} className="mt-4">
                    Try Again
                  </Button>
                </div>
              </div>
            ) : details ? (
              <>
                {/* Header Information */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">{details.overview.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">#{details.overview.count_number}</p>
                      </div>
                      <Badge variant="outline" className={cn(getStatusBadgeStyle(details.overview.status))}>
                        {formatStatusLabel(details.overview.status)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="flex items-center space-x-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">Location</p>
                          <p className="text-sm text-muted-foreground">
                            {details.overview.location || "Not specified"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">Created By</p>
                          <p className="text-sm text-muted-foreground">{details.overview.created_by}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">Scheduled</p>
                          <p className="text-sm text-muted-foreground">
                            {details.overview.scheduled_date
                              ? format(new Date(details.overview.scheduled_date), "MMM d, yyyy")
                              : "Not scheduled"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">Type</p>
                          <p className="text-sm text-muted-foreground capitalize">
                            {details.overview.count_type.replace("_", " ")}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Progress Overview */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <BarChart3 className="h-5 w-5" />
                      <span>Progress Overview</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span>Completion Progress</span>
                          <span>{details.overview.completion_percentage}%</span>
                        </div>
                        <Progress value={details.overview.completion_percentage} className="h-2" />
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center p-3 bg-blue-50 rounded-lg">
                          <div className="text-2xl font-bold text-blue-600">
                            {details.overview.total_products_expected}
                          </div>
                          <div className="text-sm text-blue-600">Expected</div>
                        </div>
                        <div className="text-center p-3 bg-green-50 rounded-lg">
                          <div className="text-2xl font-bold text-green-600">
                            {details.overview.total_products_counted}
                          </div>
                          <div className="text-sm text-green-600">Counted</div>
                        </div>
                        <div className="text-center p-3 bg-red-50 rounded-lg">
                          <div className="text-2xl font-bold text-red-600">{details.overview.total_variances}</div>
                          <div className="text-sm text-red-600">Variances</div>
                        </div>
                        <div className="text-center p-3 bg-purple-50 rounded-lg">
                          <div className="text-2xl font-bold text-purple-600">
                            {formatCurrency(details.overview.total_variance_value)}
                          </div>
                          <div className="text-sm text-purple-600">Variance Value</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Variances Table */}
                {details.variances.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <AlertTriangle className="h-5 w-5 text-red-500" />
                        <span>Variances ({details.variances.length})</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Product</TableHead>
                              <TableHead>SKU</TableHead>
                              <TableHead>Category</TableHead>
                              <TableHead className="text-right">Expected</TableHead>
                              <TableHead className="text-right">Counted</TableHead>
                              <TableHead className="text-right">Variance</TableHead>
                              <TableHead className="text-right">Value Impact</TableHead>
                              <TableHead>Counted By</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {details.variances.map((variance, index) => (
                              <TableRow key={index}>
                                <TableCell className="font-medium">{variance.product_name}</TableCell>
                                <TableCell>{variance.product_sku}</TableCell>
                                <TableCell>{variance.product_category || "-"}</TableCell>
                                <TableCell className="text-right">{variance.expected_quantity}</TableCell>
                                <TableCell className="text-right">{variance.counted_quantity}</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end space-x-1">
                                    {variance.variance_quantity > 0 ? (
                                      <TrendingUp className="h-4 w-4 text-green-500" />
                                    ) : (
                                      <TrendingDown className="h-4 w-4 text-red-500" />
                                    )}
                                    <span
                                      className={variance.variance_quantity > 0 ? "text-green-600" : "text-red-600"}
                                    >
                                      {variance.variance_quantity > 0 ? "+" : ""}
                                      {variance.variance_quantity}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">
                                  <span className={variance.variance_value > 0 ? "text-green-600" : "text-red-600"}>
                                    {formatCurrency(variance.variance_value)}
                                  </span>
                                </TableCell>
                                <TableCell>{variance.counted_by || "-"}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Additional Details */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <FileText className="h-5 w-5" />
                      <span>Additional Information</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-medium mb-2">Timeline</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            <span>
                              Created: {format(new Date(details.full_details.created_at), "MMM d, yyyy 'at' h:mm a")}
                            </span>
                          </div>
                          {details.full_details.started_at && (
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                              <span>
                                Started: {format(new Date(details.full_details.started_at), "MMM d, yyyy 'at' h:mm a")}
                              </span>
                            </div>
                          )}
                          {details.full_details.completed_at && (
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              <span>
                                Completed:{" "}
                                {format(new Date(details.full_details.completed_at), "MMM d, yyyy 'at' h:mm a")}
                              </span>
                            </div>
                          )}
                          {details.full_details.approved_at && (
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                              <span>
                                Approved:{" "}
                                {format(new Date(details.full_details.approved_at), "MMM d, yyyy 'at' h:mm a")}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <h4 className="font-medium mb-2">Assignment</h4>
                        <div className="space-y-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">Assigned to: </span>
                            <span>{details.full_details.assigned_to || "Not assigned"}</span>
                          </div>
                          {details.full_details.approved_by && (
                            <div>
                              <span className="text-muted-foreground">Approved by: </span>
                              <span>{details.full_details.approved_by}</span>
                            </div>
                          )}
                          {details.full_details.category_filter && (
                            <div>
                              <span className="text-muted-foreground">Category filter: </span>
                              <span>{details.full_details.category_filter}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {details.full_details.description && (
                      <div className="mt-4">
                        <h4 className="font-medium mb-2">Description</h4>
                        <p className="text-sm text-muted-foreground">{details.full_details.description}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : null}
          </div>
        </ScrollArea>

        {/* Footer Actions */}
        <div className="flex justify-between items-center gap-3 px-6 py-4 border-t bg-gray-50">
          <div className="text-sm text-gray-500">
            {details && (
              <>
                Last updated:{" "}
                <span className="font-medium">
                  {details.full_details.updated_at
                    ? format(new Date(details.full_details.updated_at), "MMM d, yyyy")
                    : "Unknown"}
                </span>
              </>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            {details && details.overview.status === "in_progress" && (
              <Button className="bg-green-600 hover:bg-green-700 text-white">
                <CheckCircle className="mr-2 h-4 w-4" />
                Complete Count
              </Button>
            )}
            {details && details.overview.status === "draft" && (
              <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                <Clock className="mr-2 h-4 w-4" />
                Start Count
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
