
import { NextRequest, NextResponse } from 'next/server';
import { fetchDataForSEO, getLocationCode, getLanguageCode } from '@/lib/dataforseo';

export const maxDuration = 60; // Extend timeout for Vercel/Next.js

interface BrandEntity {
    title: string;
    category?: string;
    urls?: string[];
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { prompts, location = "United States", language = "English", login, password, targetBrands, competitorBrands, model = "chat_gpt" } = body;

        if (!prompts || !Array.isArray(prompts) || prompts.length === 0) {
            return NextResponse.json({ error: "No prompts provided" }, { status: 400 });
        }

        const locationCode = getLocationCode(location);
        const languageCode = getLanguageCode(language);

        // Map model to DataForSEO endpoint
        const modelEndpoints: Record<string, string> = {
            "chat_gpt": "ai_optimization/chat_gpt/llm_scraper/live/advanced",
            "gemini": "ai_optimization/gemini/llm_responses/live",
            "claude": "ai_optimization/claude/llm_responses/live",
            "perplexity": "ai_optimization/perplexity/llm_responses/live"
        };

        const targetEndpoint = modelEndpoints[model] || "ai_optimization/chat_gpt/llm_scraper/live/advanced";

        const results = [];
        const aggregates = {
            total_prompts: 0,
            brand_counts: {} as Record<string, number>,
            brand_categories: {} as Record<string, string>, // Keep track of categories
            associated_urls: {} as Record<string, string[]> // Collect URLs per brand
        };

        // Specific model names to use for LLM Responses API
        const specificModelNames: Record<string, string> = {
            "gemini": "gemini-2.0-flash",
            "claude": "claude-3-7-sonnet-latest",
            "perplexity": "sonar-pro"
        };

        const countryIsoMap: Record<string, string> = {
            "United States": "US",
            "United Kingdom": "GB",
            "Canada": "CA",
            "Australia": "AU",
            "Germany": "DE",
            "France": "FR",
            "Spain": "ES",
            "Italy": "IT",
            "Netherlands": "NL"
        };

        // Extraction Helpers
        const processSources = (srcArray: any[]) => {
            if (!Array.isArray(srcArray)) return [];
            return srcArray.map((s: any) => ({
                title: s.title,
                url: s.url,
                domain: s.domain,
                source_name: s.source_name
            }));
        };

        const processAnnotations = (annArray: any[]) => {
            if (!Array.isArray(annArray)) return [];
            return annArray.map((s: any) => {
                let domain = undefined;
                if (s.url) {
                    try { domain = new URL(s.url).hostname; } catch (e) { }
                }
                return {
                    title: s.title,
                    url: s.url,
                    domain: domain,
                    source_name: s.source_name || "Annotation"
                };
            });
        };

        // Process prompts sequentially to ensure we don't hit rate limits abruptly
        // and can handle failures gracefully per prompt
        for (const prompt of prompts) {
            if (!prompt.trim()) continue;

            try {
                let payload: any[] = []; // Use generic type to allow different structures

                if (model === "chat_gpt") {
                    // LLM Scraper Payload (ChatGPT)
                    payload = [{
                        keyword: prompt,
                        location_code: locationCode,
                        language_code: languageCode,
                        web_search: true,
                        force_web_search: true
                    }];
                } else {
                    // LLM Responses Payload (Gemini, Claude, Perplexity)
                    const item: any = {
                        model_name: specificModelNames[model] || model,
                        user_prompt: prompt,
                        location_code: locationCode,
                        language_code: languageCode,
                        web_search: true
                    };

                    // Model specific overrides
                    if (model === "claude") {
                        item.force_web_search = true;
                    } else if (model === "perplexity") {
                        item.web_search_country_iso_code = countryIsoMap[location] || "US";
                    }

                    payload = [item];
                }

                // Using the generic fetcher we added
                const response = await fetchDataForSEO(
                    targetEndpoint,
                    payload,
                    login,
                    password
                );

                let extractedSources: any[] = [];
                let extractedAnnotations: any[] = [];
                let extractedFanOutQueries: string[] = [];
                let brandEntities: BrandEntity[] = [];
                let fullText = "";

                if (response.tasks && response.tasks[0]?.result) {
                    const resultItems = response.tasks[0].result;

                    // Helper for processing nested items
                    const processItems = (itms: any[]) => {
                        for (const subItem of itms) {
                            // Sub-item level text - check all possible text fields
                            const text = subItem.markdown || subItem.text || subItem.chat_gpt_text || subItem.gemini_text || subItem.claude_text || subItem.perplexity_text;
                            if (text) fullText += text + "\n";

                            // Deeply nested sections (common in Responses API)
                            if (subItem.sections && Array.isArray(subItem.sections)) {
                                for (const section of subItem.sections) {
                                    const sText = section.markdown || section.text || section.chat_gpt_text || section.gemini_text || section.claude_text || section.perplexity_text;
                                    if (sText) fullText += sText + "\n";

                                    if (section.annotations) {
                                        extractedAnnotations = [...extractedAnnotations, ...processAnnotations(section.annotations)];
                                    }
                                    if (section.sources) {
                                        extractedSources = [...extractedSources, ...processSources(section.sources)];
                                    }
                                }
                            }

                            if (subItem.annotations) {
                                extractedAnnotations = [...extractedAnnotations, ...processAnnotations(subItem.annotations)];
                            }
                            if (subItem.sources) {
                                extractedSources = [...extractedSources, ...processSources(subItem.sources)];
                            }
                            if (subItem.fan_out_queries) {
                                extractedFanOutQueries = [...extractedFanOutQueries, ...subItem.fan_out_queries];
                            }
                            if (subItem.brand_entities) {
                                const apiEntities = subItem.brand_entities.map((e: any) => ({
                                    title: e.title,
                                    category: e.category,
                                    urls: Array.isArray(e.urls) ? e.urls : []
                                }));
                                brandEntities = [...brandEntities, ...apiEntities];
                            }
                        }
                    };


                    // Process each item in the result
                    for (const item of resultItems) {
                        const topText = item.markdown || item.text || item.chat_gpt_text || item.gemini_text || item.claude_text || item.perplexity_text;
                        if (topText) fullText += topText + "\n";

                        if (item.items) processItems(item.items);
                        if (item.brand_entities) {
                            const apiEntities = item.brand_entities.map((e: any) => ({
                                title: e.title,
                                category: e.category,
                                urls: Array.isArray(e.urls) ? e.urls : []
                            }));
                            brandEntities = [...brandEntities, ...apiEntities];
                        }
                        if (item.sources) {
                            extractedSources = [...extractedSources, ...processSources(item.sources)];
                        }
                        if (item.annotations) {
                            extractedAnnotations = [...extractedAnnotations, ...processAnnotations(item.annotations)];
                        }
                        if (item.fan_out_queries) {
                            extractedFanOutQueries = [...extractedFanOutQueries, ...item.fan_out_queries];
                        }
                    }
                }


                // Manual extraction based on User-defined Target and Competitor Brands
                // We no longer rely on brand_entities for the analysis aggregates.
                const allTrackingBrands = [
                    ...(targetBrands ? targetBrands.split(',').map((t: string) => t.trim()).filter((t: string) => t.length > 0) : []),
                    ...(competitorBrands ? competitorBrands.split(',').map((t: string) => t.trim()).filter((t: string) => t.length > 0) : [])
                ];

                allTrackingBrands.forEach((brand: string) => {
                    const escapedBrand = brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    // Improved regex to handle possessives like "Nike's" or plural-ish forms
                    const regex = new RegExp(`\\b${escapedBrand}(?:'s|s)?\\b`, 'gi');
                    const matches = fullText.match(regex);

                    if (matches) {
                        const count = matches.length;
                        aggregates.brand_counts[brand] = (aggregates.brand_counts[brand] || 0) + count;

                        // Categorize as Target or Competitor for UI clarity
                        const isTarget = targetBrands?.split(',').map((t: string) => t.trim().toLowerCase()).includes(brand.toLowerCase());
                        aggregates.brand_categories[brand] = isTarget ? "Your Brand" : "Competitor";

                        // Normalization: Add manually detected brands to the UI entity list
                        // This makes Gemini/Claude look just like the ChatGPT Scraper results
                        const brandLower = brand.toLowerCase();
                        let existingEntity = brandEntities.find(e => e.title.toLowerCase() === brandLower);

                        if (!existingEntity) {
                            brandEntities.push({
                                title: brand,
                                category: aggregates.brand_categories[brand],
                                urls: []
                            });
                        } else if (!existingEntity.category) {
                            // Supplement the AI's entity with our specific category if it was missing
                            existingEntity.category = aggregates.brand_categories[brand];
                        }

                        // Collect URLs from sources and annotations for these filtered brands
                        if (!aggregates.associated_urls[brand]) aggregates.associated_urls[brand] = [];
                        const brandUrls = aggregates.associated_urls[brand];
                        [...extractedSources, ...extractedAnnotations].forEach(s => {
                            if (s.url && brandUrls && !brandUrls.includes(s.url)) {
                                brandUrls.push(s.url);
                            }
                        });
                    }
                });

                // Generate snippet or debug info
                let snippet = fullText;
                if (!snippet.trim()) {
                    const taskInfo = response.tasks?.[0];
                    snippet = `No text content returned.\nDebug Info:\nStatus: ${taskInfo?.status_code} (${taskInfo?.status_message})\nResult Count: ${taskInfo?.result_count}\nCost: ${taskInfo?.cost}\n\nFull Task Response: ${JSON.stringify(taskInfo, null, 2)}`;
                }

                results.push({
                    prompt: prompt,
                    status: (brandEntities.length === 0 && !fullText.trim()) ? "error" : "success",
                    brand_entities: brandEntities, // Still return for UI display
                    text_snippet: snippet,
                    sources: extractedSources,
                    annotations: extractedAnnotations,
                    fan_out_queries: extractedFanOutQueries
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
