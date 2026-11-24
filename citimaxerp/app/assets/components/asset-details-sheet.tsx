"use client"

import { displayDate, displayDateTime } from "@/lib/date-format"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Package } from "lucide-react"
import { Asset, isAssigned } from "@/lib/assets"

interface AssetDetailsSheetProps {
  asset: Asset | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const KES = new Intl.NumberFormat("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const date = (d?: string | null) => (d ? displayDate(new Date(d)) : "-")

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium break-words">{value === null || value === undefined || value === "" ? "-" : value}</p>
    </div>
  )
}

export function AssetDetailsSheet({ asset, open, onOpenChange }: AssetDetailsSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full max-w-[600px] sm:max-w-[600px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {asset?.asset_code ? `${asset.asset_code} · ` : ""}Asset Details
          </SheetTitle>
        </SheetHeader>

        {asset && (
          <div className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2">
                  <span className="truncate">{asset.name}</span>
                  <Badge variant="outline" className="whitespace-nowrap">{asset.status || "In Use"}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <Field label="Asset ID" value={asset.asset_code} />
                <Field label="Asset Tag No." value={asset.tag_number} />
                <Field label="Asset Class" value={asset.category} />
                <Field label="Serial / Model No." value={asset.serial_number} />
                <Field label="Location / Department" value={asset.location} />
                <Field
                  label="Assigned To / User"
                  value={isAssigned(asset.assigned_to) ? asset.assigned_to : <span className="text-amber-700">Not assigned to anyone</span>}
                />
                {asset.original_category && <Field label="Original Category" value={asset.original_category} />}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Purchase</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <Field label="Supplier / Vendor" value={asset.supplier} />
                <Field label="Invoice No." value={asset.invoice_number} />
                <Field label="Purchase Date" value={date(asset.purchase_date)} />
                <Field label="Date Basis" value={asset.date_basis} />
                <Field label="Quantity (Pcs)" value={asset.quantity} />
                <Field label="Unit Cost (Ksh)" value={KES.format(Number(asset.purchase_cost) || 0)} />
                <Field label="Total Cost (Ksh)" value={KES.format(Number(asset.total_cost) || 0)} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Depreciation{asset.as_at ? ` as at ${date(asset.as_at)}` : ""}</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <Field label="Method" value={asset.depreciation_method === "straight_line" ? "Straight Line" : asset.depreciation_method} />
                <Field label="Rate % p.a." value={asset.depreciation_rate !== null && asset.depreciation_rate !== undefined ? `${Number(asset.depreciation_rate).toLocaleString(undefined, { maximumFractionDigits: 2 })}%` : "-"} />
                <Field label="Useful Life (Yrs)" value={asset.useful_life_years !== null && asset.useful_life_years !== undefined ? Number(asset.useful_life_years) : "-"} />
                <Field label="Residual Value %" value={`${Number(asset.residual_percent) || 0}%`} />
                <Field label="Depreciation Start Date" value={date(asset.depreciation_start_date)} />
                <Field label="Months Depreciated" value={asset.months_depreciated} />
                <Field label="Annual Depreciation (Ksh)" value={KES.format(asset.annual_depreciation || 0)} />
                <Field label="Monthly Depreciation (Ksh)" value={KES.format(asset.monthly_depreciation || 0)} />
                <Field label="Accumulated Depreciation (Ksh)" value={KES.format(asset.accumulated_depreciation || 0)} />
                <Field label="Net Book Value (Ksh)" value={<span className="text-green-700">{KES.format(asset.net_book_value || 0)}</span>} />
                {asset.fully_depreciated && (
                  <p className="col-span-2 text-xs text-muted-foreground">Fully depreciated: no further charge.</p>
                )}
              </CardContent>
            </Card>

            {asset.notes && (
              <Card>
                <CardContent className="pt-6">
                  <Field label="Notes" value={asset.notes} />
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Record Info</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <Field label="Created" value={asset.created_at ? displayDateTime(new Date(asset.created_at)) : "-"} />
                <Field label="Last Updated" value={asset.updated_at ? displayDateTime(new Date(asset.updated_at)) : "-"} />
              </CardContent>
            </Card>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
