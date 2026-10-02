"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getCustomerReport } from "@/lib/reports"
import { DataTable } from "@/components/ui/data-table"
import { PermissionGuard } from "@/components/PermissionGuard"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Users, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InteractiveChartCard } from "@/app/dashboard/components/interactive-chart-card"

export default function CustomerReportPage() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const { toast } = useToast()

  const fetchReport = useCallback(async () => {
    setLoading(true)
    try {
      const resp = await getCustomerReport()
      if (resp.status === "success") {
        setData(resp.data || [])
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch customer report",
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
    { accessorKey: "date", header: "Date" },
    { accessorKey: "new_customers", header: "New Customers" },
  ]

  const totalNewCustomers = data.reduce((sum, item) => sum + item.new_customers, 0)

  return (
    <PermissionGuard permissions={["can_view_reports_menu", "can_manage_system", "can_manage_company"]}>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Customer Reports</h1>
            <p className="text-sm text-gray-600">Analyze customer growth and acquisition</p>
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
             <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total New Customers</CardTitle>
                  <Users className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalNewCustomers}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Growth Trend</CardTitle>
                  <TrendingUp className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">Positive</div>
                </CardContent>
              </Card>
            </div>

            <InteractiveChartCard
              title="Customer Growth"
              description="New customers per day"
              data={data.map((item: any) => ({
                label: item.date,
                value: item.new_customers
              }))}
              chartType="bar"
            />

            <DataTable 
              columns={columns} 
              data={data} 
              filterColumn="date"
              exportFileName="customer_growth_report"
            />
          </div>
        )}
      </div>
    </PermissionGuard>
  )
}
