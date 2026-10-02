"use client"

import { useEffect, useRef, useState, use } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { fetchCustomerStatement, CustomerStatement } from "@/lib/customer-statements"
import { getCustomerDisplayName } from "@/lib/customers"
import { ArrowLeft, Download, Printer, Loader2, FileSpreadsheet } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

function toNumber(amount: string | number | null | undefined): number {
  if (amount === null || amount === undefined) return 0
  return typeof amount === "string" ? parseFloat(amount) || 0 : amount
}

function formatAmount(amount: string | number | null | undefined): string {
  return toNumber(amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-GB")
}

function toDateString(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function firstOfMonthString() {
  const d = new Date()
  return toDateString(new Date(d.getFullYear(), d.getMonth(), 1))
}

function lastOfMonthString() {
  const d = new Date()
  return toDateString(new Date(d.getFullYear(), d.getMonth() + 1, 0))
}

const PERIOD_PRESETS: { label: string; range: () => [string, string] }[] = [
  { label: "This Month", range: () => [firstOfMonthString(), lastOfMonthString()] },
  {
    label: "Last Month",
    range: () => {
      const d = new Date()
      return [toDateString(new Date(d.getFullYear(), d.getMonth() - 1, 1)), toDateString(new Date(d.getFullYear(), d.getMonth(), 0))]
    },
  },
  { label: "This Year", range: () => [`${new Date().getFullYear()}-01-01`, `${new Date().getFullYear()}-12-31`] },
  { label: "Last Year", range: () => [`${new Date().getFullYear() - 1}-01-01`, `${new Date().getFullYear() - 1}-12-31`] },
]

function csvCell(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? "" : String(value)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const TH = "text-left px-2 py-2 font-semibold text-gray-700 border-b-2 border-gray-800"
const TD = "px-2 py-2 border-b border-gray-200 align-top"

export default function CustomerStatementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { toast } = useToast()
  const statementRef = useRef<HTMLDivElement>(null)

  const [statement, setStatement] = useState<CustomerStatement | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDownloading, setIsDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [dateFrom, setDateFrom] = useState(firstOfMonthString())
  const [dateTo, setDateTo] = useState(lastOfMonthString())

  const loadStatement = async (from = dateFrom, to = dateTo) => {
    if (from && to && from > to) {
      toast({ title: "Invalid period", description: "The From date must be on or before the To date.", variant: "destructive" })
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const data = await fetchCustomerStatement(id, { date_from: from, date_to: to })
      setStatement(data)
    } catch (err: any) {
      setError(err.message || "Failed to load statement")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadStatement()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const applyPreset = (range: [string, string]) => {
    setDateFrom(range[0])
    setDateTo(range[1])
    loadStatement(range[0], range[1])
  }

  if (isLoading && !statement) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !statement) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 p-6 rounded-lg">
          <h2 className="text-lg font-semibold text-red-800">Error Loading Statement</h2>
          <p className="mt-2 text-red-600">{error || "Statement not found"}</p>
          <Button variant="outline" onClick={() => router.back()} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    )
  }

  const customerName = getCustomerDisplayName(statement.customer)
  const transactions = statement.transactions ?? []
  const totalDebits = transactions.reduce((s, t) => s + toNumber(t.debit), 0)
  const totalCredits = transactions.reduce((s, t) => s + toNumber(t.credit), 0)
  const ageing = statement.ageing
  const ageingBase = ageing ? ageing.buckets.reduce((s, b) => s + b.amount, 0) : 0
  const pendingBills = statement.pending_bills ?? []
  const pendingTotal = pendingBills.reduce((sum, bill) => sum + toNumber(bill.pending_amount), 0)
  const pdCheques = statement.pd_cheques ?? []
  const account = statement.account
  const paymentDetails = statement.company?.payment_details
  const hasPaymentDetails = !!paymentDetails && Object.values(paymentDetails).some((v) => !!v)
  const closing = toNumber(statement.closing_balance)
  const statementDate = formatDate(statement.period.to)
  const fileBase = `Statement-${customerName}-${statement.period.from}-to-${statement.period.to}`

  const handleDownloadCSV = () => {
    const rows: (string | number | null | undefined)[][] = []
    rows.push([statement.company?.name ?? "", "STATEMENT OF ACCOUNT"])
    rows.push(["Customer", customerName])
    rows.push(["Account No.", account?.account_number ?? ""])
    rows.push(["Period", statement.period.label])
    rows.push(["Statement Date", statementDate])
    rows.push([])

    rows.push(["1. TRANSACTION STATEMENT"])
    rows.push(["Date", "Reference", "Description", "Debit (KES)", "Credit (KES)", "Balance (KES)"])
    for (const t of transactions) {
      rows.push([
        formatDate(t.date),
        t.reference,
        t.description,
        t.debit ? toNumber(t.debit).toFixed(2) : "",
        t.credit ? toNumber(t.credit).toFixed(2) : "",
        toNumber(t.balance).toFixed(2),
      ])
    }
    rows.push(["", "", "Totals", totalDebits.toFixed(2), totalCredits.toFixed(2), closing.toFixed(2)])
    rows.push(["Total Outstanding (KES)", closing.toFixed(2)])
    rows.push([])

    if (ageing) {
      rows.push([`2. ACCOUNTS RECEIVABLE AGEING ANALYSIS (as at ${formatDate(ageing.as_at)})`])
      rows.push(["Ageing Category", "Amount (KES)", "% of Total"])
      for (const b of ageing.buckets) {
        rows.push([b.label, b.amount.toFixed(2), ageingBase > 0 ? ((b.amount / ageingBase) * 100).toFixed(1) + "%" : "0.0%"])
      }
      if (ageing.unallocated !== 0) rows.push(["Unallocated payments / credits", ageing.unallocated.toFixed(2), ""])
      rows.push(["Total", ageing.total.toFixed(2), ""])
      rows.push([])
    }

    if (pendingBills.length > 0) {
      rows.push(["3. OUTSTANDING INVOICES"])
      rows.push(["Invoice Date", "Invoice No.", "Invoice Amount", "Balance Due", "Due Date", "Days Overdue"])
      for (const b of pendingBills) {
        rows.push([formatDate(b.invoice_date), b.invoice_number, toNumber(b.opening_amount).toFixed(2), toNumber(b.pending_amount).toFixed(2), formatDate(b.due_date), b.overdue_days])
      }
      rows.push(["", "Total", "", pendingTotal.toFixed(2)])
      rows.push([])
    }

    if (pdCheques.length > 0) {
      rows.push(["POST-DATED CHEQUES HELD"])
      rows.push(["Received", "Cheque No.", "Bank", "Maturity", "Status", "Amount (KES)"])
      for (const c of pdCheques) {
        rows.push([formatDate(c.issue_date), c.cheque_number, c.bank_name, formatDate(c.maturity_date), c.status, toNumber(c.amount).toFixed(2)])
      }
      rows.push([])
    }

    if (hasPaymentDetails && paymentDetails) {
      rows.push(["PAYMENT DETAILS"])
      rows.push(["Bank Name", paymentDetails.bank_name])
      rows.push(["Account Name", paymentDetails.account_name])
      rows.push(["Account Number", paymentDetails.account_number])
      rows.push(["Branch", paymentDetails.bank_branch])
      rows.push(["M-PESA Paybill", paymentDetails.mpesa_paybill])
      rows.push(["M-PESA Account", paymentDetails.mpesa_account_number])
    }

    const csv = "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n")
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
    const a = document.createElement("a")
    a.href = url
    a.download = `${fileBase}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDownloadPDF = async () => {
    if (!statementRef.current) return
    setIsDownloading(true)
    try {
      const html2canvas = (await import("html2canvas")).default
      const { jsPDF } = await import("jspdf")

      const canvas = await html2canvas(statementRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
      })

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
      const margin = 8
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const imgWidth = pageWidth - margin * 2
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      const usableHeight = pageHeight - margin * 2
      const imgData = canvas.toDataURL("image/png")

      // Long statements span multiple A4 pages rather than being shrunk onto one.
      let offset = 0
      let page = 0
      while (offset < imgHeight) {
        if (page > 0) pdf.addPage()
        pdf.addImage(imgData, "PNG", margin, margin - offset, imgWidth, imgHeight)
        pdf.setFillColor(255, 255, 255)
        pdf.rect(0, 0, pageWidth, margin, "F")
        pdf.rect(0, pageHeight - margin, pageWidth, margin, "F")
        offset += usableHeight
        page++
      }
      const pageCount = page
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i)
        pdf.setFontSize(8)
        pdf.setTextColor(120)
        pdf.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 3, { align: "right" })
      }

      pdf.save(`${fileBase}.pdf`)
      toast({ title: "Success", description: "Statement PDF downloaded successfully" })
    } catch (err) {
      console.error("Failed to generate PDF:", err)
      toast({ title: "Error", description: "Failed to generate PDF. Please try printing instead.", variant: "destructive" })
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 print:min-h-0 print:bg-white">
      {/* Action Bar - hidden on print */}
      <div className="bg-white border-b print:hidden sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Button variant="ghost" onClick={() => router.back()} size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>

            <div className="flex flex-wrap items-end gap-3">
              <div className="grid gap-1">
                <Label htmlFor="date_from" className="text-xs">From</Label>
                <Input id="date_from" type="date" className="h-8 w-[150px]" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="date_to" className="text-xs">To</Label>
                <Input id="date_to" type="date" className="h-8 w-[150px]" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
              <Button size="sm" onClick={() => loadStatement()} disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                View
              </Button>
              <div className="flex flex-wrap gap-1">
                {PERIOD_PRESETS.map((p) => (
                  <Button key={p.label} variant="ghost" size="sm" className="h-8 px-2 text-xs" disabled={isLoading} onClick={() => applyPreset(p.range())}>
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleDownloadCSV}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownloadPDF} disabled={isDownloading}>
                {isDownloading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                {isDownloading ? "Generating..." : "Download PDF"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Statement Document */}
      <div className="container mx-auto px-4 py-8 print:p-0 print:m-0 print:max-w-none">
        <Card
          ref={statementRef}
          className="max-w-4xl mx-auto bg-white p-6 md:p-10 shadow-lg print:shadow-none print:max-w-none print:m-0 print:p-6 print:border-0 text-sm text-gray-900"
        >
          {statement.company?.letterhead_url ? (
            <img
              src={statement.company.letterhead_url}
              alt={`${statement.company.name} letterhead`}
              className="w-full h-auto mb-6"
              crossOrigin="anonymous"
            />
          ) : (
            <p className="text-lg font-bold mb-6">{statement.company?.name}</p>
          )}

          {/* Title */}
          <div className="flex flex-wrap items-end justify-between gap-2 border-b-2 border-gray-800 pb-3 mb-5">
            <div>
              <h1 className="text-2xl font-bold tracking-wide">STATEMENT OF ACCOUNT</h1>
              <p className="text-sm text-gray-600 mt-1">For the period {statement.period.label}</p>
            </div>
            <div className="text-right text-sm">
              <p><span className="text-gray-500">Statement Date:</span> <span className="font-semibold">{statementDate}</span></p>
              {account?.account_number && (
                <p><span className="text-gray-500">Account No.:</span> <span className="font-semibold">{account.account_number}</span></p>
              )}
            </div>
          </div>

          {/* Customer + Account */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Statement To</p>
              <p className="font-semibold text-base">{customerName}</p>
              {statement.customer.address && <p className="text-gray-700">{statement.customer.address}</p>}
              {statement.customer.phone && <p className="text-gray-700">Tel: {statement.customer.phone}</p>}
              {statement.customer.email && <p className="text-gray-700">{statement.customer.email}</p>}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Account Summary</p>
              <table className="w-full text-sm">
                <tbody>
                  <tr>
                    <td className="py-0.5 text-gray-600">Payment Terms</td>
                    <td className="py-0.5 text-right font-medium">
                      {account?.payment_method === "credit" && account.credit_days ? `Net ${account.credit_days} days` : "Cash"}
                    </td>
                  </tr>
                  {account?.credit_limit != null && (
                    <tr>
                      <td className="py-0.5 text-gray-600">Credit Limit</td>
                      <td className="py-0.5 text-right font-medium">KES {formatAmount(account.credit_limit)}</td>
                    </tr>
                  )}
                  {account?.available_credit != null && (
                    <tr>
                      <td className="py-0.5 text-gray-600">Available Credit</td>
                      <td className="py-0.5 text-right font-medium">KES {formatAmount(account.available_credit)}</td>
                    </tr>
                  )}
                  <tr>
                    <td className="py-0.5 text-gray-600">Opening Balance</td>
                    <td className="py-0.5 text-right font-medium">KES {formatAmount(statement.opening_balance)}</td>
                  </tr>
                  <tr>
                    <td className="py-0.5 text-gray-600">Invoiced this Period</td>
                    <td className="py-0.5 text-right font-medium">KES {formatAmount(totalDebits)}</td>
                  </tr>
                  <tr>
                    <td className="py-0.5 text-gray-600">Payments &amp; Credits</td>
                    <td className="py-0.5 text-right font-medium">KES {formatAmount(totalCredits)}</td>
                  </tr>
                  <tr className="border-t border-gray-300">
                    <td className="pt-1.5 font-semibold">Amount Due</td>
                    <td className="pt-1.5 text-right text-base font-bold">KES {formatAmount(closing)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 1. Transaction Statement */}
          <section className="mb-8">
            <h2 className="text-base font-bold mb-2">1. Transaction Statement</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse tabular-nums">
                <thead>
                  <tr>
                    <th className={`${TH} w-24`}>Date</th>
                    <th className={`${TH} w-32`}>Reference</th>
                    <th className={TH}>Description</th>
                    <th className={`${TH} text-right w-28`}>Debit (KES)</th>
                    <th className={`${TH} text-right w-28`}>Credit (KES)</th>
                    <th className={`${TH} text-right w-32`}>Balance (KES)</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t, i) => {
                    const isLast = i === transactions.length - 1
                    return (
                      <tr key={i} className={t.type === "opening" ? "bg-gray-50" : ""}>
                        <td className={TD}>{formatDate(t.date)}</td>
                        <td className={TD}>{t.reference}</td>
                        <td className={TD}>{t.description}</td>
                        <td className={`${TD} text-right`}>{t.debit ? formatAmount(t.debit) : "—"}</td>
                        <td className={`${TD} text-right`}>{t.credit ? formatAmount(t.credit) : "—"}</td>
                        <td className={`${TD} text-right ${isLast ? "font-bold" : ""}`}>{formatAmount(t.balance)}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="font-semibold">
                    <td colSpan={3} className="px-2 py-2 border-t-2 border-gray-800 text-right">Period Totals</td>
                    <td className="px-2 py-2 border-t-2 border-gray-800 text-right">{formatAmount(totalDebits)}</td>
                    <td className="px-2 py-2 border-t-2 border-gray-800 text-right">{formatAmount(totalCredits)}</td>
                    <td className="px-2 py-2 border-t-2 border-gray-800 text-right">{formatAmount(closing)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {transactions.length <= 1 && (
              <p className="text-xs text-gray-500 italic mt-2">No transactions recorded in this period.</p>
            )}
            <p className="mt-4 text-base font-bold">Total Outstanding: KES {formatAmount(closing)}</p>
          </section>

          {/* 2. Ageing */}
          {ageing && (
            <section className="mb-8 border-t border-gray-200 pt-6">
              <h2 className="text-base font-bold mb-1">2. Accounts Receivable Ageing Analysis</h2>
              <p className="text-xs text-gray-500 mb-2">As at {formatDate(ageing.as_at)}, by days past invoice due date</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse tabular-nums">
                  <thead>
                    <tr>
                      <th className={TH}>Ageing Category</th>
                      <th className={`${TH} text-right w-36`}>Amount (KES)</th>
                      <th className={`${TH} text-right w-24`}>% of Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ageing.buckets.map((b) => (
                      <tr key={b.label}>
                        <td className={TD}>{b.label}</td>
                        <td className={`${TD} text-right`}>{formatAmount(b.amount)}</td>
                        <td className={`${TD} text-right text-gray-600`}>
                          {ageingBase > 0 ? `${((b.amount / ageingBase) * 100).toFixed(1)}%` : "0.0%"}
                        </td>
                      </tr>
                    ))}
                    {ageing.unallocated !== 0 && (
                      <tr>
                        <td className={`${TD} italic text-gray-600`}>
                          {ageing.unallocated < 0 ? "Less: unallocated payments / credits" : "Add: unallocated balance"}
                        </td>
                        <td className={`${TD} text-right`}>{formatAmount(ageing.unallocated)}</td>
                        <td className={TD}></td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="font-bold">
                      <td className="px-2 py-2 border-t-2 border-gray-800">Total Outstanding</td>
                      <td className="px-2 py-2 border-t-2 border-gray-800 text-right">{formatAmount(ageing.total)}</td>
                      <td className="px-2 py-2 border-t-2 border-gray-800"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          )}

          {/* 3. Outstanding Invoices */}
          {pendingBills.length > 0 && (
            <section className="mb-8 border-t border-gray-200 pt-6">
              <h2 className="text-base font-bold mb-2">3. Outstanding Invoices</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse tabular-nums">
                  <thead>
                    <tr>
                      <th className={`${TH} w-24`}>Invoice Date</th>
                      <th className={TH}>Invoice No.</th>
                      <th className={`${TH} text-right w-28`}>Invoice Amt</th>
                      <th className={`${TH} text-right w-28`}>Balance Due</th>
                      <th className={`${TH} w-24`}>Due Date</th>
                      <th className={`${TH} text-right w-24`}>Days Overdue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingBills.map((bill) => (
                      <tr key={bill.invoice_id}>
                        <td className={TD}>{formatDate(bill.invoice_date)}</td>
                        <td className={TD}>{bill.invoice_number}</td>
                        <td className={`${TD} text-right`}>{formatAmount(bill.opening_amount)}</td>
                        <td className={`${TD} text-right`}>{formatAmount(bill.pending_amount)}</td>
                        <td className={TD}>{formatDate(bill.due_date)}</td>
                        <td className={`${TD} text-right ${bill.overdue_days > 0 ? "text-red-700 font-semibold" : ""}`}>
                          {bill.overdue_days > 0 ? bill.overdue_days : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-semibold">
                      <td colSpan={3} className="px-2 py-2 border-t-2 border-gray-800 text-right">Total</td>
                      <td className="px-2 py-2 border-t-2 border-gray-800 text-right">{formatAmount(pendingTotal)}</td>
                      <td colSpan={2} className="px-2 py-2 border-t-2 border-gray-800"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          )}

          {/* Post-dated cheques - held, not yet credited to the account */}
          {pdCheques.length > 0 && (
            <section className="mb-8 border-t border-gray-200 pt-6">
              <h2 className="text-base font-bold mb-1">Post-Dated Cheques Held</h2>
              <p className="text-xs text-gray-500 mb-2">Credited to the account only once cleared.</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse tabular-nums">
                  <thead>
                    <tr>
                      <th className={`${TH} w-24`}>Received</th>
                      <th className={TH}>Cheque No.</th>
                      <th className={TH}>Bank</th>
                      <th className={`${TH} w-24`}>Maturity</th>
                      <th className={`${TH} w-24`}>Status</th>
                      <th className={`${TH} text-right w-28`}>Amount (KES)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pdCheques.map((c) => (
                      <tr key={c.id}>
                        <td className={TD}>{formatDate(c.issue_date)}</td>
                        <td className={TD}>{c.cheque_number}</td>
                        <td className={TD}>{c.bank_name}</td>
                        <td className={TD}>{formatDate(c.maturity_date)}</td>
                        <td className={`${TD} capitalize`}>{c.status.replace(/_/g, " ")}</td>
                        <td className={`${TD} text-right`}>{formatAmount(c.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Payment Details + Remittance */}
          <section className="border-t-2 border-gray-800 pt-5 grid grid-cols-1 md:grid-cols-2 gap-6">
            {hasPaymentDetails && paymentDetails ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Payment Details</p>
                <div className="space-y-0.5 text-xs">
                  {paymentDetails.bank_name && <p><span className="font-semibold">Bank:</span> {paymentDetails.bank_name}</p>}
                  {paymentDetails.account_name && <p><span className="font-semibold">Account Name:</span> {paymentDetails.account_name}</p>}
                  {paymentDetails.account_number && <p><span className="font-semibold">Account No.:</span> {paymentDetails.account_number}</p>}
                  {paymentDetails.bank_branch && <p><span className="font-semibold">Branch:</span> {paymentDetails.bank_branch}</p>}
                  {paymentDetails.mpesa_paybill && (
                    <p className="pt-1">
                      <span className="font-semibold">M-PESA Paybill:</span> {paymentDetails.mpesa_paybill}
                      {paymentDetails.mpesa_account_number && <> &nbsp;<span className="font-semibold">Account:</span> {paymentDetails.mpesa_account_number}</>}
                    </p>
                  )}
                </div>
              </div>
            ) : <div />}
            <div className="text-xs text-gray-600 space-y-1">
              <p>Please quote your account number{account?.account_number ? ` (${account.account_number})` : ""} and invoice numbers with every payment.</p>
              <p>Kindly report any discrepancies within 14 days of the statement date, otherwise the balance shown will be deemed correct.</p>
              <p className="pt-2 text-gray-400">This is a computer-generated statement and does not require a signature.</p>
            </div>
          </section>
        </Card>
      </div>
    </div>
  )
}
