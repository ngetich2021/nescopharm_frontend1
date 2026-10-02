"use client"

import { useState, useEffect } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { 
  Building2, 
  Mail, 
  Phone, 
  MapPin, 
  User, 
  FileText, 
  Banknote, 
  Calendar,
  Edit,
  Trash2,
  Loader2,
  RefreshCw
} from "lucide-react"
import { getSupplier, deleteSupplier, Supplier } from "@/lib/suppliers"
import { useToast } from "@/hooks/use-toast"
import { EditSupplierSheet } from "./components/edit-supplier-sheet"

interface SupplierDetailsSheetProps {
  supplierId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SupplierDetailsSheet({ supplierId, open, onOpenChange }: SupplierDetailsSheetProps) {
  const { toast } = useToast()
  const [supplier, setSupplier] = useState<Supplier | null>(null)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (open && supplierId) {
      fetchSupplierDetails()
    } else {
      setSupplier(null)
      setError(null)
    }
  }, [open, supplierId])

  async function fetchSupplierDetails() {
    if (!supplierId) return
    
    setIsLoading(true)
    setError(null)
    
    try {
      const data = await getSupplier(supplierId)
      setSupplier(data)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch supplier details'))
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : 'Failed to fetch supplier details',
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!supplier) return
    
    try {
      await deleteSupplier(supplier.id)
      toast({
        title: "Success",
        description: "Supplier deleted successfully."
      })
      onOpenChange(false)
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete supplier",
        variant: "destructive"
      })
    }
  }

  const getStatusBadgeClass = (isActive: boolean) => {
    return isActive 
      ? "bg-green-100 text-green-800" 
      : "bg-red-100 text-red-800"
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent 
          className="w-[800px] max-w-[800px] !w-[800px] !max-w-[800px] overflow-y-auto"
          style={{ width: 800, maxWidth: 800 }}
        >
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Supplier Details
            </SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : supplier ? (
              <>
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-2xl font-bold">{supplier.name}</h2>
                    <Badge className={`mt-2 ${getStatusBadgeClass(supplier.is_active)}`}>
                      {supplier.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm" onClick={() => setIsEditOpen(true)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleDelete}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* Contact Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Contact Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <User className="h-4 w-4" />
                          Contact Person
                        </div>
                        <div className="font-medium">{supplier.contact_person}</div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Mail className="h-4 w-4" />
                          Email
                        </div>
                        <div className="font-medium">{supplier.email}</div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Phone className="h-4 w-4" />
                          Phone
                        </div>
                        <div className="font-medium">{supplier.phone}</div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="h-4 w-4" />
                          Address
                        </div>
                        <div className="font-medium">{supplier.address}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Bank Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Banknote className="h-5 w-5" />
                      Bank Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="text-sm text-muted-foreground">Bank Name</div>
                        <div className="font-medium">{supplier.bank_name}</div>
                      </div>
                      <div className="space-y-2">
                        <div className="text-sm text-muted-foreground">Account Number</div>
                        <div className="font-medium">{supplier.bank_account_number}</div>
                      </div>
                      <div className="space-y-2">
                        <div className="text-sm text-muted-foreground">Branch</div>
                        <div className="font-medium">{supplier.bank_branch}</div>
                      </div>
                      <div className="space-y-2">
                        <div className="text-sm text-muted-foreground">Swift Code</div>
                        <div className="font-medium">{supplier.bank_swift_code}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Payment Terms */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Payment Terms
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="text-sm text-muted-foreground">Terms Type</div>
                        <div className="font-medium">{supplier.payment_terms_type}</div>
                      </div>
                      <div className="space-y-2">
                        <div className="text-sm text-muted-foreground">Days</div>
                        <div className="font-medium">{supplier.payment_terms_days} days</div>
                      </div>
                      <div className="col-span-2 space-y-2">
                        <div className="text-sm text-muted-foreground">Description</div>
                        <div className="font-medium">{supplier.payment_terms_description}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Additional Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Additional Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">Tax Information</div>
                      <div className="font-medium">{supplier.tax_information}</div>
                    </div>
                    {supplier.notes && (
                      <div className="space-y-2">
                        <div className="text-sm text-muted-foreground">Notes</div>
                        <div className="font-medium">{supplier.notes}</div>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="text-sm text-muted-foreground">Created</div>
                        <div className="font-medium">
                          {new Date(supplier.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="text-sm text-muted-foreground">Last Updated</div>
                        <div className="font-medium">
                          {new Date(supplier.updated_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : error ? (
              <div className="text-center py-8">
                <div className="text-red-600 mb-2">Failed to load supplier details</div>
                <Button onClick={fetchSupplierDetails} variant="outline">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry
                </Button>
              </div>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
      <EditSupplierSheet
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        supplier={supplier}
        onSupplierUpdated={() => {
          fetchSupplierDetails();
          if (typeof window !== "undefined") {
            // Optionally trigger a global/table/summary refresh if needed
            window.dispatchEvent(new Event("supplier-updated"));
          }
        }}
      />
    </>
  )
} 