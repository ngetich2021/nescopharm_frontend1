"use client"

import { useEffect, useState } from "react"
import * as XLSX from "xlsx"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { ArrowRightLeft, Download, Loader2, Trash2 } from "lucide-react"
import apiCall from "@/lib/api"
import { documentFileName, todayFileDate, sessionCompanyName } from "@/lib/document-names"

type MoneyAccount = { id: string; code: string; name: string; label: string; balance: number }
type Transfer = {
  id: string
  transfer_number: string
  transfer_date: string
  from_account: string | null
  to_account: string | null
  amount: number
  charges: number
  total_out: number
  reference: string | null
  purpose: string | null
  notes: string | null
  created_by: string | null
}

const money = (v: number) => Number(v || 0).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}
const EMPTY = { transfer_date: today(), from_account_id: "", to_account_id: "", amount: "", charges: "", reference: "", purpose: "", notes: "" }

/**
 * Money moved between the company's own accounts - typically a withdrawal from the bank into
 * cash to pay wages or bills - with the bank's charge, which is booked to Bank Charges.
 */
export function BankTransfers({ onChanged }: { onChanged?: () => void }) {
  const { toast } = useToast()
  const [accounts, setAccounts] = useState<MoneyAccount[]>([])
  const [transfers, setTransfers] = useState<Transfer[] | null>(null)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const set = (key: keyof typeof EMPTY, value: string) => setForm((f) => ({ ...f, [key]: value }))

  const load = async () => {
    try {
      const [acc, list] = await Promise.all([
        apiCall<{ data: MoneyAccount[] }>("/finance/bank-transfers/accounts", "GET"),
        apiCall<{ data: Transfer[] }>("/finance/bank-transfers", "GET"),
      ])
      setAccounts(acc.data)
      setTransfers(list.data)
    } catch (err: any) {
      setTransfers([])
      toast({ title: "Could not load transfers", description: err.message, variant: "destructive" })
    }
  }

  useEffect(() => { load() }, [])

  const openForm = () => {
    // Most often: bank -> cash, so preselect the first bank-linked account and the cash account.
    const bank = accounts.find((a) => / - /.test(a.label)) ?? accounts[0]
    const cash = accounts.find((a) => /cash/i.test(a.name) && a.id !== bank?.id)
    setForm({ ...EMPTY, transfer_date: today(), from_account_id: bank?.id ?? "", to_account_id: cash?.id ?? "" })
    setOpen(true)
  }

  const save = async () => {
    setSaving(true)
    try {
      const res = await apiCall<{ message: string }>("/finance/bank-transfers", "POST", {
        ...form,
        amount: Number(form.amount),
        charges: form.charges === "" ? 0 : Number(form.charges),
      })
      toast({ title: "Recorded", description: res.message })
      setOpen(false)
      await load()
      onChanged?.()
    } catch (err: any) {
      toast({ title: "Could not record the transfer", description: err.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const remove = async (t: Transfer) => {
    if (!confirm(`Delete ${t.transfer_number}? Its entry in the books is reversed.`)) return
    try {
      await apiCall(`/finance/bank-transfers/${t.id}`, "DELETE")
      await load()
      onChanged?.()
    } catch (err: any) {
      toast({ title: "Could not delete", description: err.message, variant: "destructive" })
    }
  }

  const download = () => {
    const rows = (transfers ?? []).map((t, i) => ({
      "S/No": i + 1,
      "Transfer No.": t.transfer_number,
      Date: t.transfer_date,
      From: t.from_account ?? "",
      To: t.to_account ?? "",
      "Amount (KES)": t.amount,
      "Bank Charges (KES)": t.charges,
      "Total Out (KES)": t.total_out,
      Purpose: t.purpose ?? "",
      Reference: t.reference ?? "",
      Notes: t.notes ?? "",
      "Recorded By": t.created_by ?? "",
    }))
    const book = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), "Transfers")
    XLSX.writeFile(book, documentFileName([sessionCompanyName(), "Bank Withdrawals & Transfers", todayFileDate()], "xlsx"))
  }

  const from = accounts.find((a) => a.id === form.from_account_id)
  const amount = Number(form.amount) || 0
  const charges = Number(form.charges) || 0
  const valid = form.from_account_id && form.to_account_id && form.from_account_id !== form.to_account_id && amount > 0 && charges >= 0
  const totalCharges = (transfers ?? []).reduce((s, t) => s + Number(t.charges), 0)

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle>Withdrawals &amp; Transfers</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Money taken out of the bank (e.g. cash for wages or bills) or moved between accounts, with the bank&apos;s charge.
            Charges are booked to Bank Charges.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={download} disabled={!transfers?.length}>
            <Download className="mr-2 h-4 w-4" /> Download
          </Button>
          <Button size="sm" onClick={openForm} disabled={accounts.length < 2}>
            <ArrowRightLeft className="mr-2 h-4 w-4" /> Withdraw / Transfer
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {transfers === null ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</div>
        ) : transfers.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No withdrawals or transfers recorded yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">S/No</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>No.</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Purpose</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Charges</TableHead>
                  <TableHead className="text-right">Total Out</TableHead>
                  <TableHead>By</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.map((t, i) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="whitespace-nowrap">{new Date(t.transfer_date).toLocaleDateString("en-GB")}</TableCell>
                    <TableCell className="font-medium">{t.transfer_number}</TableCell>
                    <TableCell>{t.from_account}</TableCell>
                    <TableCell>{t.to_account}</TableCell>
                    <TableCell>
                      {t.purpose || "-"}
                      {t.reference && <div className="text-xs text-muted-foreground">Ref: {t.reference}</div>}
                    </TableCell>
                    <TableCell className="text-right font-mono">{money(t.amount)}</TableCell>
                    <TableCell className="text-right font-mono">{t.charges ? money(t.charges) : "-"}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">{money(t.total_out)}</TableCell>
                    <TableCell className="text-sm">{t.created_by ?? "-"}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Delete" onClick={() => remove(t)}>
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="px-4 py-2 text-xs text-muted-foreground border-t">Bank charges in this list: KES {money(totalCharges)}</p>
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Withdraw / Transfer</DialogTitle>
            <DialogDescription>Record money leaving one account and arriving in another, plus any bank charge.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" max={today()} value={form.transfer_date} onChange={(e) => set("transfer_date", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Bank reference</Label>
                <Input placeholder="e.g. cheque / slip no." value={form.reference} onChange={(e) => set("reference", e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>From</Label>
              <Select value={form.from_account_id} onValueChange={(v) => set("from_account_id", v)}>
                <SelectTrigger><SelectValue placeholder="Account the money leaves" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.label} (KES {money(a.balance)})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>To</Label>
              <Select value={form.to_account_id} onValueChange={(v) => set("to_account_id", v)}>
                <SelectTrigger><SelectValue placeholder="Account the money goes into" /></SelectTrigger>
                <SelectContent>
                  {accounts.filter((a) => a.id !== form.from_account_id).map((a) => <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Amount (KES)</Label>
                <Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => set("amount", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Bank charge (KES)</Label>
                <Input type="number" min="0" step="0.01" placeholder="0.00" value={form.charges} onChange={(e) => set("charges", e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Purpose</Label>
              <Input placeholder="e.g. Cash for October wages, KPLC bill" value={form.purpose} onChange={(e) => set("purpose", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
            </div>
            {amount > 0 && (
              <p className="rounded-md bg-muted p-3 text-sm">
                {from?.name ?? "The account"} goes down by <b>KES {money(amount + charges)}</b>
                {charges > 0 && <> (KES {money(amount)} moved + KES {money(charges)} bank charge)</>}.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={save} disabled={!valid || saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
