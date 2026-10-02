"use client"

import { useState, useEffect, use, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { fetchOrderById, OrderDetail } from "@/lib/orders"
import { getCompany, Company } from "@/lib/company"
import { getCustomerProfile, getCustomerDisplayName, CustomerProfileData } from "@/lib/customers"
import { ArrowLeft, Download, Printer } from "lucide-react"
import { Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function OrderDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { toast } = useToast()
  const orderRef = useRef<HTMLDivElement>(null)
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [company, setCompany] = useState<Company | null>(null)
  const [customerDetails, setCustomerDetails] = useState<CustomerProfileData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDownloading, setIsDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const getOrder = async () => {
      try {
        const fetchedOrder = await fetchOrderById(id)
        if (!fetchedOrder) {
          setError("Order not found")
          return
        }
        setOrder(fetchedOrder)

        // Fetch company data attached to the order
        if (fetchedOrder.company_id) {
          try {
            const companyData = await getCompany(fetchedOrder.company_id)
            setCompany(companyData)
          } catch (err) {
            console.error('Failed to fetch company:', err)
          }
        }

        // Fetch full customer details for consistent display name / address
        if (fetchedOrder.customer_id) {
          try {
            const fullCustomerData = await getCustomerProfile(fetchedOrder.customer_id)
            if (fullCustomerData) {
              setCustomerDetails(fullCustomerData)
            }
          } catch (err) {
            console.error('Failed to fetch customer details:', err)
          }
        }
      } catch (err: any) {
        setError(err.message || "Failed to load order")
      } finally {
        setIsLoading(false)
      }
    }

    getOrder()
  }, [id])

  const handlePrint = () => {
    window.print()
  }

  // Allow linking straight to a print dialog, e.g. a "Print" button elsewhere in the app.
  useEffect(() => {
    if (!isLoading && order && typeof window !== 'undefined' && window.location.search.includes('autoprint=1')) {
      const timer = setTimeout(() => window.print(), 300)
      return () => clearTimeout(timer)
    }
  }, [isLoading, order])

  const handleDownloadPDF = async () => {
    if (!orderRef.current || !order) return

    setIsDownloading(true)

    try {
      // Dynamically import the libraries
      const html2canvas = (await import('html2canvas')).default
      const { jsPDF } = await import('jspdf')

      const element = orderRef.current

      // Create canvas from the order element
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
      })

      const imgData = canvas.toDataURL('image/png')

      // Calculate dimensions for A4 page
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      })

      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()
      const imgWidth = canvas.width
      const imgHeight = canvas.height
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight)
      const imgX = (pdfWidth - imgWidth * ratio) / 2
      const imgY = 10

      pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio)
      pdf.save(`Order-${order.order_number}.pdf`)

      toast({
        title: "Success",
        description: "Order PDF downloaded successfully",
      })
    } catch (err) {
      console.error('Failed to generate PDF:', err)
      toast({
        title: "Error",
        description: "Failed to generate PDF. Please try printing instead.",
        variant: "destructive",
      })
    } finally {
      setIsDownloading(false)
    }
  }

  const formatAmount = (amount: string | number | undefined | null): string => {
    const num = typeof amount === 'string' ? parseFloat(amount) : (amount ?? 0)
    return (isNaN(num as number) ? 0 : num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 p-6 rounded-lg">
          <h2 className="text-lg font-semibold text-red-800">Error Loading Order</h2>
          <p className="mt-2 text-red-600">{error || "Order not found"}</p>
          <Button
            variant="outline"
            onClick={() => router.back()}
            className="mt-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    )
  }

  const displayName = order.customer
    ? getCustomerDisplayName({
        name: customerDetails?.name || order.customer.name,
        business_name: customerDetails?.business_name || order.customer.business_name,
        customer_type: customerDetails?.customer_type || order.customer.customer_type,
      })
    : 'Customer'

  // Show the "c/o <contact person>" line whenever a business name was
  // actually captured, not just for customer_type === 'company' -
  // individuals can fill this in too now.
  const isCompanyCustomer = !!(customerDetails?.business_name || order.customer?.business_name)

  const deliveryLocation = order.delivery_location
  const deliveryAddressParts = deliveryLocation
    ? [
        deliveryLocation.house_number,
        deliveryLocation.street,
        deliveryLocation.estate,
        deliveryLocation.city,
        deliveryLocation.country,
      ].filter(Boolean)
    : []

  const subtotal = order.total_amount
  const tax = order.tax
  const discount = order.discount
  const grandTotal = order.final_amount || order.total_amount

  return (
    <div className="min-h-screen bg-gray-50 print:min-h-0 print:bg-white">
      {/* Action Bar - Hide on print */}
      <div className="bg-white border-b print:hidden sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => router.back()} size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadPDF}
                disabled={isDownloading}
              >
                {isDownloading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                {isDownloading ? 'Generating...' : 'Download PDF'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Order Document */}
      <div className="container mx-auto px-4 py-8 print:p-0 print:m-0 print:max-w-none">
        <Card
          ref={orderRef}
          className="max-w-4xl mx-auto bg-white p-8 md:p-12 shadow-lg print:shadow-none print:max-w-none print:m-0 print:p-8 print:border-0"
        >
          {/* Letterhead Banner - the sole source of company identity/contact info on this document */}
          {company?.letterhead_url && (
            <img
              src={company.letterhead_url}
              alt={`${company?.name || 'Company'} letterhead`}
              className="w-full h-auto mb-8"
              crossOrigin="anonymous"
            />
          )}

          {/* Header */}
          <div className="flex justify-between items-start mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">ORDER</h1>
              <p className="text-lg text-gray-600">#{order.order_number}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Order Date</p>
              <p className="font-semibold">{new Date(order.created_at).toLocaleDateString()}</p>
              <p className="text-sm text-gray-600 mt-2">Status</p>
              <p className="font-semibold capitalize">{order.status?.replace('_', ' ')}</p>
            </div>
          </div>

          {/* Customer / Delivery Info */}
          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <p className="text-sm font-semibold text-gray-600 mb-2">CUSTOMER</p>
              <div className="text-gray-900">
                <p className="font-semibold">{displayName}</p>
                {isCompanyCustomer && (
                  <p className="text-sm">c/o {customerDetails?.name || order.customer?.name}</p>
                )}
                {(customerDetails?.email || order.customer?.email) && (
                  <p className="text-sm">{customerDetails?.email || order.customer?.email}</p>
                )}
                {(customerDetails?.phone || order.customer?.phone) && (
                  <p className="text-sm">{customerDetails?.phone || order.customer?.phone}</p>
                )}
                {customerDetails?.address && (
                  <p className="text-sm">{customerDetails.address}</p>
                )}
              </div>
            </div>

            {deliveryLocation && (
              <div>
                <p className="text-sm font-semibold text-gray-600 mb-2">DELIVERY LOCATION</p>
                <div className="text-gray-900 text-sm">
                  {deliveryAddressParts.length > 0 && <p>{deliveryAddressParts.join(', ')}</p>}
                  {deliveryLocation.landmark && <p>Landmark: {deliveryLocation.landmark}</p>}
                  {deliveryLocation.location_note && <p>{deliveryLocation.location_note}</p>}
                </div>
              </div>
            )}
          </div>

          {/* Line Items Table */}
          <div className="mb-8">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-300">
                  <th className="text-left py-3 text-sm font-semibold text-gray-700">PRODUCT</th>
                  <th className="text-right py-3 text-sm font-semibold text-gray-700">QTY</th>
                  <th className="text-right py-3 text-sm font-semibold text-gray-700">UNIT PRICE</th>
                  <th className="text-right py-3 text-sm font-semibold text-gray-700">AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                {order.order_items && order.order_items.map((item, index) => (
                  <tr key={item.id || index} className="border-b border-gray-200">
                    <td className="py-3 text-sm text-gray-900">
                      {item.product?.name || 'Product'}
                      {item.variant_name && (
                        <span className="text-gray-500"> ({item.variant_name})</span>
                      )}
                    </td>
                    <td className="text-right py-3 text-sm text-gray-900">{item.quantity}</td>
                    <td className="text-right py-3 text-sm text-gray-900">KES {formatAmount(item.unit_price)}</td>
                    <td className="text-right py-3 text-sm text-gray-900">KES {formatAmount(item.total_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals Section */}
          <div className="flex justify-end mb-8">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal:</span>
                <span className="text-gray-900">KES {formatAmount(subtotal)}</span>
              </div>
              {tax && parseFloat(tax) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tax:</span>
                  <span className="text-gray-900">KES {formatAmount(tax)}</span>
                </div>
              )}
              {discount && parseFloat(discount) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Discount:</span>
                  <span className="text-green-600">-KES {formatAmount(discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold border-t-2 border-gray-300 pt-2">
                <span>Total:</span>
                <span>KES {formatAmount(grandTotal)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {order.notes && (
            <div className="border-t border-gray-200 pt-6 space-y-4">
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-1">Notes</p>
                <p className="text-sm text-gray-600">{order.notes}</p>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="mt-12 pt-6 border-t border-gray-200 text-center text-xs text-gray-500">
            <p>Thank you for your business!</p>
          </div>
        </Card>
      </div>
    </div>
  )
}
