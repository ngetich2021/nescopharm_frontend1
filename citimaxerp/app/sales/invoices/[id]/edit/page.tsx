"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { fetchInvoiceById, Invoice } from "@/lib/invoices"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/lib/auth-context"
import { EditInvoiceSheet } from "@/components/sheets/edit-invoice-sheet"

export default function EditInvoicePage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const { isLoading: authLoading, user } = useAuth()
  
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(true)

  useEffect(() => {
    if (params.id && !authLoading && user) {
      loadInvoice(params.id as string)
    }
  }, [params.id, authLoading, user])

  const loadInvoice = async (invoiceId: string) => {
    try {
      setIsLoading(true)
      const invoiceData = await fetchInvoiceById(invoiceId)
      setInvoice(invoiceData)
      
      // Check if invoice can be edited (only draft invoices)
      if (invoiceData.status !== 'draft') {
        toast({
          title: "Cannot Edit Invoice",
          description: "Only draft invoices can be edited. This invoice has already been sent.",
          variant: "destructive",
        })
        router.push(`/sales/invoices/${invoiceId}`)
        return
      }
    } catch (error: any) {
      console.error('Failed to load invoice:', error)
      
      let errorMessage = "Failed to load invoice"
      
      if (error.message?.includes('not logged in') || error.message?.includes('Unauthorized')) {
        errorMessage = "Please sign in to access this page."
        router.push('/sign-in')
        return
      } else if (error.message?.includes('404') || error.message?.includes('not found')) {
        errorMessage = "Invoice not found or you don't have permission to view it."
      } else if (error.message) {
        errorMessage = error.message
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
      router.push('/sales?tab=invoices')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    setIsOpen(false)
    router.push('/sales?tab=invoices')
  }

  const handleSuccess = () => {
    toast({
      title: "Success",
      description: "Invoice updated successfully",
    })
    router.push(`/sales/invoices/${invoice?.id}`)
  }

  // Show loading while authentication is loading or invoice is being fetched
  if (authLoading || (isLoading && !invoice)) {
    return (
      <div className="flex-1 space-y-6 p-8 pt-6">
        <div className="text-center py-8">Loading invoice...</div>
      </div>
    )
  }

  if (!invoice && !isLoading && !authLoading) {
    return (
      <div className="flex-1 space-y-6 p-8 pt-6">
        <div className="text-center py-8">Invoice not found</div>
      </div>
    )
  }

  return (
    <>
      {params.id && (
        <EditInvoiceSheet
          open={isOpen}
          onClose={handleClose}
          onSuccess={handleSuccess}
          invoiceId={params.id as string}
        />
      )}
    </>
  )
}
