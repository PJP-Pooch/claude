import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { fanOutQueries } from '@/lib/openai';
import { handleError } from '@/lib/errors';
import { filterNearDuplicates, deduplicateStrings } from '@/lib/normalize';

const RequestSchema = z.object({
  targetQuery: z.string().min(1),
  openaiApiKey: z.string().min(1),
  maxQueries: z.number().int().min(1).max(50).default(25),
  mockMode: z.boolean().optional(),
});

/**
 * POST /api/fanout
 * Generates sub-queries using OpenAI fan-out technique
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { targetQuery, openaiApiKey, maxQueries, mockMode } = RequestSchema.parse(body);

    // Mock mode for testing
    if (mockMode) {
      const mockSubQueries = [
        { q: `what is ${targetQuery}`, intent: 'info' as const, rationale: 'Informational query about the topic' },
        { q: `how to ${targetQuery}`, intent: 'info' as const, rationale: 'How-to informational query' },
        { q: `${targetQuery} guide`, intent: 'info' as const, rationale: 'Guide-based informational query' },
        { q: `best ${targetQuery}`, intent: 'comm' as const, rationale: 'Commercial comparison query' },
        { q: `buy ${targetQuery}`, intent: 'trans' as const, rationale: 'Transactional purchase query' },
        { q: `${targetQuery} reviews`, intent: 'comm' as const, rationale: 'Commercial review query' },
        { q: `${targetQuery} vs alternatives`, intent: 'comm' as const, rationale: 'Commercial comparison query' },
        { q: `${targetQuery} tutorial`, intent: 'info' as const, rationale: 'Tutorial informational query' },
        { q: `${targetQuery} for beginners`, intent: 'info' as const, rationale: 'Beginner-focused informational query' },
        { q: `${targetQuery} examples`, intent: 'info' as const, rationale: 'Example-based informational query' },
      ];

      return NextResponse.json({
        subQueries: mockSubQueries,
        diagnostics: {
          timestamp: new Date().toISOString(),
          model: 'mock',
          tokensUsed: 0,
        },
      });
    }

    // Call OpenAI API
    const result = await fanOutQueries(targetQuery, openaiApiKey);

    // Deduplicate and filter near-duplicates
    const dedupedQueries = filterNearDuplicates(result.subQueries, 0.9);

    // Limit to maxQueries (excluding the target query which will be added by the frontend)
    const limitedQueries = dedupedQueries.slice(0, maxQueries - 1);

    return NextResponse.json({
      subQueries: limitedQueries,
      diagnostics: {
        ...result.diagnostics,
        timestamp: new Date().toISOString(),
        requestedMax: maxQueries,
        generatedCount: result.subQueries.length,
        afterDedup: dedupedQueries.length,
        returned: limitedQueries.length,
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
