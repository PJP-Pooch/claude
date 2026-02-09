import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

interface SearchTermMetrics {
    searchTerm: string;
    impressions: number;
    clicks: number;
    costMicros: number;
    ctr: number;
    averageCpc: number;
    conversions: number;
    conversionValue: number;
}

/**
 * POST /api/google-ads/search-terms
 * Fetches search term report for a Google Ads account
 */
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.accessToken) {
            return NextResponse.json(
                { error: 'Not authenticated' },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { customerId, startDate, endDate } = body;

        if (!customerId || !startDate || !endDate) {
            return NextResponse.json(
                { error: 'Missing required parameters: customerId, startDate, endDate' },
                { status: 400 }
            );
        }

        const accessToken = session.accessToken as string;
        const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '';

        // Build the Google Ads Query Language (GAQL) query
        const query = `
      SELECT
        search_term_view.search_term,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.ctr,
        metrics.average_cpc,
        metrics.conversions,
        metrics.conversions_value
      FROM search_term_view
      WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
      ORDER BY metrics.impressions DESC
      LIMIT 10000
    `;

        const response = await fetch(
            `https://googleads.googleapis.com/v14/customers/${customerId}/googleAds:searchStream`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'developer-token': developerToken,
                    'login-customer-id': customerId,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query }),
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Google Ads search terms error:', response.status, errorText);

            // Parse error for more helpful message
            let errorMessage = 'Failed to fetch search terms';
            try {
                const errorJson = JSON.parse(errorText);
                if (errorJson.error?.message) {
                    errorMessage = errorJson.error.message;
                }
            } catch {
                errorMessage = errorText;
            }

            return NextResponse.json(
                { error: errorMessage },
                { status: response.status }
            );
        }

        const data = await response.json();

        // Parse the streaming response - it comes as an array of batches
        const rows: SearchTermMetrics[] = [];

        if (Array.isArray(data)) {
            for (const batch of data) {
                if (batch.results) {
                    for (const result of batch.results) {
                        const searchTerm = result.searchTermView?.searchTerm;
                        if (!searchTerm) continue;

                        rows.push({
                            searchTerm,
                            impressions: parseInt(result.metrics?.impressions) || 0,
                            clicks: parseInt(result.metrics?.clicks) || 0,
                            costMicros: parseInt(result.metrics?.costMicros) || 0,
                            ctr: parseFloat(result.metrics?.ctr) || 0,
                            averageCpc: parseInt(result.metrics?.averageCpc) || 0,
                            conversions: parseFloat(result.metrics?.conversions) || 0,
                            conversionValue: parseFloat(result.metrics?.conversionsValue) || 0,
                        });
                    }
                }
            }
        }

        // Get currency from customer settings
        let currencyCode = 'GBP';
        try {
            const customerResponse = await fetch(
                `https://googleads.googleapis.com/v14/customers/${customerId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'developer-token': developerToken,
                        'login-customer-id': customerId,
                    },
                }
            );
            if (customerResponse.ok) {
                const customerData = await customerResponse.json();
                currencyCode = customerData.currencyCode || 'GBP';
            }
        } catch (e) {
            console.error('Error fetching customer currency:', e);
        }

        return NextResponse.json({
            rows,
            totalRows: rows.length,
            currencyCode,
        });
    } catch (error) {
        console.error('Error fetching search terms:', error);
        return NextResponse.json(
            { error: 'Failed to fetch search terms', details: String(error) },
            { status: 500 }
        );
    }
}
