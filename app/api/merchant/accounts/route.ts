import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * GET /api/merchant/accounts
 * 
 * Lists all Merchant Center accounts accessible to the authenticated user.
 * Requires Google OAuth with 'content' scope.
 */
export async function GET(request: NextRequest) {
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

        console.log('Fetching Merchant Center accounts');

        // Fetch list of accessible Merchant Center accounts
        const response = await fetch(
            'https://merchantapi.googleapis.com/accounts/v1beta/accounts',
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Merchant Center API error:', {
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries()),
                error: errorText,
                tokenScope: accessToken.substring(0, 10) + '...', // Log first 10 chars to verify token exists
            });

            // If it's a permission error, return empty list with helpful message
            // 401 = Invalid credentials (token expired or missing scope)
            // 403 = Insufficient permissions (user doesn't have access to MC)
            if (response.status === 403 || response.status === 401) {
                return NextResponse.json({
                    accounts: [],
                    error: `No Merchant Center access (Status ${response.status}). Please ensure your Google account has access to Google Merchant Center and you have granted the necessary permissions.`,
                    debug: errorText
                });
            }

            return NextResponse.json(
                { error: `Failed to fetch Merchant Center accounts: ${response.status} - ${errorText}` },
                { status: response.status }
            );
        }

        const data = await response.json();

        console.log('Merchant Center accounts fetched:', {
            count: data.accounts?.length || 0
        });

        // Transform accounts to simpler format
        const accounts = (data.accounts || []).map((account: any) => ({
            id: account.name?.split('/').pop() || account.accountId,
            name: account.accountName || account.name,
            displayName: `${account.accountName || 'Unnamed Account'} - ${account.name?.split('/').pop() || account.accountId}`,
        }));

        return NextResponse.json({
            accounts,
            total: accounts.length,
        });

    } catch (error) {
        console.error('Error in Merchant Center accounts API:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
