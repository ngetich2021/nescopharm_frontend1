"use client"

import { Fragment, useEffect, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Loader2 } from "lucide-react"
import { ExportMenu, useTableExport } from "@/components/export-menu"
import { displayDate } from "@/lib/date-format"
import type { TableExport } from "@/lib/table-export"
import { fetchPayrollMonthJournal, type PayrollMonthEmployee, type PayrollMonthJournal as MonthJournal } from "@/lib/payroll-runs"

const money = (n: number) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const day = (d?: string | null) => (d ? displayDate(d) : "")

// The payroll computation columns, in the accountant's workbook order.
const COLS: [keyof PayrollMonthEmployee, string][] = [
  ["basic_salary", "Basic Salary"],
  ["allowances", "Allowances"],
  ["gross_pay", "Gross Pay"],
  ["nssf_employee", "NSSF (Employee)"],
  ["shif", "SHIF"],
  ["housing_levy_employee", "Housing Levy (Employee)"],
  ["taxable_pay", "Taxable Pay"],
  ["tax_before_relief", "Tax Before Relief"],
  ["personal_relief", "Personal Relief"],
  ["paye", "PAYE"],
  ["helb", "HELB"],
  ["salary_advance", "Salary Advance"],
  ["other_deductions", "Other Deductions"],
  ["total_deductions", "Total Deductions"],
  ["net_pay", "Net Pay"],
  ["nssf_employer", "NSSF (Employer)"],
  ["housing_levy_employer", "Housing Levy (Employer)"],
  ["nita", "NITA"],
  ["employer_cost", "Total Employer Cost"],
]

/**
 * One payroll month as the accountant's payroll journal workbook: Payroll Data (computation per
 * employee), Journals (JV-PAY-1 payroll run, JV-PAY-2 net salaries paid, JV-PAY-3.. statutory
 * remittances, each with Balanced / OUT OF BALANCE) and Ledger Summary (every account touched).
 * Export gives one Excel workbook with the three sheets.
 */
export function PayrollMonthJournal({ runId }: { runId: string }) {
  const [data, setData] = useState<MonthJournal | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState("journals")

  useEffect(() => {
    setData(null)
    setError(null)
    fetchPayrollMonthJournal(runId).then(setData).catch((e) => setError(e instanceof Error ? e.message : "Could not load the payroll journal"))
  }, [runId])

  const onExport = useTableExport(() => {
    const d = data!
    const t = d.totals
    const dataSheet: TableExport = {
      fileName: "", title: `Monthly Payroll Computation - ${d.period_label}`, sheetName: "Payroll Data",
      headers: ["S/No", "Emp No", "Name", "KRA PIN", ...COLS.map(([, l]) => l)],
      moneyColumns: COLS.map((_, i) => i + 4),
      rows: d.employees.map((e, i) => [i + 1, e.employee_number ?? "", e.name, e.kra_pin ?? "", ...COLS.map(([k]) => e[k] as number)]),
      footer: [["", "TOTAL", "", "", ...COLS.map(([k]) => t[k] ?? 0)]],
    }
    const journalRows = d.journals.flatMap((j) => [
      ...j.lines.map((l) => [j.journal, day(j.date), l.account, l.account_type, l.narration, l.debit || null, l.credit || null, j.entry_number ?? (j.note ? "Not posted" : "")]),
      ["", "", j.balanced ? "Balanced" : "OUT OF BALANCE", "", "Journal total", j.total_debit, j.total_credit, ""],
      ["", "", "", "", "", null, null, ""],
    ])
    const journalSheet: TableExport = {
      fileName: "", title: `Payroll Journals - ${d.period_label}`, sheetName: "Journals",
      subtitle: d.posts_to_ledger ? "Posted to the books" : d.journals[0]?.note ?? "",
      headers: ["Journal", "Date", "Account", "Account Type", "Narration", "Debit", "Credit", "Entry No."],
      moneyColumns: [5, 6],
      rows: journalRows,
    }
    const summarySheet: TableExport = {
      fileName: "", title: `Ledger Summary - Accounts Affected by ${d.period_label} Payroll`, sheetName: "Ledger Summary",
      headers: ["S/No", "Account", "Account Type", "Total Debit", "Total Credit", "Net Balance", "Dr / Cr"],
      moneyColumns: [3, 4, 5],
      rows: d.summary.map((s, i) => [i + 1, s.account, s.account_type, s.debit, s.credit, s.net, s.side]),
      footer: [["", "TOTAL", "", d.summary_totals.debit, d.summary_totals.credit, "", ""]],
    }
    return {
      fileName: `Payroll Journal ${d.period_label}`,
      title: `Payroll Journal - ${d.period_label}`,
      headers: [], rows: [],
      sheets: [dataSheet, journalSheet, summarySheet],
    }
  })

  if (error) return <p className="text-sm text-red-600">{error}</p>
  if (!data) return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading payroll journal...</p>

  const cell = "[&>td]:border-b [&>td]:px-2 [&>td]:py-1.5"
  const th = "[&>th]:whitespace-nowrap [&>th]:border-b [&>th]:px-2 [&>th]:py-1.5"

  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <TabsList>
          <TabsTrigger value="data">Payroll Data</TabsTrigger>
          <TabsTrigger value="journals">Journals ({data.journals.length})</TabsTrigger>
          <TabsTrigger value="summary">Ledger Summary</TabsTrigger>
        </TabsList>
        <div className="flex items-center gap-2">
          {data.posts_to_ledger
            ? <Badge className="bg-green-100 text-green-800">Posted to the books</Badge>
            : <Badge variant="outline" className="bg-amber-50 text-amber-800">Not posted - shown for reference</Badge>}
          <ExportMenu onExport={onExport} label="Export workbook" />
        </div>
      </div>

      <TabsContent value="data">
        <div className="max-h-[480px] overflow-auto rounded border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-gray-50 text-gray-600">
              <tr className={th}>
                <th className="text-left">S/No</th>
                <th className="text-left">Emp No</th>
                <th className="text-left">Name</th>
                <th className="text-left">KRA PIN</th>
                {COLS.map(([k, l]) => <th key={k} className="text-right">{l}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.employees.map((e, i) => (
                <tr key={`${e.employee_number}-${i}`} className={cell}>
                  <td className="text-muted-foreground">{i + 1}</td>
                  <td>{e.employee_number}</td>
                  <td className="whitespace-nowrap font-medium">{e.name}</td>
                  <td>{e.kra_pin}</td>
                  {COLS.map(([k]) => (
                    <td key={k} className={`text-right tabular-nums ${k === "net_pay" ? "font-semibold" : ""}`}>{money(e[k] as number)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot className="font-bold">
              <tr className={cell}>
                <td colSpan={4}>TOTAL</td>
                {COLS.map(([k]) => <td key={k} className="text-right tabular-nums">{money(data.totals[k] ?? 0)}</td>)}
              </tr>
            </tfoot>
          </table>
        </div>
      </TabsContent>

      <TabsContent value="journals" className="space-y-2">
        <p className="text-xs text-muted-foreground">
          JV-PAY-1 payroll run (expense and what is owed) · JV-PAY-2 net salaries paid · JV-PAY-3 onward each statutory remittance.
          {!data.posts_to_ledger && data.journals[0]?.note ? ` ${data.journals[0].note}.` : ""}
        </p>
        {data.journals.length === 0 && <p className="text-sm text-muted-foreground">No journals yet - the month is not approved.</p>}
        <div className="max-h-[480px] overflow-auto rounded border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-gray-50 text-gray-600">
              <tr className={th}>
                <th className="text-left">Journal</th>
                <th className="text-left">Date</th>
                <th className="text-left">Account</th>
                <th className="text-left">Account Type</th>
                <th className="text-left">Narration</th>
                <th className="text-right">Debit</th>
                <th className="text-right">Credit</th>
              </tr>
            </thead>
            <tbody>
              {data.journals.map((j) => (
                <Fragment key={j.journal}>
                  <tr className="bg-muted/50 [&>td]:px-2 [&>td]:py-1.5">
                    <td colSpan={7} className="font-semibold">
                      {j.journal} · {j.title}
                      {j.entry_number && <span className="ml-2 font-normal text-muted-foreground">entry {j.entry_number}</span>}
                    </td>
                  </tr>
                  {j.lines.map((l, i) => (
                    <tr key={i} className={cell}>
                      <td>{j.journal}</td>
                      <td className="whitespace-nowrap">{day(j.date)}</td>
                      <td className={`whitespace-nowrap font-medium ${l.credit ? "pl-6" : ""}`}>{l.account}</td>
                      <td>{l.account_type}</td>
                      <td className="min-w-[220px] text-muted-foreground">{l.narration}</td>
                      <td className="text-right tabular-nums">{l.debit ? money(l.debit) : ""}</td>
                      <td className="text-right tabular-nums">{l.credit ? money(l.credit) : ""}</td>
                    </tr>
                  ))}
                  <tr className={`font-bold ${cell}`}>
                    <td colSpan={2} />
                    <td className={j.balanced ? "text-green-700" : "text-red-600"}>{j.balanced ? "Balanced" : "OUT OF BALANCE"}</td>
                    <td />
                    <td>Journal total</td>
                    <td className="text-right tabular-nums">{money(j.total_debit)}</td>
                    <td className="text-right tabular-nums">{money(j.total_credit)}</td>
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </TabsContent>

      <TabsContent value="summary" className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Totals of the journals by account. A payable clears to Nil once it has been paid over; Cr = still owed.
        </p>
        <div className="max-h-[480px] overflow-auto rounded border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-gray-50 text-gray-600">
              <tr className={th}>
                <th className="text-left">S/No</th>
                <th className="text-left">Account</th>
                <th className="text-left">Account Type</th>
                <th className="text-right">Total Debit</th>
                <th className="text-right">Total Credit</th>
                <th className="text-right">Net Balance</th>
                <th className="text-left">Dr / Cr</th>
              </tr>
            </thead>
            <tbody>
              {data.summary.map((s, i) => (
                <tr key={s.account} className={cell}>
                  <td className="text-muted-foreground">{i + 1}</td>
                  <td className="whitespace-nowrap font-medium">{s.account}</td>
                  <td>{s.account_type}</td>
                  <td className="text-right tabular-nums">{money(s.debit)}</td>
                  <td className="text-right tabular-nums">{money(s.credit)}</td>
                  <td className="text-right tabular-nums font-semibold">{money(s.net)}</td>
                  <td className={s.side === "Nil" ? "text-green-700" : s.side === "Cr" && s.account_type === "Liability" ? "text-red-600" : ""}>{s.side}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="font-bold">
              <tr className={cell}>
                <td colSpan={3}>TOTAL</td>
                <td className="text-right tabular-nums">{money(data.summary_totals.debit)}</td>
                <td className="text-right tabular-nums">{money(data.summary_totals.credit)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </TabsContent>
    </Tabs>
  )
}
