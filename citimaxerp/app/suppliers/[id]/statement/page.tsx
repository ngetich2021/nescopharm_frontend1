"use client"

import { errorText } from "@/lib/error-message"
import { displayDate } from "@/lib/date-format"
import { useEffect, useRef, useState, use } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { getSupplierStatement, SupplierStatement, SupplierBillRow } from "@/lib/suppliers"
import { ArrowLeft, Printer, Loader2 } from "lucide-react"
import { BillsDue } from "@/app/supplier-payments/components/bills-due"
import { useToast } from "@/hooks/use-toast"
import { documentFileName, filePeriod, printWithFileName } from "@/lib/document-names"
import { addCanvasToPdf, fixTextOffset } from "@/lib/pdf-capture"
import { exportTable, type ExportFormat, type TableExport } from "@/lib/table-export"
import { ExportMenu } from "@/components/export-menu"
import { useOptionalAuth } from "@/lib/auth-context"

const money = (n: number | string | null | undefined) =>
  Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function formatDate(value: string | null | undefined): string {
  if (!value) return ""
  const d = new Date(value)
  return isNaN(d.getTime()) ? value : displayDate(d)
}

function toDateString(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

const PERIOD_PRESETS: { label: string; range: () => [string, string] }[] = [
  {
    label: "This Month",
    range: () => {
      const d = new Date()
      return [toDateString(new Date(d.getFullYear(), d.getMonth(), 1)), toDateString(new Date(d.getFullYear(), d.getMonth() + 1, 0))]
    },
  },
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

const STATUS_CLASS: Record<SupplierBillRow["status"], string> = {
  Paid: "text-green-700",
  "Part Paid": "text-amber-700",
  Unpaid: "text-blue-700",
  Overdue: "text-red-700 font-semibold",
}

// On paper: tight rows and one line per cell, as on the customer statement.
const TH = "text-left px-2 py-2 print:px-1 print:py-1 font-semibold text-gray-700 border-b-2 border-gray-800 print:whitespace-nowrap"
const TD = "px-2 py-2 print:px-1 print:py-[2px] border-b border-gray-200 align-top"
const TF = "px-2 py-2 print:px-1 print:py-1 border-t-2 border-gray-800 print:whitespace-nowrap"
const TABLE = "w-full text-xs print:text-[9px] print:leading-tight border-collapse tabular-nums"

/**
 * A supplier's statement of account, laid out like the customer statement, plus the bills payable
 * tracker: each bill due on its date + the supplier's credit days, payments clearing the oldest first,
 * Unpaid while within terms and Overdue after, and a payment plan of what falls due by a cut-off date.
 */
export default function SupplierStatementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { toast } = useToast()
  const company = useOptionalAuth()?.userProfile?.company
  const statementRef = useRef<HTMLDivElement>(null)

  const [statement, setStatement] = useState<SupplierStatement | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDownloading, setIsDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  // Optional sections, left off (screen, print and downloads) unless ticked.
  // billsDue: like Pending Bills Only, the page is just this supplier's bills due for payment, to pay.
  const [include, setInclude] = useState({ pendingOnly: false, billsDue: false, allBills: false, plan: true })
  // Payment plan cut-off: what must be paid in a batch up to this date. End of this month by default.
  const [cutOff, setCutOff] = useState(() => {
    const d = new Date()
    return toDateString(new Date(d.getFullYear(), d.getMonth() + 1, 0))
  })

  const load = async (opts: { from?: string; to?: string; all?: boolean }) => {
    if (opts.from && opts.to && opts.from > opts.to) {
      toast({ title: "Invalid period", description: "The From date must be on or before the To date.", variant: "destructive" })
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const data = await getSupplierStatement(id, opts)
      setStatement(data)
      if (opts.all && data.period) {
        setDateFrom(data.period.from ?? "")
        setDateTo(data.period.to)
      }
    } catch (err: any) {
      setError(err.message || "Failed to load statement")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    load({ all: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // A payment made from Bills Due for Payment shows on the statement straight away.
  useEffect(() => {
    const refresh = () => load(dateFrom && dateTo ? { from: dateFrom, to: dateTo } : { all: true })
    window.addEventListener("supplier-payment-created", refresh)
    return () => window.removeEventListener("supplier-payment-created", refresh)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, dateFrom, dateTo])

  const applyPreset = (range: [string, string]) => {
    setDateFrom(range[0])
    setDateTo(range[1])
    load({ from: range[0], to: range[1] })
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

  const supplier = statement.supplier
  const supplierName = supplier?.name ?? "Supplier"
  const terms = statement.terms_days ?? Number(supplier?.payment_terms_days ?? 0)
  const entries = statement.entries ?? []
  const totalBilled = entries.reduce((s, e) => s + Number(e.billed || 0), 0)
  const totalPaid = entries.reduce((s, e) => s + Number(e.paid || 0), 0)
  const closing = Number(statement.closing_balance ?? statement.totals.balance)
  const opening = Number(statement.opening_balance ?? 0)
  const bills = statement.bills
  const summary = bills?.summary
  const openBills = (bills?.rows ?? []).filter((b) => b.balance > 0)
  const bucketBase = (bills?.buckets ?? []).reduce((s, b) => s + b.amount, 0)
  const billsDue = include.billsDue
  const pendingOnly = include.pendingOnly && !billsDue
  const showAllBills = include.allBills && !pendingOnly
  const showPlan = include.plan && !pendingOnly && openBills.length > 0
  const asAt = bills?.as_at ?? statement.period?.to ?? toDateString(new Date())
  const statementDate = formatDate(statement.period?.to)
  const fileBase = pendingOnly
    ? documentFileName([supplierName, `Bills Payable ${statementDate.replace(/\//g, "-")}`])
    : documentFileName([supplierName, `Supplier Statement ${filePeriod(statement.period?.from ?? "", statement.period?.to ?? "")}`])

  // Payment plan, as the tracker's batch summary: overdue now, falling due up to the cut-off, then later.
  const overdueNow = openBills.filter((b) => b.due_date < asAt)
  const dueByCutOff = openBills.filter((b) => b.due_date >= asAt && b.due_date <= cutOff)
  const dueLater = openBills.filter((b) => b.due_date > cutOff)
  const sum = (rows: SupplierBillRow[]) => rows.reduce((s, b) => s + b.balance, 0)
  const schedule = Object.entries(
    dueByCutOff.reduce<Record<string, { count: number; amount: number }>>((acc, b) => {
      acc[b.due_date] = acc[b.due_date] ?? { count: 0, amount: 0 }
      acc[b.due_date].count += 1
      acc[b.due_date].amount += b.balance
      return acc
    }, {})
  ).sort(([a], [b]) => a.localeCompare(b))

  // ---------- Downloads ----------
  const details: [string, string][] = [
    ["Supplier", supplierName],
    ["Period", statement.period?.label ?? ""],
    ["Credit terms", `Net ${terms} days`],
    ["Amount owed", `KES ${money(closing)}`],
    ["Of which overdue", `KES ${money(summary?.overdue)}`],
  ]
  const billsSheet = (rows: SupplierBillRow[], title: string): TableExport => ({
    fileName: fileBase,
    title,
    sheetName: title.slice(0, 31),
    subtitle: `As at ${formatDate(asAt)} - due ${terms} days after the bill date, payments clear the oldest bills first`,
    details,
    headers: ["S/No", "Bill Date", "Reference", "Description", "Bill Amount", "Paid", "Balance", "Due Date", "Status", "Days Overdue"],
    moneyColumns: [4, 5, 6],
    rows: rows.map((b, i) => [i + 1, formatDate(b.date), b.reference, b.description, b.amount, b.paid, b.balance, formatDate(b.due_date), b.status, b.days_overdue || ""]),
    footer: [["", "", "", "Total", rows.reduce((s, b) => s + b.amount, 0), rows.reduce((s, b) => s + b.paid, 0), sum(rows), "", "", ""]],
  })
  const statementSheet: TableExport = {
    fileName: fileBase,
    title: "Supplier Statement",
    sheetName: "Statement",
    subtitle: statement.period?.label,
    details,
    headers: ["S/No", "Date", "Reference", "Description", "Billed", "Paid", "Balance"],
    moneyColumns: [4, 5, 6],
    rows: entries.map((e, i) => [i + 1, formatDate(e.date), e.reference, e.description, e.billed || null, e.paid || null, e.balance]),
    footer: [["", "", "", "Period Totals", totalBilled, totalPaid, closing]],
  }
  const planSheet: TableExport = {
    fileName: fileBase,
    title: "Payment Plan",
    sheetName: "Payment Plan",
    subtitle: `To pay by ${formatDate(cutOff)} (${terms}-day credit terms)`,
    details,
    headers: ["Line", "Bills", "Amount (KES)"],
    moneyColumns: [2],
    rows: [
      ["Overdue - due before " + formatDate(asAt), overdueNow.length, sum(overdueNow)],
      [`Falling due ${formatDate(asAt)} to ${formatDate(cutOff)}`, dueByCutOff.length, sum(dueByCutOff)],
      ["TOTAL TO PAY BY " + formatDate(cutOff), overdueNow.length + dueByCutOff.length, sum(overdueNow) + sum(dueByCutOff)],
      [`Not yet due at ${formatDate(cutOff)} (next batches)`, dueLater.length, sum(dueLater)],
      ...schedule.map(([d, v]) => [`Due ${formatDate(d)}`, v.count, v.amount] as [string, number, number]),
    ],
    footer: [["Total outstanding", openBills.length, sum(openBills)]],
  }

  const handleDownloadPDF = async () => {
    if (!statementRef.current) return
    setIsDownloading(true)
    try {
      const html2canvas = (await import("html2canvas")).default
      const { jsPDF } = await import("jspdf")
      const canvas = await html2canvas(statementRef.current, {
        scale: 2, useCORS: true, allowTaint: true, backgroundColor: "#ffffff", logging: false, onclone: fixTextOffset,
      })
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
      const margin = 8
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const pageCount = addCanvasToPdf(pdf, canvas, statementRef.current, margin)
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i)
        pdf.setFontSize(8)
        pdf.setTextColor(120)
        pdf.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 3, { align: "right" })
      }
      pdf.save(`${fileBase}.pdf`)
    } catch (err) {
      console.error("Failed to generate PDF:", err)
      toast({ title: "Error", description: errorText(err, "Failed to generate PDF. Please try printing instead."), variant: "destructive" })
    } finally {
      setIsDownloading(false)
    }
  }

  // PDF is the statement as on screen; Excel/CSV one sheet per section ticked, like the tracker workbook.
  const handleDownload = async (format: ExportFormat) => {
    if (format === "pdf") return handleDownloadPDF()
    const sheets: TableExport[] = pendingOnly
      ? [billsSheet(openBills, "Bills Payable")]
      : [
          statementSheet,
          billsSheet(openBills, "Bills Payable"),
          ...(showAllBills ? [billsSheet(bills?.rows ?? [], "All Bills")] : []),
          ...(showPlan ? [planSheet] : []),
        ]
    await exportTable(format, { ...sheets[0], sheets }, company)
  }

  let section = 0
  const next = () => ++section

  return (
    <div className="min-h-screen bg-gray-50 print:min-h-0 print:bg-white">
      <style>{"@media print { @page { size: A4; margin: 8mm; } }"}</style>
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
              <Button size="sm" onClick={() => load({ from: dateFrom, to: dateTo })} disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                View
              </Button>
              <div className="flex flex-wrap gap-1">
                <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" disabled={isLoading} onClick={() => load({ all: true })}>
                  All Time
                </Button>
                {PERIOD_PRESETS.map((p) => (
                  <Button key={p.label} variant="ghost" size="sm" className="h-8 px-2 text-xs" disabled={isLoading} onClick={() => applyPreset(p.range())}>
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="text-xs text-muted-foreground">Include:</span>
              {([
                ["pendingOnly", "Pending Bills Only"],
                ["billsDue", "Bills Due for Payment"],
                ["allBills", "All Bills (paid too)"],
                ["plan", "Payment Plan"],
              ] as const).map(([key, label]) => {
                // Pending Bills Only and Bills Due for Payment each make the page just that, so the rest is off.
                const off = key === "billsDue" ? false : key === "pendingOnly" ? billsDue : pendingOnly || billsDue
                const bold = key === "pendingOnly" || key === "billsDue"
                return (
                  <label key={key} className={`flex items-center gap-1.5 ${off ? "opacity-50 cursor-not-allowed" : "cursor-pointer"} ${bold ? "font-semibold" : ""} ${key === "billsDue" ? "text-red-700" : ""}`}>
                    <Checkbox checked={include[key]} disabled={off} onCheckedChange={(v) => setInclude((s) => ({ ...s, [key]: v === true }))} />
                    {label}
                  </label>
                )
              })}
              {include.plan && !pendingOnly && !billsDue && (
                <label className="flex items-center gap-1.5 text-xs">
                  Pay by
                  <Input type="date" className="h-8 w-[150px]" value={cutOff} onChange={(e) => e.target.value && setCutOff(e.target.value)} />
                </label>
              )}
            </div>

            {/* Bills Due for Payment has its own Export */}
            <div className={`flex gap-2 ${billsDue ? "invisible" : ""}`}>
              <Button variant="outline" size="sm" onClick={() => printWithFileName(fileBase)}>
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
              <ExportMenu onExport={handleDownload} label="Download" disabled={isDownloading} />
            </div>
          </div>
        </div>
      </div>

      {/* Bills Due for Payment ticked: this supplier's bills past their credit days, to tick and pay */}
      {billsDue && (
        <div className="container mx-auto px-4 py-8">
          <BillsDue supplierId={id} />
        </div>
      )}

      <div className={`container mx-auto px-4 py-8 print:p-0 print:m-0 print:max-w-none ${billsDue ? "hidden" : ""}`}>
        <Card
          ref={statementRef}
          className="max-w-5xl mx-auto bg-white p-6 md:p-10 shadow-lg print:shadow-none print:max-w-none print:m-0 print:p-0 print:border-0 text-sm print:text-[10px] print:leading-snug text-gray-900"
        >
          {statement.company?.letterhead_url ? (
            <img src={statement.company.letterhead_url} alt={`${statement.company.name} letterhead`} className="w-full h-auto mb-6 print:mb-2" crossOrigin="anonymous" />
          ) : (
            <p className="text-lg font-bold mb-6">{statement.company?.name}</p>
          )}

          <div className="flex flex-wrap print:flex-nowrap items-end justify-between gap-2 border-b-2 border-gray-800 pb-3 mb-5 print:pb-1 print:mb-2">
            <div>
              <h1 className="text-2xl print:text-base font-bold tracking-wide">{pendingOnly ? "BILLS PAYABLE" : "SUPPLIER STATEMENT OF ACCOUNT"}</h1>
              <p className="text-sm print:text-[10px] text-gray-600 mt-1 print:mt-0">
                {pendingOnly ? `As at ${formatDate(asAt)}` : `For the period ${statement.period?.label ?? ""}`}
              </p>
            </div>
            <div className="text-right text-sm print:text-[10px]">
              <p><span className="text-gray-500">Statement Date:</span> <span className="font-semibold">{statementDate}</span></p>
            </div>
          </div>

          {/* Supplier + Account */}
          <div className="grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 gap-6 mb-6 print:gap-4 print:mb-2 break-inside-avoid">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Supplier</p>
              <p className="font-semibold text-base print:text-[11px]">{supplierName}</p>
              {supplier?.contact_person && <p className="text-gray-700">Attn: {supplier.contact_person}</p>}
              {supplier?.address && <p className="text-gray-700 whitespace-pre-line">{supplier.address}</p>}
              {supplier?.phone && <p className="text-gray-700">Tel: {supplier.phone}</p>}
              {supplier?.email && <p className="text-gray-700">{supplier.email}</p>}
              {supplier?.tax_information && <p className="text-gray-700 font-semibold">KRA PIN: {supplier.tax_information}</p>}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Account Summary</p>
              <table className="w-full text-sm print:text-[10px]">
                <tbody>
                  <tr>
                    <td className="py-0.5 text-gray-600">Credit Terms</td>
                    <td className="py-0.5 text-right font-medium">{terms > 0 ? `Net ${terms} days` : "Immediate"}</td>
                  </tr>
                  {supplier?.credit_limit != null && Number(supplier.credit_limit) > 0 && (
                    <tr>
                      <td className="py-0.5 text-gray-600">Credit Limit</td>
                      <td className="py-0.5 text-right font-medium">KES {money(supplier.credit_limit)}</td>
                    </tr>
                  )}
                  {!pendingOnly && (
                    <>
                      <tr>
                        <td className="py-0.5 text-gray-600">Opening Balance</td>
                        <td className="py-0.5 text-right font-medium">KES {money(opening)}</td>
                      </tr>
                      <tr>
                        <td className="py-0.5 text-gray-600">Billed this Period</td>
                        <td className="py-0.5 text-right font-medium">KES {money(totalBilled)}</td>
                      </tr>
                      <tr>
                        <td className="py-0.5 text-gray-600">Payments &amp; Debit Notes</td>
                        <td className="py-0.5 text-right font-medium">KES {money(totalPaid)}</td>
                      </tr>
                    </>
                  )}
                  <tr className="border-t border-gray-300">
                    <td className="pt-1.5 font-semibold">Amount Owed</td>
                    <td className="pt-1.5 text-right text-base print:text-[11px] font-bold">KES {money(closing)}</td>
                  </tr>
                  {summary && (
                    <>
                      <tr>
                        <td className="py-0.5 text-blue-700">Unpaid, within {terms} days ({summary.bills_open - summary.bills_overdue} bills)</td>
                        <td className="py-0.5 text-right font-medium text-blue-700">KES {money(summary.within_terms)}</td>
                      </tr>
                      <tr>
                        <td className="py-0.5 text-red-700">Overdue, over {terms} days ({summary.bills_overdue} bills)</td>
                        <td className="py-0.5 text-right font-semibold text-red-700">KES {money(summary.overdue)}</td>
                      </tr>
                      {summary.next_due_date && (
                        <tr>
                          <td className="py-0.5 text-gray-600">Next bill falls due</td>
                          <td className="py-0.5 text-right font-medium">{formatDate(summary.next_due_date)}</td>
                        </tr>
                      )}
                      {summary.advance > 0 && (
                        <tr>
                          <td className="py-0.5 text-gray-600">Paid in advance (not against a bill)</td>
                          <td className="py-0.5 text-right font-medium">KES {money(summary.advance)}</td>
                        </tr>
                      )}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Transaction statement */}
          {!pendingOnly && (
            <section className="mb-8 print:mb-3">
              <h2 className="text-base print:text-[11px] font-bold mb-2 print:mb-1">{next()}. Transaction Statement</h2>
              <div className="overflow-x-auto">
                <table className={TABLE}>
                  <thead>
                    <tr>
                      <th className={`${TH} w-10`}>S/No</th>
                      <th className={`${TH} w-24`}>Date</th>
                      <th className={`${TH} w-32`}>Reference</th>
                      <th className={TH}>Description</th>
                      <th className={`${TH} text-right w-28`}>Billed (KES)</th>
                      <th className={`${TH} text-right w-28`}>Paid (KES)</th>
                      <th className={`${TH} text-right w-32`}>Balance (KES)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e, i) => (
                      <tr key={i} className={e.type === "opening_balance" ? "bg-gray-50" : ""}>
                        <td className={TD}>{i + 1}</td>
                        <td className={`${TD} whitespace-nowrap`}>{formatDate(e.date)}</td>
                        <td className={`${TD} whitespace-nowrap`}>{e.reference}</td>
                        <td className={TD}>{e.description}</td>
                        <td className={`${TD} text-right`}>{e.billed ? money(e.billed) : "—"}</td>
                        <td className={`${TD} text-right`}>{e.paid ? money(e.paid) : "—"}</td>
                        <td className={`${TD} text-right ${i === entries.length - 1 ? "font-bold" : ""}`}>{money(e.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-semibold">
                      <td colSpan={4} className={`${TF} text-right`}>Period Totals</td>
                      <td className={`${TF} text-right`}>{money(totalBilled)}</td>
                      <td className={`${TF} text-right`}>{money(totalPaid)}</td>
                      <td className={`${TF} text-right`}>{money(closing)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {entries.length <= 1 && <p className="text-xs text-gray-500 italic mt-2">No transactions recorded in this period.</p>}
              <p className="mt-4 print:mt-1 text-base print:text-[11px] font-bold">Total Owed: KES {money(closing)}</p>
            </section>
          )}

          {/* Bills payable: each open bill with its due date, status and age */}
          {bills && (
            <section className={pendingOnly ? "mb-8 print:mb-3" : "mb-8 border-t border-gray-200 pt-6 print:mb-3 print:pt-2"}>
              <h2 className="text-base print:text-[11px] font-bold mb-1 print:mb-0.5">{next()}. Bills Payable &amp; Ageing</h2>
              <p className="text-xs text-gray-500 mb-2">
                As at {formatDate(asAt)}. Each bill is due {terms} days after its date; payments clear the oldest bills first.
                Unpaid = still within the {terms} days, Overdue = past them.
              </p>
              {openBills.length === 0 ? (
                <p className="text-sm italic text-gray-600">There are no pending bills: nothing is owed.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className={TABLE}>
                    <thead>
                      <tr>
                        <th className={TH}>S/No</th>
                        <th className={TH}>Bill Date</th>
                        <th className={TH}>Reference</th>
                        <th className={TH}>Due Date</th>
                        <th className={TH}>Status</th>
                        <th className={`${TH} text-right`}>Days Overdue</th>
                        {bills.buckets.map((b) => (
                          <th key={b.label} className={`${TH} text-right`}>{b.label}</th>
                        ))}
                        <th className={`${TH} text-right`}>Balance (KES)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {openBills.map((b, i) => (
                        <tr key={b.reference + i}>
                          <td className={TD}>{i + 1}</td>
                          <td className={`${TD} whitespace-nowrap`}>{formatDate(b.date)}</td>
                          <td className={`${TD} whitespace-nowrap`} title={b.description}>{b.reference}</td>
                          <td className={`${TD} whitespace-nowrap`}>{formatDate(b.due_date)}</td>
                          <td className={`${TD} whitespace-nowrap ${STATUS_CLASS[b.status]}`}>{b.status}</td>
                          <td className={`${TD} text-right ${b.days_overdue > 0 ? "text-red-700 font-semibold" : ""}`}>{b.days_overdue > 0 ? b.days_overdue : "—"}</td>
                          {bills.buckets.map((bk, idx) => (
                            <td key={bk.label} className={`${TD} text-right`}>{idx === b.bucket ? money(b.balance) : ""}</td>
                          ))}
                          <td className={`${TD} text-right`}>{money(b.balance)}</td>
                        </tr>
                      ))}
                      <tr className="font-semibold">
                        <td className={TD} colSpan={6}>Total</td>
                        {bills.buckets.map((b) => (
                          <td key={b.label} className={`${TD} text-right`}>{money(b.amount)}</td>
                        ))}
                        <td className={`${TD} text-right`}>{money(bucketBase)}</td>
                      </tr>
                      <tr>
                        <td className={`${TD} text-gray-600`} colSpan={6}>% of Total</td>
                        {bills.buckets.map((b) => (
                          <td key={b.label} className={`${TD} text-right text-gray-600`}>
                            {bucketBase > 0 ? `${((b.amount / bucketBase) * 100).toFixed(1)}%` : "0.0%"}
                          </td>
                        ))}
                        <td className={TD}></td>
                      </tr>
                      {summary && summary.advance > 0 && (
                        <tr>
                          <td className={`${TD} italic text-gray-600`} colSpan={6 + bills.buckets.length}>Less: paid in advance</td>
                          <td className={`${TD} text-right`}>{money(-summary.advance)}</td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="font-bold">
                        <td className={TF} colSpan={6 + bills.buckets.length}>Total Owed</td>
                        <td className={`${TF} text-right`}>{money(bucketBase - (summary?.advance ?? 0))}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </section>
          )}

          {/* Payment plan: what to pay in a batch up to the cut-off */}
          {showPlan && (
            <section className="mb-8 border-t border-gray-200 pt-6 print:mb-3 print:pt-2 break-inside-avoid">
              <h2 className="text-base print:text-[11px] font-bold mb-1 print:mb-0.5">{next()}. Payment Plan - to pay by {formatDate(cutOff)}</h2>
              <p className="text-xs text-gray-500 mb-2">Bills still owed by their due date ({terms}-day credit terms).</p>
              <div className="grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 gap-6 print:gap-4">
                <table className={TABLE}>
                  <thead>
                    <tr>
                      <th className={TH}></th>
                      <th className={`${TH} text-right`}>Bills</th>
                      <th className={`${TH} text-right`}>Amount (KES)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className={`${TD} text-red-700`}>Overdue - due before {formatDate(asAt)}</td>
                      <td className={`${TD} text-right`}>{overdueNow.length}</td>
                      <td className={`${TD} text-right text-red-700`}>{money(sum(overdueNow))}</td>
                    </tr>
                    <tr>
                      <td className={TD}>Falling due {formatDate(asAt)} to {formatDate(cutOff)}</td>
                      <td className={`${TD} text-right`}>{dueByCutOff.length}</td>
                      <td className={`${TD} text-right`}>{money(sum(dueByCutOff))}</td>
                    </tr>
                    <tr className="font-bold bg-gray-50">
                      <td className={TD}>TOTAL TO PAY BY {formatDate(cutOff)}</td>
                      <td className={`${TD} text-right`}>{overdueNow.length + dueByCutOff.length}</td>
                      <td className={`${TD} text-right`}>{money(sum(overdueNow) + sum(dueByCutOff))}</td>
                    </tr>
                    <tr>
                      <td className={`${TD} text-gray-600`}>Not yet due at {formatDate(cutOff)} (next batches)</td>
                      <td className={`${TD} text-right`}>{dueLater.length}</td>
                      <td className={`${TD} text-right`}>{money(sum(dueLater))}</td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr className="font-semibold">
                      <td className={TF}>Total outstanding</td>
                      <td className={`${TF} text-right`}>{openBills.length}</td>
                      <td className={`${TF} text-right`}>{money(sum(openBills))}</td>
                    </tr>
                  </tfoot>
                </table>
                <table className={TABLE}>
                  <thead>
                    <tr>
                      <th className={TH}>Due Date</th>
                      <th className={`${TH} text-right`}>Bills</th>
                      <th className={`${TH} text-right`}>Amount (KES)</th>
                      <th className={`${TH} text-right`}>Cumulative</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overdueNow.length > 0 && (
                      <tr className="text-red-700">
                        <td className={TD}>Already overdue</td>
                        <td className={`${TD} text-right`}>{overdueNow.length}</td>
                        <td className={`${TD} text-right`}>{money(sum(overdueNow))}</td>
                        <td className={`${TD} text-right`}>{money(sum(overdueNow))}</td>
                      </tr>
                    )}
                    {schedule.map(([d, v], i) => (
                      <tr key={d}>
                        <td className={TD}>{formatDate(d)}</td>
                        <td className={`${TD} text-right`}>{v.count}</td>
                        <td className={`${TD} text-right`}>{money(v.amount)}</td>
                        <td className={`${TD} text-right`}>{money(sum(overdueNow) + schedule.slice(0, i + 1).reduce((s, [, x]) => s + x.amount, 0))}</td>
                      </tr>
                    ))}
                    {schedule.length === 0 && overdueNow.length === 0 && (
                      <tr><td className={`${TD} italic text-gray-500`} colSpan={4}>Nothing falls due by {formatDate(cutOff)}.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Every bill, paid ones too, with what cleared it */}
          {showAllBills && bills && (
            <section className="mb-8 border-t border-gray-200 pt-6 print:mb-3 print:pt-2">
              <h2 className="text-base print:text-[11px] font-bold mb-1 print:mb-0.5">{next()}. All Bills</h2>
              <p className="text-xs text-gray-500 mb-2">
                {bills.rows.length} bills: {summary?.bills_paid ?? 0} paid, {summary?.bills_open ?? 0} still owed.
              </p>
              <div className="overflow-x-auto">
                <table className={TABLE}>
                  <thead>
                    <tr>
                      <th className={TH}>S/No</th>
                      <th className={TH}>Bill Date</th>
                      <th className={TH}>Reference</th>
                      <th className={TH}>Description</th>
                      <th className={`${TH} text-right`}>Bill Amount</th>
                      <th className={`${TH} text-right`}>Paid</th>
                      <th className={`${TH} text-right`}>Balance</th>
                      <th className={TH}>Due Date</th>
                      <th className={TH}>Status</th>
                      <th className={`${TH} text-right`}>Days Overdue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bills.rows.map((b, i) => (
                      <tr key={b.reference + i}>
                        <td className={TD}>{i + 1}</td>
                        <td className={`${TD} whitespace-nowrap`}>{formatDate(b.date)}</td>
                        <td className={`${TD} whitespace-nowrap`}>{b.reference}</td>
                        <td className={TD}>{b.description}</td>
                        <td className={`${TD} text-right`}>{money(b.amount)}</td>
                        <td className={`${TD} text-right`}>{b.paid ? money(b.paid) : "—"}</td>
                        <td className={`${TD} text-right`}>{b.balance ? money(b.balance) : "—"}</td>
                        <td className={`${TD} whitespace-nowrap`}>{formatDate(b.due_date)}</td>
                        <td className={`${TD} whitespace-nowrap ${STATUS_CLASS[b.status]}`}>{b.status}</td>
                        <td className={`${TD} text-right`}>{b.days_overdue > 0 ? b.days_overdue : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-semibold">
                      <td colSpan={4} className={`${TF} text-right`}>Total</td>
                      <td className={`${TF} text-right`}>{money(summary?.billed)}</td>
                      <td className={`${TF} text-right`}>{money(summary?.paid)}</td>
                      <td className={`${TF} text-right`}>{money(summary?.outstanding)}</td>
                      <td colSpan={3} className={TF}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          )}

          <section className="border-t-2 border-gray-800 pt-5 print:pt-2 text-xs text-gray-600 space-y-1 break-inside-avoid print:text-[9px]">
            <p>Due date = bill date + {terms} days credit. Payments and debit notes clear the oldest bills first.</p>
            <p className="pt-2 text-gray-400">This is a computer-generated statement and does not require a signature.</p>
          </section>
        </Card>
      </div>
    </div>
  )
}
