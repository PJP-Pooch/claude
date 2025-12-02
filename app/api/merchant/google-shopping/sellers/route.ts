import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { product_id, location_code, language_code, dataforseoLogin, dataforseoPassword } = body;

        // Use credentials from request if provided, otherwise fallback to env vars
        const login = dataforseoLogin || process.env.DATAFORSEO_LOGIN;
        const password = dataforseoPassword || process.env.DATAFORSEO_PASSWORD;
        const auth = Buffer.from(`${login}:${password}`).toString('base64');

        // Use the LIVE endpoint for faster results
        const response = await fetch('https://api.dataforseo.com/v3/merchant/google/sellers/live', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify([{
                product_id,
                location_code,
                language_code,
            }]),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('DataForSEO API error:', {
                status: response.status,
                statusText: response.statusText,
                body: errorText
            });
            return NextResponse.json(
                { error: `Failed to fetch sellers: ${response.statusText}` },
                { status: response.status }
            );
        }

        const data = await response.json();
        return NextResponse.json(data);

    } catch (error) {
        console.error('Error in sellers route:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
