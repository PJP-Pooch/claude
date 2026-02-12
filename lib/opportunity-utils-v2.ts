import {
    MergedOpportunityRow,
    OpportunityAction
} from './opportunity-types';
import { SCORING_CONFIG_V2, ScoringConfig } from './scoring-config-v2';

const DEFAULT_CONFIG = SCORING_CONFIG_V2;

/**
 * Calculate expected CTR based on organic position buckets
 */
export function getExpectedCtrV2(position: number, config: ScoringConfig = DEFAULT_CONFIG): number {
    const model = config.expected_ctr_model;
    if (position <= 0) return 0;
    if (position <= 1) return model.pos_1;
    if (position <= 2) return model.pos_2;
    if (position <= 3) return model.pos_3;
    if (position <= 5) return model.pos_5;
    if (position <= 10) return model.pos_10;
    if (position <= 20) return model.pos_20;
    return model.pos_plus;
}

export interface ClassificationResult {
    action: OpportunityAction;
    reasons: string[];
    missing_signals: string[];
    confidence: 'high' | 'med' | 'low';
}

/**
 * Classify action for Scoring V2 with Priority Logic
 */
export function classifyActionV2(
    row: MergedOpportunityRow,
    accountAvgRoas: number | null,
    medianCost: number,
    medianConvValue: number,
    medianCpc: number,
    medianCpa: number, // Added for Defend proxy
    config: ScoringConfig = DEFAULT_CONFIG
): ClassificationResult {
    const CONFIG = config;
    const {
        position_org, conversions_paid, cost_paid, clicks_org, clicks_paid,
        ctr_org, impressions_org, impressions_paid, roas_paid,
        matchType, impressionShare, isBrand, competition_score,
        cpa_paid
    } = row;

    const reasons: string[] = [];
    const missing_signals: string[] = [];

    // Data Availability Checks
    const hasPaidData = cost_paid > 0 || clicks_paid > 0;
    const hasOrgData = clicks_org > 0 || impressions_org > 0;
    const hasRoas = roas_paid !== null;
    const hasCpa = cpa_paid !== null;
    const hasCompScore = competition_score !== undefined;
    const isRealCompScore = row.competition_source === 'keyword_level' || row.competition_source === 'ad_group_fallback';
    const hasRevenue = row.conv_value_paid !== undefined && row.conv_value_paid > 0;
    const hasIS = impressionShare !== null;

    if (!isRealCompScore) missing_signals.push('Exact Competition Score');
    if (!hasRevenue && conversions_paid > 0) missing_signals.push('Conversion Value');
    if (!hasIS) missing_signals.push('Impression Share');

    // --- PRIORITY 1: INVESTIGATE ---
    // Rule: (Cost > £50 OR Cost > median_cost) + conversions == 0
    // OR (Good rank with poor CTR): Organic position <= 6 AND CTR < 50% of expected CTR

    // 1a. High Spend, No Convs
    if (conversions_paid === 0 && hasPaidData) {
        if (cost_paid > CONFIG.investigate_cost_threshold || (medianCost > 0 && cost_paid > medianCost)) {
            return {
                action: 'Investigate',
                reasons: [`High Spend (£${cost_paid.toFixed(2)}) with 0 conversions`],
                missing_signals,
                confidence: 'high'
            };
        }
    }

    // 1b. Poor CTR
    if (hasOrgData && position_org > 0 && position_org <= 6) {
        const expected = getExpectedCtrV2(position_org, CONFIG);
        if (ctr_org < (expected * 0.5)) {
            // Ensure statistical significance
            if (impressions_org >= 100) {
                return {
                    action: 'Investigate',
                    reasons: [`Organic CTR ${(ctr_org * 100).toFixed(2)}% is < 50% of expected ${(expected * 100).toFixed(2)}%`],
                    missing_signals,
                    confidence: 'med'
                };
            }
        }
    }

    // --- PRIORITY 2: DEFEND ---
    // Rule: Organic pos < 3 + ROAS >= 4 + Comp Score >= 60 + Above median revenue
    // Update logic: Pos <= 2 (Strong). Fallback if signals missing.

    const isStrongOrganic = position_org > 0 && position_org <= CONFIG.organic_strong_pos;
    if (isStrongOrganic && hasPaidData) {
        let score = 0;
        const localReasons: string[] = [];

        // Signal 1: Value/Efficiency
        const isHighValue = (hasRoas && roas_paid! >= CONFIG.high_roas);
        const isEfficientCpa = (!hasRoas && hasCpa && medianCpa > 0 && cpa_paid! <= medianCpa);

        if (isHighValue) {
            score++;
            localReasons.push(`High ROAS (${roas_paid!.toFixed(2)})`);
        } else if (isEfficientCpa) {
            score++; // Weak proxy
            localReasons.push(`Efficient CPA (£${cpa_paid!.toFixed(2)})`);
        }

        // Signal 2: Competition
        const isHighComp = (competition_score >= CONFIG.defend_comp_threshold);
        // Proxy: Low IS or High Lost IS or High CPC
        const isHighCompProxy = (!isRealCompScore && (
            (impressionShare !== null && impressionShare !== undefined && impressionShare < 0.5) ||
            (row.rankLostImpressionShare !== null && row.rankLostImpressionShare !== undefined && row.rankLostImpressionShare > 0.3) ||
            (row.avg_cpc_paid > medianCpc)
        ));

        if (isHighComp) {
            score++;
            localReasons.push(`High Competition Score (${competition_score.toFixed(0)})`);
        } else if (isHighCompProxy) {
            score += 0.5; // Proxy counts for half or just weak signal
            localReasons.push('High Competition Signals (Proxy)');
        }

        // Signal 3: Revenue Volume (Protection worthiness)
        const isHighRev = (row.conv_value_paid > medianConvValue);
        // Fallback: If no revenue data, check conversions
        const isHighConvs = (!hasRevenue && conversions_paid > 0); // weak

        if (isHighRev) {
            score++;
            localReasons.push('Above Median Revenue');
        } else if (isHighConvs) {
            score += 0.5;
            localReasons.push('Has Conversions (Revenue Missing)');
        }

        // Decision
        // Strict: Organic Strong + Value + (Comp OR Rev)
        // Adjust score threshold
        // We really want Defend to be exclusive for "Winning Organic AND Good Paid".
        // If score is high enough.

        if ((isHighValue || isEfficientCpa) && (score >= 2)) {
            return {
                action: 'Defend',
                reasons: [`Strong Organic (Pos ${position_org.toFixed(1)})`, ...localReasons],
                missing_signals,
                confidence: 'high'
            };
        }

        // Fallback Defend
        if ((isHighValue) && score >= 1.5) {
            return {
                action: 'Defend',
                reasons: [`Strong Organic (Pos ${position_org.toFixed(1)})`, ...localReasons],
                missing_signals,
                confidence: 'med' // Lower confidence
            };
        }
    }

    // --- PRIORITY 3: REDUCE SPEND ---
    // Reduce Spend (strong) fires when:
    // - organic_pos <= 2
    // - paid_cost >= reduce_cost_threshold OR paid_cost in top quartile (assume high cost for now)
    // - AND (paid_roas < low_roas OR multi_channel_coverage flag)

    // Reduce Spend (light) / Or Investigate:
    // - If organic_pos in 3–4
    // - paid_cost high, roas mediocre

    const hasMultiChannel = (row.has_shopping_coverage || row.has_pmax_coverage);
    const isCostHigh = cost_paid >= CONFIG.reduce_cost_threshold;

    if (hasPaidData && (position_org > 0 && position_org <= CONFIG.organic_near_strong_pos)) {
        const isStrongOrg = position_org <= CONFIG.organic_strong_pos;
        const isPerformant = (hasRoas && roas_paid! >= CONFIG.profitable_roas); // >= 2.5

        if (isCostHigh) {
            if (hasMultiChannel) {
                return {
                    action: 'Reduce Spend',
                    reasons: [`Multi-channel coverage detected for Strong/Near-Strong Organic (Pos ${position_org.toFixed(1)})`],
                    missing_signals,
                    confidence: 'high'
                };
            }

            if (hasRoas && roas_paid! < CONFIG.low_roas) { // < 2.0
                return {
                    action: 'Reduce Spend',
                    reasons: [`Low ROAS (${roas_paid!.toFixed(2)}) with Strong/Near-Strong Organic (Pos ${position_org.toFixed(1)})`],
                    missing_signals,
                    confidence: isStrongOrg ? 'high' : 'med'
                };
            }

            // Light Reduce: Pos 3-4, Mediocre ROAS (< 2.5?)
            if (!isStrongOrg && roas_paid! < CONFIG.profitable_roas) {
                return {
                    action: 'Reduce Spend',
                    reasons: [`Mediocre ROAS (${roas_paid!.toFixed(2)}) with Near-Strong Organic (Pos ${position_org.toFixed(1)})`],
                    missing_signals,
                    confidence: 'low'
                };
            }
        }
    }

    // --- PRIORITY 4: ADD EXACT MATCH ---
    // Rule: MatchType in {Broad,Phrase} + clicks >= 10 + ROAS >= profitable_roas
    const matchTypeLower = (matchType || '').toLowerCase();
    const isBroadOrPhrase = ['broad', 'phrase', 'near_exact'].includes(matchTypeLower);

    if (isBroadOrPhrase && clicks_paid >= CONFIG.min_clicks_exact) {
        if (hasRoas && roas_paid! >= CONFIG.profitable_roas) {
            return {
                action: 'Add Exact Match',
                reasons: [`Profitable ${matchType} (ROAS ${roas_paid!.toFixed(2)})`],
                missing_signals,
                confidence: 'high'
            };
        }
    }

    // --- PRIORITY 5: SCALE SPEND ---
    // Rule: ROAS >= 4.0 + (Low Impression Share OR Budget Limited)
    if (hasRoas && roas_paid! >= CONFIG.high_roas) {
        const isLimited = (impressionShare !== null && impressionShare !== undefined && impressionShare < 0.5) ||
            (row.campaign_status_reasons?.toLowerCase().includes('budget'));

        if (isLimited) {
            return {
                action: 'Scale Spend',
                reasons: [`High ROAS (${roas_paid!.toFixed(2)}) with room to grow (Low IS or Budget Limited)`],
                missing_signals,
                confidence: 'high'
            };
        }

        // Fallback: Very High ROAS even if IS is good/missing
        if (roas_paid! >= 6.0) {
            return {
                action: 'Scale Spend',
                reasons: [`Exceptional ROAS (${roas_paid!.toFixed(2)})`],
                missing_signals,
                confidence: 'med'
            };
        }
    }

    // --- PRIORITY 6: SEO FOCUS ---
    // Rule: Organic position > 10 (or 0) + Meaningful paid activity (>= 1 click OR >= 1 conversion)
    const meaningfulPaid = clicks_paid >= 1 || conversions_paid >= 1;
    if (meaningfulPaid) {
        if (position_org === 0) {
            return {
                action: 'SEO Focus',
                reasons: ['Paying for traffic but no organic visibility'],
                missing_signals,
                confidence: 'med'
            };
        }
        if (position_org > CONFIG.organic_weak_pos) {
            return {
                action: 'SEO Focus',
                reasons: [`Weak organic rank (Pos ${position_org.toFixed(1)}) but paid activity present`],
                missing_signals,
                confidence: 'med'
            };
        }
    }

    // --- PRIORITY 7: CONSIDER PPC ---
    // Rule: Organic pos == 0 + No Paid Data + High impressions
    // Interpretation: High Organic Impressions but No Paid Spend. Validates demand.
    // If pos == 0, check impressions_org.
    // Actually, if pos=0 usually implies 'not ranked', so impressions might be 0.
    // Let's assume this means "Good organic visibility (Pos > 0) but No Paid".
    // Or "High Search Volume (Pos 0)".
    // Given the previous code: "if (position_org === 0) return 'Consider PPC'" -> implies "No organic visibility yet. Test viability..."
    // But that requires paid data usually? 
    // Regardles, let's implement the rule as: "Good Organic Traffic but No Paid Spend".
    // This is often an opportunity to bid.
    if (cost_paid === 0 && impressions_org > 500) {
        if (position_org > 0 && position_org <= 10) {
            // We rank well but don't pay. Should we?
            // Maybe if we want to "Defend" but there is no spend yet.
            return {
                action: 'Consider PPC',
                reasons: [`Good Organic traffic (Pos ${position_org}) with 0 spend. Test Ads?`],
                missing_signals,
                confidence: 'low'
            };
        }
        // If we don't rank well but have impressions (how? maybe page 2?)
        if (position_org > 10) {
            return {
                action: 'Consider PPC',
                reasons: [`Organic traffic exists (Pos ${position_org}). Ads could boost visibility.`],
                missing_signals,
                confidence: 'low'
            };
        }
    }

    // --- DEFAULT: NO ACTION ---
    return {
        action: 'No Action',
        reasons: ['No specific opportunity criteria met'],
        missing_signals,
        confidence: 'high'
    };
}
