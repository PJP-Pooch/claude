import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * GET /api/google-ads/customers
 * Lists accessible Google Ads customer accounts for the authenticated user
 */
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.accessToken) {
            return NextResponse.json(
                { error: 'Not authenticated' },
                { status: 401 }
            );
        }

        const accessToken = session.accessToken as string;
        const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '';

        // Debug logging
        console.log('Fetching Google Ads customers:', {
            hasAccessToken: !!accessToken,
            hasDeveloperToken: !!developerToken,
            developerTokenLength: developerToken.length
        });

        // Try to get accessible customers using the Google Ads REST API
        // Note: This requires the user to have linked their Google Ads account
        const response = await fetch(
            'https://googleads.googleapis.com/v14/customers:listAccessibleCustomers',
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'developer-token': developerToken,
                },
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Google Ads API error:', {
                status: response.status,
                statusText: response.statusText,
                error: errorText,
                hasDeveloperToken: !!process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
                developerTokenLength: process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.length || 0
            });

            // If it's a permission error, return empty list with detailed error
            if (response.status === 403 || response.status === 401) {
                return NextResponse.json({
                    customers: [],
                    error: 'No Google Ads access. Please ensure your Google account has access to Google Ads.',
                    debug: process.env.NODE_ENV === 'development' ? {
                        status: response.status,
                        message: errorText
                    } : undefined
                });
            }

            return NextResponse.json(
                { error: `Failed to fetch customers: ${response.status}` },
                { status: response.status }
            );
        }

        const data = await response.json();
        const customerResourceNames: string[] = data.resourceNames || [];

        // Fetch details for each customer
        const customers = [];

        for (const resourceName of customerResourceNames) {
            // Extract customer ID from resource name (format: customers/1234567890)
            const customerId = resourceName.replace('customers/', '');

            try {
                const detailResponse = await fetch(
                    `https://googleads.googleapis.com/v14/customers/${customerId}`,
                    {
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '',
                            'login-customer-id': customerId,
                        },
                    }
                );

                if (detailResponse.ok) {
                    const customerData = await detailResponse.json();
                    customers.push({
                        customerId,
                        descriptiveName: customerData.descriptiveName || `Account ${customerId}`,
                        currencyCode: customerData.currencyCode || 'GBP',
                        isManager: customerData.manager || false,
                    });
                }
            } catch (e) {
                // If we can't get details, add basic entry
                customers.push({
                    customerId,
                    descriptiveName: `Account ${customerId}`,
                    currencyCode: 'GBP',
                    isManager: false,
                });
            }
        }

        return NextResponse.json({ customers });
    } catch (error) {
        console.error('Error fetching Google Ads customers:', error);
        return NextResponse.json(
            { error: 'Failed to fetch customers', details: String(error) },
            { status: 500 }
        );
    }
}
