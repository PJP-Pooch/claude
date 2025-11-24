import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { fetchHistoricalSearchVolume, fetchSerpEnrichmentBatch } from '@/lib/dataforseo';
import { analyzeSeasonality, aggregateByCategory } from '@/lib/seasonality';
import { SeasonalityResponse, MonthlySV } from '@/lib/types';

// Schema for the request body
const RequestSchema = z.object({
    keywords: z.array(z.string()).min(1).max(500),
    location: z.string().default('United Kingdom'),
    language: z.string().default('English'),
    leadTimeDays: z.number().default(90),
    categoryMap: z.record(z.string()).optional(), // keyword -> category
    apiLogin: z.string().optional(),
    apiPassword: z.string().optional(),
    enableSerpEnrichment: z.boolean().default(false), // Toggle SERP data fetching
    targetDomain: z.string().optional(), // Optional domain to check ranking for
});

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { keywords, location, language, leadTimeDays, categoryMap, apiLogin, apiPassword, enableSerpEnrichment, targetDomain } = RequestSchema.parse(body);

        const login = apiLogin || process.env.DATAFORSEO_LOGIN;
        const password = apiPassword || process.env.DATAFORSEO_PASSWORD;

        if (!login || !password) {
            return NextResponse.json(
                { error: 'DataForSEO credentials not configured' },
                { status: 500 }
            );
        }

        // 1. Call DataForSEO API for historical data
        const rawResults = await fetchHistoricalSearchVolume(
            keywords,
            location,
            language,
            { login, password }
        );

        // 2. Fetch SERP enrichment data in batch if enabled
        let serpDataMap: Record<string, any> = {};
        if (enableSerpEnrichment) {
            try {
                // We use the original keywords list for enrichment
                serpDataMap = await fetchSerpEnrichmentBatch(
                    keywords,
                    location,
                    language,
                    { login, password },
                    targetDomain
                );
            } catch (error) {
                console.error('Failed to fetch SERP enrichment batch:', error);
                // Continue without SERP data rather than failing the whole request
            }
        }

        const analyzedKeywords = [];
        const errors = [];

        // 3. Process results and combine data
        for (const resultItem of rawResults) {
            if (!resultItem.items) continue;

            for (const item of resultItem.items) {
                try {
                    const keyword = item.keyword;
                    const monthlySearches = item.keyword_info?.monthly_searches || [];

                    // Map to our MonthlySV format
                    const history: MonthlySV[] = monthlySearches.map((m: any) => ({
                        year: m.year,
                        month: m.month,
                        searchVolume: m.search_volume
                    })).sort((a: MonthlySV, b: MonthlySV) => {
                        if (a.year !== b.year) return a.year - b.year;
                        return a.month - b.month;
                    });

                    // Analyze
                    const category = categoryMap ? categoryMap[keyword] : undefined;
                    const analysis = analyzeSeasonality(keyword, history, leadTimeDays, category);

                    // Attach SERP data if available
                    if (serpDataMap[keyword]) {
                        analysis.serpData = serpDataMap[keyword];
                    }

                    analyzedKeywords.push(analysis);
                } catch (err) {
                    errors.push({
                        keyword: item.keyword || 'unknown',
                        error: err instanceof Error ? err.message : String(err)
                    });
                }
            }
        }

        // Aggregate by category
        const categories = aggregateByCategory(analyzedKeywords);

        const response: SeasonalityResponse = {
            keywords: analyzedKeywords,
            categories,
            diagnostics: {
                timestamp: new Date().toISOString(),
                totalKeywords: keywords.length,
                successCount: analyzedKeywords.length,
                errors
            }
        };

        return NextResponse.json(response);

    } catch (error) {
        console.error('Seasonality API Error:', error);

        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: 'Invalid request data', details: error.errors },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { error: 'Failed to process seasonality request', details: String(error) },
            { status: 500 }
        );
    }
}
