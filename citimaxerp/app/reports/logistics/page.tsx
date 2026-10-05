"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getLogisticsReport } from "@/lib/reports"
import { DataTable } from "@/components/ui/data-table"
import { PermissionGuard } from "@/components/PermissionGuard"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Truck, Clock, CheckCircle, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function LogisticsReportPage() {
  const [reportType, setReportType] = useState<'efficiency' | 'success_rate'>('efficiency')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const { toast } = useToast()

  const latestRequest = useRef(0)

  const fetchReport = useCallback(async () => {
    const requestId = ++latestRequest.current
    setLoading(true)
    try {
      const resp = await getLogisticsReport(reportType)
      if (requestId !== latestRequest.current) return
      if (resp.status === "success") {
        setData(resp.data)
      }
    } catch (error: any) {
      if (requestId !== latestRequest.current) return
      toast({
        title: "Error",
        description: error.message || "Failed to fetch logistics report",
        variant: "destructive",
      })
    } finally {
      if (requestId === latestRequest.current) setLoading(false)
    }
  }, [reportType, toast])

  useEffect(() => {
    fetchReport()
  }, [fetchReport])

  const efficiencyColumns = [
    { accessorKey: "dispatch_number", header: "Dispatch Number" },
    { accessorKey: "final_approved_at", header: "Approved At" },
    { accessorKey: "dispatch_date", header: "Dispatched At" },
    { 
      accessorKey: "hours_to_dispatch", 
      header: "Hours to Dispatch",
      cell: ({ row }: any) => `${row.original.hours_to_dispatch.toFixed(1)} hrs`
    },
  ]

  return (
    <PermissionGuard permissions={["can_view_reports_menu", "can_view_logistics_reports", "can_manage_system", "can_manage_company"]}>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Logistics Reports</h1>
            <p className="text-sm text-gray-600">Monitor delivery efficiency and success rates</p>
          </div>
          <Button onClick={fetchReport} variant="outline" size="sm">
            Refresh
          </Button>
        </div>

        {/* Tabs for switching reports */}
        <Tabs value={reportType} onValueChange={(v: any) => setReportType(v)}>
          <TabsList>
            <TabsTrigger value="efficiency">Efficiency</TabsTrigger>
            <TabsTrigger value="success_rate">Success Rate</TabsTrigger>
          </TabsList>
          
          <TabsContent value={reportType} className="mt-6">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <>
                {reportType === 'efficiency' && (
                  <DataTable 
                    columns={efficiencyColumns} 
                    data={data || []} 
                    filterColumn="dispatch_number"
                    exportFileName="logistics_efficiency_report"
                  />
                )}

                {reportType === 'success_rate' && data && (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Dispatches</CardTitle>
                        <Truck className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{data.total_dispatches}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Delivered</CardTitle>
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{data.delivered}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Failed/Returned</CardTitle>
                        <AlertCircle className="h-4 w-4 text-red-500" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{data.failed_or_returned}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pending</CardTitle>
                        <Clock className="h-4 w-4 text-blue-500" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{data.pending}</div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </PermissionGuard>
  )
}
