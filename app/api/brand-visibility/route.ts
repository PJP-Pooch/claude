
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
                    payload = [{
                        model_name: specificModelNames[model] || model,
                        user_prompt: prompt,
                        location_code: locationCode,
                        language_code: languageCode,
                        web_search: true
                    }];
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

                    // Extract data from valid results
                    for (const item of resultItems) {
                        // 1. Extract Text content (handles both Scraper and Responses API)
                        // Use prioritized selection to avoid duplication
                        if (item.markdown) {
                            fullText += item.markdown + "\n";
                        } else if (item.chat_gpt_text) {
                            fullText += item.chat_gpt_text + "\n";
                        } else if (item.gemini_text) {
                            fullText += item.gemini_text + "\n";
                        } else if (item.claude_text) {
                            fullText += item.claude_text + "\n";
                        } else if (item.perplexity_text) {
                            fullText += item.perplexity_text + "\n";
                        } else if (item.text) {
                            fullText += item.text + "\n";
                        } else if (item.items && Array.isArray(item.items)) {
                            for (const subItem of item.items) {
                                // Sub-item level text
                                if (subItem.markdown) {
                                    fullText += subItem.markdown + "\n";
                                } else if (subItem.chat_gpt_text) {
                                    fullText += subItem.chat_gpt_text + "\n";
                                } else if (subItem.gemini_text) {
                                    fullText += subItem.gemini_text + "\n";
                                } else if (subItem.claude_text) {
                                    fullText += subItem.claude_text + "\n";
                                } else if (subItem.perplexity_text) {
                                    fullText += subItem.perplexity_text + "\n";
                                } else if (subItem.text) {
                                    fullText += subItem.text + "\n";
                                }

                                // Deeply nested sections (Gemini/Claude Responses API)
                                // Only add section text if we didn't already get it from a subItem level field
                                if (!(subItem.markdown || subItem.text || subItem.chat_gpt_text) && subItem.sections && Array.isArray(subItem.sections)) {
                                    for (const section of subItem.sections) {
                                        if (section.text) fullText += section.text + "\n";
                                    }
                                }
                            }
                        }

                        // 2. Extract Brand Entities (Scraper API mainly)
                        if (item.brand_entities) {
                            const apiEntities = item.brand_entities.map((e: any) => ({
                                title: e.title,
                                category: e.category,
                                urls: Array.isArray(e.urls) ? e.urls : []
                            }));
                            brandEntities = [...brandEntities, ...apiEntities];
                        }

                        // 3. Extract Sources (both Scraper and Responses API)
                        if (item.sources && Array.isArray(item.sources)) {
                            const mappedSources = item.sources.map((s: any) => ({
                                title: s.title,
                                url: s.url,
                                domain: s.domain,
                                source_name: s.source_name
                            }));
                            extractedSources = [...extractedSources, ...mappedSources];
                        }

                        // Annotations can be on top level, inside items, or inside sections
                        const processAnnotations = (annArray: any[]) => {
                            return annArray.map((s: any) => {
                                let domain = undefined;
                                if (s.url) {
                                    try {
                                        domain = new URL(s.url).hostname;
                                    } catch (e) {
                                        // Ignore invalid URLs
                                    }
                                }
                                return {
                                    title: s.title,
                                    url: s.url,
                                    domain: domain,
                                    source_name: "Annotation"
                                };
                            });
                        };

                        if (item.annotations && Array.isArray(item.annotations)) {
                            extractedAnnotations = [...extractedAnnotations, ...processAnnotations(item.annotations)];
                        }

                        if (item.items && Array.isArray(item.items)) {
                            for (const subItem of item.items) {
                                if (subItem.annotations && Array.isArray(subItem.annotations)) {
                                    extractedAnnotations = [...extractedAnnotations, ...processAnnotations(subItem.annotations)];
                                }
                                if (subItem.sections && Array.isArray(subItem.sections)) {
                                    for (const section of subItem.sections) {
                                        if (section.annotations && Array.isArray(section.annotations)) {
                                            extractedAnnotations = [...extractedAnnotations, ...processAnnotations(section.annotations)];
                                        }
                                    }
                                }
                            }
                        }

                        // 4. Extract Fan-out queries
                        if (item.fan_out_queries && Array.isArray(item.fan_out_queries)) {
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
                        [...extractedSources, ...extractedAnnotations].forEach(s => {
                            if (s.url && !aggregates.associated_urls[brand].includes(s.url)) {
                                aggregates.associated_urls[brand].push(s.url);
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
