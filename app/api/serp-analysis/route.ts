import { NextResponse } from 'next/server';
import { fetchDataForSEO, getLocationCode, getLanguageCode } from '@/lib/dataforseo';
import { extractDomain } from '@/lib/normalize';
import { getAiRecommendation } from '@/lib/opportunity-utils';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { keyword, location = 'United Kingdom', language = 'English', targetDomain, login, password, action } = body;

        if (!keyword) {
            return NextResponse.json({ error: 'Keyword is required' }, { status: 400 });
        }

        // 1. Get Location and Language codes
        const location_code = getLocationCode(location);
        const language_code = getLanguageCode(language);

        // 2. Prepare DataForSEO request
        const payload = [{
            keyword,
            location_code,
            language_code,
            device: 'desktop',
            load_async_ai_overview: true,
            calculate_rectangles: true // Useful for pixel position if needed
        }];

        // 3. Call DataForSEO API
        const data = await fetchDataForSEO('serp/google/organic/live/advanced', payload, login, password);

        if (!data.tasks || !data.tasks[0] || !data.tasks[0].result || !data.tasks[0].result[0]) {
            return NextResponse.json({ error: 'No SERP data found' }, { status: 404 });
        }

        const result = data.tasks[0].result[0];
        const items = result.items || [];

        // Debug: Log all item types to understand what DataForSEO is returning
        const allTypes = items.map((i: any) => i.type);
        console.log('[SERP Analysis] Found item types:', Array.from(new Set(allTypes)));
        console.log('[SERP Analysis] Keyword Properties:', result.keyword_properties);

        // 4. Process items into our SerpResult format
        const organicResults = items
            .filter((item: any) => item.type === 'organic')
            .slice(0, 100) // Get more to find target domain
            .map((item: any) => ({
                rank: item.rank_absolute,
                title: item.title,
                url: item.url,
                snippet: item.description,
                domain: new URL(item.url || 'https://example.com').hostname.replace('www.', '')
            }));

        const topResults = organicResults.slice(0, 10);

        const paidResults = items
            .filter((item: any) =>
                item.type === 'paid' ||
                item.type === 'google_ads_top' ||
                item.type === 'google_ads_bottom' ||
                item.type === 'google_ads_shopping' ||
                item.type === 'shopping' ||
                item.type === 'commercial_units' || // Shopping can sometimes be this
                item.type === 'ads_advertiser' ||
                (item.type && item.type.includes('ads'))
            )
            .map((item: any) => {
                const url = item.url || item.ad_link || item.source_url || item.items?.[0]?.url || '';
                let domain = '';
                if (url) {
                    try {
                        domain = new URL(url).hostname.replace('www.', '');
                    } catch (e) {
                        domain = url.split('/')[2] || '';
                    }
                }

                // For shopping ads, price is often available
                const snippet = item.price ?
                    `${item.price.value || item.price} ${item.price.currency || item.currency || ''} - ${item.description || item.title || ''}` :
                    (item.description || item.snippet || item.items?.[0]?.title || '');

                return {
                    rank: item.rank_absolute || 0,
                    title: item.title || item.source || item.items?.[0]?.source || 'Sponsored Result',
                    url: url,
                    snippet: snippet,
                    domain: domain
                };
            });

        console.log(`[SERP Analysis] Extracted ${paidResults.length} paid results`);

        // 5. Extract SERP Features
        const serpFeatures = items
            .map((item: any) => item.type)
            .filter((type: string) => type !== 'organic' && type !== 'paid' && !type.includes('ads'))
            .map((type: string) => {
                // Map API types to readable names
                const map: Record<string, string> = {
                    featured_snippet: 'Featured Snippet',
                    people_also_ask: 'People Also Ask',
                    video: 'Video Carousel',
                    images: 'Image Pack',
                    shopping: 'Shopping Ads',
                    commercial_units: 'Shopping Ads',
                    popular_products: 'Popular Products',
                    local_pack: 'Local Pack',
                    knowledge_graph: 'Knowledge Graph',
                    ai_overview: 'AI Overview',
                    twitter: 'Twitter',
                    top_stories: 'Top Stories'
                };
                return map[type] || type.replace(/_/g, ' ');
            });

        // Add 'Shopping Ads' if we found shopping items specifically, even if caught by paidResults logic
        if (items.some((i: any) => i.type === 'shopping' || i.type === 'commercial_units' || i.type === 'google_ads_shopping')) {
            serpFeatures.push('Shopping Ads');
        }

        const uniqueSerpFeatures = Array.from(new Set(serpFeatures)) as string[];

        // 6. Find Target Domain Rank
        let targetRank = null;
        if (targetDomain) {
            const cleanTarget = targetDomain.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
            const match = organicResults.find((r: any) => r.domain.includes(cleanTarget));
            if (match) {
                targetRank = match.rank;
            }
        }

        // 7. Extract AI Overview if present
        const aiItem = items.find((i: any) => i.type === 'ai_overview');
        const aiOverview = aiItem ? {
            text: aiItem.text || aiItem.markdown,
            urls: aiItem.items?.flatMap((sub: any) => sub.references?.map((ref: any) => ref.url)) || []
        } : null;

        // 8. Determine Search Intent
        let intent = 'Informational';
        const lowerKeyword = keyword.toLowerCase();

        // Transactional signals
        if (uniqueSerpFeatures.includes('Shopping Ads') || uniqueSerpFeatures.includes('Popular Products') || lowerKeyword.includes('buy') || lowerKeyword.includes('price') || lowerKeyword.includes('sale')) {
            intent = 'Transactional';
        }
        // Local signals
        else if (uniqueSerpFeatures.includes('Local Pack') || lowerKeyword.includes('near me')) {
            intent = 'Transactional';
        }
        // Commercial signals
        else if (lowerKeyword.includes('best') || lowerKeyword.includes('review') || lowerKeyword.includes('vs') || lowerKeyword.includes('top')) {
            intent = 'Commercial';
        }
        // Navigational signals
        else if (uniqueSerpFeatures.includes('Knowledge Graph')) {
            intent = 'Navigational';
        }
        // Mixed
        else if (uniqueSerpFeatures.length > 3) {
            intent = 'Mixed';
        }

        // 9. Extract Keyword Metrics (Volume/Difficulty) if available
        const keywordProps = result.keyword_properties || {};
        let searchVolume = keywordProps.search_volume || 0;
        let difficulty = keywordProps.keyword_difficulty || 0;

        // Fallback: If metrics are missing, try to fetch them separately
        if (searchVolume === 0 || difficulty === 0) {
            try {
                console.log(`[SERP Analysis] Metrics incomplete (SV=${searchVolume}, KD=${difficulty}). Location: ${location} (${location_code}). Fetching fallbacks...`);

                const credentials = {
                    login: login || process.env.DATAFORSEO_LOGIN || '',
                    password: password || process.env.DATAFORSEO_PASSWORD || ''
                };

                // 1. Fetch Volume from Historical (User reported this was accurate)
                if (searchVolume === 0) {
                    try {
                        const volPayload = [{
                            location_code: location_code,
                            language_code: language_code,
                            keywords: [keyword]
                        }];
                        console.log('[SERP Analysis] Fallback Volume: Calling historical_search_volume...');
                        const volData = await fetchDataForSEO('dataforseo_labs/google/historical_search_volume/live', volPayload, credentials.login, credentials.password);

                        if (volData.tasks?.[0]?.result?.[0]) {
                            const res = volData.tasks[0].result[0];
                            if (res.search_volume) {
                                searchVolume = res.search_volume;
                            } else if (res.items?.[0]) {
                                searchVolume = res.items[0].search_volume || res.items[0].keyword_info?.search_volume || 0;
                            }
                            console.log(`[SERP Analysis] Fallback Volume found: ${searchVolume}`);
                        }
                    } catch (e) {
                        console.error('[SERP Analysis] Fallback Volume failed:', e);
                    }
                }

                // 2. Fetch Difficulty from Keyword Ideas (More reliable for metrics)
                if (difficulty === 0) {
                    try {
                        const ideasPayload = [{
                            location_code: location_code,
                            language_code: language_code,
                            keywords: [keyword],
                            limit: 10
                        }];
                        console.log('[SERP Analysis] Fallback Difficulty: Calling keyword_ideas...');
                        const ideaData = await fetchDataForSEO('dataforseo_labs/google/keyword_ideas/live', ideasPayload, credentials.login, credentials.password);

                        if (ideaData.tasks?.[0]?.result?.[0]?.items) {
                            const items = ideaData.tasks[0].result[0].items;
                            // Find exact match
                            const match = items.find((i: any) => i.keyword?.toLowerCase() === keyword.toLowerCase()) || items[0];

                            if (match) {
                                // Get Difficulty
                                // Check keyword_difficulty (0-100) first
                                let diff = match.keyword_properties?.keyword_difficulty || match.keyword_difficulty;

                                // If no KD, check competition (0-1) and scale
                                if (!diff && (match.keyword_properties?.competition_level || match.competition)) {
                                    const comp = match.keyword_properties?.competition_level || match.competition;
                                    if (comp > 0) diff = Math.round(comp * 100);
                                }

                                if (diff) difficulty = diff;

                                // Also grab volume if we still don't have it (though we should from Step 1)
                                if (searchVolume === 0) {
                                    const vol = match.keyword_info?.search_volume || match.search_volume;
                                    if (vol) {
                                        searchVolume = vol;
                                        console.log(`[SERP Analysis] Fallback Volume (from Ideas source) found: ${searchVolume}`);
                                    }
                                }
                                console.log(`[SERP Analysis] Fallback Difficulty found: ${difficulty}`);
                            }
                        }
                    } catch (e) {
                        console.error('[SERP Analysis] Fallback Difficulty failed:', e);
                    }
                }

                console.log(`[SERP Analysis] Final metrics after fallback: SV=${searchVolume}, KD=${difficulty}`);
            } catch (err) {
                console.error('[SERP Analysis] Failed during fallback execution:', err);
            }
        }

        return NextResponse.json({
            topResults,
            paidResults,
            serpFeatures: uniqueSerpFeatures,
            targetRank,
            aiOverview,
            intent,
            searchVolume,
            difficulty,
            aiRecommendation: getAiRecommendation(keyword, action || 'No Action', targetRank || body.position || 0)
        });

    } catch (error: any) {
        console.error('SERP Analysis API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
