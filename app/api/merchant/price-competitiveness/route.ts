import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);

    if (!session || !session.accessToken) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const merchantId = process.env.MERCHANT_CENTER_ACCOUNT_ID;
    if (!merchantId) {
        return NextResponse.json(
            { error: "Merchant Center Account ID not configured" },
            { status: 500 }
        );
    }

    try {
        const body = await req.json();
        const { countryCode, productType, priceBucket } = body;

        let allRows: any[] = [];
        let nextPageToken: string | undefined = undefined;

        // Base query
        let query = `SELECT product_view.id, product_view.title, product_view.brand, product_view.product_type_l1, product_view.product_type_l2, product_view.price_micros, product_view.currency_code, price_competitiveness.country_code, price_competitiveness.benchmark_price_micros, price_competitiveness.benchmark_price_currency_code FROM PriceCompetitivenessProductView`;

        // Add WHERE clause if country is selected
        // Note: The API might have specific requirements for WHERE clauses. 
        // For now, we'll filter by country if provided.
        if (countryCode && countryCode !== 'all') {
            query += ` WHERE price_competitiveness.country_code = '${countryCode}'`;
        }

        // Fetch data with pagination
        let hasMorePages = true;
        while (hasMorePages) {
            const apiUrl = `https://merchantapi.googleapis.com/reports/v1beta/accounts/${merchantId}/reports:search`;

            const response: Response = await fetch(apiUrl, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${session.accessToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    query,
                    pageSize: 1000, // Fetch max allowed per page
                    pageToken: nextPageToken
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error("Merchant API Error:", errorData);

                if (response.status === 403) {
                    return NextResponse.json(
                        { error: "Insufficient permissions or Market Insights not enabled." },
                        { status: 403 }
                    );
                }

                throw new Error(`Merchant API failed: ${response.statusText}`);
            }

            const data = await response.json();
            if (data.results) {
                allRows = [...allRows, ...data.results];
            }
            nextPageToken = data.nextPageToken;
            hasMorePages = !!nextPageToken;
        }

        // Process rows
        const processedRows = allRows.map((row: any) => {
            const priceMicros = parseInt(row.productView?.priceMicros || "0");
            const benchmarkMicros = parseInt(row.priceCompetitiveness?.benchmarkPriceMicros || "0");

            // Skip invalid data
            if (!priceMicros || !benchmarkMicros) return null;

            const price = priceMicros / 1_000_000;
            const benchmarkPrice = benchmarkMicros / 1_000_000;
            const diff = price - benchmarkPrice;
            const diffPct = (diff / benchmarkPrice) * 100;

            let pricePosition: 'Underpriced' | 'Competitive' | 'Overpriced';
            if (diffPct <= -10) {
                pricePosition = 'Underpriced';
            } else if (diffPct > 10) {
                pricePosition = 'Overpriced';
            } else {
                pricePosition = 'Competitive';
            }

            return {
                id: row.productView?.id,
                title: row.productView?.title,
                brand: row.productView?.brand,
                productTypeL1: row.productView?.productTypeL1,
                productTypeL2: row.productView?.productTypeL2,
                countryCode: row.priceCompetitiveness?.countryCode,
                currencyCode: row.productView?.currencyCode,
                price,
                benchmarkPrice,
                diff,
                diffPct,
                pricePosition
            };
        }).filter(Boolean); // Remove nulls

        // Apply client-side filters (Product Type, Price Bucket)
        // Doing this here simplifies the SQL query complexity and ensures consistent logic
        const filteredRows = processedRows.filter((row: any) => {
            if (productType && !row.productTypeL1?.toLowerCase().includes(productType.toLowerCase())) {
                return false;
            }
            if (priceBucket && priceBucket !== 'all' && row.pricePosition !== priceBucket) {
                return false;
            }
            return true;
        });

        return NextResponse.json({ rows: filteredRows });

    } catch (error) {
        console.error("Error fetching Merchant Center data:", error);
        return NextResponse.json(
            { error: "Failed to fetch data" },
            { status: 500 }
        );
    }
}
