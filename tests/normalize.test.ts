import {
  normalizeUrl,
  extractDomain,
  urlsMatch,
  sameDomain,
  cosineSimilarity,
  deduplicateStrings,
  filterNearDuplicates,
  canonicalizeForSerpComparison,
  intersectionSize,
} from '../lib/normalize';

describe('normalize', () => {
  describe('normalizeUrl', () => {
    it('should remove www prefix', () => {
      expect(normalizeUrl('https://www.example.com/page')).toBe('https://example.com/page');
    });

    it('should remove trailing slash', () => {
      expect(normalizeUrl('https://example.com/page/')).toBe('https://example.com/page');
    });

    it('should remove UTM parameters', () => {
      expect(normalizeUrl('https://example.com/page?utm_source=test&utm_medium=email')).toBe(
        'https://example.com/page'
      );
    });

    it('should lowercase hostname', () => {
      expect(normalizeUrl('https://EXAMPLE.COM/page')).toBe('https://example.com/page');
    });

    it('should keep non-tracking query parameters', () => {
      expect(normalizeUrl('https://example.com/page?id=123')).toBe('https://example.com/page?id=123');
    });
  });

  describe('extractDomain', () => {
    it('should extract domain without www', () => {
      expect(extractDomain('https://www.example.com/page')).toBe('example.com');
    });

    it('should extract domain and lowercase it', () => {
      expect(extractDomain('https://EXAMPLE.COM/page')).toBe('example.com');
    });
  });

  describe('urlsMatch', () => {
    it('should match identical URLs', () => {
      expect(urlsMatch('https://example.com/page', 'https://example.com/page')).toBe(true);
    });

    it('should match URLs with and without www', () => {
      expect(urlsMatch('https://www.example.com/page', 'https://example.com/page')).toBe(true);
    });

    it('should match URLs with and without trailing slash', () => {
      expect(urlsMatch('https://example.com/page/', 'https://example.com/page')).toBe(true);
    });

    it('should not match different URLs', () => {
      expect(urlsMatch('https://example.com/page1', 'https://example.com/page2')).toBe(false);
    });
  });

  describe('sameDomain', () => {
    it('should return true for same domain', () => {
      expect(sameDomain('https://example.com/page1', 'https://example.com/page2')).toBe(true);
    });

    it('should return false for different domains', () => {
      expect(sameDomain('https://example.com/page', 'https://other.com/page')).toBe(false);
    });
  });

  describe('cosineSimilarity', () => {
    it('should return 1 for identical texts', () => {
      const similarity = cosineSimilarity('hello world', 'hello world');
      expect(similarity).toBeCloseTo(1, 2);
    });

    it('should return high similarity for similar texts', () => {
      const similarity = cosineSimilarity('hello world', 'hello world test');
      expect(similarity).toBeGreaterThan(0.5);
    });

    it('should return low similarity for different texts', () => {
      const similarity = cosineSimilarity('hello world', 'completely different');
      expect(similarity).toBeLessThan(0.5);
    });

    it('should return 0 for empty texts', () => {
      expect(cosineSimilarity('', '')).toBe(0);
    });
  });

  describe('deduplicateStrings', () => {
    it('should remove duplicate strings', () => {
      const result = deduplicateStrings(['hello', 'world', 'hello', 'test']);
      expect(result).toEqual(['hello', 'world', 'test']);
    });

    it('should handle case-insensitive duplicates', () => {
      const result = deduplicateStrings(['Hello', 'hello', 'HELLO']);
      expect(result).toEqual(['Hello']);
    });

    it('should trim whitespace', () => {
      const result = deduplicateStrings(['hello', ' hello ', 'hello  ']);
      expect(result).toEqual(['hello']);
    });
  });

  describe('filterNearDuplicates', () => {
    it('should filter near-duplicate queries', () => {
      const queries = [
        { q: 'what is seo', intent: 'info' as const },
        { q: 'what is SEO', intent: 'info' as const },
        { q: 'how to do seo', intent: 'info' as const },
      ];
      const result = filterNearDuplicates(queries, 0.9);
      expect(result.length).toBeLessThan(queries.length);
    });
  });

  describe('canonicalizeForSerpComparison', () => {
    it('should return host and path', () => {
      expect(canonicalizeForSerpComparison('https://www.example.com/page')).toBe('example.com/page');
    });

    it('should remove trailing slash from path', () => {
      expect(canonicalizeForSerpComparison('https://example.com/page/')).toBe('example.com/page');
    });
  });

  describe('intersectionSize', () => {
    it('should compute intersection size', () => {
      expect(intersectionSize([1, 2, 3, 4], [3, 4, 5, 6])).toBe(2);
    });

    it('should return 0 for no intersection', () => {
      expect(intersectionSize([1, 2], [3, 4])).toBe(0);
    });
  });
});
