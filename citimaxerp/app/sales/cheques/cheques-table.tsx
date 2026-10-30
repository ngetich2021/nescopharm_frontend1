"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getCustomerDisplayName } from "@/lib/customers"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import {
  Search,
  RefreshCw,
  MoreHorizontal,
  CheckCircle2,
  XCircle,
  Ban,
  Paperclip,
  Plus,
  ArrowDownToLine,
  ArrowUpFromLine,
  Eye,
  Pencil,
} from "lucide-react"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "@/components/ui/use-toast"
import {
  Cheque,
  ChequeStatus,
  approveCheque,
  bounceCheque,
  cancelCheque,
  fetchCheques,
  getChequeStatusColor,
  updateCheque,
} from "@/lib/cheques"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { formatCurrency, formatDate, matchesDocNumber } from "@/lib/utils"
import { RecordIssuedChequeModal } from "./record-issued-cheque-modal"
import { FileLink } from "@/components/file-preview"

interface ChequesTableProps {
  initialCheques?: Cheque[]
}

function formatStatus(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

// Invoices a received cheque pays (none once bounced or cancelled).
function invoiceCount(cheque: Cheque) {
  return cheque.invoice_lines?.length ?? cheque.invoice_numbers?.length ?? 0
}

function isOverdue(cheque: Cheque) {
  return cheque.status === "pending" && new Date(cheque.maturity_date) < new Date(new Date().toDateString())
}

export function ChequesTable({ initialCheques = [] }: ChequesTableProps) {
  const [cheques, setCheques] = useState<Cheque[]>(initialCheques)
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [directionFilter, setDirectionFilter] = useState<string>("all")
  const [actioningId, setActioningId] = useState<string | null>(null)
  const [showRecordIssued, setShowRecordIssued] = useState(false)
  const [detailsCheque, setDetailsCheque] = useState<Cheque | null>(null)
  const [editCheque, setEditCheque] = useState<Cheque | null>(null)

  const refreshCheques = useCallback(async () => {
    setIsLoading(true)
    try {
      const fetched = await fetchCheques()
      setCheques(fetched)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to load cheques",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (initialCheques.length === 0) {
      refreshCheques()
    }
  }, [initialCheques.length, refreshCheques])

  const filteredCheques = useMemo(() => {
    return cheques.filter((cheque) => {
      const matchesSearch =
        searchQuery === "" ||
        cheque.cheque_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cheque.bank_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cheque.customer?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        matchesDocNumber(cheque.invoice?.invoice_number, searchQuery) ||
        cheque.invoice_numbers?.some((n) => matchesDocNumber(n, searchQuery))

      const matchesStatus = statusFilter === "all" || cheque.status === statusFilter
      const matchesDirection = directionFilter === "all" || cheque.direction === directionFilter

      return matchesSearch && matchesStatus && matchesDirection
    })
  }, [cheques, searchQuery, statusFilter, directionFilter])

  const handleAction = async (
    cheque: Cheque,
    action: (id: string) => Promise<Cheque & { message?: string }>,
    successMessage: string,
    confirmMessage?: string
  ) => {
    if (confirmMessage && !window.confirm(confirmMessage)) return

    setActioningId(cheque.id)
    try {
      const result = await action(cheque.id)
      toast({ title: "Success", description: result?.message || successMessage })
      await refreshCheques()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Action failed",
        variant: "destructive",
      })
    } finally {
      setActioningId(null)
    }
  }

  // A customer's cheque raises a bounced cheque charge invoice; an approved one also comes back
  // off the invoices it paid (ChequeBounceService).
  const bounceConfirm = (cheque: Cheque) =>
    cheque.direction === "received"
      ? `Mark cheque ${cheque.cheque_number} as bounced?` +
        (cheque.status === "approved" ? " Its money will be taken back off the invoices it paid." : "") +
        " The customer will be invoiced KES 2,000 bounced cheque charges."
      : `Mark cheque ${cheque.cheque_number} as bounced?`

  const ActionsDropdown = ({ cheque }: { cheque: Cheque }) => {
    const viewDetails = (
      <DropdownMenuItem onClick={() => setDetailsCheque(cheque)}>
        <Eye className="h-4 w-4 mr-2" />
        View Details
      </DropdownMenuItem>
    )
    const edit = (
      <DropdownMenuItem onClick={() => setEditCheque(cheque)}>
        <Pencil className="h-4 w-4 mr-2" />
        Edit
      </DropdownMenuItem>
    )

    if (cheque.status === "approved" && cheque.direction === "received") {
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0" disabled={actioningId === cheque.id}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            {viewDetails}
            {edit}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() =>
                handleAction(cheque, bounceCheque, `Cheque ${cheque.cheque_number} marked as bounced.`, bounceConfirm(cheque))
              }
            >
              <XCircle className="h-4 w-4 mr-2 text-red-600" />
              Mark Bounced
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }

    if (cheque.status !== "pending") {
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            {viewDetails}
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0" disabled={actioningId === cheque.id}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          {viewDetails}
          {edit}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() =>
              handleAction(
                cheque,
                approveCheque,
                cheque.direction === "issued"
                  ? `Cheque ${cheque.cheque_number} marked as cleared.`
                  : `Cheque ${cheque.cheque_number} approved and applied to the invoice.`
              )
            }
          >
            <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
            {cheque.direction === "issued" ? "Mark Cleared" : "Approve (Matured)"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() =>
              handleAction(
                cheque,
                bounceCheque,
                `Cheque ${cheque.cheque_number} marked as bounced.`,
                bounceConfirm(cheque)
              )
            }
          >
            <XCircle className="h-4 w-4 mr-2 text-red-600" />
            Mark Bounced
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              handleAction(
                cheque,
                cancelCheque,
                `Cheque ${cheque.cheque_number} cancelled.`,
                `Cancel cheque ${cheque.cheque_number}?`
              )
            }
          >
            <Ban className="h-4 w-4 mr-2 text-gray-600" />
            Cancel
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500 h-4 w-4" />
            <Input
              className="pl-8 max-w-sm"
              placeholder="Search cheque #, bank, customer, invoice..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="bounced">Bounced</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>

          <Select value={directionFilter} onValueChange={setDirectionFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All Cheques" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Received &amp; Issued</SelectItem>
              <SelectItem value="received">Received (from customers)</SelectItem>
              <SelectItem value="issued">Issued (to suppliers)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Button size="sm" onClick={() => setShowRecordIssued(true)} className="w-fit">
            <Plus className="h-4 w-4 mr-2" />
            Record Issued Cheque
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshCheques}
            disabled={isLoading}
            className="border-gray-800 text-gray-800 hover:bg-gray-100 w-fit"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""} mr-2`} />
            Refresh
          </Button>
        </div>
      </div>

      <RecordIssuedChequeModal
        open={showRecordIssued}
        onOpenChange={setShowRecordIssued}
        onSuccess={refreshCheques}
      />

      <ChequeDetailsDialog cheque={detailsCheque} onClose={() => setDetailsCheque(null)} />
      <EditChequeDialog cheque={editCheque} onClose={() => setEditCheque(null)} onSaved={refreshCheques} />

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-semibold">Cheque #</TableHead>
              <TableHead className="font-semibold">Direction</TableHead>
              <TableHead className="font-semibold">Bank</TableHead>
              <TableHead className="font-semibold">Party</TableHead>
              <TableHead className="font-semibold">Invoice</TableHead>
              <TableHead className="font-semibold">Amount</TableHead>
              <TableHead className="font-semibold">Issue Date</TableHead>
              <TableHead className="font-semibold">Maturity Date</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="text-right font-semibold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={10} className="h-24 text-center">
                  <div className="flex items-center justify-center space-x-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                    <span>Loading cheques...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredCheques.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="h-24 text-center">
                  <div className="text-gray-500">
                    <p className="font-semibold">No cheques found</p>
                    <p className="text-sm">Cheques recorded from invoice payments will appear here</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredCheques.map((cheque) => (
                <TableRow key={cheque.id} className="hover:bg-gray-50">
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {cheque.cheque_number}
                      {cheque.attachment_url && (
                        <FileLink
                          href={cheque.attachment_url}
                          title="View attached cheque"
                          className="text-muted-foreground hover:text-primary"
                        >
                          <Paperclip className="h-3.5 w-3.5" />
                        </FileLink>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {cheque.direction === "issued" ? (
                      <Badge variant="outline" className="gap-1 text-orange-700 border-orange-300 bg-orange-50">
                        <ArrowUpFromLine className="h-3 w-3" /> Issued
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1 text-blue-700 border-blue-300 bg-blue-50">
                        <ArrowDownToLine className="h-3 w-3" /> Received
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{cheque.bank_name}</TableCell>
                  <TableCell>
                    {cheque.direction === "issued"
                      ? cheque.payee_display_name || cheque.supplier?.name || "-"
                      : cheque.customer
                        ? getCustomerDisplayName(cheque.customer)
                        : "-"}
                  </TableCell>
                  <TableCell>
                    {cheque.direction === "issued" ? (
                      cheque.purchase_order?.order_number || "-"
                    ) : (
                      // The count; click to see which invoices.
                      <Button
                        variant="link"
                        className={`h-auto p-0 ${invoiceCount(cheque) === 0 ? "text-muted-foreground" : ""}`}
                        onClick={() => setDetailsCheque(cheque)}
                        title="View invoices"
                      >
                        {invoiceCount(cheque)}
                      </Button>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{formatCurrency(cheque.amount)}</TableCell>
                  <TableCell>{formatDate(cheque.issue_date)}</TableCell>
                  <TableCell>
                    <span className={isOverdue(cheque) ? "text-red-600 font-semibold" : ""}>
                      {formatDate(cheque.maturity_date)}
                    </span>
                    {isOverdue(cheque) && (
                      <div className="text-xs text-red-500">Matured, awaiting approval</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={getChequeStatusColor(cheque.status)}>
                      {formatStatus(cheque.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <ActionsDropdown cheque={cheque} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

// Correct a cheque captured wrongly. An approved one has already paid its invoices, so only its
// number, bank and notes can change.
function EditChequeDialog({ cheque, onClose, onSaved }: { cheque: Cheque | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ cheque_number: "", bank_name: "", amount: "", issue_date: "", maturity_date: "", notes: "" })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!cheque) return
    setForm({
      cheque_number: cheque.cheque_number,
      bank_name: cheque.bank_name,
      amount: String(cheque.amount),
      issue_date: String(cheque.issue_date).slice(0, 10),
      maturity_date: String(cheque.maturity_date).slice(0, 10),
      notes: cheque.notes ?? "",
    })
  }, [cheque])

  if (!cheque) return null
  const approved = cheque.status === "approved"
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  const save = async () => {
    setSaving(true)
    try {
      const result = await updateCheque(cheque.id, {
        cheque_number: form.cheque_number.trim(),
        bank_name: form.bank_name.trim(),
        notes: form.notes || null,
        ...(approved ? {} : { amount: Number(form.amount), issue_date: form.issue_date, maturity_date: form.maturity_date }),
      })
      toast({ title: "Saved", description: result.message || "Cheque updated" })
      onClose()
      onSaved()
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || "Could not update cheque", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!cheque} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Cheque {cheque.cheque_number}</DialogTitle>
        </DialogHeader>
        {approved && (
          <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-sm text-amber-800">
            Approved: its money is already on the invoices, so only the number, bank and notes can change.
            To change the amount or dates, delete its payment from the customer&apos;s Payments tab and record it again.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Cheque Number</Label>
            <Input value={form.cheque_number} onChange={set("cheque_number")} />
          </div>
          <div className="space-y-1">
            <Label>Bank</Label>
            <Input value={form.bank_name} onChange={set("bank_name")} />
          </div>
          <div className="space-y-1">
            <Label>Amount</Label>
            <Input type="number" min="0" step="0.01" value={form.amount} onChange={set("amount")} disabled={approved} />
          </div>
          <div />
          <div className="space-y-1">
            <Label>Issue Date</Label>
            <Input type="date" value={form.issue_date} onChange={set("issue_date")} disabled={approved} />
          </div>
          <div className="space-y-1">
            <Label>Maturity Date</Label>
            <Input type="date" value={form.maturity_date} onChange={set("maturity_date")} disabled={approved} />
          </div>
          <div className="col-span-2 space-y-1">
            <Label>Notes</Label>
            <Textarea rows={2} value={form.notes} onChange={set("notes")} />
          </div>
        </div>
        {!approved && cheque.direction === "received" && !cheque.invoice_id && (
          <p className="text-xs text-muted-foreground">Changing the amount re-works which invoices it pays, oldest first.</p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving || !form.cheque_number.trim() || !form.bank_name.trim() || (!approved && !(Number(form.amount) > 0))}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ChequeDetailsDialog({ cheque, onClose }: { cheque: Cheque | null; onClose: () => void }) {
  if (!cheque) return null
  const lines = cheque.invoice_lines ?? (cheque.invoice_numbers ?? []).map((n) => ({ invoice_number: n, amount: null }))
  const party = cheque.direction === "issued"
    ? cheque.payee_display_name || cheque.supplier?.name || "-"
    : cheque.customer ? getCustomerDisplayName(cheque.customer) : "-"
  const notPaying = cheque.status === "bounced" || cheque.status === "cancelled"

  const field = (label: string, value: React.ReactNode) => (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  )

  return (
    <Dialog open={!!cheque} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Cheque {cheque.cheque_number}
            <Badge className={getChequeStatusColor(cheque.status)}>{formatStatus(cheque.status)}</Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {field(cheque.direction === "issued" ? "Payee" : "Customer", party)}
          {field("Bank", cheque.bank_name)}
          {field("Amount", formatCurrency(cheque.amount))}
          {field("Direction", cheque.direction === "issued" ? "Issued" : "Received")}
          {field("Issue Date", formatDate(cheque.issue_date))}
          {field("Maturity Date", formatDate(cheque.maturity_date))}
          {cheque.purchase_order?.order_number && field("Purchase Order", cheque.purchase_order.order_number)}
          {cheque.bounce_charge_invoice?.invoice_number && field("Bounced Cheque Charges", cheque.bounce_charge_invoice.invoice_number)}
        </div>

        {cheque.direction === "received" && (
          <div className="space-y-2">
            <p className="text-sm font-semibold">Invoices ({lines.length})</p>
            {lines.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {notPaying ? `This cheque ${cheque.status === "bounced" ? "bounced" : "was cancelled"}, so it pays no invoices.` : "No invoices linked."}
              </p>
            ) : (
              <div className="rounded-md border max-h-64 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">S/No</TableHead>
                      <TableHead>Invoice</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((l, i) => (
                      <TableRow key={l.invoice_number}>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell className="font-medium">{l.invoice_number}</TableCell>
                        <TableCell className="text-right">{l.amount != null ? formatCurrency(l.amount) : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}

        {cheque.notes && <p className="text-sm text-muted-foreground">{cheque.notes}</p>}
      </DialogContent>
    </Dialog>
  )
}
