import { NextRequest } from 'next/server';
import axios from 'axios';

export async function GET(req: NextRequest) {
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;

    if (!accessToken || !businessAccountId) {
        return new Response(JSON.stringify({ error: 'Missing environment variables' }), { status: 500 });
    }

    try {
        // Fetch owned product catalogs for the business account
        const response = await axios.get(
            `https://graph.facebook.com/v17.0/${businessAccountId}/owned_product_catalogs`,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            }
        );

        const catalogs = response.data.data.map((catalog: any) => ({
            id: catalog.id,
            name: catalog.name,
        }));

        return new Response(JSON.stringify(catalogs), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error: any) {
        return new Response(
            JSON.stringify({
                error: 'Failed to fetch product catalogs',
                details: error.response?.data || error.message,
            }),
            { status: 500 }
        );
    }
}
