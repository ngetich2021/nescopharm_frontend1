"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Boxes, Wallet, TrendingDown, BadgeCheck, UserX, ChevronDown, ChevronUp } from "lucide-react"
import { getAssetSummary, AssetSummary } from "@/lib/assets"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { displayDate } from "@/lib/date-format"

interface AssetsSummaryProps {
  refreshKey?: number
  asAt?: string
}

const KES = new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 })
const MONEY = new Intl.NumberFormat("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function AssetsSummary({ refreshKey, asAt }: AssetsSummaryProps) {
  const [summary, setSummary] = useState<AssetSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showClasses, setShowClasses] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      try {
        const data = await getAssetSummary(asAt)
        if (!cancelled) setSummary(data)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [refreshKey, asAt])

  if (isLoading || !summary) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-4 rounded-full" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-7 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const asAtText = summary.asAt ? displayDate(new Date(summary.asAt)) : ""
  const cards = [
    { label: "Assets", value: summary.totalAssets.toLocaleString(), hint: `${summary.totalQuantity.toLocaleString()} pieces · ${summary.totalCategories} classes`, icon: Boxes, color: "text-blue-600" },
    { label: "Total Cost", value: KES.format(summary.totalValue), hint: "what was paid", icon: Wallet, color: "text-purple-600" },
    { label: "Accumulated Depreciation", value: KES.format(summary.accumulatedDepreciation ?? 0), hint: `as at ${asAtText} · ${KES.format(summary.annualDepreciation ?? 0)} a year`, icon: TrendingDown, color: "text-orange-600" },
    { label: "Net Book Value", value: KES.format(summary.netBookValue ?? 0), hint: `as at ${asAtText}`, icon: BadgeCheck, color: "text-green-600" },
    { label: "Not Assigned", value: (summary.unassigned ?? 0).toLocaleString(), hint: "asset lines with no one answerable", icon: UserX, color: "text-amber-600" },
  ]
  const byClass = summary.byClass ?? []

  return (
    <div className="space-y-3">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <p className="mt-1 text-xs text-muted-foreground">{card.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {byClass.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 py-3">
            <CardTitle className="text-base">Summary by Asset Class</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setShowClasses((v) => !v)}>
              {showClasses ? <ChevronUp className="mr-1 h-4 w-4" /> : <ChevronDown className="mr-1 h-4 w-4" />}
              {showClasses ? "Hide" : "Show"}
            </Button>
          </CardHeader>
          {showClasses && (
            <CardContent className="overflow-x-auto pt-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">S/No</TableHead>
                    <TableHead>Asset Class</TableHead>
                    <TableHead className="text-right">Lines</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Rate % p.a.</TableHead>
                    <TableHead className="text-right">Life (Yrs)</TableHead>
                    <TableHead className="text-right">Total Cost (Ksh)</TableHead>
                    <TableHead className="text-right">Annual Dep. (Ksh)</TableHead>
                    <TableHead className="text-right">Accum. Dep. (Ksh)</TableHead>
                    <TableHead className="text-right">Net Book Value (Ksh)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byClass.map((c, i) => (
                    <TableRow key={c.class}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium">{c.class}</TableCell>
                      <TableCell className="text-right">{c.lines}</TableCell>
                      <TableCell className="text-right">{c.quantity.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{c.rate !== null ? `${Number(c.rate).toLocaleString(undefined, { maximumFractionDigits: 2 })}%` : "-"}</TableCell>
                      <TableCell className="text-right">{c.useful_life_years ?? "-"}</TableCell>
                      <TableCell className="text-right tabular-nums">{MONEY.format(c.total_cost)}</TableCell>
                      <TableCell className="text-right tabular-nums">{MONEY.format(c.annual_depreciation)}</TableCell>
                      <TableCell className="text-right tabular-nums">{MONEY.format(c.accumulated_depreciation)}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{MONEY.format(c.net_book_value)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter className="bg-gray-100">
                  <TableRow>
                    <TableCell />
                    <TableCell className="font-semibold">Total</TableCell>
                    <TableCell className="text-right font-semibold">{byClass.reduce((s, c) => s + c.lines, 0)}</TableCell>
                    <TableCell className="text-right font-semibold">{byClass.reduce((s, c) => s + c.quantity, 0).toLocaleString()}</TableCell>
                    <TableCell colSpan={2} />
                    <TableCell className="text-right font-semibold tabular-nums">{MONEY.format(byClass.reduce((s, c) => s + c.total_cost, 0))}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{MONEY.format(byClass.reduce((s, c) => s + c.annual_depreciation, 0))}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{MONEY.format(byClass.reduce((s, c) => s + c.accumulated_depreciation, 0))}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{MONEY.format(byClass.reduce((s, c) => s + c.net_book_value, 0))}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  )
}
