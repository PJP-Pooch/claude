import {
  getActionSummary,
  getAIOverviewStats,
  identifyCannibalizationIssues,
  suggestContentPriorities,
} from '../lib/bucketing';
import { ClusterRecommendation } from '../lib/types';

describe('bucketing', () => {
  const mockRecommendations: ClusterRecommendation[] = [
    {
      clusterId: 'cluster-1',
      exemplar: 'test query',
      queries: ['query1', 'query2'],
      aiOverviewPresence: ['present', 'absent'],
      actions: [
        {
          type: 'cannibalisation',
          q: 'query2',
          otherUrl: 'https://example.com/other',
          recommendedFix: 'Consolidate content',
        },
      ],
    },
    {
      clusterId: 'cluster-2',
      exemplar: 'another query',
      queries: ['query3', 'query4', 'query5'],
      aiOverviewPresence: ['absent', 'unknown', 'present'],
      actions: [
        {
          type: 'expand_target_page',
          q: 'query3',
          outline: 'Add section about X',
        },
        {
          type: 'expand_target_page',
          q: 'query4',
          outline: 'Add section about Y',
        },
        {
          type: 'new_page',
          q: 'query5',
          pageBrief: 'Create new page about Z',
        },
      ],
    },
  ];

  describe('getActionSummary', () => {
    it('should count actions by type', () => {
      const summary = getActionSummary(mockRecommendations);
      expect(summary.cannibalisation).toBe(1);
      expect(summary.expand_target_page).toBe(2);
      expect(summary.new_page).toBe(1);
      expect(summary.ok_other_page_diff_cluster).toBe(0);
    });

    it('should handle empty recommendations', () => {
      const summary = getActionSummary([]);
      expect(summary.cannibalisation).toBe(0);
    });
  });

  describe('getAIOverviewStats', () => {
    it('should count AI overview presence', () => {
      const stats = getAIOverviewStats(mockRecommendations);
      expect(stats.present).toBe(2);
      expect(stats.absent).toBe(2);
      expect(stats.unknown).toBe(1);
      expect(stats.percentagePresent).toBeCloseTo(40, 0);
    });

    it('should handle empty recommendations', () => {
      const stats = getAIOverviewStats([]);
      expect(stats.present).toBe(0);
      expect(stats.percentagePresent).toBe(0);
    });
  });

  describe('identifyCannibalizationIssues', () => {
    it('should identify cannibalization issues', () => {
      const issues = identifyCannibalizationIssues(mockRecommendations);
      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0]).toHaveProperty('clusterId');
      expect(issues[0]).toHaveProperty('queries');
      expect(issues[0]).toHaveProperty('competingUrl');
    });

    it('should handle no cannibalization', () => {
      const noCannibalRecommendations: ClusterRecommendation[] = [
        {
          clusterId: 'cluster-1',
          exemplar: 'test query',
          queries: ['query1'],
          aiOverviewPresence: ['absent'],
          actions: [
            {
              type: 'expand_target_page',
              q: 'query1',
              outline: 'Expand with more content',
            },
          ],
        },
      ];
      const issues = identifyCannibalizationIssues(noCannibalRecommendations);
      expect(issues.length).toBe(0);
    });
  });

  describe('suggestContentPriorities', () => {
    it('should suggest priorities', () => {
      const priorities = suggestContentPriorities(mockRecommendations);
      expect(Array.isArray(priorities)).toBe(true);
      if (priorities.length > 0) {
        expect(priorities[0]).toHaveProperty('priority');
        expect(priorities[0]).toHaveProperty('action');
        expect(priorities[0]).toHaveProperty('queries');
        expect(priorities[0]).toHaveProperty('rationale');
      }
    });

    it('should prioritize cannibalization as high', () => {
      const priorities = suggestContentPriorities(mockRecommendations);
      const highPriority = priorities.find((p) => p.priority === 'high');
      expect(highPriority).toBeDefined();
      if (highPriority) {
        expect(highPriority.action).toContain('cannibalization');
      }
    });
  });
});
