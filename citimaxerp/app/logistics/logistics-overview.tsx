"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getLogistics, Logistics } from "@/lib/logistics"

export default function LogisticsOverview() {
  const [logisticsData, setLogisticsData] = useState<Logistics[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchLogisticsData() {
      try {
        const data = await getLogistics({ search: "" })
        setLogisticsData(data)
      } catch (error) {
        setError("Failed to fetch logistics data")
      } finally {
        setIsLoading(false)
      }
    }

    fetchLogisticsData()
  }, [])

  if (isLoading) return <div>Loading logistics data...</div>
  if (error) return <div>Error: {error}</div>

  const totalDeliveries = logisticsData.length
  const completedDeliveries = logisticsData.filter(
    (entry) => entry.delivery_status?.toLowerCase() === "completed" || entry.delivery_status?.toLowerCase() === "delivered"
  ).length
  const pendingDeliveries = totalDeliveries - completedDeliveries

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Deliveries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDeliveries}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Deliveries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedDeliveries}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Deliveries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingDeliveries}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Logistics Entries</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>Delivery Person</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tracking Number</TableHead>
                <TableHead>Created At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logisticsData.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>{entry.order_id}</TableCell>
                  <TableCell>{entry.delivery_person_id || "N/A"}</TableCell>
                  <TableCell>{entry.delivery_status}</TableCell>
                  <TableCell>{entry.tracking_number || "N/A"}</TableCell>
                  <TableCell>{new Date(entry.created_at).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
