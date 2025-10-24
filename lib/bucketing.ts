import { Action, SerpResult, Cluster, ClusterRecommendation } from './types';
import { areInSameCluster, getClusterForQuery } from './cluster';
import { computeSemanticSimilarity } from './openai';
import { generateContentBriefOpenAI } from './openai';

/**
 * Determines the action bucket for a single query based on SERP results and clustering
 */
export async function determineAction(
  query: string,
  serpResult: SerpResult,
  targetQuery: string,
  targetPageUrl: string,
  clusters: Cluster[],
  openaiApiKey: string
): Promise<Action> {
  // Case A1: Target page ranks on page 1
  if (serpResult.targetPageOnPage1) {
    return {
      type: 'great_target_page_ranking',
      q: query,
      details: `Target page ranks at position ${serpResult.firstMatch?.position || 'unknown'} for this query.`,
    };
  }

  // Case A2: Same domain ranks (but not the target page)
  if (serpResult.sameDomainOnPage1 && serpResult.firstMatch) {
    const otherUrl = serpResult.firstMatch.url;
    const queryCluster = getClusterForQuery(query, clusters);
    const targetQueryCluster = getClusterForQuery(targetQuery, clusters);

    // Check if the ranking page is in a different cluster
    if (queryCluster !== targetQueryCluster) {
      return {
        type: 'ok_other_page_diff_cluster',
        q: query,
        otherUrl,
        details: `Another page (${otherUrl}) ranks at position ${serpResult.firstMatch.position}. Clustering suggests this is a different topic, so keeping separate pages is appropriate.`,
      };
    }

    // Same cluster - potential cannibalization
    return {
      type: 'cannibalisation',
      q: query,
      otherUrl,
      recommendedFix: `Another page (${otherUrl}) ranks at position ${serpResult.firstMatch.position} for a query in the same cluster. Consider: (1) Consolidating content into the target page, (2) Using canonical tags, or (3) Adjusting internal linking to favor the target page.`,
    };
  }

  // Case B: Domain doesn't rank - check semantic similarity
  const similarity = await computeSemanticSimilarity(query, targetPageUrl, openaiApiKey, true);

  if (similarity >= 0.75) {
    // High similarity - expand target page
    return {
      type: 'expand_target_page',
      q: query,
      outline: `Content outline for "${query}" would be generated here`,
    };
  }

  // Low similarity - create new page
  return {
    type: 'new_page',
    q: query,
    pageBrief: `Page brief for "${query}" would be generated here`,
  };
}

/**
 * Generates cluster-level recommendations with actions for all queries
 */
export async function generateClusterRecommendations(
  serpResults: SerpResult[],
  clusters: Cluster[],
  targetQuery: string,
  targetPageUrl: string,
  openaiApiKey: string
): Promise<ClusterRecommendation[]> {
  const recommendations: ClusterRecommendation[] = [];

  for (const cluster of clusters) {
    const clusterSerpResults = serpResults.filter(s => cluster.queries.includes(s.q));
    const aiOverviewPresence = clusterSerpResults.map(s => s.aiOverview);

    // Determine actions for each query in the cluster
    const actions: Action[] = [];

    for (const query of cluster.queries) {
      const serpResult = serpResults.find(s => s.q === query);
      if (serpResult) {
        const action = await determineAction(
          query,
          serpResult,
          targetQuery,
          targetPageUrl,
          clusters,
          openaiApiKey
        );
        actions.push(action);
      }
    }

    recommendations.push({
      clusterId: cluster.id,
      exemplar: cluster.exemplar,
      queries: cluster.queries,
      aiOverviewPresence,
      actions,
    });
  }

  return recommendations;
}

/**
 * Gets a summary of action types across all recommendations
 */
export function getActionSummary(recommendations: ClusterRecommendation[]): {
  great_target_page_ranking: number;
  ok_other_page_diff_cluster: number;
  cannibalisation: number;
  expand_target_page: number;
  new_page: number;
} {
  const summary = {
    great_target_page_ranking: 0,
    ok_other_page_diff_cluster: 0,
    cannibalisation: 0,
    expand_target_page: 0,
    new_page: 0,
  };

  for (const rec of recommendations) {
    for (const action of rec.actions) {
      summary[action.type]++;
    }
  }

  return summary;
}

/**
 * Gets AI Overview statistics
 */
export function getAIOverviewStats(recommendations: ClusterRecommendation[]): {
  present: number;
  absent: number;
  unknown: number;
  percentagePresent: number;
} {
  let present = 0;
  let absent = 0;
  let unknown = 0;

  for (const rec of recommendations) {
    for (const aiOverview of rec.aiOverviewPresence) {
      if (aiOverview === 'present') present++;
      else if (aiOverview === 'absent') absent++;
      else unknown++;
    }
  }

  const total = present + absent + unknown;
  const percentagePresent = total > 0 ? (present / total) * 100 : 0;

  return { present, absent, unknown, percentagePresent };
}

/**
 * Identifies cannibalization issues
 */
export function identifyCannibalizationIssues(
  recommendations: ClusterRecommendation[]
): Array<{
  clusterId: string;
  queries: string[];
  competingUrl: string;
}> {
  const issues: Array<{
    clusterId: string;
    queries: string[];
    competingUrl: string;
  }> = [];

  for (const rec of recommendations) {
    const cannibalizationActions = rec.actions.filter(
      a => a.type === 'cannibalisation'
    );

    if (cannibalizationActions.length > 0) {
      const competingUrls = new Set(
        cannibalizationActions.map(a => a.type === 'cannibalisation' ? a.otherUrl : '')
      );

      for (const url of competingUrls) {
        if (url) {
          const affectedQueries = cannibalizationActions
            .filter(a => a.type === 'cannibalisation' && a.otherUrl === url)
            .map(a => a.q);

          issues.push({
            clusterId: rec.clusterId,
            queries: affectedQueries,
            competingUrl: url,
          });
        }
      }
    }
  }

  return issues;
}

/**
 * Suggests content priorities based on actions
 */
export function suggestContentPriorities(
  recommendations: ClusterRecommendation[]
): Array<{
  priority: 'high' | 'medium' | 'low';
  action: string;
  queries: string[];
  rationale: string;
}> {
  const priorities: Array<{
    priority: 'high' | 'medium' | 'low';
    action: string;
    queries: string[];
    rationale: string;
  }> = [];

  // High priority: Cannibalization issues
  const cannibalizationIssues = identifyCannibalizationIssues(recommendations);
  if (cannibalizationIssues.length > 0) {
    for (const issue of cannibalizationIssues) {
      priorities.push({
        priority: 'high',
        action: 'Fix cannibalization',
        queries: issue.queries,
        rationale: `Multiple queries in cluster ${issue.clusterId} rank with ${issue.competingUrl} instead of target page, indicating potential cannibalization.`,
      });
    }
  }

  // Medium priority: Expand target page opportunities
  for (const rec of recommendations) {
    const expandActions = rec.actions.filter(a => a.type === 'expand_target_page');
    if (expandActions.length >= 3) {
      priorities.push({
        priority: 'medium',
        action: 'Expand target page',
        queries: expandActions.map(a => a.q),
        rationale: `Cluster ${rec.clusterId} has ${expandActions.length} related queries that could be addressed by expanding the target page.`,
      });
    }
  }

  // Low priority: New page opportunities
  for (const rec of recommendations) {
    const newPageActions = rec.actions.filter(a => a.type === 'new_page');
    if (newPageActions.length >= 2) {
      priorities.push({
        priority: 'low',
        action: 'Create new page',
        queries: newPageActions.map(a => a.q),
        rationale: `Cluster ${rec.clusterId} has ${newPageActions.length} queries that warrant a separate content piece.`,
      });
    }
  }

  return priorities;
}
