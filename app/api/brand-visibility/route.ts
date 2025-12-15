
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
        const { prompts, location = "United States", language = "English", login, password, targetBrands } = body;

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
                    // model: "gpt-4o", // Defaulting to a modern model
                    keyword: prompt,
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

                let brandEntities: BrandEntity[] = [];
                let fullText = "";

                if (response.tasks && response.tasks[0]?.result) {
                    const resultItems = response.tasks[0].result;

                    // Extract data from valid results
                    for (const item of resultItems) {
                        // Concatenate text for context
                        // The API might return 'markdown' or 'chat_gpt_text'.
                        // Also check for 'items' array if the main object doesn't have the text directly.
                        if (item.chat_gpt_text) {
                            fullText += item.chat_gpt_text + "\n";
                        } else if (item.markdown) {
                            fullText += item.markdown + "\n";
                        }

                        if (item.items && Array.isArray(item.items)) {
                            for (const subItem of item.items) {
                                if (subItem.markdown) fullText += subItem.markdown + "\n";
                                if (subItem.chat_gpt_text) fullText += subItem.chat_gpt_text + "\n";
                            }
                        }

                        // Extract brand entities
                        if (item.brand_entities) {
                            brandEntities = [...brandEntities, ...item.brand_entities];
                        }
                    }
                }

                // Process entities for this prompt
                // Manual Fallback for Brand Detection
                // If API returns no brands, search for common ChatGPT listing patterns
                if (brandEntities.length === 0 && fullText) {
                    // Pattern 1: Bold headers in numeric lists (e.g. "### 1. **Hill's Science Diet**")
                    // Matches: ### N. **Brand Name** or **N. Brand Name**
                    const headerRegex = /###\s*\d+\.\s*\*\*(.*?)\*\*/g;
                    let match;
                    while ((match = headerRegex.exec(fullText)) !== null) {
                        if (match && match[1] && match[1].length < 100) { // Safety check on length
                            // Clean up the brand name (remove extra details after ' - ' or ':')
                            const captured = match?.[1];
                            if (captured) {
                                let cleanName = (captured.split(' - ')[0] || "").split(':')[0]?.trim() || "";
                                if (!cleanName) continue;

                                // If the result looks like a brand (not a generic term), add it
                                brandEntities.push({
                                    title: cleanName,
                                    category: "Manual Extraction",
                                    urls: []
                                });
                            }
                        }

                        // Pattern 2: Bold list items (e.g. "- **Royal Canin**:")
                        // We must filter out common structural headers like "Why it's good", "Key Features"
                        const listRegex = /-\s*\*\*(.*?)\*\*/g;
                        while ((match = listRegex.exec(fullText)) !== null) {
                            const captured = match?.[1];
                            if (captured && captured.length < 100) {
                                const lower = captured.toLowerCase();
                                // Exclude common description keys found in your example
                                if (!lower.includes("why it's good") &&
                                    !lower.includes("key features") &&
                                    !lower.includes("pros") &&
                                    !lower.includes("cons") &&
                                    !lower.includes("best for")) {

                                    let cleanName = (captured.split(' - ')[0] || "").split(':')[0]?.trim() || "";
                                    if (!cleanName) continue;

                                    // Avoid duplicates from previous regex
                                    if (!brandEntities.find(e => e.title && e.title === cleanName)) {
                                        brandEntities.push({
                                            title: cleanName,
                                            category: "Manual Extraction",
                                            urls: []
                                        });
                                    }
                                }
                            }
                        }

                    }

                    // Check for User-defined Target Brands (Always check to supplement API results)
                    if (targetBrands && typeof targetBrands === 'string') {
                        const targets = targetBrands.split(',').map((t: string) => t.trim()).filter((t: string) => t.length > 0);
                        targets.forEach((target: string) => {
                            const regex = new RegExp(`\\b${target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
                            if (regex.test(fullText)) {
                                // Only add if not already caught
                                const existingEntity = brandEntities.find(e => e.title && e.title.toLowerCase() === target.toLowerCase());
                                if (!existingEntity) {
                                    brandEntities.push({
                                        title: target,
                                        category: "Target Brand Match",
                                        urls: []
                                    });
                                }
                            }
                        });
                    }

                    const brandsInThisPrompt = new Set<string>();
                    brandEntities.forEach(entity => {
                        if (entity.title) {
                            const brandName = entity.title;

                            // Prevent double counting the same brand in a single prompt
                            if (brandsInThisPrompt.has(brandName)) return;
                            brandsInThisPrompt.add(brandName);

                            if (!aggregates.brand_counts[brandName]) {
                                aggregates.brand_counts[brandName] = 0;
                                aggregates.brand_categories[brandName] = entity.category || "Unknown";
                                aggregates.associated_urls[brandName] = [];
                            }
                            if (entity.urls && Array.isArray(entity.urls)) {
                                const currentUrls = aggregates.associated_urls[brandName] || [];
                                aggregates.associated_urls[brandName] = currentUrls;
                                entity.urls.forEach((u: string) => {
                                    if (!currentUrls.includes(u)) {
                                        currentUrls.push(u);
                                    }
                                });
                            }
                            aggregates.brand_counts[brandName]++;
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
                        brand_entities: brandEntities,
                        text_snippet: snippet
                    });

                    aggregates.total_prompts++;
                } // End if(response.tasks)
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
