import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { to, mediaId, type, caption } = await request.json();

    const response = await fetch(
        `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_API_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: to,
            type: type,
            [type]: {
              id: mediaId,
              caption: caption || undefined
            }
          }),
        }
    );

    const responseData = await response.json();

    if (!response.ok) {
      return NextResponse.json(
          { error: responseData },
          { status: response.status }
      );
    }

    return NextResponse.json(responseData);
  } catch (error) {
    return NextResponse.json(
        { error: "Failed to send media message" },
        { status: 500 }
    );
  }
}
