"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, Landmark } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { createIssuedCheque } from "@/lib/cheques"
import { getSuppliers, Supplier } from "@/lib/suppliers"
import { getCustomers, Customer, getCustomerDisplayName } from "@/lib/customers"

interface RecordIssuedChequeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

type PartyType = "supplier" | "customer" | "other"

const emptyForm = {
  party_id: "",
  payee_name: "",
  cheque_number: "",
  bank_name: "",
  amount: "",
  issue_date: new Date().toISOString().slice(0, 10),
  maturity_date: "",
  notes: "",
}

export function RecordIssuedChequeModal({ open, onOpenChange, onSuccess }: RecordIssuedChequeModalProps) {
  const { toast } = useToast()
  const [partyType, setPartyType] = useState<PartyType>("supplier")
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loadingParties, setLoadingParties] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState(emptyForm)

  useEffect(() => {
    if (open) {
      setLoadingParties(true)
      Promise.all([
        getSuppliers().catch(() => []),
        getCustomers().catch(() => []),
      ])
        .then(([supplierList, customerList]) => {
          setSuppliers(supplierList)
          setCustomers(customerList)
        })
        .finally(() => setLoadingParties(false))
    }
  }, [open])

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handlePartyTypeChange = (value: PartyType) => {
    setPartyType(value)
    handleChange("party_id", "")
    handleChange("payee_name", "")
  }

  const handleSubmit = async () => {
    if (partyType === "other" ? !form.payee_name.trim() : !form.party_id) {
      toast({
        title: partyType === "other" ? "Missing payee" : partyType === "supplier" ? "Missing supplier" : "Missing customer",
        description:
          partyType === "other"
            ? "Enter who this cheque is for (e.g. an office supplies vendor or logistics company)."
            : `Select which ${partyType} this repayment cheque is for.`,
        variant: "destructive",
      })
      return
    }
    if (!form.cheque_number || !form.bank_name || !form.amount || !form.maturity_date) {
      toast({ title: "Missing details", description: "Fill in cheque number, bank, amount and maturity date.", variant: "destructive" })
      return
    }

    setSubmitting(true)
    try {
      await createIssuedCheque({
        supplier_id: partyType === "supplier" ? form.party_id : undefined,
        customer_id: partyType === "customer" ? form.party_id : undefined,
        payee_name: partyType === "other" ? form.payee_name.trim() : undefined,
        cheque_number: form.cheque_number,
        bank_name: form.bank_name,
        amount: Number(form.amount),
        issue_date: form.issue_date,
        maturity_date: form.maturity_date,
        notes: form.notes || undefined,
      })

      toast({
        title: "Cheque recorded",
        description: "The MD and GM will be alerted a week before it matures so funds are ready.",
      })
      onOpenChange(false)
      onSuccess?.()
      setForm(emptyForm)
      setPartyType("supplier")
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || "Failed to record cheque", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Landmark className="h-5 w-5 text-blue-600" />
            Record Issued Cheque
          </DialogTitle>
          <DialogDescription>
            A post-dated cheque we're issuing - to a supplier, a customer refund, or anyone else (office
            supplies, logistics, etc.). The MD and GM get alerted a week before it matures.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Paying</Label>
            <Select value={partyType} onValueChange={(value) => handlePartyTypeChange(value as PartyType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="supplier">A Supplier</SelectItem>
                <SelectItem value="customer">A Customer (refund)</SelectItem>
                <SelectItem value="other">Someone Else (office supplies, logistics, etc.)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {partyType === "other" ? (
            <div className="grid gap-2">
              <Label htmlFor="payee_name">Payee Name</Label>
              <Input
                id="payee_name"
                placeholder="e.g. ABC Office Supplies"
                value={form.payee_name}
                onChange={(e) => handleChange("payee_name", e.target.value)}
              />
            </div>
          ) : (
            <div className="grid gap-2">
              <Label htmlFor="party_id">{partyType === "supplier" ? "Supplier" : "Customer"}</Label>
              <Select value={form.party_id} onValueChange={(value) => handleChange("party_id", value)}>
                <SelectTrigger id="party_id">
                  <SelectValue placeholder={loadingParties ? "Loading..." : `Select ${partyType}`} />
                </SelectTrigger>
                <SelectContent>
                  {partyType === "supplier"
                    ? suppliers.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>{supplier.name}</SelectItem>
                      ))
                    : customers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>{getCustomerDisplayName(customer)}</SelectItem>
                      ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="cheque_number">Cheque Number</Label>
              <Input
                id="cheque_number"
                placeholder="e.g. 001234"
                value={form.cheque_number}
                onChange={(e) => handleChange("cheque_number", e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bank_name">Bank</Label>
              <Input
                id="bank_name"
                placeholder="e.g. Equity Bank"
                value={form.bank_name}
                onChange={(e) => handleChange("bank_name", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="amount">Amount (KES)</Label>
              <Input
                id="amount"
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(e) => handleChange("amount", e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="issue_date">Issue Date</Label>
              <Input
                id="issue_date"
                type="date"
                value={form.issue_date}
                onChange={(e) => handleChange("issue_date", e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="maturity_date">Maturity Date</Label>
            <Input
              id="maturity_date"
              type="date"
              value={form.maturity_date}
              onChange={(e) => handleChange("maturity_date", e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Additional notes..."
              value={form.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Record Cheque
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
