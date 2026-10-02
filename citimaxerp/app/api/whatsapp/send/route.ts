import { NextRequest, NextResponse } from "next/server"
import { config } from "@/lib/config"

export async function POST(request: NextRequest) {
  try {
    const { phoneNumber, message } = await request.json()

    if (!phoneNumber || !message) {
      return NextResponse.json(
        { error: "Phone number and message are required" },
        { status: 400 }
      )
    }

    const response = await fetch(
      `${config.whatsapp.apiUrl}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.whatsapp.apiToken}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: phoneNumber,
          type: "text",
          text: { body: message },
        }),
      }
    )

    if (!response.ok) {
      const errorData = await response.json()
      return NextResponse.json(
        { error: "Failed to send WhatsApp message" },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to send WhatsApp message" },
      { status: 500 }
    )
  }
}
