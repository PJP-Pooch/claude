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
    AiRecommendation,
    KeywordMetricsRow,
    StrategicTier,
    CampaignReportRow
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
 * Normalize campaign name for robust matching (handles slight variations in CSV exports)
 */
export function normalizeCampaignName(name: string): string {
    if (!name) return '';
    return name.toLowerCase().trim().replace(/\s+/g, ' ');
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
 * Check if a query is likely a brand term
 * Simple check: contains the brand name (case insensitive)
 */
export function isBrandTerm(query: string, brandTerms: string[]): boolean {
    if (!brandTerms.length) return false;
    const lowerQuery = query.toLowerCase();
    return brandTerms.some(term => lowerQuery.includes(term.toLowerCase()));
}

/**
 * Classify a query into a strategic tier based on intent and brand status
 */
export function classifyStrategicTier(query: string, isBrand: boolean): StrategicTier {
    if (isBrand) return 'Brand Core';

    const highIntentKeywords = ['buy', 'sale', 'price', 'cheap', 'best', 'review', 'vs', 'comparison', 'discount', 'shop'];
    const midFunnelKeywords = ['alternative', 'how to', 'guide', 'tutorial', 'ingredients', 'benefits', 'features'];

    const lowerQuery = query.toLowerCase();

    if (highIntentKeywords.some(k => lowerQuery.includes(k))) return 'High Intent';
    if (midFunnelKeywords.some(k => lowerQuery.includes(k))) return 'Mid Funnel';

    return 'Informational';
}

/**
 * Classify the recommended action for a query based on its SEO and PPC performance
 */
export function classifyAction(
    row: Omit<MergedOpportunityRow, 'action' | 'opportunity_score' | 'projected_savings_score' | 'projected_growth_score'>,
    accountAvgRoas: number | null
): OpportunityAction {
    const {
        position_org, conversions_paid, cost_paid, clicks_org, clicks_paid,
        ctr_org, impressions_org, impressions_paid, roas_paid, cpa_paid,
        matchType, impressionShare, isBrand
    } = row;

    // Calculate CTR performance relative to expected
    const expectedCtr = getExpectedCtr(position_org);
    const ctrRatio = expectedCtr > 0 ? ctr_org / expectedCtr : 0;

    // Statistical significance checks
    const hasSignificantPaidData = impressions_paid >= 100 && cost_paid > 0;
    const hasSignificantOrgData = impressions_org >= 100;
    const hasConversions = conversions_paid >= 1;

    // SEO Focus criteria: meaningful PPC activity (clicks >= 1 OR conversions >= 1)
    const hasMeaningfulPaidActivity = clicks_paid >= 1 || conversions_paid >= 1;

    // Dynamic ROAS thresholds (fallback to 2.0/4.0 if no account avg)
    const avgRoas = accountAvgRoas || 2.0;
    const isPaidProfitable = roas_paid !== null && roas_paid >= avgRoas;
    const isPaidHighlyProfitable = roas_paid !== null && roas_paid >= (avgRoas * 1.5); // 1.5x Avg
    const isPaidUnprofitable = roas_paid !== null && roas_paid < (avgRoas * 0.8);      // < 80% of Avg

    // Normalize matchType for comparison
    const matchTypeLower = (matchType || '').toLowerCase();
    const isBroadOrPhrase =
        matchTypeLower === 'broad' ||
        matchTypeLower === 'phrase' ||
        matchTypeLower === 'b' ||
        matchTypeLower === 'p' ||
        matchTypeLower === 'near_exact';

    // Impression share checks
    const hasLowImpressionShare = impressionShare !== null && impressionShare !== undefined && impressionShare < 0.5;

    // --- NEW PRIORITY: Investigate PPC (Stop Loss Block) ---
    // If we've spent a significant amount with ZERO conversions, flag it immediately.
    // Raised threshold to 50 to avoid noise.
    if (cost_paid > 50 && conversions_paid === 0 && clicks_paid >= 10) {
        return 'Investigate PPC';
    }

    // --- NEW PRIORITY: Test Multi-Channel Pause ---
    // Detect cases where organic rank is high (#1-3) and both search & shopping/pmax are live
    const isMultiChannel = (row as MergedOpportunityRow).channel_count && (row as MergedOpportunityRow).channel_count! > 1;
    const hasShoppingOrPmax = (row as MergedOpportunityRow).has_shopping_coverage || (row as MergedOpportunityRow).has_pmax_coverage;

    if (position_org > 0 && position_org <= 3 && isMultiChannel && hasShoppingOrPmax && cost_paid > 20) {
        return 'Test Multi-Channel Pause';
    }

    // --- NEW PRIORITY 1: Defend (Strong Organic + High Competition) ---
    // Moved up to ensure Brand + High ROAS + High Comp is caught before Reduce Spend.
    // Loosened profitability slightly for Defend if it's high competition.
    const isMarginallyProfitable = roas_paid !== null && roas_paid >= (avgRoas * 0.7);

    // DEFEND GUARD: Standard existing guard or coverage presence
    // If shopping/pmax is covering, we might still want to defend Search if competition is high
    const isHighCompetition = row.competition_score >= 60;
    const hasCoveragePressure = row.has_shopping_coverage || row.has_pmax_coverage;
    const campaignStatusPressure = row.campaign_status_reasons && row.campaign_status_reasons.length > 0;

    if (position_org > 0 && position_org <= 3 && (isPaidProfitable || (isBrand && isMarginallyProfitable))) {
        // Trigger Defend if high competition OR we are seeing coverage pressure from other channels
        if (isHighCompetition || hasCoveragePressure || campaignStatusPressure) {
            return 'Defend';
        }
    }

    // --- NEW PRIORITY 2: Broad match with significant conversions = Add as Exact Match ---
    if (isBroadOrPhrase && hasConversions && clicks_paid >= 10 && isPaidProfitable) {
        return 'Add Exact Match';
    }

    // --- NEW PRIORITY 3: High ROAS with low impression share = Scale opportunity ---
    if (isPaidHighlyProfitable && hasSignificantPaidData) {
        // SCALE BOOST: If limited by budget, we want to scale
        const isLimitedByBudget = row.campaign_status_reasons?.toLowerCase().includes('budget');
        if (hasLowImpressionShare || isLimitedByBudget) {
            return 'Scale Spend';
        }
    }

    // --- PRIORITY 4: High-performing organic with inefficient paid ---
    if (position_org > 0 && position_org < 3 && cost_paid > 0) {
        if (isBrand) {
            // BRAND RULE: If we are #1 organically, consider reducing spend to test cannibalization
            // even if ROAS is okay, unless it's "Highly Profitable".
            if (position_org <= 1.5 && !isPaidHighlyProfitable) {
                return 'Reduce Spend';
            }
            // If it's unprofitable brand spend, reduce it
            if (isPaidUnprofitable) {
                return 'Reduce Spend';
            }
        } else {
            // NON-BRAND RULE: Be more aggressive about testing pauses/reductions

            // PAUSE GUARD: 
            // 1. Only allow if coverage_score is high enough OR we have fallback coverage (Shopping/PMax)
            const hasSafeCoverage = (row.coverage_score && row.coverage_score >= 70) || row.has_shopping_coverage || row.has_pmax_coverage;
            // 2. Only allow if campaign type is Search (don't propose pausing Shopping/PMax rows based on keyword logic)
            const isSearchCampaign = !row.campaign_type || row.campaign_type.toLowerCase().includes('search');

            if (isPaidUnprofitable && hasSignificantPaidData && isSearchCampaign) {
                if (row.competition_score < 60) {
                    // Safety check: if we don't have safe coverage, downgrade to Reduce Spend or Investigate
                    if (hasSafeCoverage) {
                        return 'Test PPC Pause';
                    } else {
                        return 'Reduce Spend'; // Downgrade
                    }
                }
            }
            // High organic strength but mediocre paid performance
            if (!isPaidHighlyProfitable && (position_org <= 2 || ctrRatio >= 1.0) && isSearchCampaign) {
                if (row.competition_score < 70) {
                    return 'Reduce Spend';
                }
            }
        }
    }

    // --- PRIORITY 5: Investigate (High position, but CTR Gap) ---
    // Escalated priority for top-5 positions with poor CTR as requested
    if (position_org > 0 && position_org <= 3 && ctrRatio < 0.5 && hasSignificantOrgData) {
        return 'Investigate';
    }

    // --- NEW PRIORITY 5.5: Scale Spend (CTR) (Profitable but not dominant) ---
    // If we rank well (3-10) and the keyword is profitable, we should push harder
    if (position_org > 3 && position_org <= 10 && isPaidProfitable && hasSignificantPaidData) {
        return 'Scale Spend';
    }

    // --- PRIORITY 6: SEO Focus (Proven demand, poor organic) ---
    if (position_org === 0 && hasMeaningfulPaidActivity) {
        return 'SEO Focus';
    }
    if (position_org > 10 && hasMeaningfulPaidActivity) {
        return 'SEO Focus';
    }

    // --- PRIORITY 7: Investigate (General organic rank, poor CTR) ---
    if (position_org > 3 && position_org <= 10 && ctrRatio < 0.6 && hasSignificantOrgData) {
        return 'Investigate';
    }

    // --- PRIORITY 8: Baseline dominance (Winning organically, no current spend) ---
    if (position_org > 0 && position_org <= 3 && cost_paid === 0) {
        return 'No Action';
    }

    // Default: No Action should ONLY be for Profitable & Stable terms
    if (isPaidProfitable && hasSignificantPaidData && impressionShare && impressionShare > 0.8) {
        return 'No Action';
    }

    // If it's loss making but doesn't hit thresholds, still flag it as Reduce IF it has dominance
    if (isPaidUnprofitable && cost_paid > 25 && position_org > 0 && position_org < 3) {
        return 'Reduce Spend';
    }

    return 'No Action';
}

/**
 * Get human-readable reason for the opportunity classification
 */
export function getActionReason(row: Omit<MergedOpportunityRow, 'action' | 'opportunity_score' | 'projected_savings_score' | 'projected_growth_score'>, action: OpportunityAction): string {
    const {
        position_org, conversions_paid, cost_paid, clicks_org, clicks_paid,
        ctr_org, impressions_org, impressions_paid, roas_paid,
        matchType, impressionShare
    } = row;

    const expectedCtr = getExpectedCtr(position_org);
    const ctrRatio = expectedCtr > 0 ? ctr_org / expectedCtr : 0;

    const hasSignificantPaidData = impressions_paid >= 100 && cost_paid > 0;
    const hasSignificantOrgData = impressions_org >= 100;
    const hasConversions = conversions_paid >= 1;
    const isPaidProfitable = roas_paid !== null && roas_paid >= 2;
    const isPaidHighlyProfitable = roas_paid !== null && roas_paid >= 4;
    const isPaidUnprofitable = roas_paid !== null && roas_paid < 2;
    const isBroadOrPhrase = matchType === 'broad' || matchType === 'phrase' || matchType === 'near_exact';
    const hasLowImpressionShare = impressionShare !== null && impressionShare !== undefined && impressionShare < 0.5;

    // SEO Focus criteria: meaningful PPC activity (clicks >= 1 OR conversions >= 1)
    const hasMeaningfulPaidActivity = clicks_paid >= 1 || conversions_paid >= 1;

    switch (action) {
        case 'Add Exact Match':
            return `Keyword is currently '${matchType}' match but converting profitably (ROAS > 2). Adding as Exact Match can improve efficiency and control.`;
        case 'Scale Spend':
            return `High ROAS (>4) but low Impression Share (<50%). Significant opportunity to capture more profitable volume by increasing budget/bids.`;
        case 'Test PPC Pause':
            return `Strong Organic presence (Pos < 3) and low competition (Score < 40). Paid Ads are likely cannibalizing organic traffic. Safe to test pause.`;
        case 'Test Multi-Channel Pause':
            return `Severe Redundancy: You are paying for multiple ad placements (Search + Shopping/PMax) while dominating organically (Pos < 3). The second ad placement is highly likely to be wasted spend.`;
        case 'Reduce Spend':
            return `Strong Organic presence (Pos < 3) with moderate competition (Score < 50). Can reduce ad spend without losing traffic.`;
        case "Defend":
            return `Protect high-value terms where you have organic dominance but face intense auction pressure. Org < 3 + ROAS >= 4 + Comp Score >= 60. Maintain detailed defense strategy to prevent competitors from stealing clicks.`;
        case 'Investigate PPC':
            return `High spend keywords with zero conversions (Cost > £40). Significant waste that needs immediate stopping or reassessing.`;
        case 'SEO Focus':
            if (position_org === 0 && hasMeaningfulPaidActivity) return `Proven paid engagement (clicks or conversions), but zero organic visibility. High value target for new SEO content.`;
            if (position_org > 10 && position_org <= 20) return `Ranking in striking distance (Page 2) with meaningful paid activity. Push to Page 1 for significant traffic gain.`;
            if (position_org > 20 && hasMeaningfulPaidActivity) return `Meaningful paid engagement, but organic ranking is low (>20). Long-term SEO opportunity to reduce reliance on paid spend.`;
            return `Keyword shows potential but lacks organic visibility. Improve content relevance to rank.`;
        case 'Investigate':
            if (position_org > 0 && position_org <= 10 && ctrRatio < 0.5) return `Organic ranking is good (Pos 1-10) but CTR is unexpectedly low. Investigate Title/Meta Description or SERP features stealing clicks.`;
            return `Performance metrics look unusual. Review queries and landing pages for relevance issues.`;
        case 'Consider PPC':
            if (position_org === 0) return `No organic visibility yet. Test viability with a small PPC campaign to gauge conversion potential before investing in SEO.`;
            if (clicks_org === 0 && impressions_org < 50) return `Low organic volume. PPC can help validate keyword demand and gather initial data.`;
            return `Potential gap in coverage. Consider testing Ads to capture traffic.`;
        case 'No Action':
            return `Current performance is stable or keyword lacks sufficient signals for a specific recommendation. Maintain current monitoring.`;
        default:
            return `General opportunity derived from performance analysis.`;
    }
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
/**
 * Compute the opportunity score and component scores
 * Returns the main score and specific projection scores
 */
export function computeOpportunityScore(row: Omit<MergedOpportunityRow, 'opportunity_score' | 'projected_savings_score' | 'projected_growth_score'>): {
    opportunity_score: number;
    projected_savings_score: number;
    projected_growth_score: number;
} {
    const {
        cost_paid, impressions_paid, position_org, conversions_paid,
        conv_value_paid, roas_paid, impressions_org, clicks_org, action,
        isBrand, revenueWeight, strategic_tier
    } = row;

    // --- Helper: Calculate Savings Score (Cost Savings Potential) ---
    let savingsScore = 0;

    // 1. Spend amount (Max 50 pts)
    // Higher spend = higher potential savings
    savingsScore += Math.min(cost_paid / 20, 50);

    // 2. Inefficiency (Max 30 pts)
    // Lower ROAS = higher savings score
    if (roas_paid !== null && roas_paid < 2) {
        savingsScore += Math.max(0, 30 - (roas_paid * 15));
    } else if (cost_paid > 0 && conversions_paid === 0) {
        savingsScore += 30; // Zero conversions
    }

    // 3. Organic Safety (Max 20 pts)
    if (position_org > 0 && position_org <= 3) {
        savingsScore += 20;
        // CANNIBALIZATION BONUS: If organic is #1, it's even safer to pause
        if (position_org <= 1.5) savingsScore += 10;
    }

    // 4. Multi-Channel Redundancy (Max 20 pts)
    // If we're paying for multiple ad channels AND ranking well organically, it's high waste
    if (action === 'Test Multi-Channel Pause' || ((row as any).channel_count && (row as any).channel_count > 1)) {
        if (position_org > 0 && position_org <= 3) {
            savingsScore += 20; // 2nd ad placement is likely redundant if organic is winning
        }
    }

    // BRAND PENALTY for Savings:
    // It's risky to stop bidding on brand terms even if they seem inefficient or organic is #1.
    // Competitors might steal the click.
    if (isBrand) {
        // Reduced penalty for Multi-Channel: If you have Shopping/PMax coverage, Search Brand is safer to test pausing
        if (action === 'Test Multi-Channel Pause') {
            savingsScore = savingsScore * 0.5; // Less severe penalty because shopping still covers
        } else {
            savingsScore = savingsScore * 0.1; // Crush score for standard brand terms
        }
    }

    const projected_savings_score = Math.min(Math.round(savingsScore), 100);


    // --- Helper: Calculate Growth Score (Revenue Potential) ---
    let growthScore = 0;

    // 1. Efficiency/ROAS (Max 30 pts)
    if (roas_paid !== null && roas_paid >= 4) growthScore += 30;
    else if (roas_paid !== null && roas_paid >= 2) growthScore += 20;
    else if (conversions_paid > 0) growthScore += 10;

    // 2. Volume/Revenue Potential (Max 40 pts)
    // REVENUE WEIGHTING: Use the new revenue multiplier
    if (revenueWeight > 0) {
        growthScore += Math.min(revenueWeight * 8, 40); // Weight significantly
    } else {
        // Fallback to impressions if no revenue
        growthScore += Math.min((impressions_paid + impressions_org) / 500, 20);
    }

    // 3. Low Rank Opportunity (Max 30 pts)
    if (position_org === 0) growthScore += 30;
    else if (position_org > 10) growthScore += 20;
    else if (position_org > 3) growthScore += 10;

    const projected_growth_score = Math.min(Math.round(growthScore), 100);

    // --- Main Opportunity Score Logic ---
    const isCostSavingAction = action === 'Test PPC Pause' || action === 'Reduce Spend' || action === 'Investigate';

    let baseScore = isCostSavingAction ? projected_savings_score : projected_growth_score;

    // --- Strategic Tier Multipliers ---
    // Tiers shift base scores to align with business strategy
    const tierMultipliers: Record<StrategicTier, number> = {
        'Brand Core': 1.15,     // Defend bias
        'High Intent': 1.25,     // Highest growth weight - bumped from 1.2
        'Mid Funnel': 1.05,
        'Informational': 0.8     // Lowered from 0.9 to prioritize commercial
    };

    // Type-safe access with fallback
    const tier = row.strategic_tier || 'Informational';
    const tierMultiplier = tierMultipliers[tier as StrategicTier] || 1.0;
    baseScore *= tierMultiplier;

    // --- Revenue Weight (Logarithmic Scaling) ---
    // Using log scaling as requested to ensure big money terms float to the top
    // without completely drowning out high-potential but lower-revenue terms.
    const revenueWeightLog = Math.log10(1 + row.conv_value_paid) + 1; // 1 + log10(revenue+1)
    baseScore *= revenueWeightLog;

    // Apply Action Multipliers
    const actionMultipliers: Record<OpportunityAction, number> = {
        'Test PPC Pause': 1.1,
        'Test Multi-Channel Pause': 1.25,
        'Reduce Spend': 1.05,
        'Investigate': 1.1,
        'Investigate PPC': 1.2,
        'SEO Focus': 1.2,
        'Scale Spend': 1.25,
        'Add Exact Match': 1.1,
        'Defend': 1.2,
        'Consider PPC': 1.0,
        'No Action': 1.0
    };

    let finalModifier = actionMultipliers[action] ?? 1;

    // Cost Gravity (Secondary priority booster)
    if (row.cost_paid > 1000) finalModifier += 0.2;
    else if (row.cost_paid > 200) finalModifier += 0.1;

    const finalScore = Math.min(Math.round(baseScore * finalModifier), 100);

    return {
        opportunity_score: finalScore,
        projected_savings_score,
        projected_growth_score
    };
}


/**
 * Merge GSC and Google Ads data on normalized query
 */
export function mergeDatasets(
    gscData: GscQueryRow[],
    adsData: AdsSearchTermRow[],
    userBrandTerms: string[] = [], // Optional: Passed from UI
    keywordMetricsData: KeywordMetricsRow[] = [], // Optional: New Keyword Auction Data
    campaignData: CampaignReportRow[] = [] // Optional: New Campaign Report Data
): MergedOpportunityRow[] {
    // Create maps keyed by normalized query
    const gscMap = new Map<string, GscQueryRow>();
    const adsMap = new Map<string, AdsSearchTermRow>();

    // Create Campaign Map for fast lookup
    const campaignMap = new Map<string, CampaignReportRow>();
    for (const row of campaignData) {
        if (row.campaign) {
            campaignMap.set(normalizeCampaignName(row.campaign), row);
        }
    }

    // 1. Build Keyword Metrics Map
    // We need two lookups:
    // A. Specific Match: Campaign + Ad Group + Keyword -> Metrics
    // B. Fallback: Campaign + Ad Group -> Weighted Average Metrics

    const keywordSpecificMap = new Map<string, KeywordMetricsRow>();
    const adGroupFallbackMap = new Map<string, {
        totalImpr: number;
        weightedIs: number;
        weightedLostRank: number;
        weightedTop: number;
        weightedAbsTop: number;
    }>();

    // Helper to generate specific key
    const getSpecKey = (camp: string, ag: string, kw: string) =>
        `${camp.toLowerCase().trim()}|${ag.toLowerCase().trim()}|${normalizeQuery(kw)}`;

    // Helper to generate group key
    const getGroupKey = (camp: string, ag: string) =>
        `${camp.toLowerCase().trim()}|${ag.toLowerCase().trim()}`;

    // Process Keyword Data
    if (keywordMetricsData.length > 0) {
        for (const row of keywordMetricsData) {
            // Specific Map
            const specKey = getSpecKey(row.campaign, row.adGroup, row.keyword);
            keywordSpecificMap.set(specKey, row);

            // Ad Group Accumulation for Fallback
            const groupKey = getGroupKey(row.campaign, row.adGroup);
            const existing = adGroupFallbackMap.get(groupKey) ?? {
                totalImpr: 0,
                weightedIs: 0,
                weightedLostRank: 0,
                weightedTop: 0,
                weightedAbsTop: 0
            };

            // Weighting: Since strictly "Impressions" is not in the required fields list for Keyword CSV,
            // we default to equal weighting (count=1). 
            const weight = 1;

            existing.totalImpr += weight;
            existing.weightedIs += (row.searchImprShare ?? 0) * weight;
            existing.weightedLostRank += (row.searchLostIsRank ?? 0) * weight;
            existing.weightedTop += (row.imprTopPct ?? 0) * weight;
            existing.weightedAbsTop += (row.imprAbsTopPct ?? 0) * weight;

            adGroupFallbackMap.set(groupKey, existing);
        }
    }

    // Pre-calculation: Account Level ROAS
    let totalAccountCost = 0;
    let totalAccountValue = 0;

    for (const row of gscData) {
        const key = normalizeQuery(row.query);
        if (key) {
            const existing = gscMap.get(key);
            if (!existing || row.clicks > existing.clicks) {
                gscMap.set(key, row);
            }
        }
    }

    // Track all campaigns and channels associated with a query
    const queryCampaignUsage = new Map<string, Set<string>>();
    const queryChannelStats = new Map<string, Set<string>>();

    for (const row of adsData) {
        const queryKey = normalizeQuery(row.searchTerm);
        if (!queryKey) {
            // Still accumulate totals even if no query (e.g. account level metrics)
            totalAccountCost += microsToAmount(row.costMicros);
            totalAccountValue += row.conversionValue;
            continue;
        }

        // Determine channel for grouping and stats
        const cleanCampName = normalizeCampaignName(row.campaign || '');
        const campRow = campaignMap.get(cleanCampName);
        let channel = 'search';
        if (campRow) {
            const ct = campRow.campaignType.toLowerCase();
            if (ct.includes('shopping')) channel = 'shopping';
            else if (ct.includes('max') || ct.includes('pmax')) channel = 'pmax';
            else if (ct.includes('demand') || ct.includes('video') || ct.includes('display')) channel = 'other';
        } else if (row.campaign) {
            const c = row.campaign.toLowerCase();
            if (c.includes('shopping')) channel = 'shopping';
            else if (c.includes('max') || c.includes('pmax')) channel = 'pmax';
        }

        // 1. Grouping for Ads Map
        const groupKey = `${queryKey}|${channel}`;
        const existing = adsMap.get(groupKey);
        if (!existing) {
            adsMap.set(groupKey, { ...row });
        } else {
            existing.clicks += row.clicks;
            existing.impressions += row.impressions;
            existing.costMicros += row.costMicros;
            existing.conversions += row.conversions;
            existing.conversionValue += row.conversionValue;

            if (row.costMicros > (existing.costMicros - row.costMicros)) {
                existing.campaign = row.campaign;
                existing.adGroup = row.adGroup;
                existing.matchType = row.matchType;
                existing.impressionShare = row.impressionShare;
                existing.budgetLostImpressionShare = row.budgetLostImpressionShare;
                existing.rankLostImpressionShare = row.rankLostImpressionShare;
                existing.conversionRate = row.conversionRate;
            }
        }

        // 2. Track Campaign Usage: Query -> All Campaigns
        if (!queryCampaignUsage.has(queryKey)) queryCampaignUsage.set(queryKey, new Set());
        if (row.campaign) queryCampaignUsage.get(queryKey)!.add(normalizeCampaignName(row.campaign));

        // 3. Track Channel Stats: Query -> All Channels
        if (!queryChannelStats.has(queryKey)) queryChannelStats.set(queryKey, new Set());
        queryChannelStats.get(queryKey)!.add(channel);

        // 4. Totals for account level metrics
        totalAccountCost += microsToAmount(row.costMicros);
        totalAccountValue += row.conversionValue;
    }

    // Calculate dynamic account ROAS
    const accountAvgRoas = totalAccountCost > 0 ? totalAccountValue / totalAccountCost : 2.0;

    // Pre-group Ads data by query for O(1) retrieval
    const adsByQuery = new Map<string, { channel: string, data: AdsSearchTermRow }[]>();
    for (const [key, data] of Array.from(adsMap.entries())) {
        const pipeIdx = key.indexOf('|');
        if (pipeIdx === -1) continue;
        const q = key.substring(0, pipeIdx);
        const channel = key.substring(pipeIdx + 1);
        const list = adsByQuery.get(q) || [];
        list.push({ channel, data });
        adsByQuery.set(q, list);
    }

    // Get all unique queries
    const queries = new Set([...Array.from(gscMap.keys()), ...Array.from(adsByQuery.keys())]);
    const merged: MergedOpportunityRow[] = [];

    // Track which campaigns are matched to queries
    const usedCampaigns = new Set<string>();

    for (const query of Array.from(queries)) {
        if (!query) continue;
        const gsc = gscMap.get(query);
        let adsRowsForQuery = adsByQuery.get(query) || [];

        // If no Ads data but has GSC, create one dummy row for merging
        if (adsRowsForQuery.length === 0) {
            adsRowsForQuery = [{ channel: 'n/a', data: null as any }];
        }

        // Filter out rows with zero organic AND zero paid clicks
        const clicks_org_check = gsc?.clicks ?? 0;
        adsRowsForQuery = adsRowsForQuery.filter(row => {
            const clicks_paid = row.data?.clicks ?? 0;
            return clicks_org_check > 0 || clicks_paid > 0;
        });

        if (adsRowsForQuery.length === 0) continue;

        // Identify "Primary" (highest spend) for GSC metrics ownership
        let maxSpend = -1;
        let primaryIdx = 0;
        adsRowsForQuery.forEach((r, idx) => {
            const spend = r.data ? r.data.costMicros : 0;
            if (spend > maxSpend) {
                maxSpend = spend;
                primaryIdx = idx;
            }
        });

        const rowsForThisQuery: MergedOpportunityRow[] = [];

        for (let i = 0; i < adsRowsForQuery.length; i++) {
            const { channel: row_channel, data: ads } = adsRowsForQuery[i]!;
            const is_primary_channel = (i === primaryIdx);

            // Organic metrics - only attributed to Primary for summary logic
            // but provided to all for Action Logic
            const clicks_org = gsc?.clicks ?? 0;
            const impressions_org = gsc?.impressions ?? 0;
            const ctr_org = gsc?.ctr ?? 0;
            const position_org = gsc?.position ?? 0;

            // Track usage (ALL campaigns for this query)
            const campaignsForQuery = queryCampaignUsage.get(query);
            if (campaignsForQuery) {
                campaignsForQuery.forEach(c => usedCampaigns.add(c));
            }

            // Extended paid metrics
            const matchType = ads?.matchType;
            const impressionShare = ads?.impressionShare ?? null;
            const budgetLostImpressionShare = ads?.budgetLostImpressionShare ?? null;
            const rankLostImpressionShare = ads?.rankLostImpressionShare ?? null;
            const conversionRate = ads?.conversionRate ?? 0;

            // Paid metrics (Aggregated)
            const clicks_paid = ads?.clicks ?? 0;
            const impressions_paid = ads?.impressions ?? 0;
            const cost_paid = ads ? microsToAmount(ads.costMicros) : 0;
            const conversions_paid = ads?.conversions ?? 0;
            const conv_value_paid = ads?.conversionValue ?? 0;

            // Recalculate derived metrics for aggregated scenarios
            const ctr_paid = impressions_paid > 0 ? (clicks_paid / impressions_paid) : 0;
            const avg_cpc_paid = clicks_paid > 0 ? (cost_paid / clicks_paid) : 0;

            // Campaign Fields
            const campaign = ads?.campaign;
            const adGroup = ads?.adGroup;

            // Calculated metrics
            const cpa_paid = safeDivide(cost_paid, conversions_paid);
            const roas_paid = safeDivide(conv_value_paid, cost_paid);
            const ctr_diff = ctr_paid - ctr_org;
            const cost_per_org_click = safeDivide(cost_paid, clicks_org);

            // Brand Detection
            const isBrand = isBrandTerm(query, userBrandTerms);

            // Revenue Weighting
            const revenueWeight = conv_value_paid > 0 ? Math.log10(conv_value_paid + 1) : 0;

            // SEO opportunity score
            const seo_opportunity_score = clicks_org < 5 ? impressions_paid : 0;

            // PPC spend reduction potential
            const ppc_spend_reduction_potential = (clicks_org >= 10 && avg_cpc_paid >= 1) ? clicks_org * avg_cpc_paid : 0;

            // Keyword Metrics
            const specKey = getSpecKey(campaign || '', adGroup || '', query);
            const groupKey = getGroupKey(campaign || '', adGroup || '');

            let kwMetrics = keywordSpecificMap.get(specKey);
            let merge_level: 'keyword' | 'ad_group_fallback' | 'campaign' | 'unmatched' | 'default' = 'default';
            let competition_source: 'keyword_level' | 'ad_group_fallback' | 'default' = 'default';

            let k_sis: number | null = null;
            let k_slis_rank: number | null = null;
            let k_top: number | null = null;
            let k_abs_top: number | null = null;

            if (kwMetrics) {
                merge_level = 'keyword';
                competition_source = 'keyword_level';
                k_sis = kwMetrics.searchImprShare;
                k_slis_rank = kwMetrics.searchLostIsRank;
                k_top = kwMetrics.imprTopPct;
                k_abs_top = kwMetrics.imprAbsTopPct;
            } else {
                const groupStats = adGroupFallbackMap.get(groupKey);
                if (groupStats && groupStats.totalImpr > 0) {
                    merge_level = 'ad_group_fallback';
                    competition_source = 'ad_group_fallback';
                    k_sis = groupStats.weightedIs / groupStats.totalImpr;
                    k_slis_rank = groupStats.weightedLostRank / groupStats.totalImpr;
                    k_top = groupStats.weightedTop / groupStats.totalImpr;
                    k_abs_top = groupStats.weightedAbsTop / groupStats.totalImpr;
                }
            }

            let competition_score = 50;
            if (k_sis !== null || k_slis_rank !== null || k_abs_top !== null) {
                const val_sis = (k_sis ?? 1.0) * 100;
                const val_slis = (k_slis_rank ?? 0) * 100;
                const val_abs_top = (k_abs_top ?? 0) * 100;
                const comp_calc = (0.5 * val_slis) + (0.3 * (100 - val_sis)) + (0.2 * (100 - val_abs_top));
                competition_score = Math.max(0, Math.min(100, comp_calc));
            } else if (ads?.rankLostImpressionShare !== null && ads?.rankLostImpressionShare !== undefined) {
                competition_score = Math.max(0, Math.min(100, ads.rankLostImpressionShare * 100 * 1.2));
            } else if (ads && ads.averageCpc > 0) {
                const cpcFactor = Math.min(ads.averageCpc / 2.0, 1) * 30;
                const spendFactor = Math.min(cost_paid / 100, 1) * 20;
                competition_score = 30 + cpcFactor + spendFactor;
            } else if (isBrand) {
                competition_score = 30;
            }

            const cleanCampName = normalizeCampaignName(campaign || '');
            const campaignRow = campaignMap.get(cleanCampName);
            let campaign_type = campaignRow ? campaignRow.campaignType : undefined;
            let channel_group: 'search' | 'shopping' | 'pmax' | 'other' = 'search';

            if (campaign_type) {
                const ct = campaign_type.toLowerCase();
                if (ct.includes('shopping')) channel_group = 'shopping';
                else if (ct.includes('max') || ct.includes('pmax')) channel_group = 'pmax';
                else if (ct.includes('demand') || ct.includes('video')) channel_group = 'other';
            } else if (campaign) {
                const c = campaign.toLowerCase();
                if (c.includes('shopping')) channel_group = 'shopping';
                else if (c.includes('max') || c.includes('pmax')) channel_group = 'pmax';
            }

            const channels = queryChannelStats.get(query);
            const channel_count = channels ? channels.size : 0;
            const has_shopping_coverage = channels ? channels.has('shopping') : false;
            const has_pmax_coverage = channels ? channels.has('pmax') : false;

            let coverage_score = 0;
            if (channel_count > 0) {
                coverage_score = Math.min(100, channel_count * 35);
                if (has_shopping_coverage || has_pmax_coverage) coverage_score = Math.min(100, coverage_score + 10);
            }

            if (campaignRow) {
                if (merge_level === 'default') merge_level = 'campaign';
            } else if (campaign && !campaignRow) {
                if (merge_level === 'default') merge_level = 'unmatched';
            }

            const partialRow = {
                query,
                clicks_org, impressions_org, ctr_org, position_org,
                clicks_paid, impressions_paid, ctr_paid, cost_paid, avg_cpc_paid, conversions_paid, conv_value_paid,
                cpa_paid, roas_paid, ctr_diff, cost_per_org_click, seo_opportunity_score, ppc_spend_reduction_potential,
                hasOrganic: !!gsc, hasPaid: !!ads, campaign, adGroup, matchType, impressionShare, budgetLostImpressionShare,
                rankLostImpressionShare, conversionRate, isBrand, revenueWeight,
                keyword_search_impr_share: k_sis, keyword_search_lost_is_rank: k_slis_rank, keyword_impr_top_pct: k_top, keyword_impr_abs_top_pct: k_abs_top,
                competition_score, competition_source, merge_level, is_primary_channel,
                campaign_type, campaign_status: campaignRow?.status, campaign_status_reasons: campaignRow?.statusReasons,
                bid_strategy_type: campaignRow?.bidStrategyType, budget: campaignRow?.budget ?? undefined,
                campaign_search_impr_share: campaignRow?.searchImprShare, channel_group, coverage_score, channel_count,
                has_shopping_coverage, has_pmax_coverage
            };

            const strategic_tier = classifyStrategicTier(query, isBrand);
            const action = classifyAction({ ...partialRow, strategic_tier }, accountAvgRoas);
            const scores = computeOpportunityScore({ ...partialRow, action, strategic_tier, isBrand });

            rowsForThisQuery.push({
                ...partialRow,
                ...scores,
                action,
                strategic_tier,
                isBrand,
                parent_query: adsRowsForQuery.length > 1 ? query : undefined
            });
        }

        // If multiple channels, create a TOTAL row
        if (adsRowsForQuery.length > 1) {
            const isBrand = isBrandTerm(query, userBrandTerms);
            const totalRow = { ...rowsForThisQuery[0]! }; // Start with first row's structure (organics, etc)

            totalRow.is_total_row = true;
            totalRow.parent_query = undefined;
            totalRow.is_primary_channel = true; // Primary for organic stats
            totalRow.channel_group = Array.from(queryChannelStats.get(query) || []).join(', ') as any;

            // Sum up paid metrics
            totalRow.clicks_paid = rowsForThisQuery.reduce((sum, r) => sum + r.clicks_paid, 0);
            totalRow.impressions_paid = rowsForThisQuery.reduce((sum, r) => sum + r.impressions_paid, 0);
            totalRow.cost_paid = rowsForThisQuery.reduce((sum, r) => sum + r.cost_paid, 0);
            totalRow.conversions_paid = rowsForThisQuery.reduce((sum, r) => sum + r.conversions_paid, 0);
            totalRow.conv_value_paid = rowsForThisQuery.reduce((sum, r) => sum + r.conv_value_paid, 0);

            // Derived
            totalRow.ctr_paid = totalRow.impressions_paid > 0 ? totalRow.clicks_paid / totalRow.impressions_paid : 0;
            totalRow.avg_cpc_paid = totalRow.clicks_paid > 0 ? totalRow.cost_paid / totalRow.clicks_paid : 0;
            totalRow.roas_paid = totalRow.cost_paid > 0 ? totalRow.conv_value_paid / totalRow.cost_paid : 0;
            totalRow.cpa_paid = totalRow.conversions_paid > 0 ? totalRow.cost_paid / totalRow.conversions_paid : null;

            // Average or Max competition/coverage? Average is safer.
            totalRow.competition_score = rowsForThisQuery.reduce((sum, r) => sum + r.competition_score, 0) / rowsForThisQuery.length;

            // Re-classify Total row
            const strategic_tier = classifyStrategicTier(query, isBrand);
            totalRow.action = classifyAction({ ...totalRow, strategic_tier }, accountAvgRoas);
            const scores = computeOpportunityScore({ ...totalRow, action: totalRow.action, strategic_tier, isBrand });

            totalRow.opportunity_score = scores.opportunity_score;
            totalRow.projected_savings_score = scores.projected_savings_score;
            totalRow.projected_growth_score = scores.projected_growth_score;

            merged.push(totalRow);
        }

        // Add individual rows (marked as children if necessary)
        merged.push(...rowsForThisQuery);
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
        'Consider PPC': 0,
        'Investigate': 0,
        'Investigate PPC': 0,
        'Reduce Spend': 0,
        'Test PPC Pause': 0,
        'Add Exact Match': 0,
        'Scale Spend': 0,
        'Defend': 0,
        'Test Multi-Channel Pause': 0,
        'No Action': 0,
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
        // --- IMPORTANT: Skip child rows to avoid double counting in summaries ---
        if (row.parent_query) continue;

        totalSpend += row.cost_paid;
        totalConversions += row.conversions_paid;
        if (row.is_primary_channel) {
            totalOrgClicks += row.clicks_org;
            totalOrgImpressions += row.impressions_org;
        }

        totalPaidClicks += row.clicks_paid;
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
    const opportunityCount = data.filter(r => r.action !== 'No Action').length;

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
        if (row.parent_query) continue;
        const existing = actionMap.get(row.action) ?? { cost_paid: 0, clicks_org: 0, count: 0 };
        actionMap.set(row.action, {
            cost_paid: existing.cost_paid + row.cost_paid,
            clicks_org: existing.clicks_org + (row.is_primary_channel ? row.clicks_org : 0),
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
    return data
        .filter(r => !r.parent_query)
        .slice(0, limit)
        .map(row => ({
            query: row.query,
            position_org: row.position_org,
            cost_paid: row.cost_paid,
            conversions_paid: row.conversions_paid,
            action: row.action,
            cpa_paid: row.cpa_paid,
        }));
}

/**
 * Prepare data for opportunity score distribution
 */
export function prepareScoreDistribution(data: MergedOpportunityRow[]): ScoreDistribution[] {
    const buckets: ScoreDistribution[] = [
        { bucket: '0-20', count: 0, saveCount: 0, growCount: 0, minScore: 0, maxScore: 20 },
        { bucket: '21-40', count: 0, saveCount: 0, growCount: 0, minScore: 20, maxScore: 40 },
        { bucket: '41-60', count: 0, saveCount: 0, growCount: 0, minScore: 40, maxScore: 60 },
        { bucket: '61-80', count: 0, saveCount: 0, growCount: 0, minScore: 60, maxScore: 80 },
        { bucket: '81-100', count: 0, saveCount: 0, growCount: 0, minScore: 80, maxScore: 101 }, // 101 to include 100
    ];

    const saveActions = new Set<OpportunityAction>([
        'Test PPC Pause',
        'Reduce Spend',
        'Investigate',
        'Investigate PPC',
        'Test Multi-Channel Pause'
    ]);

    for (const row of data) {
        if (row.parent_query) continue;
        const score = row.opportunity_score;
        const isSave = saveActions.has(row.action);

        for (const bucket of buckets) {
            if (score >= bucket.minScore && score < bucket.maxScore) {
                bucket.count++;
                if (isSave) {
                    bucket.saveCount++;
                } else {
                    bucket.growCount++;
                }
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
    if (value === undefined || value === null || isNaN(value)) return '£0.00';
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
    if (value === undefined || value === null || isNaN(value)) return '0.00%';
    return `${(value * 100).toFixed(2)}%`;
}

/**
 * Format large numbers with K/M suffix
 */
export function formatNumber(value: number): string {
    if (value === undefined || value === null || isNaN(value)) return '0';
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
        'Add Exact Match': '#06b6d4',  // Cyan
        'Scale Spend': '#22c55e',      // Lime Green
        'SEO Focus': '#10b981',        // Green
        'Consider PPC': '#6366f1',      // Indigo
        'Investigate': '#f59e0b',       // Amber
        'Investigate PPC': '#dc2626',   // Bright Red (Critical)
        'Reduce Spend': '#f97316',      // Orange
        'Defend': '#7c3aed',            // Violet
        'Test PPC Pause': '#ec4899',
        'Test Multi-Channel Pause': '#f43f5e',
        'No Action': '#f1f5f9',
    };
    return colors[action] || '#cccccc';
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
        'Test PPC Pause': [
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
        'Defend': [
            {
                action: "Maintain High Bids",
                reasoning: "High competition and high value. Dropping position could result in significant revenue loss.",
                impact: "High - Protect Revenue",
                difficulty: "Low"
            },
            {
                action: "Monitor Competitor Offers",
                reasoning: "Competitors are aggressive. Ensure your ad copy and offer remain superior.",
                impact: "Medium - Sustain Click Share",
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
        'Investigate PPC': [
            {
                action: "Immediate Cost Review",
                reasoning: "High spend with zero conversions. Review search terms for negative keyword opportunities or reconsider landing page relevance.",
                impact: "High - Stop wasted spend",
                difficulty: "Low"
            }
        ],
        'No Action': [
            {
                action: "No Specific Action Required",
                reasoning: "Current data does not indicate any significant opportunity or issue. Continue data collection.",
                impact: "None",
                difficulty: "Low"
            }
        ],
        'Test Multi-Channel Pause': [
            {
                action: "Strategic Multi-Channel Review",
                reasoning: "You are currently appearing in multiple ad formats (Search, Shopping/PMax) while also holding a top-3 organic position. This redundancy is likely costing you significantly in marginal CPA.",
                impact: "High - Budget efficiency",
                difficulty: "Medium"
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

    const aiRecommendation = getAiRecommendation(query, action || 'No Action');

    return {
        query,
        difficulty: Math.floor(Math.random() * 40) + 10, // More realistic difficulty
        searchVolume: Math.floor(Math.random() * 5000) + 100,
        intent: Math.random() > 0.6 ? "Transactional" : (Math.random() > 0.3 ? "Commercial" : "Informational"),
        topResults: results,
        paidResults: paidResults,
        serpFeatures: serpFeatures.filter(() => Math.random() > 0.5),
        aiRecommendation,
        action: action || 'No Action'
    };
}

/**
 * Get a structured AI recommendation based on the determined action and SERP context
 */
export function getAiRecommendation(query: string, action: OpportunityAction): AiRecommendation {
    const actionRecommendations: Record<string, Array<Omit<AiRecommendation, 'action'> & { action: string }>> = {
        'SEO Focus': [
            {
                action: "Optimize Content for Top 3",
                reasoning: "You are already ranking on page 1. Subtle improvements to H1s, internal linking, and content depth could push you into the top 3 and eliminate the need for PPC spend on this term.",
                impact: "High - Potential to save 100% of PPC spend",
                difficulty: "Medium"
            },
            {
                action: "Target Featured Snippet",
                reasoning: "Answer common questions concisely in your content. Winning the featured snippet will give you maximum organic visibility above all ads.",
                impact: "High - Maximum organic visibility",
                difficulty: "Medium"
            }
        ],
        'Scale Spend': [
            {
                action: "Aggressive Bid Increase",
                reasoning: "ROAS is significantly above target and impression share is low. Increasing bids will capture more high-value conversions that are currently going to competitors.",
                impact: "High - Direct revenue growth",
                difficulty: "Low"
            },
            {
                action: "Expand Match Types",
                reasoning: "If currently on exact match, testing phrase match could uncover related high-converting queries you aren't currently targeting.",
                impact: "Medium - Discover new volume",
                difficulty: "Medium"
            }
        ],
        'Add Exact Match': [
            {
                action: "Add as Exact Match Keyword",
                reasoning: "This broad/phrase match query is converting well. Adding it as exact match allows for better bid control and higher Quality Score.",
                impact: "Medium - Better efficiency and control",
                difficulty: "Low"
            }
        ],
        'Reduce Spend': [
            {
                action: "Lower Bids or Pause",
                reasoning: "ROAS is below target and organic rank is strong. Reducing PPC spend will improve overall account efficiency without losing significantly on total traffic.",
                impact: "Medium - Immediate cost savings",
                difficulty: "Low"
            }
        ],
        'Defend': [
            {
                action: "Increase Bids for Top Position",
                reasoning: "High competition and strong performance make this a critical keyword. Ensure you maintain top-of-page visibility to protect your market share.",
                impact: "Medium - Protect existing revenue",
                difficulty: "Low"
            }
        ],
        'Test PPC Pause': [
            {
                action: "Pause PPC for 7-Day Test",
                reasoning: "High organic rank (#1) and low competition suggest you will capture most of this traffic organically. Pause PPC to see if total conversions remain stable.",
                impact: "High - Eliminate redundant spend",
                difficulty: "Low"
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
            }
        ],
        'Investigate PPC': [
            {
                action: "Stop Loss: Reassess Strategy",
                reasoning: "High spend with zero conversions. This keyword is currently purely cost with no ROI. Check landing page relevance and search term accuracy.",
                impact: "High - Eliminate wasted spend",
                difficulty: "Low"
            },
            {
                action: "Review Landing Page",
                reasoning: "You are getting clicks but no sales. The page might not provide what users are looking for when they use this keyword.",
                impact: "Medium - Potential to start converting",
                difficulty: "Medium"
            }
        ],
        'No Action': [
            {
                action: "No Specific Action Required",
                reasoning: "Current data indicates this keyword is performing well and is stable. Continue to monitor performance trends.",
                impact: "Low",
                difficulty: "Low"
            }
        ],
        'Test Multi-Channel Pause': [
            {
                action: "Pause Search or Reduce Shopping Target",
                reasoning: "Keyword has #1-3 organic rank AND coverage in both Search and Shopping/PMax. This is highly redundant. Testing a pause in Search or lowering bids in Shopping can save budget without losing total traffic.",
                impact: "High - Eliminate double-serving redundancy",
                difficulty: "Medium"
            }
        ]
    };

    const applicable = actionRecommendations[action] || actionRecommendations['No Action'];
    if (!applicable || applicable.length === 0) return {
        action: "Review data",
        reasoning: "Not enough information to provide a specific recommendation.",
        impact: "Neutral",
        difficulty: "Low"
    };
    return applicable[Math.floor(Math.random() * applicable.length)] as AiRecommendation;
}
