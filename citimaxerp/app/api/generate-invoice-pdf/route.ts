import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer";
import apiCall from "@/lib/api";

// This is a placeholder for a PDF generation library.
// In a real application, you would use a library like `puppeteer` or `html-pdf`
// on a serverless function or dedicated backend to generate PDFs.
// For this example, we'll simulate a PDF URL.

export async function POST(request: NextRequest) {
  try {
    const { invoiceId } = await request.json();

    if (!invoiceId) {
      return NextResponse.json(
        { error: "Invoice ID is required" },
        { status: 400 }
      );
    }

    // Fetch invoice data from API
    const invoiceData = await apiCall(`/invoices/${invoiceId}`, "GET");
    
    if (!invoiceData) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    // Generate HTML content for the invoice
    const htmlContent = generateInvoiceHTML(invoiceData);

    // Launch Puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "networkidle0" });

    // Generate PDF
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "20mm",
        right: "20mm",
        bottom: "20mm",
        left: "20mm",
      },
    });

    await browser.close();

    // Return PDF as response
    return new NextResponse(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="invoice-${invoiceId}.pdf"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to generate PDF" },
      { status: 500 }
    );
  }
}

function generateInvoiceHTML(invoiceData: any) {
  // Get the company name from the invoice's attached company
  const companyName = invoiceData.company?.name || invoiceData.company_name || "Your Company";
  const companyEmail = invoiceData.company?.email || "";
  const companyPhone = invoiceData.company?.phone || "";
  const companyAddress = invoiceData.company?.address || "";
  
  // Get customer display name - use business_name for company customers
  const customerDisplayName = invoiceData.customer?.customer_type === 'company' && invoiceData.customer?.business_name
    ? invoiceData.customer.business_name
    : (invoiceData.customer?.name || invoiceData.customer_name || "Customer Name");
  
  // Show contact person for company customers
  const contactPerson = invoiceData.customer?.customer_type === 'company' && invoiceData.customer?.business_name
    ? `<p>c/o ${invoiceData.customer.name}</p>`
    : "";
    
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Invoice ${invoiceData.invoice_number}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            color: #333;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #333;
            padding-bottom: 20px;
          }
          .company-info {
            text-align: center;
            font-size: 12px;
            color: #666;
            margin-top: 10px;
          }
          .invoice-details {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
          }
          .customer-info, .invoice-info {
            flex: 1;
          }
          .invoice-info {
            text-align: right;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
          }
          th {
            background-color: #f8f9fa;
            font-weight: bold;
          }
          .total {
            text-align: right;
            font-weight: bold;
            font-size: 18px;
          }
          .footer {
            margin-top: 50px;
            text-align: center;
            font-size: 12px;
            color: #666;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>INVOICE</h1>
          <h2>${companyName}</h2>
          <div class="company-info">
            ${companyEmail ? `<p>Email: ${companyEmail}</p>` : ""}
            ${companyPhone ? `<p>Phone: ${companyPhone}</p>` : ""}
            ${companyAddress ? `<p>Address: ${companyAddress}</p>` : ""}
          </div>
        </div>
        
        <div class="invoice-details">
          <div class="customer-info">
            <h3>Bill To:</h3>
            <p><strong>${customerDisplayName}</strong></p>
            ${contactPerson}
            <p>${invoiceData.customer?.email || invoiceData.customer_email || ""}</p>
            <p>${invoiceData.customer?.phone || invoiceData.customer_phone || ""}</p>
            <p>${invoiceData.customer?.address || ""}</p>
          </div>
          <div class="invoice-info">
            <h3>Invoice Details:</h3>
            <p><strong>Invoice #:</strong> ${invoiceData.invoice_number}</p>
            <p><strong>Date:</strong> ${new Date(invoiceData.invoice_date || invoiceData.created_at).toLocaleDateString()}</p>
            <p><strong>Due Date:</strong> ${new Date(invoiceData.due_date).toLocaleDateString()}</p>
          </div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Description</th>
              <th>Quantity</th>
              <th>Price</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${(invoiceData.line_items || invoiceData.items || []).map((item: any) => `
              <tr>
                <td>${item.product?.name || item.name || "Item"}</td>
                <td>${item.description || ""}</td>
                <td>${item.quantity}</td>
                <td>Ksh. ${(parseFloat(item.unit_price || item.price || 0).toFixed(2))}</td>
                <td>Ksh. ${(parseFloat(item.line_total || ((item.quantity || 0) * (item.unit_price || item.price || 0))).toFixed(2))}</td>
              </tr>
            `).join("") || ""}
          </tbody>
        </table>
        
        <div class="total">
          <p><strong>Subtotal:</strong> Ksh. ${parseFloat(invoiceData.subtotal || 0).toFixed(2)}</p>
          <p><strong>Tax:</strong> Ksh. ${parseFloat(invoiceData.tax_amount || invoiceData.tax || 0).toFixed(2)}</p>
          <p><strong>Total:</strong> Ksh. ${parseFloat(invoiceData.total_amount || invoiceData.total || 0).toFixed(2)}</p>
        </div>
        
        <div class="footer">
          <p>Thank you for your business!</p>
          <p>Please pay within ${invoiceData.payment_terms || "30"} days</p>
        </div>
      </body>
    </html>
  `;
}
