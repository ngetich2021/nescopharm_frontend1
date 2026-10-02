"use client"

import { useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Loader2, Plus } from "lucide-react"
import { createSupplier, CreateSupplierPayload } from "@/lib/suppliers"
import { useToast } from "@/hooks/use-toast"

interface CreateSupplierSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSupplierCreated: () => void
}

export function CreateSupplierSheet({ open, onOpenChange, onSupplierCreated }: CreateSupplierSheetProps) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState<CreateSupplierPayload>({
    name: "",
    email: "",
    phone: "",
    address: "",
    contact_person: "",
    notes: "",
    is_active: true,
    bank_name: "",
    bank_account_number: "",
    bank_branch: "",
    bank_swift_code: "",
    payment_terms_type: "Net",
    payment_terms_days: 30,
    payment_terms_description: "Payment due in 30 days",
    tax_information: "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      await createSupplier(formData)
      toast({
        title: "Success",
        description: "Supplier created successfully."
      })
      onSupplierCreated()
      onOpenChange(false)
      // Reset form
      setFormData({
        name: "",
        email: "",
        phone: "",
        address: "",
        contact_person: "",
        notes: "",
        is_active: true,
        bank_name: "",
        bank_account_number: "",
        bank_branch: "",
        bank_swift_code: "",
        payment_terms_type: "Net",
        payment_terms_days: 30,
        payment_terms_description: "Payment due in 30 days",
        tax_information: "",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create supplier",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (field: keyof CreateSupplierPayload, value: string | number | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        className="w-[800px] max-w-[800px] !w-[800px] !max-w-[800px] overflow-y-auto"
        style={{ width: 800, maxWidth: 800 }}
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add New Supplier
          </SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Company Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    placeholder="Enter company name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact_person">Contact Person</Label>
                  <Input
                    id="contact_person"
                    value={formData.contact_person}
                    onChange={(e) => handleInputChange("contact_person", e.target.value)}
                    placeholder="Enter contact person name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    placeholder="Enter email address"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => handleInputChange("phone", e.target.value)}
                    placeholder="Enter phone number"
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Textarea
                    id="address"
                    value={formData.address}
                    onChange={(e) => handleInputChange("address", e.target.value)}
                    placeholder="Enter full address"
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => handleInputChange("notes", e.target.value)}
                    placeholder="Enter any additional notes"
                  />
                </div>
                <div className="col-span-2 flex items-center space-x-2">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => handleInputChange("is_active", checked)}
                  />
                  <Label htmlFor="is_active">Active Supplier</Label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bank Information */}
          <Card>
            <CardHeader>
              <CardTitle>Bank Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bank_name">Bank Name</Label>
                  <Input
                    id="bank_name"
                    value={formData.bank_name}
                    onChange={(e) => handleInputChange("bank_name", e.target.value)}
                    placeholder="Enter bank name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bank_account_number">Account Number</Label>
                  <Input
                    id="bank_account_number"
                    value={formData.bank_account_number}
                    onChange={(e) => handleInputChange("bank_account_number", e.target.value)}
                    placeholder="Enter account number"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bank_branch">Branch</Label>
                  <Input
                    id="bank_branch"
                    value={formData.bank_branch}
                    onChange={(e) => handleInputChange("bank_branch", e.target.value)}
                    placeholder="Enter branch name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bank_swift_code">Swift Code</Label>
                  <Input
                    id="bank_swift_code"
                    value={formData.bank_swift_code}
                    onChange={(e) => handleInputChange("bank_swift_code", e.target.value)}
                    placeholder="Enter swift code"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Terms */}
          <Card>
            <CardHeader>
              <CardTitle>Payment Terms</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="payment_terms_type">Terms Type</Label>
                  <Select
                    value={formData.payment_terms_type}
                    onValueChange={(value) => handleInputChange("payment_terms_type", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select terms type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Net">Net</SelectItem>
                      <SelectItem value="Due">Due</SelectItem>
                      <SelectItem value="Immediate">Immediate</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payment_terms_days">Days</Label>
                  <Input
                    id="payment_terms_days"
                    type="number"
                    value={formData.payment_terms_days}
                    onChange={(e) => handleInputChange("payment_terms_days", parseInt(e.target.value))}
                    placeholder="Enter number of days"
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="payment_terms_description">Description</Label>
                  <Input
                    id="payment_terms_description"
                    value={formData.payment_terms_description}
                    onChange={(e) => handleInputChange("payment_terms_description", e.target.value)}
                    placeholder="Enter payment terms description"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tax Information */}
          <Card>
            <CardHeader>
              <CardTitle>Tax Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="tax_information">Tax Information</Label>
                <Input
                  id="tax_information"
                  value={formData.tax_information}
                  onChange={(e) => handleInputChange("tax_information", e.target.value)}
                  placeholder="Enter tax information (e.g., PIN)"
                />
              </div>
            </CardContent>
          </Card>

          <Separator />

          {/* Submit Button */}
          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Supplier
                </>
              )}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
} 