"use client"

import { useState } from "react"
import { Download } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { getApiUrl } from "@/lib/config"
import { getToken } from "@/lib/token-manager"
import {
  type PayrollPayslip,
  formatKES,
  monthName,
} from "@/lib/payroll-runs"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ViewPayslipDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  payslip: PayrollPayslip | null
}

// ---------------------------------------------------------------------------
// Frequency label helper
// ---------------------------------------------------------------------------

function frequencyLabel(freq: string): string {
  switch (freq) {
    case "monthly":
      return "Monthly"
    case "quarterly":
      return "Quarterly"
    case "annual":
      return "Annual"
    case "one_time":
      return "One-time"
    default:
      return freq
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ViewPayslipDialog({
  open,
  onOpenChange,
  payslip,
}: ViewPayslipDialogProps) {
  const [downloading, setDownloading] = useState(false)

  if (!payslip) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Payslip</DialogTitle>
            <DialogDescription>No payslip selected.</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    )
  }

  const slip = payslip
  const run = slip.payroll_run
  const emp = slip.employee

  // -------------------------------------------------------------------------
  // Download handler
  // -------------------------------------------------------------------------

  async function handleDownload() {
    if (!run || !emp) return
    setDownloading(true)
    try {
      const url = getApiUrl(
        `/payroll-runs/${run.id}/payslips/${slip.id}/download`,
      )
      const token = getToken()

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/pdf",
        },
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(
          (err as Record<string, string>)?.message ?? "Download failed",
        )
      }

      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = blobUrl
      a.download = `payslip-${emp.employee_number}-${run.pay_year}-${String(run.pay_month).padStart(2, "0")}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(blobUrl)
    } catch {
      toast.error("Failed to download payslip.")
    } finally {
      setDownloading(false)
    }
  }

  // -------------------------------------------------------------------------
  // Derived values
  // -------------------------------------------------------------------------

  const allowances = slip.allowances_json ?? []
  const customDeductions = slip.deductions_json ?? []

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        {/* -------- Header -------- */}
        <div className="sticky top-0 z-10 bg-background border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <DialogHeader className="space-y-0">
              <DialogTitle className="text-base font-semibold">
                {emp
                  ? `${emp.first_name} ${emp.last_name}`
                  : "Payslip"}
                {emp && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    #{emp.employee_number}
                  </span>
                )}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {emp?.position && <span>{emp.position}</span>}
                {emp?.position && emp?.department && (
                  <span className="mx-1">&middot;</span>
                )}
                {emp?.department && <span>{emp.department}</span>}
              </DialogDescription>
            </DialogHeader>

            <Button
              size="sm"
              onClick={handleDownload}
              disabled={downloading || !run}
              className="flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              {downloading ? "Downloading..." : "Download PDF"}
            </Button>
          </div>

          {/* Period label */}
          {run && (
            <p className="text-xs text-muted-foreground mt-2">
              Pay Period:{" "}
              <span className="font-medium text-foreground">
                {monthName(run.pay_month)} {run.pay_year}
              </span>
            </p>
          )}
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* ================================================================
              1. Earnings
          ================================================================ */}
          <section>
            <h3 className="text-sm font-semibold text-foreground mb-3">
              Earnings
            </h3>

            <div className="rounded-xl border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-xs uppercase tracking-wide">
                      Description
                    </TableHead>
                    <TableHead className="text-xs uppercase tracking-wide text-right">
                      Amount (KES)
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Basic Salary */}
                  <TableRow>
                    <TableCell className="font-semibold">
                      Basic Salary
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      {formatKES(slip.gross_pay)}
                    </TableCell>
                  </TableRow>

                  {/* Allowances */}
                  {allowances.map((a, i) => (
                    <TableRow key={i} className={i % 2 === 0 ? "bg-muted/30" : ""}>
                      <TableCell className="pl-7 text-muted-foreground text-xs">
                        {a.name}
                        <span className="ml-2 text-muted-foreground/70">
                          ({frequencyLabel(a.frequency)}
                          {a.is_taxable ? ", taxable" : ", non-taxable"})
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatKES(a.amount)}
                      </TableCell>
                    </TableRow>
                  ))}

                  {/* Total Allowances subtotal */}
                  {allowances.length > 0 && (
                    <TableRow className="border-t">
                      <TableCell className="font-medium text-sm">
                        Total Allowances
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium text-sm">
                        {formatKES(slip.total_allowances)}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </section>

          {/* ================================================================
              2. Statutory Deductions
          ================================================================ */}
          <section>
            <h3 className="text-sm font-semibold text-foreground mb-3">
              Statutory Deductions
            </h3>

            <div className="rounded-xl border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-xs uppercase tracking-wide">
                      Description
                    </TableHead>
                    <TableHead className="text-xs uppercase tracking-wide text-right">
                      Amount (KES)
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="pl-7 text-muted-foreground text-xs">
                      NSSF Tier I (6% of KES 9,000 LEL)
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatKES(slip.nssf_tier1)}
                    </TableCell>
                  </TableRow>

                  <TableRow className="bg-muted/30">
                    <TableCell className="pl-7 text-muted-foreground text-xs">
                      NSSF Tier II (6% above LEL)
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatKES(slip.nssf_tier2)}
                    </TableCell>
                  </TableRow>

                  <TableRow>
                    <TableCell className="pl-7 text-muted-foreground text-xs">
                      Taxable Pay (Gross &minus; NSSF &minus; SHIF &minus;
                      Housing Levy)
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatKES(slip.taxable_pay)}
                    </TableCell>
                  </TableRow>

                  <TableRow className="bg-muted/30">
                    <TableCell className="pl-7 text-muted-foreground text-xs">
                      PAYE (on taxable pay)
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatKES(slip.paye_before_relief)}
                    </TableCell>
                  </TableRow>

                  <TableRow>
                    <TableCell className="pl-10 text-muted-foreground text-xs">
                      Less: Personal Relief
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-muted-foreground">
                      ({formatKES(slip.personal_relief)})
                    </TableCell>
                  </TableRow>

                  {Number(slip.insurance_relief) > 0 && (
                    <TableRow className="bg-muted/30">
                      <TableCell className="pl-10 text-muted-foreground text-xs">
                        Less: Insurance Relief
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-muted-foreground">
                        ({formatKES(slip.insurance_relief)})
                      </TableCell>
                    </TableRow>
                  )}

                  <TableRow className="border-t">
                    <TableCell className="font-semibold">
                      Net PAYE
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      {formatKES(slip.paye)}
                    </TableCell>
                  </TableRow>

                  <TableRow className="bg-muted/30">
                    <TableCell className="text-sm">
                      SHIF (2.75% of Gross, min KES 300)
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatKES(slip.shif)}
                    </TableCell>
                  </TableRow>

                  <TableRow>
                    <TableCell className="text-sm">
                      Housing Levy (1.5% of Gross)
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatKES(slip.housing_levy_employee)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </section>

          {/* ================================================================
              3. Custom Deductions
          ================================================================ */}
          {(customDeductions.length > 0 ||
            Number(slip.salary_advance_deduction) > 0 ||
            Number(slip.other_deductions) > 0) && (
            <section>
              <h3 className="text-sm font-semibold text-foreground mb-3">
                Other Deductions
              </h3>

              <div className="rounded-xl border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-xs uppercase tracking-wide">
                        Description
                      </TableHead>
                      <TableHead className="text-xs uppercase tracking-wide text-right">
                        Amount (KES)
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customDeductions.map((d, i) => (
                      <TableRow
                        key={i}
                        className={i % 2 === 0 ? "" : "bg-muted/30"}
                      >
                        <TableCell className="text-sm">
                          {d.name}
                          <span className="ml-2 text-xs text-muted-foreground">
                            ({frequencyLabel(d.frequency)})
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatKES(d.amount)}
                        </TableCell>
                      </TableRow>
                    ))}

                    {Number(slip.salary_advance_deduction) > 0 && (
                      <TableRow>
                        <TableCell className="text-sm">
                          Salary Advance Recovery
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatKES(slip.salary_advance_deduction)}
                        </TableCell>
                      </TableRow>
                    )}

                    {Number(slip.other_deductions) > 0 && (
                      <TableRow>
                        <TableCell className="text-sm">
                          Other Deductions
                          {slip.other_deductions_note && (
                            <span className="ml-1 text-xs text-muted-foreground">
                              &mdash; {slip.other_deductions_note}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatKES(slip.other_deductions)}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </section>
          )}

          {/* ================================================================
              4. Total Deductions
          ================================================================ */}
          <div className="rounded-xl bg-red-50 border border-red-200 px-5 py-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-red-700">
              Total Deductions
            </span>
            <span className="font-mono font-bold text-red-600">
              KES {formatKES(slip.total_deductions)}
            </span>
          </div>

          {/* ================================================================
              5. Net Pay
          ================================================================ */}
          <div className="rounded-xl bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide">
                Net Pay
              </p>
              <p className="text-2xl font-bold mt-0.5">
                KES {formatKES(slip.net_pay)}
              </p>
            </div>
            {run && (
              <div className="text-right">
                <p className="text-xs text-slate-400">Period</p>
                <p className="text-sm font-medium">
                  {monthName(run.pay_month)} {run.pay_year}
                </p>
              </div>
            )}
          </div>

          {/* ================================================================
              6. Employer Contributions
          ================================================================ */}
          <div className="rounded-xl border bg-muted/50 px-4 py-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground mb-1">
              Employer Contributions{" "}
              <span className="font-normal text-muted-foreground">
                (not deducted from your pay)
              </span>
            </p>
            <p>
              NSSF Employer:{" "}
              <span className="font-medium text-foreground">
                KES {formatKES(slip.nssf_employer)}
              </span>
              &nbsp;|&nbsp; Housing Levy Employer:{" "}
              <span className="font-medium text-foreground">
                KES {formatKES(slip.housing_levy_employer)}
              </span>
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
