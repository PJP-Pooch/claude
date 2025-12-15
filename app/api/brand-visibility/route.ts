
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
        const { prompts, location = "United States", language = "English", login, password, targetBrands, model = "chat_gpt" } = body;

        if (!prompts || !Array.isArray(prompts) || prompts.length === 0) {
            return NextResponse.json({ error: "No prompts provided" }, { status: 400 });
        }

        const locationCode = getLocationCode(location);
        const languageCode = getLanguageCode(language);

        // Map model to DataForSEO endpoint
        const modelEndpoints: Record<string, string> = {
            "chat_gpt": "ai_optimization/chat_gpt/llm_scraper/live/advanced",
            "gemini": "ai_optimization/gemini/llm_scraper/live/advanced",
            "claude": "ai_optimization/claude/llm_scraper/live/advanced",
            "perplexity": "ai_optimization/perplexity/llm_scraper/live/advanced"
        };

        const targetEndpoint = modelEndpoints[model] || modelEndpoints["chat_gpt"];

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
                    targetEndpoint,
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
                        // The API might return 'markdown' or specific text fields like 'chat_gpt_text', 'gemini_text', etc.
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
                        }

                        if (item.items && Array.isArray(item.items)) {
                            for (const subItem of item.items) {
                                if (subItem.markdown) fullText += subItem.markdown + "\n";
                                if (subItem.chat_gpt_text) fullText += subItem.chat_gpt_text + "\n";
                                if (subItem.gemini_text) fullText += subItem.gemini_text + "\n";
                                if (subItem.claude_text) fullText += subItem.claude_text + "\n";
                                if (subItem.perplexity_text) fullText += subItem.perplexity_text + "\n";
                                if (subItem.text) fullText += subItem.text + "\n";
                            }
                        }

                        // Extract brand entities
                        if (item.brand_entities) {
                            // Safely map API entities to our interface, handling null URLs
                            const apiEntities = item.brand_entities.map((e: any) => ({
                                title: e.title,
                                category: e.category,
                                urls: Array.isArray(e.urls) ? e.urls : []
                            }));
                            brandEntities = [...brandEntities, ...apiEntities];
                        }
                    }
                }

                // Process entities for this prompt
                // Manual Fallback/Enhancement for Brand Detection
                // Always run manual extraction to supplement API results

                // Pattern 1: Bold headers
                // Support formats: 
                // ### 1. **Brand** (Original)
                // ### **1. Brand** (User Case)
                // **1. Brand** (Plain bold list)

                // Unified Regex for Headers:
                // Looks for:
                // 1. Optional ###
                // 2. Space
                // 3. Optional ** (start bold)
                // 4. Number + dot (e.g. 1.)
                // 5. Space
                // 6. Optional ** (end number bold or start title bold)
                // 7. Capture Group (The Brand)
                // 8. ** (closing bold)

                // Simplified strategy: extract anything within ** ** that looks like a title item

                // Regex A: Standard Numbered Headers with Bold Brand: ### 1. **Brand**
                const headerRegexA = /###\s*\d+\.\s*\*\*(.*?)\*\*/g;

                // Regex B: Bold Numbered Headers: ### **1. Brand** or **1. Brand**
                const headerRegexB = /(?:###\s*)?\*\*\d+\.\s*(.*?)\*\*/g;

                let match;
                const manualBrands = new Set<string>(); // avoid dups in this pass

                // Helper to process match
                const processMatch = (m: RegExpExecArray | null) => {
                    if (m && m[1] && m[1].length < 100) {
                        let cleanName = (m[1].split(' - ')[0] || "").split(':')[0]?.trim() || "";
                        if (cleanName && !manualBrands.has(cleanName)) {
                            manualBrands.add(cleanName);
                            // Add if not already in main list
                            if (!brandEntities.find(e => e.title === cleanName)) {
                                brandEntities.push({
                                    title: cleanName,
                                    category: "Manual Extraction",
                                    urls: []
                                });
                            }
                        }
                    }
                }

                while ((match = headerRegexA.exec(fullText)) !== null) processMatch(match);
                while ((match = headerRegexB.exec(fullText)) !== null) processMatch(match);

                // Pattern 2: Bold list items (e.g. "- **Royal Canin**:")
                const listRegex = /-\s*\*\*(.*?)\*\*/g;

                // Comprehensive list of generic terms to exclude from manual brand extraction
                const excludedTerms = [
                    "features", "key features", "best for", "ideal for", "why it's", "why we like", "why it's great",
                    "pros", "cons", "verdict", "summary", "bottom line",
                    "price", "cost", "pricing", "value",
                    "specifications", "specs", "tech specs",
                    "ease of use", "setup", "installation",
                    "support", "customer service", "customer support",
                    "automation", "customization", "integrations",
                    "security", "privacy", "compliance",
                    "mobile app", "platform", "dashboard",
                    "performance", "design", "build quality",
                    "rating", "review",
                    "introduction", "conclusion",
                    "alternatives", "competitors"
                ];

                while ((match = listRegex.exec(fullText)) !== null) {
                    const captured = match?.[1];
                    if (captured && captured.length < 100) {
                        const lower = captured.toLowerCase();

                        // Check if the captured text contains any of the excluded terms
                        // We check if the term is present at the START of the string or is the entire string
                        // to avoid false positives (e.g. "Best for Nike" vs "Nike Best For Running")
                        // Actually, most noise is "Features", "Why It's Great", etc. strict includes check is safer for noise reduction.
                        const isExcluded = excludedTerms.some(term => lower.includes(term));

                        if (!isExcluded) {
                            let cleanName = (captured.split(' - ')[0] || "").split(':')[0]?.trim() || "";

                            if (cleanName && !manualBrands.has(cleanName)) {
                                manualBrands.add(cleanName);
                                if (!brandEntities.find(e => e.title === cleanName)) {
                                    brandEntities.push({
                                        title: cleanName,
                                        category: "Manual Extraction",
                                        urls: []
                                    });
                                }
                            }
                        }
                    }
                }      // Check for User-defined Target Brands (Always check to supplement API results)
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
