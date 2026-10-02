"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ChartSkeleton } from "@/components/ui/skeletons"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { 
  ArrowLeft,
  Download,
  Calendar,
  Printer,
  CheckCircle,
  AlertTriangle
} from "lucide-react"
import { 
  getBalanceSheet, 
  formatCurrency 
} from "@/lib/finance"
import { useToast } from "@/hooks/use-toast"
import { format } from "date-fns"

interface BalanceSheetData {
  report_date: string
  balance_sheet: {
    assets: {
      accounts: Array<{
        account_id: string
        account_code: string
        account_name: string
        balance: string
      }>
      total: string
    }
    liabilities: {
      accounts: Array<{
        account_id: string
        account_code: string
        account_name: string
        balance: string
      }>
      total: string
    }
    equity: {
      accounts: Array<{
        account_id: string
        account_code: string
        account_name: string
        balance: string
      }>
      total: string
    }
    total_liabilities_and_equity: string
    is_balanced: boolean
  }
}

export default function BalanceSheetPage() {
  const [balanceSheetData, setBalanceSheetData] = useState<BalanceSheetData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [asOfDate, setAsOfDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const { toast } = useToast()

  useEffect(() => {
    fetchBalanceSheet()
  }, [asOfDate])

  const fetchBalanceSheet = async () => {
    try {
      setIsLoading(true)
      const response = await getBalanceSheet({ as_of_date: asOfDate })
      
      // Transform the response to match our interface
      const transformedData: BalanceSheetData = {
        report_date: response.report_date || asOfDate,
        balance_sheet: {
          assets: response.assets || { accounts: [], total: "0" },
          liabilities: response.liabilities || { accounts: [], total: "0" },
          equity: response.equity || { accounts: [], total: "0" },
          total_liabilities_and_equity: response.total_liabilities_and_equity || "0",
          is_balanced: response.is_balanced || false
        }
      }
      
      setBalanceSheetData(transformedData)
    } catch (error) {
      console.error('Error fetching balance sheet:', error)
      toast({
        title: "Error",
        description: "Failed to fetch balance sheet data. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const exportToPDF = () => {
    window.print()
  }

  const exportToCSV = () => {
    if (!balanceSheetData) return

    const headers = ['Account Type', 'Account Code', 'Account Name', 'Balance']
    const rows: string[][] = []

    // Assets
    rows.push(['ASSETS', '', '', ''])
    balanceSheetData.balance_sheet.assets.accounts.forEach(account => {
      rows.push(['Asset', account.account_code, account.account_name, account.balance])
    })
    rows.push(['', '', 'Total Assets', balanceSheetData.balance_sheet.assets.total])
    rows.push(['', '', '', ''])

    // Liabilities
    rows.push(['LIABILITIES', '', '', ''])
    balanceSheetData.balance_sheet.liabilities.accounts.forEach(account => {
      rows.push(['Liability', account.account_code, account.account_name, account.balance])
    })
    rows.push(['', '', 'Total Liabilities', balanceSheetData.balance_sheet.liabilities.total])
    rows.push(['', '', '', ''])

    // Equity
    rows.push(['EQUITY', '', '', ''])
    balanceSheetData.balance_sheet.equity.accounts.forEach(account => {
      rows.push(['Equity', account.account_code, account.account_name, account.balance])
    })
    rows.push(['', '', 'Total Equity', balanceSheetData.balance_sheet.equity.total])
    rows.push(['', '', '', ''])
    rows.push(['', '', 'Total Liabilities and Equity', balanceSheetData.balance_sheet.total_liabilities_and_equity])

    const csvContent = [headers, ...rows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `balance-sheet-${asOfDate}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  if (isLoading) {
    return <ChartSkeleton height="h-[600px]" />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/finance/reports">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Reports
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Balance Sheet</h1>
            <p className="text-muted-foreground">
              Statement of financial position
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportToCSV} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button onClick={exportToPDF} variant="outline" size="sm">
            <Printer className="h-4 w-4 mr-2" />
            Print PDF
          </Button>
        </div>
      </div>

      {/* Parameters */}
      <Card>
        <CardHeader>
          <CardTitle>Report Parameters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">As of Date</label>
              <div className="relative">
                <Calendar className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={asOfDate}
                  onChange={(e) => setAsOfDate(e.target.value)}
                  className="pl-8 w-48"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 mt-6">
              {balanceSheetData?.balance_sheet.is_balanced ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-sm text-green-600 font-medium">Balance Sheet is Balanced</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  <span className="text-sm text-red-600 font-medium">Balance Sheet is Out of Balance</span>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Balance Sheet */}
      <div className="print-area">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Balance Sheet</CardTitle>
            <CardDescription className="text-lg">
              As of {format(new Date(asOfDate), 'MMMM dd, yyyy')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-8 lg:grid-cols-2">
              {/* Assets */}
              <div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead colSpan={2} className="text-center bg-muted font-bold text-lg">
                        ASSETS
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {balanceSheetData?.balance_sheet.assets.accounts.map((account) => (
                      <TableRow key={account.account_id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{account.account_name}</div>
                            <div className="text-sm text-muted-foreground font-mono">
                              {account.account_code}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(account.balance)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-t-2 border-black">
                      <TableCell className="font-bold text-lg">Total Assets</TableCell>
                      <TableCell className="text-right font-mono font-bold text-lg">
                        {formatCurrency(balanceSheetData?.balance_sheet.assets.total || '0')}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {/* Liabilities and Equity */}
              <div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead colSpan={2} className="text-center bg-muted font-bold text-lg">
                        LIABILITIES AND EQUITY
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Liabilities Section */}
                    <TableRow>
                      <TableCell colSpan={2} className="font-semibold bg-gray-50">
                        LIABILITIES
                      </TableCell>
                    </TableRow>
                    {balanceSheetData?.balance_sheet.liabilities.accounts.map((account) => (
                      <TableRow key={account.account_id}>
                        <TableCell className="pl-4">
                          <div>
                            <div className="font-medium">{account.account_name}</div>
                            <div className="text-sm text-muted-foreground font-mono">
                              {account.account_code}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(account.balance)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-t">
                      <TableCell className="font-semibold">Total Liabilities</TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {formatCurrency(balanceSheetData?.balance_sheet.liabilities.total || '0')}
                      </TableCell>
                    </TableRow>

                    {/* Equity Section */}
                    <TableRow>
                      <TableCell colSpan={2} className="font-semibold bg-gray-50 pt-4">
                        EQUITY
                      </TableCell>
                    </TableRow>
                    {balanceSheetData?.balance_sheet.equity.accounts.map((account) => (
                      <TableRow key={account.account_id}>
                        <TableCell className="pl-4">
                          <div>
                            <div className="font-medium">{account.account_name}</div>
                            <div className="text-sm text-muted-foreground font-mono">
                              {account.account_code}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(account.balance)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-t">
                      <TableCell className="font-semibold">Total Equity</TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {formatCurrency(balanceSheetData?.balance_sheet.equity.total || '0')}
                      </TableCell>
                    </TableRow>

                    {/* Total Liabilities and Equity */}
                    <TableRow className="border-t-2 border-black">
                      <TableCell className="font-bold text-lg">Total Liabilities and Equity</TableCell>
                      <TableCell className="text-right font-mono font-bold text-lg">
                        {formatCurrency(balanceSheetData?.balance_sheet.total_liabilities_and_equity || '0')}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Balance Check */}
            {!balanceSheetData?.balance_sheet.is_balanced && (
              <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="h-5 w-5" />
                  <span className="font-medium">Balance Sheet Error</span>
                </div>
                <p className="text-sm text-red-600 mt-1">
                  Total Assets does not equal Total Liabilities and Equity. Please review your journal entries.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <style jsx>{`
        @media print {
          .print-area {
            margin: 0;
            box-shadow: none;
          }
          .no-print {
            display: none;
          }
        }
      `}</style>
    </div>
  )
}
