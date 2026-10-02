import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { to, customerName, quoteDetails } = await request.json()

    // Format items for email
    const itemsHtml = quoteDetails.items
      .map(
        (item: any) => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${item.product_name || "Product"}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">Ksh.${item.unit_price.toFixed(
            2,
          )}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">Ksh.${item.total_price.toFixed(
            2,
          )}</td>
        </tr>
      `,
      )
      .join("")

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #E30040; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 28px;">Cherry CRM</h1>
          <p style="margin: 5px 0 0 0; font-size: 16px;">QUOTATION</p>
        </div>
        
        <div style="background-color: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
          <p style="font-size: 16px; margin-bottom: 20px;">Dear ${customerName},</p>
          <p style="font-size: 16px; margin-bottom: 30px;">Thank you for your interest. Please find below our quotation for your review:</p>
          
          <div style="background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
            <div style="margin-bottom: 20px;">
              <p style="margin: 5px 0;"><strong>Quote Date:</strong> ${new Date().toLocaleDateString()}</p>
              <p style="margin: 5px 0;"><strong>Valid Until:</strong> ${new Date(
                quoteDetails.validUntil,
              ).toLocaleDateString()}</p>
            </div>
            
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <thead>
                <tr style="background-color: #f3f4f6;">
                  <th style="padding: 12px; text-align: left; font-weight: 600;">Product</th>
                  <th style="padding: 12px; text-align: center; font-weight: 600;">Qty</th>
                  <th style="padding: 12px; text-align: right; font-weight: 600;">Unit Price</th>
                  <th style="padding: 12px; text-align: right; font-weight: 600;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>
            
            <div style="border-top: 2px solid #e5e7eb; padding-top: 15px; margin-top: 20px;">
              <div style="text-align: right; margin-bottom: 8px;">
                <span style="font-weight: 500;">Subtotal:</span>
                <span style="margin-left: 20px;">Ksh.${quoteDetails.subtotal.toFixed(2)}</span>
              </div>
              ${
                quoteDetails.taxRate > 0
                  ? `
                <div style="text-align: right; margin-bottom: 8px;">
                  <span style="font-weight: 500;">VAT (${quoteDetails.taxRate}%):</span>
                  <span style="margin-left: 20px;">Ksh.${quoteDetails.tax.toFixed(2)}</span>
                </div>
              `
                  : ""
              }
              <div style="text-align: right; font-size: 18px; font-weight: bold; color: #E30040;">
                <span>Total:</span>
                <span style="margin-left: 20px;">Ksh.${quoteDetails.total.toFixed(2)}</span>
              </div>
            </div>
            
            ${
              quoteDetails.notes
                ? `
              <div style="margin-top: 30px; padding: 15px; background-color: #f9fafb; border-radius: 6px;">
                <h4 style="margin: 0 0 10px 0; font-size: 16px;">Notes:</h4>
                <p style="margin: 0; color: #6b7280;">${quoteDetails.notes}</p>
              </div>
            `
                : ""
            }
          </div>
          
          <p style="margin-top: 30px; font-size: 14px; color: #6b7280;">
            If you have any questions about this quotation, please don't hesitate to contact us.
          </p>
          
          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #9ca3af;">
            <p style="margin: 5px 0;">This is an automated email from Cherry CRM</p>
            <p style="margin: 5px 0;">© ${new Date().getFullYear()} Cherry CRM. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `

    // Here you would integrate with your email service provider
    // For example: SendGrid, AWS SES, Resend, etc.
    // For now, we'll simulate a successful send

    // Example with a hypothetical email service:
    // await emailService.send({
    //   to,
    //   subject: `Quotation from Cherry CRM`,
    //   html: emailHtml,
    // })

    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1000))

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 })
  }
}
