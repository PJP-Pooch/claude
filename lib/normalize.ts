/**
 * URL normalization and canonicalization utilities
 */

/**
 * Normalizes a URL by:
 * - Removing UTM and tracking parameters
 * - Trimming trailing slashes
 * - Lowercasing the host
 * - Removing "www." prefix
 */
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);

    // Remove www. prefix
    let host = parsed.hostname.toLowerCase();
    if (host.startsWith('www.')) {
      host = host.substring(4);
    }

    // Remove tracking parameters
    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'gclid', 'fbclid', 'msclkid', '_ga', 'mc_cid', 'mc_eid',
      'srsltid', // Google Shopping auto-tagging
      'gbraid', 'wbraid', // Google Ads click identifiers
      'dclid', // DoubleClick identifier
      'ref', 'source', // Common referrer parameters
    ];

    trackingParams.forEach(param => {
      parsed.searchParams.delete(param);
    });

    // Reconstruct URL
    let normalized = `${parsed.protocol}//${host}${parsed.pathname}`;

    // Remove trailing slash (except for root)
    if (normalized.endsWith('/') && normalized.length > parsed.protocol.length + 3) {
      normalized = normalized.slice(0, -1);
    }

    // Add search params if any remain
    const searchString = parsed.searchParams.toString();
    if (searchString) {
      normalized += `?${searchString}`;
    }

    // Add hash if present
    if (parsed.hash) {
      normalized += parsed.hash;
    }

    return normalized;
  } catch (error) {
    // If URL parsing fails, return original
    return url;
  }
}

/**
 * Extracts the domain from a URL
 */
export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    let host = parsed.hostname.toLowerCase();
    if (host.startsWith('www.')) {
      host = host.substring(4);
    }
    return host;
  } catch (error) {
    return '';
  }
}

/**
 * Checks if two URLs match (same host and path, ignoring trailing slash)
 */
export function urlsMatch(url1: string, url2: string): boolean {
  const normalized1 = normalizeUrl(url1);
  const normalized2 = normalizeUrl(url2);
  return normalized1 === normalized2;
}

/**
 * Checks if two URLs are from the same domain
 */
export function sameDomain(url1: string, url2: string): boolean {
  return extractDomain(url1) === extractDomain(url2);
}

/**
 * Deduplicates an array of strings (case-insensitive, whitespace-normalized)
 */
export function deduplicateStrings(strings: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const str of strings) {
    const normalized = str.trim().toLowerCase().replace(/\s+/g, ' ');
    if (!seen.has(normalized)) {
      seen.add(normalized);
      result.push(str);
    }
  }

  return result;
}

/**
 * Computes cosine similarity between two text strings using TF-IDF
 */
export function cosineSimilarity(text1: string, text2: string): number {
  const tokens1 = tokenize(text1);
  const tokens2 = tokenize(text2);

  if (tokens1.length === 0 || tokens2.length === 0) {
    return 0;
  }

  const freq1 = computeFrequency(tokens1);
  const freq2 = computeFrequency(tokens2);

  const allTokens = new Set([...Object.keys(freq1), ...Object.keys(freq2)]);

  let dotProduct = 0;
  let mag1 = 0;
  let mag2 = 0;

  for (const token of allTokens) {
    const f1 = freq1[token] || 0;
    const f2 = freq2[token] || 0;
    dotProduct += f1 * f2;
    mag1 += f1 * f1;
    mag2 += f2 * f2;
  }

  if (mag1 === 0 || mag2 === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(mag1) * Math.sqrt(mag2));
}

/**
 * Tokenizes text into words
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 0);
}

/**
 * Computes word frequency
 */
function computeFrequency(tokens: string[]): Record<string, number> {
  const freq: Record<string, number> = {};
  for (const token of tokens) {
    freq[token] = (freq[token] || 0) + 1;
  }
  return freq;
}

/**
 * Filters out near-duplicate queries using cosine similarity
 */
export function filterNearDuplicates(
  queries: Array<{ q: string; [key: string]: unknown }>,
  threshold: number = 0.9
): Array<{ q: string; [key: string]: unknown }> {
  const result: Array<{ q: string; [key: string]: unknown }> = [];

  for (const query of queries) {
    let isDuplicate = false;
    for (const existing of result) {
      const similarity = cosineSimilarity(query.q, existing.q);
      if (similarity > threshold) {
        isDuplicate = true;
        break;
      }
    }
    if (!isDuplicate) {
      result.push(query);
    }
  }

  return result;
}

/**
 * Canonicalizes a URL for SERP comparison
 * Returns just the host and path for overlap counting
 */
export function canonicalizeForSerpComparison(url: string): string {
  try {
    const parsed = new URL(url);
    let host = parsed.hostname.toLowerCase();
    if (host.startsWith('www.')) {
      host = host.substring(4);
    }
    let path = parsed.pathname;
    if (path.endsWith('/') && path.length > 1) {
      path = path.slice(0, -1);
    }
    return `${host}${path}`;
  } catch (error) {
    return url;
  }
}

/**
 * Computes the intersection size between two arrays
 */
export function intersectionSize<T>(arr1: T[], arr2: T[]): number {
  const set1 = new Set(arr1);
  let count = 0;
  for (const item of arr2) {
    if (set1.has(item)) {
      count++;
    }
  }
  return count;
}
