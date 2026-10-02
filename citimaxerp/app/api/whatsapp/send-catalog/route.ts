import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(req: NextRequest) {
    const {body, to} = await req.json();
    const { whatsappId, productRetailerId, message } = body;

    const token = process.env.WHATSAPP_API_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const catalogId = process.env.WHATSAPP_CATALOG_ID;

    if (!token || !phoneNumberId || !catalogId) {
        return NextResponse.json({ error: 'Missing environment variables' }, { status: 500 });
    }

    if (!to || !productRetailerId) {
        return NextResponse.json({ error: 'Missing required fields: whatsappId or productRetailerId' }, { status: 400 });
    }

    try {
        const payload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: to,
            type: 'interactive',
            interactive: {
                type: 'product',
                body: {
                    text: message || "Here's an item from our catalog",
                },
                action: {
                    catalog_id: catalogId,
                    product_retailer_id: productRetailerId,
                },
            },
        };

        const response = await axios.post(
            `https://graph.facebook.com/v17.0/${phoneNumberId}/messages`,
            payload,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        return NextResponse.json(response.data, { status: 200 });
    } catch (error: any) {
        return NextResponse.json(
            {
                error: 'Failed to send catalog',
                details: error.response?.data || error.message,
            },
            { status: 500 }
        );
    }
}
