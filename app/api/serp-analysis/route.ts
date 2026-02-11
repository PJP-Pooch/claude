import { NextResponse } from 'next/server';
import { fetchDataForSEO, getLocationCode, getLanguageCode } from '@/lib/dataforseo';
import { extractDomain } from '@/lib/normalize';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { keyword, location = 'United Kingdom', language = 'English', targetDomain } = body;

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
        const data = await fetchDataForSEO('serp/google/organic/live/advanced', payload);

        if (!data.tasks || !data.tasks[0] || !data.tasks[0].result || !data.tasks[0].result[0]) {
            return NextResponse.json({ error: 'No SERP data found' }, { status: 404 });
        }

        const result = data.tasks[0].result[0];
        const items = result.items || [];

        // 4. Process items into our SerpResult format
        const organicResults = items
            .filter((item: any) => item.type === 'organic')
            .slice(0, 100) // Get more to find target domain
            .map((item: any) => ({
                rank: item.rank_absolute,
                title: item.title,
                url: item.url,
                snippet: item.description,
                domain: new URL(item.url).hostname.replace('www.', '')
            }));

        const topResults = organicResults.slice(0, 10);

        const paidResults = items
            .filter((item: any) =>
                item.type === 'paid' ||
                item.type === 'google_ads_top' ||
                item.type === 'google_ads_bottom' ||
                item.type === 'google_ads_shopping'
            )
            .map((item: any) => ({
                rank: item.rank_absolute,
                title: item.title || item.description || 'Google Ad',
                url: item.url || item.ad_link || '',
                snippet: item.description || '',
                domain: item.url ? new URL(item.url).hostname.replace('www.', '') :
                    (item.ad_link ? new URL(item.ad_link).hostname.replace('www.', '') : '')
            }));

        // 5. Extract SERP Features
        const serpFeatures = items
            .map((item: any) => item.type)
            .filter((type: string) => type !== 'organic' && type !== 'paid')
            .map((type: string) => {
                // Map API types to readable names
                const map: Record<string, string> = {
                    featured_snippet: 'Featured Snippet',
                    people_also_ask: 'People Also Ask',
                    video: 'Video Carousel',
                    images: 'Image Pack',
                    shopping: 'Shopping Ads',
                    local_pack: 'Local Pack',
                    knowledge_graph: 'Knowledge Graph',
                    ai_overview: 'AI Overview'
                };
                return map[type] || type.replace(/_/g, ' ');
            })
            // Unique
            .filter((value: string, index: number, self: string[]) => self.indexOf(value) === index);

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
        if (serpFeatures.includes('Shopping Ads') || lowerKeyword.includes('buy') || lowerKeyword.includes('price') || lowerKeyword.includes('sale')) {
            intent = 'Transactional';
        }
        // Local signals
        else if (serpFeatures.includes('Local Pack') || lowerKeyword.includes('near me')) {
            intent = 'Transactional';
        }
        // Commercial signals
        else if (lowerKeyword.includes('best') || lowerKeyword.includes('review') || lowerKeyword.includes('vs') || lowerKeyword.includes('top')) {
            intent = 'Commercial';
        }
        // Navigational signals
        else if (serpFeatures.includes('Knowledge Graph')) {
            intent = 'Navigational';
        }
        // Mixed
        else if (serpFeatures.length > 3) {
            intent = 'Mixed';
        }

        return NextResponse.json({
            topResults,
            paidResults,
            serpFeatures,
            targetRank,
            aiOverview,
            intent
        });

    } catch (error: any) {
        console.error('SERP Analysis API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
