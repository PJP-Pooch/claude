import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * POST /api/merchant/shopping-performance
 * 
 * Fetches Shopping Ads performance data from Google Merchant Center Reports API.
 * Optionally enriches with DataForSEO competitive intelligence.
 * 
 * Request body:
 * - merchantId: string (required) - Merchant Center account ID
 * - startDate: string (required) - Start date in YYYY-MM-DD format
 * - endDate: string (required) - End date in YYYY-MM-DD format
 * - includeCompetitiveIntel: boolean (optional) - Fetch DataForSEO competitive data
 * - dataforseoLogin: string (optional) - DataForSEO credentials
 * - dataforseoPassword: string (optional) - DataForSEO credentials
 */
export async function POST(request: NextRequest) {
    try {
        // Check authentication
        const session = await getServerSession(authOptions);

        if (!session?.accessToken) {
            return NextResponse.json(
                { error: 'Not authenticated. Please sign in with Google.' },
                { status: 401 }
            );
        }

        const accessToken = session.accessToken as string;

        // Parse request body
        const body = await request.json();
        const {
            merchantId,
            startDate,
            endDate,
            includeCompetitiveIntel = false,
            dataforseoLogin,
            dataforseoPassword
        } = body;

        // Validate required fields
        if (!merchantId || !startDate || !endDate) {
            return NextResponse.json(
                { error: 'merchantId, startDate, and endDate are required' },
                { status: 400 }
            );
        }

        console.log('Fetching Shopping Ads performance:', {
            merchantId,
            startDate,
            endDate,
            includeCompetitiveIntel
        });

        // Fetch Shopping Ads performance from Merchant Center Reports API
        const reportQuery = {
            query: `
                SELECT
                    product_view.id,
                    product_view.title,
                    product_view.brand,
                    product_view.category_l1,
                    product_view.category_l2,
                    product_view.price.amount_micros,
                    product_view.price.currency_code,
                    product_performance_view.clicks,
                    product_performance_view.impressions,
                    product_performance_view.click_through_rate,
                    product_performance_view.conversions,
                    product_performance_view.conversion_value.amount_micros,
                    product_performance_view.cost_of_goods_sold.amount_micros
                FROM ProductPerformanceView
                WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
                ORDER BY product_performance_view.clicks DESC
            `
        };

        const response = await fetch(
            `https://merchantapi.googleapis.com/reports/v1beta/accounts/${merchantId}/reports:search`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(reportQuery),
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Merchant Center Reports API error:', {
                status: response.status,
                statusText: response.statusText,
                error: errorText,
            });

            if (response.status === 403 || response.status === 401) {
                return NextResponse.json({
                    products: [],
                    error: 'No access to Merchant Center Reports. Please ensure your account has the necessary permissions.',
                });
            }

            return NextResponse.json(
                { error: `Failed to fetch Shopping Ads performance: ${response.status}` },
                { status: response.status }
            );
        }

        const data = await response.json();

        // Transform the response to a more usable format
        const products = (data.results || []).map((result: any) => {
            const product = result.productView || {};
            const performance = result.productPerformanceView || {};

            const clicks = performance.clicks || 0;
            const impressions = performance.impressions || 0;
            const conversions = performance.conversions || 0;
            const conversionValueMicros = performance.conversionValue?.amountMicros || 0;
            const cogsMicros = performance.costOfGoodsSold?.amountMicros || 0;

            // Calculate metrics
            const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
            const conversionValue = conversionValueMicros / 1000000;
            const cogs = cogsMicros / 1000000;
            const roas = cogs > 0 ? conversionValue / cogs : 0;
            const cpa = conversions > 0 ? cogs / conversions : 0;

            return {
                productId: product.id,
                title: product.title,
                brand: product.brand,
                category: product.categoryL1 || 'Uncategorized',
                subCategory: product.categoryL2,
                price: (product.price?.amountMicros || 0) / 1000000,
                currency: product.price?.currencyCode || 'GBP',

                // Performance metrics
                clicks,
                impressions,
                ctr,
                conversions,
                conversionValue,
                cost: cogs,
                roas,
                cpa,

                // Competitive intelligence (to be populated if requested)
                competitiveData: null,
            };
        });

        console.log(`Fetched ${products.length} products from Merchant Center`);

        // Optionally enrich with DataForSEO competitive intelligence
        if (includeCompetitiveIntel && products.length > 0) {
            const login = dataforseoLogin || process.env.DATAFORSEO_LOGIN;
            const password = dataforseoPassword || process.env.DATAFORSEO_PASSWORD;

            if (login && password) {
                console.log('Enriching with DataForSEO competitive intelligence...');

                // Fetch competitive data for each product (limit to top 20 to avoid quota issues)
                const topProducts = products.slice(0, 20);

                for (const product of topProducts) {
                    try {
                        // Search Google Shopping for this product
                        const searchQuery = `${product.brand} ${product.title}`.substring(0, 100);

                        const competitiveResponse = await fetch(
                            `${request.nextUrl.origin}/api/merchant/google-shopping/products`,
                            {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                    keyword: searchQuery,
                                    location_code: 2826, // UK
                                    language_code: 'en',
                                    depth: 40,
                                    dataforseoLogin: login,
                                    dataforseoPassword: password,
                                }),
                            }
                        );

                        if (competitiveResponse.ok) {
                            const competitiveData = await competitiveResponse.json();
                            const items = competitiveData.tasks?.[0]?.result?.[0]?.items || [];

                            if (items.length > 0) {
                                // Find your product in the results (match by domain or title similarity)
                                const yourRank = items.findIndex((item: any) =>
                                    item.title?.toLowerCase().includes(product.title.toLowerCase().substring(0, 30))
                                ) + 1;

                                // Get competitor prices
                                const prices = items
                                    .filter((item: any) => item.price)
                                    .map((item: any) => item.price)
                                    .sort((a: number, b: number) => a - b);

                                const lowestPrice = prices[0] || product.price;
                                const highestPrice = prices[prices.length - 1] || product.price;
                                const avgPrice = prices.length > 0
                                    ? prices.reduce((sum: number, p: number) => sum + p, 0) / prices.length
                                    : product.price;

                                // Determine price position
                                let pricePosition = 'Competitive';
                                if (product.price <= lowestPrice * 1.05) {
                                    pricePosition = 'Cheapest';
                                } else if (product.price >= highestPrice * 0.95) {
                                    pricePosition = 'Premium';
                                }

                                // Get top competitor
                                const topCompetitor = items[0];

                                product.competitiveData = {
                                    yourRank: yourRank || null,
                                    competitorCount: items.length,
                                    lowestPrice,
                                    highestPrice,
                                    avgPrice,
                                    pricePosition,
                                    priceGap: product.price - lowestPrice,
                                    topCompetitor: topCompetitor ? {
                                        name: topCompetitor.seller_name || topCompetitor.shop_name,
                                        price: topCompetitor.price,
                                        domain: topCompetitor.domain,
                                    } : null,
                                };
                            }
                        }
                    } catch (error) {
                        console.error(`Failed to fetch competitive data for ${product.title}:`, error);
                        // Continue with next product
                    }
                }

                console.log('Competitive intelligence enrichment complete');
            } else {
                console.warn('DataForSEO credentials not provided, skipping competitive intelligence');
            }
        }

        return NextResponse.json({
            products,
            total: products.length,
            dateRange: {
                startDate,
                endDate,
            },
            includesCompetitiveIntel: includeCompetitiveIntel,
        });

    } catch (error) {
        console.error('Error in Shopping Ads performance API:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
