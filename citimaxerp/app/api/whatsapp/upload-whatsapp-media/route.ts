import { NextResponse } from "next/server";

export async function POST(request: Request) {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const type = formData.get("type") as string;

    if (!file || !type) {
        return NextResponse.json(
            { error: "File and type are required" },
            { status: 400 }
        );
    }

    try {
        // First upload to WhatsApp
        const whatsappFormData = new FormData();
        whatsappFormData.append("file", file);
        whatsappFormData.append("type", type);
        whatsappFormData.append("messaging_product", "whatsapp");

        const uploadResponse = await fetch(
            `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/media`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${process.env.WHATSAPP_API_TOKEN}`,
                },
                body: whatsappFormData,
            }
        );

        if (!uploadResponse.ok) {
            const error = await uploadResponse.json();
            return NextResponse.json(
                { error: "WhatsApp upload failed", details: error },
                { status: uploadResponse.status }
            );
        }

        const { id: mediaId } = await uploadResponse.json();

        return NextResponse.json({ mediaId });
    } catch (error) {
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
