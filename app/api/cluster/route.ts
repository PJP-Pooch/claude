import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { SerpResultSchema } from '@/lib/types';
import { clusterBySerpSimilarity } from '@/lib/cluster';
import { generateClusterRecommendations } from '@/lib/bucketing';
import { handleError } from '@/lib/errors';

const RequestSchema = z.object({
  serpResults: z.array(SerpResultSchema),
  targetQuery: z.string().min(1),
  targetPageUrl: z.string().url(),
  clusteringOverlapThreshold: z.number().int().min(1).max(10),
  geminiApiKey: z.string().min(1),
});

/**
 * POST /api/cluster
 * Clusters queries by SERP similarity and generates action recommendations
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      serpResults,
      targetQuery,
      targetPageUrl,
      clusteringOverlapThreshold,
      geminiApiKey,
    } = RequestSchema.parse(body);

    // Perform clustering
    const clusters = clusterBySerpSimilarity(serpResults, clusteringOverlapThreshold);

    // Generate recommendations
    const recommendations = await generateClusterRecommendations(
      serpResults,
      clusters,
      targetQuery,
      targetPageUrl,
      geminiApiKey
    );

    return NextResponse.json({
      clusters,
      recommendations,
      diagnostics: {
        timestamp: new Date().toISOString(),
        clusterCount: clusters.length,
        threshold: clusteringOverlapThreshold,
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
