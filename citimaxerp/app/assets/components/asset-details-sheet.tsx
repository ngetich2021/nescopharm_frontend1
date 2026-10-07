"use client"

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Package } from "lucide-react"
import { Asset } from "@/lib/assets"

interface AssetDetailsSheetProps {
  asset: Asset | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const KES = new Intl.NumberFormat("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium break-words">{value || "-"}</p>
    </div>
  )
}

export function AssetDetailsSheet({ asset, open, onOpenChange }: AssetDetailsSheetProps) {
  const totalValue = asset ? (Number(asset.purchase_cost) || 0) * (asset.quantity || 0) : 0

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[560px] max-w-[560px] sm:max-w-[560px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Asset Details
          </SheetTitle>
        </SheetHeader>

        {asset && (
          <div className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="truncate">{asset.name}</span>
                  <Badge className={asset.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                    {asset.is_active ? "Active" : "Inactive"}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <Field label="Category" value={asset.category} />
                <Field label="Serial / Model Number" value={asset.serial_number} />
                <Field label="Location / Department" value={asset.location} />
                <Field label="Quantity (Pcs)" value={asset.quantity} />
                <Field label="Purchase Cost (Ksh)" value={KES.format(Number(asset.purchase_cost) || 0)} />
                <Field label="Total Value (Ksh)" value={KES.format(totalValue)} />
                <div className="col-span-2">
                  <Field label="Notes" value={asset.notes} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Record Info</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <Field
                  label="Created"
                  value={asset.created_at ? new Date(asset.created_at).toLocaleString() : "-"}
                />
                <Field
                  label="Last Updated"
                  value={asset.updated_at ? new Date(asset.updated_at).toLocaleString() : "-"}
                />
              </CardContent>
            </Card>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
