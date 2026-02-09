/**
 * Utility functions for SEO/PPC Opportunity Finder
 * Data processing, KPI calculations, and action classification
 */

import {
    GscQueryRow,
    AdsSearchTermRow,
    MergedOpportunityRow,
    OpportunityAction,
    OpportunitySummary,
    ActionChartData,
    ScatterPlotPoint,
    ScoreDistribution,
} from './opportunity-types';

/**
 * Normalize a query string for matching
 * - Lowercase
 * - Trim whitespace
 * - Collapse multiple spaces
 * - Remove leading/trailing punctuation
 */
export function normalizeQuery(query: string): string {
    return query
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/^[^\w\s]+|[^\w\s]+$/g, '');
}

/**
 * Convert Google Ads cost from micros to actual currency
 */
export function microsToAmount(micros: number): number {
    return micros / 1_000_000;
}

/**
 * Safely divide, returning null if divisor is 0
 */
function safeDivide(numerator: number, denominator: number): number | null {
    if (denominator === 0) return null;
    return numerator / denominator;
}

/**
 * Classify a row into an action bucket based on the defined rules
 * First match wins
 */
export function classifyAction(row: Omit<MergedOpportunityRow, 'action' | 'opportunity_score'>): OpportunityAction {
    const { position_org, conversions_paid, cost_paid, clicks_org, ctr_org, ctr_paid, avg_cpc_paid } = row;

    // Rule 1: No organic presence but converting in paid
    if (position_org === 0 && conversions_paid >= 1) {
        return 'SEO Focus';
    }

    // Rule 2: Low organic ranking but converting in paid
    if (position_org > 10 && conversions_paid >= 1) {
        return 'SEO Focus';
    }

    // Rule 3: Low organic ranking and no paid spend
    if (position_org > 10 && cost_paid === 0) {
        return 'Activate PPC (Pos)';
    }

    // Rule 4: No organic clicks and no paid spend
    if (clicks_org === 0 && cost_paid === 0) {
        return 'Consider PPC';
    }

    // Rule 5: Very low combined CTR
    if ((ctr_org + ctr_paid) < 0.05) {
        return 'Investigate';
    }

    // Rule 6: Low organic CTR and no paid spend
    if (ctr_org < 0.02 && cost_paid === 0) {
        return 'Increase Spend (CTR)';
    }

    // Rule 7: Top organic position but high CPC
    if (position_org < 3 && position_org > 0 && avg_cpc_paid > 2) {
        return 'Reduce Spend';
    }

    // Rule 8: Top organic position with good CTR
    if (position_org < 3 && position_org > 0 && ctr_org > 0.03) {
        return 'Pause PPC';
    }

    // Default
    return 'Monitor';
}

/**
 * Compute the opportunity score for a row
 * Higher score = higher priority opportunity
 */
export function computeOpportunityScore(row: Omit<MergedOpportunityRow, 'opportunity_score'>): number {
    const { cost_paid, impressions_paid, position_org, conversions_paid, cpa_paid } = row;

    // Clamp position_org to 20 if 0 (no ranking)
    const positionClamped = position_org === 0 ? 20 : position_org;

    // Position multiplier: lower position = higher opportunity
    const positionMultiplier = 10 / positionClamped;

    // CPA penalty (treat null as 0)
    const cpaPenalty = (cpa_paid ?? 0) * 10;

    const score =
        cost_paid +
        (impressions_paid * positionMultiplier) +
        (conversions_paid * 50) -
        cpaPenalty;

    return Math.round(score * 100) / 100;
}

/**
 * Merge GSC and Google Ads data on normalized query
 */
export function mergeDatasets(
    gscData: GscQueryRow[],
    adsData: AdsSearchTermRow[]
): MergedOpportunityRow[] {
    // Create maps keyed by normalized query
    const gscMap = new Map<string, GscQueryRow>();
    const adsMap = new Map<string, AdsSearchTermRow>();

    for (const row of gscData) {
        const key = normalizeQuery(row.query);
        if (key) {
            // If duplicate, keep the one with more clicks
            const existing = gscMap.get(key);
            if (!existing || row.clicks > existing.clicks) {
                gscMap.set(key, row);
            }
        }
    }

    for (const row of adsData) {
        const key = normalizeQuery(row.searchTerm);
        if (key) {
            // If duplicate, keep the one with more cost
            const existing = adsMap.get(key);
            if (!existing || row.costMicros > existing.costMicros) {
                adsMap.set(key, row);
            }
        }
    }

    // Get all unique queries
    const allQueries = new Set([...gscMap.keys(), ...adsMap.keys()]);

    const merged: MergedOpportunityRow[] = [];

    for (const query of allQueries) {
        const gsc = gscMap.get(query);
        const ads = adsMap.get(query);

        // Organic metrics
        const clicks_org = gsc?.clicks ?? 0;
        const impressions_org = gsc?.impressions ?? 0;
        const ctr_org = gsc?.ctr ?? 0;
        const position_org = gsc?.position ?? 0;

        // Paid metrics
        const clicks_paid = ads?.clicks ?? 0;
        const impressions_paid = ads?.impressions ?? 0;
        const ctr_paid = ads?.ctr ?? 0;
        const cost_paid = ads ? microsToAmount(ads.costMicros) : 0;
        const avg_cpc_paid = ads?.averageCpc ?? 0;
        const conversions_paid = ads?.conversions ?? 0;
        const conv_value_paid = ads?.conversionValue ?? 0;

        // Calculated metrics
        const cpa_paid = safeDivide(cost_paid, conversions_paid);
        const roas_paid = safeDivide(conv_value_paid, cost_paid);
        const ctr_diff = ctr_paid - ctr_org;
        const cost_per_org_click = safeDivide(cost_paid, clicks_org);

        // SEO opportunity score: impressions where organic clicks are low
        const seo_opportunity_score = clicks_org < 5 ? impressions_paid : 0;

        // PPC spend reduction potential
        const ppc_spend_reduction_potential =
            (clicks_org >= 10 && avg_cpc_paid >= 1)
                ? clicks_org * avg_cpc_paid
                : 0;

        // Build partial row for classification
        const partialRow = {
            query,
            clicks_org,
            impressions_org,
            ctr_org,
            position_org,
            clicks_paid,
            impressions_paid,
            ctr_paid,
            cost_paid,
            avg_cpc_paid,
            conversions_paid,
            conv_value_paid,
            cpa_paid,
            roas_paid,
            ctr_diff,
            cost_per_org_click,
            seo_opportunity_score,
            ppc_spend_reduction_potential,
            hasOrganic: !!gsc,
            hasPaid: !!ads,
        };

        // Classify and score
        const action = classifyAction(partialRow);
        const opportunity_score = computeOpportunityScore({ ...partialRow, action });

        merged.push({
            ...partialRow,
            action,
            opportunity_score,
        });
    }

    // Sort by opportunity score descending
    merged.sort((a, b) => b.opportunity_score - a.opportunity_score);

    return merged;
}

/**
 * Calculate summary KPIs from merged data
 */
export function calculateSummary(data: MergedOpportunityRow[]): OpportunitySummary {
    const actionBreakdown: Record<OpportunityAction, number> = {
        'SEO Focus': 0,
        'Activate PPC (Pos)': 0,
        'Consider PPC': 0,
        'Investigate': 0,
        'Increase Spend (CTR)': 0,
        'Reduce Spend': 0,
        'Pause PPC': 0,
        'Monitor': 0,
    };

    let totalSpend = 0;
    let totalConversions = 0;
    let totalOrgClicks = 0;
    let totalPaidClicks = 0;
    let totalOrgImpressions = 0;
    let totalPaidImpressions = 0;

    for (const row of data) {
        totalSpend += row.cost_paid;
        totalConversions += row.conversions_paid;
        totalOrgClicks += row.clicks_org;
        totalPaidClicks += row.clicks_paid;
        totalOrgImpressions += row.impressions_org;
        totalPaidImpressions += row.impressions_paid;
        actionBreakdown[row.action]++;
    }

    const totalImpressions = totalOrgImpressions + totalPaidImpressions;
    const totalClicks = totalOrgClicks + totalPaidClicks;
    const blendedCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;

    // Count opportunities (non-Monitor actions)
    const opportunityCount = data.filter(r => r.action !== 'Monitor').length;

    return {
        totalSpend,
        totalConversions,
        totalOrgClicks,
        totalPaidClicks,
        blendedCtr,
        opportunityCount,
        actionBreakdown,
    };
}

/**
 * Prepare data for action breakdown chart
 */
export function prepareActionChartData(data: MergedOpportunityRow[]): ActionChartData[] {
    const actionMap = new Map<OpportunityAction, { cost_paid: number; clicks_org: number; count: number }>();

    for (const row of data) {
        const existing = actionMap.get(row.action) ?? { cost_paid: 0, clicks_org: 0, count: 0 };
        actionMap.set(row.action, {
            cost_paid: existing.cost_paid + row.cost_paid,
            clicks_org: existing.clicks_org + row.clicks_org,
            count: existing.count + 1,
        });
    }

    return Array.from(actionMap.entries()).map(([action, metrics]) => ({
        action,
        ...metrics,
    }));
}

/**
 * Prepare data for scatter plot
 */
export function prepareScatterData(data: MergedOpportunityRow[], limit = 200): ScatterPlotPoint[] {
    return data.slice(0, limit).map(row => ({
        query: row.query,
        position_org: row.position_org,
        cost_paid: row.cost_paid,
        conversions_paid: row.conversions_paid,
        action: row.action,
    }));
}

/**
 * Prepare data for opportunity score distribution
 */
export function prepareScoreDistribution(data: MergedOpportunityRow[]): ScoreDistribution[] {
    const buckets: ScoreDistribution[] = [
        { bucket: '0-100', count: 0, minScore: 0, maxScore: 100 },
        { bucket: '100-500', count: 0, minScore: 100, maxScore: 500 },
        { bucket: '500-1K', count: 0, minScore: 500, maxScore: 1000 },
        { bucket: '1K-5K', count: 0, minScore: 1000, maxScore: 5000 },
        { bucket: '5K-10K', count: 0, minScore: 5000, maxScore: 10000 },
        { bucket: '10K+', count: 0, minScore: 10000, maxScore: Infinity },
    ];

    for (const row of data) {
        const score = row.opportunity_score;
        for (const bucket of buckets) {
            if (score >= bucket.minScore && score < bucket.maxScore) {
                bucket.count++;
                break;
            }
        }
    }

    return buckets.filter(b => b.count > 0);
}

/**
 * Generate mock data for testing
 */
export function generateMockData(): { gscData: GscQueryRow[]; adsData: AdsSearchTermRow[] } {
    const baseQueries = [
        'buy running shoes online',
        'best running shoes 2024',
        'nike running shoes',
        'adidas running shoes sale',
        'running shoes for beginners',
        'marathon training shoes',
        'trail running shoes',
        'lightweight running shoes',
        'running shoes with arch support',
        'cheap running shoes',
        'running shoes near me',
        'womens running shoes',
        'mens running shoes',
        'running shoe reviews',
        'how to choose running shoes',
    ];

    // Expand to ~100 queries
    const queries: string[] = [];
    for (const base of baseQueries) {
        queries.push(base);
        queries.push(`${base} uk`);
        queries.push(`${base} cheap`);
        queries.push(`best ${base}`);
        queries.push(`${base} for flat feet`);
        queries.push(`${base} review`);
    }

    const gscData: GscQueryRow[] = [];
    const adsData: AdsSearchTermRow[] = [];

    for (const query of queries) {
        const hasOrganic = Math.random() > 0.2;
        const hasPaid = Math.random() > 0.3;

        if (hasOrganic) {
            const impressions = Math.floor(Math.random() * 10000) + 100;
            const ctr = Math.random() * 0.1;
            const clicks = Math.floor(impressions * ctr);
            const position = Math.random() * 50 + 1;

            gscData.push({
                query,
                impressions,
                clicks,
                ctr,
                position,
            });
        }

        if (hasPaid) {
            const impressions = Math.floor(Math.random() * 5000) + 50;
            const ctr = Math.random() * 0.08;
            const clicks = Math.floor(impressions * ctr);
            const averageCpc = Math.random() * 3 + 0.5;
            const costMicros = Math.floor(clicks * averageCpc * 1_000_000);
            const conversionRate = Math.random() * 0.1;
            const conversions = Math.floor(clicks * conversionRate);
            const conversionValue = conversions * (Math.random() * 100 + 20);

            adsData.push({
                searchTerm: query,
                impressions,
                clicks,
                ctr,
                costMicros,
                averageCpc,
                conversions,
                conversionValue,
            });
        }
    }

    return { gscData, adsData };
}

/**
 * Format currency value
 */
export function formatCurrency(value: number, currency = 'GBP'): string {
    return new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
}

/**
 * Format percentage
 */
export function formatPercent(value: number): string {
    return `${(value * 100).toFixed(2)}%`;
}

/**
 * Format large numbers with K/M suffix
 */
export function formatNumber(value: number): string {
    if (value >= 1_000_000) {
        return `${(value / 1_000_000).toFixed(1)}M`;
    }
    if (value >= 1_000) {
        return `${(value / 1_000).toFixed(1)}K`;
    }
    return value.toFixed(0);
}

/**
 * Get action color for charts/badges
 */
export function getActionColor(action: OpportunityAction): string {
    const colors: Record<OpportunityAction, string> = {
        'SEO Focus': '#10b981',        // Green
        'Activate PPC (Pos)': '#3b82f6', // Blue
        'Consider PPC': '#6366f1',      // Indigo
        'Investigate': '#f59e0b',       // Amber
        'Increase Spend (CTR)': '#8b5cf6', // Purple
        'Reduce Spend': '#ef4444',      // Red
        'Pause PPC': '#ec4899',         // Pink
        'Monitor': '#6b7280',           // Gray
    };
    return colors[action];
}
