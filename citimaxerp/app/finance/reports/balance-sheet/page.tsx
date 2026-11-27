"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ChartSkeleton } from "@/components/ui/skeletons"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowLeft, Calendar, CheckCircle, AlertTriangle } from "lucide-react"
import { getBalanceSheet, formatCurrency } from "@/lib/finance"
import { useToast } from "@/hooks/use-toast"
import { format } from "date-fns"
import { documentFileName, filePeriod, sessionCompanyName } from "@/lib/document-names"
import { DownloadButton } from "@/components/download-button"
import type { ExportCell, TableExport } from "@/lib/table-export"

type Row = { account_id: string | null; account_code: string; account_name: string; amount: number; group?: "capital" | "opening_difference" | "profit_loss" }
type Group = { label: string; rows: Row[]; total: number }
type Sheet = {
  assets: Group[]
  totalAssets: number
  liabilities: Group[]
  totalLiabilities: number
  capital: Group
  openingDifference: Group
  profitLoss: Group
  totalEquity: number
  totalLiabilitiesAndEquity: number
  isBalanced: boolean
  difference: number
}

const sum = (rows: Row[]) => rows.reduce((s, r) => s + Number(r.amount || 0), 0)

// The API returns { data: { sections: {...}, validation: {...} } }.
function toSheet(res: any): Sheet {
  const s = (res?.data ?? res)?.sections ?? {}
  const v = (res?.data ?? res)?.validation ?? {}
  const a = s.assets ?? {}
  const l = s.liabilities ?? {}
  const equity: Row[] = s.equity?.accounts ?? []
  const group = (label: string, rows: Row[] | undefined, total?: number): Group => ({ label, rows: rows ?? [], total: total ?? sum(rows ?? []) })
  const byGroup = (g: Row["group"]) => equity.filter((r) => (r.group ?? "capital") === g)

  return {
    assets: [
      group("Current Assets", a.current_assets?.accounts, a.current_assets?.total),
      group("Fixed Assets", a.fixed_assets?.accounts, a.fixed_assets?.total_net),
      group("Other Assets", a.other_assets?.accounts, a.other_assets?.total),
    ].filter((g) => g.rows.length),
    totalAssets: Number(a.total_assets ?? 0),
    liabilities: [
      group("Current Liabilities", l.current_liabilities?.accounts, l.current_liabilities?.total),
      group("Loans (Liability)", l.long_term_liabilities?.accounts, l.long_term_liabilities?.total),
      group("Other Liabilities", l.other_liabilities?.accounts, l.other_liabilities?.total),
    ].filter((g) => g.rows.length),
    totalLiabilities: Number(l.total_liabilities ?? 0),
    capital: group("Capital Account", byGroup("capital")),
    openingDifference: group("Difference in Opening Balances", byGroup("opening_difference")),
    profitLoss: group("Profit & Loss A/c", byGroup("profit_loss")),
    totalEquity: Number(s.equity?.total ?? 0),
    totalLiabilitiesAndEquity: Number(s.total_liabilities_and_equity ?? 0),
    isBalanced: !!v.is_balanced,
    difference: Number(v.difference ?? 0),
  }
}

function GroupRows({ g, indent = true }: { g: Group; indent?: boolean }) {
  return (
    <>
      <TableRow>
        <TableCell className="font-semibold bg-gray-50">{g.label}</TableCell>
        <TableCell className="text-right font-mono font-semibold bg-gray-50">{formatCurrency(g.total)}</TableCell>
      </TableRow>
      {g.rows.map((r, i) => (
        <TableRow key={`${r.account_code}-${i}`}>
          <TableCell className={indent ? "pl-6 italic" : ""}>
            {r.account_name}
            {r.account_id && <span className="ml-2 text-xs text-muted-foreground font-mono not-italic">{r.account_code}</span>}
          </TableCell>
          <TableCell className="text-right font-mono italic">{formatCurrency(r.amount)}</TableCell>
        </TableRow>
      ))}
    </>
  )
}

/**
 * Balance Sheet in the Tally arrangement: Capital Account (the owners' capital, one line per
 * director), Difference in Opening Balances, Loans and Current Liabilities, Profit & Loss A/c on one
 * side; Fixed and Current Assets on the other.
 */
export default function BalanceSheetPage() {
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [asOfDate, setAsOfDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const { toast } = useToast()

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setLoadError(null)
    getBalanceSheet({ as_of_date: asOfDate })
      .then((res) => { if (!cancelled) setSheet(toSheet(res)) })
      .catch((error) => {
        if (cancelled) return
        const message = error?.message ?? "Please try again."
        setSheet(null)
        setLoadError(message)
        toast({ title: "Could not load the balance sheet", description: message, variant: "destructive" })
      })
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asOfDate])

  const leftGroups = (s: Sheet) => [s.capital, ...(s.openingDifference.rows.length ? [s.openingDifference] : []), ...s.liabilities, ...(s.profitLoss.rows.length ? [s.profitLoss] : [])]

  const buildExport = (): TableExport => {
    const s = sheet!
    const rows: ExportCell[][] = []
    const add = (g: Group) => {
      rows.push(["", g.label, "", g.total])
      g.rows.forEach((r, i) => rows.push([i + 1, r.account_id ? r.account_code : "", r.account_name, Number(r.amount) || 0]))
    }
    rows.push(["", "LIABILITIES & CAPITAL", "", null])
    leftGroups(s).forEach(add)
    rows.push(["", "", "Total Liabilities & Capital", s.totalLiabilitiesAndEquity])
    rows.push(["", "ASSETS", "", null])
    s.assets.forEach(add)
    rows.push(["", "", "Total Assets", s.totalAssets])
    return {
      fileName: documentFileName([sessionCompanyName(), `Balance Sheet ${filePeriod(null, asOfDate)}`]),
      title: "Balance Sheet",
      subtitle: `As at ${format(new Date(asOfDate), "dd/MM/yyyy")}${s.isBalanced ? "" : " · OUT OF BALANCE"}`,
      headers: ["S/No", "Account Code", "Particulars", "Amount"],
      moneyColumns: [3],
      rows,
    }
  }

  if (isLoading && !sheet) {
    return <ChartSkeleton height="h-[600px]" />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <Link href="/finance/reports">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Reports
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Balance Sheet</h1>
            <p className="text-muted-foreground">Statement of financial position</p>
          </div>
        </div>
        <DownloadButton title="Balance Sheet" build={buildExport} disabled={!sheet} />
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">As at</label>
              <div className="relative">
                <Calendar className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} className="pl-8 w-48" />
              </div>
            </div>
            {sheet && (
              <div className="flex items-center gap-2 pb-2">
                {sheet.isBalanced ? (
                  <><CheckCircle className="h-5 w-5 text-green-600" /><span className="text-sm text-green-600 font-medium">Balanced</span></>
                ) : (
                  <><AlertTriangle className="h-5 w-5 text-red-600" /><span className="text-sm text-red-600 font-medium">Out of balance by {formatCurrency(sheet.difference)}</span></>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {!sheet && loadError && !isLoading && (
        <Card>
          <CardContent className="py-10 text-center">
            <AlertTriangle className="mx-auto h-8 w-8 text-red-600" />
            <p className="mt-3 font-medium">The balance sheet could not be loaded</p>
            <p className="mt-1 text-sm text-muted-foreground">{loadError}</p>
          </CardContent>
        </Card>
      )}

      {sheet && (
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Balance Sheet</CardTitle>
            <CardDescription className="text-lg">As at {format(new Date(asOfDate), "dd/MM/yyyy")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-8 lg:grid-cols-2">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="bg-muted font-bold">Liabilities &amp; Capital</TableHead>
                      <TableHead className="bg-muted font-bold text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leftGroups(sheet).map((g) => <GroupRows key={g.label} g={g} />)}
                    <TableRow className="border-t-2 border-black">
                      <TableCell className="font-bold text-lg">Total</TableCell>
                      <TableCell className="text-right font-mono font-bold text-lg">{formatCurrency(sheet.totalLiabilitiesAndEquity)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="bg-muted font-bold">Assets</TableHead>
                      <TableHead className="bg-muted font-bold text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sheet.assets.map((g) => <GroupRows key={g.label} g={g} />)}
                    <TableRow className="border-t-2 border-black">
                      <TableCell className="font-bold text-lg">Total</TableCell>
                      <TableCell className="text-right font-mono font-bold text-lg">{formatCurrency(sheet.totalAssets)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>

            {!sheet.isBalanced && (
              <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="h-5 w-5" />
                  <span className="font-medium">Balance Sheet Error</span>
                </div>
                <p className="text-sm text-red-600 mt-1">
                  Total Assets does not equal Total Liabilities &amp; Capital. Please review your journal entries.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
