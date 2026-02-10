/**
 * Type definitions for SEO/PPC Opportunity Finder
 */

// Action classifications for opportunities
export type OpportunityAction =
    | 'SEO Focus'
    | 'Activate PPC (Pos)'
    | 'Consider PPC'
    | 'Investigate'
    | 'Increase Spend (CTR)'
    | 'Reduce Spend'
    | 'Pause PPC'
    | 'Monitor'
    | 'Add Exact Match'   // New: Broad match with conversions
    | 'Scale Spend';      // New: High ROAS with low impression share

// Raw GSC query data
export interface GscQueryRow {
    query: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
}

// Raw Google Ads search term data
export interface AdsSearchTermRow {
    searchTerm: string;
    impressions: number;
    clicks: number;
    costMicros: number;
    ctr: number;
    averageCpc: number;
    conversions: number;
    conversionValue: number;
    campaign: string;
    adGroup: string;
    // Extended metrics
    matchType: string;
    impressionShare: number | null;
    budgetLostImpressionShare: number | null;
    rankLostImpressionShare: number | null;
    conversionRate: number;
}

// Merged opportunity row with all metrics
export interface MergedOpportunityRow {
    // Normalized query (join key)
    query: string;

    // Organic metrics (GSC)
    clicks_org: number;
    impressions_org: number;
    ctr_org: number;
    position_org: number;

    // Paid metrics (Google Ads)
    clicks_paid: number;
    impressions_paid: number;
    ctr_paid: number;
    cost_paid: number;         // In actual currency (converted from micros)
    avg_cpc_paid: number;
    conversions_paid: number;
    conv_value_paid: number;
    cpa_paid: number | null;   // null if no conversions
    roas_paid: number | null;  // null if no cost
    campaign?: string;
    adGroup?: string;

    // Extended paid metrics
    matchType?: string;
    impressionShare?: number | null;
    budgetLostImpressionShare?: number | null;
    rankLostImpressionShare?: number | null;
    conversionRate?: number;

    // Calculated KPIs
    ctr_diff: number;
    cost_per_org_click: number | null;
    seo_opportunity_score: number;
    ppc_spend_reduction_potential: number;

    // Classification
    action: OpportunityAction;
    opportunity_score: number;

    // Data source flags
    hasOrganic: boolean;
    hasPaid: boolean;
}

// SERP Analysis Types
export interface SerpResult {
    rank: number;
    title: string;
    url: string;
    snippet: string;
    domain: string;
}

export interface AiRecommendation {
    action: string;
    reasoning: string;
    impact: string;
    difficulty: "Low" | "Medium" | "High";
}

export interface SerpAnalysis {
    query: string;
    action?: OpportunityAction;
    difficulty: number;
    searchVolume: number;
    intent: "Informational" | "Commercial" | "Transactional";
    topResults: SerpResult[];
    paidResults: SerpResult[];
    serpFeatures: string[];
    aiRecommendation: AiRecommendation;
    targetRank?: number | null;
}

// DataForSEO enrichment data
export interface SerpEnrichment {
    searchVolume?: number;
    cpc?: number;
    competition?: 'Low' | 'Medium' | 'High';
    serpFeatures?: string[];
    topCompetitors?: Array<{
        position: number;
        url: string;
        domain: string;
    }>;
}

// Extended row with SERP enrichment
export interface EnrichedOpportunityRow extends MergedOpportunityRow {
    serp?: SerpEnrichment;
}

// Summary KPIs for dashboard cards
export interface OpportunitySummary {
    totalSpend: number;
    totalConversions: number;
    totalOrgClicks: number;
    totalPaidClicks: number;
    blendedCtr: number;
    opportunityCount: number;
    actionBreakdown: Record<OpportunityAction, number>;
    // Extended metrics for SEO/PPC experts
    totalConvValue: number;
    wastedSpend: number;                    // Cost on keywords with top 3 organic position
    seoOpportunityValue: number;            // Estimated savings if SEO captures traffic
    avgRoas: number | null;                 // Weighted average ROAS
    avgCpa: number | null;                  // Weighted average CPA
    avgImpressionShare: number | null;       // Weighted average impression share
}

// Google Ads customer account info
export interface GoogleAdsCustomer {
    customerId: string;
    descriptiveName: string;
    currencyCode: string;
    isManager: boolean;
}

// Date range presets
export type DatePreset = 'last7' | 'last28' | 'last90' | 'mtd' | 'qtd' | 'custom';

export interface DateRange {
    startDate: string; // YYYY-MM-DD
    endDate: string;   // YYYY-MM-DD
    preset: DatePreset;
}

// API response types
export interface AdsSearchTermsResponse {
    rows: AdsSearchTermRow[];
    totalRows: number;
    currencyCode: string;
}

export interface AdsCustomersResponse {
    customers: GoogleAdsCustomer[];
}

// Chart data types
export interface ActionChartData {
    action: OpportunityAction;
    cost_paid: number;
    clicks_org: number;
    count: number;
}

export interface ScatterPlotPoint {
    query: string;
    position_org: number;
    cost_paid: number;
    conversions_paid: number;
    action: OpportunityAction;
}

export interface ScoreDistribution {
    bucket: string;
    count: number;
    minScore: number;
    maxScore: number;
}
