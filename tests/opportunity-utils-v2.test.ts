
import { classifyActionV2, getExpectedCtrV2 } from '../lib/opportunity-utils-v2';
import { MergedOpportunityRow } from '../lib/opportunity-types';
import { SCORING_CONFIG_V2 } from '../lib/scoring-config-v2';

// Mock Row Factory
const createRow = (overrides: Partial<MergedOpportunityRow> = {}): MergedOpportunityRow => ({
    query: 'test query',
    clicks_org: 0,
    impressions_org: 0,
    ctr_org: 0,
    position_org: 0,
    clicks_paid: 0,
    impressions_paid: 0,
    ctr_paid: 0,
    cost_paid: 0,
    conversions_paid: 0,
    conv_value_paid: 0,
    roas_paid: null,
    cpa_paid: null,
    avg_cpc_paid: 0,
    matchType: 'broad',
    impressionShare: null,
    competition_score: 0,
    competition_source: 'keyword_level',
    has_shopping_coverage: false,
    has_pmax_coverage: false,
    ctr_diff: 0,
    cost_per_org_click: null,
    seo_opportunity_score: 0,
    ppc_spend_reduction_potential: 0,
    hasOrganic: false,
    hasPaid: false,
    is_primary_channel: true,
    isBrand: false,
    revenueWeight: 0,
    merge_level: 'default',
    keyword_search_impr_share: null,
    keyword_search_lost_is_rank: null,
    keyword_impr_top_pct: null,
    keyword_impr_abs_top_pct: null,

    // Default Scores
    opportunity_score: 0,
    projected_savings_score: 0,
    projected_growth_score: 0,
    strategic_tier: 'Informational',
    action: 'No Action',

    ...overrides
});

const DEFAULT_MEDIANS = {
    accountAvgRoas: 2.5,
    medianCost: 10,
    medianConvValue: 50,
    medianCpc: 1.5,
    medianCpa: 20
};

describe('classifyActionV2', () => {

    // --- Priority 1: Investigate ---
    test('should return Investigate for High Spends with 0 Conversions', () => {
        const row = createRow({
            cost_paid: 100, // > threshold (50)
            conversions_paid: 0
        });

        const result = classifyActionV2(row, null, DEFAULT_MEDIANS.medianCost, DEFAULT_MEDIANS.medianConvValue, DEFAULT_MEDIANS.medianCpc, DEFAULT_MEDIANS.medianCpa);
        expect(result.action).toBe('Investigate');
        expect(result.confidence).toBe('high');
        expect(result.reasons[0]).toContain('High Spend');
    });

    test('should return Investigate for Strong Organic Rank but Poor CTR', () => {
        const pos = 1;
        const expectedCtr = getExpectedCtrV2(pos); // e.g. 0.27
        const poorCtr = expectedCtr * 0.4; // < 50%

        const row = createRow({
            position_org: pos,
            ctr_org: poorCtr,
            impressions_org: 200, // Statistical significance for CTR check
            clicks_org: 10 // implied
        });

        const result = classifyActionV2(row, null, DEFAULT_MEDIANS.medianCost, DEFAULT_MEDIANS.medianConvValue, DEFAULT_MEDIANS.medianCpc, DEFAULT_MEDIANS.medianCpa);
        expect(result.action).toBe('Investigate');
        expect(result.reasons[0]).toContain('Organic CTR');
    });

    // --- Priority 2: Defend ---
    test('should return Defend for Strong Organic + High ROAS + High Competition', () => {
        const row = createRow({
            position_org: 1, // Strong
            roas_paid: 5.0, // High (> 4.0)
            competition_score: 70, // High (> 60)
            cost_paid: 20,
            conversions_paid: 2
        });

        const result = classifyActionV2(row, null, DEFAULT_MEDIANS.medianCost, DEFAULT_MEDIANS.medianConvValue, DEFAULT_MEDIANS.medianCpc, DEFAULT_MEDIANS.medianCpa);
        expect(result.action).toBe('Defend');
        expect(result.reasons.join(',')).toContain('High ROAS');
    });

    test('should return Defend for Strong Organic + Efficient CPA + High Comp', () => {
        const row = createRow({
            position_org: 1,
            roas_paid: null, // No ROAS
            cpa_paid: 15, // < median (20)
            competition_score: 80,
            cost_paid: 30,
            conversions_paid: 2,
            clicks_paid: 10
        });

        const result = classifyActionV2(row, null, DEFAULT_MEDIANS.medianCost, DEFAULT_MEDIANS.medianConvValue, DEFAULT_MEDIANS.medianCpc, DEFAULT_MEDIANS.medianCpa);
        expect(result.action).toBe('Defend');
        expect(result.reasons.join(',')).toContain('Efficient CPA');
    });

    // --- Priority 3: Reduce Spend ---
    test('should return Reduce Spend for Strong Organic + High Cost + Low ROAS', () => {
        const row = createRow({
            position_org: 1,
            cost_paid: 80, // > 75
            roas_paid: 1.5, // < 2.0
            clicks_paid: 50,
            conversions_paid: 5, // Ensure not 0 to avoid Investigate
            ctr_org: 0.2 // Good CTR to avoid Investigate
        });

        const result = classifyActionV2(row, null, DEFAULT_MEDIANS.medianCost, DEFAULT_MEDIANS.medianConvValue, DEFAULT_MEDIANS.medianCpc, DEFAULT_MEDIANS.medianCpa);
        expect(result.action).toBe('Reduce Spend');
        expect(result.reasons[0]).toContain('Low ROAS');
    });

    test('should return Reduce Spend for Strong Organic + High Cost + Multi-channel coverage', () => {
        const row = createRow({
            position_org: 1,
            cost_paid: 100,
            has_pmax_coverage: true,
            roas_paid: 3.0,
            conversions_paid: 10, // Ensure not 0
            clicks_paid: 100,
            ctr_org: 0.2 // Good CTR
        });

        const result = classifyActionV2(row, null, DEFAULT_MEDIANS.medianCost, DEFAULT_MEDIANS.medianConvValue, DEFAULT_MEDIANS.medianCpc, DEFAULT_MEDIANS.medianCpa);
        expect(result.action).toBe('Reduce Spend');
        expect(result.reasons[0]).toContain('Multi-channel coverage');
    });

    // --- Priority 4: Add Exact Match ---
    test('should return Add Exact Match for Profitable Broad/Phrase queries', () => {
        const row = createRow({
            matchType: 'broad',
            clicks_paid: 15, // > 10
            roas_paid: 3.0 // > 2.5 (profitable)
        });

        const result = classifyActionV2(row, null, DEFAULT_MEDIANS.medianCost, DEFAULT_MEDIANS.medianConvValue, DEFAULT_MEDIANS.medianCpc, DEFAULT_MEDIANS.medianCpa);
        expect(result.action).toBe('Add Exact Match');
    });

    // --- Priority 5: Scale Spend ---
    test('should return Scale Spend for High ROAS + Low Impression Share', () => {
        const row = createRow({
            roas_paid: 4.5, // > 4.0
            impressionShare: 0.3, // < 0.5
            cost_paid: 10
        });

        const result = classifyActionV2(row, null, DEFAULT_MEDIANS.medianCost, DEFAULT_MEDIANS.medianConvValue, DEFAULT_MEDIANS.medianCpc, DEFAULT_MEDIANS.medianCpa);
        expect(result.action).toBe('Scale Spend');
        expect(result.reasons[0]).toContain('Low IS');
    });

    // --- Priority 6: SEO Focus ---
    test('should return SEO Focus for Weak Organic + Paid Activity', () => {
        const row = createRow({
            position_org: 15, // > 10
            clicks_paid: 5,
            conversions_paid: 0
        });

        const result = classifyActionV2(row, null, DEFAULT_MEDIANS.medianCost, DEFAULT_MEDIANS.medianConvValue, DEFAULT_MEDIANS.medianCpc, DEFAULT_MEDIANS.medianCpa);
        expect(result.action).toBe('SEO Focus');
    });

    // --- Priority 7: Consider PPC ---
    test('should return Consider PPC for Good Organic Rank + No Paid Spend', () => {
        const row = createRow({
            position_org: 5,
            cost_paid: 0,
            impressions_org: 600, // > 500
            clicks_org: 30, // 5% CTR
            ctr_org: 0.05,
            conversions_paid: 0
        });

        const result = classifyActionV2(row, null, DEFAULT_MEDIANS.medianCost, DEFAULT_MEDIANS.medianConvValue, DEFAULT_MEDIANS.medianCpc, DEFAULT_MEDIANS.medianCpa);
        expect(result.action).toBe('Consider PPC');
    });

    // --- Default ---
    test('should return No Action when no criteria met', () => {
        const row = createRow({
            position_org: 50,
            cost_paid: 5, // Low spend
            conversions_paid: 0,
            impressions_org: 10,
            clicks_paid: 0
        });

        const result = classifyActionV2(row, null, DEFAULT_MEDIANS.medianCost, DEFAULT_MEDIANS.medianConvValue, DEFAULT_MEDIANS.medianCpc, DEFAULT_MEDIANS.medianCpa);
        expect(result.action).toBe('No Action');
    });

});
