"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  FileEdit, 
  Clock, 
  CheckCircle, 
  XCircle, 
  TrendingUp, 
  TrendingDown 
} from "lucide-react"
import { StockAdjustmentsTable } from "./stock-adjustments-table"
import { useState, useEffect } from "react"
import { 
  getStockAdjustments, 
  getStockAdjustmentStatistics,
  type StockAdjustment,
  type StockAdjustmentStatistics,
  formatCurrency
} from "@/lib/stock-adjustments"
import { PermissionGuard } from "@/components/PermissionGuard"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"

export default function StockAdjustmentsPage() {
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([])
  const [statistics, setStatistics] = useState<StockAdjustmentStatistics | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)
  const [pagination, setPagination] = useState<{
    current_page: number
    per_page: number
    total: number
    last_page: number
  } | undefined>(undefined)
  const { toast } = useToast()

  // Fetch adjustments on mount and when pagination changes
  useEffect(() => {
    fetchAdjustments()
  }, [currentPage, itemsPerPage])

  // Fetch statistics on mount
  useEffect(() => {
    fetchStatistics()
  }, [])

  const fetchAdjustments = async () => {
    try {
      setLoading(true)
      console.log("Fetching stock adjustments...")
      const result = await getStockAdjustments(
        {
          page: currentPage,
          per_page: itemsPerPage,
          sort_by: "created_at",
          sort_order: "desc"
        },
        true
      )
      console.log("Stock adjustments data received:", result)

      setAdjustments(Array.isArray(result.data) ? result.data : [])
      setPagination(result.pagination)
    } catch (error: any) {
      console.error("Error fetching stock adjustments:", error)
      setAdjustments([])
      toast({
        title: "Error",
        description: error.message || "Failed to load stock adjustments. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchStatistics = async () => {
    try {
      const stats = await getStockAdjustmentStatistics({}, true)
      setStatistics(stats)
    } catch (error: any) {
      console.error("Error fetching statistics:", error)
    }
  }

  // Handle page change
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage)
  }

  // Handle items per page change
  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage)
    setCurrentPage(1)
  }

  // Handle refresh
  const handleRefresh = () => {
    fetchAdjustments()
    fetchStatistics()
  }

  if (loading) {
    return (
      <PermissionGuard
        permissions={["can_view_products", "can_manage_system", "can_manage_company"]}
      >
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </PermissionGuard>
    )
  }

  return (
    <PermissionGuard
      permissions={["can_view_products", "can_manage_system", "can_manage_company"]}
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Stock Adjustments</h1>
          <p className="text-sm text-gray-600">
            Track and manage inventory adjustments with approval workflows
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Adjustments</CardTitle>
              <FileEdit className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statistics?.total_adjustments || 0}
              </div>
              <p className="text-xs text-muted-foreground">All time</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Approval</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statistics?.pending_adjustments || 0}
              </div>
              <p className="text-xs text-muted-foreground">Awaiting review</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statistics?.completed_adjustments || 0}
              </div>
              <p className="text-xs text-muted-foreground">Applied to inventory</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Impact</CardTitle>
              {(statistics?.total_value_impact || 0) >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${(statistics?.total_value_impact || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(statistics?.total_value_impact || 0)}
              </div>
              <p className="text-xs text-muted-foreground">Value impact</p>
            </CardContent>
          </Card>
        </div>

        {/* Adjustments Table */}
        <StockAdjustmentsTable
          adjustments={adjustments}
          onAdjustmentUpdated={handleRefresh}
          isLoading={loading}
          onRefresh={handleRefresh}
          pagination={pagination}
          onPageChange={handlePageChange}
          onItemsPerPageChange={handleItemsPerPageChange}
          currentPage={currentPage}
          itemsPerPage={itemsPerPage}
        />
      </div>
    </PermissionGuard>
  )
}
