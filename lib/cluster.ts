import { Cluster, SerpResult } from './types';
import { canonicalizeForSerpComparison, intersectionSize } from './normalize';
import { ClusteringError } from './errors';

/**
 * Computes SERP overlap between two queries
 */
export function computeSerpOverlap(serp1: SerpResult, serp2: SerpResult): number {
  const urls1 = serp1.top10.map(r => canonicalizeForSerpComparison(r.url));
  const urls2 = serp2.top10.map(r => canonicalizeForSerpComparison(r.url));

  return intersectionSize(urls1, urls2);
}

/**
 * Builds an overlap matrix for all query pairs
 */
export function buildOverlapMatrix(serpResults: SerpResult[]): number[][] {
  const n = serpResults.length;
  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        matrix[i]![j] = 10; // Self-overlap is 10 (all top 10 match)
      } else {
        const serp1 = serpResults[i];
        const serp2 = serpResults[j];
        if (serp1 && serp2) {
          matrix[i]![j] = computeSerpOverlap(serp1, serp2);
        }
      }
    }
  }

  return matrix;
}

/**
 * Builds a similarity graph based on overlap threshold
 */
export function buildSimilarityGraph(
  overlapMatrix: number[][],
  threshold: number
): Map<number, Set<number>> {
  const graph = new Map<number, Set<number>>();
  const n = overlapMatrix.length;

  for (let i = 0; i < n; i++) {
    if (!graph.has(i)) {
      graph.set(i, new Set());
    }

    for (let j = i + 1; j < n; j++) {
      const overlap = overlapMatrix[i]?.[j];
      if (overlap !== undefined && overlap >= threshold) {
        graph.get(i)?.add(j);
        if (!graph.has(j)) {
          graph.set(j, new Set());
        }
        graph.get(j)?.add(i);
      }
    }
  }

  return graph;
}

/**
 * Finds connected components using DFS
 */
export function findConnectedComponents(graph: Map<number, Set<number>>): number[][] {
  const visited = new Set<number>();
  const components: number[][] = [];

  function dfs(node: number, component: number[]): void {
    visited.add(node);
    component.push(node);

    const neighbors = graph.get(node);
    if (neighbors) {
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          dfs(neighbor, component);
        }
      }
    }
  }

  // Visit all nodes
  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      const component: number[] = [];
      dfs(node, component);
      components.push(component);
    }
  }

  return components;
}

/**
 * Selects an exemplar query for a cluster (highest average overlap)
 */
export function selectExemplar(
  componentIndices: number[],
  overlapMatrix: number[][],
  queries: string[]
): string {
  let maxAvgOverlap = -1;
  let exemplarIdx = componentIndices[0] || 0;

  for (const idx of componentIndices) {
    let totalOverlap = 0;
    let count = 0;

    for (const otherIdx of componentIndices) {
      if (idx !== otherIdx) {
        const overlap = overlapMatrix[idx]?.[otherIdx];
        if (overlap !== undefined) {
          totalOverlap += overlap;
          count++;
        }
      }
    }

    const avgOverlap = count > 0 ? totalOverlap / count : 0;

    if (avgOverlap > maxAvgOverlap) {
      maxAvgOverlap = avgOverlap;
      exemplarIdx = idx;
    }
  }

  return queries[exemplarIdx] || queries[0] || '';
}

/**
 * Creates clusters from SERP results using overlap-based similarity
 */
export function clusterBySerpSimilarity(
  serpResults: SerpResult[],
  threshold: number,
  targetQuery?: string
): Cluster[] {
  if (serpResults.length === 0) {
    return [];
  }

  if (threshold < 1 || threshold > 10) {
    throw new ClusteringError('Threshold must be between 1 and 10', { threshold });
  }

  console.log(`🔢 Clustering ${serpResults.length} queries with threshold ${threshold}`);
  
  // Log SERP result summary
  serpResults.forEach((serp, idx) => {
    console.log(`📊 Query ${idx + 1}: "${serp.q}" has ${serp.top10.length} results`);
    if (serp.top10.length > 0) {
      console.log(`   First URL: ${serp.top10[0]?.url}`);
    }
  });

  try {
    // Build overlap matrix
    const overlapMatrix = buildOverlapMatrix(serpResults);
    
    // Log overlap matrix
    console.log(`📈 Overlap Matrix:`);
    overlapMatrix.forEach((row, i) => {
      const query = serpResults[i]?.q?.substring(0, 30) + '...' || `Query ${i}`;
      const overlaps = row.map((val, j) => i === j ? 'self' : val.toString()).join(',');
      console.log(`   ${query}: [${overlaps}]`);
    });

    // Build similarity graph
    const graph = buildSimilarityGraph(overlapMatrix, threshold);
    
    console.log(`🔗 Similarity graph (threshold ${threshold}):`);
    for (const [node, neighbors] of graph.entries()) {
      const query = serpResults[node]?.q?.substring(0, 30) + '...' || `Query ${node}`;
      console.log(`   ${query} -> [${Array.from(neighbors).join(', ')}]`);
    }

    // Find connected components
    const components = findConnectedComponents(graph);
    console.log(`🎯 Found ${components.length} clusters:`, components.map(c => c.length));

    // Handle singleton nodes (not in any component due to no edges)
    const coveredNodes = new Set<number>();
    for (const component of components) {
      for (const node of component) {
        coveredNodes.add(node);
      }
    }

    for (let i = 0; i < serpResults.length; i++) {
      if (!coveredNodes.has(i)) {
        components.push([i]);
      }
    }

    // Create clusters from components
    const queries = serpResults.map(s => s.q);

    // Find the cluster containing the target query
    let targetClusterIndex = -1;
    if (targetQuery) {
      targetClusterIndex = components.findIndex(componentIndices =>
        componentIndices.some(i => queries[i] === targetQuery)
      );
    }

    const clusters: Cluster[] = components.map((componentIndices, idx) => {
      const clusterQueries = componentIndices.map(i => queries[i] || '').filter(q => q);
      const exemplar = selectExemplar(componentIndices, overlapMatrix, queries);

      // Extract relevant overlap matrix for this cluster
      const clusterOverlapMatrix = componentIndices.map(i =>
        componentIndices.map(j => overlapMatrix[i]?.[j] || 0)
      );

      // Name the cluster containing the target query as "target"
      const clusterId = idx === targetClusterIndex ? 'target' : `cluster-${idx + 1}`;

      return {
        id: clusterId,
        queries: clusterQueries,
        exemplar,
        overlapMatrix: clusterOverlapMatrix,
      };
    });

    return clusters;
  } catch (error) {
    throw new ClusteringError(`Failed to cluster queries: ${String(error)}`, {
      originalError: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Gets the cluster ID for a given query
 */
export function getClusterForQuery(query: string, clusters: Cluster[]): string | null {
  for (const cluster of clusters) {
    if (cluster.queries.includes(query)) {
      return cluster.id;
    }
  }
  return null;
}

/**
 * Checks if two queries are in the same cluster
 */
export function areInSameCluster(query1: string, query2: string, clusters: Cluster[]): boolean {
  const cluster1 = getClusterForQuery(query1, clusters);
  const cluster2 = getClusterForQuery(query2, clusters);

  return cluster1 !== null && cluster2 !== null && cluster1 === cluster2;
}

/**
 * Computes cluster statistics
 */
export function getClusterStats(cluster: Cluster): {
  size: number;
  avgOverlap: number;
  minOverlap: number;
  maxOverlap: number;
} {
  const size = cluster.queries.length;

  if (size <= 1) {
    return { size, avgOverlap: 10, minOverlap: 10, maxOverlap: 10 };
  }

  const overlaps: number[] = [];
  const matrix = cluster.overlapMatrix;

  for (let i = 0; i < matrix.length; i++) {
    for (let j = i + 1; j < matrix.length; j++) {
      const overlap = matrix[i]?.[j];
      if (overlap !== undefined) {
        overlaps.push(overlap);
      }
    }
  }

  if (overlaps.length === 0) {
    return { size, avgOverlap: 0, minOverlap: 0, maxOverlap: 0 };
  }

  const avgOverlap = overlaps.reduce((sum, val) => sum + val, 0) / overlaps.length;
  const minOverlap = Math.min(...overlaps);
  const maxOverlap = Math.max(...overlaps);

  return { size, avgOverlap, minOverlap, maxOverlap };
}
