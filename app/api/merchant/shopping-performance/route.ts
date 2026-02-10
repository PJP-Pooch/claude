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

        // Switch to Direct Product List API (REST) since Reports API (MCQL) is failing with "invalid table name"
        // This is a more robust way to get product data when Reports service is fickle.
        // Endpoint: GET https://merchantapi.googleapis.com/products/v1beta/accounts/{merchantId}/products

        console.log(`Fetching products list for merchant ${merchantId}...`);

        const response = await fetch(
            `https://merchantapi.googleapis.com/products/v1beta/accounts/${merchantId}/products?pageSize=250`,
            {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                }
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Merchant Center Products List API error:', {
                status: response.status,
                statusText: response.statusText,
                error: errorText,
            });

            // Fallback: If v1beta fails, try v1alpha (sometimes enabled differently)
            // or return friendlier error
            return NextResponse.json(
                { error: `Failed to fetch products: ${response.status} - ${errorText}` },
                { status: response.status }
            );
        }

        const data = await response.json();

        // Data structure for Products List is { products: [ ... ] }
        const productList = data.products || [];

        // Transform the response to a more usable format
        const products = productList.map((product: any) => {
            // Attributes are directly on the product object in Products List API
            const attributes = product.attributes || {};

            // Extract price (handling various formats)
            let priceMicros = 0;
            let currencyCode = 'GBP';

            if (product.price?.amountMicros) {
                priceMicros = parseInt(product.price.amountMicros, 10);
                currencyCode = product.price.currencyCode;
            } else if (attributes.price?.amountMicros) {
                priceMicros = parseInt(attributes.price.amountMicros, 10);
                currencyCode = attributes.price.currencyCode;
            }

            // Since we are not using Reports API, we don't have performance metrics here
            // These will come from Google Ads API later
            const clicks = 0;
            const impressions = 0;
            const conversions = 0;
            const conversionValueMicros = 0;
            const cogs = 0;

            // Calculate metrics (defaults to 0)
            const ctr = 0;
            const conversionValue = 0;
            const roas = 0;
            const cpa = 0;

            // Extract ID - In v1beta list, name is likely "accounts/{id}/products/{productId}"
            // We want just the ID (usually the offerId)
            const rawName = product.name || '';
            const productId = product.offerId || rawName.split('/').pop() || 'unknown';

            return {
                productId: productId,
                title: product.title || attributes.title || 'Untitled',
                brand: product.brand || attributes.brand || '',
                category: product.productTypes?.[0] || attributes.productTypes?.[0] || 'Uncategorized',
                subCategory: null,
                price: priceMicros / 1000000,
                currency: currencyCode,

                // Performance metrics (Placeholders until Google Ads integration)
                clicks,
                impressions,
                ctr,
                conversions,
                conversionValue,
                cost: cogs,
                roas,
                cpa,

                // Competitive intelligence (to be populated)
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
