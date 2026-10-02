import { PermissionGuard } from "@/components/PermissionGuard"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Package, ReceiptText, ClipboardList, FileEdit } from "lucide-react"

export const dynamic = "force-dynamic"

export default function InventoryPage() {
  return (
    <PermissionGuard permissions={["can_view_inventory_menu", "can_manage_system", "can_manage_company"]}>
      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
        <div className="flex flex-col space-y-2 mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Inventory Management</h1>
          <p className="text-muted-foreground">Manage your products, batches, and stock counts</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Link href="/inventory/products" className="block">
            <Card className="hover:bg-gray-50 transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Products
                </CardTitle>
                <CardDescription>Manage your product catalog and inventory</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  View, add, and edit products in your inventory
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/inventory/batches" className="block">
            <Card className="hover:bg-gray-50 transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Batches
                </CardTitle>
                <CardDescription>Track inventory batches and expiration dates</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Monitor batch tracking and expiration information
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/inventory/serial-numbers" className="block">
            <Card className="hover:bg-gray-50 transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Serial Numbers
                </CardTitle>
                <CardDescription>Track inventory serial numbers</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Manage and track serial numbers for products
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/inventory/stock-counts" className="block">
            <Card className="hover:bg-gray-50 transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5" />
                  Stock Counts
                </CardTitle>
                <CardDescription>Manage physical inventory counts</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Track and manage physical inventory counts
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/inventory/stock-adjustments" className="block">
            <Card className="hover:bg-gray-50 transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileEdit className="h-5 w-5" />
                  Stock Adjustments
                </CardTitle>
                <CardDescription>Track and manage inventory adjustments</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Manage stock adjustments with approval workflows
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </PermissionGuard>
  )
}