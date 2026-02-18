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
    ChevronRight,
    ArrowUpDown,
    Filter,
    Loader2,
    AlertCircle,
    CheckCircle,
    TrendingUp,
    DollarSign,
    MousePointer,
    Target as LucideTarget,
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
    Book,
    HelpCircle,
    ListFilter,
    FileSpreadsheet,
    Printer,
    Tags,
    FileText,
    ExternalLink,
    Users,
    Settings,
} from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";

import {
    MergedOpportunityRow,
    OpportunityAction,
    GscQueryRow,
    AdsSearchTermRow,
    KeywordMetricsRow,
    GoogleAdsCustomer,
    DatePreset,
    SerpAnalysis,
    CampaignReportRow,
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
import { SCORING_CONFIG_V2, ScoringConfig } from "@/lib/scoring-config-v2";

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
function ActionBadge({ action, row }: { action: OpportunityAction; row?: MergedOpportunityRow }) {
    const color = getActionColor(action);
    const reason = row?.reasons?.length
        ? row.reasons.join(". ")
        : (row ? getActionReason(row, action) : "Action recommended based on score analysis.");
    return (
        <span
            className="group relative inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap border cursor-help"
            style={{
                backgroundColor: `${color}15`,
                color: color,
                borderColor: `${color}30`
            }}
        >
            {action}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-900 text-white text-[10px] rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 text-center font-normal whitespace-normal z-[60]">
                {reason}
            </div>
        </span>
    );
}



function UploadWizard() {
    const [open, setOpen] = useState(false); // Closed by default as per user request
    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-blue-100 dark:border-blue-900/30 overflow-hidden mb-6 shadow-sm">
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between p-4 bg-blue-50/50 dark:bg-blue-900/10 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                        <HelpCircle className="w-4 h-4" />
                    </div>
                    <span className="font-semibold text-gray-900 dark:text-white text-sm">How to use this tool</span>
                </div>
                {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>
            {open && (
                <div className="p-4 space-y-4 text-sm bg-white dark:bg-gray-800/50 border-t border-blue-50 dark:border-blue-900/30">
                    <div className="grid gap-4">
                        <div className="flex gap-3 relative">
                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-xs ring-4 ring-white dark:ring-gray-800 z-10">1</div>
                            <div className="border-l-2 border-gray-100 dark:border-gray-700 absolute left-3 top-6 bottom-[-24px] z-0"></div>
                            <div className="pb-1">
                                <p className="font-semibold text-gray-900 dark:text-white mb-1">Export GSC Query Data</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                                    Go to <strong>Google Search Console &gt; Performance &gt; Search Results</strong>.<br />
                                    Select your date range (e.g., Last 3 Months).<br />
                                    Click <strong>Export &gt; Download CSV</strong>. Use the &quot;Queries.csv&quot; file.
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-3 relative">
                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-xs ring-4 ring-white dark:ring-gray-800 z-10">2</div>
                            <div className="border-l-2 border-gray-100 dark:border-gray-700 absolute left-3 top-6 bottom-[-24px] z-0"></div>
                            <div className="pb-1">
                                <p className="font-semibold text-gray-900 dark:text-white mb-1">Export Google Ads Search Terms</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                                    Go to <strong>Google Ads &gt; Campaigns &gt; Insights and reports &gt; Search terms</strong>.<br />
                                    Ensure the date range matches GSC.<br />
                                    Click <strong>Download &gt; CSV</strong>.
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs ring-4 ring-white dark:ring-gray-800 z-10">3</div>
                            <div className="pb-1">
                                <p className="font-semibold text-gray-900 dark:text-white mb-1">Upload & Analyze</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                                    Upload the files using the buttons below. The tool will automatically join the data and find opportunities.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const ACTION_DEFINITIONS: Record<string, { definition: string; rule: string; color: string }> = {
    "Add Exact Match": {
        definition: "Converting keywords on broad/phrase match that should be added as exact match for better control.",
        rule: "Broad/Phrase + >= 10 clicks + Profitable ROAS.",
        color: "#06b6d4"
    },
    "Scale Spend": {
        definition: "Highly profitable keywords with room to grow Imp via budget or bid increases.",
        rule: "ROAS >= 4.0 + Low Imp. Share or Budget Limited.",
        color: "#22c55e"
    },
    "SEO Focus": {
        definition: "Proven commercial keywords with low organic visibility. High-impact targets for SEO.",
        rule: "Organic position > 10 (or 0) + Meaningful paid activity (>=1 click/conv).",
        color: "#10b981"
    },
    "Reduce Spend": {
        definition: "High organic presence (Pos <= 4) where paid search spend is likely redundant or inefficient.",
        rule: "Pos <= 4 + (Low ROAS < 2 OR Multi-channel coverage) + Cost > £75.",
        color: "#f97316"
    },
    "Investigate": {
        definition: "Audit required: High spend with zero conversions OR good rank with poor CTR.",
        rule: "Cost > £50 (or > Median) + 0 Conv OR CTR < 50% of expected.",
        color: "#f59e0b"
    },
    "Consider PPC": {
        definition: "No organic presence. Test small PPC budget to validate demand and gather data.",
        rule: "Pos 0 + No Paid Data (but high impressions).",
        color: "#6366f1"
    },
    "Defend": {
        definition: "Protect high-revenue terms where you have organic dominance (#1-4) but face intense competition.",
        rule: "Pos <= 4 + ROAS >= 4 + Comp Score >= 60 + Above Median Rev.",
        color: "#7c3aed"
    }
};

const ACTION_DEFINITIONS_V2: Record<string, { definition: string; rule: string; color: string }> = {
    "Investigate": {
        definition: "Critical audit needed. High spend with 0 conversions OR ranking well but poor CTR.",
        rule: "Cost > £50 & 0 Conv OR Pos <= 6 & CTR < 50% exp.",
        color: "#f59e0b"
    },
    "Defend": {
        definition: "Protect high-value terms where you dominate organic (#1-2) but face competition.",
        rule: "Pos <= 2 + (High ROAS or CPA < Med) + High Comp.",
        color: "#7c3aed"
    },
    "Reduce Spend": {
        definition: "Cut spend on strong organic terms (#1-2) where paid is inefficient or redundant.",
        rule: "Pos <= 2 + Cost > £75 + (Low ROAS < 2.0 or Coverage).",
        color: "#f97316"
    },
    "Add Exact Match": {
        definition: "Refine targeting for performing broad/phrase terms.",
        rule: "Broad/Phrase + >10 Clicks + Profitable.",
        color: "#06b6d4"
    },
    "Scale Spend": {
        definition: "Increase volume for highly profitable terms.",
        rule: "ROAS >= 4.0 + Low Impr Share (<90%).",
        color: "#22c55e"
    },
    "SEO Focus": {
        definition: "Target keywords with proven paid performance but low organic rank.",
        rule: "Pos > 2 (Page 2+ focus) + Cost > £0.",
        color: "#10b981"
    },
    "Consider PPC": {
        definition: "Test paid ads for terms with no organic visibility.",
        rule: "Pos 0 or > 20 + High Volume.",
        color: "#6366f1"
    }
};

const MARKET_OPTIONS = [
    { value: "United Kingdom", emoji: "🇬🇧" },
    { value: "United States", emoji: "🇺🇸" },
    { value: "Canada", emoji: "🇨🇦" },
    { value: "Australia", emoji: "🇦🇺" },
    { value: "Germany", emoji: "🇩🇪" },
    { value: "France", emoji: "🇫🇷" },
    { value: "Spain", emoji: "🇪🇸" },
    { value: "Italy", emoji: "🇮🇹" },
    { value: "Netherlands", emoji: "🇳🇱" },
];

function ActionLegend({ expanded, onToggle, config }: { expanded: boolean; onToggle: () => void; config: ScoringConfig }) {
    // Generate dynamic definitions based on current config
    const definitions: Record<string, { definition: string; rule: string; color: string }> = {
        "Investigate": {
            definition: "Critical audit needed. High spend with 0 conversions OR ranking well but poor CTR.",
            rule: `Cost > £${config.investigate_cost_threshold} & 0 Conv OR Pos <= 6 & CTR < 50% exp.`,
            color: "#f59e0b"
        },
        "Defend": {
            definition: `Protect high-value terms where you dominate organic (#1-${config.organic_strong_pos}) but face competition.`,
            rule: `Pos <= ${config.organic_strong_pos} + (ROAS >= ${config.high_roas} or CPA < Med) + Comp >= ${config.defend_comp_threshold}`,
            color: "#7c3aed"
        },
        "Reduce Spend": {
            definition: `Cut spend on strong organic terms (#1-${config.organic_strong_pos}) where paid is inefficient or redundant.`,
            rule: `Pos <= ${config.organic_near_strong_pos} + Cost > £${config.reduce_cost_threshold} + (ROAS < ${config.low_roas} or Coverage)`,
            color: "#f97316"
        },
        "Add Exact Match": {
            definition: "Refine targeting for performing broad/phrase terms.",
            rule: `Broad/Phrase + >${config.min_clicks_exact} Clicks + ROAS >= ${config.profitable_roas}`,
            color: "#06b6d4"
        },
        "Scale Spend": {
            definition: "Increase volume for highly profitable terms.",
            rule: `ROAS >= ${config.high_roas} + Low Impr Share or Budget Limited`,
            color: "#22c55e"
        },
        "SEO Focus": {
            definition: "Target keywords with proven paid performance but low organic rank.",
            rule: `Pos > ${config.organic_weak_pos} or Pos = 0 + Paid activity exists`,
            color: "#10b981"
        },
        "Consider PPC": {
            definition: "Test paid ads for terms with no organic visibility.",
            rule: "Good organic traffic (Pos 1-10) but £0 spend + High Volume",
            color: "#6366f1"
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                        <LucideTarget className="w-4 h-4" />
                    </div>
                    <span className="font-semibold text-gray-900 dark:text-white text-sm">Action Legend</span>
                    <span className="text-[9px] font-medium px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full uppercase tracking-wide">Info</span>
                </div>
                {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>

            {expanded && (
                <div className="p-4 pt-0 space-y-3 bg-gray-50/50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700/50">
                    <div className="space-y-4 pt-3">
                        <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-gray-700">
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Opportunity Rules (Live)</span>
                        </div>
                        {Object.entries(definitions).map(([action, info]) => (
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
                                <span>Imp: {formatNumber(op.impressions_paid + op.impressions_org)}</span>
                                {op.channel_group && (
                                    <>
                                        <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                        <span className={`px-1 rounded-[2px] uppercase text-[9px] font-bold ${op.channel_group.toLowerCase().includes('shopping') ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                            op.channel_group.toLowerCase().includes('pmax') ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                                                'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                            }`}>
                                            {op.channel_group}
                                        </span>
                                    </>
                                )}
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

    useEffect(() => {
        console.log("Session Status:", status);
    }, [status]);

    // State
    const [mockMode, setMockMode] = useState(false);
    const [scoringConfig, setScoringConfig] = useState<ScoringConfig>(SCORING_CONFIG_V2);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState<string>("");

    // GSC state
    const [gscProperties, setGscProperties] = useState<string[]>([]);
    const [selectedProperty, setSelectedProperty] = useState<string>("");
    const [selectedLocation, setSelectedLocation] = useState<string>("United Kingdom");

    // Google Ads state
    const [adsCustomers, setAdsCustomers] = useState<GoogleAdsCustomer[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<string>("");

    // Date range state
    const [datePreset, setDatePreset] = useState<DatePreset>("last28");
    const [customStartDate, setCustomStartDate] = useState<string>("");
    const [customEndDate, setCustomEndDate] = useState<string>("");

    // Data state
    // Derived from raw sources using useMemo to avoid state synchronization loops
    const [rawGscData, setRawGscData] = useState<GscQueryRow[]>([]);
    const [rawAdsData, setRawAdsData] = useState<AdsSearchTermRow[]>([]);
    const [rawCampaignData, setRawCampaignData] = useState<CampaignReportRow[]>([]);
    const [keywordMetricsData, setKeywordMetricsData] = useState<KeywordMetricsRow[]>([]);
    const [missingImpressionShareColumn, setMissingImpressionShareColumn] = useState<boolean>(false);
    const [currencyCode, setCurrencyCode] = useState<string>("GBP");

    // Settings State
    const [dfsLogin, setDfsLogin] = useState<string>("");
    const [dfsPassword, setDfsPassword] = useState<string>("");
    const [showSettings, setShowSettings] = useState(false);
    const [showCsvRequirements, setShowCsvRequirements] = useState(false);

    // Brand settings
    const [brandTermsInput, setBrandTermsInput] = useState<string>("");
    const [brandTerms, setBrandTerms] = useState<string[]>([]);

    // Competitor settings
    const [competitorTermsInput, setCompetitorTermsInput] = useState<string>("");
    const [competitorTerms, setCompetitorTerms] = useState<string[]>([]);

    const [filterMinRoas, setFilterMinRoas] = useState<number | ''>('');
    const [filterMinClicks, setFilterMinClicks] = useState<number | ''>('');
    const [filterMinConversions, setFilterMinConversions] = useState<number | ''>('');
    const [showGlossary, setShowGlossary] = useState(false);

    // Table state
    const [sortKey, setSortKey] = useState<keyof MergedOpportunityRow>("projected_growth_score");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
    const [expandedQueries, setExpandedQueries] = useState<Set<string>>(new Set());

    const toggleQueryExpansion = (query: string) => {
        setExpandedQueries(prev => {
            const next = new Set(prev);
            if (next.has(query)) next.delete(query);
            else next.add(query);
            return next;
        });
    };

    // Merge data whenever raw sources change — async to avoid blocking UI
    const [mergedData, setMergedData] = useState<MergedOpportunityRow[]>([]);
    const [merging, setMerging] = useState(false);

    useEffect(() => {
        if (!rawGscData.length && !rawAdsData.length) {
            setMergedData([]);
            return;
        }

        const totalQueries = rawGscData.length + rawAdsData.length;
        setMerging(true);
        setProgress(`Merging ${totalQueries.toLocaleString()} queries...`);

        // Defer heavy computation so the browser can render the progress message
        const timeoutId = setTimeout(() => {
            try {
                const result = mergeDatasets(rawGscData, rawAdsData, brandTerms, keywordMetricsData, rawCampaignData, scoringConfig);
                setMergedData(result);
                setProgress("");
            } catch (e) {
                console.error("Merge error:", e);
                setError("Error merging data: " + String(e));
                setProgress("");
            } finally {
                setMerging(false);
            }
        }, 50); // Small delay to let the UI paint the progress message

        return () => clearTimeout(timeoutId);
    }, [rawGscData, rawAdsData, brandTerms, keywordMetricsData, rawCampaignData, scoringConfig]);

    const data = useMemo(() => {
        return mergedData.map(row => ({
            ...row,
            action: row.action_v2 || row.action,
            opportunity_score: row.score_v2 || row.opportunity_score
        }));
    }, [mergedData]);

    // V2 Distribution Logging
    useEffect(() => {
        if (data.length === 0) return;

        const counts = data.reduce((acc, row) => {
            const action = row.action || 'No Action';
            acc[action] = (acc[action] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        console.log("--- Scoring V2 Distribution ---", counts);

        // Check for balance
        const total = data.length;
        const defendCount = counts['Defend'] || 0;
        const reduceCount = counts['Reduce Spend'] || 0;

        if (defendCount < (total * 0.01)) {
            console.warn("V2 Warning: 'Defend' action is very rare (<1%). Check thresholds.");
        }
        if (reduceCount < (total * 0.01)) {
            console.warn("V2 Warning: 'Reduce Spend' action is very rare (<1%). Check thresholds.");
        }

    }, [data]);
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
    const [searchMode, setSearchMode] = useState<'contains' | 'equals' | 'regex' | 'does_not_contain'>('contains');
    const [showTop, setShowTop] = useState<number>(10);

    // File upload ref
    const fileInputRef = useRef<HTMLInputElement>(null);
    const fileInputRefGsc = useRef<HTMLInputElement>(null);
    const fileInputRefKeyword = useRef<HTMLInputElement>(null);
    const fileInputRefCampaign = useRef<HTMLInputElement>(null);

    // Analysis state
    const [analysisModalOpen, setAnalysisModalOpen] = useState(false);
    const [selectedRow, setSelectedRow] = useState<MergedOpportunityRow | null>(null);
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
        legend: false,
        methodology: false,
        scoring: false,
        glossary: false,
    });

    const clearAllData = useCallback(() => {
        setRawGscData([]);
        setRawAdsData([]);
        setKeywordMetricsData([]);
        setRawCampaignData([]);
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

    // Sync brandTermsInput to brandTerms with debounce
    useEffect(() => {
        const timer = setTimeout(() => {
            const terms = brandTermsInput.split(',')
                .map(t => t.trim().toLowerCase())
                .filter(t => t.length > 0);

            // Only update if actually changed to avoid unnecessary re-merges
            setBrandTerms(prev => {
                if (prev.length === terms.length && prev.every((t, i) => t === terms[i])) {
                    return prev;
                }
                return terms;
            });
        }, 800);

        return () => clearTimeout(timer);
    }, [brandTermsInput]);

    // Sync competitorTermsInput to competitorTerms with debounce
    useEffect(() => {
        const timer = setTimeout(() => {
            const terms = competitorTermsInput.split(',')
                .map(t => t.trim().toLowerCase())
                .filter(t => t.length > 0);

            setCompetitorTerms(prev => {
                if (prev.length === terms.length && prev.every((t, i) => t === terms[i])) {
                    return prev;
                }
                return terms;
            });
        }, 800);

        return () => clearTimeout(timer);
    }, [competitorTermsInput]);

    // Fetch and update data
    const handleFetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        setProgress("Starting data fetch...");

        // Clear existing data to avoid stale state
        setRawGscData([]);
        setRawAdsData([]);
        setRawCampaignData([]);

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

    // Helper to clean currency/number strings
    const cleanNum = (val: any): number => {
        if (typeof val === 'number') return val;
        if (!val) return 0;
        // Handle commas, currency symbols, percentages
        return parseFloat(String(val).replace(/[£$,%]/g, '').trim()) || 0;
    };

    // Helper for percentages (e.g. "10.5%" -> 0.105)
    const cleanPercent = (val: any): number | null => {
        if (val === null || val === undefined || val === '') return null;
        const str = String(val).trim();
        if (str === '--') return null;
        if (str.includes('< 10%')) return 0.05;
        if (str.includes('> 90%')) return 0.95;

        const num = parseFloat(str.replace(/[%]/g, ''));
        if (isNaN(num)) return null;

        // Standardize: if string had %, divide by 100.
        if (str.includes('%')) return num / 100;
        return num <= 1 ? num : num / 100;
    };

    // Handle CSV Upload for Campaign Report
    const handleCampaignFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setProgress("Parsing Campaign CSV...");

        Papa.parse(file, {
            header: false,
            skipEmptyLines: true,
            complete: (results) => {
                try {
                    const rawData = results.data as string[][];
                    if (!rawData || rawData.length === 0) {
                        setError('Campaign CSV appears empty.');
                        setProgress("");
                        return;
                    }

                    // Find header row
                    // Look for standard columns: Campaign, Cost, Clicks, etc.
                    const headerIndex = rawData.findIndex(row =>
                        row.some(cell => {
                            const c = String(cell).toLowerCase().trim();
                            return c === 'campaign' && row.some(x => String(x).toLowerCase().trim() === 'cost');
                        })
                    );

                    if (headerIndex === -1 || !rawData[headerIndex]) {
                        setError("Could not find Campaign Report headers (Campaign, Cost).");
                        setProgress("");
                        return;
                    }

                    const headers = rawData[headerIndex].map(h => String(h).trim().toLowerCase());
                    const rows = rawData.slice(headerIndex + 1);
                    const findCol = (names: string[]) => headers.findIndex(h => names.includes(h));

                    const campIdx = findCol(['campaign']);
                    const typeIdx = findCol(['campaign type']);
                    const costIdx = findCol(['cost']);
                    const clicksIdx = findCol(['clicks']);
                    const convIdx = findCol(['conversions']);
                    const valIdx = findCol(['conv. value', 'conversion value']);
                    const isIdx = findCol(['search impr. share', 'impr. share']);
                    const statusIdx = findCol(['campaign status', 'status']);
                    const reasonsIdx = findCol(['status reasons']); // "Budget constrained" etc.
                    const bidStratIdx = findCol(['bid strategy type']);
                    const budgetIdx = findCol(['budget']);

                    if (campIdx === -1) {
                        setError("Campaign CSV must have 'Campaign' column.");
                        setProgress("");
                        return;
                    }

                    const campRows: CampaignReportRow[] = rows
                        .filter(row => row[campIdx] && String(row[campIdx]).trim() !== '')
                        .map(row => {
                            return {
                                campaign: String(row[campIdx]),
                                campaignType: typeIdx >= 0 ? String(row[typeIdx]) : 'Search',
                                cost: costIdx >= 0 ? cleanNum(row[costIdx]) : 0,
                                clicks: clicksIdx >= 0 ? cleanNum(row[clicksIdx]) : 0,
                                conversions: convIdx >= 0 ? cleanNum(row[convIdx]) : 0,
                                convValue: valIdx >= 0 ? cleanNum(row[valIdx]) : 0,
                                searchImprShare: isIdx >= 0 ? cleanPercent(row[isIdx]) : null,
                                status: statusIdx >= 0 ? String(row[statusIdx]) : '',
                                statusReasons: reasonsIdx >= 0 ? String(row[reasonsIdx]) : '',
                                bidStrategyType: bidStratIdx >= 0 ? String(row[bidStratIdx]) : '',
                                budget: budgetIdx >= 0 ? cleanNum(row[budgetIdx]) : null
                            };
                        });

                    if (campRows.length === 0) {
                        setError("No valid campaigns found.");
                        setProgress("");
                        return;
                    }

                    setRawCampaignData(campRows);
                    setProgress("");
                    setError(null);
                    if (fileInputRefCampaign.current) fileInputRefCampaign.current.value = '';

                } catch (e) {
                    setError("Campaign CSV Parse Error: " + String(e));
                    setProgress("");
                }
            }
        });
    };

    // Handle CSV Upload for GSC
    const handleGscFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setProgress("Parsing GSC CSV...");

        Papa.parse(file, {
            header: false,
            skipEmptyLines: true,
            complete: (results) => {
                try {
                    const rawData = results.data as string[][];
                    if (!rawData || rawData.length === 0) {
                        setError('GSC CSV appears empty.');
                        setProgress("");
                        return;
                    }

                    // Find header row
                    const headerIndex = rawData.findIndex(row =>
                        row.some(cell => {
                            const c = String(cell).toLowerCase().trim();
                            return c === 'query' || c === 'top queries' || c === 'clicks';
                        })
                    );

                    if (headerIndex === -1 || !rawData[headerIndex]) {
                        setError("Could not find GSC headers. Expected 'Query' or 'Top queries'.");
                        setProgress("");
                        return;
                    }

                    const headers = rawData[headerIndex].map(h => String(h).trim().toLowerCase());
                    const rows = rawData.slice(headerIndex + 1);

                    const findCol = (names: string[]) => headers.findIndex(h => names.includes(h));
                    const queryIdx = findCol(['query', 'top queries']);
                    const clicksIdx = findCol(['clicks']);
                    const imprIdx = findCol(['impressions']);
                    const posIdx = findCol(['position']);

                    if (queryIdx === -1 || clicksIdx === -1) {
                        setError("GSC CSV missing required columns (Query, Clicks).");
                        setProgress("");
                        return;
                    }

                    const gscRows: GscQueryRow[] = rows
                        .filter(row => row[queryIdx] && String(row[queryIdx]).trim() !== '')
                        .map(row => {
                            const clicks = cleanNum(row[clicksIdx]);
                            const impressions = cleanNum(row[imprIdx]);
                            return {
                                query: String(row[queryIdx]),
                                clicks,
                                impressions,
                                ctr: impressions > 0 ? clicks / impressions : 0,
                                position: cleanNum(row[posIdx])
                            };
                        });

                    if (gscRows.length === 0) {
                        setError("No valid queries found in CSV.");
                        setProgress("");
                        return;
                    }

                    setRawGscData(gscRows);
                    setProgress("");
                    setError(null);
                    if (fileInputRefGsc.current) fileInputRefGsc.current.value = '';
                } catch (e) {
                    setError("GSC Parse Error: " + String(e));
                    setProgress("");
                }
            }
        });
    };

    // Handle CSV Upload for Google Ads
    const handleAdsFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setProgress("Parsing Ads CSV...");

        Papa.parse(file, {
            header: false,
            skipEmptyLines: true,
            complete: (results) => {
                try {
                    const rawData = results.data as string[][];
                    if (!rawData || rawData.length === 0) {
                        setError('Ads CSV appears empty.');
                        setProgress("");
                        return;
                    }

                    const headerIndex = rawData.findIndex(row =>
                        row.some(cell => {
                            const c = String(cell).toLowerCase().trim();
                            return c === 'search term' || c === 'search keyword' || c === 'cost';
                        })
                    );

                    if (headerIndex === -1 || !rawData[headerIndex]) {
                        setError("Could not find Ads headers.");
                        setProgress("");
                        return;
                    }

                    const headers = rawData[headerIndex].map(h => String(h).trim().toLowerCase());
                    const rows = rawData.slice(headerIndex + 1);
                    const findCol = (names: string[]) => headers.findIndex(h => names.includes(h));

                    const termIdx = findCol(['search term', 'search keyword', 'keyword']);
                    const costIdx = findCol(['cost']);
                    const clicksIdx = findCol(['clicks']);
                    const imprIdx = findCol(['impressions', 'impr.']);
                    const convIdx = findCol(['conversions']);
                    const valIdx = findCol(['conv. value', 'conversion value', 'total conv. value']);
                    const campIdx = findCol(['campaign', 'campaign name']);
                    const agIdx = findCol(['ad group', 'ad group name']);
                    const matchIdx = findCol(['match type']);
                    const isIdx = findCol(['search impr. share', 'impr. share', 'search impression share']);
                    const lostIdx = findCol(['search lost IS (rank)', 'lost IS (rank)']);
                    const topIdx = findCol(['impr. (top) %']);
                    const absTopIdx = findCol(['impr. (abs. top) %']);

                    if (termIdx === -1 || costIdx === -1) {
                        setError("Ads CSV missing required columns.");
                        setProgress("");
                        return;
                    }

                    const adsRows: AdsSearchTermRow[] = rows
                        .filter(row => {
                            const term = String(row[termIdx] || '').trim().toLowerCase();
                            return term && term !== 'total' && !term.startsWith('total:');
                        })
                        .map(row => {
                            const cost = cleanNum(row[costIdx]);
                            const impressions = cleanNum(row[imprIdx]);
                            const clicks = cleanNum(row[clicksIdx]);
                            const conversions = cleanNum(row[convIdx]);
                            const convValue = cleanNum(row[valIdx]);

                            let isVal = cleanPercent(row[isIdx]);
                            if (isVal === null) {
                                const t = cleanPercent(row[topIdx]);
                                const at = cleanPercent(row[absTopIdx]);
                                isVal = at !== null ? at : t;
                            }

                            return {
                                searchTerm: String(row[termIdx]),
                                costMicros: cost * 1_000_000,
                                impressions,
                                clicks,
                                conversions,
                                conversionValue: convValue,
                                ctr: impressions > 0 ? clicks / impressions : 0,
                                averageCpc: clicks > 0 ? cost / clicks : 0,
                                campaign: row[campIdx] ? String(row[campIdx]) : 'Uploaded CSV',
                                adGroup: row[agIdx] ? String(row[agIdx]) : 'Uploaded CSV',
                                matchType: row[matchIdx] ? String(row[matchIdx]) : 'Broad',
                                impressionShare: isVal,
                                budgetLostImpressionShare: null,
                                rankLostImpressionShare: cleanPercent(row[lostIdx]),
                                conversionRate: clicks > 0 ? conversions / clicks : 0
                            };
                        });

                    if (adsRows.length === 0) {
                        setError("No valid search terms found in CSV.");
                        setProgress("");
                        return;
                    }

                    setRawAdsData(adsRows);
                    setProgress("");
                    setError(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                } catch (e) {
                    setError("Ads Parse Error: " + String(e));
                    setProgress("");
                }
            }
        });
    };

    // Handle CSV Upload for Keyword Metrics (Auction Insights)
    const handleKeywordFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setProgress("Parsing Keyword Auction CSV...");

        Papa.parse(file, {
            header: false,
            skipEmptyLines: true,
            complete: (results) => {
                try {
                    const rawData = results.data as string[][];
                    const headerIndex = rawData.findIndex(row =>
                        row.some(cell => String(cell).toLowerCase().trim() === 'keyword') &&
                        row.some(cell => String(cell).toLowerCase().trim() === 'campaign')
                    );

                    if (headerIndex === -1 || !rawData[headerIndex]) {
                        setError("Could not find Keyword Auction headers.");
                        setProgress("");
                        return;
                    }

                    const headers = rawData[headerIndex].map(h => String(h).trim().toLowerCase());
                    const rows = rawData.slice(headerIndex + 1);
                    const findCol = (names: string[]) => headers.findIndex(h => names.includes(h));

                    const kwIdx = findCol(['keyword']);
                    const campIdx = findCol(['campaign']);
                    const agIdx = findCol(['ad group']);
                    const isIdx = findCol(['search impr. share', 'impr. share']);
                    const lostIdx = findCol(['search lost IS (rank)', 'lost IS (rank)']);
                    const topIdx = findCol(['impr. (top) %']);
                    const absTopIdx = findCol(['impr. (abs. top) %']);

                    const kwRows: KeywordMetricsRow[] = rows
                        .filter(row => row[kwIdx] && String(row[kwIdx]).trim() !== '')
                        .map(row => ({
                            keyword: String(row[kwIdx]),
                            campaign: String(row[campIdx]),
                            adGroup: row[agIdx] ? String(row[agIdx]) : '',
                            searchImprShare: cleanPercent(row[isIdx]),
                            searchLostIsRank: cleanPercent(row[lostIdx]),
                            imprTopPct: cleanPercent(row[topIdx]),
                            imprAbsTopPct: cleanPercent(row[absTopIdx])
                        }));

                    setKeywordMetricsData(kwRows);
                    setProgress("");
                    setError(null);
                    if (fileInputRefKeyword.current) fileInputRefKeyword.current.value = '';
                } catch (e) {
                    setError("Keyword Parse Error: " + String(e));
                    setProgress("");
                }
            }
        });
    };

    const handleAnalyze = async (row: MergedOpportunityRow) => {
        setSelectedRow(row);
        setAnalysisModalOpen(true);
        setAnalysisLoading(true);
        setAnalysisData(null);
        setAnalysisError(null);

        try {
            const res = await fetch("/api/serp-analysis", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    keyword: row.query,
                    action: row.action,
                    targetDomain: selectedProperty,
                    location: selectedLocation,
                    position: row.position_org,
                    login: dfsLogin,
                    password: dfsPassword
                })
            });

            if (res.ok) {
                const data = await res.json();
                setAnalysisData(data);
            } else {
                const errorData = await res.json().catch(() => ({}));
                setAnalysisError(errorData.error || "Analysis failed. Please check API settings.");
            }
        } catch (e) {
            setAnalysisError("Analysis Error: " + String(e));
        } finally {
            setAnalysisLoading(false);
        }
    };

    // Memoized dataset views and metrics
    const uniqueCampaigns = useMemo(() => {
        const campaigns = new Set<string>();
        data.forEach(r => { if (r.campaign) campaigns.add(r.campaign); });
        return Array.from(campaigns).sort();
    }, [data]);

    const uniqueAdGroups = useMemo(() => {
        const groups = new Set<string>();
        data.forEach(r => { if (r.adGroup) groups.add(r.adGroup); });
        return Array.from(groups).sort();
    }, [data]);

    const filteredData = useMemo<MergedOpportunityRow[]>(() => {
        const q = searchQuery.toLowerCase();
        let searchRe: RegExp | null = null;
        if (searchMode === 'regex' && searchQuery) {
            try {
                searchRe = new RegExp(searchQuery, 'i');
            } catch (e) {
                // Invalid regex, will fallback to matchesSearch = true
            }
        }

        const results = data.filter(row => {
            const matchesAction = filterActions.length === 0 || filterActions.includes(row.action);
            const matchesCampaign = filterCampaign === "all" || row.campaign === filterCampaign;
            const matchesAdGroup = filterAdGroup === "all" || row.adGroup === filterAdGroup;
            let matchesSearch = true;
            if (searchQuery) {
                const rowQ = row.query.toLowerCase();

                if (searchMode === 'equals') {
                    matchesSearch = rowQ === q;
                } else if (searchMode === 'regex') {
                    matchesSearch = searchRe ? searchRe.test(row.query) : true;
                } else if (searchMode === 'does_not_contain') {
                    matchesSearch = !rowQ.includes(q);
                } else {
                    matchesSearch = rowQ.includes(q);
                }
            }

            // Competitor filter (exclude)
            if (competitorTerms.length > 0) {
                const queryLower = row.query.toLowerCase();
                if (competitorTerms.some(term => queryLower.includes(term))) {
                    return false;
                }
            }

            // Numeric filters
            const matchesMinRoas = filterMinRoas === '' || (row.roas_paid !== null && row.roas_paid >= filterMinRoas);
            const matchesMinClicks = filterMinClicks === '' || (row.clicks_org >= filterMinClicks || row.clicks_paid >= filterMinClicks);
            const matchesMinConversions = filterMinConversions === '' || (row.conversions_paid >= filterMinConversions);

            return matchesAction && matchesCampaign && matchesAdGroup && matchesSearch && matchesMinRoas && matchesMinClicks && matchesMinConversions;
        });

        return [...results].sort((a, b) => {
            const aVal = a[sortKey];
            const bVal = b[sortKey];

            if (aVal === null || aVal === undefined) return sortDir === "asc" ? -1 : 1;
            if (bVal === null || bVal === undefined) return sortDir === "asc" ? 1 : -1;

            if (typeof aVal === "string" && typeof bVal === "string") {
                return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
            }

            return sortDir === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
        });
    }, [data, filterActions, filterCampaign, filterAdGroup, searchQuery, searchMode, sortKey, sortDir, competitorTerms, filterMinRoas, filterMinClicks, filterMinConversions]);

    const visibleData = useMemo<MergedOpportunityRow[]>(() => {
        const result: MergedOpportunityRow[] = [];
        const topLevel = filteredData.filter(r => !r.parent_query);

        topLevel.slice(0, showTop).forEach(parent => {
            result.push(parent);
            if (parent.is_total_row && expandedQueries.has(parent.query)) {
                // Find children in the original merged data
                const children = data.filter(r => r.parent_query === parent.query);
                result.push(...children);
            }
        });
        return result;
    }, [filteredData, data, expandedQueries, showTop]);

    const summary = useMemo(() => calculateSummary(filteredData), [filteredData]);
    const actionChartData = useMemo(() => prepareActionChartData(filteredData), [filteredData]);
    const scoreDistribution = useMemo(() => prepareScoreDistribution(filteredData), [filteredData]);
    const scatterData = useMemo(() => prepareScatterData(filteredData), [filteredData]);

    const quickWins = useMemo(() => {
        if (!data.length) return null;
        // Combine queries by considering only the total rows or independent rows
        const consolidatedData = data.filter(r => !r.parent_query);
        return {
            pausePpc: consolidatedData.filter(r => r.action === 'Reduce Spend').sort((a, b) => b.cost_paid - a.cost_paid).slice(0, 5),
            scaleSpend: consolidatedData.filter(r => r.action === 'Scale Spend').sort((a, b) => (b.roas_paid || 0) - (a.roas_paid || 0)).slice(0, 5),
            seoFocus: consolidatedData.filter(r => r.action === 'SEO Focus').sort((a, b) => b.conversions_paid - a.conversions_paid).slice(0, 5),
        };
    }, [data]);

    const handleSort = (key: keyof MergedOpportunityRow) => {
        if (sortKey === key) {
            setSortDir(sortDir === "asc" ? "desc" : "asc");
        } else {
            setSortKey(key);
            setSortDir("desc");
        }
    };

    const handleExportCsv = useCallback(() => {
        if (!filteredData.length) return;
        const csv = Papa.unparse(filteredData);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `seo-ppc-opportunities-${new Date().toISOString().split('T')[0]}.csv`);
        link.click();
    }, [filteredData]);

    const handlePrint = useCallback(() => {
        window.print();
    }, []);

    // Loading state
    if (status === "loading") {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="flex min-h-screen bg-gray-100 dark:bg-gray-900 transition-colors">
            {/* Sidebar */}
            <aside className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex-shrink-0 flex flex-col fixed h-full z-10">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <Link
                        href="/"
                        className="flex items-center text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
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

                        {/* ========== CONFIGURATION SECTIONS (Require Input) ========== */}

                        {/* Settings / API Keys */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl border-2 border-purple-200 dark:border-purple-800/50 overflow-hidden shadow-sm">
                            <button
                                onClick={() => setShowSettings(!showSettings)}
                                className="w-full flex items-center justify-between p-4 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-purple-100 dark:bg-purple-900/30 rounded-lg text-purple-600 dark:text-purple-400">
                                        <Zap className="w-4 h-4" />
                                    </div>
                                    <span className="font-semibold text-gray-900 dark:text-white text-sm">API Settings</span>
                                    <span className="text-[9px] font-bold px-2 py-0.5 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded-full uppercase tracking-wide">Configure</span>
                                    {dfsLogin && dfsPassword && (
                                        <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                                    )}
                                </div>
                                {showSettings ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                            </button>

                            {showSettings && (
                                <div className="p-4 pt-0 space-y-3 bg-purple-50/30 dark:bg-purple-900/10">
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        Enter DataForSEO credentials for live SERP analysis.
                                        <a href="https://app.dataforseo.com/register" target="_blank" rel="noopener noreferrer" className="ml-1 text-blue-600 hover:underline">
                                            Get API Key
                                        </a>
                                    </p>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">API Login</label>
                                        <input
                                            type="text"
                                            value={dfsLogin}
                                            onChange={(e) => setDfsLogin(e.target.value)}
                                            placeholder="email@example.com"
                                            className="w-full px-3 py-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">API Password</label>
                                        <input
                                            type="password"
                                            value={dfsPassword}
                                            onChange={(e) => setDfsPassword(e.target.value)}
                                            placeholder="API Password"
                                            className="w-full px-3 py-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                                        />
                                    </div>
                                    {dfsLogin && dfsPassword && (
                                        <div className="flex items-center gap-1.5 px-2 py-1 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded text-[10px] text-green-700 dark:text-green-400 mt-2">
                                            <CheckCircle className="w-3 h-3" />
                                            <span>Credentials configured successfully</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Scoring Configuration Tweak */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl border-2 border-blue-200 dark:border-blue-800/50 overflow-hidden shadow-sm">
                            <button
                                onClick={() => toggleSection('scoring')}
                                className="w-full flex items-center justify-between p-4 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                                        <Settings className="w-4 h-4" />
                                    </div>
                                    <span className="font-semibold text-gray-900 dark:text-white text-sm">Fine-Tune Scoring</span>
                                    <span className="text-[9px] font-bold px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full uppercase tracking-wide">Configure</span>
                                </div>
                                {expandedSections.scoring ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                            </button>

                            {expandedSections.scoring && (
                                <div className="p-4 pt-0 space-y-4 bg-blue-50/30 dark:bg-blue-900/10 border-t border-blue-100 dark:border-blue-900/30">
                                    <div className="pt-3 space-y-4">
                                        {/* Organic Position Thresholds */}
                                        <div className="space-y-3 pb-3 border-b border-gray-200 dark:border-gray-700">
                                            <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Organic Position Thresholds</p>

                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                    Strong Position (1-N) - For Defend/Reduce logic
                                                </label>
                                                <input
                                                    type="number"
                                                    step="1"
                                                    min="1"
                                                    max="10"
                                                    value={scoringConfig.organic_strong_pos}
                                                    onChange={(e) => setScoringConfig(prev => ({ ...prev, organic_strong_pos: parseInt(e.target.value) || 1 }))}
                                                    className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                                                />
                                                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">Default: 2 (positions 1-2 are &quot;strong&quot;)</p>
                                            </div>

                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                    Near-Strong Position (1-N) - For Reduce Spend consideration
                                                </label>
                                                <input
                                                    type="number"
                                                    step="1"
                                                    min="1"
                                                    max="10"
                                                    value={scoringConfig.organic_near_strong_pos}
                                                    onChange={(e) => setScoringConfig(prev => ({ ...prev, organic_near_strong_pos: parseInt(e.target.value) || 2 }))}
                                                    className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                                                />
                                                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">Default: 4 (positions 3-4 are &quot;near-strong&quot;)</p>
                                            </div>

                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                    Weak Position Threshold - For SEO Focus
                                                </label>
                                                <input
                                                    type="number"
                                                    step="1"
                                                    min="5"
                                                    max="50"
                                                    value={scoringConfig.organic_weak_pos}
                                                    onChange={(e) => setScoringConfig(prev => ({ ...prev, organic_weak_pos: parseInt(e.target.value) || 10 }))}
                                                    className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                                                />
                                                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">Default: 10 (positions beyond 10 are &quot;weak&quot;)</p>
                                            </div>
                                        </div>

                                        {/* ROAS Thresholds */}
                                        <div className="space-y-3 pb-3 border-b border-gray-200 dark:border-gray-700">
                                            <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">ROAS Thresholds</p>

                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                    High ROAS Goal (defend/scale)
                                                </label>
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    value={scoringConfig.high_roas}
                                                    onChange={(e) => setScoringConfig(prev => ({ ...prev, high_roas: parseFloat(e.target.value) || 0 }))}
                                                    className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                    Low ROAS Threshold (waste/reduce)
                                                </label>
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    value={scoringConfig.low_roas}
                                                    onChange={(e) => setScoringConfig(prev => ({ ...prev, low_roas: parseFloat(e.target.value) || 0 }))}
                                                    className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                                                />
                                            </div>
                                        </div>

                                        {/* Cost Threshold */}
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                Wasted Spend Threshold (£)
                                            </label>
                                            <input
                                                type="number"
                                                value={scoringConfig.reduce_cost_threshold}
                                                onChange={(e) => setScoringConfig(prev => ({ ...prev, reduce_cost_threshold: parseInt(e.target.value) || 0 }))}
                                                className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                                            />
                                        </div>

                                        <div className="p-2 bg-amber-50 dark:bg-amber-900/10 rounded border border-amber-100 dark:border-amber-900/30">
                                            <p className="text-[10px] text-amber-700 dark:text-amber-400 leading-tight">
                                                Adjusting these values will immediately recalculate all opportunity scores and actions.
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => setScoringConfig(SCORING_CONFIG_V2)}
                                            className="w-full py-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                                        >
                                            Reset to Defaults
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Divider between Configuration and Informational sections */}
                        <div className="relative py-4">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t-2 border-gray-200 dark:border-gray-700"></div>
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-gray-50 dark:bg-gray-900 px-3 py-1 text-gray-500 dark:text-gray-400 font-semibold tracking-wider rounded-full border border-gray-200 dark:border-gray-700">
                                    Information & Guides
                                </span>
                            </div>
                        </div>

                        {/* Action Legend */}
                        <ActionLegend
                            expanded={expandedSections.legend}
                            onToggle={() => toggleSection('legend')}
                            config={scoringConfig}
                        />

                        {/* Scoring Methodology Dropdown */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                            <button
                                onClick={() => toggleSection('methodology')}
                                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
                                        <TrendingUp className="w-4 h-4" />
                                    </div>
                                    <span className="font-semibold text-gray-900 dark:text-white text-sm">How Scoring Works</span>
                                    <span className="text-[9px] font-medium px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full uppercase tracking-wide">Info</span>
                                </div>
                                {expandedSections.methodology ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                            </button>

                            {expandedSections.methodology && (
                                <div className="p-4 pt-0 space-y-4 bg-gray-50/50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700/50">
                                    <div className="pt-3 space-y-4">
                                        {/* Save Score Section */}
                                        <div className="space-y-2 p-3 bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-800/30 rounded-lg">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold">S</div>
                                                <h4 className="text-sm font-bold text-orange-900 dark:text-orange-300">Save Score (0-100)</h4>
                                            </div>
                                            <p className="text-[11px] text-orange-800 dark:text-orange-400 leading-relaxed">
                                                Identifies opportunities to <strong>reduce wasted ad spend</strong> by highlighting queries where:
                                            </p>
                                            <ul className="text-[10px] text-orange-700 dark:text-orange-500 space-y-1 pl-4 list-disc">
                                                <li>You already rank organically in top positions (1-{scoringConfig.organic_strong_pos})</li>
                                                <li>Paid ads have low ROAS (&lt; {scoringConfig.high_roas}x) or high cost with minimal conversion benefit</li>
                                                <li>Organic CTR is strong, meaning users prefer your organic result</li>
                                                <li>Cost exceeds £{scoringConfig.reduce_cost_threshold} with position ≤ {scoringConfig.organic_near_strong_pos}</li>
                                            </ul>
                                            <p className="text-[10px] text-orange-700 dark:text-orange-500 pt-1 italic">
                                                💡 <strong>Higher Save Score</strong> = Greater potential to cut costs without losing visibility
                                            </p>
                                        </div>

                                        {/* Grow Score Section */}
                                        <div className="space-y-2 p-3 bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-800/30 rounded-lg">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-bold">G</div>
                                                <h4 className="text-sm font-bold text-green-900 dark:text-green-300">Grow Score (0-100)</h4>
                                            </div>
                                            <p className="text-[11px] text-green-800 dark:text-green-400 leading-relaxed">
                                                Identifies opportunities to <strong>capture new value</strong> through increased investment or SEO effort:
                                            </p>
                                            <ul className="text-[10px] text-green-700 dark:text-green-500 space-y-1 pl-4 list-disc">
                                                <li>High ROAS (&gt; {scoringConfig.high_roas}x) or strong conversion performance</li>
                                                <li>Low Impression Share (&lt; {scoringConfig.low_impression_share}%) = untapped search volume</li>
                                                <li>Weak organic position (&gt; {scoringConfig.organic_weak_pos}) = SEO upside potential</li>
                                                <li>High search volume + proven conversion rate = scalable opportunity</li>
                                            </ul>
                                            <p className="text-[10px] text-green-700 dark:text-green-500 pt-1 italic">
                                                💡 <strong>Higher Grow Score</strong> = Greater potential to increase traffic and revenue
                                            </p>
                                        </div>

                                        {/* How Scores Drive Actions */}
                                        <div className="space-y-2 p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30 rounded-lg">
                                            <h4 className="text-sm font-bold text-blue-900 dark:text-blue-300">🎯 How Actions are Determined</h4>
                                            <p className="text-[10px] text-blue-800 dark:text-blue-400 leading-relaxed">
                                                Each query is evaluated across multiple dimensions (organic position, ROAS, competition, impression share) to assign a <strong>strategic action</strong>:
                                            </p>
                                            <div className="space-y-1.5 pt-2">
                                                <div className="flex items-start gap-2">
                                                    <span className="text-[9px] font-bold text-purple-600 dark:text-purple-400 px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 rounded">DEFEND</span>
                                                    <span className="text-[10px] text-blue-700 dark:text-blue-400">Protect #1-{scoringConfig.organic_strong_pos} rankings with high competition</span>
                                                </div>
                                                <div className="flex items-start gap-2">
                                                    <span className="text-[9px] font-bold text-red-600 dark:text-red-400 px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 rounded">REDUCE</span>
                                                    <span className="text-[10px] text-blue-700 dark:text-blue-400">Cut spend on strong organic positions (≤{scoringConfig.organic_near_strong_pos}) + cost &gt; £{scoringConfig.reduce_cost_threshold}</span>
                                                </div>
                                                <div className="flex items-start gap-2">
                                                    <span className="text-[9px] font-bold text-green-600 dark:text-green-400 px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 rounded">SCALE</span>
                                                    <span className="text-[10px] text-blue-700 dark:text-blue-400">Increase spend on high ROAS (&gt;{scoringConfig.high_roas}x) + low IS% (&lt;{scoringConfig.low_impression_share}%)</span>
                                                </div>
                                                <div className="flex items-start gap-2">
                                                    <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400 px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 rounded">SEO</span>
                                                    <span className="text-[10px] text-blue-700 dark:text-blue-400">Improve rankings for weak positions (&gt;{scoringConfig.organic_weak_pos}) with search volume</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Priority Logic */}
                                        <div className="space-y-2 p-3 bg-gray-100 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-700/30 rounded-lg">
                                            <h4 className="text-xs font-bold text-gray-900 dark:text-gray-300">⚙️ Priority & Scoring Logic</h4>
                                            <p className="text-[10px] text-gray-700 dark:text-gray-400 leading-relaxed">
                                                The system uses a <strong>multi-factor weighted model</strong> considering:
                                            </p>
                                            <ul className="text-[10px] text-gray-600 dark:text-gray-500 space-y-0.5 pl-4 list-disc">
                                                <li><strong>Financial Impact:</strong> Cost, ROAS, conversion value, CPA</li>
                                                <li><strong>Organic Performance:</strong> Position, CTR, clicks, impressions</li>
                                                <li><strong>Market Dynamics:</strong> Competition score, impression share, search volume</li>
                                                <li><strong>Strategic Fit:</strong> Brand defense, multi-channel coverage, opportunity tier</li>
                                            </ul>
                                            <p className="text-[10px] text-gray-600 dark:text-gray-500 pt-2 italic">
                                                📊 Scores are normalized 0-100, with higher scores indicating higher priority for action.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* CSV Requirements Dropdown */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden mb-3">
                            <button
                                onClick={() => setShowCsvRequirements(!showCsvRequirements)}
                                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-green-100 dark:bg-green-900/30 rounded-lg text-green-600 dark:text-green-400">
                                        <FileText className="w-4 h-4" />
                                    </div>
                                    <span className="font-semibold text-gray-900 dark:text-white text-sm">CSV Requirements</span>
                                    <span className="text-[9px] font-medium px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full uppercase tracking-wide">Info</span>
                                </div>
                                {showCsvRequirements ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                            </button>

                            {showCsvRequirements && (
                                <div className="p-4 pt-0 space-y-3 bg-gray-50/50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700/50">
                                    <div className="space-y-3 pt-3">
                                        <div>
                                            <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-1">Google Search Console (Performance Report)</p>
                                            <p className="text-[10px] text-gray-500 mb-1">Export &quot;Queries&quot; report. Required columns:</p>
                                            <ul className="text-[10px] text-gray-600 dark:text-gray-400 list-disc pl-3 space-y-0.5">
                                                <li><code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">Top queries</code> or <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">Query</code></li>
                                                <li><code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">Clicks</code>, <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">Impressions</code>, <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">Position</code></li>
                                            </ul>
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-purple-600 dark:text-purple-400 mb-1">Google Ads (Search Terms Report)</p>
                                            <p className="text-[10px] text-gray-500 mb-1">Required for drill-down & conversion data:</p>
                                            <ul className="text-[10px] text-gray-600 dark:text-gray-400 list-disc pl-3 space-y-0.5">
                                                <li><code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">Search term</code>, <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">Cost</code>, <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">Clicks</code></li>
                                                <li><code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">Conversions</code>, <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">Conv. value</code></li>
                                            </ul>
                                            <p className="text-[10px] text-gray-500 mt-1">Recommended:</p>
                                            <ul className="text-[10px] text-gray-600 dark:text-gray-400 list-disc pl-3 space-y-0.5">
                                                <li><code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">Campaign</code>, <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">Ad group</code>, <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">Match type</code></li>
                                            </ul>
                                        </div>
                                        <div className="pt-2 border-t border-gray-100 dark:border-gray-700/50">
                                            <p className="text-xs font-bold text-violet-600 dark:text-violet-400 mb-1">Google Ads (Auction Insights / Keywords)</p>
                                            <p className="text-[10px] text-gray-500 mb-1">Required for Competition Scoring:</p>
                                            <ul className="text-[10px] text-gray-600 dark:text-gray-400 list-disc pl-3 space-y-0.5">
                                                <li><code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">Keyword</code>, <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">Campaign</code>, <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">Ad group</code></li>
                                                <li><code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">Search Impr. share</code>, <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">Search lost IS (rank)</code></li>
                                            </ul>
                                        </div>
                                        <div className="pt-2 border-t border-gray-100 dark:border-gray-700/50">
                                            <p className="text-xs font-bold text-pink-600 dark:text-pink-400 mb-1">Google Ads (Campaign Report)</p>
                                            <p className="text-[10px] text-gray-500 mb-1">Required for Multi-Channel Pivot:</p>
                                            <ul className="text-[10px] text-gray-600 dark:text-gray-400 list-disc pl-3 space-y-0.5">
                                                <li><code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">Campaign</code>, <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">Campaign type</code> (e.g. Shopping/PMax)</li>
                                                <li><code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">Status</code>, <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">Status reasons</code></li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Metric Glossary Dropdown */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                            <button
                                onClick={() => toggleSection('glossary')}
                                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                                        <Book className="w-4 h-4" />
                                    </div>
                                    <span className="font-semibold text-gray-900 dark:text-white text-sm">Metric Glossary</span>
                                    <span className="text-[9px] font-medium px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full uppercase tracking-wide">Info</span>
                                </div>
                                {expandedSections.glossary ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                            </button>

                            {expandedSections.glossary && (
                                <div className="p-4 pt-0 space-y-3 bg-gray-50/50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700/50">
                                    <div className="space-y-3 pt-3">
                                        {[
                                            { term: "POS", details: "Average organic ranking position from Google Search Console (GSC)." },
                                            { term: "ORG CLK", details: "Number of organic clicks received from Google Search (GSC)." },
                                            { term: "CTR", details: "Click-Through Rate: Clicks / Impressions." },
                                            { term: "Paid Clk", details: "Number of paid clicks from Google Ads." },
                                            { term: "Cost", details: "Total ad spend for the query/term." },
                                            { term: "Conv", details: "Conversions: Number of goals completed (sales, leads)." },
                                            { term: "CVR", details: "Conversion Rate: Conversions / Paid Clicks." },
                                            { term: "ROAS", details: "Return on Ad Spend: Conversion Value / Cost. Higher is better." },
                                            { term: "IS %", details: "Search Impression Share: The percentage of impressions your ads received compared to the total number of impressions your ads were eligible for." },
                                            { term: "Save Score", details: "Priority for reducing spend. High score = High potential waste (e.g. paying for traffic you already win organically)." },
                                            { term: "Grow Score", details: "Priority for increasing spend or SEO effort. High score = High potential to capture new value." },
                                            { term: "Comp Score", details: "Competition Score (0-100): Estimate of auction intensity based on CPC and number of advertisers." },
                                            { term: "Cov Score", details: "Coverage Score (0-100): Indicates how well you cover this term across Search, Shopping, and PMax." },
                                        ].map((t, i) => (
                                            <div key={i} className="bg-white dark:bg-gray-900/50 p-2 rounded border border-gray-100 dark:border-gray-800">
                                                <span className="font-bold text-[11px] text-gray-900 dark:text-white block mb-0.5">{t.term}</span>
                                                <span className="text-[10px] text-gray-600 dark:text-gray-400 leading-tight block">{t.details}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>





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

                            <UploadWizard />

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

                                {/* Demographic filters could go here if needed */}

                                {/* Market Selector */}
                                <div className="w-[180px]">
                                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                                        Market
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={selectedLocation}
                                            onChange={(e) => setSelectedLocation(e.target.value)}
                                            className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg pl-3 pr-10 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none transition-all"
                                        >
                                            {MARKET_OPTIONS.map(m => (
                                                <option key={m.value} value={m.value}>
                                                    {m.emoji} {m.value}
                                                </option>
                                            ))}
                                        </select>
                                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                            <ChevronDown className="h-4 w-4 text-gray-400" />
                                        </div>
                                    </div>
                                </div>

                                { /* Target Domain Input */}
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

                                {/* Brand Terms Input */}
                                <div className="flex-1 min-w-[240px]">
                                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                        Brand Keywords
                                        <div className="group relative">
                                            <Info className="h-3 w-3 text-gray-400 cursor-help" />
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-900 text-white text-[10px] rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                                                Enter your brand names separated by commas (e.g. pooch, mutt). These will be used for Brand Defense logic.
                                            </div>
                                        </div>
                                    </label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Tags className={`h-4 w-4 transition-colors ${brandTermsInput ? 'text-purple-500' : 'text-gray-400'}`} />
                                        </div>
                                        <input
                                            type="text"
                                            value={brandTermsInput}
                                            onChange={(e) => setBrandTermsInput(e.target.value)}
                                            placeholder="e.g. pooch, mutt, joint care"
                                            className={`w-full pl-10 pr-10 bg-gray-50 dark:bg-gray-900 border rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 outline-none transition-all ${brandTermsInput
                                                ? 'border-purple-500 ring-2 ring-purple-500/10'
                                                : 'border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500'
                                                }`}
                                        />
                                    </div>
                                </div>

                                {/* Competitor Input */}
                                <div className="flex-1 min-w-[240px]">
                                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                        Competitors to Remove
                                        <div className="group relative">
                                            <Info className="h-3 w-3 text-gray-400 cursor-help" />
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-900 text-white text-[10px] rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                                                Enter competitor names separated by commas. Queries containing these terms will be excluded from the analysis.
                                            </div>
                                        </div>
                                    </label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Users className={`h-4 w-4 transition-colors ${competitorTermsInput ? 'text-rose-500' : 'text-gray-400'}`} />
                                        </div>
                                        <input
                                            type="text"
                                            value={competitorTermsInput}
                                            onChange={(e) => setCompetitorTermsInput(e.target.value)}
                                            placeholder="e.g. competitor1, competitor2"
                                            className={`w-full pl-10 pr-10 bg-gray-50 dark:bg-gray-900 border rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 outline-none transition-all ${competitorTermsInput
                                                ? 'border-rose-500 ring-2 ring-rose-500/10'
                                                : 'border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500'
                                                }`}
                                        />
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
                                        {rawGscData.length > 0 ? `Queries (${rawGscData.length})` : "Upload GSC (Queries)"}
                                    </button>

                                    <input type="file" ref={fileInputRef} onChange={handleAdsFileUpload} accept=".csv" className="hidden" />
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm active:scale-95 ${rawAdsData.length > 0
                                            ? "bg-purple-600 hover:bg-purple-700 text-white"
                                            : "bg-white dark:bg-gray-900 text-purple-600 border border-purple-200 hover:bg-purple-50 dark:hover:bg-purple-900/20"}`}
                                    >
                                        <Upload className="w-4 h-4" />
                                        {rawAdsData.length > 0 ? `Search Terms (${rawAdsData.length})` : "Upload Search Terms (Ads)"}
                                    </button>

                                    <input type="file" ref={fileInputRefKeyword} onChange={handleKeywordFileUpload} accept=".csv" className="hidden" />
                                    <button
                                        onClick={() => fileInputRefKeyword.current?.click()}
                                        className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm active:scale-95 ${keywordMetricsData.length > 0
                                            ? "bg-violet-600 hover:bg-violet-700 text-white"
                                            : "bg-white dark:bg-gray-900 text-violet-600 border border-violet-200 hover:bg-violet-50 dark:hover:bg-violet-900/20"}`}
                                    >
                                        <Upload className="w-4 h-4" />
                                        {keywordMetricsData.length > 0 ? `Keywords (${keywordMetricsData.length})` : "Upload Keywords (Auction Insights)"}
                                    </button>

                                    <input type="file" ref={fileInputRefCampaign} onChange={handleCampaignFileUpload} accept=".csv" className="hidden" />
                                    <button
                                        onClick={() => fileInputRefCampaign.current?.click()}
                                        className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm active:scale-95 ${rawCampaignData.length > 0
                                            ? "bg-pink-600 hover:bg-pink-700 text-white"
                                            : "bg-white dark:bg-gray-900 text-pink-600 border border-pink-200 hover:bg-pink-50 dark:hover:bg-pink-900/20"}`}
                                    >
                                        <Upload className="w-4 h-4" />
                                        {rawCampaignData.length > 0 ? `Campaigns (${rawCampaignData.length})` : "Upload Campaigns"}
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
                                        {
                                            (filterActions.length > 0 || filterCampaign !== "all" || filterAdGroup !== "all" || filterMinRoas !== '' || filterMinClicks !== '' || filterMinConversions !== '') && (
                                                <button
                                                    onClick={() => {
                                                        setFilterActions([]);
                                                        setFilterCampaign("all");
                                                        setFilterAdGroup("all");
                                                        setFilterMinRoas('');
                                                        setFilterMinClicks('');
                                                        setFilterMinConversions('');
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
                                                onClick={() => toggleAction("Reduce Spend")}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${filterActions.includes("Reduce Spend")
                                                    ? "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800"
                                                    : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-orange-900/20 dark:hover:text-orange-400"
                                                    }`}
                                            >
                                                💰 Wasted Spend (Reduce Spend)
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
                                                onClick={() => toggleAction("Investigate")}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${filterActions.includes("Investigate")
                                                    ? "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800"
                                                    : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-purple-50 hover:text-purple-600 hover:border-purple-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-purple-900/20 dark:hover:text-purple-400"
                                                    }`}
                                            >
                                                🔍 Investigate
                                            </button>
                                            <button
                                                onClick={() => toggleAction("Defend")}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${filterActions.includes("Defend")
                                                    ? "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800"
                                                    : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-violet-50 hover:text-violet-600 hover:border-violet-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-violet-900/20 dark:hover:text-violet-400"
                                                    }`}
                                            >
                                                🛡️ Defend (High Competition)
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

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                                        {/* Filter by Min ROAS */}
                                        <div>
                                            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                                                Min. ROAS
                                            </label>
                                            <input
                                                type="number"
                                                value={filterMinRoas}
                                                onChange={(e) => setFilterMinRoas(e.target.value === '' ? '' : Number(e.target.value))}
                                                placeholder="e.g. 2.0"
                                                className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400"
                                            />
                                        </div>
                                        {/* Filter by Min Clicks */}
                                        <div>
                                            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                                                Min. Clicks (Org or Paid)
                                            </label>
                                            <input
                                                type="number"
                                                value={filterMinClicks}
                                                onChange={(e) => setFilterMinClicks(e.target.value === '' ? '' : Number(e.target.value))}
                                                placeholder="e.g. 100"
                                                className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400"
                                            />
                                        </div>
                                        {/* Filter by Min Conversions */}
                                        <div>
                                            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                                                Min. Conversions (Paid)
                                            </label>
                                            <input
                                                type="number"
                                                value={filterMinConversions}
                                                onChange={(e) => setFilterMinConversions(e.target.value === '' ? '' : Number(e.target.value))}
                                                placeholder="e.g. 5"
                                                className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}



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
                                                    value={summary.avgRoas !== null && summary.avgRoas !== undefined ? `${summary.avgRoas.toFixed(2)}x` : "-"}
                                                    subtitle="Return on ad spend"
                                                    icon={TrendingUp}
                                                    trend={summary.avgRoas !== null && summary.avgRoas !== undefined && summary.avgRoas >= 3 ? "up" : summary.avgRoas !== null && summary.avgRoas !== undefined && summary.avgRoas < 2 ? "down" : "neutral"}
                                                />
                                                <KpiCard
                                                    title="Avg. CPA"
                                                    value={summary.avgCpa !== null && summary.avgCpa !== undefined ? formatCurrency(summary.avgCpa, currencyCode) : "-"}
                                                    subtitle="Cost per acquisition"
                                                    icon={LucideTarget}
                                                />
                                                <KpiCard
                                                    title="Blended CTR"
                                                    value={formatPercent(summary.blendedCtr)}
                                                    icon={BarChart3}
                                                />
                                                <KpiCard
                                                    title="Avg. Impr. Share"
                                                    value={summary.avgImpressionShare !== null && summary.avgImpressionShare !== undefined ? formatPercent(summary.avgImpressionShare) : "-"}
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
                                                        subtitle="Top cost-saving & multi-channel pause opportunities"
                                                        opportunities={quickWins?.pausePpc || []}
                                                        icon={DollarSign}
                                                        iconColorClass="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                                                        valueFormatter={(v) => formatCurrency(v, currencyCode)}
                                                        valueKey="cost_paid"
                                                    />
                                                    <QuickWinCard
                                                        title="🚀 Scale Winners"
                                                        subtitle="Top 'Scale Spend' opportunities by ROAS"
                                                        opportunities={quickWins?.scaleSpend || []}
                                                        icon={TrendingUp}
                                                        iconColorClass="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-300"
                                                        valueFormatter={(v) => `ROAS: ${(v || 0).toFixed(2)}x`}
                                                        valueKey="roas_paid"
                                                    />
                                                    <QuickWinCard
                                                        title="🎯 SEO Content Gaps"
                                                        subtitle="Top 'SEO Focus' opportunities by conversions"
                                                        opportunities={quickWins?.seoFocus || []}
                                                        icon={LucideTarget}
                                                        iconColorClass="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                                                        valueFormatter={(v) => `${v || 0} Conv.`}
                                                        valueKey="conversions_paid"
                                                    />
                                                </div>
                                            )}
                                        </>
                                    )}
                                </section>
                            )}

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
                                                    Save vs. Grow Distribution
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
                                                            <Legend />
                                                            <Bar
                                                                dataKey="saveCount"
                                                                name="Save/Optimise"
                                                                fill="#f59e0b"
                                                                radius={[4, 4, 0, 0]}
                                                            />
                                                            <Bar
                                                                dataKey="growCount"
                                                                name="Growth"
                                                                fill="#10b981"
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
                            )}

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
                                                        .filter(r => !r.parent_query && r.position_org > 0 && r.position_org <= 3 && r.cost_paid > 0)
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
                                                            !r.parent_query &&
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
                            )}
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
                                                <div className="relative flex-1 min-w-[300px] flex items-center gap-2">
                                                    <div className="relative flex-1">
                                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                                        <input
                                                            type="text"
                                                            placeholder={searchMode === 'regex' ? "Regex search..." : "Search queries..."}
                                                            value={searchQuery}
                                                            onChange={(e) => setSearchQuery(e.target.value)}
                                                            className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg pl-10 pr-4 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                                        />
                                                    </div>
                                                    <select
                                                        value={searchMode}
                                                        onChange={(e) => setSearchMode(e.target.value as any)}
                                                        className="bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-2 text-xs text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none"
                                                    >
                                                        <option value="contains">Contains</option>
                                                        <option value="does_not_contain">Does not contain</option>
                                                        <option value="equals">Equals</option>
                                                        <option value="regex">Regex</option>
                                                    </select>
                                                </div>

                                                {/* Show Top N */}
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm text-gray-500 dark:text-gray-400">Show:</span>
                                                    <select
                                                        value={showTop}
                                                        onChange={(e) => setShowTop(Number(e.target.value))}
                                                        className="bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                                                    >
                                                        <option value={10}>Top 10</option>
                                                        <option value={50}>Top 50</option>
                                                        <option value={100}>Top 100</option>
                                                        <option value={500}>Top 500</option>
                                                        <option value={1000}>Top 1000</option>
                                                        <option value={99999}>All</option>
                                                    </select>
                                                </div>

                                                {/* Export & Actions */}
                                                <div className="flex items-center gap-2">

                                                    <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                                                        <button
                                                            onClick={handleExportCsv}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium hover:bg-white dark:hover:bg-gray-600 shadow-sm transition-all"
                                                            title="Download CSV"
                                                        >
                                                            <FileSpreadsheet className="w-4 h-4 text-green-600 dark:text-green-400" />
                                                            <span className="hidden sm:inline">CSV</span>
                                                        </button>
                                                        <button
                                                            onClick={handlePrint}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium hover:bg-white dark:hover:bg-gray-600 shadow-sm transition-all"
                                                            title="Print Report / Save as PDF"
                                                        >
                                                            <Printer className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                                                            <span className="hidden sm:inline">Print/PDF</span>
                                                        </button>
                                                    </div>
                                                </div>
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
                                                                { key: "action", label: "Action", width: "120px", title: "Recommended next step based on SEO and PPC performance" },
                                                                { key: "query", label: "Query", width: "auto", title: "The search query or keyword being analyzed" },
                                                                { key: "matchType", label: "Match", width: "70px", title: "The match type used in Google Ads" },
                                                                { key: "position_org", label: "Pos", width: "60px", title: "Average Organic position from GSC" },
                                                                { key: "clicks_org", label: "Org Clk", width: "70px", title: "Monthly organic clicks from GSC" },
                                                                { key: "clicks_paid", label: "Paid Clk", width: "75px", title: "Monthly paid clicks from Google Ads" },
                                                                { key: "cost_paid", label: "Cost", width: "85px", title: "Total spend for this query in Google Ads" },
                                                                { key: "conversions_paid", label: "Conv", width: "65px", title: "Total conversions for this query" },
                                                                { key: "roas_paid", label: "ROAS", width: "70px", title: "Return on Ad Spend (Value / Cost)" },
                                                                { key: "conversionRate", label: "CVR", width: "65px", title: "Conversion Rate (Conversions / Clicks)" },
                                                                { key: "impressionShare", label: "IS %", width: "65px", title: "Search Impression Share (how often your ad appeared vs available)" },
                                                                { key: "projected_savings_score", label: "Save", width: "60px", title: "Save Score: Priority for reducing wasted spend (0-100)" },
                                                                { key: "projected_growth_score", label: "Grow", width: "60px", title: "Grow Score: Priority for capturing new value (0-100)" },
                                                                { key: "confidence", label: "Conf", width: "60px", title: "Algorithm Confidence Level" },
                                                                { key: "competition_score", label: "Comp", width: "60px", title: "Competition Score: Estimate of auction intensity (0-100)" },
                                                                { key: "coverage_score", label: "Cov", width: "60px", title: "Coverage Score: Measures channel presence (Search + Shopping + PMax). Higher = safer to optimize." },
                                                                { key: "channel_group", label: "Chan", width: "70px", title: "Channel Group: Primary channel appearing for this keyword" },
                                                            ].map((col) => (
                                                                <th
                                                                    key={col.key}
                                                                    className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600/50"
                                                                    style={{ width: col.width }}
                                                                    onClick={() => handleSort(col.key as keyof MergedOpportunityRow)}
                                                                    title={col.title}
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
                                                        {visibleData.map((row, idx) => (
                                                            <tr
                                                                key={`${row.query}-${row.channel_group || 'total'}-${idx}`}
                                                                className={`group transition-all duration-300 ${row.is_total_row
                                                                    ? (expandedQueries.has(row.query)
                                                                        ? 'bg-blue-200 dark:bg-blue-900 font-black border-y-2 border-blue-600 dark:border-blue-400 shadow-2xl z-20 relative'
                                                                        : 'bg-gray-100 dark:bg-gray-800 font-bold border-t border-gray-300 dark:border-gray-600 shadow-sm')
                                                                    : row.parent_query
                                                                        ? 'bg-white dark:bg-slate-950 border-l-[10px] border-indigo-600 dark:border-indigo-400 border-b border-gray-200 dark:border-gray-800'
                                                                        : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                                                                    }`}
                                                            >
                                                                <td className="px-4 py-3">
                                                                    {!row.parent_query && (
                                                                        <button
                                                                            onClick={() => handleAnalyze(row)}
                                                                            className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded text-blue-600 dark:text-blue-400 transition-colors"
                                                                            title="Analyze Query with AI"
                                                                        >
                                                                            <Sparkles className="w-4 h-4" />
                                                                        </button>
                                                                    )}
                                                                </td>
                                                                <td className="px-3 py-3">
                                                                    {!row.parent_query && <ActionBadge action={row.action} row={row} />}
                                                                </td>
                                                                <td className="px-3 py-3 text-gray-900 dark:text-gray-100 max-w-[200px] truncate">
                                                                    <div className="flex items-center gap-2">
                                                                        {row.parent_query ? (
                                                                            <div className="flex items-center">
                                                                                <div className="w-10 h-1.5 bg-indigo-600 dark:bg-indigo-400 mr-3 shadow-sm" />
                                                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-tighter mr-3 shrink-0 border-2 shadow-[3px_3px_0px_0px_rgba(0,0,0,0.15)] dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,0.05)] ${row.channel_group?.toLowerCase().includes('search')
                                                                                    ? 'bg-blue-600 text-white border-blue-700'
                                                                                    : row.channel_group?.toLowerCase().includes('shopping')
                                                                                        ? 'bg-amber-500 text-black border-amber-600'
                                                                                        : row.channel_group?.toLowerCase().includes('max')
                                                                                            ? 'bg-purple-600 text-white border-purple-700'
                                                                                            : 'bg-black text-white border-gray-800'
                                                                                    }`}>
                                                                                    {row.channel_group}
                                                                                </span>
                                                                            </div>
                                                                        ) : (
                                                                            <>
                                                                                {row.is_total_row && (
                                                                                    <button
                                                                                        onClick={() => toggleQueryExpansion(row.query)}
                                                                                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                                                                                    >
                                                                                        {expandedQueries.has(row.query) ? (
                                                                                            <ChevronDown className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                                                                                        ) : (
                                                                                            <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                                                                                        )}
                                                                                    </button>
                                                                                )}
                                                                                <span className="font-bold tracking-tight text-sm">
                                                                                    {row.query}
                                                                                </span>
                                                                            </>
                                                                        )}
                                                                    </div>
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
                                                                <td className={`px-3 py-3 ${row.parent_query ? 'text-sm text-gray-950 dark:text-white font-black' : 'text-gray-600 dark:text-gray-400'}`}>
                                                                    {row.position_org > 0 ? row.position_org.toFixed(1) : "-"}
                                                                </td>
                                                                <td className={`px-3 py-3 ${row.parent_query ? 'text-sm text-gray-950 dark:text-white font-black' : 'text-gray-600 dark:text-gray-400'}`}>
                                                                    {row.clicks_org.toLocaleString()}
                                                                </td>
                                                                <td className={`px-3 py-3 ${row.parent_query ? 'text-sm text-gray-950 dark:text-white font-black' : 'text-gray-600 dark:text-gray-400'}`}>
                                                                    {row.clicks_paid.toLocaleString()}
                                                                </td>
                                                                <td className={`px-3 py-3 ${row.parent_query ? 'text-sm text-gray-950 dark:text-white font-black' : 'text-gray-600 dark:text-gray-400'}`}>
                                                                    {formatCurrency(row.cost_paid, currencyCode)}
                                                                </td>
                                                                <td className={`px-3 py-3 ${row.parent_query ? 'text-sm text-gray-950 dark:text-white font-black' : 'text-gray-600 dark:text-gray-400'}`}>
                                                                    {row.conversions_paid.toFixed(1)}
                                                                </td>
                                                                <td className="px-3 py-3">
                                                                    {row.roas_paid !== null ? (
                                                                        <span className={`font-medium ${row.roas_paid >= 4
                                                                            ? 'text-green-600 dark:text-green-400'
                                                                            : row.roas_paid >= 2
                                                                                ? 'text-blue-600 dark:text-blue-400'
                                                                                : row.roas_paid >= scoringConfig.low_roas
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
                                                                {/* Save Score */}
                                                                <td className="px-3 py-3">
                                                                    <div
                                                                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${(row.projected_savings_score || 0) >= 70 ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" :
                                                                            (row.projected_savings_score || 0) >= 40 ? "bg-orange-50 text-orange-600 dark:bg-orange-900/10 dark:text-orange-500" :
                                                                                "text-gray-400"
                                                                            }`}
                                                                        title="Save Score: Potential waste reduction"
                                                                    >
                                                                        {row.projected_savings_score || "-"}
                                                                    </div>
                                                                </td>
                                                                {/* Grow Score */}
                                                                <td className="px-3 py-3">
                                                                    <div
                                                                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${(row.projected_growth_score || 0) >= 70 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                                                                            (row.projected_growth_score || 0) >= 40 ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/10 dark:text-emerald-500" :
                                                                                "text-gray-400"
                                                                            }`}
                                                                        title="Grow Score: Growth potential"
                                                                    >
                                                                        {row.projected_growth_score || "-"}
                                                                    </div>
                                                                </td>
                                                                <td className="px-3 py-3">
                                                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider ${row.confidence === "high" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" :
                                                                        row.confidence === "med" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300" :
                                                                            "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                                                                        }`}>
                                                                        {row.confidence || "-"}
                                                                    </span>
                                                                </td>
                                                                <td className="px-3 py-3">
                                                                    <div className="flex flex-col items-center">
                                                                        <span className={`text-xs font-bold ${row.competition_score >= 70 ? 'text-red-600 dark:text-red-400' : row.competition_score >= 40 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                                                            {row.competition_score.toFixed(0)}
                                                                        </span>
                                                                        <span className="text-[9px] text-gray-400 uppercase tracking-tighter">
                                                                            {row.competition_source.replace('_level', '').replace('ad_group_fallback', 'fallback')}
                                                                        </span>
                                                                    </div>
                                                                </td>

                                                                {/* Coverage Score */}
                                                                <td className="px-3 py-3">
                                                                    {
                                                                        row.coverage_score !== undefined ? (
                                                                            <div className="flex flex-col items-center">
                                                                                <span className={`text-xs font-bold ${row.coverage_score >= 80 ? 'text-green-600' : 'text-gray-600'}`}>
                                                                                    {row.coverage_score.toFixed(0)}
                                                                                </span>
                                                                            </div>
                                                                        ) : <span className="text-gray-400 text-xs">-</span>
                                                                    }
                                                                </td>

                                                                {/* Channel Group */}
                                                                <td className="px-3 py-3">
                                                                    {row.channel_group ? (
                                                                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium uppercase ${row.channel_group === 'search' ? 'bg-blue-100 text-blue-700' :
                                                                            row.channel_group === 'shopping' ? 'bg-pink-100 text-pink-700' :
                                                                                row.channel_group === 'pmax' ? 'bg-purple-100 text-purple-700' :
                                                                                    'bg-gray-100 text-gray-700'
                                                                            }`}>
                                                                            {row.channel_group}
                                                                        </span>
                                                                    ) : <span className="text-gray-400 text-xs">-</span>}
                                                                </td>

                                                                {/* Merge Level */}

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
                            )}

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
                            )}


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
                                                    <div className="flex flex-col mt-1">
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                                                Analyzing query: <span className="font-medium text-gray-900 dark:text-gray-200">{selectedRow?.query || "Loading..."}</span>
                                                            </p>
                                                            {selectedRow?.action && (
                                                                <ActionBadge action={selectedRow.action} row={selectedRow} />
                                                            )}
                                                        </div>
                                                        <a
                                                            href={`https://www.google.com/search?q=${encodeURIComponent(selectedRow?.query || "")}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-[11px] text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline flex items-center gap-1 mt-0.5 w-fit"
                                                        >
                                                            View live on Google <ExternalLink className="w-2.5 h-2.5" />
                                                        </a>
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
                                                    {analysisError?.includes("credentials") && (
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
                                                                    {analysisData?.aiRecommendation?.action}
                                                                </h5>
                                                                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                                                                    {analysisData?.aiRecommendation?.reasoning}
                                                                </p>
                                                            </div>
                                                            <div className="space-y-3">
                                                                <div className="flex justify-between items-center gap-4 p-3 bg-white/50 dark:bg-black/20 rounded-lg border border-purple-100 dark:border-purple-800/50">
                                                                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400 shrink-0">Predicted Impact</span>
                                                                    <span className="text-sm font-semibold text-purple-700 dark:text-purple-300 text-right">{analysisData?.aiRecommendation?.impact}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Target Domain Notice */}
                                                    {!selectedProperty && (
                                                        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-xl p-4 flex items-start gap-3">
                                                            <Info className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                                                            <div>
                                                                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-1">
                                                                    Target Domain Not Set
                                                                </p>
                                                                <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                                                                    Enter your target domain in the sidebar (e.g., &quot;example.com&quot;) to see your organic ranking position and identify your site in the competitive landscape tables below.
                                                                </p>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Metrics Grid */}
                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                                        {analysisData?.targetRank ? (
                                                            <div className={`p-4 rounded-xl border transition-all duration-300 ${analysisData?.targetRank === 1
                                                                ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 shadow-sm ring-1 ring-emerald-500/20'
                                                                : 'bg-purple-50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-800/30'
                                                                }`}>
                                                                <p className={`text-xs uppercase font-bold tracking-wider ${analysisData?.targetRank === 1 ? 'text-emerald-600 dark:text-emerald-400' : 'text-purple-600 dark:text-purple-400'
                                                                    }`}>Organic Rank</p>
                                                                <div className="flex items-center gap-2 mt-1">
                                                                    <p className={`text-3xl font-black ${analysisData?.targetRank === 1 ? 'text-emerald-700 dark:text-emerald-300' : 'text-gray-900 dark:text-white'
                                                                        }`}>#{analysisData?.targetRank}</p>
                                                                    {analysisData?.targetRank === 1 && (
                                                                        <div className="bg-emerald-100 dark:bg-emerald-800 text-emerald-700 dark:text-emerald-300 p-1 rounded-full">
                                                                            <Sparkles className="w-4 h-4" />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
                                                                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium">Organic Rank</p>
                                                                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">-</p>
                                                            </div>
                                                        )}

                                                        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
                                                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium">Monthly Search Volume</p>
                                                            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{formatNumber(analysisData?.searchVolume || 0)}</p>
                                                        </div>

                                                        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
                                                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium">Search Intent</p>
                                                            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1 capitalize">{analysisData?.intent || 'Unknown'}</p>
                                                        </div>
                                                    </div>

                                                    {/* SERP Features */}
                                                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                                                        <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                                                            <LayoutDashboard className="w-4 h-4 text-purple-500" /> SERP Features
                                                        </h4>
                                                        {analysisData.serpFeatures && analysisData.serpFeatures.length > 0 ? (
                                                            <div className="flex flex-wrap gap-2">
                                                                {analysisData.serpFeatures.map((feat, idx) => (
                                                                    <span key={idx} className="px-3 py-1 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded-full text-sm font-medium border border-purple-100 dark:border-purple-800">
                                                                        {feat}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <p className="text-sm text-gray-500 italic">No special SERP features detected.</p>
                                                        )}
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
                                                                        {analysisData?.paidResults?.length > 0 ? (
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
                                                                                            <div className="flex flex-col">
                                                                                                <a href={result.url} target="_blank" rel="noopener noreferrer" className={`text-sm font-medium hover:underline block truncate max-w-xs ${isTarget ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'}`}>
                                                                                                    {result.title}
                                                                                                </a>
                                                                                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs mt-0.5">{result.snippet}</p>
                                                                                            </div>
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
                                                                        {analysisData?.topResults?.map((result) => {
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
                            )}
                    </div>
                </div>
            </main>
        </div>
    );
}