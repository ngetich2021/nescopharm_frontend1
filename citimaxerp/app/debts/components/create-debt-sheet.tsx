"use client"

import { useState, useEffect } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { CalendarIcon, Plus } from "lucide-react"
import type { Debt, CreateDebtRequest } from "@/types/debts"
import { createDebt, updateDebt } from "@/lib/debts"
import { toast } from "sonner"

interface CreateDebtSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onDebtCreated?: (debt: Debt) => void
  editDebt?: Debt | null
  onClose?: () => void
}

export function CreateDebtSheet({ open, onOpenChange, onDebtCreated, editDebt, onClose }: CreateDebtSheetProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [customerName, setCustomerName] = useState("")
  const [customerEmail, setCustomerEmail] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")
  const [category, setCategory] = useState<string>("")
  const [priority, setPriority] = useState<string>("")
  const [dueDate, setDueDate] = useState<Date>(new Date())
  const [notes, setNotes] = useState("")

  const isEditing = !!editDebt

  useEffect(() => {
    if (editDebt) {
      setCustomerName(editDebt.customerName)
      setCustomerEmail(editDebt.customerEmail || "")
      setCustomerPhone(editDebt.customerPhone || "")
      setDescription(editDebt.description)
      setAmount(editDebt.amount.toString())
      setCategory(editDebt.category)
      setPriority(editDebt.priority)
      setDueDate(new Date(editDebt.dueDate))
      setNotes(editDebt.notes || "")
    } else {
      resetForm()
    }
  }, [editDebt, open])

  const resetForm = () => {
    setCustomerName("")
    setCustomerEmail("")
    setCustomerPhone("")
    setDescription("")
    setAmount("")
    setCategory("")
    setPriority("")
    setDueDate(new Date())
    setNotes("")
  }

  const handleSubmit = async () => {
    if (!customerName || !description || !amount || !category || !priority) {
      toast.error("Please fill in all required fields")
      return
    }

    const amountValue = Number.parseFloat(amount)
    if (amountValue <= 0) {
      toast.error("Amount must be greater than 0")
      return
    }

    setIsSubmitting(true)
    try {
      if (isEditing && editDebt) {
        const updatedDebt = await updateDebt(editDebt.id, {
          customerName,
          customerEmail: customerEmail || undefined,
          customerPhone: customerPhone || undefined,
          description,
          amount: amountValue,
          category: category as any,
          priority: priority as any,
          dueDate: format(dueDate, "yyyy-MM-dd"),
          notes: notes || undefined,
        })
        onDebtCreated?.(updatedDebt)
        toast.success("Debt updated successfully")
      } else {
        const request: CreateDebtRequest = {
          customerId: Math.random().toString(36).substr(2, 9),
          customerName,
          customerEmail: customerEmail || undefined,
          customerPhone: customerPhone || undefined,
          description,
          amount: amountValue,
          category: category as any,
          priority: priority as any,
          dueDate: format(dueDate, "yyyy-MM-dd"),
          notes: notes || undefined,
        }

        const newDebt = await createDebt(request)
        onDebtCreated?.(newDebt)
        toast.success("Debt created successfully")
      }

      resetForm()
      onClose?.()
      onOpenChange(false)
    } catch (error) {
      toast.error(isEditing ? "Failed to update debt" : "Failed to create debt")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    resetForm()
    onClose?.()
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            {isEditing ? "Edit Debt" : "Create New Debt"}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4 mt-6">
          {/* Customer Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Customer Information</h3>

            <div>
              <Label htmlFor="customer-name">Customer Name *</Label>
              <Input
                id="customer-name"
                placeholder="Enter customer name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="customer-email">Email</Label>
              <Input
                id="customer-email"
                type="email"
                placeholder="customer@example.com"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="customer-phone">Phone</Label>
              <Input
                id="customer-phone"
                placeholder="+254712345678"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
            </div>
          </div>

          {/* Debt Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Debt Information</h3>

            <div>
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                placeholder="Describe the debt..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="amount">Amount (KES) *</Label>
              <Input
                id="amount"
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="0"
                step="0.01"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="category">Category *</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer_debt">Customer Debt</SelectItem>
                    <SelectItem value="supplier_debt">Supplier Debt</SelectItem>
                    <SelectItem value="loan">Loan</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="priority">Priority *</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Due Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal bg-transparent">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dueDate, "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={(date) => date && setDueDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Additional notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={handleClose} className="flex-1 bg-transparent">
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting} className="flex-1">
              {isSubmitting ? (isEditing ? "Updating..." : "Creating...") : isEditing ? "Update Debt" : "Create Debt"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
