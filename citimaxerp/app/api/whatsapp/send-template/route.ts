import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";

export async function POST(request: NextRequest) {
  try {
    const { to, template_name, language, components } = await request.json();

    if (!to || !template_name || !language) {
      return NextResponse.json(
        { error: "Missing required fields: to, template_name, language" },
        { status: 400 }
      );
    }

    const payload = {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: template_name,
        language: { code: language },
        ...(components ? { components } : {}),
      },
    };

    const response = await fetch(
      `${config.whatsapp.apiUrl}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.whatsapp.apiToken}`,
        },
        body: JSON.stringify(payload),
      }
    );

    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || "Failed to send template message" },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to send template message" },
      { status: 500 }
    );
  }
} 