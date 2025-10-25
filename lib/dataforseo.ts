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
  
  console.log(`🔍 Fetching SERP for query: "${query}"`);
  console.log(`📍 Location: ${location} (code: ${locationCode})`);
  console.log(`🌐 Language: ${language} (code: ${languageCode})`);
  console.log(`📱 Device: ${device}`);

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
    console.log(`📦 DataForSEO API Response Status:`, response.status);
    console.log(`📊 Response data structure:`, {
      tasks: data.tasks?.length || 0,
      version: data.version,
      status_code: data.status_code,
      status_message: data.status_message
    });

    if (!data.tasks || data.tasks.length === 0) {
      console.error(`❌ No tasks in DataForSEO response for query "${query}"`);
      throw new DataForSEOAPIError('No tasks in DataForSEO response', { data, query });
    }

    const task = data.tasks[0];
    console.log(`📋 Task info:`, {
      id: task.id,
      status_code: task.status_code,
      status_message: task.status_message,
      result_count: task.result?.length || 0
    });

    if (!task.result || task.result.length === 0) {
      console.warn(`⚠️ No results in task for query "${query}"`);
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
    console.log(`🔍 Found ${items.length} total items in SERP result`);
    
    // Log first few items to understand structure
    if (items.length > 0) {
      console.log(`📝 First item structure:`, {
        type: items[0].type,
        rank_absolute: items[0].rank_absolute,
        url: items[0].url,
        title: items[0].title?.substring(0, 50) + '...'
      });
    }

    // Extract organic results
    const organicItems = items.filter((item: { type: string }) => item.type === 'organic');
    console.log(`🌱 Found ${organicItems.length} organic items`);

    const organicResults: OrganicResult[] = organicItems
      .slice(0, 10)
      .map((item: { rank_absolute: number; url: string; title: string; description?: string }) => ({
        position: item.rank_absolute,
        url: normalizeUrl(item.url), // Normalize URL to strip tracking parameters
        title: item.title,
        snippet: item.description,
      }));
      
    console.log(`✅ Processed ${organicResults.length} organic results`);

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

      console.log(`🤖 AI Overview found with ${uniqueUrls.length} unique URLs`);
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
    
    console.log(`🎯 Final result for "${query}":`, {
      top10_count: finalResult.top10.length,
      aiOverview: finalResult.aiOverview,
      targetPageOnPage1: finalResult.targetPageOnPage1,
      sameDomainOnPage1: finalResult.sameDomainOnPage1,
      firstMatch: finalResult.firstMatch ? `Position ${finalResult.firstMatch.position}` : 'None'
    });
    
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
 */
export async function fetchBatchSerpResults(
  queries: string[],
  params: Omit<SerpApiParams, 'query'>,
  credentials: DataForSEOCredentials,
  concurrency: number = 5
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
      await sleep(500);
    }
  }

  return { results, errors };
}

/**
 * Mock SERP results for testing without API calls
 */
export function getMockSerpResults(queries: string[], targetPageUrl: string): SerpResult[] {
  const targetDomain = extractDomain(targetPageUrl);

  return queries.map((q, index) => {
    // Simulate varied results
    const mockResults: OrganicResult[] = Array.from({ length: 10 }, (_, i) => ({
      position: i + 1,
      url: i === 0 && index % 3 === 0
        ? targetPageUrl
        : i === 1 && index % 4 === 0
        ? `https://${targetDomain}/other-page-${index}`
        : `https://example${i}.com/page-${index}`,
      title: `Result ${i + 1} for ${q}`,
      snippet: `This is a mock snippet for result ${i + 1}`,
    }));

    const targetPageOnPage1 = mockResults.some(r => urlsMatch(r.url, targetPageUrl));
    const sameDomainOnPage1 = mockResults.some(r => sameDomain(r.url, targetPageUrl));
    const firstMatch = mockResults.find(r =>
      urlsMatch(r.url, targetPageUrl) || sameDomain(r.url, targetPageUrl)
    );

    return {
      q,
      top10: mockResults,
      aiOverview: index % 2 === 0 ? 'present' : 'absent',
      aiOverviewData: index % 2 === 0 ? {
        text: `This is a mock AI Overview for "${q}". It provides a comprehensive answer based on multiple sources.`,
        urls: [
          { url: 'https://example1.com/article', title: 'Example Article 1' },
          { url: 'https://example2.com/guide', title: 'Example Guide 2' },
        ],
      } : undefined,
      targetPageOnPage1,
      sameDomainOnPage1,
      firstMatch: firstMatch ? { position: firstMatch.position, url: firstMatch.url } : undefined,
    };
  });
}
