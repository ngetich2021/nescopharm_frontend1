"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Printer, Download, Eye } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { getCustomerDisplayName } from "@/lib/customers"

interface ReceiptPrinterProps {
  order: any
}

export function ReceiptPrinter({ order }: ReceiptPrinterProps) {
  const [showPreview, setShowPreview] = useState(false)
  const { toast } = useToast()

  const generateReceiptText = () => {
    const width = 32 // Characters width for 58mm thermal paper
    const line = "=".repeat(width)
    const dashes = "-".repeat(width)

    const center = (text: string) => {
      const padding = Math.max(0, Math.floor((width - text.length) / 2))
      return " ".repeat(padding) + text
    }

    const leftRight = (left: string, right: string) => {
      const spaces = Math.max(1, width - left.length - right.length)
      return left + " ".repeat(spaces) + right
    }

    let receipt = ""

    // Company Name (from order or fallback)
    const companyName = order.company?.name || "CITIMAX STORE"
    receipt += center(companyName) + "\n"
    receipt += line + "\n"

    // Customer
    receipt += leftRight("Customer:", order.customer ? getCustomerDisplayName(order.customer) : "Walk-in") + "\n"
    if (order.customer?.email) {
      receipt += leftRight("Email:", order.customer.email) + "\n"
    }
    receipt += dashes + "\n"

    // Items
    receipt += "ITEMS:\n"
    order.items.forEach((item: any) => {
      const itemName = item.name + (item.variant ? ` (${item.variant})` : "")
      const qty = `${item.quantity}x`
      const price = `Ksh. ${(item.price * item.quantity).toFixed(2)}`

      // Item name (may wrap)
      if (itemName.length > width) {
        receipt += itemName.substring(0, width) + "\n"
        if (itemName.length > width) {
          receipt += itemName.substring(width) + "\n"
        }
      } else {
        receipt += itemName + "\n"
      }

      // Quantity and price
      receipt += leftRight(qty, price) + "\n"
    })

    receipt += dashes + "\n"

    // Totals
    receipt += leftRight("Subtotal:", `Ksh. ${order.subtotal.toFixed(2)}`) + "\n"
    receipt += leftRight("Tax:", `Ksh. ${order.tax.toFixed(2)}`) + "\n"
    receipt += line + "\n"
    receipt += leftRight("TOTAL:", `Ksh. ${order.total.toFixed(2)}`) + "\n"
    receipt += line + "\n"

    // Payments (show all payments made)
    if (order.payments && Array.isArray(order.payments)) {
      receipt += "PAYMENTS:\n"
      order.payments.forEach((p: any, idx: number) => {
        receipt += leftRight(
          `${p.method.toUpperCase()}${p.txnCode ? ` (${p.txnCode})` : ""}${p.phone ? ` (${p.phone})` : ""}`,
          `Ksh. ${p.amount.toFixed(2)}`
        ) + "\n"
        if (p.change > 0) {
          receipt += leftRight("Change:", `Ksh. ${p.change.toFixed(2)}`) + "\n"
        }
      })
      receipt += dashes + "\n"
    }

    return receipt
  }

  const handlePrint = () => {
    const receiptText = generateReceiptText()

    // Create a new window for printing
    const printWindow = window.open("", "_blank")
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Receipt - ${order.id}</title>
            <style>
              body {
                font-family: 'Courier New', monospace;
                font-size: 12px;
                line-height: 1.2;
                margin: 0;
                padding: 10px;
                white-space: pre-wrap;
              }
              @media print {
                body { margin: 0; padding: 5px; }
              }
            </style>
          </head>
          <body>${receiptText}</body>
        </html>
      `)
      printWindow.document.close()
      printWindow.print()
    }

    toast({
      title: "Receipt sent to printer",
      description: "Receipt has been sent to the default printer",
    })
  }

  const handleDownload = () => {
    const receiptText = generateReceiptText()
    const blob = new Blob([receiptText], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `receipt-${order.id}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast({
      title: "Receipt downloaded",
      description: "Receipt has been saved as a text file",
    })
  }

  return (
    <div className="flex gap-2">
      <Button onClick={handlePrint} variant="outline" size="sm" className="flex-1 bg-transparent">
        <Printer className="h-4 w-4 mr-1" />
        Print
      </Button>

      <Button onClick={handleDownload} variant="outline" size="sm" className="flex-1 bg-transparent">
        <Download className="h-4 w-4 mr-1" />
        Download
      </Button>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Eye className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Receipt Preview</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea value={generateReceiptText()} readOnly className="font-mono text-xs h-96 resize-none" />
            <div className="flex gap-2">
              <Button onClick={handlePrint} className="flex-1">
                <Printer className="h-4 w-4 mr-1" />
                Print
              </Button>
              <Button onClick={handleDownload} variant="outline" className="flex-1 bg-transparent">
                <Download className="h-4 w-4 mr-1" />
                Download
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
