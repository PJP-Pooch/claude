import { NextResponse } from 'next/server';

// Type definitions for the request body
interface SocialSerpRequest {
    baseKeyword: string;
    platforms: string[];
    dataforseoLogin?: string;
    dataforseoPassword?: string;
    locationCode?: number;
    languageCode?: string;
    device?: 'desktop' | 'mobile'?;
    depth?: number;
}

// Type definition for the response
interface PlatformResult {
    platform: string;
    query: string;
    rows: { title: string; url: string }[];
    error?: string;
}

// Platform configuration
const PLATFORMS: Record<string, { querySuffix: string; domainMatch: (domain: string, url: string) => boolean }> = {
    "Reddit": {
        querySuffix: "reddit",
        domainMatch: (d, u) => (d || "").toLowerCase().includes("reddit.com") || (u || "").toLowerCase().includes("reddit.com")
    },
    "Pinterest": {
        querySuffix: "pinterest",
        domainMatch: (d, u) => (d || "").toLowerCase().includes("pinterest.") || (u || "").toLowerCase().includes("pinterest.")
    },
    "Instagram": {
        querySuffix: "instagram",
        domainMatch: (d, u) => (d || "").toLowerCase().includes("instagram.com") || (u || "").toLowerCase().includes("instagram.com")
    },
    "TikTok": {
        querySuffix: "tiktok",
        domainMatch: (d, u) => (d || "").toLowerCase().includes("tiktok.com") || (u || "").toLowerCase().includes("tiktok.com")
    },
    "YouTube": {
        querySuffix: "youtube",
        domainMatch: (d, u) => (d || "").toLowerCase().includes("youtube.com") || (u || "").toLowerCase().includes("youtube.com")
    }
};

const SERP_API_ENDPOINT = "https://api.dataforseo.com/v3/serp/google/organic/live/advanced";

export async function POST(request: Request) {
    try {
        const body: SocialSerpRequest = await request.json();
        const {
            baseKeyword,
            platforms,
            dataforseoLogin,
            dataforseoPassword,
            locationCode = 20339, // England, United Kingdom
            languageCode = "en",
            device = "desktop",
            depth = 100
        } = body;

        if (!baseKeyword) {
            return NextResponse.json({ error: "Base keyword is required" }, { status: 400 });
        }

        // Use provided credentials or fallback to environment variables
        const login = dataforseoLogin || process.env.DATAFORSEO_LOGIN;
        const password = dataforseoPassword || process.env.DATAFORSEO_PASSWORD;

        if (!login || !password) {
            return NextResponse.json({ error: "DataForSEO credentials are missing" }, { status: 500 });
        }

        const auth = Buffer.from(`${login}:${password}`).toString('base64');
        const headers = {
            "Authorization": `Basic ${auth}`,
            "Content-Type": "application/json",
        };

        const results: PlatformResult[] = [];

        // Process platforms in parallel
        const promises = platforms.map(async (platformName) => {
            const platformConfig = PLATFORMS[platformName];
            if (!platformConfig) return null;

            const searchKeyword = `${baseKeyword} ${platformConfig.querySuffix}`.trim();

            try {
                const payload = [{
                    keyword: searchKeyword,
                    location_code: locationCode,
                    language_code: languageCode,
                    device: device,
                    depth: depth
                }];

                const response = await fetch(SERP_API_ENDPOINT, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    throw new Error(`API Error: ${response.statusText}`);
                }

                const data = await response.json();
                const taskInfo = data.tasks?.[0];

                if (taskInfo?.status_code !== 20000) {
                    throw new Error(`API Error: ${taskInfo?.status_message || 'Unknown error'}`);
                }

                const items = taskInfo.result?.[0]?.items || [];
                const rows: { title: string; url: string }[] = [];

                for (const item of items) {
                    if (item.type !== 'organic') continue;

                    const title = item.title;
                    const url = item.url;
                    const domain = item.domain;

                    if (!title || !url) continue;

                    if (platformConfig.domainMatch(domain, url)) {
                        rows.push({ title, url });
                    }
                }

                return {
                    platform: platformName,
                    query: searchKeyword,
                    rows: rows
                };

            } catch (error) {
                console.error(`Error fetching for ${platformName}:`, error);
                return {
                    platform: platformName,
                    query: searchKeyword,
                    rows: [],
                    error: error instanceof Error ? error.message : 'Unknown error'
                };
            }
        });

        const platformResults = await Promise.all(promises);

        // Filter out nulls and add to results
        platformResults.forEach(result => {
            if (result) results.push(result);
        });

        return NextResponse.json({ results });

    } catch (error) {
        console.error("Server error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
