"use client"

import { useState, useEffect } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { createSupplierPayment } from "@/lib/supplier-payments"
import { getSuppliers } from "@/lib/suppliers"
import { getPurchaseOrders } from "@/lib/purchaseorders"
import { Loader2, CreditCard, Building2, Ticket, FileText, Banknote } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

interface CreateSupplierPaymentSheetProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onPaymentCreated: () => void
}

interface Supplier {
  id: string
  name: string
  email?: string
  phone?: string
}

interface PurchaseOrder {
  id: string
  order_number: string
  supplier_id: string
  items?: any[]
  total_amount?: string | null
  amount_paid?: string | null
}

export default function CreateSupplierPaymentSheet({
  isOpen,
  onOpenChange,
  onPaymentCreated,
}: CreateSupplierPaymentSheetProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [loadingSuppliers, setLoadingSuppliers] = useState(false)
  const [loadingPOs, setLoadingPOs] = useState(false)
  const [filteredPOs, setFilteredPOs] = useState<PurchaseOrder[]>([])
  const [supplierSearch, setSupplierSearch] = useState("")

  const [formData, setFormData] = useState({
    supplier_id: "",
    purchase_order_id: "",
    amount: "",
    payment_date: new Date().toISOString().split("T")[0],
    payment_method: "bank_transfer",
    transaction_reference: "",
    notes: "",
    cheque_number: "",
    bank_name: "",
    maturity_date: "",
  })

  useEffect(() => {
    if (isOpen) {
      fetchSuppliers()
      fetchPurchaseOrders()
    }
  }, [isOpen])

  // Filter POs based on selected supplier
  useEffect(() => {
    if (formData.supplier_id) {
      const filtered = purchaseOrders.filter(
        (po) => po.supplier_id === formData.supplier_id
      )
      setFilteredPOs(filtered)
    } else {
      setFilteredPOs(purchaseOrders)
    }
  }, [formData.supplier_id, purchaseOrders])

  const fetchSuppliers = async () => {
    setLoadingSuppliers(true)
    try {
      const data = await getSuppliers()
      setSuppliers(data || [])
    } catch (error: any) {
      console.error("Error fetching suppliers:", error)
      toast({
        title: "Error",
        description: "Failed to load suppliers",
        variant: "destructive",
      })
    } finally {
      setLoadingSuppliers(false)
    }
  }

  const fetchPurchaseOrders = async () => {
    setLoadingPOs(true)
    try {
      const data = await getPurchaseOrders()
      setPurchaseOrders(data || [])
    } catch (error: any) {
      console.error("Error fetching purchase orders:", error)
    } finally {
      setLoadingPOs(false)
    }
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }))

    // If selecting a PO, auto-fill the supplier and amount if not set
    if (name === "purchase_order_id" && value) {
      const selectedPO = purchaseOrders.find((po) => po.id === value)
      if (selectedPO) {
        setFormData((prev) => ({
          ...prev,
          purchase_order_id: value,
          supplier_id: selectedPO.supplier_id,
          // Optional: auto-fill amount if it's empty
          // amount: prev.amount || selectedPO.total_amount || "" 
        }))
      }
    }
  }

  const selectedPO = purchaseOrders.find((po) => po.id === formData.purchase_order_id)
  const selectedPOBalance = selectedPO
    ? parseFloat(selectedPO.total_amount || "0") - parseFloat(selectedPO.amount_paid || "0")
    : null

  // Never let the field itself hold more than what's owed - clamp as they type
  // rather than only catching it at submit time.
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value
    if (selectedPOBalance !== null && value !== "" && parseFloat(value) > selectedPOBalance) {
      value = String(selectedPOBalance)
    }
    setFormData((prev) => ({ ...prev, amount: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    if (formData.payment_method === "cheque" && (!formData.cheque_number || !formData.bank_name || !formData.maturity_date)) {
      toast({
        title: "Error",
        description: "Cheque number, bank name, and maturity date are required for cheque payments",
        variant: "destructive",
      })
      setLoading(false)
      return
    }

    if (selectedPOBalance !== null && parseFloat(formData.amount || "0") > selectedPOBalance) {
      toast({
        title: "Error",
        description: `Payment amount cannot exceed the balance owed of ${formatCurrency(selectedPOBalance)} on this purchase order`,
        variant: "destructive",
      })
      setLoading(false)
      return
    }

    try {
      const isCheque = formData.payment_method === "cheque"
      const payload = {
        supplier_id: formData.supplier_id,
        purchase_order_id: formData.purchase_order_id || undefined,
        amount: parseFloat(formData.amount),
        payment_date: formData.payment_date,
        payment_method: formData.payment_method,
        transaction_reference: formData.transaction_reference || undefined,
        notes: formData.notes || undefined,
        cheque_number: isCheque ? formData.cheque_number : undefined,
        bank_name: isCheque ? formData.bank_name : undefined,
        maturity_date: isCheque && formData.maturity_date ? formData.maturity_date : undefined,
      }

      await createSupplierPayment(payload)

      toast({
        title: "Success",
        description: isCheque
          ? "Cheque recorded - pending clearance. It won't reduce the balance until approved."
          : "Supplier payment recorded successfully",
      })

      onPaymentCreated()
      onOpenChange(false)
      resetForm()
    } catch (error: any) {
      console.error("Create supplier payment error:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to record payment",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      supplier_id: "",
      purchase_order_id: "",
      amount: "",
      payment_date: new Date().toISOString().split("T")[0],
      payment_method: "bank_transfer",
      transaction_reference: "",
      notes: "",
      cheque_number: "",
      bank_name: "",
      maturity_date: "",
    })
  }

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case "bank_transfer": return <Building2 className="mr-2 h-4 w-4" />
      case "cash": return <Banknote className="mr-2 h-4 w-4" />
      case "cheque": return <Ticket className="mr-2 h-4 w-4" />
      default: return <CreditCard className="mr-2 h-4 w-4" />
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent 
        className="w-[700px] max-w-[700px] !w-[700px] !max-w-[700px] flex flex-col p-0"
        style={{ width: 700, maxWidth: 700 }}
      >
        {/* Modern Header with Gradient */}
        <div className="bg-gradient-to-r from-blue-600/10 via-blue-600/5 to-transparent border-b px-6 py-5">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-3 text-xl">
              <div className="p-2 bg-blue-600/10 rounded-lg">
                <CreditCard className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <span className="block">Record Supplier Payment</span>
                <span className="text-sm font-normal text-muted-foreground">Record a payment made to a supplier</span>
              </div>
            </SheetTitle>
          </SheetHeader>
        </div>

        {/* Scrollable Content */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
            
            {/* Payment Details Card */}
            <Card className="border-0 shadow-sm bg-card/50">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Banknote className="h-4 w-4 text-blue-600" />
                  Payment Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Supplier Selection */}
                <div className="space-y-2">
                  <Label htmlFor="supplier_id" className="text-sm font-medium">Supplier *</Label>
                  <Select
                    value={formData.supplier_id}
                    onValueChange={(value) => handleSelectChange("supplier_id", value)}
                    required
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Select a supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      <div className="px-2 py-2">
                        <Input
                          placeholder="Search suppliers..."
                          value={supplierSearch}
                          onChange={e => setSupplierSearch(e.target.value)}
                          autoFocus
                          className="h-9"
                        />
                      </div>
                      {loadingSuppliers ? (
                        <SelectItem value="loading" disabled>
                          <div className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading suppliers...
                          </div>
                        </SelectItem>
                      ) : suppliers.length > 0 ? (
                        suppliers
                          .filter((supplier) => 
                            (supplier.name?.toLowerCase() || "").includes(supplierSearch.toLowerCase())
                          )
                          .map((supplier) => (
                            <SelectItem key={supplier.id} value={supplier.id}>
                              {supplier.name}
                            </SelectItem>
                          ))
                      ) : (
                        <SelectItem value="none" disabled>
                          No suppliers found
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Purchase Order Selection */}
                <div className="space-y-2">
                  <Label htmlFor="purchase_order_id" className="text-sm font-medium">Purchase Order (Optional)</Label>
                  <Select
                    value={formData.purchase_order_id}
                    onValueChange={(value) =>
                      handleSelectChange("purchase_order_id", value)
                    }
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Select a purchase order" />
                    </SelectTrigger>
                    <SelectContent>
                      {loadingPOs ? (
                        <SelectItem value="loading" disabled>
                          <div className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading purchase orders...
                          </div>
                        </SelectItem>
                      ) : filteredPOs.length > 0 ? (
                        filteredPOs.map((po) => {
                          const balanceOwed = parseFloat(po.total_amount || "0") - parseFloat(po.amount_paid || "0")
                          return (
                            <SelectItem key={po.id} value={po.id}>
                              <span className="font-medium">{po.order_number}</span>
                              <span className="text-muted-foreground ml-2">
                                — {formatCurrency(balanceOwed)} owed
                              </span>
                            </SelectItem>
                          )
                        })
                      ) : (
                        <SelectItem value="none" disabled>
                          No purchase orders available
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-5">
                  {/* Amount */}
                  <div className="space-y-2">
                    <Label htmlFor="amount" className="text-sm font-medium">Amount (KES) *</Label>
                    <Input
                      id="amount"
                      name="amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={selectedPOBalance ?? undefined}
                      value={formData.amount}
                      onChange={handleAmountChange}
                      placeholder="0.00"
                      required
                      className="h-10"
                    />
                    {selectedPOBalance !== null && (
                      <p className="text-xs text-muted-foreground">
                        Balance owed on this PO: {formatCurrency(selectedPOBalance)}
                      </p>
                    )}
                  </div>

                  {/* Payment Date */}
                  <div className="space-y-2">
                    <Label htmlFor="payment_date" className="text-sm font-medium">Payment Date *</Label>
                    <Input
                      id="payment_date"
                      name="payment_date"
                      type="date"
                      value={formData.payment_date}
                      onChange={handleChange}
                      required
                      className="h-10"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-5">
                  {/* Payment Method */}
                  <div className="space-y-2">
                    <Label htmlFor="payment_method" className="text-sm font-medium">Payment Method *</Label>
                    <Select
                      value={formData.payment_method}
                      onValueChange={(value) =>
                        handleSelectChange("payment_method", value)
                      }
                    >
                      <SelectTrigger className="h-10">
                        <div className="flex items-center">
                          {getPaymentMethodIcon(formData.payment_method)}
                          <SelectValue placeholder="Select method" />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                        <SelectItem value="mpesa">M-Pesa</SelectItem>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="cheque">Cheque</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Transaction Reference */}
                  <div className="space-y-2">
                    <Label htmlFor="transaction_reference" className="text-sm font-medium">
                      Reference (Optional)
                    </Label>
                    <Input
                      id="transaction_reference"
                      name="transaction_reference"
                      value={formData.transaction_reference}
                      onChange={handleChange}
                      placeholder="e.g., REF-123"
                      className="h-10"
                    />
                  </div>
                </div>

                {formData.payment_method === "cheque" && (
                  <div className="space-y-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm text-amber-800">
                      A cheque isn't guaranteed money yet - this won't reduce the purchase order balance until
                      it's marked cleared. The Director/GM will be alerted a week before it matures.
                    </p>
                    <div className="grid grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <Label htmlFor="cheque_number" className="text-sm font-medium">Cheque Number *</Label>
                        <Input
                          id="cheque_number"
                          name="cheque_number"
                          value={formData.cheque_number}
                          onChange={handleChange}
                          placeholder="e.g., 000123"
                          required={formData.payment_method === "cheque"}
                          className="h-10 bg-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="bank_name" className="text-sm font-medium">Bank Name *</Label>
                        <Input
                          id="bank_name"
                          name="bank_name"
                          value={formData.bank_name}
                          onChange={handleChange}
                          placeholder="e.g., Equity Bank"
                          required={formData.payment_method === "cheque"}
                          className="h-10 bg-white"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="maturity_date" className="text-sm font-medium">Maturity Date *</Label>
                      <Input
                        id="maturity_date"
                        name="maturity_date"
                        type="date"
                        min={formData.payment_date}
                        value={formData.maturity_date}
                        onChange={handleChange}
                        required={formData.payment_method === "cheque"}
                        className="h-10 bg-white"
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Notes Section */}
            <Card className="border-0 shadow-sm bg-card/50">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-4 w-4 text-blue-600" />
                  Additional Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  id="notes"
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  placeholder="Any additional comments..."
                  rows={3}
                  className="resize-none"
                />
              </CardContent>
            </Card>
          </div>

          {/* Sticky Footer */}
          <div className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {formData.amount && (
                  <span>Payment Amount: <span className="font-semibold text-foreground">{formatCurrency(parseFloat(formData.amount))}</span></span>
                )}
              </div>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={loading}
                  className="min-w-[100px]"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="min-w-[150px] bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={loading || !formData.supplier_id || !formData.amount}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Recording...
                    </>
                  ) : (
                    "Record Payment"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
