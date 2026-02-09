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
    SerpAnalysis,
    SerpResult,
    AiRecommendation
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
 * Calculate expected CTR based on organic position
 * Based on industry benchmarks (AWR, Sistrix studies)
 */
function getExpectedCtr(position: number): number {
    if (position <= 0) return 0;
    if (position <= 1) return 0.27;  // Position 1: ~27%
    if (position <= 2) return 0.15;  // Position 2: ~15%
    if (position <= 3) return 0.10;  // Position 3: ~10%
    if (position <= 5) return 0.06;  // Position 4-5: ~6%
    if (position <= 10) return 0.03; // Position 6-10: ~3%
    if (position <= 20) return 0.01; // Position 11-20: ~1%
    return 0.005;                    // Position 20+: <0.5%
}

/**
 * Classify a row into an action bucket based on sophisticated rules
 * Uses position-relative CTR, ROAS efficiency, match type, and statistical significance
 */
export function classifyAction(row: Omit<MergedOpportunityRow, 'action' | 'opportunity_score'>): OpportunityAction {
    const {
        position_org, conversions_paid, cost_paid, clicks_org,
        ctr_org, impressions_org, impressions_paid, roas_paid, cpa_paid,
        matchType, impressionShare
    } = row;

    // Calculate CTR performance relative to expected
    const expectedCtr = getExpectedCtr(position_org);
    const ctrRatio = expectedCtr > 0 ? ctr_org / expectedCtr : 0;

    // Statistical significance checks
    const hasSignificantPaidData = impressions_paid >= 100 && cost_paid > 0;
    const hasSignificantOrgData = impressions_org >= 100;
    const hasConversions = conversions_paid >= 1;

    // ROAS efficiency thresholds
    const isPaidProfitable = roas_paid !== null && roas_paid >= 2;
    const isPaidHighlyProfitable = roas_paid !== null && roas_paid >= 4;
    const isPaidUnprofitable = roas_paid !== null && roas_paid < 2;

    // Match type checks (broad/phrase match with conversions = expansion opportunity)
    const isBroadOrPhrase = matchType === 'broad' || matchType === 'phrase' || matchType === 'near_exact';

    // Impression share checks (low share = scaling opportunity)
    const hasLowImpressionShare = impressionShare !== null && impressionShare !== undefined && impressionShare < 0.5;

    // --- NEW PRIORITY 0: Broad match with conversions = Add as Exact Match ---
    // This is a keyword expansion opportunity
    if (isBroadOrPhrase && hasConversions && isPaidProfitable && hasSignificantPaidData) {
        return 'Add Exact Match';
    }

    // --- NEW PRIORITY 0.5: High ROAS with low impression share = Scale opportunity ---
    if (isPaidHighlyProfitable && hasLowImpressionShare && hasSignificantPaidData) {
        return 'Scale Spend';
    }

    // --- PRIORITY 1: High-performing organic with inefficient paid ---
    // Top 3 organic with good CTR relative to position
    if (position_org > 0 && position_org <= 3 && ctrRatio >= 0.8 && hasSignificantPaidData) {
        if (isPaidUnprofitable) {
            return 'Pause PPC';
        }
        if (!isPaidHighlyProfitable) {
            return 'Reduce Spend';
        }
    }

    // --- PRIORITY 2: No organic presence but paid is converting ---
    // This is a clear SEO opportunity - proven demand with no organic capture
    if (position_org === 0 && hasConversions) {
        return 'SEO Focus';
    }

    // --- PRIORITY 3: Striking distance (11-20) with proven demand ---
    // These should be SEO focus, NOT PPC activation
    if (position_org > 10 && position_org <= 20 && hasConversions) {
        return 'SEO Focus';
    }

    // --- PRIORITY 4: Poor organic CTR relative to position ---
    // Suggests title/meta description issues, not a PPC solution
    if (position_org > 0 && position_org <= 10 && ctrRatio < 0.5 && hasSignificantOrgData) {
        return 'Investigate';
    }

    // --- PRIORITY 5: Low organic ranking (20+) with paid conversions ---
    // Long-term SEO play for proven converting terms
    if (position_org > 20 && hasConversions && isPaidProfitable) {
        return 'SEO Focus';
    }

    // --- PRIORITY 6: No organic, no paid, but have impression data ---
    // Opportunity to test with PPC
    if (position_org === 0 && cost_paid === 0 && impressions_paid > 50) {
        return 'Consider PPC';
    }

    // --- PRIORITY 7: Ranking 11-20 with no paid data ---
    // Striking distance - push with SEO, don't start PPC
    if (position_org > 10 && position_org <= 20 && cost_paid === 0) {
        return 'SEO Focus';
    }

    // --- PRIORITY 8: Good organic with no paid activity ---
    // Already winning organically, no action needed
    if (position_org > 0 && position_org <= 10 && ctrRatio >= 0.8 && cost_paid === 0) {
        return 'Monitor';
    }

    // --- PRIORITY 9: Moderate organic performance with paid activity ---
    // Could be opportunity to increase spend if profitable
    if (position_org > 3 && position_org <= 10 && isPaidHighlyProfitable && hasSignificantPaidData) {
        return 'Increase Spend (CTR)';
    }

    // --- PRIORITY 10: No organic clicks, no paid, minimal data ---
    if (clicks_org === 0 && cost_paid === 0 && impressions_org < 50) {
        return 'Consider PPC';
    }

    // Default: Monitor for everything else
    return 'Monitor';
}

/**
 * Compute the opportunity score for a row
 * Higher score = higher priority opportunity
 * 
 * Score Components:
 * 1. Efficiency Score (0-40): ROAS-based, higher ROAS = higher score
 * 2. Volume Score (0-30): Based on conversion value and impressions
 * 3. Position Opportunity (0-20): Lower/no position = more room to grow
 * 4. Action Priority Multiplier: Prioritizes actionable items
 */
export function computeOpportunityScore(row: Omit<MergedOpportunityRow, 'opportunity_score'>): number {
    const {
        cost_paid, impressions_paid, position_org, conversions_paid,
        conv_value_paid, roas_paid, impressions_org, clicks_org, action
    } = row;

    // --- 1. Efficiency Score (0-40) ---
    // ROAS-based: Higher ROAS = more efficient = higher opportunity for scaling
    let efficiencyScore = 0;
    if (roas_paid !== null && roas_paid > 0) {
        // ROAS 0-2 = low efficiency (0-10 points)
        // ROAS 2-4 = moderate efficiency (10-25 points)
        // ROAS 4+ = high efficiency (25-40 points)
        if (roas_paid >= 4) {
            efficiencyScore = Math.min(25 + (roas_paid - 4) * 3, 40);
        } else if (roas_paid >= 2) {
            efficiencyScore = 10 + (roas_paid - 2) * 7.5;
        } else {
            efficiencyScore = roas_paid * 5;
        }
    } else if (conversions_paid > 0 && cost_paid > 0) {
        // If no ROAS but has conversions, give partial credit
        efficiencyScore = Math.min(conversions_paid * 5, 20);
    }

    // --- 2. Volume Score (0-30) ---
    // Prioritize queries with proven value and volume
    let volumeScore = 0;

    // Conversion value contribution (0-15)
    if (conv_value_paid > 0) {
        volumeScore += Math.min(conv_value_paid / 100, 15);
    }

    // Impression volume contribution (0-10)
    const totalImpressions = impressions_paid + impressions_org;
    volumeScore += Math.min(totalImpressions / 500, 10);

    // Organic click contribution (0-5)
    volumeScore += Math.min(clicks_org / 20, 5);

    // --- 3. Position Opportunity Score (0-20) ---
    // No ranking = big opportunity (20)
    // Position 11-20 = striking distance (15)
    // Position 4-10 = moderate opportunity (10)
    // Position 1-3 = already winning (5)
    let positionScore = 0;
    if (position_org === 0) {
        positionScore = 20; // No organic presence = big opportunity
    } else if (position_org > 20) {
        positionScore = 18; // Very low ranking
    } else if (position_org > 10) {
        positionScore = 15; // Striking distance
    } else if (position_org > 3) {
        positionScore = 10; // Page 1 but not top 3
    } else {
        positionScore = 5;  // Already top 3
    }

    // --- 4. Action Priority Multiplier ---
    // Some actions are more impactful than others
    const actionMultipliers: Record<OpportunityAction, number> = {
        'Add Exact Match': 1.6,     // NEW: High priority keyword expansion
        'Scale Spend': 1.5,         // NEW: Proven ROI, capture more volume
        'SEO Focus': 1.5,           // High impact: proven converting terms need SEO
        'Pause PPC': 1.4,           // Quick win: stop wasting money
        'Reduce Spend': 1.3,        // Efficiency gain: reallocate budget
        'Investigate': 1.2,         // Needs attention: something's wrong
        'Increase Spend (CTR)': 1.1, // Growth opportunity
        'Activate PPC (Pos)': 1.0,   // Test opportunity
        'Consider PPC': 0.9,         // Speculative
        'Monitor': 0.6,              // Low priority: already optimized
    };
    const actionMultiplier = actionMultipliers[action] ?? 1;

    // --- Final Score Calculation ---
    const rawScore = efficiencyScore + volumeScore + positionScore;
    const finalScore = rawScore * actionMultiplier;

    // Return rounded to 2 decimal places, max 100
    return Math.min(Math.round(finalScore * 100) / 100, 100);
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
        const campaign = ads?.campaign;
        const adGroup = ads?.adGroup;

        // Extended paid metrics
        const matchType = ads?.matchType;
        const impressionShare = ads?.impressionShare ?? null;
        const budgetLostImpressionShare = ads?.budgetLostImpressionShare ?? null;
        const rankLostImpressionShare = ads?.rankLostImpressionShare ?? null;
        const conversionRate = ads?.conversionRate ?? 0;

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
            campaign,
            adGroup,
            // Extended metrics
            matchType,
            impressionShare,
            budgetLostImpressionShare,
            rankLostImpressionShare,
            conversionRate,
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
 * Extended with additional metrics for SEO/PPC experts
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
        'Add Exact Match': 0,
        'Scale Spend': 0,
    };

    let totalSpend = 0;
    let totalConversions = 0;
    let totalOrgClicks = 0;
    let totalPaidClicks = 0;
    let totalOrgImpressions = 0;
    let totalPaidImpressions = 0;
    let totalConvValue = 0;
    let wastedSpend = 0; // Spend on keywords where organic is top 3
    let seoOpportunityValue = 0; // Estimated value if SEO captures traffic (CPC × organic impressions for non-ranking)
    let roasSum = 0;
    let roasCount = 0;
    let cpaSum = 0;
    let cpaCount = 0;
    let impressionShareSum = 0;
    let impressionShareCount = 0;

    for (const row of data) {
        totalSpend += row.cost_paid;
        totalConversions += row.conversions_paid;
        totalOrgClicks += row.clicks_org;
        totalPaidClicks += row.clicks_paid;
        totalOrgImpressions += row.impressions_org;
        totalPaidImpressions += row.impressions_paid;
        totalConvValue += row.conv_value_paid;
        actionBreakdown[row.action]++;

        // Wasted spend: paying for keywords where organic is already top 3
        if (row.position_org > 0 && row.position_org <= 3 && row.cost_paid > 0) {
            wastedSpend += row.cost_paid;
        }

        // SEO opportunity: estimated value if organic captures this traffic
        // For keywords not ranking organically, estimate value as impressions × avg CPC
        if (row.position_org === 0 && row.impressions_paid > 0 && row.avg_cpc_paid > 0) {
            // Assume 5% CTR if ranking, value = impressions × 0.05 × CPC
            seoOpportunityValue += row.impressions_paid * 0.05 * row.avg_cpc_paid;
        } else if (row.position_org > 10 && row.impressions_paid > 0 && row.avg_cpc_paid > 0) {
            // For low rankings, estimate 3% capture improvement
            seoOpportunityValue += row.impressions_paid * 0.03 * row.avg_cpc_paid;
        }

        // ROAS aggregation
        if (row.roas_paid !== null && row.roas_paid > 0) {
            roasSum += row.roas_paid * row.cost_paid; // Weight by spend
            roasCount += row.cost_paid;
        }

        // CPA aggregation
        if (row.cpa_paid !== null && row.cpa_paid > 0 && row.conversions_paid > 0) {
            cpaSum += row.cost_paid;
            cpaCount += row.conversions_paid;
        }

        // Impression share aggregation
        if (row.impressionShare !== null && row.impressionShare !== undefined && row.impressionShare > 0) {
            impressionShareSum += row.impressionShare * row.impressions_paid; // Weight by impressions
            impressionShareCount += row.impressions_paid;
        }
    }

    const totalImpressions = totalOrgImpressions + totalPaidImpressions;
    const totalClicks = totalOrgClicks + totalPaidClicks;
    const blendedCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;

    // Count opportunities (non-Monitor actions)
    const opportunityCount = data.filter(r => r.action !== 'Monitor').length;

    // Calculate weighted averages
    const avgRoas = roasCount > 0 ? roasSum / roasCount : null;
    const avgCpa = cpaCount > 0 ? cpaSum / cpaCount : null;
    const avgImpressionShare = impressionShareCount > 0 ? impressionShareSum / impressionShareCount : null;

    return {
        totalSpend,
        totalConversions,
        totalOrgClicks,
        totalPaidClicks,
        blendedCtr,
        opportunityCount,
        actionBreakdown,
        // New metrics
        totalConvValue,
        wastedSpend,
        seoOpportunityValue,
        avgRoas,
        avgCpa,
        avgImpressionShare,
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

            // Determine match type randomly for mock data
            const matchTypes = ['exact', 'phrase', 'broad'] as const;
            const matchType = matchTypes[Math.floor(Math.random() * matchTypes.length)] ?? 'exact';

            // Mock impression share (some will be null to simulate missing data)
            const impressionShare = Math.random() > 0.3 ? Math.random() * 0.8 + 0.2 : null;

            adsData.push({
                searchTerm: query,
                impressions,
                clicks,
                ctr,
                costMicros,
                averageCpc,
                conversions,
                conversionValue,
                campaign: Math.random() > 0.5 ? 'Brand Campaign' : 'Generic Campaign',
                adGroup: Math.random() > 0.5 ? 'Exact Match' : 'Broad Match',
                // Extended metrics
                matchType: matchType as string,
                impressionShare,
                budgetLostImpressionShare: impressionShare !== null ? Math.random() * 0.3 : null,
                rankLostImpressionShare: impressionShare !== null ? Math.random() * 0.2 : null,
                conversionRate,
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
        'Add Exact Match': '#06b6d4',  // Cyan - NEW
        'Scale Spend': '#22c55e',      // Lime Green - NEW
        'SEO Focus': '#10b981',        // Green
        'Activate PPC (Pos)': '#3b82f6', // Blue
        'Consider PPC': '#6366f1',      // Indigo
        'Investigate': '#f59e0b',       // Amber
        'Increase Spend (CTR)': '#8b5cf6', // Purple
        'Reduce Spend': '#ef4444',      // Red
        'Pause PPC': '#ec4899',         // Pink
        'Monitor': '#cbd5e1',           // Light Gray
    };
    return colors[action];
}

/**
 * Generate mock SERP analysis data with action-specific recommendations
 */
export function generateMockSerpAnalysis(query: string, action?: OpportunityAction): SerpAnalysis {
    const competitors = [
        "amazon.co.uk",
        "sportsshoes.com",
        "runnersworld.com",
        "nike.com",
        "adidas.co.uk",
        "decathlon.co.uk"
    ];

    const serpFeatures = [
        "Featured Snippet",
        "People Also Ask",
        "Local Pack",
        "Shopping Ads",
        "Video Carousel"
    ];

    // Randomize results
    const results: SerpResult[] = Array.from({ length: 10 }, (_, i) => {
        const domain = competitors[Math.floor(Math.random() * competitors.length)];
        return {
            rank: i + 1,
            title: `Best ${query} Deals & Reviews 2024 - ${domain}`,
            url: `https://www.${domain}/${query.replace(/\s+/g, '-')}`,
            snippet: `Looking for ${query}? Find the best selection at ${domain}. Free delivery on orders over £50. Read our expert reviews and buying guide.`,
            domain: domain || "example.com"
        };
    });

    // Generate paid results
    const paidCompetitors = [
        "amazon.co.uk", "sportsshoes.com", "nike.com", "run4it.com", "wiggle.com"
    ];

    const paidResults: SerpResult[] = Array.from({ length: Math.floor(Math.random() * 4) + 1 }, (_, i) => {
        const domain = paidCompetitors[Math.floor(Math.random() * paidCompetitors.length)];
        return {
            rank: i + 1,
            title: `Buy ${query} - Official Site`,
            url: `https://www.${domain}/ad/${query.replace(/\s+/g, '-')}`,
            snippet: `Shop the latest ${query} at ${domain}. Free Delivery & Returns.`,
            domain: domain || "example.com"
        };
    });

    // Action-specific recommendations - more relevant and detailed
    const actionRecommendations: Record<OpportunityAction, AiRecommendation[]> = {
        'Pause PPC': [
            {
                action: "Pause PPC Ads Immediately",
                reasoning: "You already rank #1-3 organically for this keyword. The organic listing will capture this traffic for free, saving your PPC budget.",
                impact: "High - Save 100% of current spend on this keyword",
                difficulty: "Low"
            },
            {
                action: "Reduce to Branded Bidding Only",
                reasoning: "Consider keeping a minimal bid only for brand defense. Organic ranks highly, but competitors may bid on your brand terms.",
                impact: "Medium - Save 80%+ of current keyword spend",
                difficulty: "Low"
            }
        ],
        'Reduce Spend': [
            {
                action: "Lower Bids by 30-40%",
                reasoning: "Organic ranking is strong enough to capture spillover traffic. Reduce paid investment while monitoring organic performance.",
                impact: "Medium - Reduce cost by 30-40% with minimal traffic loss",
                difficulty: "Low"
            },
            {
                action: "Set Bid Modifier for High Positions",
                reasoning: "Apply a negative bid modifier when organic rank is in top positions. This reduces cannibalization.",
                impact: "Medium - Better budget allocation across keywords",
                difficulty: "Medium"
            }
        ],
        'SEO Focus': [
            {
                action: "Create Dedicated Landing Page",
                reasoning: "High paid performance indicates commercial intent. Create an SEO-optimized page specifically targeting this query to capture traffic organically.",
                impact: "High - Could reach top 3 in 3-6 months, reducing paid dependency",
                difficulty: "Medium"
            },
            {
                action: "Build Topical Authority",
                reasoning: "Create supporting content cluster around this keyword theme. This signals expertise to Google and improves ranking potential.",
                impact: "High - Long-term organic growth",
                difficulty: "High"
            }
        ],
        'Scale Spend': [
            {
                action: "Increase Daily Budget by 50%",
                reasoning: "ROAS is excellent but impression share is low. Competitors are capturing the traffic you're missing. Scale to maximum profitable volume.",
                impact: "High - Estimated +50% more conversions at current ROAS",
                difficulty: "Low"
            },
            {
                action: "Raise Bids for Top Positions",
                reasoning: "Increase bids to improve ad rank and capture more impression share. Current ROAS supports higher CPCs.",
                impact: "High - Higher visibility, maintain profitability",
                difficulty: "Low"
            }
        ],
        'Add Exact Match': [
            {
                action: "Add as [Exact Match] Keyword",
                reasoning: "This broad/phrase term is converting well. Adding as exact match gives you more control over bids and increases quality score.",
                impact: "High - Expected 10-20% ROAS improvement",
                difficulty: "Low"
            },
            {
                action: "Create SKAGs (Single Keyword Ad Groups)",
                reasoning: "Create a dedicated ad group with tailored ad copy for this high-performing search term. This improves Quality Score and CTR.",
                impact: "Medium - Better ad relevance, lower CPCs",
                difficulty: "Medium"
            }
        ],
        'Activate PPC (Pos)': [
            {
                action: "Launch Targeted PPC Campaign",
                reasoning: "Organic rank is page 1 but not top 3. PPC can capture additional traffic that's going to top-3 competitors.",
                impact: "High - Capture 20-30% more clicks with blended approach",
                difficulty: "Low"
            },
            {
                action: "Test Shopping Ads",
                reasoning: "If this is a product keyword, Shopping ads often have lower CPCs and higher intent than text ads.",
                impact: "Medium - Often more cost-effective than search ads",
                difficulty: "Medium"
            }
        ],
        'Consider PPC': [
            {
                action: "Run Test Campaign (2 Weeks)",
                reasoning: "Organic data shows traffic potential. Test PPC to validate conversion rate and CPA before scaling.",
                impact: "Medium - Validate opportunity before major investment",
                difficulty: "Low"
            }
        ],
        'Investigate': [
            {
                action: "Analyze Landing Page Performance",
                reasoning: "Metrics are inconsistent. Check landing page experience, bounce rate, and conversion funnel for issues.",
                impact: "Variable - Depends on what you find",
                difficulty: "Medium"
            },
            {
                action: "Review Search Terms Report",
                reasoning: "This keyword may be triggering for irrelevant queries. Add negative keywords to improve targeting.",
                impact: "Medium - Cleaner traffic, better ROAS",
                difficulty: "Low"
            }
        ],
        'Increase Spend (CTR)': [
            {
                action: "Improve Ad Copy & Extensions",
                reasoning: "CTR is below benchmark for this position. Test new headlines with USPs, pricing, and urgency.",
                impact: "Medium - CTR improvement of 0.5-1%",
                difficulty: "Low"
            },
            {
                action: "Add All Relevant Ad Extensions",
                reasoning: "Ensure sitelinks, callouts, structured snippets, and price extensions are active. These increase ad real estate.",
                impact: "Medium - Higher CTR and Quality Score",
                difficulty: "Low"
            }
        ],
        'Monitor': [
            {
                action: "Continue Current Strategy",
                reasoning: "Metrics are stable and within acceptable range. No immediate action needed, but review monthly.",
                impact: "Low - Maintain status quo",
                difficulty: "Low"
            }
        ]
    };

    // Get recommendations based on action, or fallback to generic
    const applicableRecommendations = action && actionRecommendations[action]
        ? actionRecommendations[action]
        : [
            {
                action: "Comprehensive Audit Required",
                reasoning: "Multiple factors need consideration. Review organic rankings, paid performance, and competitive landscape together.",
                impact: "Variable - Depends on findings",
                difficulty: "Medium"
            }
        ];

    const fallbackRecommendation: AiRecommendation = {
        action: "Comprehensive Audit Required",
        reasoning: "Multiple factors need consideration. Review organic rankings, paid performance, and competitive landscape together.",
        impact: "Variable - Depends on findings",
        difficulty: "Medium"
    };

    const selectedRecommendation: AiRecommendation = (applicableRecommendations.length > 0
        ? applicableRecommendations[Math.floor(Math.random() * applicableRecommendations.length)]
        : fallbackRecommendation) as AiRecommendation;

    return {
        query,
        difficulty: Math.floor(Math.random() * 100),
        searchVolume: Math.floor(Math.random() * 10000),
        intent: Math.random() > 0.6 ? "Transactional" : (Math.random() > 0.3 ? "Commercial" : "Informational"),
        topResults: results,
        paidResults: paidResults,
        serpFeatures: serpFeatures.filter(() => Math.random() > 0.5),
        aiRecommendation: selectedRecommendation,
        action
    };
}
