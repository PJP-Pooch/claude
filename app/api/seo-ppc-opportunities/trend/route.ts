import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { google } from 'googleapis';

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);

    if (!session?.accessToken) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { type, startDate, endDate, config } = body;

        // Mock data logic (if needed server-side, though typically handled client-side for this app)
        // But since we are calling this from client, we can just return real data.

        if (type === 'gsc') {
            return await handleGscTrend(session.accessToken as string, startDate, endDate, config);
        } else if (type === 'ads') {
            return await handleAdsTrend(session.accessToken as string, startDate, endDate, config);
        }

        return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    } catch (error) {
        console.error('Trend API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

async function handleGscTrend(accessToken: string, startDate: string, endDate: string, config: any) {
    const { siteUrl, queryFilter } = config; // queryFilter = { operator: 'contains', expression: 'shoes' }

    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    const searchConsole = google.webmasters({ version: 'v3', auth });

    const requestBody: any = {
        startDate,
        endDate,
        dimensions: ['date'],
        rowLimit: 5000,
    };

    if (queryFilter) {
        requestBody.dimensionFilterGroups = [{
            filters: [{
                dimension: 'query',
                operator: 'contains', // Simplification, assume contains
                expression: queryFilter
            }]
        }];
    }

    try {
        const response = await searchConsole.searchanalytics.query({
            siteUrl,
            requestBody,
        });

        const rows = response.data.rows || [];
        // Map to standard format { date, value }
        // We return all metrics: clicks, impressions, ctr, position
        const data = rows.map((row: any) => ({
            date: row.keys[0],
            clicks: row.clicks || 0,
            impressions: row.impressions || 0,
            ctr: row.ctr || 0,
            position: row.position || 0,
        }));

        return NextResponse.json({ data });
    } catch (error: any) {
        console.error('GSC API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

async function handleAdsTrend(accessToken: string, startDate: string, endDate: string, config: any) {
    const { customerId, campaign, adGroup } = config;
    const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '';

    // Build query
    let query = `
        SELECT
            segments.date,
            metrics.cost_micros,
            metrics.impressions,
            metrics.clicks,
            metrics.conversions,
            metrics.conversions_value
        FROM customer
        WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
    `;

    // If filtering by campaign/adGroup, we normally change FROM customer to FROM campaign/ad_group
    // But we can also just select from those resources directly if we filter.
    // However, if we filter by campaign, we should select FROM campaign to be safe, or just add WHERE clause.
    // The safest generic way is often 'search_term_view' but that's too granular.
    // 'campaign' resource is good.

    if (campaign && campaign !== 'all') {
        query = `
            SELECT
                segments.date,
                metrics.cost_micros,
                metrics.impressions,
                metrics.clicks,
                metrics.conversions,
                metrics.conversions_value
            FROM campaign
            WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
            AND campaign.name = '${campaign.replace(/'/g, "\\'")}'
        `;
    } else if (adGroup && adGroup !== 'all') {
        // Note: ad_group view
        query = `
            SELECT
                segments.date,
                metrics.cost_micros,
                metrics.impressions,
                metrics.clicks,
                metrics.conversions,
                metrics.conversions_value
            FROM ad_group
            WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
            AND ad_group.name = '${adGroup.replace(/'/g, "\\'")}'
        `;
    }

    query += ` ORDER BY segments.date ASC`;

    try {
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
            const err = await response.text();
            console.error('Ads API Error details:', err);
            throw new Error(`Ads API error: ${response.status}`);
        }

        const data = await response.json();
        // Aggregate rows by date (in case multiple campaigns/rows are returned per date)
        const dailyMap = new Map<string, any>();

        if (Array.isArray(data)) {
            for (const batch of data) {
                if (batch.results) {
                    for (const row of batch.results) {
                        const date = row.segments.date;
                        const existing = dailyMap.get(date) || {
                            date,
                            cost_micros: 0,
                            impressions: 0,
                            clicks: 0,
                            conversions: 0,
                            conversions_value: 0
                        };

                        existing.cost_micros += parseInt(row.metrics.costMicros) || 0;
                        existing.impressions += parseInt(row.metrics.impressions) || 0;
                        existing.clicks += parseInt(row.metrics.clicks) || 0;
                        existing.conversions += parseFloat(row.metrics.conversions) || 0;
                        existing.conversions_value += parseFloat(row.metrics.conversionsValue) || 0;

                        dailyMap.set(date, existing);
                    }
                }
            }
        }

        const sortedData = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

        // Convert micros
        const finalData = sortedData.map(d => ({
            date: d.date,
            cost: d.cost_micros / 1_000_000,
            impressions: d.impressions,
            clicks: d.clicks,
            conversions: d.conversions,
            conversionValue: d.conversions_value
        }));

        return NextResponse.json({ data: finalData });

    } catch (error: any) {
        console.error('Ads Handler Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
