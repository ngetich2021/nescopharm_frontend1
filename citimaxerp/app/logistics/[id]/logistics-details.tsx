"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowLeft, MapPin, Truck, Package, User, Mail, Phone, Calendar } from "lucide-react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import type { Database } from "@/lib/database.types"

type LogisticsEntry = Database["public"]["Tables"]["logistics"]["Row"] & {
  orders:
    | (Pick<Database["public"]["Tables"]["orders"]["Row"], "id" | "order_number"> & {
        customers: Pick<Database["public"]["Tables"]["customers"]["Row"], "id" | "name" | "phone" | "email">
      })
    | null
}

interface LogisticsDetailsProps {
  logisticsEntry: LogisticsEntry
}

export function LogisticsDetails({ logisticsEntry }: LogisticsDetailsProps) {
  const router = useRouter()

  return (
    <div className="container mx-auto py-8 px-4">
      <Button variant="ghost" onClick={() => router.back()} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Logistics
      </Button>

      <Card className="bg-background p-6 rounded-lg shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-2xl font-bold flex items-center gap-2">
            <Truck className="h-6 w-6" /> Delivery Details
          </CardTitle>
          <Badge
            className={cn(
              "px-3 py-1 text-sm font-semibold",
              logisticsEntry.delivery_status === "Delivered" && "bg-green-100 text-green-800",
              logisticsEntry.delivery_status === "In Transit" && "bg-blue-100 text-blue-800",
              logisticsEntry.delivery_status === "Pending" && "bg-yellow-100 text-yellow-800",
              logisticsEntry.delivery_status === "Cancelled" && "bg-red-100 text-red-800",
            )}
          >
            {logisticsEntry.delivery_status}
          </Badge>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Package className="h-5 w-5 text-muted-foreground" /> Order Information
            </h3>
            <p className="text-muted-foreground">
              <strong>Order Number:</strong> {logisticsEntry.orders?.order_number || "N/A"}
            </p>
            <p className="text-muted-foreground">
              <strong>Order ID:</strong> {logisticsEntry.order_id || "N/A"}
            </p>
            <p className="text-muted-foreground">
              <strong>Tracking Number:</strong> {logisticsEntry.tracking_number || "N/A"}
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <User className="h-5 w-5 text-muted-foreground" /> Customer Details
            </h3>
            <p className="text-muted-foreground">
              <strong>Name:</strong> {logisticsEntry.orders?.customers?.name || "N/A"}
            </p>
            <p className="text-muted-foreground flex items-center gap-1">
              <Mail className="h-4 w-4" /> {logisticsEntry.orders?.customers?.email || "N/A"}
            </p>
            <p className="text-muted-foreground flex items-center gap-1">
              <Phone className="h-4 w-4" /> {logisticsEntry.orders?.customers?.phone || "N/A"}
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <MapPin className="h-5 w-5 text-muted-foreground" /> Delivery Information
            </h3>
            <p className="text-muted-foreground">
              <strong>Address:</strong> {logisticsEntry.delivery_address || "N/A"}
            </p>
            <p className="text-muted-foreground">
              <strong>City:</strong> {logisticsEntry.delivery_city || "N/A"}
            </p>
            <p className="text-muted-foreground">
              <strong>Postal Code:</strong> {logisticsEntry.delivery_postal_code || "N/A"}
            </p>
            <p className="text-muted-foreground">
              <strong>Country:</strong> {logisticsEntry.delivery_country || "N/A"}
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Calendar className="h-5 w-5 text-muted-foreground" /> Dates
            </h3>
            <p className="text-muted-foreground">
              <strong>Scheduled Date:</strong>{" "}
              {logisticsEntry.scheduled_delivery_date
                ? new Date(logisticsEntry.scheduled_delivery_date).toLocaleDateString()
                : "N/A"}
            </p>
            <p className="text-muted-foreground">
              <strong>Actual Date:</strong>{" "}
              {logisticsEntry.actual_delivery_date
                ? new Date(logisticsEntry.actual_delivery_date).toLocaleDateString()
                : "N/A"}
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Truck className="h-5 w-5 text-muted-foreground" /> Carrier Details
            </h3>
            <p className="text-muted-foreground">
              <strong>Carrier:</strong> {logisticsEntry.carrier_name || "N/A"}
            </p>
            <p className="text-muted-foreground">
              <strong>Carrier Contact:</strong> {logisticsEntry.carrier_contact || "N/A"}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
