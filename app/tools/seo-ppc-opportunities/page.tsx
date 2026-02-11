"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import Papa from "papaparse";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    ScatterChart,
    Scatter,
    Cell,
    ZAxis,
} from "recharts";
import {
    Search,
    Download,
    RefreshCw,
    ChevronDown,
    ChevronUp,
    ArrowUpDown,
    Filter,
    Loader2,
    AlertCircle,
    CheckCircle,
    TrendingUp,
    DollarSign,
    MousePointer,
    Target,
    BarChart3,
    Info,
    X,
    Sparkles,
    LayoutDashboard,
    LogOut,
    ArrowLeft,
    User,
    AlertTriangle,
    Wallet,
    Percent,
    Zap,
    Eye,
    Upload,
    Check,
    Globe,
} from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";

import {
    MergedOpportunityRow,
    OpportunityAction,
    GscQueryRow,
    AdsSearchTermRow,
    GoogleAdsCustomer,
    DatePreset,
    SerpAnalysis,
} from "@/lib/opportunity-types";
import {
    mergeDatasets,
    calculateSummary,
    prepareActionChartData,
    prepareScatterData,
    prepareScoreDistribution,
    generateMockData,
    generateMockSerpAnalysis,
    formatCurrency,
    formatPercent,
    formatNumber,
    getActionColor,
    getActionReason,
} from "@/lib/opportunity-utils";

// Date preset options
const DATE_PRESETS: { value: DatePreset; label: string }[] = [
    { value: "last7", label: "Last 7 Days" },
    { value: "last28", label: "Last 28 Days" },
    { value: "last90", label: "Last 90 Days" },
    { value: "mtd", label: "Month to Date" },
    { value: "qtd", label: "Quarter to Date" },
    { value: "custom", label: "Custom Range" },
];

// Calculate date range from preset
function getDateRangeFromPreset(preset: DatePreset): { start: Date; end: Date } {
    const end = new Date();
    end.setDate(end.getDate() - 1); // Yesterday

    let start = new Date();

    switch (preset) {
        case "last7":
            start.setDate(end.getDate() - 7);
            break;
        case "last28":
            start.setDate(end.getDate() - 28);
            break;
        case "last90":
            start.setDate(end.getDate() - 90);
            break;
        case "mtd":
            start = new Date(end.getFullYear(), end.getMonth(), 1);
            break;
        case "qtd":
            const quarter = Math.floor(end.getMonth() / 3);
            start = new Date(end.getFullYear(), quarter * 3, 1);
            break;
        default:
            start.setDate(end.getDate() - 28);
    }

    return { start, end };
}

function formatDateForApi(date: Date): string {
    return date.toISOString().split("T")[0] as string;
}

// Action badge component
function ActionBadge({ action }: { action: OpportunityAction }) {
    const color = getActionColor(action);
    return (
        <span
            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap border"
            style={{
                backgroundColor: `${color}15`,
                color: color,
                borderColor: `${color}30`
            }}
        >
            {action}
        </span>
    );
}

const ACTION_DEFINITIONS: Record<string, { definition: string; rule: string; color: string }> = {
    "Add Exact Match": {
        definition: "High-performing broad or phrase match keywords that should be added as exact match to improve control and efficiency.",
        rule: "Broad/Phrase match with >=1 conversion and ROAS >= 2.",
        color: "#06b6d4"
    },
    "Scale Spend": {
        definition: "Highly profitable keywords that are losing volume due to budget or bid constraints.",
        rule: "ROAS >= 4 and Impression Share < 50%.",
        color: "#22c55e"
    },
    "SEO Focus": {
        definition: "Proven converting keywords with low organic visibility. High-impact targets for SEO content/optimization.",
        rule: "Organic position > 10 (or 0) AND meaningful paid activity (>=1 click/conv).",
        color: "#10b981"
    },
    "Pause PPC": {
        definition: "Keywords where organic ranking is strong enough to capture traffic, while paid ads are underperforming.",
        rule: "Organic position 1-3 AND paid ROAS < 2.",
        color: "#ec4899"
    },
    "Reduce Spend": {
        definition: "Keywords with strong organic presence where PPC is stable but not highly profitable.",
        rule: "Organic position 1-3 but paid ROAS < 4.",
        color: "#ef4444"
    },
    "Investigate": {
        definition: "Keywords with good organic rank but unexpectedly low CTR. Suggests title/meta tag or relevance issues.",
        rule: "Organic position 1-10 but CTR < 50% of expected benchmark.",
        color: "#f59e0b"
    },
    "Increase Spend (CTR)": {
        definition: "Profitable keywords with decent organic ranking on Page 1 that could benefit from more aggressive bidding.",
        rule: "Organic position 4-10 and paid ROAS >= 4.",
        color: "#8b5cf6"
    },
    "Consider PPC": {
        definition: "Potential opportunities where organic visibility is zero. Test with PPC to gauge conversion potential.",
        rule: "Organic position 0, high impressions, but no existing paid data.",
        color: "#6366f1"
    }
};

function ActionLegend({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
    return (
        <div className="space-y-2">
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
            >
                <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-bold text-gray-900 dark:text-white">Action Legend</span>
                </div>
                {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>

            {expanded && (
                <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4 animate-in slide-in-from-top-2 duration-200">
                    {Object.entries(ACTION_DEFINITIONS).map(([action, info]) => (
                        <div key={action} className="space-y-1 pb-3 border-b border-gray-100 dark:border-gray-700 last:border-0 last:pb-0">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: info.color }}></div>
                                <span className="text-xs font-bold text-gray-800 dark:text-gray-200">{action}</span>
                            </div>
                            <p className="text-[11px] text-gray-600 dark:text-gray-400 leading-snug">
                                {info.definition}
                            </p>
                            <div className="text-[9px] font-mono text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded border border-blue-100 dark:border-blue-800 inline-block mt-1">
                                Rule: {info.rule}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// KPI Card component
function KpiCard({
    title,
    value,
    subtitle,
    icon: Icon,
    trend,
}: {
    title: string;
    value: string;
    subtitle?: string;
    icon: React.ComponentType<{ className?: string }>;
    trend?: "up" | "down" | "neutral";
}) {
    return (
        <div
            className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700"
        >
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                        {value}
                    </p>
                    {subtitle && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                            {subtitle}
                        </p>
                    )}
                </div>
                <div
                    className={`p-3 rounded-lg ${trend === "up"
                        ? "bg-green-100 dark:bg-green-900/30"
                        : trend === "down"
                            ? "bg-red-100 dark:bg-red-900/30"
                            : "bg-blue-100 dark:bg-blue-900/30"
                        }`}
                >
                    <Icon
                        className={`w-6 h-6 ${trend === "up"
                            ? "text-green-600 dark:text-green-400"
                            : trend === "down"
                                ? "text-red-600 dark:text-red-400"
                                : "text-blue-600 dark:text-blue-400"
                            }`}
                    />
                </div>
            </div>
        </div>
    );
}

// Quick Win Card Component
function QuickWinCard({
    title,
    opportunities,
    icon: Icon,
    iconColorClass,
    subtitle,
    valueFormatter,
    valueKey
}: {
    title: string;
    opportunities: MergedOpportunityRow[];
    icon: any;
    iconColorClass: string;
    subtitle: string;
    valueFormatter: (v: any) => string;
    valueKey: keyof MergedOpportunityRow;
}) {
    if (!opportunities?.length) return null;

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700 h-full flex flex-col">
            <div className="flex items-center gap-3 mb-4">
                <div className={`p-2 rounded-lg ${iconColorClass} bg-opacity-10 text-opacity-100`}>
                    <Icon className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>
                </div>
            </div>
            <div className="space-y-3 flex-1 overflow-y-auto max-h-[200px] pr-2 custom-scrollbar">
                {opportunities.map((op, i) => (
                    <div key={i} className="flex justify-between items-center text-sm border-b border-gray-100 dark:border-gray-700 pb-2 last:border-0 last:pb-0 hover:bg-gray-50 dark:hover:bg-gray-700/50 p-1.5 rounded transition-colors group">
                        <div className="truncate pr-4 flex-1">
                            <p className="font-medium text-gray-800 dark:text-gray-200 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" title={op.query}>
                                {op.query}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                <span>Pos: {op.position_org > 0 ? op.position_org.toFixed(1) : '-'}</span>
                                <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                <span>Vol: {formatNumber(op.impressions_paid + op.impressions_org)}</span>
                            </p>
                        </div>
                        <div className="text-right whitespace-nowrap">
                            <p className="font-bold text-gray-900 dark:text-white">{valueFormatter(op[valueKey])}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function SeoPpcOpportunitiesPage() {
    const { data: session, status } = useSession();

    // State
    const [mockMode, setMockMode] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState<string>("");

    // GSC state
    const [gscProperties, setGscProperties] = useState<string[]>([]);
    const [selectedProperty, setSelectedProperty] = useState<string>("");

    // Google Ads state
    const [adsCustomers, setAdsCustomers] = useState<GoogleAdsCustomer[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<string>("");

    // Date range state
    const [datePreset, setDatePreset] = useState<DatePreset>("last28");
    const [customStartDate, setCustomStartDate] = useState<string>("");
    const [customEndDate, setCustomEndDate] = useState<string>("");

    // Data state
    const [data, setData] = useState<MergedOpportunityRow[]>([]);
    const [rawGscData, setRawGscData] = useState<GscQueryRow[]>([]);
    const [rawAdsData, setRawAdsData] = useState<AdsSearchTermRow[]>([]);
    const [missingImpressionShareColumn, setMissingImpressionShareColumn] = useState<boolean>(false);
    const [currencyCode, setCurrencyCode] = useState<string>("GBP");

    // Table state
    const [sortKey, setSortKey] = useState<keyof MergedOpportunityRow>("opportunity_score");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

    // Merge data whenever raw sources change
    useEffect(() => {
        if (rawGscData.length || rawAdsData.length) {
            const merged = mergeDatasets(rawGscData, rawAdsData);
            setData(merged);
        }
    }, [rawGscData, rawAdsData]);
    const [filterActions, setFilterActions] = useState<OpportunityAction[]>([]);
    const toggleAction = (action: OpportunityAction) => {
        setFilterActions(prev =>
            prev.includes(action)
                ? prev.filter(a => a !== action)
                : [...prev, action]
        );
    };
    const [filterCampaign, setFilterCampaign] = useState<string>("all");
    const [filterAdGroup, setFilterAdGroup] = useState<string>("all");
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [showTop, setShowTop] = useState<number>(100);

    // File upload ref
    const fileInputRef = useRef<HTMLInputElement>(null);
    const fileInputRefGsc = useRef<HTMLInputElement>(null);

    // Analysis state
    const [analysisModalOpen, setAnalysisModalOpen] = useState(false);
    const [analysisData, setAnalysisData] = useState<SerpAnalysis | null>(null);
    const [analysisLoading, setAnalysisLoading] = useState(false);
    const [analysisError, setAnalysisError] = useState<string | null>(null);

    // Chart filters
    const [scatterPositionFilter, setScatterPositionFilter] = useState<string>("top3");

    // Collapsible sections
    const [expandedSections, setExpandedSections] = useState({
        kpis: true,
        charts: true,
        table: true,
        legend: false, // Hidden by default
    });

    const clearAllData = useCallback(() => {
        setData([]);
        setRawGscData([]);
        setRawAdsData([]);
        setSelectedProperty("");
        setError(null);
        setProgress("");
        setAnalysisData(null);
    }, []);

    // Clear data when switching between Demo and Live mode
    useEffect(() => {
        clearAllData();
    }, [mockMode, clearAllData]);

    // Toggle section visibility
    const toggleSection = (section: keyof typeof expandedSections) => {
        setExpandedSections(prev => ({
            ...prev,
            [section]: !prev[section],
        }));
    };


    // Calculate date range
    const dateRange = useMemo(() => {
        if (datePreset === "custom" && customStartDate && customEndDate) {
            return {
                start: new Date(customStartDate),
                end: new Date(customEndDate),
            };
        }
        return getDateRangeFromPreset(datePreset);
    }, [datePreset, customStartDate, customEndDate]);

    // Fetch and update data
    const handleFetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        setProgress("Starting data fetch...");

        // Clear existing data to avoid stale state
        setData([]);
        setRawGscData([]);
        setRawAdsData([]);

        try {
            const startDate = formatDateForApi(dateRange.start);
            const endDate = formatDateForApi(dateRange.end);

            if (mockMode) {
                setProgress("Generating mock data...");
                await new Promise((r) => setTimeout(r, 500));
                const mockData = generateMockData();

                // Update raw state - effect will trigger merge
                setRawGscData(mockData.gscData);
                setRawAdsData(mockData.adsData);
                setCurrencyCode("GBP");

                setProgress("");
                setLoading(false);
                return;
            }

            // Fetch GSC data
            setProgress("Fetching Google Search Console data...");
            let gscData: GscQueryRow[] = [];

            if (selectedProperty) {
                const gscRes = await fetch("/api/gsc/query", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        siteUrl: selectedProperty,
                        startDate,
                        endDate,
                        dimensions: ["query"],
                        rowLimit: 25000,
                    }),
                });

                if (gscRes.ok) {
                    const gscJson = await gscRes.json();
                    gscData = (gscJson.rows || []).map((row: { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }) => ({
                        query: row.keys[0],
                        clicks: row.clicks,
                        impressions: row.impressions,
                        ctr: row.ctr,
                        position: row.position,
                    }));
                } else {
                    console.warn("GSC fetch failed:", await gscRes.text());
                }
            }

            // Fetch Google Ads data
            setProgress("Fetching Google Ads data...");
            let adsData: AdsSearchTermRow[] = [];
            let adsCurrency = "GBP";

            if (selectedCustomer) {
                const adsRes = await fetch("/api/google-ads/search-terms", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        customerId: selectedCustomer,
                        startDate,
                        endDate,
                    }),
                });

                if (adsRes.ok) {
                    const adsJson = await adsRes.json();
                    adsData = adsJson.rows || [];
                    adsCurrency = adsJson.currencyCode || "GBP";
                } else {
                    console.warn("Ads fetch failed:", await adsRes.text());
                }
            }

            // Set raw data - merge effect will run
            setRawGscData(gscData);
            setRawAdsData(adsData);
            setCurrencyCode(adsCurrency);

            setProgress("");

        } catch (e) {
            console.error("Error fetching data:", e);
            const err = String(e);
            if (err.includes("SyntaxError") || err.includes("JSON")) {
                setError("API Error: Received invalid response. Try using Manual CSV Upload instead.");
            } else {
                setError(err);
            }
        } finally {
            setLoading(false);
        }
    }, [mockMode, selectedProperty, selectedCustomer, dateRange]);

    // Handle CSV Upload for GSC
    const handleGscFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setProgress("Parsing GSC CSV...");

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                try {
                    const rows = results.data as Record<string, any>[];
                    if (!rows || rows.length === 0) {
                        setError('GSC CSV appears empty or invalid.');
                        setProgress("");
                        return;
                    }

                    // Helper to clean number strings
                    const cleanNumber = (val: any): number => {
                        if (typeof val === 'number') return val;
                        if (!val) return 0;
                        return parseFloat(String(val).replace(/[,%]/g, '').trim()) || 0;
                    };

                    const gscRows: GscQueryRow[] = rows
                        .filter(row => (row['Top queries'] || row['Query'] || row['query']))
                        .map(row => {
                            const query = row['Top queries'] || row['Query'] || row['query'] || '';
                            const clicks = cleanNumber(row['Clicks'] || row['clicks']);
                            const impressions = cleanNumber(row['Impressions'] || row['impressions']);
                            const posVal = row['Position'] || row['position'];
                            const position = cleanNumber(posVal);

                            // Handle CTR %
                            let finalCtr = 0;
                            const ctrVal = row['CTR'] || row['ctr'];
                            if (typeof ctrVal === 'string' && ctrVal.includes('%')) {
                                finalCtr = parseFloat(ctrVal.replace('%', '')) / 100;
                            } else {
                                finalCtr = cleanNumber(ctrVal);
                            }

                            return {
                                query,
                                clicks,
                                impressions,
                                ctr: finalCtr,
                                position
                            };
                        });

                    if (gscRows.length === 0) {
                        setError("No valid queries found in CSV. Expected column 'Top queries' or 'Query'.");
                        setProgress("");
                        return;
                    }

                    setRawGscData(gscRows);
                    setProgress("");
                    setError(null);

                    // Reset input
                    if (fileInputRefGsc.current) fileInputRefGsc.current.value = '';

                } catch (e) {
                    console.error("GSC CSV Parse Error:", e);
                    setError("Failed to parse GSC CSV: " + String(e));
                    setProgress("");
                }
            },
            error: (err) => {
                setError("GSC CSV Error: " + err.message);
                setProgress("");
            }
        });
    };

    // Handle CSV Upload for Google Ads
    const handleAdsFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setProgress("Parsing CSV...");

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                try {
                    const rows = results.data as Record<string, any>[];
                    if (!rows || rows.length === 0) {
                        setError('CSV appears empty or invalid.');
                        setProgress("");
                        return;
                    }

                    // Helper to clean currency/number strings
                    const cleanNumber = (val: any): number => {
                        if (typeof val === 'number') return val;
                        if (!val) return 0;
                        // Handle commas, currency symbols, percentages
                        return parseFloat(String(val).replace(/[£$,%]/g, '').trim()) || 0;
                    };

                    // Helper for percentages (e.g. "10.5%" -> 0.105, "< 10%" -> 0.05)
                    const cleanPercent = (val: any): number | null => {
                        if (val === null || val === undefined || val === '') return null;
                        const str = String(val).trim();
                        if (str === '--') return null;
                        if (str.includes('< 10%')) return 0.05;
                        if (str.includes('> 90%')) return 0.95;

                        const num = parseFloat(str.replace(/[%]/g, ''));
                        if (isNaN(num)) return null;

                        // If string had %, divide by 100. If it was just "0.5", assume it's ratio? 
                        // Actually, CSV export usually puts "10.5%" or just "10.5" meaning percent.
                        // Standardize: if > 1, assume it's percentage (e.g. 10.5 -> 0.105). 
                        // If < 1, ambiguity exists, but usually IS is > 1% if meaningful.
                        // Safest assumption for Google Ads CSV: it's a percentage value (0-100).
                        if (str.includes('%')) return num / 100;
                        return num <= 1 ? num : num / 100;
                    };

                    // Check for Impression Share column existence
                    const sampleRow = rows[0] || {};
                    const hasImpressionShare =
                        'Search Impr. share' in sampleRow ||
                        'Impr. share' in sampleRow ||
                        'Search impression share' in sampleRow;

                    const hasTopImpression = 'Impr. (Top) %' in sampleRow || 'Impr. (Abs. Top) %' in sampleRow;

                    const adsRows: AdsSearchTermRow[] = rows
                        .filter(row => {
                            const searchTerm = row['Search term'] || row['Search keyword'] || row['Keyword'];

                            // Skip if no search term
                            if (!searchTerm) return false;

                            // Skip Google Ads metadata rows
                            const term = String(searchTerm).toLowerCase().trim();

                            // Skip header rows (e.g., "Search terms report", report titles)
                            if (term.includes('report') || term.includes('january') || term.includes('february') ||
                                term.includes('march') || term.includes('april') || term.includes('may') ||
                                term.includes('june') || term.includes('july') || term.includes('august') ||
                                term.includes('september') || term.includes('october') || term.includes('november') ||
                                term.includes('december')) {
                                return false;
                            }

                            // Skip total rows (e.g., "Total: Search terms", "Total: Other search terms")
                            if (term.startsWith('total:') || term.startsWith('total ')) {
                                return false;
                            }

                            return true;
                        })
                        .map(row => {
                            const cost = cleanNumber(row['Cost'] || row['cost']);
                            const clicks = cleanNumber(row['Clicks'] || row['clicks']);
                            const impressions = cleanNumber(row['Impr.'] || row['Impressions'] || row['impressions']);
                            const conversions = cleanNumber(row['Conversions'] || row['conversions']);
                            const convValue = cleanNumber(row['Conv. value'] || row['Total conv. value'] || row['conversion_value']);

                            // Try to get impression share from primary columns first
                            let distinctImpressionShare = cleanPercent(
                                row['Search Impr. share'] ||
                                row['Impr. share'] ||
                                row['Search impression share']
                            );

                            // If not found, use Top Impression % columns as fallback
                            // Note: These are different metrics but can provide useful data
                            if (distinctImpressionShare === null) {
                                const topImpr = cleanPercent(row['Impr. (Top) %']);
                                const absTopImpr = cleanPercent(row['Impr. (Abs. Top) %']);

                                // Prefer Abs. Top if available, otherwise use Top
                                if (absTopImpr !== null) {
                                    distinctImpressionShare = absTopImpr;
                                } else if (topImpr !== null) {
                                    distinctImpressionShare = topImpr;
                                }
                            }

                            return {
                                searchTerm: row['Search term'] || row['Search keyword'] || row['Keyword'] || '',
                                costMicros: cost * 1_000_000,
                                impressions,
                                clicks,
                                conversions,
                                conversionValue: convValue,
                                ctr: impressions > 0 ? clicks / impressions : 0,
                                averageCpc: clicks > 0 ? cost / clicks : 0,
                                campaign: row['Campaign'] || 'Uploaded CSV',
                                adGroup: row['Ad group'] || 'Uploaded CSV',
                                matchType: row['Match type'] || 'Broad',
                                impressionShare: distinctImpressionShare,
                                budgetLostImpressionShare: cleanPercent(row['Search lost IS (budget)']),
                                rankLostImpressionShare: cleanPercent(row['Search lost IS (rank)']),
                                conversionRate: clicks > 0 ? conversions / clicks : 0
                            };
                        });

                    if (adsRows.length === 0) {
                        setError("No valid search terms found in CSV. Expected column 'Search term'.");
                        setProgress("");
                        return;
                    }

                    setRawAdsData(adsRows);
                    // Only flag as missing if we don't have ANY impression share data (neither main nor top columns)
                    setMissingImpressionShareColumn(!hasImpressionShare && !hasTopImpression);
                    setProgress("");
                    setError(null);

                    // Reset input
                    if (fileInputRef.current) fileInputRef.current.value = '';

                } catch (e) {
                    console.error("CSV Parse Error:", e);
                    setError("Failed to parse CSV: " + String(e));
                    setProgress("");
                }
            },
            error: (err) => {
                setError("CSV Error: " + err.message);
                setProgress("");
            }
        });
    };

    // Unique campaigns and ad groups
    const uniqueCampaigns = useMemo(() => {
        const campaigns = new Set(data.map(r => r.campaign).filter(Boolean));
        return Array.from(campaigns).sort();
    }, [data]);

    const uniqueAdGroups = useMemo(() => {
        const groups = new Set(data.map(r => r.adGroup).filter(Boolean));
        return Array.from(groups).sort();
    }, [data]);

    // Filtered and sorted data
    const filteredData = useMemo(() => {
        let result = [...data];

        // Filter by action
        if (filterActions.length > 0) {
            result = result.filter((r) => filterActions.includes(r.action));
        }

        // Filter by campaign
        if (filterCampaign !== "all") {
            result = result.filter((r) => r.campaign === filterCampaign);
        }

        // Filter by ad group
        if (filterAdGroup !== "all") {
            result = result.filter((r) => r.adGroup === filterAdGroup);
        }

        // Filter by search query
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter((r) => r.query.toLowerCase().includes(q));
        }
        // Sort
        result.sort((a, b) => {
            const aVal = a[sortKey];
            const bVal = b[sortKey];

            if (typeof aVal === "string" && typeof bVal === "string") {
                return sortDir === "asc"
                    ? aVal.localeCompare(bVal)
                    : bVal.localeCompare(aVal);
            }

            const aNum = Number(aVal) || 0;
            const bNum = Number(bVal) || 0;
            return sortDir === "asc" ? aNum - bNum : bNum - aNum;
        });

        return result;
    }, [data, filterActions, filterCampaign, filterAdGroup, searchQuery, sortKey, sortDir]);

    // Summary stats - calculate from filtered data
    const summary = useMemo(() => calculateSummary(filteredData), [filteredData]);

    // Quick Wins Logic (Top 5 based on current filters)
    const quickWins = useMemo(() => {
        if (!filteredData.length) return null;

        // Use filtered dataset so quick wins reflect current view
        const pausePpc = [...filteredData]
            .filter(r => r.action === 'Pause PPC')
            .sort((a, b) => b.cost_paid - a.cost_paid)
            .slice(0, 5);

        const scaleSpend = [...filteredData]
            .filter(r => r.action === 'Scale Spend')
            .sort((a, b) => (b.roas_paid || 0) - (a.roas_paid || 0))
            .slice(0, 5);

        const seoFocus = [...filteredData]
            .filter(r => r.action === 'SEO Focus')
            .sort((a, b) => b.conversions_paid - a.conversions_paid)
            .slice(0, 5);

        return { pausePpc, scaleSpend, seoFocus };
    }, [filteredData]);

    // Chart data - calculate from filtered data
    const actionChartData = useMemo(() => prepareActionChartData(filteredData), [filteredData]);


    const scatterData = useMemo(() => {
        let dataToUse = filteredData;

        if (scatterPositionFilter === "top3") {
            dataToUse = dataToUse.filter(r => r.position_org > 0 && r.position_org <= 3);
        } else if (scatterPositionFilter === "top10") {
            dataToUse = dataToUse.filter(r => r.position_org > 0 && r.position_org <= 10);
        } else if (scatterPositionFilter === "pos11-20") {
            dataToUse = dataToUse.filter(r => r.position_org >= 11 && r.position_org <= 20);
        } else if (scatterPositionFilter === "no-rank") {
            dataToUse = dataToUse.filter(r => r.position_org === 0);
        }

        return prepareScatterData(dataToUse, 200);
    }, [filteredData, scatterPositionFilter]);

    const scoreDistribution = useMemo(() => prepareScoreDistribution(filteredData), [filteredData]);

    // Handle sort
    const handleSort = (key: keyof MergedOpportunityRow) => {
        if (sortKey === key) {
            setSortDir(sortDir === "asc" ? "desc" : "asc");
        } else {
            setSortKey(key);
            setSortDir("desc");
        }
    };

    // Export to CSV
    const handleExportCsv = () => {
        if (!filteredData.length) return;

        const headers = [
            "Action",
            "Campaign",
            "Ad Group",
            "Query",
            "Organic Clicks",
            "Organic Impressions",
            "Organic CTR",
            "Position",
            "Paid Clicks",
            "Paid Impressions",
            "Paid CTR",
            "Cost",
            "Avg CPC",
            "Conversions",
            "Conv Value",
            "CPA",
            "ROAS",
            "Opportunity Score",
        ];

        const rows = filteredData.map((r) => [
            r.action,
            r.campaign || "",
            r.adGroup || "",
            `"${r.query.replace(/"/g, '""')}"`,
            r.clicks_org,
            r.impressions_org,
            formatPercent(r.ctr_org),
            r.position_org.toFixed(1),
            r.clicks_paid,
            r.impressions_paid,
            formatPercent(r.ctr_paid),
            r.cost_paid.toFixed(2),
            r.avg_cpc_paid.toFixed(2),
            r.conversions_paid.toFixed(2),
            r.conv_value_paid.toFixed(2),
            r.cpa_paid?.toFixed(2) || "",
            r.roas_paid?.toFixed(2) || "",
            r.opportunity_score.toFixed(2),
        ]);

        const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `seo-ppc-opportunities-${formatDateForApi(new Date())}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };





    const handleAnalyzeQuery = async (query: string, action: OpportunityAction) => {
        setAnalysisModalOpen(true);
        setAnalysisLoading(true);
        setAnalysisData(null);
        setAnalysisError(null);

        try {
            // Get reasoning from local data
            const row = data.find(r => r.query === query);
            const reasoning = row
                ? getActionReason(row, action)
                : "Unable to retrieve specific performance metrics for this query.";

            // Determine target domain from selected property
            let targetDomain = selectedProperty || "";
            if (targetDomain.startsWith('sc-domain:')) {
                targetDomain = targetDomain.replace('sc-domain:', '');
            } else if (targetDomain.startsWith('http')) {
                try {
                    targetDomain = new URL(targetDomain).hostname;
                } catch (e) {
                    console.warn("Could not parse target domain URL", e);
                }
            }

            // Call API
            const response = await fetch('/api/serp-analysis', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    keyword: query,
                    targetDomain
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Failed to fetch SERP analysis: ${response.status}`);
            }

            const apiData = await response.json();

            // Construct analysis object
            // Use defaults for difficulty/volume if API doesn't return them yet
            const analysis: SerpAnalysis = {
                query,
                action,
                difficulty: apiData.difficulty || 45, // Placeholder
                searchVolume: apiData.searchVolume || (row ? row.impressions_org + row.impressions_paid : 0),
                intent: apiData.intent || "Commercial", // Placeholder
                topResults: apiData.topResults || [],
                paidResults: apiData.paidResults || [],
                serpFeatures: apiData.serpFeatures || [],
                aiRecommendation: {
                    action: action,
                    reasoning: reasoning, // Use our generated reason
                    impact: "High", // Placeholder
                    difficulty: "Medium" // Placeholder
                },
                targetRank: apiData.targetRank
            };

            setAnalysisData(analysis);

        } catch (error) {
            console.error("Analysis Error:", error);
            const errorMessage = error instanceof Error ? error.message : String(error);

            // Set specific error message for missing credentials
            if (errorMessage.includes("Missing DataForSEO credentials") || errorMessage.includes("500")) {
                setAnalysisError("DataForSEO credentials missing. Please add DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD to your .env file.");
                setAnalysisData(null); // Explicitly clear data so we don't show stale/mock data
            } else {
                // Fallback to mock data on other errors so user sees something
                const fallback = generateMockSerpAnalysis(query, action);
                setAnalysisData(fallback);
                // Still set a warning message if needed, or maybe just log it
            }
        } finally {
            setAnalysisLoading(false);
        }
    };



    // Loading state
    if (status === "loading") {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    // Not logged in - now handled inside the main layout

    return (
        <div className="flex min-h-screen bg-gray-100 dark:bg-gray-900 transition-colors">
            {/* Sidebar */}
            <aside className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex-shrink-0 flex flex-col fixed h-full z-10">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <Link href="/" className="flex items-center text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                        <ArrowLeft className="w-5 h-5 mr-2" />
                        <span className="font-medium">Back to Tools</span>
                    </Link>
                </div>

                <div className="p-6 flex-1 overflow-y-auto">
                    <div className="space-y-6">
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800 relative">
                            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                                Manual Upload Tool
                            </h3>
                            <p className="text-sm text-blue-800 dark:text-blue-200">
                                Upload your Google Search Console and Google Ads CSV reports below to identify SEO and PPC optimization opportunities.
                            </p>
                        </div>

                        <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-4">
                            <h4 className="text-xs font-semibold uppercase text-gray-500 tracking-wider">Instructions</h4>
                            <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-2">
                                <li className="flex gap-2">
                                    <span className="text-blue-500 font-bold">1.</span>
                                    <span>Export &apos;Top Queries&apos; from Search Console.</span>
                                </li>
                                <li className="flex gap-2">
                                    <span className="text-blue-500 font-bold">2.</span>
                                    <span>Export &apos;Search Terms&apos; from Google Ads.</span>
                                </li>
                                <li className="flex gap-2">
                                    <span className="text-blue-500 font-bold">3.</span>
                                    <span>Upload both files to see the combined analysis.</span>
                                </li>
                            </ul>
                        </div>

                        {/* Action Legend moved here */}
                        <ActionLegend
                            expanded={expandedSections.legend}
                            onToggle={() => toggleSection('legend')}
                        />
                    </div>
                </div>

                <div className="p-6 border-t border-gray-200 dark:border-gray-700">
                    <ThemeToggle />
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 ml-80 p-8 min-h-screen">
                <div className="w-full mx-auto">
                    <div className="mb-8">
                        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-3">
                            SEO/PPC Opportunity Finder
                        </h1>
                        <p className="text-lg text-gray-600 dark:text-gray-300">
                            Analyze opportunities between organic and paid search to optimize your strategy.
                        </p>
                    </div>

                    <div className="space-y-6">

                        {/* Controls */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                            <div className="flex flex-wrap items-end gap-6">
                                {/* Mock Mode Toggle */}
                                <div className="pb-2">
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <div className="relative">
                                            <input
                                                type="checkbox"
                                                checked={mockMode}
                                                onChange={(e) => setMockMode(e.target.checked)}
                                                className="sr-only"
                                            />
                                            <div className={`w-10 h-6 rounded-full transition-colors ${mockMode ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                                            <div className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform ${mockMode ? 'translate-x-4' : ''}`}></div>
                                        </div>
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-blue-600 transition-colors">
                                            Demo Mode
                                        </span>
                                    </label>
                                </div>

                                {/* Target Domain Input */}
                                <div className="flex-1 min-w-[240px]">
                                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                                        Target Domain (for SERP Analysis)
                                    </label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Globe className={`h-4 w-4 transition-colors ${selectedProperty ? 'text-emerald-500' : 'text-gray-400'}`} />
                                        </div>
                                        <input
                                            type="text"
                                            value={selectedProperty}
                                            onChange={(e) => setSelectedProperty(e.target.value)}
                                            placeholder="e.g. example.com"
                                            className={`w-full pl-10 pr-10 bg-gray-50 dark:bg-gray-900 border rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 outline-none transition-all ${selectedProperty
                                                ? 'border-emerald-500 ring-2 ring-emerald-500/10'
                                                : 'border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                                                }`}
                                        />
                                        {selectedProperty && (
                                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                                <div className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 p-1 rounded-full">
                                                    <Check className="h-3 w-3" />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <input type="file" ref={fileInputRefGsc} onChange={handleGscFileUpload} accept=".csv" className="hidden" />
                                    <button
                                        onClick={() => fileInputRefGsc.current?.click()}
                                        className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm active:scale-95 ${rawGscData.length > 0
                                            ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                                            : "bg-white dark:bg-gray-900 text-emerald-600 border border-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"}`}
                                    >
                                        <Upload className="w-4 h-4" />
                                        {rawGscData.length > 0 ? `Uploaded GSC (${rawGscData.length})` : "Upload GSC CSV"}
                                    </button>

                                    <input type="file" ref={fileInputRef} onChange={handleAdsFileUpload} accept=".csv" className="hidden" />
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm active:scale-95 ${rawAdsData.length > 0
                                            ? "bg-purple-600 hover:bg-purple-700 text-white"
                                            : "bg-white dark:bg-gray-900 text-purple-600 border border-purple-200 hover:bg-purple-50 dark:hover:bg-purple-900/20"}`}
                                    >
                                        <Upload className="w-4 h-4" />
                                        {rawAdsData.length > 0 ? `Uploaded Ads (${rawAdsData.length})` : "Upload Ads CSV"}
                                    </button>

                                    {(rawGscData.length > 0 || rawAdsData.length > 0) && (
                                        <button
                                            onClick={clearAllData}
                                            className="p-2 text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1 text-xs font-medium"
                                            title="Clear all data and start over"
                                        >
                                            <X className="w-4 h-4" />
                                            Clear
                                        </button>
                                    )}

                                    {mockMode && (
                                        <button
                                            onClick={handleFetchData}
                                            disabled={loading}
                                            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm flex items-center gap-2 active:scale-95"
                                        >
                                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                            Generate Demo
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Status Messages */}
                        <div className="flex flex-col gap-2">
                            {progress && (
                                <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>{progress}</span>
                                </div>
                            )}
                            {data.length > 0 && !progress && (
                                <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                                    <CheckCircle className="w-4 h-4" />
                                    <span>{data.length.toLocaleString()} queries loaded</span>
                                </div>
                            )}
                            {error && (
                                <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg border border-red-100 dark:border-red-800">
                                    <AlertCircle className="w-4 h-4" />
                                    <span>{error}</span>
                                </div>
                            )}
                        </div>

                        {/* Global Filters */}
                        {
                            data.length > 0 && (
                                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                                    <div className="flex items-center justify-between gap-2 mb-4">
                                        <div className="flex items-center gap-2">
                                            <Filter className="w-5 h-5 text-gray-500" />
                                            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Filters</h3>
                                        </div>
                                        {(filterActions.length > 0 || filterCampaign !== "all" || filterAdGroup !== "all") && (
                                            <button
                                                onClick={() => {
                                                    setFilterActions([]);
                                                    setFilterCampaign("all");
                                                    setFilterAdGroup("all");
                                                }}
                                                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                                            >
                                                Clear Filters
                                            </button>
                                        )}
                                    </div>

                                    {/* Quick Filter Presets */}
                                    <div className="mb-4">
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Quick Filters:</p>
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                onClick={() => toggleAction("Pause PPC")}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${filterActions.includes("Pause PPC")
                                                    ? "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800"
                                                    : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                                                    }`}
                                            >
                                                💰 Wasted Spend (Pause PPC)
                                            </button>
                                            <button
                                                onClick={() => toggleAction("Scale Spend")}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${filterActions.includes("Scale Spend")
                                                    ? "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800"
                                                    : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-green-50 hover:text-green-600 hover:border-green-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-green-900/20 dark:hover:text-green-400"
                                                    }`}
                                            >
                                                🚀 Scaling Opportunities
                                            </button>
                                            <button
                                                onClick={() => toggleAction("Add Exact Match")}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${filterActions.includes("Add Exact Match")
                                                    ? "bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300 dark:border-cyan-800"
                                                    : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-cyan-50 hover:text-cyan-600 hover:border-cyan-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-cyan-900/20 dark:hover:text-cyan-400"
                                                    }`}
                                            >
                                                🎯 Add Exact Match
                                            </button>
                                            <button
                                                onClick={() => toggleAction("SEO Focus")}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${filterActions.includes("SEO Focus")
                                                    ? "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800"
                                                    : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-400"
                                                    }`}
                                            >
                                                📈 SEO Opportunities
                                            </button>
                                            <button
                                                onClick={() => toggleAction("Reduce Spend")}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${filterActions.includes("Reduce Spend")
                                                    ? "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800"
                                                    : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-orange-900/20 dark:hover:text-orange-400"
                                                    }`}
                                            >
                                                📉 Reduce Spend
                                            </button>
                                            <button
                                                onClick={() => toggleAction("Investigate")}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${filterActions.includes("Investigate")
                                                    ? "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800"
                                                    : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-amber-900/20 dark:hover:text-amber-400"
                                                    }`}
                                            >
                                                ⚠️ Needs Investigation
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {/* Filter by Action */}
                                        <div>
                                            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                                                Opportunity Action
                                            </label>
                                            <select
                                                value={filterActions.length === 1 ? filterActions[0] : "all"}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (val === "all") setFilterActions([]);
                                                    else setFilterActions([val as OpportunityAction]);
                                                }}
                                                className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                                            >
                                                <option value="all">All Actions ({data.length})</option>
                                                {Object.entries(calculateSummary(data).actionBreakdown)
                                                    .filter(([_, count]) => count > 0)
                                                    .map(([action, count]) => (
                                                        <option key={action} value={action}>
                                                            {action} ({count})
                                                        </option>
                                                    ))}
                                            </select>
                                        </div>

                                        {/* Filter by Campaign */}
                                        <div>
                                            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                                                Campaign
                                            </label>
                                            <select
                                                value={filterCampaign}
                                                onChange={(e) => setFilterCampaign(e.target.value)}
                                                className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                                            >
                                                <option value="all">All Campaigns</option>
                                                {uniqueCampaigns.map((c) => (
                                                    <option key={c} value={c}>
                                                        {c}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Filter by Ad Group */}
                                        <div>
                                            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                                                Ad Group
                                            </label>
                                            <select
                                                value={filterAdGroup}
                                                onChange={(e) => setFilterAdGroup(e.target.value)}
                                                className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                                            >
                                                <option value="all">All Ad Groups</option>
                                                {uniqueAdGroups.map((g) => (
                                                    <option key={g} value={g}>
                                                        {g}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )
                        }

                        {/* Error */}
                        {
                            error && (
                                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3">
                                    <AlertCircle className="w-5 h-5 text-red-500" />
                                    <span className="text-red-700 dark:text-red-400">{error}</span>
                                </div>
                            )
                        }

                        {/* KPI Cards */}
                        {
                            data.length > 0 && (
                                <section>
                                    <button
                                        onClick={() => toggleSection("kpis")}
                                        className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white mb-4"
                                    >
                                        {expandedSections.kpis ? (
                                            <ChevronDown className="w-5 h-5" />
                                        ) : (
                                            <ChevronUp className="w-5 h-5" />
                                        )}
                                        Summary Metrics
                                    </button>

                                    {expandedSections.kpis && (
                                        <>
                                            {/* Primary Metrics Row */}
                                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
                                                <KpiCard
                                                    title="Total Spend"
                                                    value={formatCurrency(summary.totalSpend, currencyCode)}
                                                    icon={DollarSign}
                                                />
                                                <KpiCard
                                                    title="Conv. Value"
                                                    value={formatCurrency(summary.totalConvValue, currencyCode)}
                                                    subtitle={`${formatNumber(summary.totalConversions)} convs`}
                                                    icon={Wallet}
                                                    trend="up"
                                                />
                                                <KpiCard
                                                    title="Avg. ROAS"
                                                    value={summary.avgRoas !== null ? `${summary.avgRoas.toFixed(2)}x` : "-"}
                                                    subtitle="Return on ad spend"
                                                    icon={TrendingUp}
                                                    trend={summary.avgRoas !== null && summary.avgRoas >= 3 ? "up" : summary.avgRoas !== null && summary.avgRoas < 2 ? "down" : "neutral"}
                                                />
                                                <KpiCard
                                                    title="Avg. CPA"
                                                    value={summary.avgCpa !== null ? formatCurrency(summary.avgCpa, currencyCode) : "-"}
                                                    subtitle="Cost per acquisition"
                                                    icon={Target}
                                                />
                                                <KpiCard
                                                    title="Blended CTR"
                                                    value={formatPercent(summary.blendedCtr)}
                                                    icon={BarChart3}
                                                />
                                                <KpiCard
                                                    title="Avg. Impr. Share"
                                                    value={summary.avgImpressionShare !== null ? formatPercent(summary.avgImpressionShare) : "-"}
                                                    subtitle="Weighted by impressions"
                                                    icon={Eye}
                                                />
                                            </div>

                                            {/* Opportunity Metrics Row */}
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                <KpiCard
                                                    title="Organic Clicks"
                                                    value={formatNumber(summary.totalOrgClicks)}
                                                    icon={MousePointer}
                                                    trend="up"
                                                />
                                                <KpiCard
                                                    title="Paid Clicks"
                                                    value={formatNumber(summary.totalPaidClicks)}
                                                    icon={MousePointer}
                                                />
                                                <KpiCard
                                                    title="Wasted Spend"
                                                    value={formatCurrency(summary.wastedSpend, currencyCode)}
                                                    subtitle="On top 3 organic keywords"
                                                    icon={AlertTriangle}
                                                    trend="down"
                                                />
                                                <KpiCard
                                                    title="SEO Opportunity"
                                                    value={formatCurrency(summary.seoOpportunityValue, currencyCode)}
                                                    subtitle="Est. value if ranking improves"
                                                    icon={Zap}
                                                    trend="up"
                                                />
                                            </div>

                                            {/* Action Summary Bar */}
                                            <div className="mt-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-4 border border-blue-100 dark:border-blue-800">
                                                <div className="flex flex-wrap items-center justify-between gap-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                                                            <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                                                {summary.opportunityCount} Actionable Opportunities Found
                                                            </p>
                                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                                Potential monthly savings: <span className="font-semibold text-green-600 dark:text-green-400">{formatCurrency(summary.wastedSpend, currencyCode)}</span>
                                                                {' • '}
                                                                SEO value: <span className="font-semibold text-blue-600 dark:text-blue-400">{formatCurrency(summary.seoOpportunityValue, currencyCode)}</span>
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2 flex-wrap">
                                                        {Object.entries(summary.actionBreakdown)
                                                            .filter(([_, count]) => count > 0 && _ !== 'Monitor')
                                                            .sort(([, a], [, b]) => b - a)
                                                            .slice(0, 5)
                                                            .map(([action, count]) => (
                                                                <span
                                                                    key={action}
                                                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
                                                                    style={{
                                                                        backgroundColor: `${getActionColor(action as OpportunityAction)}20`,
                                                                        color: getActionColor(action as OpportunityAction)
                                                                    }}
                                                                >
                                                                    {action}: {count}
                                                                </span>
                                                            ))}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Quick Wins Section */}
                                            {quickWins && (
                                                <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                                                    <QuickWinCard
                                                        title="💰 Stop Wasting Spend"
                                                        subtitle="Top 'Pause PPC' opportunities by cost"
                                                        opportunities={quickWins.pausePpc}
                                                        icon={DollarSign}
                                                        iconColorClass="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                                                        valueFormatter={(v) => formatCurrency(v, currencyCode)}
                                                        valueKey="cost_paid"
                                                    />
                                                    <QuickWinCard
                                                        title="🚀 Scale Winners"
                                                        subtitle="Top 'Scale Spend' opportunities by ROAS"
                                                        opportunities={quickWins.scaleSpend}
                                                        icon={TrendingUp}
                                                        iconColorClass="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                                                        valueFormatter={(v) => `ROAS: ${v?.toFixed(2)}x`}
                                                        valueKey="roas_paid"
                                                    />
                                                    <QuickWinCard
                                                        title="🎯 SEO Content Gaps"
                                                        subtitle="Top 'SEO Focus' opportunities by conversions"
                                                        opportunities={quickWins.seoFocus}
                                                        icon={Target}
                                                        iconColorClass="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                                                        valueFormatter={(v) => `${v} Conv.`}
                                                        valueKey="conversions_paid"
                                                    />
                                                </div>
                                            )}
                                        </>
                                    )}
                                </section>
                            )
                        }

                        {/* Charts */}
                        {
                            data.length > 0 && (
                                <section>
                                    <button
                                        onClick={() => toggleSection("charts")}
                                        className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white mb-4"
                                    >
                                        {expandedSections.charts ? (
                                            <ChevronDown className="w-5 h-5" />
                                        ) : (
                                            <ChevronUp className="w-5 h-5" />
                                        )}
                                        Analytics Charts
                                    </button>

                                    {expandedSections.charts && (
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                            {/* Action Breakdown Chart */}
                                            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                                                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
                                                    Spend & Organic Clicks by Action
                                                </h3>
                                                <div className="h-64">
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <BarChart data={actionChartData}>
                                                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                                                            <XAxis
                                                                dataKey="action"
                                                                tick={{ fontSize: 10, fill: "#9CA3AF" }}
                                                                angle={-45}
                                                                textAnchor="end"
                                                                height={80}
                                                            />
                                                            <YAxis
                                                                yAxisId="left"
                                                                tick={{ fontSize: 10, fill: "#9CA3AF" }}
                                                                tickFormatter={(v) => formatNumber(v)}
                                                            />
                                                            <YAxis
                                                                yAxisId="right"
                                                                orientation="right"
                                                                tick={{ fontSize: 10, fill: "#9CA3AF" }}
                                                                tickFormatter={(v) => formatNumber(v)}
                                                            />
                                                            <Tooltip
                                                                contentStyle={{
                                                                    backgroundColor: "#1F2937",
                                                                    border: "none",
                                                                    borderRadius: "8px",
                                                                    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
                                                                }}
                                                                itemStyle={{ color: "#F3F4F6" }}
                                                                labelStyle={{ color: "#F3F4F6", fontWeight: "600", marginBottom: "0.25rem" }}
                                                            />
                                                            <Legend />
                                                            <Bar
                                                                yAxisId="left"
                                                                dataKey="cost_paid"
                                                                name="Cost"
                                                                fill="#3b82f6"
                                                                radius={[4, 4, 0, 0]}
                                                            />
                                                            <Bar
                                                                yAxisId="right"
                                                                dataKey="clicks_org"
                                                                name="Organic Clicks"
                                                                fill="#10b981"
                                                                radius={[4, 4, 0, 0]}
                                                            />
                                                        </BarChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            </div>

                                            {/* Score Distribution */}
                                            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                                                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
                                                    Opportunity Score Distribution
                                                </h3>
                                                <div className="h-64">
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <BarChart data={scoreDistribution}>
                                                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                                                            <XAxis
                                                                dataKey="bucket"
                                                                tick={{ fontSize: 12, fill: "#9CA3AF" }}
                                                            />
                                                            <YAxis
                                                                tick={{ fontSize: 12, fill: "#9CA3AF" }}
                                                            />
                                                            <Tooltip
                                                                contentStyle={{
                                                                    backgroundColor: "#1F2937",
                                                                    border: "none",
                                                                    borderRadius: "8px",
                                                                    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
                                                                }}
                                                                itemStyle={{ color: "#F3F4F6" }}
                                                                labelStyle={{ color: "#F3F4F6", fontWeight: "600", marginBottom: "0.25rem" }}
                                                            />
                                                            <Bar
                                                                dataKey="count"
                                                                name="Queries"
                                                                fill="#8b5cf6"
                                                                radius={[4, 4, 0, 0]}
                                                            />
                                                        </BarChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            </div>

                                            {/* Quadrant Scatter Plot */}
                                            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 lg:col-span-2">
                                                <div className="flex justify-between items-center mb-4">
                                                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                                        Position vs Cost Quadrant
                                                    </h3>
                                                    <select
                                                        value={scatterPositionFilter}
                                                        onChange={(e) => setScatterPositionFilter(e.target.value)}
                                                        className="text-xs border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500 p-1.5"
                                                    >
                                                        <option value="all">Top 200 Opps (All Pos)</option>
                                                        <option value="top3">Top 3 Only</option>
                                                        <option value="top10">Top 10 Only</option>
                                                        <option value="pos11-20">Position 11-20</option>
                                                        <option value="no-rank">Not Ranking (Pos 0)</option>
                                                    </select>
                                                </div>
                                                <div className="h-72">
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                                                            <XAxis
                                                                type="number"
                                                                dataKey="position_org"
                                                                name="Position"
                                                                tick={{ fontSize: 12, fill: "#9CA3AF" }}
                                                                label={{ value: "Organic Position", position: "bottom", fill: "#9CA3AF" }}
                                                                domain={
                                                                    scatterPositionFilter === "top3" ? [0, 3.5] :
                                                                        scatterPositionFilter === "top10" ? [0, 10.5] :
                                                                            scatterPositionFilter === "pos11-20" ? [10.5, 20.5] :
                                                                                scatterPositionFilter === "no-rank" ? [-0.5, 0.5] :
                                                                                    [0, 50]
                                                                }
                                                            />
                                                            <YAxis
                                                                type="number"
                                                                dataKey="cost_paid"
                                                                name="Cost"
                                                                tick={{ fontSize: 12, fill: "#9CA3AF" }}
                                                                label={{ value: "Paid Cost", angle: -90, position: "left", fill: "#9CA3AF" }}
                                                                tickFormatter={(v) => formatCurrency(v, currencyCode)}
                                                            />
                                                            <ZAxis
                                                                type="number"
                                                                dataKey="conversions_paid"
                                                                range={[50, 400]}
                                                                name="Conversions"
                                                            />
                                                            <Tooltip
                                                                cursor={{ strokeDasharray: '3 3' }}
                                                                content={({ active, payload }) => {
                                                                    if (active && payload && payload.length) {
                                                                        const data = payload[0].payload;
                                                                        return (
                                                                            <div className="bg-gray-800 text-white p-3 rounded-lg shadow-lg border border-gray-700">
                                                                                <p className="font-semibold mb-2 text-sm">{data.query}</p>
                                                                                <div className="space-y-1 text-xs">
                                                                                    <div className="flex justify-between gap-4">
                                                                                        <span className="text-gray-400">Position:</span>
                                                                                        <span className="font-medium">{data.position_org.toFixed(1)}</span>
                                                                                    </div>
                                                                                    <div className="flex justify-between gap-4">
                                                                                        <span className="text-gray-400">Cost:</span>
                                                                                        <span className="font-medium">{formatCurrency(data.cost_paid, currencyCode)}</span>
                                                                                    </div>
                                                                                    <div className="flex justify-between gap-4">
                                                                                        <span className="text-gray-400">Conversions:</span>
                                                                                        <span className="font-medium">{data.conversions_paid.toFixed(0)}</span>
                                                                                    </div>
                                                                                    {data.cpa_paid !== null && (
                                                                                        <div className="flex justify-between gap-4 border-t border-gray-700/50 pt-1 mt-1">
                                                                                            <span className="text-gray-400">CPA:</span>
                                                                                            <span className="font-medium text-amber-400">{formatCurrency(data.cpa_paid, currencyCode)}</span>
                                                                                        </div>
                                                                                    )}
                                                                                    <div className="flex justify-between gap-4 border-t border-gray-700/50 pt-1 mt-1">
                                                                                        <span className="text-gray-400">Action:</span>
                                                                                        <span className="font-medium" style={{ color: getActionColor(data.action) }}>{data.action}</span>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    }
                                                                    return null;
                                                                }}
                                                            />
                                                            <Scatter name="Queries" data={scatterData}>
                                                                {scatterData.map((entry, index) => (
                                                                    <Cell key={`cell-${index}`} fill={getActionColor(entry.action)} />
                                                                ))}
                                                            </Scatter>
                                                        </ScatterChart>
                                                    </ResponsiveContainer>
                                                </div>
                                                <div className="flex flex-wrap gap-3 mt-4 justify-center">
                                                    {Object.keys(summary.actionBreakdown).map((action) => (
                                                        <div key={action} className="flex items-center gap-1.5 text-xs">
                                                            <div
                                                                className="w-3 h-3 rounded-full"
                                                                style={{ backgroundColor: getActionColor(action as OpportunityAction) }}
                                                            />
                                                            <span className="text-gray-600 dark:text-gray-400">{action}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </section>
                            )
                        }

                        {/* Quick Wins Section */}
                        {
                            data.length > 0 && (
                                <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {/* Top Wasted Spend */}
                                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                                        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-red-50/50 dark:bg-red-900/10">
                                            <div className="flex items-center gap-2">
                                                <AlertTriangle className="w-5 h-5 text-red-500" />
                                                <h3 className="font-semibold text-gray-900 dark:text-white">Top Wasted Spend</h3>
                                            </div>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                High spend on keywords where you already rank in top 3 organically
                                            </p>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead className="bg-gray-50 dark:bg-gray-700/50">
                                                    <tr>
                                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Query</th>
                                                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Pos</th>
                                                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Cost</th>
                                                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Conv</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                                    {data
                                                        .filter(r => r.position_org > 0 && r.position_org <= 3 && r.cost_paid > 0)
                                                        .sort((a, b) => b.cost_paid - a.cost_paid)
                                                        .slice(0, 5)
                                                        .map((row, idx) => (
                                                            <tr key={`wasted-${idx}`} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                                                <td className="px-3 py-2 text-gray-900 dark:text-gray-100 truncate max-w-[180px]" title={row.query}>
                                                                    {row.query}
                                                                </td>
                                                                <td className="px-3 py-2 text-right">
                                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                                                                        #{row.position_org.toFixed(1)}
                                                                    </span>
                                                                </td>
                                                                <td className="px-3 py-2 text-right text-red-600 dark:text-red-400 font-medium">
                                                                    {formatCurrency(row.cost_paid, currencyCode)}
                                                                </td>
                                                                <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">
                                                                    {row.conversions_paid.toFixed(0)}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    {data.filter(r => r.position_org > 0 && r.position_org <= 3 && r.cost_paid > 0).length === 0 && (
                                                        <tr>
                                                            <td colSpan={4} className="px-3 py-6 text-center text-gray-500 dark:text-gray-400 text-sm italic">
                                                                No wasted spend detected - great job! 🎉
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                        {data.filter(r => r.position_org > 0 && r.position_org <= 3 && r.cost_paid > 0).length > 0 && (
                                            <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                                    💡 <span className="font-medium">Recommendation:</span> Consider pausing PPC for these keywords to save{' '}
                                                    <span className="text-green-600 dark:text-green-400 font-semibold">
                                                        {formatCurrency(
                                                            data
                                                                .filter(r => r.position_org > 0 && r.position_org <= 3 && r.cost_paid > 0)
                                                                .reduce((sum, r) => sum + r.cost_paid, 0),
                                                            currencyCode
                                                        )}
                                                    </span>
                                                    /period
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Top Scale Opportunities */}
                                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                                        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-green-50/50 dark:bg-green-900/10">
                                            <div className="flex items-center gap-2">
                                                <TrendingUp className="w-5 h-5 text-green-500" />
                                                <h3 className="font-semibold text-gray-900 dark:text-white">Top Scale Opportunities</h3>
                                            </div>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                High ROAS keywords with low impression share - room to grow
                                            </p>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead className="bg-gray-50 dark:bg-gray-700/50">
                                                    <tr>
                                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Query</th>
                                                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">ROAS</th>
                                                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">IS%</th>
                                                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Conv</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                                    {data
                                                        .filter(r =>
                                                            r.roas_paid !== null &&
                                                            r.roas_paid >= 3 &&
                                                            r.impressionShare !== null &&
                                                            r.impressionShare !== undefined &&
                                                            r.impressionShare < 0.6
                                                        )
                                                        .sort((a, b) => (b.roas_paid || 0) - (a.roas_paid || 0))
                                                        .slice(0, 5)
                                                        .map((row, idx) => (
                                                            <tr key={`scale-${idx}`} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                                                <td className="px-3 py-2 text-gray-900 dark:text-gray-100 truncate max-w-[180px]" title={row.query}>
                                                                    {row.query}
                                                                </td>
                                                                <td className="px-3 py-2 text-right">
                                                                    <span className="text-green-600 dark:text-green-400 font-semibold">
                                                                        {row.roas_paid?.toFixed(1)}x
                                                                    </span>
                                                                </td>
                                                                <td className="px-3 py-2 text-right">
                                                                    <div className="flex items-center justify-end gap-1">
                                                                        <div className="w-10 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                                                                            <div
                                                                                className="h-full rounded-full bg-amber-500"
                                                                                style={{ width: `${(row.impressionShare || 0) * 100}%` }}
                                                                            />
                                                                        </div>
                                                                        <span className="text-xs text-gray-500">
                                                                            {((row.impressionShare || 0) * 100).toFixed(0)}%
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">
                                                                    {row.conversions_paid.toFixed(0)}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    {data.filter(r => r.roas_paid !== null && r.roas_paid >= 3 && r.impressionShare !== null && r.impressionShare !== undefined && r.impressionShare < 0.6).length === 0 && (
                                                        <tr>
                                                            <td colSpan={4} className="px-3 py-6 text-center text-gray-500 dark:text-gray-400 text-sm italic">
                                                                No clear scaling opportunities found in current data
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                        {data.filter(r => r.roas_paid !== null && r.roas_paid >= 3 && r.impressionShare !== null && r.impressionShare !== undefined && r.impressionShare < 0.6).length > 0 && (
                                            <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                                    💡 <span className="font-medium">Recommendation:</span> Increase bids or budget for these keywords to capture more impression share
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </section>
                            )
                        }
                        {
                            data.length > 0 && (
                                <section>
                                    <button
                                        onClick={() => toggleSection("table")}
                                        className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white mb-4"
                                    >
                                        {expandedSections.table ? (
                                            <ChevronDown className="w-5 h-5" />
                                        ) : (
                                            <ChevronUp className="w-5 h-5" />
                                        )}
                                        Opportunity Table
                                    </button>

                                    {expandedSections.table && (
                                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                                            {/* Table Controls */}
                                            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center gap-4">
                                                {/* Search */}
                                                <div className="relative flex-1 min-w-[200px]">
                                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                                    <input
                                                        type="text"
                                                        placeholder="Search queries..."
                                                        value={searchQuery}
                                                        onChange={(e) => setSearchQuery(e.target.value)}
                                                        className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg pl-10 pr-4 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                                    />
                                                </div>

                                                {/* Show Top N */}
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm text-gray-500 dark:text-gray-400">Show:</span>
                                                    <select
                                                        value={showTop}
                                                        onChange={(e) => setShowTop(Number(e.target.value))}
                                                        className="bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                                                    >
                                                        <option value={50}>Top 50</option>
                                                        <option value={100}>Top 100</option>
                                                        <option value={500}>Top 500</option>
                                                        <option value={1000}>Top 1000</option>
                                                        <option value={99999}>All</option>
                                                    </select>
                                                </div>

                                                {/* Export */}
                                                <button
                                                    onClick={handleExportCsv}
                                                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                                                >
                                                    <Download className="w-4 h-4" />
                                                    Export CSV
                                                </button>
                                            </div>

                                            {/* Table */}
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm">
                                                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                                                        <tr>
                                                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-10">
                                                                AI
                                                            </th>
                                                            {[
                                                                { key: "action", label: "Action", width: "120px" },
                                                                { key: "query", label: "Query", width: "auto" },
                                                                { key: "matchType", label: "Match", width: "70px" },
                                                                { key: "position_org", label: "Pos", width: "60px" },
                                                                { key: "clicks_org", label: "Org Clk", width: "70px" },
                                                                { key: "clicks_paid", label: "Paid Clk", width: "75px" },
                                                                { key: "cost_paid", label: "Cost", width: "85px" },
                                                                { key: "conversions_paid", label: "Conv", width: "65px" },
                                                                { key: "roas_paid", label: "ROAS", width: "70px" },
                                                                { key: "conversionRate", label: "CVR", width: "65px" },
                                                                { key: "impressionShare", label: "IS %", width: "65px" },
                                                                { key: "opportunity_score", label: "Score", width: "70px" },
                                                            ].map((col) => (
                                                                <th
                                                                    key={col.key}
                                                                    className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600/50"
                                                                    style={{ width: col.width }}
                                                                    onClick={() => handleSort(col.key as keyof MergedOpportunityRow)}
                                                                >
                                                                    <div className="flex items-center gap-1">
                                                                        {col.label}
                                                                        {sortKey === col.key && (
                                                                            <ArrowUpDown className="w-3 h-3" />
                                                                        )}
                                                                    </div>
                                                                </th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                                        {filteredData.slice(0, showTop).map((row, idx) => (
                                                            <tr
                                                                key={`${row.query}-${idx}`}
                                                                className="hover:bg-gray-50 dark:hover:bg-gray-700/30"
                                                            >
                                                                <td className="px-4 py-3">
                                                                    <button
                                                                        onClick={() => handleAnalyzeQuery(row.query, row.action)}
                                                                        className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded text-blue-600 dark:text-blue-400 transition-colors"
                                                                        title="Analyze Query with AI"
                                                                    >
                                                                        <Sparkles className="w-4 h-4" />
                                                                    </button>
                                                                </td>
                                                                <td className="px-3 py-3">
                                                                    <ActionBadge action={row.action} />
                                                                </td>
                                                                <td className="px-3 py-3 text-gray-900 dark:text-gray-100 max-w-[200px] truncate" title={row.query}>
                                                                    {row.query}
                                                                </td>
                                                                <td className="px-3 py-3">
                                                                    {row.matchType ? (
                                                                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${row.matchType === 'exact'
                                                                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                                                            : row.matchType === 'phrase'
                                                                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                                                                : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
                                                                            }`}>
                                                                            {row.matchType === 'exact' ? 'E' : row.matchType === 'phrase' ? 'P' : 'B'}
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-gray-400">-</span>
                                                                    )}
                                                                </td>
                                                                <td className="px-3 py-3 text-gray-600 dark:text-gray-400">
                                                                    {row.position_org > 0 ? row.position_org.toFixed(1) : "-"}
                                                                </td>
                                                                <td className="px-3 py-3 text-gray-600 dark:text-gray-400">
                                                                    {row.clicks_org.toLocaleString()}
                                                                </td>
                                                                <td className="px-3 py-3 text-gray-600 dark:text-gray-400">
                                                                    {row.clicks_paid.toLocaleString()}
                                                                </td>
                                                                <td className="px-3 py-3 text-gray-600 dark:text-gray-400">
                                                                    {formatCurrency(row.cost_paid, currencyCode)}
                                                                </td>
                                                                <td className="px-3 py-3 text-gray-600 dark:text-gray-400">
                                                                    {row.conversions_paid.toFixed(1)}
                                                                </td>
                                                                <td className="px-3 py-3">
                                                                    {row.roas_paid !== null ? (
                                                                        <span className={`font-medium ${row.roas_paid >= 4
                                                                            ? 'text-green-600 dark:text-green-400'
                                                                            : row.roas_paid >= 2
                                                                                ? 'text-blue-600 dark:text-blue-400'
                                                                                : row.roas_paid >= 1
                                                                                    ? 'text-amber-600 dark:text-amber-400'
                                                                                    : 'text-red-600 dark:text-red-400'
                                                                            }`}>
                                                                            {row.roas_paid.toFixed(1)}x
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-gray-400">-</span>
                                                                    )}
                                                                </td>
                                                                <td className="px-3 py-3 text-gray-600 dark:text-gray-400">
                                                                    {row.conversionRate !== undefined && row.conversionRate > 0
                                                                        ? formatPercent(row.conversionRate)
                                                                        : "-"}
                                                                </td>
                                                                <td className="px-3 py-3">
                                                                    {row.impressionShare !== null && row.impressionShare !== undefined ? (
                                                                        <div className="flex items-center gap-1">
                                                                            <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                                                                                <div
                                                                                    className={`h-full rounded-full ${row.impressionShare >= 0.7
                                                                                        ? 'bg-green-500'
                                                                                        : row.impressionShare >= 0.4
                                                                                            ? 'bg-amber-500'
                                                                                            : 'bg-red-500'
                                                                                        }`}
                                                                                    style={{ width: `${row.impressionShare * 100}%` }}
                                                                                />
                                                                            </div>
                                                                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                                                                {(row.impressionShare * 100).toFixed(0)}%
                                                                            </span>
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-gray-400">-</span>
                                                                    )}
                                                                </td>
                                                                <td className="px-3 py-3 font-medium text-gray-900 dark:text-gray-100">
                                                                    {row.opportunity_score.toFixed(0)}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>

                                            {/* Table Footer */}
                                            <div className="p-4 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
                                                Showing {Math.min(showTop, filteredData.length)} of {filteredData.length} filtered results
                                                ({data.length} total)
                                            </div>
                                        </div>
                                    )}
                                </section>
                            )
                        }

                        {/* Empty State */}
                        {
                            !loading && data.length === 0 && (
                                <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center border border-gray-200 dark:border-gray-700">
                                    <Info className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                                        No Data Yet
                                    </h3>
                                    <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                                        Upload your Google Search Console and Google Ads CSV reports using the buttons above to identify SEO and PPC optimization opportunities.
                                    </p>
                                </div>
                            )
                        }


                        {/* Analysis Modal */}
                        {
                            analysisModalOpen && (
                                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
                                        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                                                    <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                                        AI Opportunity Analysis
                                                    </h3>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                                            Analyzing query: <span className="font-medium text-gray-900 dark:text-gray-200">{analysisData?.query || "Loading..."}</span>
                                                        </p>
                                                        {analysisData?.action && (
                                                            <ActionBadge action={analysisData.action} />
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setAnalysisModalOpen(false)}
                                                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                            >
                                                <X className="w-5 h-5" />
                                            </button>
                                        </div>

                                        <div className="overflow-y-auto p-6 flex-1">
                                            {analysisLoading ? (
                                                <div className="h-64 flex flex-col items-center justify-center gap-4">
                                                    <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                                                    <p className="text-gray-500 dark:text-gray-400 animate-pulse">Analyzing SERP features and competitors...</p>
                                                </div>
                                            ) : analysisError ? (
                                                <div className="h-64 flex flex-col items-center justify-center p-8 text-center">
                                                    <AlertCircle className="w-12 h-12 mb-4 text-red-500 opacity-50" />
                                                    <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">Analysis Failed</h3>
                                                    <p className="max-w-md text-gray-600 dark:text-gray-300 mb-4">{analysisError}</p>
                                                    {analysisError.includes("credentials") && (
                                                        <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded text-left text-sm text-gray-700 dark:text-gray-300 font-mono border border-gray-200 dark:border-gray-700">
                                                            DATAFORSEO_LOGIN=...<br />
                                                            DATAFORSEO_PASSWORD=...
                                                        </div>
                                                    )}
                                                </div>
                                            ) : analysisData ? (
                                                <div className="space-y-8">
                                                    {/* AI Recommendation */}
                                                    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-100 dark:border-purple-800 rounded-xl p-6">
                                                        <h4 className="flex items-center gap-2 text-sm font-semibold text-purple-900 dark:text-purple-100 uppercase tracking-wider mb-4">
                                                            <Sparkles className="w-4 h-4" /> Recommendation
                                                        </h4>
                                                        <div className="grid md:grid-cols-2 gap-6">
                                                            <div>
                                                                <h5 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                                                                    {analysisData.aiRecommendation.action}
                                                                </h5>
                                                                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                                                                    {analysisData.aiRecommendation.reasoning}
                                                                </p>
                                                            </div>
                                                            <div className="space-y-3">
                                                                <div className="flex justify-between items-center gap-4 p-3 bg-white/50 dark:bg-black/20 rounded-lg border border-purple-100 dark:border-purple-800/50">
                                                                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400 shrink-0">Predicted Impact</span>
                                                                    <span className="text-sm font-semibold text-purple-700 dark:text-purple-300 text-right">{analysisData.aiRecommendation.impact}</span>
                                                                </div>
                                                                <div className="flex justify-between items-center gap-4 p-3 bg-white/50 dark:bg-black/20 rounded-lg border border-purple-100 dark:border-purple-800/50">
                                                                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400 shrink-0">Difficulty</span>
                                                                    <span className={`text-sm font-semibold px-2 py-0.5 rounded ${analysisData.aiRecommendation.difficulty === 'Low' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                                                                        analysisData.aiRecommendation.difficulty === 'Medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                                                                            'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                                                        }`}>{analysisData.aiRecommendation.difficulty}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Metrics Grid */}
                                                    <div className={`grid grid-cols-1 md:grid-cols-${analysisData.targetRank ? '4' : '3'} gap-4`}>
                                                        {analysisData.targetRank && (
                                                            <div className={`p-4 rounded-xl border transition-all duration-300 ${analysisData.targetRank === 1
                                                                    ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 shadow-sm ring-1 ring-emerald-500/20'
                                                                    : 'bg-purple-50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-800/30'
                                                                }`}>
                                                                <p className={`text-xs uppercase font-bold tracking-wider ${analysisData.targetRank === 1 ? 'text-emerald-600 dark:text-emerald-400' : 'text-purple-600 dark:text-purple-400'
                                                                    }`}>Organic Rank</p>
                                                                <div className="flex items-center gap-2 mt-1">
                                                                    <p className={`text-3xl font-black ${analysisData.targetRank === 1 ? 'text-emerald-700 dark:text-emerald-300' : 'text-gray-900 dark:text-white'
                                                                        }`}>#{analysisData.targetRank}</p>
                                                                    {analysisData.targetRank === 1 && (
                                                                        <div className="bg-emerald-100 dark:bg-emerald-800 text-emerald-700 dark:text-emerald-300 p-1 rounded-full">
                                                                            <Sparkles className="w-4 h-4" />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
                                                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium">Keyword Difficulty</p>
                                                            <div className="flex items-end gap-2 mt-1">
                                                                <span className="text-2xl font-bold text-gray-900 dark:text-white">{analysisData.difficulty}/100</span>
                                                                <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full mb-1.5">
                                                                    <div
                                                                        className={`h-full rounded-full ${analysisData.difficulty > 70 ? 'bg-red-500' : analysisData.difficulty > 40 ? 'bg-yellow-500' : 'bg-green-500'}`}
                                                                        style={{ width: `${analysisData.difficulty}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
                                                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium">Search Intent</p>
                                                            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1 capitalize">{analysisData.intent}</p>
                                                        </div>
                                                        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
                                                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium">Est. Volume</p>
                                                            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{formatNumber(analysisData.searchVolume)}</p>
                                                        </div>
                                                    </div>

                                                    {/* SERP Features */}
                                                    <div>
                                                        <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider">Present SERP Features</h4>
                                                        <div className="flex flex-wrap gap-2">
                                                            {analysisData.serpFeatures.map(feature => (
                                                                <span key={feature} className="px-3 py-1 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 rounded-full text-sm font-medium border border-blue-100 dark:border-blue-800/30">
                                                                    {feature}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Competitive Landscape Table */}
                                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                                        {/* Paid Competitors */}
                                                        <div>
                                                            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider flex items-center gap-2">
                                                                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                                                Paid Competitors (Ads)
                                                            </h4>
                                                            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                                                                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                                                    <thead className="bg-gray-50 dark:bg-gray-800/80">
                                                                        <tr>
                                                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-16">Rank</th>
                                                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Ad Copy / URL</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                                                        {analysisData.paidResults?.length > 0 ? (
                                                                            analysisData.paidResults.map((result) => {
                                                                                const isTarget = selectedProperty && result.url.toLowerCase().includes(selectedProperty.toLowerCase());
                                                                                return (
                                                                                    <tr key={result.rank} className={`hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors ${isTarget ? 'bg-emerald-50/50 dark:bg-emerald-900/20' : ''}`}>
                                                                                        <td className="px-4 py-3 text-sm font-bold text-gray-900 dark:text-white text-center">
                                                                                            <div className="flex flex-col items-center gap-1">
                                                                                                <span>#{result.rank}</span>
                                                                                                {isTarget && (
                                                                                                    <span className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 px-1 rounded font-bold uppercase tracking-tight">YOU</span>
                                                                                                )}
                                                                                            </div>
                                                                                        </td>
                                                                                        <td className="px-4 py-3">
                                                                                            <a href={result.url} target="_blank" rel="noopener noreferrer" className={`text-sm font-medium hover:underline block truncate max-w-xs ${isTarget ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'}`}>
                                                                                                {result.title}
                                                                                            </a>
                                                                                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs mt-0.5">{result.snippet}</p>
                                                                                        </td>
                                                                                    </tr>
                                                                                );
                                                                            })
                                                                        ) : (
                                                                            <tr>
                                                                                <td colSpan={2} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400 italic">
                                                                                    No paid competitors found for this query.
                                                                                </td>
                                                                            </tr>
                                                                        )}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </div>

                                                        {/* Organic Competitors */}
                                                        <div>
                                                            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider flex items-center gap-2">
                                                                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                                                Organic Competitors
                                                            </h4>
                                                            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                                                                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                                                    <thead className="bg-gray-50 dark:bg-gray-800/80">
                                                                        <tr>
                                                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-16">Rank</th>
                                                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Title / URL</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                                                        {analysisData.topResults.map((result) => {
                                                                            const isTarget = selectedProperty && result.url.toLowerCase().includes(selectedProperty.toLowerCase());
                                                                            return (
                                                                                <tr key={result.rank} className={`hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors ${isTarget ? 'bg-emerald-50/50 dark:bg-emerald-900/20' : ''}`}>
                                                                                    <td className="px-4 py-3 text-sm font-bold text-gray-900 dark:text-white text-center">
                                                                                        <div className="flex flex-col items-center gap-1">
                                                                                            <span>#{result.rank}</span>
                                                                                            {isTarget && (
                                                                                                <span className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 px-1 rounded font-bold uppercase tracking-tight">YOU</span>
                                                                                            )}
                                                                                        </div>
                                                                                    </td>
                                                                                    <td className="px-4 py-3">
                                                                                        <a href={result.url} target="_blank" rel="noopener noreferrer" className={`text-sm font-medium hover:underline block truncate max-w-xs ${isTarget ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'}`}>
                                                                                            {result.title}
                                                                                        </a>
                                                                                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs mt-0.5">{result.url}</p>
                                                                                    </td>
                                                                                </tr>
                                                                            );
                                                                        })}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="h-64 flex items-center justify-center text-gray-500">
                                                    Failed to load analysis
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )
                        }
                    </div>
                </div>
            </main>
        </div>
    );
}
