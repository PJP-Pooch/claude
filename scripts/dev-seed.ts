/**
 * Development seed script for testing clustering and bucketing logic
 * Run with: npx tsx scripts/dev-seed.ts
 */

import { clusterBySerpSimilarity, getClusterStats } from '../lib/cluster';
import { getActionSummary, getAIOverviewStats } from '../lib/bucketing';
import { SerpResult, ClusterRecommendation } from '../lib/types';

// Mock SERP data for testing
const mockSerpData: SerpResult[] = [
  {
    q: 'best seo tools',
    top10: [
      { position: 1, url: 'https://ahrefs.com/blog/seo-tools', title: 'Best SEO Tools' },
      { position: 2, url: 'https://moz.com/blog/seo-software', title: 'SEO Software' },
      { position: 3, url: 'https://semrush.com/blog/tools', title: 'SEO Tools List' },
      { position: 4, url: 'https://example.com/seo-tools-guide', title: 'SEO Tools Guide' },
      { position: 5, url: 'https://backlinko.com/seo-tools', title: 'SEO Tools' },
      { position: 6, url: 'https://neilpatel.com/seo-tools', title: 'SEO Tools' },
      { position: 7, url: 'https://searchenginejournal.com/seo-tools', title: 'Tools' },
      { position: 8, url: 'https://hubspot.com/seo', title: 'SEO Tools' },
      { position: 9, url: 'https://wordstream.com/seo', title: 'SEO Tools' },
      { position: 10, url: 'https://serpstat.com/blog', title: 'SEO Tools' },
    ],
    aiOverview: 'present',
    targetPageOnPage1: true,
    sameDomainOnPage1: true,
    firstMatch: { position: 4, url: 'https://example.com/seo-tools-guide' },
  },
  {
    q: 'top seo software',
    top10: [
      { position: 1, url: 'https://ahrefs.com/blog/seo-tools', title: 'Best SEO Tools' },
      { position: 2, url: 'https://moz.com/blog/seo-software', title: 'SEO Software' },
      { position: 3, url: 'https://semrush.com/blog/tools', title: 'SEO Tools List' },
      { position: 4, url: 'https://backlinko.com/seo-tools', title: 'SEO Tools' },
      { position: 5, url: 'https://neilpatel.com/seo-tools', title: 'SEO Tools' },
      { position: 6, url: 'https://searchenginejournal.com/seo-tools', title: 'Tools' },
      { position: 7, url: 'https://hubspot.com/seo', title: 'SEO Tools' },
      { position: 8, url: 'https://wordstream.com/seo', title: 'SEO Tools' },
      { position: 9, url: 'https://example.com/comparison', title: 'SEO Comparison' },
      { position: 10, url: 'https://serpstat.com/blog', title: 'SEO Tools' },
    ],
    aiOverview: 'present',
    targetPageOnPage1: false,
    sameDomainOnPage1: true,
    firstMatch: { position: 9, url: 'https://example.com/comparison' },
  },
  {
    q: 'seo audit tools',
    top10: [
      { position: 1, url: 'https://screaming-frog.com', title: 'Screaming Frog' },
      { position: 2, url: 'https://sitebulb.com', title: 'Sitebulb' },
      { position: 3, url: 'https://ahrefs.com/site-audit', title: 'Site Audit' },
      { position: 4, url: 'https://semrush.com/site-audit', title: 'Site Audit' },
      { position: 5, url: 'https://moz.com/pro/site-crawl', title: 'Site Crawl' },
      { position: 6, url: 'https://deepcrawl.com', title: 'DeepCrawl' },
      { position: 7, url: 'https://botify.com', title: 'Botify' },
      { position: 8, url: 'https://oncrawl.com', title: 'OnCrawl' },
      { position: 9, url: 'https://raven-tools.com', title: 'Raven Tools' },
      { position: 10, url: 'https://woorank.com', title: 'WooRank' },
    ],
    aiOverview: 'absent',
    targetPageOnPage1: false,
    sameDomainOnPage1: false,
  },
  {
    q: 'free seo tools',
    top10: [
      { position: 1, url: 'https://ahrefs.com/free-seo-tools', title: 'Free SEO Tools' },
      { position: 2, url: 'https://moz.com/free-seo-tools', title: 'Free Tools' },
      { position: 3, url: 'https://neilpatel.com/ubersuggest', title: 'Ubersuggest' },
      { position: 4, url: 'https://google.com/search-console', title: 'Search Console' },
      { position: 5, url: 'https://analytics.google.com', title: 'Google Analytics' },
      { position: 6, url: 'https://answerthepublic.com', title: 'Answer The Public' },
      { position: 7, url: 'https://keywordtool.io', title: 'Keyword Tool' },
      { position: 8, url: 'https://example.com/free-tools', title: 'Free SEO Tools' },
      { position: 9, url: 'https://smallseotools.com', title: 'Small SEO Tools' },
      { position: 10, url: 'https://seoreviewtools.com', title: 'SEO Review Tools' },
    ],
    aiOverview: 'present',
    targetPageOnPage1: false,
    sameDomainOnPage1: true,
    firstMatch: { position: 8, url: 'https://example.com/free-tools' },
  },
];

// Mock recommendations for testing
const mockRecommendations: ClusterRecommendation[] = [
  {
    clusterId: 'cluster-1',
    exemplar: 'best seo tools',
    queries: ['best seo tools', 'top seo software'],
    aiOverviewPresence: ['present', 'present'],
    actions: [
      {
        type: 'great_target_page_ranking',
        q: 'best seo tools',
        details: 'Target page ranks at position 4 for this query.',
      },
      {
        type: 'cannibalisation',
        q: 'top seo software',
        otherUrl: 'https://example.com/comparison',
        recommendedFix: 'Another page (https://example.com/comparison) ranks at position 9 for a query in the same cluster. Consider consolidating content or adjusting internal linking.',
      },
    ],
  },
  {
    clusterId: 'cluster-2',
    exemplar: 'seo audit tools',
    queries: ['seo audit tools'],
    aiOverviewPresence: ['absent'],
    actions: [
      {
        type: 'new_page',
        q: 'seo audit tools',
        pageBrief: `# SEO Audit Tools Page Brief

## Recommended Structure

### H2: What Are SEO Audit Tools?
- Definition and purpose
- Benefits of regular audits

### H2: Top SEO Audit Tools
- Screaming Frog
- Sitebulb
- Ahrefs Site Audit
- SEMrush Site Audit

### H2: How to Choose an Audit Tool
- Features comparison
- Pricing
- Use cases

### FAQs
- How often should I run an SEO audit?
- Can I audit my site for free?
- What metrics matter most?

### Schema Markup
- Article schema
- FAQ schema
- Breadcrumb schema`,
      },
    ],
  },
  {
    clusterId: 'cluster-3',
    exemplar: 'free seo tools',
    queries: ['free seo tools'],
    aiOverviewPresence: ['present'],
    actions: [
      {
        type: 'ok_other_page_diff_cluster',
        q: 'free seo tools',
        otherUrl: 'https://example.com/free-tools',
        details: 'Another page (https://example.com/free-tools) ranks at position 8. Clustering suggests this is a different topic (free vs paid), so keeping separate pages is appropriate.',
      },
    ],
  },
];

function runDemo() {
  console.log('='.repeat(80));
  console.log('SERP QUERY CLUSTERING - DEVELOPMENT SEED DEMO');
  console.log('='.repeat(80));
  console.log('');

  // Clustering Demo
  console.log('1. CLUSTERING DEMO');
  console.log('-'.repeat(80));
  const threshold = 4;
  console.log(`Clustering ${mockSerpData.length} queries with overlap threshold: ${threshold}`);
  console.log('');

  const clusters = clusterBySerpSimilarity(mockSerpData, threshold);

  console.log(`Created ${clusters.length} clusters:`);
  clusters.forEach((cluster) => {
    const stats = getClusterStats(cluster);
    console.log('');
    console.log(`  ${cluster.id}:`);
    console.log(`    Exemplar: ${cluster.exemplar}`);
    console.log(`    Queries: ${cluster.queries.join(', ')}`);
    console.log(`    Size: ${stats.size}`);
    console.log(`    Avg Overlap: ${stats.avgOverlap.toFixed(2)}`);
    console.log(`    Min/Max Overlap: ${stats.minOverlap}/${stats.maxOverlap}`);
  });

  console.log('');
  console.log('');

  // Action Summary Demo
  console.log('2. ACTION SUMMARY DEMO');
  console.log('-'.repeat(80));
  const actionSummary = getActionSummary(mockRecommendations);
  console.log('Action Distribution:');
  console.log(`  ✅ Great (target page ranks): ${actionSummary.great_target_page_ranking}`);
  console.log(`  ✅ OK (different topic): ${actionSummary.ok_other_page_diff_cluster}`);
  console.log(`  ⚠️  Cannibalization: ${actionSummary.cannibalisation}`);
  console.log(`  ➕ Expand target page: ${actionSummary.expand_target_page}`);
  console.log(`  🆕 Create new page: ${actionSummary.new_page}`);
  console.log('');
  console.log('');

  // AI Overview Stats Demo
  console.log('3. AI OVERVIEW STATS DEMO');
  console.log('-'.repeat(80));
  const aiStats = getAIOverviewStats(mockRecommendations);
  console.log('AI Overview Presence:');
  console.log(`  Present: ${aiStats.present} (${aiStats.percentagePresent.toFixed(1)}%)`);
  console.log(`  Absent: ${aiStats.absent}`);
  console.log(`  Unknown: ${aiStats.unknown}`);
  console.log('');
  console.log('');

  // Recommendations Detail Demo
  console.log('4. RECOMMENDATIONS DETAIL DEMO');
  console.log('-'.repeat(80));
  mockRecommendations.forEach((rec) => {
    console.log('');
    console.log(`${rec.clusterId} - ${rec.exemplar}`);
    console.log(`  Queries: ${rec.queries.join(', ')}`);
    console.log(`  Actions:`);
    rec.actions.forEach((action, idx) => {
      const icon = action.type === 'great_target_page_ranking' ? '✅' :
                   action.type === 'ok_other_page_diff_cluster' ? '✅' :
                   action.type === 'cannibalisation' ? '⚠️' :
                   action.type === 'expand_target_page' ? '➕' : '🆕';
      console.log(`    ${icon} [${action.type}] ${action.q}`);
      if (action.type === 'great_target_page_ranking') {
        console.log(`       ${action.details}`);
      } else if (action.type === 'cannibalisation') {
        console.log(`       ${action.recommendedFix}`);
      } else if (action.type === 'ok_other_page_diff_cluster') {
        console.log(`       ${action.details}`);
      }
    });
  });

  console.log('');
  console.log('='.repeat(80));
  console.log('DEMO COMPLETE');
  console.log('='.repeat(80));
}

// Run if executed directly
if (require.main === module) {
  runDemo();
}

export { mockSerpData, mockRecommendations, runDemo };
