"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import {
    BarChart,
    Bar,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from "recharts";
import { Download, Loader2, Search, AlertCircle, ExternalLink, LogOut, User, ArrowLeft, LayoutDashboard, Filter, RefreshCw } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { ThemeProvider } from "@/components/ThemeProvider";
import Link from "next/link";

type GscRow = {
    keys: string[];
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
};

type QueryPositionRow = {
    month: string;
    positions_1_3: number;
    positions_4_10: number;
    positions_11_20: number;
    positions_20_plus: number;
    totalQueries: number;
};

type CannibalizationRow = {
    query: string;
    pageCount: number;
    totalClicks: number;
    totalImpressions: number;
    pages: {
        url: string;
        clicks: number;
        impressions: number;
        position: number;
        ctr: number;
    }[];
};

type QueryCountRow = {
    page: string;
    counts: { [month: string]: number };
    totalQueries: number;
};

export default function GscExportPage() {
    const { data: session, status } = useSession();
    const [properties, setProperties] = useState<string[]>([]);
    const [selectedProperty, setSelectedProperty] = useState("");
    const [searchType, setSearchType] = useState("web");
    const [dateRange, setDateRange] = useState("last_30");
    const [customStartDate, setCustomStartDate] = useState("");
    const [customEndDate, setCustomEndDate] = useState("");
    const [selectedDimensions, setSelectedDimensions] = useState<string[]>([
        "page",
        "query",
    ]);
    const [deviceFilter, setDeviceFilter] = useState("all");

    // Advanced Filters State
    const [pageFilterType, setPageFilterType] = useState("contains");
    const [pageFilterValue, setPageFilterValue] = useState("");
    const [queryFilterType, setQueryFilterType] = useState("contains");
    const [queryFilterValue, setQueryFilterValue] = useState("");

    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<GscRow[] | null>(null);
    const [queryAnalysis, setQueryAnalysis] = useState<QueryPositionRow[] | null>(null);
    const [cannibalizationData, setCannibalizationData] = useState<CannibalizationRow[] | null>(null);
    const [queryCountData, setQueryCountData] = useState<QueryCountRow[] | null>(null);
    const [queryCountChartData, setQueryCountChartData] = useState<any[] | null>(null);
    const [error, setError] = useState("");
    const [activeTab, setActiveTab] = useState<"raw" | "analysis" | "cannibalization" | "query_counts">("raw");

    useEffect(() => {
        if (session) {
            fetchProperties();
        }
    }, [session]);

    const fetchProperties = async () => {
        try {
            const res = await fetch("/api/gsc/properties");
            const data = await res.json();
            if (data.sites) {
                setProperties(data.sites.map((s: any) => s.siteUrl));
            }
        } catch (err) {
            console.error("Failed to fetch properties", err);
        }
    };

    const handleFetchData = async () => {
        setLoading(true);
        setError("");
        setData(null);
        setQueryAnalysis(null);
        setCannibalizationData(null);
        setQueryCountData(null);

        try {
            let startDate = "";
            let endDate = format(new Date(), "yyyy-MM-dd");

            const today = new Date();
            if (dateRange === "last_7") {
                startDate = format(new Date(today.setDate(today.getDate() - 7)), "yyyy-MM-dd");
            } else if (dateRange === "last_30") {
                startDate = format(new Date(today.setDate(today.getDate() - 30)), "yyyy-MM-dd");
            } else if (dateRange === "last_3_months") {
                startDate = format(new Date(today.setMonth(today.getMonth() - 3)), "yyyy-MM-dd");
            } else if (dateRange === "last_6_months") {
                startDate = format(new Date(today.setMonth(today.getMonth() - 6)), "yyyy-MM-dd");
            } else if (dateRange === "last_12_months") {
                startDate = format(new Date(today.setMonth(today.getMonth() - 12)), "yyyy-MM-dd");
            } else if (dateRange === "last_16_months") {
                startDate = format(new Date(today.setMonth(today.getMonth() - 16)), "yyyy-MM-dd");
            } else if (dateRange === "custom") {
                startDate = customStartDate;
                endDate = customEndDate;
            }

            const filters = [];
            if (deviceFilter !== "all") {
                filters.push({
                    dimension: "device",
                    operator: "equals",
                    expression: deviceFilter.toLowerCase(),
                });
            }

            // Add Page Filter
            if (pageFilterValue) {
                filters.push({
                    dimension: "page",
                    operator: pageFilterType,
                    expression: pageFilterValue,
                });
            }

            // Add Query Filter
            if (queryFilterValue) {
                filters.push({
                    dimension: "query",
                    operator: queryFilterType,
                    expression: queryFilterValue,
                });
            }

            const res = await fetch("/api/gsc/query", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    siteUrl: selectedProperty,
                    startDate,
                    endDate,
                    dimensions: selectedDimensions,
                    filters,
                    searchType,
                }),
            });

            if (!res.ok) throw new Error("Failed to fetch data");

            const result = await res.json();
            setData(result.rows);

            if (
                selectedDimensions.includes("query") &&
                selectedDimensions.includes("date")
            ) {
                analyzeQueryPositions(result.rows);
            }

            if (
                selectedDimensions.includes("query") &&
                selectedDimensions.includes("page")
            ) {
                analyzeCannibalization(result.rows);
            }

            if (
                selectedDimensions.includes("query") &&
                selectedDimensions.includes("page") &&
                selectedDimensions.includes("date")
            ) {
                analyzeQueryCounts(result.rows);
            }

        } catch (err) {
            setError("Failed to fetch data. Please try again.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const analyzeQueryPositions = (rows: GscRow[]) => {
        const buckets: { [key: string]: QueryPositionRow } = {};

        rows.forEach((row) => {
            const dateIndex = selectedDimensions.indexOf("date");
            if (dateIndex === -1) return;

            const dateStr = row.keys[dateIndex];
            if (!dateStr) return;

            const date = parseISO(dateStr);
            const month = format(date, "yyyy-MM");

            if (!buckets[month]) {
                buckets[month] = {
                    month,
                    positions_1_3: 0,
                    positions_4_10: 0,
                    positions_11_20: 0,
                    positions_20_plus: 0,
                    totalQueries: 0,
                };
            }

            const pos = row.position;
            if (pos <= 3) buckets[month].positions_1_3++;
            else if (pos <= 10) buckets[month].positions_4_10++;
            else if (pos <= 20) buckets[month].positions_11_20++;
            else buckets[month].positions_20_plus++;

            buckets[month].totalQueries++;
        });

        setQueryAnalysis(Object.values(buckets).sort((a, b) => a.month.localeCompare(b.month)));
    };

    const analyzeCannibalization = (rows: GscRow[]) => {
        const queryMap: { [key: string]: CannibalizationRow } = {};
        const queryIndex = selectedDimensions.indexOf("query");
        const pageIndex = selectedDimensions.indexOf("page");

        if (queryIndex === -1 || pageIndex === -1) return;

        rows.forEach(row => {
            const query = row.keys[queryIndex];
            const page = row.keys[pageIndex];

            if (!queryMap[query]) {
                queryMap[query] = {
                    query,
                    pageCount: 0,
                    totalClicks: 0,
                    totalImpressions: 0,
                    pages: []
                };
            }

            queryMap[query].totalClicks += row.clicks;
            queryMap[query].totalImpressions += row.impressions;
            queryMap[query].pages.push({
                url: page,
                clicks: row.clicks,
                impressions: row.impressions,
                position: row.position,
                ctr: row.ctr
            });
        });

        // Filter for queries with > 1 page and sort by total clicks
        const cannibalizedQueries = Object.values(queryMap)
            .map(item => ({
                ...item,
                pageCount: item.pages.length,
                pages: item.pages.sort((a, b) => b.clicks - a.clicks)
            }))
            .filter(item => item.pageCount > 1 && item.totalClicks > 0)
            .sort((a, b) => b.totalClicks - a.totalClicks);

        setCannibalizationData(cannibalizedQueries);
    };

    const analyzeQueryCounts = (rows: GscRow[]) => {
        const pageMap: { [page: string]: { [month: string]: Set<string> } } = {};
        const queryIndex = selectedDimensions.indexOf("query");
        const pageIndex = selectedDimensions.indexOf("page");
        const dateIndex = selectedDimensions.indexOf("date");

        if (queryIndex === -1 || pageIndex === -1 || dateIndex === -1) return;

        const allMonths = new Set<string>();

        rows.forEach(row => {
            const query = row.keys[queryIndex];
            const page = row.keys[pageIndex];
            const dateStr = row.keys[dateIndex];
            if (!dateStr) return;
            const month = format(parseISO(dateStr), "yyyy-MM");
            allMonths.add(month);

            if (!pageMap[page]) {
                pageMap[page] = {};
            }
            if (!pageMap[page][month]) {
                pageMap[page][month] = new Set();
            }
            pageMap[page][month].add(query);
        });

        const sortedMonths = Array.from(allMonths).sort();

        const processedData: QueryCountRow[] = Object.entries(pageMap).map(([page, months]) => {
            const counts: { [month: string]: number } = {};
            let totalQueries = 0;
            sortedMonths.forEach(month => {
                const count = months[month] ? months[month].size : 0;
                counts[month] = count;
                totalQueries += count;
            });
            return { page, counts, totalQueries };
        }).sort((a, b) => b.totalQueries - a.totalQueries).slice(0, 50); // Top 50 pages

        setQueryCountData(processedData);

        // Prepare chart data (Top 5 pages)
        const top5Pages = processedData.slice(0, 5);
        const chartData = sortedMonths.map(month => {
            const point: any = { month };
            top5Pages.forEach(p => {
                point[p.page] = p.counts[month];
            });
            return point;
        });
        setQueryCountChartData(chartData);
    };

    const downloadCsv = (data: any[], filename: string) => {
        if (!data || data.length === 0) return;

        const csvRows = data.map(row => {
            if (row.keys) {
                const flatRow: any = {};
                selectedDimensions.forEach((dim, i) => {
                    flatRow[dim] = row.keys[i];
                });
                flatRow.clicks = row.clicks;
                flatRow.impressions = row.impressions;
                flatRow.ctr = row.ctr;
                flatRow.position = row.position;
                return flatRow;
            }
            return row;
        });

        const headers = Object.keys(csvRows[0]);
        const csvContent = [
            headers.join(","),
            ...csvRows.map((row) =>
                headers.map((header) => JSON.stringify(row[header])).join(",")
            ),
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const resetFilters = () => {
        setPageFilterType("contains");
        setPageFilterValue("");
        setQueryFilterType("contains");
        setQueryFilterValue("");
        setDeviceFilter("all");
    };

    if (status === "loading") {
        return (
            <div className="flex justify-center items-center min-h-screen bg-gray-100 dark:bg-gray-900">
                <Loader2 className="animate-spin h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
        );
    }

    return (
        <ThemeProvider>
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
                        {!session ? (
                            <div className="space-y-6">
                                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800 relative">
                                    <div className="absolute -top-2 -left-2">
                                        <span className="relative flex h-4 w-4">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-4 w-4 bg-blue-500"></span>
                                        </span>
                                    </div>
                                    <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                                        Get Started
                                    </h3>
                                    <p className="text-sm text-blue-800 dark:text-blue-200">
                                        Connect your Google Search Console account to unlock full data export and analysis capabilities.
                                    </p>
                                </div>

                                <button
                                    onClick={() => signIn("google")}
                                    className="w-full flex items-center justify-center px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm hover:shadow-md group"
                                >
                                    <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                                        <path
                                            fill="currentColor"
                                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                        />
                                        <path
                                            fill="currentColor"
                                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                        />
                                        <path
                                            fill="currentColor"
                                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z"
                                        />
                                        <path
                                            fill="currentColor"
                                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                        />
                                    </svg>
                                    Sign in with Google
                                </button>
                                <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                                    We only request read-only access to your Search Console data.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                    {session.user?.image ? (
                                        <img
                                            src={session.user.image}
                                            alt={session.user.name || "User"}
                                            className="w-10 h-10 rounded-full"
                                        />
                                    ) : (
                                        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                                            <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                            {session.user?.name}
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                            {session.user?.email}
                                        </p>
                                    </div>
                                </div>

                                <button
                                    onClick={() => signOut()}
                                    className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
                                >
                                    <LogOut className="w-4 h-4 mr-2" />
                                    Sign Out
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="p-6 border-t border-gray-200 dark:border-gray-700">
                        <ThemeToggle />
                    </div>
                </aside>

                {/* Main Content */}
                <main className="flex-1 ml-80 p-8 min-h-screen">
                    <div className="max-w-6xl mx-auto">
                        <div className="mb-8">
                            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-3">
                                GSC Bulk Export & Query Insights
                            </h1>
                            <p className="text-lg text-gray-600 dark:text-gray-300">
                                Export full Google Search Console data and analyze query positions.
                            </p>
                        </div>

                        {!session ? (
                            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
                                <div className="mx-auto w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-6">
                                    <LayoutDashboard className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                                </div>
                                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                                    Authentication Required
                                </h2>
                                <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                                    Please sign in using the sidebar on the left to access your Search Console properties and start analyzing your data.
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-6 mb-8 animate-in fade-in duration-500">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        <div className="space-y-2">
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                                Property
                                            </label>
                                            <select
                                                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                                value={selectedProperty}
                                                onChange={(e) => setSelectedProperty(e.target.value)}
                                            >
                                                <option value="">Select a property</option>
                                                {properties.map((p) => (
                                                    <option key={p} value={p}>
                                                        {p}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                                Date Range
                                            </label>
                                            <select
                                                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                                value={dateRange}
                                                onChange={(e) => setDateRange(e.target.value)}
                                            >
                                                <option value="last_7">Last 7 Days</option>
                                                <option value="last_30">Last 30 Days</option>
                                                <option value="last_3_months">Last 3 Months</option>
                                                <option value="last_6_months">Last 6 Months</option>
                                                <option value="last_12_months">Last 12 Months</option>
                                                <option value="last_16_months">Last 16 Months</option>
                                                <option value="custom">Custom Range</option>
                                            </select>
                                        </div>

                                        {dateRange === "custom" && (
                                            <div className="space-y-2 col-span-1 md:col-span-2 lg:col-span-1 flex space-x-2">
                                                <div className="flex-1">
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                                        Start
                                                    </label>
                                                    <input
                                                        type="date"
                                                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                                        value={customStartDate}
                                                        onChange={(e) => setCustomStartDate(e.target.value)}
                                                    />
                                                </div>
                                                <div className="flex-1">
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                                        End
                                                    </label>
                                                    <input
                                                        type="date"
                                                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                                        value={customEndDate}
                                                        onChange={(e) => setCustomEndDate(e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        <div className="space-y-2">
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                                Search Type
                                            </label>
                                            <select
                                                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                                value={searchType}
                                                onChange={(e) => setSearchType(e.target.value)}
                                            >
                                                <option value="web">Web</option>
                                                <option value="image">Image</option>
                                                <option value="video">Video</option>
                                                <option value="news">News</option>
                                                <option value="discover">Discover</option>
                                                <option value="googleNews">Google News</option>
                                            </select>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                                Device
                                            </label>
                                            <select
                                                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                                value={deviceFilter}
                                                onChange={(e) => setDeviceFilter(e.target.value)}
                                            >
                                                <option value="all">All Devices</option>
                                                <option value="DESKTOP">Desktop</option>
                                                <option value="MOBILE">Mobile</option>
                                                <option value="TABLET">Tablet</option>
                                            </select>
                                        </div>

                                        <div className="space-y-2 col-span-full">
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                                Dimensions
                                            </label>
                                            <div className="flex flex-wrap gap-2">
                                                {["page", "query", "country", "date", "device"].map((dim) => (
                                                    <button
                                                        key={dim}
                                                        onClick={() => {
                                                            if (selectedDimensions.includes(dim)) {
                                                                setSelectedDimensions(
                                                                    selectedDimensions.filter((d) => d !== dim)
                                                                );
                                                            } else {
                                                                setSelectedDimensions([...selectedDimensions, dim]);
                                                            }
                                                        }}
                                                        className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${selectedDimensions.includes(dim)
                                                            ? "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/50 dark:text-blue-200 dark:border-blue-800 border"
                                                            : "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 border hover:bg-gray-200 dark:hover:bg-gray-600"
                                                            }`}
                                                    >
                                                        {dim}
                                                    </button>
                                                ))}
                                            </div>
                                            {(!selectedDimensions.includes("query") ||
                                                !selectedDimensions.includes("date")) && (
                                                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center">
                                                        <AlertCircle className="w-3 h-3 mr-1" />
                                                        Select both &apos;query&apos; and &apos;date&apos; for Position Analysis.
                                                    </p>
                                                )}
                                            {(!selectedDimensions.includes("query") ||
                                                !selectedDimensions.includes("page")) && (
                                                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center">
                                                        <AlertCircle className="w-3 h-3 mr-1" />
                                                        Select both &apos;query&apos; and &apos;page&apos; for Cannibalization Analysis.
                                                    </p>
                                                )}
                                            {(!selectedDimensions.includes("query") ||
                                                !selectedDimensions.includes("page") ||
                                                !selectedDimensions.includes("date")) && (
                                                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center">
                                                        <AlertCircle className="w-3 h-3 mr-1" />
                                                        Select &apos;query&apos;, &apos;page&apos;, and &apos;date&apos; for Query Counting.
                                                    </p>
                                                )}
                                        </div>
                                    </div>

                                    {/* Advanced Filters Section */}
                                    <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center">
                                                <Filter className="w-4 h-4 mr-2" />
                                                Advanced Filters
                                            </h3>
                                            <button
                                                onClick={resetFilters}
                                                className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center"
                                            >
                                                <RefreshCw className="w-3 h-3 mr-1" />
                                                Reset Filters
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {/* Page Filter */}
                                            <div className="space-y-2">
                                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                                    Page Filter
                                                </label>
                                                <div className="flex space-x-2">
                                                    <select
                                                        className="w-1/3 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                                                        value={pageFilterType}
                                                        onChange={(e) => setPageFilterType(e.target.value)}
                                                    >
                                                        <option value="contains">Contains</option>
                                                        <option value="equals">Equals</option>
                                                        <option value="notContains">Not Contains</option>
                                                        <option value="notEquals">Not Equals</option>
                                                        <option value="includingRegex">Regex Match</option>
                                                        <option value="excludingRegex">Not Regex Match</option>
                                                    </select>
                                                    <input
                                                        type="text"
                                                        placeholder="Filter by page URL..."
                                                        className="w-2/3 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                                                        value={pageFilterValue}
                                                        onChange={(e) => setPageFilterValue(e.target.value)}
                                                    />
                                                </div>
                                            </div>

                                            {/* Query Filter */}
                                            <div className="space-y-2">
                                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                                    Query Filter
                                                </label>
                                                <div className="flex space-x-2">
                                                    <select
                                                        className="w-1/3 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                                                        value={queryFilterType}
                                                        onChange={(e) => setQueryFilterType(e.target.value)}
                                                    >
                                                        <option value="contains">Contains</option>
                                                        <option value="equals">Equals</option>
                                                        <option value="notContains">Not Contains</option>
                                                        <option value="notEquals">Not Equals</option>
                                                        <option value="includingRegex">Regex Match</option>
                                                        <option value="excludingRegex">Not Regex Match</option>
                                                    </select>
                                                    <input
                                                        type="text"
                                                        placeholder="Filter by query..."
                                                        className="w-2/3 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                                                        value={queryFilterValue}
                                                        onChange={(e) => setQueryFilterValue(e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex justify-end pt-4 border-t border-gray-100 dark:border-gray-700">
                                        <button
                                            onClick={handleFetchData}
                                            disabled={loading || !selectedProperty}
                                            className={`flex items-center px-6 py-3 rounded-lg font-medium text-white transition-all ${loading || !selectedProperty
                                                ? "bg-gray-400 cursor-not-allowed dark:bg-gray-600"
                                                : "bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg"
                                                }`}
                                        >
                                            {loading ? (
                                                <>
                                                    <Loader2 className="animate-spin mr-2 h-5 w-5" />
                                                    Fetching Data...
                                                </>
                                            ) : (
                                                "Fetch GSC Data"
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {error && (
                                    <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 p-4 rounded-lg border border-red-200 dark:border-red-800 mb-8">
                                        <div className="flex items-center">
                                            <AlertCircle className="w-5 h-5 mr-2" />
                                            {error}
                                        </div>
                                    </div>
                                )}

                                {data && (
                                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                        {/* Tabs */}
                                        <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit overflow-x-auto">
                                            <button
                                                onClick={() => setActiveTab("raw")}
                                                className={`px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${activeTab === "raw"
                                                        ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                                                        : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                                                    }`}
                                            >
                                                Raw Data
                                            </button>
                                            {queryAnalysis && (
                                                <button
                                                    onClick={() => setActiveTab("analysis")}
                                                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${activeTab === "analysis"
                                                            ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                                                            : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                                                        }`}
                                                >
                                                    Query Analysis
                                                </button>
                                            )}
                                            {cannibalizationData && (
                                                <button
                                                    onClick={() => setActiveTab("cannibalization")}
                                                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${activeTab === "cannibalization"
                                                            ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                                                            : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                                                        }`}
                                                >
                                                    Cannibalization
                                                </button>
                                            )}
                                            {queryCountData && (
                                                <button
                                                    onClick={() => setActiveTab("query_counts")}
                                                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${activeTab === "query_counts"
                                                            ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                                                            : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                                                        }`}
                                                >
                                                    Query Counts
                                                </button>
                                            )}
                                        </div>

                                        {/* Raw Data Tab */}
                                        {activeTab === "raw" && (
                                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                                                <div className="flex justify-between items-center mb-6">
                                                    <div>
                                                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Raw Data</h2>
                                                        <p className="text-gray-500 dark:text-gray-400 text-sm">
                                                            Fetched {data.length.toLocaleString()} rows
                                                        </p>
                                                    </div>
                                                    <button
                                                        onClick={() =>
                                                            downloadCsv(data, `gsc_data_${selectedProperty}.csv`)
                                                        }
                                                        className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                                                    >
                                                        <Download className="h-4 w-4 mr-2" />
                                                        Download CSV
                                                    </button>
                                                </div>
                                                <div className="overflow-x-auto border rounded-lg border-gray-200 dark:border-gray-700">
                                                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                                        <thead className="bg-gray-50 dark:bg-gray-900/30">
                                                            <tr>
                                                                {selectedDimensions.map((dim) => (
                                                                    <th
                                                                        key={dim}
                                                                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                                                                    >
                                                                        {dim}
                                                                    </th>
                                                                ))}
                                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                                    Clicks
                                                                </th>
                                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                                    Imp.
                                                                </th>
                                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                                    CTR
                                                                </th>
                                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                                    Pos
                                                                </th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                                            {data.slice(0, 10).map((row, i) => (
                                                                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                                    {row.keys &&
                                                                        row.keys.map((k, j) => (
                                                                            <td
                                                                                key={j}
                                                                                className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white max-w-xs truncate"
                                                                                title={k}
                                                                            >
                                                                                {k}
                                                                            </td>
                                                                        ))}
                                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                                        {row.clicks}
                                                                    </td>
                                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                                        {row.impressions}
                                                                    </td>
                                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                                        {(row.ctr * 100).toFixed(2)}%
                                                                    </td>
                                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                                        {row.position.toFixed(1)}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                    {data.length > 10 && (
                                                        <div className="px-6 py-3 bg-gray-50 dark:bg-gray-900/30 text-center text-sm text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700">
                                                            Showing first 10 rows of {data.length.toLocaleString()}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Query Analysis Tab */}
                                        {activeTab === "analysis" && queryAnalysis && (
                                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                                                <div className="flex justify-between items-center mb-6">
                                                    <div>
                                                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                                            Query Position Analysis
                                                        </h2>
                                                        <p className="text-gray-500 dark:text-gray-400 text-sm">
                                                            Distribution of query rankings over time
                                                        </p>
                                                    </div>
                                                    <button
                                                        onClick={() =>
                                                            downloadCsv(
                                                                queryAnalysis,
                                                                `gsc_query_analysis_${selectedProperty}.csv`
                                                            )
                                                        }
                                                        className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                                                    >
                                                        <Download className="h-4 w-4 mr-2" />
                                                        Download Analysis
                                                    </button>
                                                </div>

                                                <div className="h-[400px] w-full mb-8">
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <BarChart
                                                            data={queryAnalysis}
                                                            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                                                        >
                                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.2} />
                                                            <XAxis dataKey="month" stroke="#9CA3AF" />
                                                            <YAxis stroke="#9CA3AF" />
                                                            <Tooltip
                                                                contentStyle={{
                                                                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                                                    borderRadius: '8px',
                                                                    border: 'none',
                                                                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                                                                }}
                                                            />
                                                            <Legend />
                                                            <Bar
                                                                dataKey="positions_1_3"
                                                                name="Pos 1-3"
                                                                stackId="a"
                                                                fill="#22c55e"
                                                            />
                                                            <Bar
                                                                dataKey="positions_4_10"
                                                                name="Pos 4-10"
                                                                stackId="a"
                                                                fill="#3b82f6"
                                                            />
                                                            <Bar
                                                                dataKey="positions_11_20"
                                                                name="Pos 11-20"
                                                                stackId="a"
                                                                fill="#f59e0b"
                                                            />
                                                            <Bar
                                                                dataKey="positions_20_plus"
                                                                name="Pos 20+"
                                                                stackId="a"
                                                                fill="#94a3b8"
                                                            />
                                                        </BarChart>
                                                    </ResponsiveContainer>
                                                </div>

                                                <div className="overflow-x-auto border rounded-lg border-gray-200 dark:border-gray-700">
                                                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                                        <thead className="bg-gray-50 dark:bg-gray-900/30">
                                                            <tr>
                                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                                    Month
                                                                </th>
                                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                                    Pos 1-3
                                                                </th>
                                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                                    Pos 4-10
                                                                </th>
                                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                                    Pos 11-20
                                                                </th>
                                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                                    Pos 20+
                                                                </th>
                                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                                    Total
                                                                </th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                                            {queryAnalysis.map((row) => (
                                                                <tr key={row.month} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                                                        {row.month}
                                                                    </td>
                                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                                        {row.positions_1_3}
                                                                    </td>
                                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                                        {row.positions_4_10}
                                                                    </td>
                                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                                        {row.positions_11_20}
                                                                    </td>
                                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                                        {row.positions_20_plus}
                                                                    </td>
                                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white font-medium">
                                                                        {row.totalQueries}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}

                                        {/* Cannibalization Tab */}
                                        {activeTab === "cannibalization" && cannibalizationData && (
                                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                                                <div className="flex justify-between items-center mb-6">
                                                    <div>
                                                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                                            Cannibalization Analysis
                                                        </h2>
                                                        <p className="text-gray-500 dark:text-gray-400 text-sm">
                                                            Queries where multiple pages are competing for rankings
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="overflow-x-auto border rounded-lg border-gray-200 dark:border-gray-700">
                                                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                                        <thead className="bg-gray-50 dark:bg-gray-900/30">
                                                            <tr>
                                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                                    Query
                                                                </th>
                                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                                    Pages
                                                                </th>
                                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                                    Total Clicks
                                                                </th>
                                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                                    Top Page
                                                                </th>
                                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                                    Conflict
                                                                </th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                                            {cannibalizationData.map((item, i) => (
                                                                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                                                        {item.query}
                                                                    </td>
                                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                                        {item.pageCount}
                                                                    </td>
                                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                                        {item.totalClicks}
                                                                    </td>
                                                                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate" title={item.pages[0].url}>
                                                                        {item.pages[0].url}
                                                                        <div className="text-xs text-gray-400">
                                                                            Pos: {item.pages[0].position.toFixed(1)} | Clicks: {item.pages[0].clicks}
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate" title={item.pages[1].url}>
                                                                        {item.pages[1].url}
                                                                        <div className="text-xs text-gray-400">
                                                                            Pos: {item.pages[1].position.toFixed(1)} | Clicks: {item.pages[1].clicks}
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}

                                        {/* Query Counts Tab */}
                                        {activeTab === "query_counts" && queryCountData && queryCountChartData && (
                                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                                                <div className="flex justify-between items-center mb-6">
                                                    <div>
                                                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                                            Query Count Analysis
                                                        </h2>
                                                        <p className="text-gray-500 dark:text-gray-400 text-sm">
                                                            Number of unique ranking queries per page over time
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="h-[400px] w-full mb-8">
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <LineChart
                                                            data={queryCountChartData}
                                                            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                                                        >
                                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.2} />
                                                            <XAxis dataKey="month" stroke="#9CA3AF" />
                                                            <YAxis stroke="#9CA3AF" />
                                                            <Tooltip
                                                                contentStyle={{
                                                                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                                                    borderRadius: '8px',
                                                                    border: 'none',
                                                                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                                                                }}
                                                            />
                                                            <Legend />
                                                            {queryCountData.slice(0, 5).map((page, index) => (
                                                                <Line
                                                                    key={page.page}
                                                                    type="monotone"
                                                                    dataKey={page.page}
                                                                    stroke={[
                                                                        "#3b82f6", // blue
                                                                        "#ef4444", // red
                                                                        "#10b981", // green
                                                                        "#f59e0b", // amber
                                                                        "#8b5cf6"  // violet
                                                                    ][index % 5]}
                                                                    strokeWidth={2}
                                                                    dot={{ r: 4 }}
                                                                />
                                                            ))}
                                                        </LineChart>
                                                    </ResponsiveContainer>
                                                </div>

                                                <div className="overflow-x-auto border rounded-lg border-gray-200 dark:border-gray-700">
                                                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                                        <thead className="bg-gray-50 dark:bg-gray-900/30">
                                                            <tr>
                                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                                    Page
                                                                </th>
                                                                {queryCountChartData.map(d => (
                                                                    <th key={d.month} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                                        {d.month}
                                                                    </th>
                                                                ))}
                                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                                    Total Queries
                                                                </th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                                            {queryCountData.map((row, i) => (
                                                                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                                    <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white max-w-md truncate" title={row.page}>
                                                                        {row.page}
                                                                    </td>
                                                                    {queryCountChartData.map(d => (
                                                                        <td key={d.month} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                                            {row.counts[d.month] || 0}
                                                                        </td>
                                                                    ))}
                                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white">
                                                                        {row.totalQueries}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </main>
            </div>
        </ThemeProvider>
    );
}
