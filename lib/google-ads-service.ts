/**
 * Helper service to fetch Shopping Ads performance data directly from Google Ads API via REST.
 * This avoids heavy dependencies like google-ads-api.
 */

const GOOGLE_ADS_API_VERSION = 'v17';
const GOOGLE_ADS_API_BASE = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}`;

/**
 * Fetch Shopping Ads performance data from Google Ads API
 * 
 * @param customerId - Google Ads Customer ID (without hyphens)
 * @param accessToken - Valid OAuth access token
 * @param startDate - Start date in YYYY-MM-DD
 * @param endDate - End date in YYYY-MM-DD
 * @returns Map of productItemId -> { cost, conversions, conversionValue, clicks, impressions, ctr }
 */
export async function fetchShoppingPerformance(
    customerId: string,
    accessToken: string,
    developerToken: string,
    startDate: string,
    endDate: string
) {
    if (!developerToken || !accessToken || !customerId) {
        console.warn('Missing credentials for Google Ads API');
        return new Map();
    }

    const cleanCustomerId = customerId.replace(/-/g, '');

    try {
        // Query shopping performance view
        // Aggregated by product_item_id (Offer ID)
        const query = `
            SELECT 
                segments.product_item_id,
                metrics.cost_micros,
                metrics.conversions,
                metrics.conversions_value,
                metrics.clicks,
                metrics.impressions,
                metrics.ctr
            FROM shopping_performance_view
            WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
        `;

        const response = await fetch(
            `${GOOGLE_ADS_API_BASE}/customers/${cleanCustomerId}/googleAds:search`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'developer-token': developerToken,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query,
                    pageSize: 10000 // Get as many as possible
                }),
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Google Ads API Error:', errorText);
            return new Map();
        }

        const data = await response.json();
        const rows = data.results || [];

        // Transform to Map for easy lookup
        const performanceMap = new Map<string, {
            cost: number;
            conversions: number;
            conversionValue: number;
            clicks: number;
            impressions: number;
            ctr: number;
        }>();

        for (const row of rows) {
            const productId = row.segments?.productItemId; // Note: camelCase in JSON response
            if (!productId) continue;

            // Convert micros to actual currency
            const cost = (parseInt(row.metrics?.costMicros || '0', 10)) / 1000000;
            const conversions = parseFloat(row.metrics?.conversions || '0');
            const conversionValue = parseFloat(row.metrics?.conversionsValue || '0');
            const clicks = parseInt(row.metrics?.clicks || '0', 10);
            const impressions = parseInt(row.metrics?.impressions || '0', 10);
            const ctr = parseFloat(row.metrics?.ctr || '0');

            // Handle potential uppercase/lowercase product IDs
            // Google Ads sometimes returns them differently than Merchant Center
            performanceMap.set(productId.toLowerCase(), {
                cost,
                conversions,
                conversionValue,
                clicks,
                impressions,
                ctr
            });
        }

        return performanceMap;

    } catch (error) {
        console.error('Error fetching Google Ads shopping performance:', error);
        // Return empty map on error so we don't block the main UI
        return new Map();
    }
}
