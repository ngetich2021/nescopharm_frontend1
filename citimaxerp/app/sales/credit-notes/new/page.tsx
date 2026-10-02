"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import {
  createCreditNote,
  fetchCreditNoteById,
  parseCreditNoteAmount,
  updateCreditNote,
} from "@/lib/credit-notes"
import { fetchInvoiceById, fetchInvoices, Invoice } from "@/lib/invoices"
import { formatCurrency } from "@/lib/utils"
import { ArrowLeft, Check, ChevronsUpDown, Loader2, Plus, Trash2 } from "lucide-react"

interface EditableLineItem {
  description: string
  quantity: number
  unit: string
  unit_price: number
  discount_amount: number
  tax_rate: number
}

const buildEmptyLineItem = (): EditableLineItem => ({
  description: "",
  quantity: 1,
  unit: "pcs",
  unit_price: 0,
  discount_amount: 0,
  tax_rate: 0,
})

function getInvoiceCustomerName(invoice: Invoice): string {
  const customer = invoice.customer as any
  // Show a captured business name whenever it exists, not just for
  // customer_type === "company" - individuals can fill this in too now.
  if (customer?.business_name) {
    return customer.business_name
  }

  return invoice.customer?.name || "Unknown customer"
}

function getLineSubtotal(lineItem: EditableLineItem): number {
  return Math.max(0, Number(lineItem.quantity || 0) * Number(lineItem.unit_price || 0))
}

function getLineDiscount(lineItem: EditableLineItem): number {
  return Math.max(0, Math.min(Number(lineItem.discount_amount || 0), getLineSubtotal(lineItem)))
}

function getLineTax(lineItem: EditableLineItem): number {
  const rate = Math.max(0, Number(lineItem.tax_rate || 0))
  const taxableAmount = getLineSubtotal(lineItem) - getLineDiscount(lineItem)
  return taxableAmount * (rate / 100)
}

function getLineTotal(lineItem: EditableLineItem): number {
  return getLineSubtotal(lineItem) - getLineDiscount(lineItem) + getLineTax(lineItem)
}

function mapInvoiceLineItemsToCreditNoteItems(invoiceLineItems?: Invoice["line_items"]): EditableLineItem[] {
  if (!invoiceLineItems || invoiceLineItems.length === 0) {
    return [buildEmptyLineItem()]
  }

  return invoiceLineItems.map((lineItem) => ({
    description: lineItem.description || "",
    quantity: parseCreditNoteAmount(lineItem.quantity) || 0,
    unit: lineItem.unit || "pcs",
    unit_price: parseCreditNoteAmount(lineItem.unit_price) || 0,
    discount_amount: parseCreditNoteAmount(lineItem.discount_amount) || 0,
    tax_rate: parseCreditNoteAmount(lineItem.tax_rate) || 0,
  }))
}

export default function NewCreditNotePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const queryInvoiceId = searchParams.get("invoice_id") || ""
  const editCreditNoteId = searchParams.get("edit_id") || ""
  const isEditMode = Boolean(editCreditNoteId)

  const [isLoadingPage, setIsLoadingPage] = useState(false)
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isInvoicePickerOpen, setIsInvoicePickerOpen] = useState(false)
  const [invoices, setInvoices] = useState<Invoice[]>([])

  const [selectedInvoiceId, setSelectedInvoiceId] = useState("")
  const [creditNoteDate, setCreditNoteDate] = useState(new Date().toISOString().split("T")[0])
  const [expiryDate, setExpiryDate] = useState("")
  const [reason, setReason] = useState("")
  const [currency, setCurrency] = useState("KES")
  const [notes, setNotes] = useState("")
  const [lineItems, setLineItems] = useState<EditableLineItem[]>([buildEmptyLineItem()])

  const selectedInvoice = useMemo(
    () => invoices.find((invoice) => invoice.id === selectedInvoiceId) || null,
    [invoices, selectedInvoiceId]
  )

  const totals = useMemo(() => {
    const subtotal = lineItems.reduce((sum, item) => sum + getLineSubtotal(item), 0)
    const discountAmount = lineItems.reduce((sum, item) => sum + getLineDiscount(item), 0)
    const taxAmount = lineItems.reduce((sum, item) => sum + getLineTax(item), 0)

    return {
      subtotal,
      discountAmount,
      taxAmount,
      total: subtotal - discountAmount + taxAmount,
    }
  }, [lineItems])

  const loadInvoices = async () => {
    try {
      setIsLoadingInvoices(true)
      const response = await fetchInvoices({ per_page: 500 })
      setInvoices(response.data || [])
    } catch (error: any) {
      setInvoices([])
      toast({
        title: "Error",
        description: error?.message || "Failed to load invoices",
        variant: "destructive",
      })
    } finally {
      setIsLoadingInvoices(false)
    }
  }

  const loadCreditNoteForEdit = async (creditNoteId: string) => {
    try {
      setIsLoadingPage(true)

      const creditNote = await fetchCreditNoteById(creditNoteId)

      if (creditNote.status !== "draft") {
        toast({
          title: "Cannot Edit Credit Note",
          description: "Only draft credit notes can be edited.",
          variant: "destructive",
        })
        router.replace(`/sales/credit-notes/${creditNote.id}`)
        return
      }

      setSelectedInvoiceId(creditNote.invoice_id)
      setCreditNoteDate(creditNote.credit_note_date || new Date().toISOString().split("T")[0])
      setExpiryDate(creditNote.expiry_date || "")
      setReason(creditNote.reason || "")
      setCurrency(creditNote.currency || "KES")
      setNotes(creditNote.notes || "")

      const mappedLineItems: EditableLineItem[] =
        creditNote.line_items?.map((lineItem) => ({
          description: lineItem.description || "",
          quantity: parseCreditNoteAmount(lineItem.quantity) || 0,
          unit: lineItem.unit || "pcs",
          unit_price: parseCreditNoteAmount(lineItem.unit_price) || 0,
          discount_amount: parseCreditNoteAmount(lineItem.discount_amount) || 0,
          tax_rate: parseCreditNoteAmount(lineItem.tax_rate) || 0,
        })) || []

      setLineItems(mappedLineItems.length > 0 ? mappedLineItems : [buildEmptyLineItem()])
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to load credit note",
        variant: "destructive",
      })
      router.replace("/sales/credit-notes")
    } finally {
      setIsLoadingPage(false)
    }
  }

  const prepopulateFromInvoice = async (invoiceId: string) => {
    try {
      const invoiceFromList = invoices.find((invoice) => invoice.id === invoiceId)
      if (invoiceFromList?.line_items && invoiceFromList.line_items.length > 0) {
        setLineItems(mapInvoiceLineItemsToCreditNoteItems(invoiceFromList.line_items))
        return
      }

      const invoiceDetails = await fetchInvoiceById(invoiceId)
      setLineItems(mapInvoiceLineItemsToCreditNoteItems(invoiceDetails.line_items))
    } catch {
      // If invoice line items fail to load, keep current form line items.
    }
  }

  useEffect(() => {
    loadInvoices()
  }, [])

  useEffect(() => {
    if (isEditMode && editCreditNoteId) {
      loadCreditNoteForEdit(editCreditNoteId)
      return
    }

    if (queryInvoiceId) {
      setSelectedInvoiceId((currentValue) => currentValue || queryInvoiceId)
    }
  }, [isEditMode, editCreditNoteId, queryInvoiceId])

  useEffect(() => {
    if (!isEditMode && selectedInvoice?.currency) {
      setCurrency(selectedInvoice.currency)
    }
  }, [selectedInvoice?.currency, isEditMode])

  useEffect(() => {
    if (isEditMode || !selectedInvoiceId) {
      return
    }

    prepopulateFromInvoice(selectedInvoiceId)
  }, [selectedInvoiceId, isEditMode])

  const updateLineItem = <K extends keyof EditableLineItem>(
    index: number,
    key: K,
    value: EditableLineItem[K]
  ) => {
    setLineItems((currentItems) =>
      currentItems.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item
        }

        return {
          ...item,
          [key]: value,
        }
      })
    )
  }

  const addLineItem = () => {
    setLineItems((currentItems) => [...currentItems, buildEmptyLineItem()])
  }

  const removeLineItem = (index: number) => {
    setLineItems((currentItems) => {
      if (currentItems.length === 1) {
        return currentItems
      }

      return currentItems.filter((_, itemIndex) => itemIndex !== index)
    })
  }

  const handleSubmit = async () => {
    const normalizedLineItems = lineItems
      .map((lineItem) => ({
        description: lineItem.description.trim(),
        quantity: Number(lineItem.quantity || 0),
        unit_price: Number(lineItem.unit_price || 0),
        unit: lineItem.unit?.trim() || "pcs",
        discount_amount: Math.max(0, Number(lineItem.discount_amount || 0)),
        tax_rate: Math.max(0, Number(lineItem.tax_rate || 0)),
      }))
      .filter((lineItem) => lineItem.description && lineItem.quantity > 0)

    if (!selectedInvoiceId) {
      toast({
        title: "Invoice Required",
        description: "Please select an invoice.",
        variant: "destructive",
      })
      return
    }

    if (!creditNoteDate) {
      toast({
        title: "Date Required",
        description: "Please provide the credit note date.",
        variant: "destructive",
      })
      return
    }

    if (normalizedLineItems.length === 0) {
      toast({
        title: "Line Items Required",
        description: "Add at least one line item with description and quantity.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSubmitting(true)

      if (isEditMode && editCreditNoteId) {
        const updated = await updateCreditNote(editCreditNoteId, {
          credit_note_date: creditNoteDate,
          expiry_date: expiryDate || undefined,
          reason: reason.trim() || undefined,
          currency: currency || "KES",
          notes: notes.trim() || undefined,
          line_items: normalizedLineItems,
        })

        toast({
          title: "Success",
          description: "Credit note updated successfully.",
        })

        router.push(`/sales/credit-notes/${updated.id}`)
        return
      }

      const created = await createCreditNote({
        invoice_id: selectedInvoiceId,
        credit_note_date: creditNoteDate,
        expiry_date: expiryDate || undefined,
        reason: reason.trim() || undefined,
        currency: currency || "KES",
        notes: notes.trim() || undefined,
        line_items: normalizedLineItems,
      })

      toast({
        title: "Success",
        description: "Credit note created successfully.",
      })

      router.push(`/sales/credit-notes/${created.id}`)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to save credit note",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const invoiceOptions = invoices.filter((invoice) => {
    if (!queryInvoiceId) {
      return true
    }

    return invoice.id === queryInvoiceId || parseCreditNoteAmount(invoice.balance_amount) > 0
  })

  const backHref = isEditMode ? `/sales/credit-notes/${editCreditNoteId}` : "/sales/credit-notes"

  if (isLoadingPage) {
    return (
      <div className="flex-1 space-y-6 p-2 sm:p-4 md:p-8 pt-4 sm:pt-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading credit note...
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-6 p-2 sm:p-4 md:p-8 pt-4 sm:pt-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href={backHref}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>

          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">
              {isEditMode ? "Edit Credit Note" : "New Credit Note"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isEditMode ? "Update draft credit note details" : "Create a draft credit note for an existing invoice"}
            </p>
          </div>
        </div>

        <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full sm:w-auto">
          {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {isEditMode ? "Save Changes" : "Create Credit Note"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Credit Note Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Invoice</Label>
              <Popover
                open={isEditMode ? false : isInvoicePickerOpen}
                onOpenChange={isEditMode ? undefined : setIsInvoicePickerOpen}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="justify-between w-full"
                    disabled={isEditMode || isLoadingInvoices}
                  >
                    {isLoadingInvoices
                      ? "Loading invoices..."
                      : selectedInvoice
                        ? `${selectedInvoice.invoice_number} • ${getInvoiceCustomerName(selectedInvoice)}`
                        : "Select invoice"}
                    <ChevronsUpDown className="h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]" align="start">
                  <Command>
                    <CommandInput placeholder="Search invoice or customer" />
                    <CommandList>
                      <CommandEmpty>No invoices found.</CommandEmpty>
                      <CommandGroup>
                        {invoiceOptions.map((invoice) => (
                          <CommandItem
                            key={invoice.id}
                            value={`${invoice.invoice_number} ${getInvoiceCustomerName(invoice)}`}
                            onSelect={() => {
                              setSelectedInvoiceId(invoice.id)
                              setIsInvoicePickerOpen(false)
                            }}
                          >
                            <div className="flex w-full items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="font-medium truncate">{invoice.invoice_number}</div>
                                <div className="text-xs text-muted-foreground truncate">
                                  {getInvoiceCustomerName(invoice)} • Balance {formatCurrency(parseCreditNoteAmount(invoice.balance_amount))}
                                </div>
                              </div>

                              {selectedInvoiceId === invoice.id && <Check className="h-4 w-4" />}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {isEditMode && (
                <p className="text-xs text-muted-foreground">Invoice cannot be changed when editing.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Input
                id="currency"
                value={currency}
                onChange={(event) => setCurrency(event.target.value.toUpperCase())}
                maxLength={8}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="credit_note_date">Credit Note Date</Label>
              <Input
                id="credit_note_date"
                type="date"
                value={creditNoteDate}
                onChange={(event) => setCreditNoteDate(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expiry_date">Expiry Date</Label>
              <Input
                id="expiry_date"
                type="date"
                value={expiryDate}
                onChange={(event) => setExpiryDate(event.target.value)}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="reason">Reason</Label>
              <Input
                id="reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Returned goods, overcharge adjustment, etc"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Optional internal or customer-facing notes"
                rows={3}
              />
            </div>
          </div>

          {selectedInvoice && (
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="secondary">{selectedInvoice.status}</Badge>
                <span>
                  Invoice Balance: <strong>{formatCurrency(parseCreditNoteAmount(selectedInvoice.balance_amount))}</strong>
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>Line Items</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
            <Plus className="h-4 w-4 mr-2" />
            Add Line
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {lineItems.map((lineItem, index) => (
            <div key={index} className="rounded-lg border p-3 space-y-3">
              <div className="grid gap-3 lg:grid-cols-12">
                <div className="lg:col-span-4 space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={lineItem.description}
                    onChange={(event) => updateLineItem(index, "description", event.target.value)}
                    placeholder="Describe the credited item"
                    rows={2}
                  />
                </div>

                <div className="lg:col-span-1 space-y-2">
                  <Label>Qty</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={lineItem.quantity}
                    onChange={(event) => updateLineItem(index, "quantity", Number(event.target.value))}
                  />
                </div>

                <div className="lg:col-span-1 space-y-2">
                  <Label>Unit</Label>
                  <Input
                    value={lineItem.unit}
                    onChange={(event) => updateLineItem(index, "unit", event.target.value)}
                  />
                </div>

                <div className="lg:col-span-2 space-y-2">
                  <Label>Unit Price</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={lineItem.unit_price}
                    onChange={(event) => updateLineItem(index, "unit_price", Number(event.target.value))}
                  />
                </div>

                <div className="lg:col-span-1 space-y-2">
                  <Label>Discount</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={lineItem.discount_amount}
                    onChange={(event) => updateLineItem(index, "discount_amount", Number(event.target.value))}
                  />
                </div>

                <div className="lg:col-span-1 space-y-2">
                  <Label>Tax %</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={lineItem.tax_rate}
                    onChange={(event) => updateLineItem(index, "tax_rate", Number(event.target.value))}
                  />
                </div>

                <div className="lg:col-span-2 space-y-2">
                  <Label>Line Total</Label>
                  <div className="h-10 rounded-md border bg-muted/40 px-3 flex items-center text-sm font-medium">
                    {formatCurrency(getLineTotal(lineItem))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => removeLineItem(index)}
                  disabled={lineItems.length === 1}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Totals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatCurrency(totals.subtotal)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Discount</span>
            <span className="text-green-600">-{formatCurrency(totals.discountAmount)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Tax</span>
            <span>{formatCurrency(totals.taxAmount)}</span>
          </div>

          <Separator />

          <div className="flex items-center justify-between font-semibold text-base">
            <span>Total</span>
            <span>{formatCurrency(totals.total)}</span>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row justify-end gap-3">
        <Link href={backHref}>
          <Button variant="outline" className="w-full sm:w-auto">Cancel</Button>
        </Link>
        <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full sm:w-auto">
          {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {isEditMode ? "Save Changes" : "Create Credit Note"}
        </Button>
      </div>
    </div>
  )
}
