
import { NextRequest, NextResponse } from 'next/server';
import { fetchDataForSEO, getLocationCode, getLanguageCode } from '@/lib/dataforseo';

export const maxDuration = 60; // Extend timeout for Vercel/Next.js

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { prompts, location = "United States", language = "English", login, password } = body;

        if (!prompts || !Array.isArray(prompts) || prompts.length === 0) {
            return NextResponse.json({ error: "No prompts provided" }, { status: 400 });
        }

        const locationCode = getLocationCode(location);
        const languageCode = getLanguageCode(language);

        const results = [];
        const aggregates = {
            total_prompts: 0,
            brand_counts: {} as Record<string, number>,
            brand_categories: {} as Record<string, string>, // Keep track of categories
            associated_urls: {} as Record<string, string[]> // Collect URLs per brand
        };

        // Process prompts sequentially to ensure we don't hit rate limits abruptly
        // and can handle failures gracefully per prompt
        for (const prompt of prompts) {
            if (!prompt.trim()) continue;

            try {
                const payload = [{
                    model: "gpt-4o", // Defaulting to a modern model
                    prompt: prompt,
                    location_code: locationCode,
                    language_code: languageCode,
                }];

                // Using the generic fetcher we added
                const response = await fetchDataForSEO(
                    'ai_optimization/chat_gpt/llm_scraper/live/advanced',
                    payload,
                    login,
                    password
                );

                let brandEntities: any[] = [];
                let fullText = "";

                if (response.tasks && response.tasks[0]?.result) {
                    const resultItems = response.tasks[0].result;

                    // Extract data from valid results
                    for (const item of resultItems) {
                        // Concatenate text for context if needed
                        if (item.chat_gpt_text) fullText += item.chat_gpt_text + "\n";

                        // Extract brand entities
                        if (item.brand_entities) {
                            brandEntities = [...brandEntities, ...item.brand_entities];
                        }
                    }
                }

                // Process entities for this prompt
                const brandsInThisPrompt = new Set();

                brandEntities.forEach(entity => {
                    if (entity.title) {
                        const brandName = entity.title;

                        // Count for aggregation (unique per prompt? or total mentions? 
                        // "Count how often each brand is mentioned" usually means total mentions across all prompts.
                        // But if a brand is mentioned 5 times in ONE prompt, is that 5 or 1?
                        // Usually share of voice is based on "presence in response". 
                        // I'll count it once per prompt for "Share of Voice" calculation to avoid skewing by repetition in one text.
                        // However, simply incrementing aggregated counts here.

                        if (!aggregates.brand_counts[brandName]) {
                            aggregates.brand_counts[brandName] = 0;
                            aggregates.brand_categories[brandName] = entity.category || "Unknown";
                            aggregates.associated_urls[brandName] = [];
                        }

                        // Collect URLs
                        if (entity.urls && Array.isArray(entity.urls)) {
                            // Ensure the array exists (though handled in init block above, explicit check satisfies TS)
                            const currentUrls = aggregates.associated_urls[brandName] || [];
                            aggregates.associated_urls[brandName] = currentUrls;

                            entity.urls.forEach((u: string) => {
                                if (!currentUrls.includes(u)) {
                                    currentUrls.push(u);
                                }
                            });
                        }

                        // We only count a brand once per prompt for the aggregate stats to represent "Prompt Coverage"
                        // Or should we count every mention? "Share of Voice" usually implies frequency.
                        // Let's count every entity occurrence provided by the API.
                        aggregates.brand_counts[brandName]++;
                    }
                });

                results.push({
                    prompt: prompt,
                    status: "success",
                    brand_entities: brandEntities,
                    text_snippet: fullText.substring(0, 200) + "..."
                });

                aggregates.total_prompts++;

            } catch (error) {
                console.error(`Error processing prompt "${prompt}":`, error);
                results.push({
                    prompt: prompt,
                    status: "error",
                    error: error instanceof Error ? error.message : "Unknown error"
                });
            }
        }

        return NextResponse.json({
            results,
            aggregates
        });

    } catch (error) {
        console.error("API Error:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
