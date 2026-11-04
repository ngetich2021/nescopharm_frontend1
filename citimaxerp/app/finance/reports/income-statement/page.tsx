"use client"

import { Fragment, useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ChartSkeleton } from "@/components/ui/skeletons"
import { AlertTriangle, Calendar } from "lucide-react"
import { financeApi } from "@/lib/finance"
import { documentFileName, filePeriod, sessionCompanyName } from "@/lib/document-names"
import { DownloadButton } from "@/components/download-button"
import type { ExportCell, TableExport } from "@/lib/table-export"

interface StatementLine {
  key: string
  label: string
  amount: number
  accounts: { code: string; name: string; amount: number }[]
}

interface StatementSection {
  key: string
  title: string
  groups: { title: string | null; total: number; lines: StatementLine[] }[]
  total_label: string | null
  total: number
  subtotal_label: string
  subtotal: number
}

interface Statement {
  sections: StatementSection[]
  totals: { net_revenue: number; gross_profit: number; operating_income: number; earnings_before_tax: number; net_income: number }
  notes: string[]
}

// Deductions read in brackets, the way accountants write them; a line with nothing on it is a dash.
const money = (amount: number) => {
  if (Math.abs(amount) < 0.005) return "—"
  const text = Math.abs(amount).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return amount < 0 ? `(${text})` : text
}

export default function IncomeStatementPage() {
  const [statement, setStatement] = useState<Statement | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [fromDate, setFromDate] = useState(() => {
    const date = new Date()
    date.setMonth(date.getMonth() - 12) // Last 12 months
    return date.toISOString().split('T')[0]
  })
  const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0])

  const fetchIncomeStatement = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await financeApi.getIncomeStatement({ date_from: fromDate, date_to: toDate })
      setStatement(response.data.statement)
    } catch (err: any) {
      setStatement(null)
      setError(err?.message || "The income statement could not be loaded. Please try again.")
    } finally {
      setLoading(false)
    }
  }, [fromDate, toDate])

  useEffect(() => {
    fetchIncomeStatement()
  }, [fetchIncomeStatement])

  const netRevenue = statement?.totals.net_revenue ?? 0
  const share = (amount: number) => (netRevenue && Math.abs(amount) >= 0.005 ? `${((amount / netRevenue) * 100).toFixed(1)}%` : "")

  const buildExport = (): TableExport => {
    const s = statement!
    const rows: ExportCell[][] = []
    let serial = 0
    s.sections.forEach((section) => {
      rows.push(["", section.title.toUpperCase(), null, ""])
      section.groups.forEach((group) => {
        if (group.title) rows.push(["", group.title, null, ""])
        group.lines.forEach((line) => {
          serial += 1
          rows.push([serial, line.label, line.amount, share(line.amount)])
          line.accounts.forEach((a) => rows.push(["", `     ${a.code} ${a.name}`, a.amount, ""]))
        })
        if (group.title) rows.push(["", `Total ${group.title}`, group.total, share(group.total)])
      })
      if (section.total_label) rows.push(["", section.total_label, section.total, share(section.total)])
      if (section.key !== "tax") rows.push(["", section.subtotal_label.toUpperCase(), section.subtotal, share(section.subtotal)])
    })
    const last = s.sections[s.sections.length - 1]
    return {
      fileName: documentFileName([sessionCompanyName(), `Income Statement ${filePeriod(fromDate, toDate)}`]),
      title: "Income Statement",
      subtitle: `For the period ${new Date(fromDate).toLocaleDateString("en-GB")} to ${new Date(toDate).toLocaleDateString("en-GB")}`,
      details: s.notes.map((note, i) => [`Note ${i + 1}`, note] as [string, string]),
      headers: ["S/No", "Particulars", "Amount (KES)", "% of Net Revenue"],
      moneyColumns: [2],
      rightColumns: [3],
      rows,
      footer: [["", last.subtotal_label, last.subtotal, share(last.subtotal)]],
    }
  }

  let serial = 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Income Statement</h1>
          <p className="text-muted-foreground">
            Profit and loss statement showing revenues and expenses
          </p>
        </div>
        <DownloadButton title="Income Statement" build={buildExport} disabled={!statement} />
      </div>

      {/* Date Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Report Period
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="fromDate">From Date</Label>
              <Input id="fromDate" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="toDate">To Date</Label>
              <Input id="toDate" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
            <Button onClick={fetchIncomeStatement} disabled={loading}>
              Generate Report
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && !statement && <ChartSkeleton height="h-[400px]" />}

      {statement && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Net Revenue", amount: statement.totals.net_revenue },
              { label: "Gross Profit", amount: statement.totals.gross_profit },
              { label: "Operating Income / EBIT", amount: statement.totals.operating_income },
              { label: "Net Profit", amount: statement.totals.net_income },
            ].map((figure) => (
              <Card key={figure.label}>
                <CardContent className="p-4">
                  <div className="text-sm text-muted-foreground">{figure.label}</div>
                  <div className={`text-lg font-semibold ${figure.amount < 0 ? "text-red-600" : ""}`}>KES {money(figure.amount)}</div>
                  <div className="text-xs text-muted-foreground">{share(figure.amount) && `${share(figure.amount)} of net revenue`}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {statement.notes.map((note) => (
            <div key={note} className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{note}</span>
            </div>
          ))}

          <Card>
            <CardHeader>
              <CardTitle className="text-center">Income Statement</CardTitle>
              <p className="text-center text-muted-foreground">
                For the period from {new Date(fromDate).toLocaleDateString("en-GB")} to {new Date(toDate).toLocaleDateString("en-GB")}
              </p>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">S/No</TableHead>
                    <TableHead>Particulars</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Amount (KES)</TableHead>
                    <TableHead className="text-right whitespace-nowrap">% of Net Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {statement.sections.map((section) => (
                    <Fragment key={section.key}>
                      <TableRow className="bg-muted/60 hover:bg-muted/60">
                        <TableCell colSpan={4} className="font-bold uppercase text-xs tracking-wide">{section.title}</TableCell>
                      </TableRow>
                      {section.groups.map((group, g) => (
                        <Fragment key={g}>
                          {group.title && (
                            <TableRow>
                              <TableCell />
                              <TableCell colSpan={3} className="font-semibold">{group.title}</TableCell>
                            </TableRow>
                          )}
                          {group.lines.map((line) => {
                            serial += 1
                            return (
                              <Fragment key={line.key}>
                                <TableRow>
                                  <TableCell className="text-muted-foreground">{serial}</TableCell>
                                  <TableCell className={group.title ? "pl-6" : ""}>{line.label}</TableCell>
                                  <TableCell className="text-right whitespace-nowrap">{money(line.amount)}</TableCell>
                                  <TableCell className="text-right text-muted-foreground">{share(line.amount)}</TableCell>
                                </TableRow>
                                {line.accounts.map((account) => (
                                  <TableRow key={account.code} className="text-xs text-muted-foreground border-0">
                                    <TableCell className="py-1" />
                                    <TableCell className={`py-1 ${group.title ? "pl-10" : "pl-6"}`}>{account.code} {account.name}</TableCell>
                                    <TableCell className="py-1 text-right whitespace-nowrap">{money(account.amount)}</TableCell>
                                    <TableCell className="py-1" />
                                  </TableRow>
                                ))}
                              </Fragment>
                            )
                          })}
                          {group.title && (
                            <TableRow>
                              <TableCell />
                              <TableCell className="font-medium">Total {group.title}</TableCell>
                              <TableCell className="text-right font-medium whitespace-nowrap">{money(group.total)}</TableCell>
                              <TableCell className="text-right text-muted-foreground">{share(group.total)}</TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      ))}
                      {section.total_label && (
                        <TableRow>
                          <TableCell />
                          <TableCell className="font-semibold">{section.total_label}</TableCell>
                          <TableCell className="text-right font-semibold whitespace-nowrap">{money(section.total)}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{share(section.total)}</TableCell>
                        </TableRow>
                      )}
                      <TableRow className={section.key === "tax" ? "bg-[#1E2764]/10 hover:bg-[#1E2764]/10" : "bg-muted/30 hover:bg-muted/30"}>
                        <TableCell />
                        <TableCell className={`font-bold ${section.key === "tax" ? "text-base" : ""}`}>{section.subtotal_label}</TableCell>
                        <TableCell className={`text-right font-bold whitespace-nowrap ${section.key === "tax" ? "text-base" : ""} ${section.subtotal < 0 ? "text-red-600" : ""}`}>{money(section.subtotal)}</TableCell>
                        <TableCell className="text-right font-medium">{share(section.subtotal)}</TableCell>
                      </TableRow>
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
