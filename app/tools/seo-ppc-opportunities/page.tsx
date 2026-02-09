"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useState, useEffect, useMemo, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
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
} from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { ThemeProvider } from "@/components/ThemeProvider";
import {
    MergedOpportunityRow,
    OpportunityAction,
    GscQueryRow,
    AdsSearchTermRow,
    GoogleAdsCustomer,
    DatePreset,
} from "@/lib/opportunity-types";
import {
    mergeDatasets,
    calculateSummary,
    prepareActionChartData,
    prepareScatterData,
    prepareScoreDistribution,
    generateMockData,
    formatCurrency,
    formatPercent,
    formatNumber,
    getActionColor,
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
            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
            style={{ backgroundColor: `${color}20`, color }}
        >
            {action}
        </span>
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
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
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
    const [currencyCode, setCurrencyCode] = useState<string>("GBP");

    // Table state
    const [sortKey, setSortKey] = useState<keyof MergedOpportunityRow>("opportunity_score");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
    const [filterAction, setFilterAction] = useState<OpportunityAction | "all">("all");
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [showTop, setShowTop] = useState<number>(100);

    // Collapsible sections
    const [expandedSections, setExpandedSections] = useState({
        kpis: true,
        charts: true,
        table: true,
    });

    // Fetch GSC properties on mount
    useEffect(() => {
        if (session?.accessToken && !mockMode) {
            fetchGscProperties();
            fetchAdsCustomers();
        }
    }, [session, mockMode]);

    const fetchGscProperties = async () => {
        try {
            const res = await fetch("/api/gsc/properties");
            if (res.ok) {
                const data = await res.json();
                setGscProperties(data.sites || []);
                if (data.sites?.length > 0) {
                    setSelectedProperty(data.sites[0]);
                }
            }
        } catch (e) {
            console.error("Error fetching GSC properties:", e);
        }
    };

    const fetchAdsCustomers = async () => {
        try {
            const res = await fetch("/api/google-ads/customers");
            if (res.ok) {
                const data = await res.json();
                setAdsCustomers(data.customers || []);
                if (data.customers?.length > 0) {
                    setSelectedCustomer(data.customers[0].customerId);
                }
            }
        } catch (e) {
            console.error("Error fetching Ads customers:", e);
        }
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

    // Fetch and merge data
    const handleFetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        setProgress("Starting data fetch...");

        try {
            const startDate = formatDateForApi(dateRange.start);
            const endDate = formatDateForApi(dateRange.end);

            if (mockMode) {
                setProgress("Generating mock data...");
                await new Promise((r) => setTimeout(r, 500));
                const mockData = generateMockData();
                const merged = mergeDatasets(mockData.gscData, mockData.adsData);
                setData(merged);
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

            setProgress("Merging and analyzing data...");
            await new Promise((r) => setTimeout(r, 100));

            const merged = mergeDatasets(gscData, adsData);
            setData(merged);
            setCurrencyCode(adsCurrency);
            setProgress("");

        } catch (e) {
            console.error("Error fetching data:", e);
            setError(String(e));
        } finally {
            setLoading(false);
        }
    }, [mockMode, selectedProperty, selectedCustomer, dateRange]);

    // Filtered and sorted data
    const filteredData = useMemo(() => {
        let result = [...data];

        // Filter by action
        if (filterAction !== "all") {
            result = result.filter((r) => r.action === filterAction);
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
    }, [data, filterAction, searchQuery, sortKey, sortDir]);

    // Summary stats
    const summary = useMemo(() => calculateSummary(data), [data]);

    // Chart data
    const actionChartData = useMemo(() => prepareActionChartData(data), [data]);
    const scatterData = useMemo(() => prepareScatterData(data), [data]);
    const scoreDistribution = useMemo(() => prepareScoreDistribution(data), [data]);

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

    // Toggle section
    const toggleSection = (section: keyof typeof expandedSections) => {
        setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
    };

    // Loading state
    if (status === "loading") {
        return (
            <ThemeProvider>
                <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                </div>
            </ThemeProvider>
        );
    }

    // Not logged in
    if (!session && !mockMode) {
        return (
            <ThemeProvider>
                <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
                        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                            <TrendingUp className="w-8 h-8 text-white" />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                            SEO/PPC Opportunity Finder
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">
                            Connect your Google account to analyze opportunities between organic and paid search.
                        </p>
                        <button
                            onClick={() => signIn("google")}
                            className="w-full flex items-center justify-center gap-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 text-gray-700 dark:text-gray-200 font-medium hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                        >
                            <Image
                                src="https://www.google.com/favicon.ico"
                                alt="Google"
                                width={20}
                                height={20}
                            />
                            Sign in with Google
                        </button>
                        <div className="mt-4">
                            <button
                                onClick={() => setMockMode(true)}
                                className="text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400"
                            >
                                Or try with mock data →
                            </button>
                        </div>
                    </div>
                </div>
            </ThemeProvider>
        );
    }

    return (
        <ThemeProvider>
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
                {/* Header */}
                <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
                    <div className="max-w-7xl mx-auto px-4 py-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <Link href="/" className="flex items-center gap-2">
                                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                                        <TrendingUp className="w-5 h-5 text-white" />
                                    </div>
                                    <span className="font-bold text-gray-900 dark:text-white">
                                        SEO/PPC Opportunities
                                    </span>
                                </Link>
                            </div>

                            <div className="flex items-center gap-3">
                                <ThemeToggle />
                                {session && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-gray-600 dark:text-gray-400">
                                            {session.user?.email}
                                        </span>
                                        <button
                                            onClick={() => signOut()}
                                            className="text-sm text-red-500 hover:text-red-600"
                                        >
                                            Sign out
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </header>

                <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
                    {/* Controls */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {/* Mock Mode Toggle */}
                            <div>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={mockMode}
                                        onChange={(e) => setMockMode(e.target.checked)}
                                        className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                                    />
                                    <span className="text-sm text-gray-700 dark:text-gray-300">
                                        Mock Mode (Demo Data)
                                    </span>
                                </label>
                            </div>

                            {/* GSC Property */}
                            {!mockMode && (
                                <div>
                                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                                        GSC Property
                                    </label>
                                    <select
                                        value={selectedProperty}
                                        onChange={(e) => setSelectedProperty(e.target.value)}
                                        className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                                    >
                                        <option value="">Select property...</option>
                                        {gscProperties.map((prop) => (
                                            <option key={prop} value={prop}>
                                                {prop}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Google Ads Account */}
                            {!mockMode && (
                                <div>
                                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                                        Google Ads Account
                                    </label>
                                    <select
                                        value={selectedCustomer}
                                        onChange={(e) => setSelectedCustomer(e.target.value)}
                                        className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                                    >
                                        <option value="">Select account...</option>
                                        {adsCustomers.map((cust) => (
                                            <option key={cust.customerId} value={cust.customerId}>
                                                {cust.descriptiveName} ({cust.customerId})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Date Preset */}
                            <div>
                                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                                    Date Range
                                </label>
                                <select
                                    value={datePreset}
                                    onChange={(e) => setDatePreset(e.target.value as DatePreset)}
                                    className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                                >
                                    {DATE_PRESETS.map((preset) => (
                                        <option key={preset.value} value={preset.value}>
                                            {preset.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Custom Date Range */}
                            {datePreset === "custom" && (
                                <>
                                    <div>
                                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                                            Start Date
                                        </label>
                                        <input
                                            type="date"
                                            value={customStartDate}
                                            onChange={(e) => setCustomStartDate(e.target.value)}
                                            className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                                            End Date
                                        </label>
                                        <input
                                            type="date"
                                            value={customEndDate}
                                            onChange={(e) => setCustomEndDate(e.target.value)}
                                            className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                                        />
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Fetch Button */}
                        <div className="mt-4 flex items-center gap-4">
                            <button
                                onClick={handleFetchData}
                                disabled={loading || (!mockMode && !selectedProperty && !selectedCustomer)}
                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium px-6 py-2 rounded-lg transition-colors"
                            >
                                {loading ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <RefreshCw className="w-4 h-4" />
                                )}
                                {loading ? "Fetching..." : "Fetch Data"}
                            </button>

                            {progress && (
                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                    {progress}
                                </span>
                            )}

                            {data.length > 0 && (
                                <span className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                                    <CheckCircle className="w-4 h-4" />
                                    {data.length.toLocaleString()} queries loaded
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3">
                            <AlertCircle className="w-5 h-5 text-red-500" />
                            <span className="text-red-700 dark:text-red-400">{error}</span>
                        </div>
                    )}

                    {/* KPI Cards */}
                    {data.length > 0 && (
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
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                                    <KpiCard
                                        title="Total Spend"
                                        value={formatCurrency(summary.totalSpend, currencyCode)}
                                        icon={DollarSign}
                                    />
                                    <KpiCard
                                        title="Conversions"
                                        value={formatNumber(summary.totalConversions)}
                                        icon={Target}
                                    />
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
                                        title="Blended CTR"
                                        value={formatPercent(summary.blendedCtr)}
                                        icon={BarChart3}
                                    />
                                    <KpiCard
                                        title="Opportunities"
                                        value={summary.opportunityCount.toLocaleString()}
                                        subtitle="Non-monitor actions"
                                        icon={TrendingUp}
                                        trend="up"
                                    />
                                </div>
                            )}
                        </section>
                    )}

                    {/* Charts */}
                    {data.length > 0 && (
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
                                                        }}
                                                        labelStyle={{ color: "#F3F4F6" }}
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
                                                        }}
                                                        labelStyle={{ color: "#F3F4F6" }}
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
                                        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
                                            Position vs Cost Quadrant (Top 200)
                                        </h3>
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
                                                        domain={[0, 50]}
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
                                                        contentStyle={{
                                                            backgroundColor: "#1F2937",
                                                            border: "none",
                                                            borderRadius: "8px",
                                                        }}
                                                        formatter={(value: number, name: string) => {
                                                            if (name === "Cost") return formatCurrency(value, currencyCode);
                                                            return value.toFixed(2);
                                                        }}
                                                        labelFormatter={(label) => `Query: ${label}`}
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

                    {/* Data Table */}
                    {data.length > 0 && (
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
                                                className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100"
                                            />
                                        </div>

                                        {/* Filter by Action */}
                                        <div className="flex items-center gap-2">
                                            <Filter className="w-4 h-4 text-gray-400" />
                                            <select
                                                value={filterAction}
                                                onChange={(e) => setFilterAction(e.target.value as OpportunityAction | "all")}
                                                className="bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                                            >
                                                <option value="all">All Actions</option>
                                                {Object.keys(summary.actionBreakdown).map((action) => (
                                                    <option key={action} value={action}>
                                                        {action} ({summary.actionBreakdown[action as OpportunityAction]})
                                                    </option>
                                                ))}
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
                                                    {[
                                                        { key: "action", label: "Action", width: "120px" },
                                                        { key: "query", label: "Query", width: "auto" },
                                                        { key: "clicks_org", label: "Org Clicks", width: "90px" },
                                                        { key: "impressions_org", label: "Org Impr", width: "90px" },
                                                        { key: "position_org", label: "Position", width: "80px" },
                                                        { key: "clicks_paid", label: "Paid Clicks", width: "90px" },
                                                        { key: "cost_paid", label: "Cost", width: "90px" },
                                                        { key: "conversions_paid", label: "Convs", width: "70px" },
                                                        { key: "opportunity_score", label: "Score", width: "80px" },
                                                    ].map((col) => (
                                                        <th
                                                            key={col.key}
                                                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600/50"
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
                                                            <ActionBadge action={row.action} />
                                                        </td>
                                                        <td className="px-4 py-3 text-gray-900 dark:text-gray-100 max-w-xs truncate">
                                                            {row.query}
                                                        </td>
                                                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                                                            {row.clicks_org.toLocaleString()}
                                                        </td>
                                                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                                                            {row.impressions_org.toLocaleString()}
                                                        </td>
                                                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                                                            {row.position_org > 0 ? row.position_org.toFixed(1) : "-"}
                                                        </td>
                                                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                                                            {row.clicks_paid.toLocaleString()}
                                                        </td>
                                                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                                                            {formatCurrency(row.cost_paid, currencyCode)}
                                                        </td>
                                                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                                                            {row.conversions_paid.toFixed(1)}
                                                        </td>
                                                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
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
                    )}

                    {/* Empty State */}
                    {!loading && data.length === 0 && (
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center border border-gray-200 dark:border-gray-700">
                            <Info className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                                No Data Yet
                            </h3>
                            <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                                Select your GSC property and Google Ads account, then click &quot;Fetch Data&quot; to analyze opportunities between organic and paid search.
                            </p>
                        </div>
                    )}
                </main>
            </div>
        </ThemeProvider>
    );
}
