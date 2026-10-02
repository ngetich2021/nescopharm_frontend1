import { NextRequest, NextResponse } from "next/server"
// import { Resend } from "resend"
import apiCall from "@/lib/api"

// const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
  try {
    const { invoiceId, recipientEmail, recipientName } = await request.json()

    if (!invoiceId || !recipientEmail) {
      return NextResponse.json(
        { error: "Invoice ID and recipient email are required" },
        { status: 400 }
      )
    }

    // Fetch invoice data from API
    const invoiceData = await apiCall<{
      invoice_number: string;
      company_name?: string;
      total?: number;
      created_at: string;
      due_date: string;
    }>(`/invoices/${invoiceId}`, "GET")
    
    if (!invoiceData) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      )
    }

    // Generate PDF content (you might want to call your PDF generation endpoint here)
    const pdfResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/generate-invoice-pdf`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ invoiceId }),
    })

    if (!pdfResponse.ok) {
      throw new Error("Failed to generate PDF")
    }

    // const pdfBuffer = await pdfResponse.arrayBuffer()

    // --- EMAIL SENDING DISABLED ---
    // The following code is commented out until email sending is re-enabled via API endpoint.
    // const { data, error } = await resend.emails.send({ ... })
    // if (error) { ... }

    // Update invoice status to sent (optional, you may want to skip this if no email is sent)
    // try {
    //   await apiCall(`/invoices/${invoiceId}`, "PUT", {
    //     status: "sent",
    //     sent_at: new Date().toISOString(),
    //   })
    // } catch (updateError) {
    //   console.error("Error updating invoice status:", updateError)
    //   // Continue even if status update fails
    // }

    return NextResponse.json({
      success: true,
      message: "Email sending is currently disabled. No email was sent.",
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to send invoice email" },
      { status: 500 }
    )
  }
}
