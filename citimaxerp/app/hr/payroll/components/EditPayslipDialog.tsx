"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  type PayrollPayslip,
  updatePayslip,
  formatKES,
} from "@/lib/payroll-runs"

interface AllowanceItem {
  name: string
  amount: number
  frequency: string
  is_taxable: boolean
}

interface DeductionItem {
  name: string
  amount: number
  frequency: string
}

interface EditPayslipDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  payslip: PayrollPayslip | null
  runId: string
  onSaved: () => void
}

export function EditPayslipDialog({ open, onOpenChange, payslip, runId, onSaved }: EditPayslipDialogProps) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [allowances, setAllowances] = useState<AllowanceItem[]>([])
  const [deductions, setDeductions] = useState<DeductionItem[]>([])
  const [otherDeductions, setOtherDeductions] = useState("")
  const [otherDeductionsNote, setOtherDeductionsNote] = useState("")

  useEffect(() => {
    if (payslip && open) {
      // Start with payslip's current entries
      const payslipAllowances = (payslip.allowances_json || []).map((a) => ({
        name: a.name,
        amount: a.amount,
        frequency: a.frequency || "monthly",
        is_taxable: a.is_taxable !== false,
      }))
      const payslipDeductions = (payslip.deductions_json || []).map((d) => ({
        name: d.name,
        amount: d.amount,
        frequency: d.frequency || "monthly",
      }))

      // Merge in employee profile entries that aren't already on the payslip
      const emp = payslip.employee
      if (emp) {
        const empAllowances: any[] = Array.isArray((emp as any).allowances) ? (emp as any).allowances : []
        const empDeductions: any[] = Array.isArray((emp as any).deductions) ? (emp as any).deductions : []

        const existingAllowanceNames = new Set(payslipAllowances.map((a) => a.name.toLowerCase().trim()))
        for (const a of empAllowances) {
          if (a.name && !existingAllowanceNames.has(a.name.toLowerCase().trim())) {
            payslipAllowances.push({
              name: a.name,
              amount: a.amount || 0,
              frequency: a.frequency || "monthly",
              is_taxable: a.is_taxable !== false,
            })
          }
        }

        const existingDeductionNames = new Set(payslipDeductions.map((d) => d.name.toLowerCase().trim()))
        for (const d of empDeductions) {
          if (d.name && !existingDeductionNames.has(d.name.toLowerCase().trim())) {
            payslipDeductions.push({
              name: d.name,
              amount: d.amount || 0,
              frequency: d.frequency || "monthly",
            })
          }
        }
      }

      setAllowances(payslipAllowances)
      setDeductions(payslipDeductions)
      setOtherDeductions(parseFloat(payslip.other_deductions || "0") > 0 ? payslip.other_deductions : "")
      setOtherDeductionsNote(payslip.other_deductions_note || "")
    }
  }, [payslip, open])

  const emp = payslip?.employee

  async function handleSave() {
    setSaving(true)
    try {
      await updatePayslip(runId, payslip!.id, {
        allowances: allowances.filter((a) => a.name.trim()),
        deductions: deductions.filter((d) => d.name.trim()),
        other_deductions: parseFloat(otherDeductions) || 0,
        other_deductions_note: otherDeductionsNote || undefined,
      })
      toast({ title: "Payslip updated", description: "Allowances and deductions saved. Statutory amounts recalculated." })
      onSaved()
      onOpenChange(false)
    } catch (err: any) {
      toast({ title: "Failed to update", description: err.message || "Something went wrong.", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  if (!payslip) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Edit Payslip — {emp?.first_name} {emp?.last_name}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {emp?.employee_number} · Basic Salary: KES {formatKES(payslip.gross_pay)}
          </p>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Allowances */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Allowances</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAllowances([...allowances, { name: "", amount: 0, frequency: "one_time", is_taxable: true }])}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add
              </Button>
            </div>
            {allowances.length === 0 ? (
              <p className="text-sm text-muted-foreground">No allowances. Click &quot;Add&quot; for a one-time allowance.</p>
            ) : (
              <div className="space-y-2">
                {allowances.map((a, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-end border rounded-lg p-2.5">
                    <div className="col-span-4 space-y-1">
                      <Label className="text-xs">Name</Label>
                      <Input
                        value={a.name}
                        onChange={(e) => { const u = [...allowances]; u[i] = { ...u[i], name: e.target.value }; setAllowances(u) }}
                        placeholder="House Allowance"
                        className="h-9"
                      />
                    </div>
                    <div className="col-span-3 space-y-1">
                      <Label className="text-xs">Amount (KES)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={a.amount || ""}
                        onChange={(e) => { const u = [...allowances]; u[i] = { ...u[i], amount: parseFloat(e.target.value) || 0 }; setAllowances(u) }}
                        placeholder="15000"
                        className="h-9"
                      />
                    </div>
                    <div className="col-span-3 space-y-1">
                      <Label className="text-xs">Frequency</Label>
                      <Select value={a.frequency} onValueChange={(v) => { const u = [...allowances]; u[i] = { ...u[i], frequency: v }; setAllowances(u) }}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="one_time">One-time</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2 flex items-end gap-1 pb-0.5">
                      <label className="flex items-center gap-1 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={a.is_taxable}
                          onChange={(e) => { const u = [...allowances]; u[i] = { ...u[i], is_taxable: e.target.checked }; setAllowances(u) }}
                          className="rounded"
                        />
                        Tax
                      </label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-700"
                        onClick={() => setAllowances(allowances.filter((_, j) => j !== i))}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Deductions */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Custom Deductions</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDeductions([...deductions, { name: "", amount: 0, frequency: "one_time" }])}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add
              </Button>
            </div>
            {deductions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No custom deductions.</p>
            ) : (
              <div className="space-y-2">
                {deductions.map((d, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-end border rounded-lg p-2.5">
                    <div className="col-span-5 space-y-1">
                      <Label className="text-xs">Name</Label>
                      <Input
                        value={d.name}
                        onChange={(e) => { const u = [...deductions]; u[i] = { ...u[i], name: e.target.value }; setDeductions(u) }}
                        placeholder="SACCO Contribution"
                        className="h-9"
                      />
                    </div>
                    <div className="col-span-3 space-y-1">
                      <Label className="text-xs">Amount (KES)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={d.amount || ""}
                        onChange={(e) => { const u = [...deductions]; u[i] = { ...u[i], amount: parseFloat(e.target.value) || 0 }; setDeductions(u) }}
                        placeholder="3000"
                        className="h-9"
                      />
                    </div>
                    <div className="col-span-3 space-y-1">
                      <Label className="text-xs">Frequency</Label>
                      <Select value={d.frequency} onValueChange={(v) => { const u = [...deductions]; u[i] = { ...u[i], frequency: v }; setDeductions(u) }}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="one_time">One-time</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-1 flex items-end pb-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-700"
                        onClick={() => setDeductions(deductions.filter((_, j) => j !== i))}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Other Deductions */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Other Deductions (KES)</Label>
              <Input
                type="number"
                step="0.01"
                value={otherDeductions}
                onChange={(e) => setOtherDeductions(e.target.value)}
                placeholder="0"
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Note</Label>
              <Input
                value={otherDeductionsNote}
                onChange={(e) => setOtherDeductionsNote(e.target.value)}
                placeholder="Reason for deduction"
                className="h-9"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</> : "Save & Recalculate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
