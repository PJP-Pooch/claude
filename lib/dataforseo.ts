import { SerpResult, OrganicResult, LOCATION_MAP, LANGUAGE_MAP } from './types';
import { DataForSEOAPIError, RateLimitError } from './errors';
import { extractDomain, sameDomain, urlsMatch, normalizeUrl } from './normalize';

const DATAFORSEO_API_BASE = 'https://api.dataforseo.com/v3';
const MAX_RETRIES = 4;
const INITIAL_BACKOFF = 2000; // 2 seconds

type DataForSEOCredentials = {
  login: string;
  password: string;
};

type SerpApiParams = {
  query: string;
  location: string;
  language: string;
  device: 'desktop' | 'mobile';
  targetPageUrl: string;
};

type DataForSEOTask = {
  keyword: string;
  location_code: number;
  language_code: string;
  device: string;
  depth: number;
};

type DataForSEORequest = {
  tasks: DataForSEOTask[];
};

/**
 * Sleep utility for exponential backoff
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Gets the location code for DataForSEO
 */
export function getLocationCode(locationName: string): number {
  return LOCATION_MAP[locationName] || LOCATION_MAP['United Kingdom'] || 2826;
}

/**
 * Gets the language code for DataForSEO
 */
export function getLanguageCode(languageName: string): string {
  return LANGUAGE_MAP[languageName] || LANGUAGE_MAP['English'] || 'en';
}

/**
 * Fetches SERP results from DataForSEO for a single query
 */
export async function fetchSerpResult(
  params: SerpApiParams,
  credentials: DataForSEOCredentials,
  retryCount: number = 0
): Promise<SerpResult> {
  const { query, location, language, device, targetPageUrl } = params;
  const locationCode = getLocationCode(location);
  const languageCode = getLanguageCode(language);

  const requestBody = [
    {
      keyword: query,
      location_code: locationCode,
      language_code: languageCode,
      device,
      load_async_ai_overview: true,
    },
  ];

  try {
    const authString = Buffer.from(`${credentials.login}:${credentials.password}`).toString('base64');

    const response = await fetch(`${DATAFORSEO_API_BASE}/serp/google/organic/live/advanced`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    // Handle rate limiting
    if (response.status === 429) {
      if (retryCount >= MAX_RETRIES) {
        throw new RateLimitError('Max retries exceeded for rate limit', undefined, {
          query,
          retryCount,
        });
      }

      const backoffTime = INITIAL_BACKOFF * Math.pow(2, retryCount);
      await sleep(backoffTime);
      return fetchSerpResult(params, credentials, retryCount + 1);
    }

    // Handle server errors with retry
    if (response.status >= 500) {
      if (retryCount >= MAX_RETRIES) {
        throw new DataForSEOAPIError(`Server error after ${MAX_RETRIES} retries`, {
          status: response.status,
          query,
        });
      }

      const backoffTime = INITIAL_BACKOFF * Math.pow(2, retryCount);
      await sleep(backoffTime);
      return fetchSerpResult(params, credentials, retryCount + 1);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new DataForSEOAPIError(`DataForSEO API request failed: ${response.status} ${errorText}`, {
        status: response.status,
        statusText: response.statusText,
        query,
      });
    }

    const data = await response.json();

    if (!data.tasks || data.tasks.length === 0) {
      throw new DataForSEOAPIError('No tasks in DataForSEO response', { data, query });
    }

    const task = data.tasks[0];

    if (!task.result || task.result.length === 0) {
      // No results found - return empty result
      return {
        q: query,
        top10: [],
        aiOverview: 'unknown',
        targetPageOnPage1: false,
        sameDomainOnPage1: false,
      };
    }

    const result = task.result[0];
    const items = result.items || [];

    // Extract organic results
    const organicItems = items.filter((item: { type: string }) => item.type === 'organic');

    const organicResults: OrganicResult[] = organicItems
      .slice(0, 10)
      .map((item: { rank_absolute: number; url: string; title: string; description?: string }) => ({
        position: item.rank_absolute,
        url: normalizeUrl(item.url), // Normalize URL to strip tracking parameters
        title: item.title,
        snippet: item.description,
      }));

    // Extract AI Overview data
    const aiOverviewItem = items.find((item: { type: string }) => item.type === 'ai_overview');
    let aiOverview: 'present' | 'absent' | 'unknown' = 'absent';
    let aiOverviewData: { text: string; urls: Array<{ url: string; title?: string }> } | undefined;

    if (aiOverviewItem) {
      aiOverview = 'present';
      // Extract text from AI overview
      const text = aiOverviewItem.text || aiOverviewItem.markdown || '';

      // Extract URLs from references
      const urls: Array<{ url: string; title?: string }> = [];
      if (aiOverviewItem.items && Array.isArray(aiOverviewItem.items)) {
        for (const subItem of aiOverviewItem.items) {
          if (subItem.references && Array.isArray(subItem.references)) {
            for (const ref of subItem.references) {
              if (ref.url) {
                urls.push({
                  url: normalizeUrl(ref.url),
                  title: ref.title || ref.source,
                });
              }
            }
          }
        }
      }

      // Deduplicate URLs
      const uniqueUrls = urls.filter((url, index, self) =>
        index === self.findIndex((u) => u.url === url.url)
      );

      aiOverviewData = {
        text: text,
        urls: uniqueUrls,
      };
    }

    // Check if target page or same domain ranks on page 1
    const targetDomain = extractDomain(targetPageUrl);
    
    let targetPageOnPage1 = false;
    let sameDomainOnPage1 = false;
    let firstMatch: { position: number; url: string } | undefined;

    for (const orgResult of organicResults) {
      if (orgResult.position <= 10) {
        const urlMatches = urlsMatch(orgResult.url, targetPageUrl);
        const domainMatches = sameDomain(orgResult.url, targetPageUrl);
        
        if (urlMatches) {
          targetPageOnPage1 = true;
          if (!firstMatch) {
            firstMatch = { position: orgResult.position, url: orgResult.url };
          }
        } else if (domainMatches) {
          sameDomainOnPage1 = true;
          if (!firstMatch) {
            firstMatch = { position: orgResult.position, url: orgResult.url };
          }
        }
      }
    }

    const finalResult = {
      q: query,
      top10: organicResults,
      aiOverview,
      aiOverviewData,
      targetPageOnPage1,
      sameDomainOnPage1,
      firstMatch,
    };

    return finalResult;
  } catch (error) {
    if (error instanceof DataForSEOAPIError || error instanceof RateLimitError) {
      throw error;
    }
    throw new DataForSEOAPIError(`Failed to fetch SERP result: ${String(error)}`, {
      query,
      originalError: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Fetches SERP results for multiple queries with rate-limit aware batching
 * @param concurrency Number of parallel requests (default: 25 for maximum performance)
 */
export async function fetchBatchSerpResults(
  queries: string[],
  params: Omit<SerpApiParams, 'query'>,
  credentials: DataForSEOCredentials,
  concurrency: number = 25
): Promise<{
  results: SerpResult[];
  errors: Array<{ query: string; error: string }>;
}> {
  const results: SerpResult[] = [];
  const errors: Array<{ query: string; error: string }> = [];

  // Process in batches
  for (let i = 0; i < queries.length; i += concurrency) {
    const batch = queries.slice(i, i + concurrency);
    const batchPromises = batch.map(async (query) => {
      try {
        const result = await fetchSerpResult(
          { ...params, query },
          credentials
        );
        return { success: true, result };
      } catch (error) {
        return {
          success: false,
          query,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    const batchResults = await Promise.all(batchPromises);

    for (const batchResult of batchResults) {
      if (batchResult.success && batchResult.result) {
        results.push(batchResult.result);
      } else if (!batchResult.success && batchResult.query) {
        errors.push({ query: batchResult.query, error: batchResult.error || 'Unknown error' });
      }
    }

    // Add a small delay between batches to avoid rate limits
    if (i + concurrency < queries.length) {
      await sleep(300);
    }
  }

  return { results, errors };
}

/**
 * Mock SERP results for testing without API calls
 * Creates realistic clustering by assigning similar URLs to related queries
 */
export function getMockSerpResults(queries: string[], targetPageUrl: string): SerpResult[] {
  const targetDomain = extractDomain(targetPageUrl);

  // Define SERP patterns for different clusters
  // Pattern A: Target cluster (most queries should use this - 60%)
  const patternA_urls = [
    targetPageUrl,
    `https://${targetDomain}/related-guide`,
    'https://hubspot.com/marketing/content-strategy',
    'https://contentmarketinginstitute.com/articles/strategy-guide',
    'https://neil-patel.com/blog/content-marketing',
    'https://moz.com/beginners-guide-to-content-marketing',
    'https://semrush.com/blog/content-marketing-strategy',
    'https://copyblogger.com/content-marketing-strategy',
    'https://buffer.com/library/content-marketing-strategy',
    'https://sproutsocial.com/insights/content-marketing-strategy',
  ];

  // Pattern B: Different cluster - SEO focused (20%)
  const patternB_urls = [
    'https://ahrefs.com/blog/seo-strategy',
    'https://backlinko.com/seo-strategy',
    'https://searchengineland.com/guide/what-is-seo',
    'https://moz.com/learn/seo',
    `https://${targetDomain}/seo-guide`,
    'https://yoast.com/what-is-seo',
    'https://semrush.com/blog/seo',
    'https://neilpatel.com/what-is-seo',
    'https://searchenginejournal.com/seo-guide',
    'https://wordstream.com/seo',
  ];

  // Pattern C: Another cluster - Social media focused (20%)
  const patternC_urls = [
    'https://hootsuite.com/social-media-marketing',
    'https://buffer.com/social-media-marketing',
    'https://sproutsocial.com/insights/social-media-marketing',
    'https://hubspot.com/marketing/social-media',
    'https://later.com/blog/social-media-strategy',
    'https://socialmediaexaminer.com/social-media-marketing',
    'https://forbes.com/advisor/business/social-media-marketing',
    'https://wordstream.com/social-media-marketing',
    `https://${targetDomain}/social-media-tips`,
    'https://business.instagram.com/getting-started',
  ];

  return queries.map((q, index) => {
    // First 60% of queries go to target cluster (Pattern A)
    // This ensures the target cluster has the most keywords
    let pattern: string[];
    let clusterType: string;

    if (index < Math.ceil(queries.length * 0.6)) {
      pattern = patternA_urls;
      clusterType = 'target';
    } else if (index < Math.ceil(queries.length * 0.8)) {
      pattern = patternB_urls;
      clusterType = 'seo';
    } else {
      pattern = patternC_urls;
      clusterType = 'social';
    }

    // Create top 10 results using the pattern URLs
    const mockResults: OrganicResult[] = pattern.map((url, i) => ({
      position: i + 1,
      url: url,
      title: `${q} - Complete Guide | ${new URL(url).hostname}`,
      snippet: `Learn everything about ${q}. Expert tips, strategies, and best practices for success in ${new Date().getFullYear()}.`,
    }));

    const targetPageOnPage1 = mockResults.some(r => urlsMatch(r.url, targetPageUrl));
    const sameDomainOnPage1 = mockResults.some(r => sameDomain(r.url, targetPageUrl));
    const firstMatch = mockResults.find(r =>
      urlsMatch(r.url, targetPageUrl) || sameDomain(r.url, targetPageUrl)
    );

    // Add realistic AI Overview text based on cluster type
    const aiOverviewTexts = {
      target: `**${q}** involves creating and distributing valuable, relevant content to attract and engage a clearly defined audience. Key components include:\n\n• **Content Planning**: Develop a documented strategy aligned with business goals\n• **Audience Research**: Understand your target audience's needs and pain points\n• **Content Creation**: Produce high-quality, valuable content consistently\n• **Distribution**: Share content across appropriate channels\n• **Performance Measurement**: Track metrics and optimize based on data\n\nSuccessful content marketing builds trust, establishes authority, and drives profitable customer action over time.`,
      seo: `**${q}** is the practice of optimizing your website to rank higher in search engine results. Essential elements include:\n\n• **Keyword Research**: Identify terms your audience searches for\n• **On-Page SEO**: Optimize titles, meta descriptions, and content\n• **Technical SEO**: Improve site speed, mobile-friendliness, and crawlability\n• **Link Building**: Earn high-quality backlinks from authoritative sites\n• **Content Quality**: Create valuable, comprehensive content\n\nEffective SEO increases organic visibility, drives targeted traffic, and improves user experience.`,
      social: `**${q}** uses social platforms to connect with your audience, build your brand, and drive website traffic. Core strategies include:\n\n• **Platform Selection**: Choose networks where your audience is active\n• **Content Strategy**: Share engaging, valuable content consistently\n• **Community Engagement**: Respond to comments and messages promptly\n• **Paid Advertising**: Amplify reach with targeted ads\n• **Analytics**: Monitor performance and adjust strategy accordingly\n\nStrong social media presence builds brand awareness, fosters community, and supports business objectives.`
    };

    return {
      q,
      top10: mockResults,
      aiOverview: index % 3 === 0 ? 'present' : 'absent', // Show AI overviews for 1/3 of queries
      aiOverviewData: index % 3 === 0 ? {
        text: aiOverviewTexts[clusterType as keyof typeof aiOverviewTexts],
        urls: pattern.slice(0, 4).map(url => ({
          url: url,
          title: `${new URL(url).hostname.replace('www.', '')} - Guide`,
        })),
      } : undefined,
      targetPageOnPage1,
      sameDomainOnPage1,
      firstMatch: firstMatch ? { position: firstMatch.position, url: firstMatch.url } : undefined,
    };
  });
}
