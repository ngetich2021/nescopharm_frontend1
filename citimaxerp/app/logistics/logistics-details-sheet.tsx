"use client"

import { useState, useEffect } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, TruckIcon, PackageIcon, CalendarIcon } from "lucide-react"
import { getLogistics, Logistics } from "@/lib/logistics" // Using API-based logistics

interface LogisticsDetailsSheetProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  logisticsId: string | null
}

export function LogisticsDetailsSheet({ isOpen, onOpenChange, logisticsId }: LogisticsDetailsSheetProps) {
  const [logistics, setLogistics] = useState<Logistics | null>(null)

  useEffect(() => {
    if (isOpen && logisticsId) {
      const fetchLogisticsDetails = async () => {
        try {
          // Fetch a single logistics entry by its ID
          const data = await getLogistics({ search: logisticsId });
          if (data.length > 0) {
            setLogistics(data[0])
          }
        } catch (error) {
          // console.error("Error fetching logistics details:", error)
        }
      }

      fetchLogisticsDetails()
    }
  }, [isOpen, logisticsId])

  const getStatusBadgeClass = (status: string) => {
    if (!status) return "bg-gray-100 text-gray-800"

    switch (status.toLowerCase()) {
      case "delivered":
        return "bg-green-100 text-green-800"
      case "in transit":
        return "bg-blue-100 text-blue-800"
      case "pending":
        return "bg-yellow-100 text-yellow-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md md:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center">
            <Button variant="ghost" size="icon" className="mr-2" onClick={() => onOpenChange(false)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            Delivery Details
          </SheetTitle>
          <SheetDescription>View and manage delivery information</SheetDescription>
        </SheetHeader>

        {logistics ? (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Status</CardTitle>
                  <TruckIcon className="h-4 w-4 text-[#1E2764]" />
                </CardHeader>
                <CardContent>
                  <Badge className={getStatusBadgeClass(logistics.delivery_status)}>{logistics.delivery_status}</Badge>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Order</CardTitle>
                  <PackageIcon className="h-4 w-4 text-[#1E2764]" />
                </CardHeader>
                <CardContent>
                  <div className="text-sm font-medium">{logistics.orders?.order_number || "N/A"}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Delivery Date</CardTitle>
                  <CalendarIcon className="h-4 w-4 text-[#1E2764]" />
                </CardHeader>
                <CardContent>
                  <div className="text-sm font-medium">
                    {logistics.delivery_date ? new Date(logistics.delivery_date).toLocaleDateString() : "Not scheduled"}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tabs for different sections */}
            <Tabs defaultValue="details">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="customer">Customer</TabsTrigger>
                <TabsTrigger value="tracking">Tracking</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-500">Delivery Address</h4>
                    <p className="mt-1">{logistics.delivery_address || "N/A"}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-500">City</h4>
                    <p className="mt-1">{logistics.city || "N/A"}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-500">Postal Code</h4>
                    <p className="mt-1">{logistics.postal_code || "N/A"}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-500">Country</h4>
                    <p className="mt-1">{logistics.country || "N/A"}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-500">Carrier</h4>
                    <p className="mt-1">{logistics.carrier_name || "N/A"}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-500">Tracking Number</h4>
                    <p className="mt-1">{logistics.tracking_number || "N/A"}</p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="customer" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-500">Name</h4>
                    <p className="mt-1">{logistics.orders?.customers?.name || "N/A"}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-500">Email</h4>
                    <p className="mt-1">{logistics.orders?.customers?.email || "N/A"}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-500">Phone</h4>
                    <p className="mt-1">{logistics.orders?.customers?.phone || "N/A"}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-500">Order Date</h4>
                    <p className="mt-1">
                      {logistics.orders?.order_date
                        ? new Date(logistics.orders.order_date).toLocaleDateString()
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-500">Order Total</h4>
                    <p className="mt-1">
                      {logistics.orders?.total_amount ? `Ksh. ${logistics.orders.total_amount.toFixed(2)}` : "N/A"}
                    </p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="tracking" className="space-y-4 mt-4">
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-500">Tracking Status</h4>
                    <p className="mt-1">{logistics.delivery_status || "N/A"}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-500">Estimated Delivery</h4>
                    <p className="mt-1">
                      {logistics.estimated_delivery_date
                        ? new Date(logistics.estimated_delivery_date).toLocaleDateString()
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-500">Actual Delivery</h4>
                    <p className="mt-1">
                      {logistics.actual_delivery_date
                        ? new Date(logistics.actual_delivery_date).toLocaleDateString()
                        : "Not delivered yet"}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-500">Notes</h4>
                    <p className="mt-1">{logistics.notes || "No notes available"}</p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline">Update Status</Button>
              <Button className="bg-[#1E2764] hover:bg-[#1E2764]/90">Send Tracking</Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">Logistics entry not found</div>
        )}
      </SheetContent>
    </Sheet>
  )
}
