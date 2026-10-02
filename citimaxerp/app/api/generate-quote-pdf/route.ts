import { NextResponse } from "next/server"
import puppeteer from "puppeteer"

export async function POST(request: Request) {
  try {
    const { customerInfo, quoteDetails } = await request.json()

    // Format the quote date and valid until date
    const quoteDate = new Date(quoteDetails.date).toLocaleDateString()
    const validUntil = new Date(quoteDetails.validUntil).toLocaleDateString()

    // Format items for HTML
    const itemsHtml = quoteDetails.items
      .map(
        (item: any) => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${item.product_name || "Product"}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">Ksh. ${item.unit_price.toFixed(
            2,
          )}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">Ksh. ${item.total_price.toFixed(
            2,
          )}</td>
        </tr>
      `,
      )
      .join("")

    // Create HTML content for the PDF
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Quote</title>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            max-width: 800px; 
            margin: 0 auto; 
            padding: 20px;
          }
          .header {
            background-color: #E30040; 
            color: white; 
            padding: 20px; 
            text-align: center; 
            border-radius: 8px 8px 0 0;
          }
          .header h1 {
            margin: 0; 
            font-size: 28px;
          }
          .header p {
            margin: 5px 0 0 0; 
            font-size: 16px;
          }
          .content {
            background-color: #f9fafb; 
            padding: 30px; 
            border: 1px solid #e5e7eb; 
            border-top: none;
          }
          .info-section {
            margin-bottom: 20px;
          }
          .info-section h2 {
            font-size: 18px;
            margin-bottom: 10px;
            color: #E30040;
          }
          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
          }
          .info-item {
            margin: 5px 0;
          }
          .info-item strong {
            font-weight: 600;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
          }
          thead {
            background-color: #f3f4f6;
          }
          th {
            padding: 12px;
            text-align: left;
            font-weight: 600;
          }
          th:nth-child(2) {
            text-align: center;
          }
          th:nth-child(3), th:nth-child(4) {
            text-align: right;
          }
          .totals {
            border-top: 2px solid #e5e7eb;
            padding-top: 15px;
            margin-top: 20px;
            text-align: right;
          }
          .total-row {
            margin-bottom: 8px;
          }
          .grand-total {
            font-size: 18px;
            font-weight: bold;
            color: #E30040;
            margin-top: 10px;
          }
          .notes {
            margin-top: 30px;
            padding: 15px;
            background-color: #f3f4f6;
            border-radius: 6px;
          }
          .notes h3 {
            margin: 0 0 10px 0;
            font-size: 16px;
          }
          .notes p {
            margin: 0;
            color: #6b7280;
          }
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            font-size: 12px;
            color: #9ca3af;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Cherry CRM</h1>
          <p>QUOTATION</p>
        </div>
        
        <div class="content">
          <div class="info-section">
            <div class="info-grid">
              <div>
                <p class="info-item"><strong>Quote Date:</strong> ${quoteDate}</p>
              </div>
              <div>
                <p class="info-item"><strong>Valid Until:</strong> ${validUntil}</p>
              </div>
            </div>
          </div>
          
          <div class="info-section">
            <h2>Customer Information</h2>
            <p class="info-item"><strong>Name:</strong> ${customerInfo.name}</p>
            <p class="info-item"><strong>Email:</strong> ${customerInfo.email}</p>
            <p class="info-item"><strong>Phone:</strong> ${customerInfo.phone}</p>
            ${customerInfo.address ? `<p class="info-item"><strong>Address:</strong> ${customerInfo.address}</p>` : ""}
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          
          <div class="totals">
            <div class="total-row">
              <span>Subtotal:</span>
              <span style="margin-left: 20px;">Ksh. ${quoteDetails.subtotal.toFixed(2)}</span>
            </div>
            ${
              quoteDetails.taxRate > 0
                ? `
              <div class="total-row">
                <span>VAT (${quoteDetails.taxRate}%):</span>
                <span style="margin-left: 20px;">Ksh. ${quoteDetails.tax.toFixed(2)}</span>
              </div>
            `
                : ""
            }
            <div class="grand-total">
              <span>Total:</span>
              <span style="margin-left: 20px;">Ksh. ${quoteDetails.total.toFixed(2)}</span>
            </div>
          </div>
          
          ${
            quoteDetails.notes
              ? `
            <div class="notes">
              <h3>Notes:</h3>
              <p>${quoteDetails.notes}</p>
            </div>
          `
              : ""
          }
          
          <div class="footer">
            <p>This is an official quotation from Cherry CRM</p>
            <p>© ${new Date().getFullYear()} Cherry CRM. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `

    // Launch a headless browser
    const browser = await puppeteer.launch({
      headless: "new",
    })
    const page = await browser.newPage()

    // Set the HTML content
    await page.setContent(htmlContent, {
      waitUntil: "networkidle0",
    })

    // Generate PDF
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "20px",
        right: "20px",
        bottom: "20px",
        left: "20px",
      },
    })

    // Close the browser
    await browser.close()

    // Return the PDF
    return new NextResponse(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Quote-${new Date().toISOString().split("T")[0]}.pdf"`,
      },
    })
  } catch (error) {
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 })
  }
}
