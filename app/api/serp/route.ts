import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { fetchBatchSerpResults, getMockSerpResults } from '@/lib/dataforseo';
import { handleError } from '@/lib/errors';

const RequestSchema = z.object({
  queries: z.array(z.string()),
  targetPageUrl: z.string().url(),
  location: z.string(),
  language: z.string(),
  device: z.enum(['desktop', 'mobile']),
  dataForSeoApiLogin: z.string().optional(),
  dataForSeoApiPassword: z.string().optional(),
  mockMode: z.boolean().optional(),
});

/**
 * POST /api/serp
 * Retrieves SERP results from DataForSEO for multiple queries
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      queries,
      targetPageUrl,
      location,
      language,
      device,
      dataForSeoApiLogin,
      dataForSeoApiPassword,
      mockMode,
    } = RequestSchema.parse(body);

    // Mock mode for testing
    if (mockMode) {
      const mockResults = getMockSerpResults(queries, targetPageUrl);
      return NextResponse.json({
        results: mockResults,
        diagnostics: {
          timestamp: new Date().toISOString(),
          totalQueries: queries.length,
          successCount: queries.length,
          failureCount: 0,
          errors: [],
        },
      });
    }

    // Use provided credentials or fallback to server-side environment variables
    const login = dataForSeoApiLogin || process.env.DATAFORSEO_LOGIN;
    const password = dataForSeoApiPassword || process.env.DATAFORSEO_PASSWORD;

    // Validate credentials are provided for real API calls
    if (!login || !password) {
      throw new Error('DataForSEO credentials are required (either provided in request or configured on server)');
    }

    // Fetch real SERP results
    const { results, errors } = await fetchBatchSerpResults(
      queries,
      {
        targetPageUrl,
        location,
        language,
        device,
      },
      {
        login,
        password,
      },
      25 // concurrency - optimized for maximum parallel performance
    );

    return NextResponse.json({
      results,
      diagnostics: {
        timestamp: new Date().toISOString(),
        totalQueries: queries.length,
        successCount: results.length,
        failureCount: errors.length,
        errors,
      },
    });
  } catch (error) {
    const errorInfo = handleError(error);
    return NextResponse.json(
      {
        error: errorInfo.message,
        code: errorInfo.code,
      },
      { status: errorInfo.statusCode }
    );
  }
}
