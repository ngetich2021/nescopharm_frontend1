"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getProcurementReport } from "@/lib/reports"
import { DataTable } from "@/components/ui/data-table"
import { PermissionGuard } from "@/components/PermissionGuard"
import { useToast } from "@/hooks/use-toast"
import { Loader2, ShoppingBag, ClipboardList } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function ProcurementReportPage() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const { toast } = useToast()

  const fetchReport = useCallback(async () => {
    setLoading(true)
    try {
      const resp = await getProcurementReport()
      if (resp.status === "success") {
        setData(resp.data || [])
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch procurement report",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchReport()
  }, [fetchReport])

  const columns = [
    { accessorKey: "status", header: "Status" },
    { accessorKey: "count", header: "Count" },
    { 
      accessorKey: "total_value", 
      header: "Total Value",
      cell: ({ row }: any) => `KES ${parseFloat(row.original.total_value).toLocaleString()}`
    },
  ]

  return (
    <PermissionGuard permissions={["can_view_reports_menu", "can_manage_system", "can_manage_company"]}>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Procurement Reports</h1>
            <p className="text-sm text-gray-600">Summary of procurement activities by status</p>
          </div>
          <Button onClick={fetchReport} variant="outline" size="sm">
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {data.map((item) => (
                <Card key={item.status}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium capitalize">{item.status}</CardTitle>
                    <ClipboardList className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{item.count}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Value: KES {parseFloat(item.total_value).toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <DataTable 
              columns={columns} 
              data={data} 
              filterColumn="status"
              exportFileName="procurement_summary_report"
            />
          </div>
        )}
      </div>
    </PermissionGuard>
  )
}
