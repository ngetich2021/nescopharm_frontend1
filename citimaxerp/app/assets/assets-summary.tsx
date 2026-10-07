"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Boxes, Layers, Wallet, Tags } from "lucide-react"
import { getAssetSummary, AssetSummary } from "@/lib/assets"
import { Skeleton } from "@/components/ui/skeleton"

interface AssetsSummaryProps {
  refreshKey?: number
}

const KES = new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 })

export function AssetsSummary({ refreshKey }: AssetsSummaryProps) {
  const [summary, setSummary] = useState<AssetSummary>({
    totalAssets: 0,
    totalQuantity: 0,
    totalValue: 0,
    totalCategories: 0,
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      try {
        const data = await getAssetSummary()
        if (!cancelled) setSummary(data)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  const cards = [
    { label: "Total Assets", value: summary.totalAssets.toLocaleString(), icon: Boxes, color: "text-blue-600" },
    { label: "Total Quantity", value: summary.totalQuantity.toLocaleString(), icon: Layers, color: "text-purple-600" },
    { label: "Total Value", value: KES.format(summary.totalValue), icon: Wallet, color: "text-green-600" },
    { label: "Categories", value: summary.totalCategories.toLocaleString(), icon: Tags, color: "text-orange-600" },
  ]

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
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

  return (
    <div className="grid gap-4 md:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
            <card.icon className={`h-4 w-4 ${card.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
