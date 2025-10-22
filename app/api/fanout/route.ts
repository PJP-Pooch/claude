import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { fanOutQueries } from '@/lib/gemini';
import { handleError } from '@/lib/errors';
import { filterNearDuplicates, deduplicateStrings } from '@/lib/normalize';

const RequestSchema = z.object({
  targetQuery: z.string().min(1),
  geminiApiKey: z.string().min(1),
  mockMode: z.boolean().optional(),
});

/**
 * POST /api/fanout
 * Generates sub-queries using Gemini fan-out technique
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { targetQuery, geminiApiKey, mockMode } = RequestSchema.parse(body);

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

    // Call Gemini API
    const result = await fanOutQueries(targetQuery, geminiApiKey);

    // Deduplicate and filter near-duplicates
    const dedupedQueries = filterNearDuplicates(result.subQueries, 0.9);

    return NextResponse.json({
      subQueries: dedupedQueries,
      diagnostics: {
        ...result.diagnostics,
        timestamp: new Date().toISOString(),
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
