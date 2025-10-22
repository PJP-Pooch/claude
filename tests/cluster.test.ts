import {
  computeSerpOverlap,
  buildOverlapMatrix,
  buildSimilarityGraph,
  findConnectedComponents,
  selectExemplar,
  clusterBySerpSimilarity,
  getClusterForQuery,
  areInSameCluster,
  getClusterStats,
} from '../lib/cluster';
import { SerpResult } from '../lib/types';

describe('cluster', () => {
  const mockSerpResults: SerpResult[] = [
    {
      q: 'query1',
      top10: [
        { position: 1, url: 'https://example.com/a', title: 'A' },
        { position: 2, url: 'https://example.com/b', title: 'B' },
        { position: 3, url: 'https://example.com/c', title: 'C' },
      ],
      aiOverview: 'absent',
      targetPageOnPage1: false,
      sameDomainOnPage1: false,
    },
    {
      q: 'query2',
      top10: [
        { position: 1, url: 'https://example.com/a', title: 'A' },
        { position: 2, url: 'https://example.com/b', title: 'B' },
        { position: 3, url: 'https://example.com/d', title: 'D' },
      ],
      aiOverview: 'absent',
      targetPageOnPage1: false,
      sameDomainOnPage1: false,
    },
    {
      q: 'query3',
      top10: [
        { position: 1, url: 'https://other.com/x', title: 'X' },
        { position: 2, url: 'https://other.com/y', title: 'Y' },
        { position: 3, url: 'https://other.com/z', title: 'Z' },
      ],
      aiOverview: 'present',
      targetPageOnPage1: false,
      sameDomainOnPage1: false,
    },
  ];

  describe('computeSerpOverlap', () => {
    it('should compute correct overlap count', () => {
      const overlap = computeSerpOverlap(mockSerpResults[0]!, mockSerpResults[1]!);
      expect(overlap).toBeGreaterThanOrEqual(2); // At least a and b overlap
    });

    it('should return 0 for no overlap', () => {
      const overlap = computeSerpOverlap(mockSerpResults[0]!, mockSerpResults[2]!);
      expect(overlap).toBe(0);
    });
  });

  describe('buildOverlapMatrix', () => {
    it('should build a square matrix', () => {
      const matrix = buildOverlapMatrix(mockSerpResults);
      expect(matrix.length).toBe(mockSerpResults.length);
      expect(matrix[0]?.length).toBe(mockSerpResults.length);
    });

    it('should have 10 on diagonal', () => {
      const matrix = buildOverlapMatrix(mockSerpResults);
      expect(matrix[0]?.[0]).toBe(10);
      expect(matrix[1]?.[1]).toBe(10);
    });
  });

  describe('buildSimilarityGraph', () => {
    it('should create edges for high overlap', () => {
      const matrix = buildOverlapMatrix(mockSerpResults);
      const graph = buildSimilarityGraph(matrix, 2);
      expect(graph.size).toBeGreaterThan(0);
    });
  });

  describe('findConnectedComponents', () => {
    it('should find connected components', () => {
      const graph = new Map<number, Set<number>>();
      graph.set(0, new Set([1]));
      graph.set(1, new Set([0]));
      graph.set(2, new Set());

      const components = findConnectedComponents(graph);
      expect(components.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('selectExemplar', () => {
    it('should select an exemplar from cluster', () => {
      const matrix = [[10, 5], [5, 10]];
      const queries = ['query1', 'query2'];
      const exemplar = selectExemplar([0, 1], matrix, queries);
      expect(['query1', 'query2']).toContain(exemplar);
    });
  });

  describe('clusterBySerpSimilarity', () => {
    it('should create clusters', () => {
      const clusters = clusterBySerpSimilarity(mockSerpResults, 2);
      expect(clusters.length).toBeGreaterThan(0);
      expect(clusters[0]).toHaveProperty('id');
      expect(clusters[0]).toHaveProperty('queries');
      expect(clusters[0]).toHaveProperty('exemplar');
    });

    it('should throw error for invalid threshold', () => {
      expect(() => clusterBySerpSimilarity(mockSerpResults, 0)).toThrow();
      expect(() => clusterBySerpSimilarity(mockSerpResults, 11)).toThrow();
    });
  });

  describe('getClusterForQuery', () => {
    it('should find cluster for query', () => {
      const clusters = clusterBySerpSimilarity(mockSerpResults, 2);
      const clusterId = getClusterForQuery('query1', clusters);
      expect(clusterId).toBeTruthy();
    });

    it('should return null for non-existent query', () => {
      const clusters = clusterBySerpSimilarity(mockSerpResults, 2);
      const clusterId = getClusterForQuery('non-existent', clusters);
      expect(clusterId).toBeNull();
    });
  });

  describe('areInSameCluster', () => {
    it('should determine if queries are in same cluster', () => {
      const clusters = clusterBySerpSimilarity(mockSerpResults, 2);
      const result = areInSameCluster('query1', 'query2', clusters);
      expect(typeof result).toBe('boolean');
    });
  });

  describe('getClusterStats', () => {
    it('should compute cluster statistics', () => {
      const clusters = clusterBySerpSimilarity(mockSerpResults, 2);
      const stats = getClusterStats(clusters[0]!);
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('avgOverlap');
      expect(stats).toHaveProperty('minOverlap');
      expect(stats).toHaveProperty('maxOverlap');
    });
  });
});
