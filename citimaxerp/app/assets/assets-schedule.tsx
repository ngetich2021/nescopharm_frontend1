"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ExportMenu, useTableExport } from "@/components/export-menu"
import { documentFileName, sessionCompanyName } from "@/lib/document-names"
import { displayDate } from "@/lib/date-format"
import { useToast } from "@/hooks/use-toast"
import { DepreciationSchedule, getDepreciationSchedule } from "@/lib/assets"

const CLASSES = [
  "Computers & Laptops",
  "Printers",
  "Furniture & Fittings",
  "Office Equipment",
  "Machinery & Equipment",
  "Material Handling Equipment",
  "Security Equipment",
  "Leasehold Improvements",
]

type Section = "accumulated" | "charge" | "nbv"
const SECTIONS: { key: Section; label: string }[] = [
  { key: "accumulated", label: "Accumulated depreciation at year-end" },
  { key: "charge", label: "Depreciation charge for the year" },
  { key: "nbv", label: "Net book value at year-end" },
]

const money = (v: number) => (Number(v) || 0).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const ye = (d: string) => displayDate(d)

/**
 * Depreciation Schedule by asset - year-end projection, as the register's Schedule sheet: for each
 * 31/12 year-end the accumulated depreciation, the charge for that year and the net book value.
 * Depreciation stops once an asset is fully depreciated.
 */
export function AssetsSchedule() {
  const { toast } = useToast()
  const [years, setYears] = useState("6")
  const [category, setCategory] = useState("all")
  const [show, setShow] = useState<"all" | Section>("all")
  const [data, setData] = useState<DepreciationSchedule | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getDepreciationSchedule({ years: Number(years), category: category === "all" ? undefined : category })
      .then(setData)
      .catch((e) => toast({ title: "Error", description: e?.message ?? "Could not load the schedule.", variant: "destructive" }))
      .finally(() => setLoading(false))
  }, [years, category])

  const sections = useMemo(() => SECTIONS.filter((s) => show === "all" || s.key === show), [show])
  const yearEnds = data?.year_ends ?? []
  const rows = data?.rows ?? []

  const onExport = useTableExport(() => {
    const fixed = ["S/No", "Asset ID", "Description", "Asset Class", "Purchase Date", "Total Cost (Ksh)", "Dep. Start Date", "Depreciable Amount", "Monthly Depreciation", "Life (Months)"]
    const short: Record<Section, string> = { accumulated: "Acc. Dep.", charge: "Charge", nbv: "NBV" }
    const dyn = sections.flatMap((s) => yearEnds.map((y) => `${short[s.key]} ${ye(y)}`))
    const body = rows.map((r, i) => [
      i + 1, r.asset_code ?? "", r.name, r.category ?? "", displayDate(r.purchase_date), r.total_cost, displayDate(r.depreciation_start_date),
      r.depreciable_amount, r.monthly_depreciation, r.life_months,
      ...sections.flatMap((s) => r.years.map((y) => y[s.key])),
    ])
    const t = data?.totals
    const footer = [[
      "", "TOTAL", "", "", "", t?.total_cost ?? 0, "", t?.depreciable_amount ?? 0, t?.monthly_depreciation ?? 0, "",
      ...sections.flatMap((s) => (t?.years ?? []).map((y) => y[s.key])),
    ]]
    const moneyColumns = [5, 7, 8, ...dyn.map((_, i) => fixed.length + i)]
    return {
      fileName: documentFileName([sessionCompanyName(), "Depreciation Schedule"]),
      title: "Depreciation Schedule by Asset - Year-end Projection",
      subtitle: `${category === "all" ? "All asset classes" : category} - year-ends ${yearEnds.map(ye).join(", ")}`,
      headers: [...fixed, ...dyn],
      rows: body,
      footer,
      moneyColumns,
      sheetName: "Schedule",
    }
  })

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <CardTitle className="text-base">Depreciation Schedule by Asset - Year-end Projection</CardTitle>
            <p className="text-sm text-muted-foreground">
              Straight line by asset class, from each asset&apos;s depreciation start date. Year-ends roll forward 12 months from 31/12/2025; depreciation stops once an asset is fully depreciated.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Asset class</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All classes</SelectItem>
                  {CLASSES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Show</Label>
              <Select value={show} onValueChange={(v) => setShow(v as any)}>
                <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All three sections</SelectItem>
                  {SECTIONS.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Years</Label>
              <Select value={years} onValueChange={setYears}>
                <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[3, 4, 5, 6, 8, 10, 12].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <ExportMenu onExport={onExport} disabled={loading || rows.length === 0} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div>
          <Table scroll className="text-xs">
            <TableHeader>
              <TableRow>
                <TableHead colSpan={10} />
                {sections.map((s) => (
                  <TableHead key={s.key} colSpan={yearEnds.length} className="text-center border-l font-semibold">{s.label}</TableHead>
                ))}
              </TableRow>
              <TableRow>
                <TableHead className="w-12">S/No</TableHead>
                <TableHead>Asset ID</TableHead>
                <TableHead className="min-w-[200px]">Description</TableHead>
                <TableHead>Asset Class</TableHead>
                <TableHead>Purchase Date</TableHead>
                <TableHead className="text-right">Total Cost (Ksh)</TableHead>
                <TableHead>Dep. Start Date</TableHead>
                <TableHead className="text-right">Depreciable Amount</TableHead>
                <TableHead className="text-right">Monthly Depreciation</TableHead>
                <TableHead className="text-right">Life (Months)</TableHead>
                {sections.flatMap((s) => yearEnds.map((y, i) => (
                  <TableHead key={`${s.key}-${y}`} className={`text-right whitespace-nowrap ${i === 0 ? "border-l" : ""}`}>{ye(y)}</TableHead>
                )))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={10 + sections.length * yearEnds.length} className="py-10 text-center text-muted-foreground">Loading...</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={10 + sections.length * Math.max(1, yearEnds.length)} className="py-10 text-center text-muted-foreground">No assets.</TableCell></TableRow>
              ) : (
                rows.map((r, idx) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell className="whitespace-nowrap font-medium">{r.asset_code ?? "-"}</TableCell>
                    <TableCell>{r.name}</TableCell>
                    <TableCell className="whitespace-nowrap">{r.category ?? "-"}</TableCell>
                    <TableCell className="whitespace-nowrap">{displayDate(r.purchase_date)}</TableCell>
                    <TableCell className="text-right font-mono">{money(r.total_cost)}</TableCell>
                    <TableCell className="whitespace-nowrap">{displayDate(r.depreciation_start_date)}</TableCell>
                    <TableCell className="text-right font-mono">{money(r.depreciable_amount)}</TableCell>
                    <TableCell className="text-right font-mono">{money(r.monthly_depreciation)}</TableCell>
                    <TableCell className="text-right">{r.life_months}</TableCell>
                    {sections.flatMap((s) => r.years.map((y, i) => (
                      <TableCell key={`${s.key}-${y.year_end}`} className={`text-right font-mono ${i === 0 ? "border-l" : ""}`}>{money(y[s.key])}</TableCell>
                    )))}
                  </TableRow>
                ))
              )}
            </TableBody>
            {rows.length > 0 && data && (
              <TableFooter className="sticky bottom-0 bg-muted">
                <TableRow>
                  <TableCell />
                  <TableCell colSpan={4} className="font-semibold">TOTAL ({rows.length} assets)</TableCell>
                  <TableCell className="text-right font-mono font-semibold">{money(data.totals.total_cost)}</TableCell>
                  <TableCell />
                  <TableCell className="text-right font-mono font-semibold">{money(data.totals.depreciable_amount)}</TableCell>
                  <TableCell className="text-right font-mono font-semibold">{money(data.totals.monthly_depreciation)}</TableCell>
                  <TableCell />
                  {sections.flatMap((s) => data.totals.years.map((y, i) => (
                    <TableCell key={`t-${s.key}-${y.year_end}`} className={`text-right font-mono font-semibold ${i === 0 ? "border-l" : ""}`}>{money(y[s.key])}</TableCell>
                  )))}
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
