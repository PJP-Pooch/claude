"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useState, useEffect, Fragment, useMemo, useCallback } from "react";
import Image from "next/image";
import { format, parseISO, startOfWeek, startOfMonth, subDays, subMonths, subYears, differenceInDays } from "date-fns";
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
import { Download, Loader2, Search, AlertCircle, ExternalLink, LogOut, User, ArrowLeft, LayoutDashboard, Filter, RefreshCw, ChevronDown, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, Brain, Zap, TrendingDown, PieChart as PieChartIcon } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { ThemeProvider } from "@/components/ThemeProvider";
import { PieChart, Pie, Cell } from "recharts";
import Link from "next/link";

type GscRow = {
    keys: string[];
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
    wordCount?: number;
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

type IntentData = {
    intent: string;
    clicks: number;
    impressions: number;
    queryCount: number;
    avgPos: number;
};

type PoPMetric = {
    current: number;
    prev: number;
    diff: number;
    pcent: number;
};

type PoPRow = {
    key: string;
    clicks: PoPMetric;
    impressions: PoPMetric;
    position: PoPMetric;
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
    const [wordCountFilterType, setWordCountFilterType] = useState<"all" | "gt" | "lt" | "eq">("all");
    const [wordCountFilterValue, setWordCountFilterValue] = useState("");

    const [loading, setLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState("");
    const [data, setData] = useState<GscRow[] | null>(null);
    const [error, setError] = useState("");
    const [activeTab, setActiveTab] = useState<"raw" | "analysis" | "cannibalization" | "query_counts" | "striking_distance" | "ctr_opportunity" | "pop" | "yoy" | "intent" | "decay" | "page_analysis" | "directory">("raw");
    const [popMetric, setPopMetric] = useState<"clicks" | "impressions">("clicks");
    const [expandedQueries, setExpandedQueries] = useState<Set<string>>(new Set());
    const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set());
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
    const [childSortConfig, setChildSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
    const [compareMode, setCompareMode] = useState(false);
    const [compareType, setCompareType] = useState<"previous_period" | "previous_year" | "custom">("previous_period");
    const [compareStartDate, setCompareStartDate] = useState("");
    const [compareEndDate, setCompareEndDate] = useState("");
    const [comparisonData, setComparisonData] = useState<GscRow[] | null>(null);
    const [activeComparison, setActiveComparison] = useState<{
        current: { start: string, end: string },
        compare: { start: string, end: string } | null
    } | null>(null);

    // Brand Segmentation State
    const [brandKeywords, setBrandKeywords] = useState("");
    const [granularity, setGranularity] = useState<"day" | "week" | "month">("month");
    const [selectedQcUrls, setSelectedQcUrls] = useState<string[]>([]);
    const [urlDisplayMode, setUrlDisplayMode] = useState<"full" | "path">("full");
    const [minCannibalizationThreshold, setMinCannibalizationThreshold] = useState<number>(10);
    const [fetchedCompareType, setFetchedCompareType] = useState<"previous_period" | "previous_year" | "custom" | null>(null);
    const [decayFilter, setDecayFilter] = useState<"all" | "high_risk">("all");
    const [pageAnalysisFilterValue, setPageAnalysisFilterValue] = useState("");
    const [hasManuallyClearedQc, setHasManuallyClearedQc] = useState(false);

    const getPeriodKey = (date: Date, gran: "day" | "week" | "month") => {
        if (gran === "day") return format(date, "yyyy-MM-dd");
        if (gran === "week") return format(startOfWeek(date), "yyyy-MM-dd");
        return format(startOfMonth(date), "yyyy-MM");
    };

    const toggleQueryExpansion = (query: string) => {
        const newExpanded = new Set(expandedQueries);
        if (newExpanded.has(query)) {
            newExpanded.delete(query);
        } else {
            newExpanded.add(query);
        }
        setExpandedQueries(newExpanded);
    };

    const togglePageExpansion = (page: string) => {
        const newExpanded = new Set(expandedPages);
        if (newExpanded.has(page)) {
            newExpanded.delete(page);
        } else {
            newExpanded.add(page);
        }
        setExpandedPages(newExpanded);
    };

    const getPreviewDates = () => {
        let currentStart = new Date();
        let currentEnd = new Date();
        const today = new Date();

        if (dateRange === "last_7") currentStart = subDays(today, 7);
        else if (dateRange === "last_30") currentStart = subDays(today, 30);
        else if (dateRange === "last_3_months") currentStart = subMonths(today, 3);
        else if (dateRange === "last_6_months") currentStart = subMonths(today, 6);
        else if (dateRange === "last_12_months") currentStart = subMonths(today, 12);
        else if (dateRange === "last_16_months") currentStart = subMonths(today, 16);
        else if (dateRange === "custom") {
            if (!customStartDate || !customEndDate) return null;
            currentStart = parseISO(customStartDate);
            currentEnd = parseISO(customEndDate);
        }

        if (!compareMode) return { current: { start: format(currentStart, "yyyy-MM-dd"), end: format(currentEnd, "yyyy-MM-dd") }, compare: null };

        let compareStart: Date;
        let compareEnd: Date;

        if (compareType === "previous_period") {
            const duration = differenceInDays(currentEnd, currentStart) + 1;
            compareEnd = subDays(currentStart, 1);
            compareStart = subDays(compareEnd, duration - 1);
        } else if (compareType === "previous_year") {
            compareStart = subYears(currentStart, 1);
            compareEnd = subYears(currentEnd, 1);
        } else {
            if (!compareStartDate || !compareEndDate) return null;
            compareStart = parseISO(compareStartDate);
            compareEnd = parseISO(compareEndDate);
        }

        return {
            current: { start: format(currentStart, "yyyy-MM-dd"), end: format(currentEnd, "yyyy-MM-dd") },
            compare: { start: format(compareStart, "yyyy-MM-dd"), end: format(compareEnd, "yyyy-MM-dd") }
        };
    };

    const handleSort = (key: string) => {
        // Sorting for parent rows (queries)
        let direction: "asc" | "desc" = "asc";
        if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
            direction = "desc";
        }
        setSortConfig({ key, direction });
    };

    // Sorting for child rows (pages) within an expanded query
    const handleChildSort = (key: string) => {
        let direction: "asc" | "desc" = "asc";
        if (childSortConfig && childSortConfig.key === key && childSortConfig.direction === "asc") {
            direction = "desc";
        }
        setChildSortConfig({ key, direction });
    };

    // Sort child rows for a given query (used in Cannibalization)
    const getSortedPages = (pages: { url: string; clicks: number; impressions: number; ctr: number; position: number }[]) => {
        if (!childSortConfig) return pages;
        return [...pages].sort((a, b) => {
            const aValue = (a as any)[childSortConfig.key];
            const bValue = (b as any)[childSortConfig.key];
            if (aValue < bValue) return childSortConfig.direction === "asc" ? -1 : 1;
            if (aValue > bValue) return childSortConfig.direction === "asc" ? 1 : -1;
            return 0;
        });
    };

    const filterRows = useCallback((rows: GscRow[] | null) => {
        if (!rows) return null;
        return rows.filter(row => {
            if (wordCountFilterType === "all" || !wordCountFilterValue) return true;
            const count = row.wordCount || 0;
            const target = parseInt(wordCountFilterValue);
            if (isNaN(target)) return true;

            if (wordCountFilterType === "gt") return count > target;
            if (wordCountFilterType === "lt") return count < target;
            if (wordCountFilterType === "eq") return count === target;
            return true;
        });
    }, [wordCountFilterType, wordCountFilterValue]);

    const filteredData = useMemo(() => filterRows(data), [data, filterRows]);
    const filteredComparisonData = useMemo(() => filterRows(comparisonData), [comparisonData, filterRows]);

    const aggregatedByQuery = useMemo(() => {
        if (!filteredData || !selectedDimensions.includes("query")) return null;
        const queryIndex = selectedDimensions.indexOf("query");
        const map = new Map<string, GscRow>();

        filteredData.forEach(row => {
            const query = row.keys[queryIndex];
            if (!query) return;

            if (map.has(query)) {
                const existing = map.get(query)!;
                const newImpressions = existing.impressions + row.impressions;
                const newClicks = existing.clicks + row.clicks;
                const newPosition = newImpressions > 0
                    ? (existing.position * existing.impressions + row.position * row.impressions) / newImpressions
                    : (existing.position + row.position) / 2;
                map.set(query, {
                    ...existing,
                    clicks: newClicks,
                    impressions: newImpressions,
                    ctr: newImpressions > 0 ? newClicks / newImpressions : 0,
                    position: newPosition
                });
            } else {
                map.set(query, { ...row });
            }
        });
        return Array.from(map.values());
    }, [filteredData, selectedDimensions]);

    const aggregatedByQueryAndPage = useMemo(() => {
        if (!filteredData || !selectedDimensions.includes("query") || !selectedDimensions.includes("page")) return null;
        const queryIndex = selectedDimensions.indexOf("query");
        const pageIndex = selectedDimensions.indexOf("page");
        const map = new Map<string, GscRow>();

        filteredData.forEach(row => {
            const query = row.keys[queryIndex];
            const page = row.keys[pageIndex];
            if (!query || !page) return;

            const key = `${query}|${page}`;
            if (map.has(key)) {
                const existing = map.get(key)!;
                const newImpressions = existing.impressions + row.impressions;
                const newClicks = existing.clicks + row.clicks;
                const newPosition = newImpressions > 0
                    ? (existing.position * existing.impressions + row.position * row.impressions) / newImpressions
                    : (existing.position + row.position) / 2;
                map.set(key, {
                    ...existing,
                    clicks: newClicks,
                    impressions: newImpressions,
                    ctr: newImpressions > 0 ? newClicks / newImpressions : 0,
                    position: newPosition
                });
            } else {
                map.set(key, { ...row });
            }
        });
        return Array.from(map.values());
    }, [filteredData, selectedDimensions]);

    // Striking Distance Logic (Position 11-20)
    const strikingDistanceData = useMemo(() => {
        const sourceData = aggregatedByQuery || filteredData;
        if (!sourceData || !selectedDimensions.includes("query")) return null;
        return sourceData
            .filter(row => row.position > 10 && row.position <= 20)
            .sort((a, b) => b.impressions - a.impressions);
    }, [aggregatedByQuery, filteredData, selectedDimensions]);

    // Brand vs Non-Brand Logic
    const brandSegmentData = useMemo(() => {
        const sourceData = aggregatedByQuery || filteredData;
        if (!sourceData || !selectedDimensions.includes("query")) return null;
        const brandTerms = brandKeywords.split(',').map(t => t.trim().toLowerCase()).filter(t => t !== "");

        const summary = {
            brand: { clicks: 0, impressions: 0, count: 0 },
            nonBrand: { clicks: 0, impressions: 0, count: 0 }
        };

        const queryIndex = selectedDimensions.indexOf("query");
        sourceData.forEach(row => {
            const query = row.keys[queryIndex]?.toLowerCase() || "";
            const isBrand = brandTerms.some(term => query.includes(term));

            if (isBrand) {
                summary.brand.clicks += row.clicks;
                summary.brand.impressions += row.impressions;
                summary.brand.count++;
            } else {
                summary.nonBrand.clicks += row.clicks;
                summary.nonBrand.impressions += row.impressions;
                summary.nonBrand.count++;
            }
        });

        return summary;
    }, [aggregatedByQuery, filteredData, selectedDimensions, brandKeywords]);

    const brandTrendData = useMemo(() => {
        if (!filteredData || !selectedDimensions.includes("query") || !selectedDimensions.includes("date")) return null;
        const brandTerms = brandKeywords.split(',').map(t => t.trim().toLowerCase()).filter(t => t !== "");
        const queryIndex = selectedDimensions.indexOf("query");
        const dateIndex = selectedDimensions.indexOf("date");

        const trendMap: { [date: string]: { period: string, brandClicks: number, nonBrandClicks: number } } = {};

        filteredData.forEach(row => {
            const dateStr = row.keys[dateIndex];
            if (!dateStr) return;
            const date = parseISO(dateStr);
            const period = getPeriodKey(date, granularity);

            if (!trendMap[period]) {
                trendMap[period] = { period, brandClicks: 0, nonBrandClicks: 0 };
            }

            const query = row.keys[queryIndex]?.toLowerCase() || "";
            const isBrand = brandTerms.some(term => query.includes(term));

            if (isBrand) {
                trendMap[period].brandClicks += row.clicks;
            } else {
                trendMap[period].nonBrandClicks += row.clicks;
            }
        });

        return Object.values(trendMap).sort((a, b) => a.period.localeCompare(b.period));
    }, [filteredData, selectedDimensions, brandKeywords, granularity]);

    // CTR Opportunity Logic (High Impr, High Rank, Low CTR)
    const ctrOpportunityData = useMemo(() => {
        const sourceData = aggregatedByQuery || filteredData;
        if (!sourceData) return null;
        return sourceData
            .filter(row => row.position <= 10 && row.ctr < 0.03)
            .sort((a, b) => b.impressions - a.impressions);
    }, [aggregatedByQuery, filteredData]);

    const queryAnalysis = useMemo(() => {
        if (!filteredData || !selectedDimensions.includes("query") || !selectedDimensions.includes("date")) return null;
        const buckets: { [key: string]: { queries: Map<string, number>, positions_1_3: number, positions_4_10: number, positions_11_20: number, positions_20_plus: number } } = {};

        const queryIndex = selectedDimensions.indexOf("query");
        const dateIndex = selectedDimensions.indexOf("date");
        if (queryIndex === -1 || dateIndex === -1) return null;

        filteredData.forEach((row) => {
            const dateStr = row.keys[dateIndex];
            const query = row.keys[queryIndex];
            if (!dateStr || !query) return;

            const date = parseISO(dateStr);
            const period = getPeriodKey(date, granularity);

            if (!buckets[period]) {
                buckets[period] = {
                    queries: new Map(),
                    positions_1_3: 0,
                    positions_4_10: 0,
                    positions_11_20: 0,
                    positions_20_plus: 0,
                };
            }

            // Track best position for each unique query in this period
            const currentBest = buckets[period].queries.get(query);
            if (currentBest === undefined || row.position < currentBest) {
                buckets[period].queries.set(query, row.position);
            }
        });

        // Convert to final format by counting unique queries by position
        return Object.entries(buckets).map(([period, data]) => {
            const result: QueryPositionRow = {
                month: period,
                positions_1_3: 0,
                positions_4_10: 0,
                positions_11_20: 0,
                positions_20_plus: 0,
                totalQueries: data.queries.size,
            };

            data.queries.forEach((pos) => {
                if (pos <= 3) result.positions_1_3++;
                else if (pos <= 10) result.positions_4_10++;
                else if (pos <= 20) result.positions_11_20++;
                else result.positions_20_plus++;
            });

            return result;
        }).sort((a, b) => a.month.localeCompare(b.month));
    }, [filteredData, selectedDimensions, granularity]);

    const cannibalizationData = useMemo(() => {
        const sourceData = aggregatedByQueryAndPage || filteredData;
        if (!sourceData || !selectedDimensions.includes("query") || !selectedDimensions.includes("page")) return null;
        const queryMap: { [key: string]: CannibalizationRow } = {};
        const queryIndex = selectedDimensions.indexOf("query");
        const pageIndex = selectedDimensions.indexOf("page");

        if (queryIndex === -1 || pageIndex === -1) return null;

        sourceData.forEach(row => {
            const query = row.keys[queryIndex];
            const page = row.keys[pageIndex];

            if (!query || !page) return;

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
            queryMap[query].pageCount = queryMap[query].pages.length;
        });

        // Filter pages by impression share threshold
        return Object.values(queryMap)
            .map(item => {
                const impressionsArray = item.pages.map(p => p.impressions);
                const topImpression = impressionsArray.length > 0 ? impressionsArray.reduce((max, val) => Math.max(max, val), 0) : 0;
                const filteredPages = item.pages.filter(p => {
                    if (p.clicks === 0) return false;
                    if (topImpression === 0) return true;
                    return (p.impressions / topImpression) * 100 >= minCannibalizationThreshold;
                });

                // Recalculate totals for the filtered set
                const newTotalClicks = filteredPages.reduce((sum, p) => sum + p.clicks, 0);
                const newTotalImpressions = filteredPages.reduce((sum, p) => sum + p.impressions, 0);

                return {
                    ...item,
                    pages: filteredPages,
                    pageCount: filteredPages.length,
                    totalClicks: newTotalClicks,
                    totalImpressions: newTotalImpressions
                };
            })
            .filter(item => item.pageCount > 1 && item.totalImpressions > 0)
            .sort((a, b) => b.totalClicks - a.totalClicks);
    }, [aggregatedByQueryAndPage, filteredData, selectedDimensions, minCannibalizationThreshold]);

    // Intent Clustering Logic
    const intentAnalysis = useMemo(() => {
        if (!aggregatedByQuery || !selectedDimensions.includes("query")) return null;
        const brandTerms = brandKeywords.split(',').map(t => t.trim().toLowerCase()).filter(t => t !== "");

        const intents: { [key: string]: IntentData } = {
            "Transactional": { intent: "Transactional", clicks: 0, impressions: 0, queryCount: 0, avgPos: 0 },
            "Informational": { intent: "Informational", clicks: 0, impressions: 0, queryCount: 0, avgPos: 0 },
            "Commercial": { intent: "Commercial", clicks: 0, impressions: 0, queryCount: 0, avgPos: 0 },
            "Navigational": { intent: "Navigational", clicks: 0, impressions: 0, queryCount: 0, avgPos: 0 },
            "Other": { intent: "Other", clicks: 0, impressions: 0, queryCount: 0, avgPos: 0 }
        };

        const transactionalWords = ["buy", "purchase", "price", "cheap", "cost", "sale", "discount", "shop", "order"];
        const informationalWords = ["how", "what", "why", "when", "where", "who", "guide", "tips", "tutorial", "ideas", "meaning", "definition", "difference", "example"];
        const commercialWords = ["best", "top", "review", "vs", "comparison", "alternative", "rating", "compare"];

        const queryIndex = selectedDimensions.indexOf("query");
        if (queryIndex === -1) return null;

        aggregatedByQuery.forEach(row => {
            const query = row.keys[queryIndex]?.toLowerCase() || "";
            let intent = "Other";

            if (brandTerms.some(t => query.includes(t))) intent = "Navigational";
            else if (transactionalWords.some(t => query.includes(t))) intent = "Transactional";
            else if (commercialWords.some(t => query.includes(t))) intent = "Commercial";
            else if (informationalWords.some(t => query.includes(t))) intent = "Informational";

            const item = intents[intent];
            if (item) {
                item.clicks += row.clicks;
                item.impressions += row.impressions;
                item.queryCount++;
                item.avgPos = (item.avgPos * (item.queryCount - 1) + row.position) / item.queryCount;
            }
        });

        return Object.values(intents).filter(i => i.queryCount > 0);
    }, [aggregatedByQuery, selectedDimensions, brandKeywords]);

    // Period over Period Comparison Logic
    const popAnalysis = useMemo(() => {
        if (!filteredData) return null;

        let currentPeriodData = filteredData;
        let prevPeriodData = filteredComparisonData;

        // Match dimensions (everything except date)
        const matchDims = selectedDimensions.filter(d => d !== 'date');
        const matchIndices = matchDims.map(d => selectedDimensions.indexOf(d));

        if (matchIndices.length === 0) return null;

        const currentMap = new Map<string, { clicks: number, impressions: number, pos: number, count: number }>();
        const prevMap = new Map<string, { clicks: number, impressions: number, pos: number, count: number }>();
        const allKeys = new Set<string>();

        const processRows = (rows: GscRow[], map: Map<string, any>) => {
            rows.forEach(row => {
                const key = matchIndices.map(i => row.keys[i]).join(' | ');
                if (!key) return;
                allKeys.add(key);

                if (!map.has(key)) map.set(key, { clicks: 0, impressions: 0, pos: 0, count: 0 });
                const target = map.get(key)!;
                target.clicks += row.clicks;
                target.impressions += row.impressions;
                target.pos += row.position;
                target.count++;
            });
        };

        processRows(currentPeriodData, currentMap);
        if (prevPeriodData) processRows(prevPeriodData, prevMap);

        const results: PoPRow[] = Array.from(allKeys).map(key => {
            const curr = currentMap.get(key) || { clicks: 0, impressions: 0, pos: 0, count: 0 };
            const prev = prevMap.get(key) || { clicks: 0, impressions: 0, pos: 0, count: 0 };

            const currPos = curr.count > 0 ? curr.pos / curr.count : 0;
            const prevPos = prev.count > 0 ? prev.pos / prev.count : 0;

            const calcMetric = (c: number, p: number): PoPMetric => ({
                current: c,
                prev: p,
                diff: c - p,
                pcent: p > 0 ? ((c - p) / p) * 100 : (c > 0 ? 100 : 0)
            });

            return {
                key,
                clicks: calcMetric(curr.clicks, prev.clicks),
                impressions: calcMetric(curr.impressions, prev.impressions),
                position: {
                    current: currPos,
                    prev: prevPos,
                    diff: prevPos > 0 && currPos > 0 ? prevPos - currPos : 0, // Pos improvement is decrease in value
                    pcent: prevPos > 0 && currPos > 0 ? ((prevPos - currPos) / prevPos) * 100 : 0
                }
            };
        });

        return results.sort((a, b) => Math.abs(b.clicks.diff) - Math.abs(a.clicks.diff));
    }, [filteredData, filteredComparisonData, selectedDimensions]);

    // Comparison Trend Chart Data
    const comparisonTrendData = useMemo(() => {
        if (!filteredData || !filteredComparisonData || !selectedDimensions.includes("date")) return null;

        const dateIndex = selectedDimensions.indexOf("date");
        const currentDataByDay = new Map<string, { clicks: number, impressions: number }>();
        const prevDataByDay = new Map<string, { clicks: number, impressions: number }>();

        // We want to align days by index (Day 0, Day 1, etc.)
        const currentDates = Array.from(new Set(filteredData.map(r => r.keys[dateIndex]).filter((d): d is string => !!d))).sort();
        const prevDates = Array.from(new Set(filteredComparisonData.map(r => r.keys[dateIndex]).filter((d): d is string => !!d))).sort();

        filteredData.forEach(row => {
            const d = row.keys[dateIndex];
            if (typeof d !== 'string') return;
            const existing = currentDataByDay.get(d) || { clicks: 0, impressions: 0 };
            currentDataByDay.set(d, { clicks: existing.clicks + row.clicks, impressions: existing.impressions + row.impressions });
        });

        filteredComparisonData.forEach(row => {
            const d = row.keys[dateIndex];
            if (typeof d !== 'string') return;
            const existing = prevDataByDay.get(d) || { clicks: 0, impressions: 0 };
            prevDataByDay.set(d, { clicks: existing.clicks + row.clicks, impressions: existing.impressions + row.impressions });
        });

        const maxDays = Math.max(currentDates.length, prevDates.length);
        const chartData = [];

        for (let i = 0; i < maxDays; i++) {
            const currentDay = currentDates[i];
            const prevDay = prevDates[i];

            chartData.push({
                day: i + 1,
                currentDate: currentDay || "",
                prevDate: prevDay || "",
                currentClicks: currentDay ? (currentDataByDay.get(currentDay)?.clicks || 0) : 0,
                prevClicks: prevDay ? (prevDataByDay.get(prevDay)?.clicks || 0) : 0,
                currentImpr: currentDay ? (currentDataByDay.get(currentDay)?.impressions || 0) : 0,
                prevImpr: prevDay ? (prevDataByDay.get(prevDay)?.impressions || 0) : 0,
            });
        }

        return chartData;
    }, [filteredData, filteredComparisonData, selectedDimensions]);

    // Decay Alerts Logic
    const decayAnalysis = useMemo(() => {
        if (!filteredData || !selectedDimensions.includes("date") || !selectedDimensions.includes("page")) return null;
        const dateIndex = selectedDimensions.indexOf("date");
        const pageIndex = selectedDimensions.indexOf("page");

        const dates = filteredData.map(r => {
            const dateStr = r.keys[dateIndex];
            return dateStr ? parseISO(dateStr).getTime() : 0;
        }).filter(t => t > 0).sort();
        if (dates.length < 2) return null;

        const firstDate = dates[0];
        const lastDate = dates[dates.length - 1];
        if (firstDate === undefined || lastDate === undefined) return null;
        const mid = (firstDate + lastDate) / 2;

        const pageMetrics: { [page: string]: { firstHalf: { clicks: number, impr: number }, secondHalf: { clicks: number, impr: number } } } = {};

        filteredData.forEach(row => {
            const dateStr = row.keys[dateIndex];
            if (!dateStr) return;
            const date = parseISO(dateStr).getTime();
            const page = row.keys[pageIndex];
            if (!page) return;

            if (!pageMetrics[page]) {
                pageMetrics[page] = {
                    firstHalf: { clicks: 0, impr: 0 },
                    secondHalf: { clicks: 0, impr: 0 }
                };
            }

            const pageData = pageMetrics[page];
            if (pageData) {
                if (date < mid) {
                    pageData.firstHalf.clicks += row.clicks;
                    pageData.firstHalf.impr += row.impressions;
                } else {
                    pageData.secondHalf.clicks += row.clicks;
                    pageData.secondHalf.impr += row.impressions;
                }
            }
        });

        return Object.entries(pageMetrics).map(([page, data]) => {
            const clickDiff = data.secondHalf.clicks - data.firstHalf.clicks;
            const clickPcent = data.firstHalf.clicks > 0 ? (clickDiff / data.firstHalf.clicks) * 100 : 0;
            const imprDiff = data.secondHalf.impr - data.firstHalf.impr;
            const imprPcent = data.firstHalf.impr > 0 ? (imprDiff / data.firstHalf.impr) * 100 : 0;

            return {
                page,
                clickDiff,
                clickPcent,
                imprDiff,
                imprPcent,
                severity: (clickPcent < -20 || imprPcent < -20) ? 'high' : (clickPcent < -10 || imprPcent < -10) ? 'medium' : 'low'
            };
        }).filter(item => Math.abs(item.clickPcent) >= 5 || Math.abs(item.imprPcent) >= 5)
            .sort((a, b) => {
                const aSeverity = (Math.abs(a.clickPcent) + Math.abs(a.imprPcent)) / 2;
                const bSeverity = (Math.abs(b.clickPcent) + Math.abs(b.imprPcent)) / 2;
                return bSeverity - aSeverity;
            });
    }, [filteredData, selectedDimensions]);

    // Page Analysis (Pivot Table)
    const pageAnalysis = useMemo(() => {
        if (!filteredData || !selectedDimensions.includes("page") || !selectedDimensions.includes("query")) return null;

        const pageIndex = selectedDimensions.indexOf("page");
        const queryIndex = selectedDimensions.indexOf("query");

        type PageData = {
            page: string;
            totalClicks: number;
            totalImpressions: number;
            avgPosition: number;
            queryCount: number;
            queries: Array<{
                query: string;
                clicks: number;
                impressions: number;
                ctr: number;
                position: number;
            }>;
        };

        const pageMap: { [page: string]: PageData } = {};

        filteredData.forEach(row => {
            const page = row.keys[pageIndex];
            const query = row.keys[queryIndex];
            if (!page || !query) return;

            if (!pageMap[page]) {
                pageMap[page] = {
                    page,
                    totalClicks: 0,
                    totalImpressions: 0,
                    avgPosition: 0,
                    queryCount: 0,
                    queries: []
                };
            }

            pageMap[page].totalClicks += row.clicks;
            pageMap[page].totalImpressions += row.impressions;
            pageMap[page].queries.push({
                query,
                clicks: row.clicks,
                impressions: row.impressions,
                ctr: row.ctr,
                position: row.position
            });
        });

        // Calculate averages and sort queries
        Object.values(pageMap).forEach(pageData => {
            pageData.queryCount = pageData.queries.length;
            pageData.avgPosition = pageData.queries.reduce((sum, q) => sum + q.position, 0) / pageData.queryCount;
            pageData.queries.sort((a, b) => b.clicks - a.clicks);
        });

        return Object.values(pageMap).sort((a, b) => b.totalClicks - a.totalClicks);
    }, [filteredData, selectedDimensions]);

    // Directory Analysis
    const directoryAnalysis = useMemo(() => {
        if (!filteredData || !selectedDimensions.includes("page")) return null;

        const pageIndex = selectedDimensions.indexOf("page");
        const dirMap: { [dir: string]: { dir: string; clicks: number; impressions: number; ctr: number; pos: number; count: number; pages: number } } = {};

        filteredData.forEach(row => {
            const url = row.keys[pageIndex];
            if (!url) return;

            try {
                // Handle both full URLs and paths
                let path = url;
                if (url.startsWith('http')) {
                    path = new URL(url).pathname;
                }

                const parts = path.split('/').filter(Boolean);
                let dir = '/';
                if (parts.length > 0) {
                    dir = `/${parts[0]}/`;
                    // If we want 2nd level as well, we could do:
                    // if (parts.length > 1) dir += `${parts[1]}/`;
                }

                if (!dirMap[dir]) {
                    dirMap[dir] = { dir, clicks: 0, impressions: 0, ctr: 0, pos: 0, count: 0, pages: 0 };
                }

                const d = dirMap[dir];
                if (d) {
                    d.clicks += row.clicks;
                    d.impressions += row.impressions;
                    d.pos += row.position;
                    d.count++;
                    d.pages++;
                }
            } catch (e) {
                console.error("Error parsing URL for directory analysis:", url);
            }
        });

        return Object.values(dirMap)
            .map(d => ({
                ...d,
                ctr: d.impressions > 0 ? d.clicks / d.impressions : 0,
                avgPos: d.count > 0 ? d.pos / d.count : 0
            }))
            .sort((a, b) => b.clicks - a.clicks);
    }, [filteredData, selectedDimensions]);

    const sortedCannibalizationData = useMemo(() => {
        if (!cannibalizationData) return null;
        if (!sortConfig) return cannibalizationData;

        return [...cannibalizationData].sort((a, b) => {
            let aValue: any = a[sortConfig.key as keyof CannibalizationRow];
            let bValue: any = b[sortConfig.key as keyof CannibalizationRow];

            if (aValue < bValue) {
                return sortConfig.direction === "asc" ? -1 : 1;
            }
            if (aValue > bValue) {
                return sortConfig.direction === "asc" ? 1 : -1;
            }
            return 0;
        });
    }, [cannibalizationData, sortConfig]);

    const getSortedData = () => {
        if (!filteredData) return null;
        if (!sortConfig) return filteredData;
        return [...filteredData].sort((a, b) => {
            let aValue: any;
            let bValue: any;
            if (sortConfig.key === "wordCount") {
                aValue = a.wordCount || 0;
                bValue = b.wordCount || 0;
            } else if (selectedDimensions.includes(sortConfig.key)) {
                const index = selectedDimensions.indexOf(sortConfig.key);
                aValue = a.keys[index];
                bValue = b.keys[index];
            } else {
                aValue = a[sortConfig.key as keyof GscRow];
                bValue = b[sortConfig.key as keyof GscRow];
            }
            if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
            return 0;
        });
    };

    const sortedData = getSortedData();

    useEffect(() => {
        setSortConfig(null);
    }, [activeTab]);

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
        setLoadingMessage("Preparing to fetch data...");
        setError("");
        setData([]); // Clear previous data
        setComparisonData(null);
        setFetchedCompareType(null);
        setActiveComparison(null);
        setSelectedQcUrls([]);
        setHasManuallyClearedQc(false);

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

            // Calculate Comparison Dates
            let compareStart = "";
            let compareEnd = "";

            if (compareMode) {
                const currentStart = parseISO(startDate);
                const currentEnd = parseISO(endDate);

                if (compareType === "previous_period") {
                    const duration = differenceInDays(currentEnd, currentStart) + 1;
                    const prevEnd = subDays(currentStart, 1);
                    const prevStart = subDays(prevEnd, duration - 1);
                    compareStart = format(prevStart, "yyyy-MM-dd");
                    compareEnd = format(prevEnd, "yyyy-MM-dd");
                } else if (compareType === "previous_year") {
                    compareStart = format(subYears(currentStart, 1), "yyyy-MM-dd");
                    compareEnd = format(subYears(currentEnd, 1), "yyyy-MM-dd");
                } else if (compareType === "custom") {
                    compareStart = compareStartDate;
                    compareEnd = compareEndDate;
                }
            }

            setActiveComparison({
                current: { start: startDate, end: endDate },
                compare: compareMode ? { start: compareStart, end: compareEnd } : null
            });

            const filters: { dimension: string; operator: string; expression: string }[] = [];
            if (deviceFilter !== "all") {
                filters.push({
                    dimension: "device",
                    operator: "equals",
                    expression: deviceFilter.toLowerCase(),
                });
            }

            if (pageFilterValue) {
                filters.push({
                    dimension: "page",
                    operator: pageFilterType,
                    expression: pageFilterValue,
                });
            }

            if (queryFilterValue) {
                filters.push({
                    dimension: "query",
                    operator: queryFilterType,
                    expression: queryFilterValue,
                });
            }

            const fetchPeriodData = async (start: string, end: string, onProgress: (msg: string) => void, onData?: (rows: GscRow[]) => void) => {
                onProgress(`Starting fetch for ${start} to ${end}...`);

                const res = await fetch("/api/gsc/query", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        siteUrl: selectedProperty,
                        startDate: start,
                        endDate: end,
                        dimensions: selectedDimensions,
                        filters,
                        searchType,
                        rowLimit: 25000,
                    }),
                });

                if (!res.ok) throw new Error(`Failed to fetch data for ${start} - ${end}`);
                if (!res.body) throw new Error("No response body");

                const reader = res.body.getReader();
                const decoder = new TextDecoder();
                let accumulatedRows: GscRow[] = [];
                let buffer = "";

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split("\n");
                    buffer = lines.pop() || "";

                    for (const line of lines) {
                        if (!line.trim()) continue;
                        try {
                            const message = JSON.parse(line);
                            if (message.type === "progress") {
                                onProgress(message.message || "Fetching...");
                            } else if (message.type === "data") {
                                const newRows = message.rows || [];
                                for (const row of newRows) {
                                    accumulatedRows.push(row);
                                }
                                if (onData) onData(accumulatedRows);
                            } else if (message.type === "batch_error") {
                                console.error("Batch error:", message.message);
                                onProgress(`Warning: ${message.message}`);
                            } else if (message.type === "error") {
                                throw new Error(message.message);
                            }
                        } catch (e) {
                            if (e instanceof Error && e.message !== "Unexpected end of JSON input") {
                                console.error("Error parsing stream message", e);
                            }
                        }
                    }
                }
                // Process remaining buffer
                if (buffer.trim()) {
                    try {
                        const message = JSON.parse(buffer);
                        if (message.type === "data") {
                            const newRows = message.rows || [];
                            for (const row of newRows) {
                                accumulatedRows.push(row);
                            }
                            if (onData) onData(accumulatedRows);
                        }
                    } catch (e) { }
                }
                return accumulatedRows;
            };

            // Fetch Current Data
            setLoadingMessage("Fetching current period data...");
            const currentRows = await fetchPeriodData(startDate, endDate, setLoadingMessage, (rows) => {
                // Update UI incrementally for current data
                if (rows.length % 1000 === 0 || rows.length < 1000) {
                    const currentAggregated = aggregateData(rows);
                    setData(currentAggregated);
                }
            });
            setData(aggregateData(currentRows));

            // Fetch Comparison Data if needed
            if (compareMode && compareStart && compareEnd) {
                setLoadingMessage("Fetching comparison period data...");
                const compareRows = await fetchPeriodData(compareStart, compareEnd, setLoadingMessage);
                setComparisonData(aggregateData(compareRows));
                setFetchedCompareType(compareType);
            }

            setLoadingMessage("Data processing complete.");

        } catch (err: any) {
            setError(err.message || "Failed to fetch data. Please try again.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const aggregateData = (rows: GscRow[]) => {
        if (!rows || rows.length === 0) return [];
        const queryIndex = selectedDimensions.indexOf("query");
        const map = new Map<string, GscRow>();
        rows.forEach(row => {
            if (!row.keys) return;
            const key = row.keys.join('|||');
            if (map.has(key)) {
                const existing = map.get(key)!;
                const newImpressions = (existing.impressions || 0) + (row.impressions || 0);
                const newClicks = (existing.clicks || 0) + (row.clicks || 0);

                // Weighted average for position based on impressions
                const newPosition = newImpressions > 0
                    ? ((existing.position || 0) * (existing.impressions || 0) + (row.position || 0) * (row.impressions || 0)) / newImpressions
                    : ((existing.position || 0) + (row.position || 0)) / 2;

                map.set(key, {
                    ...existing,
                    clicks: newClicks,
                    impressions: newImpressions,
                    ctr: newImpressions > 0 ? newClicks / newImpressions : 0,
                    position: newPosition
                });
            } else {
                let wordCount: number | undefined;
                if (queryIndex !== -1 && row.keys[queryIndex]) {
                    const query = row.keys[queryIndex];
                    wordCount = query.trim().split(/\s+/).filter(word => word.length > 0).length;
                }
                map.set(key, { ...row, wordCount });
            }
        });
        return Array.from(map.values());
    };

    // Memoized Chart and Data for Query Counts
    const { qcData: queryCountData, qcChartData: queryCountChartData, topPagesForChart: queryCountTopPages } = useMemo(() => {
        if (!filteredData || filteredData.length === 0 || !selectedDimensions.includes("query") || !selectedDimensions.includes("page") || !selectedDimensions.includes("date")) {
            return { qcData: null, qcChartData: null, topPagesForChart: null };
        }

        const pageMap: { [page: string]: { [month: string]: Set<string> } } = {};
        const queryIndex = selectedDimensions.indexOf("query");
        const pageIndex = selectedDimensions.indexOf("page");
        const dateIndex = selectedDimensions.indexOf("date");

        if (queryIndex === -1 || pageIndex === -1 || dateIndex === -1) return { qcData: null, qcChartData: null, topPagesForChart: null };

        const allPeriods = new Set<string>();
        filteredData.forEach(row => {
            const query = row.keys[queryIndex];
            const page = row.keys[pageIndex];
            const dateStr = row.keys[dateIndex];
            if (!query || !page || !dateStr) return;
            const period = getPeriodKey(parseISO(dateStr), granularity);
            allPeriods.add(period);

            if (!pageMap[page]) pageMap[page] = {};
            if (!pageMap[page][period]) pageMap[page][period] = new Set();
            pageMap[page][period].add(query);
        });

        const sortedPeriods = Array.from(allPeriods).sort();

        const processedData: QueryCountRow[] = Object.entries(pageMap).map(([page, periods]) => {
            const counts: { [period: string]: number } = {};
            let totalUnique = new Set<string>();
            sortedPeriods.forEach(p => {
                counts[p] = periods[p]?.size || 0;
                if (periods[p]) periods[p].forEach(q => totalUnique.add(q));
            });
            return {
                page,
                counts,
                totalQueries: totalUnique.size
            };
        }).sort((a, b) => b.totalQueries - a.totalQueries);

        const topPagesForChart = selectedQcUrls.length > 0
            ? processedData.filter(p => selectedQcUrls.includes(p.page))
            : (hasManuallyClearedQc ? [] : processedData.slice(0, 1));

        const chartData = sortedPeriods.map(period => {
            const entry: any = { month: period };
            topPagesForChart.forEach(p => {
                entry[p.page] = p.counts[period] || 0;
            });
            return entry;
        });

        return { qcData: processedData, qcChartData: chartData, topPagesForChart };
    }, [filteredData, selectedDimensions, granularity, selectedQcUrls, hasManuallyClearedQc]);

    const globalStats = useMemo(() => {
        if (!data || data.length === 0) return null;
        const clicks = data.reduce((sum, row) => sum + row.clicks, 0);
        const impressions = data.reduce((sum, row) => sum + row.impressions, 0);
        const totalWeightedPos = data.reduce((sum, row) => sum + (row.position * row.impressions), 0);
        const position = impressions > 0 ? totalWeightedPos / impressions : 0;
        return {
            clicks,
            impressions,
            ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
            position
        };
    }, [data]);

    const formatUrl = (url: string) => {
        if (urlDisplayMode === "full") return url;
        try {
            const parsed = new URL(url);
            return parsed.pathname + parsed.search;
        } catch (e) {
            return url;
        }
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
                if (row.wordCount !== undefined) {
                    flatRow.wordCount = row.wordCount;
                }
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
        setWordCountFilterType("all");
        setWordCountFilterValue("");
        setDeviceFilter("all");
        setBrandKeywords("");
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
                                        <Image
                                            src={session.user.image}
                                            alt={session.user.name || "User"}
                                            width={40}
                                            height={40}
                                            className="w-10 h-10 rounded-full"
                                            unoptimized
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
                    <div className="w-full mx-auto">
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
                                            {(dateRange === "last_3_months" || dateRange === "last_6_months" || dateRange === "last_12_months" || dateRange === "last_16_months") && (
                                                <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                                                    <p className="text-xs text-blue-800 dark:text-blue-200 flex items-start">
                                                        <AlertCircle className="w-3 h-3 mr-1 mt-0.5 flex-shrink-0" />
                                                        <span>Large date ranges are fetched in 30-day batches with delays between requests to respect Google&apos;s API rate limits. This prevents timeouts and ensures reliable data retrieval.</span>
                                                    </p>
                                                </div>
                                            )}
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

                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                                    Comparison
                                                </label>
                                                <div className="flex items-center">
                                                    <input
                                                        type="checkbox"
                                                        id="compareMode"
                                                        className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                                                        checked={compareMode}
                                                        onChange={(e) => setCompareMode(e.target.checked)}
                                                    />
                                                    <label htmlFor="compareMode" className="ml-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                                                        Enable
                                                    </label>
                                                </div>
                                            </div>

                                            {compareMode ? (
                                                <div className="space-y-3">
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 font-bold">
                                                            COMPARE TYPE
                                                        </label>
                                                        <select
                                                            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                                                            value={compareType}
                                                            onChange={(e) => setCompareType(e.target.value as any)}
                                                        >
                                                            <option value="previous_period">Previous Period (PoP)</option>
                                                            <option value="previous_year">Previous Year (YoY)</option>
                                                            <option value="custom">Custom Date Range</option>
                                                        </select>
                                                    </div>

                                                    {compareType === "custom" && (
                                                        <div className="space-y-2 pt-1 border-t border-gray-100 dark:border-gray-700/50 mt-1">
                                                            <div className="flex items-center space-x-2">
                                                                <div className="flex-1">
                                                                    <label className="block text-[10px] text-gray-400 uppercase font-bold mb-1">Prior Start</label>
                                                                    <input
                                                                        type="date"
                                                                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs"
                                                                        value={compareStartDate}
                                                                        onChange={(e) => setCompareStartDate(e.target.value)}
                                                                    />
                                                                </div>
                                                                <div className="flex-1">
                                                                    <label className="block text-[10px] text-gray-400 uppercase font-bold mb-1">Prior End</label>
                                                                    <input
                                                                        type="date"
                                                                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs"
                                                                        value={compareEndDate}
                                                                        onChange={(e) => setCompareEndDate(e.target.value)}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {(() => {
                                                        const preview = getPreviewDates();
                                                        if (!preview || !preview.compare) return null;
                                                        return (
                                                            <div className="p-2 bg-blue-50/50 dark:bg-blue-900/20 rounded border border-blue-100 dark:border-blue-800/50">
                                                                <p className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 mb-1">Comparison Preview</p>
                                                                <div className="flex flex-col gap-1 text-[11px] text-gray-600 dark:text-gray-400">
                                                                    <div className="flex justify-between">
                                                                        <span>Current:</span>
                                                                        <span className="font-medium text-gray-900 dark:text-gray-200">{preview.current.start} - {preview.current.end}</span>
                                                                    </div>
                                                                    <div className="flex justify-between">
                                                                        <span>Prior:</span>
                                                                        <span className="font-medium text-gray-900 dark:text-gray-200">{preview.compare.start} - {preview.compare.end}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            ) : (
                                                <div className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-gray-50 dark:bg-gray-800 text-gray-400 text-sm italic">
                                                    Compare disabled
                                                </div>
                                            )}
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
                                            {selectedDimensions.includes("date") && (
                                                <div className="space-y-2 col-span-full border-t border-gray-200 dark:border-gray-700 pt-4 mt-2">
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                                        Chart Granularity
                                                    </label>
                                                    <div className="flex gap-2">
                                                        {(["day", "week", "month"] as const).map((g) => (
                                                            <button
                                                                key={g}
                                                                onClick={() => setGranularity(g)}
                                                                className={`flex-1 px-3 py-1 rounded-lg text-sm font-medium transition-colors border ${granularity === g
                                                                    ? "bg-blue-600 text-white border-blue-600"
                                                                    : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                                                                    }`}
                                                            >
                                                                {g.charAt(0).toUpperCase() + g.slice(1)}
                                                            </button>
                                                        ))}
                                                    </div>
                                                    <p className="text-xs text-gray-500 mt-1 italic">
                                                        Affects Query Position, Brand Trend, and Query Count charts.
                                                    </p>
                                                </div>
                                            )}

                                            <div className="space-y-2 col-span-full border-t border-gray-200 dark:border-gray-700 pt-4 mt-2">
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

                                            {/* Word Count Filter */}
                                            {selectedDimensions.includes("query") && (
                                                <div className="space-y-2">
                                                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                                        Word Count Filter
                                                    </label>
                                                    <div className="flex space-x-2">
                                                        <select
                                                            className="w-1/2 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                                                            value={wordCountFilterType}
                                                            onChange={(e) => setWordCountFilterType(e.target.value as any)}
                                                        >
                                                            <option value="all">Any Words</option>
                                                            <option value="gt">Greater Than (&gt;)</option>
                                                            <option value="lt">Less Than (&lt;)</option>
                                                            <option value="eq">Equal To (=)</option>
                                                        </select>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            placeholder="Words..."
                                                            className="w-1/2 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                                                            value={wordCountFilterValue}
                                                            onChange={(e) => setWordCountFilterValue(e.target.value)}
                                                            disabled={wordCountFilterType === "all"}
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {/* Brand Keywords Filter */}
                                            {selectedDimensions.includes("query") && (
                                                <div className="space-y-2">
                                                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                                        Brand Keywords (comma separated)
                                                    </label>
                                                    <input
                                                        type="text"
                                                        placeholder="brand, brandname, etc..."
                                                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                                                        value={brandKeywords}
                                                        onChange={(e) => setBrandKeywords(e.target.value)}
                                                    />
                                                </div>
                                            )}
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
                                                    {loadingMessage || "Fetching Data..."}
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

                                {!compareMode && activeTab !== 'pop' && activeTab !== 'yoy' && data && (
                                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 p-3 rounded-lg flex items-center justify-between mb-8">
                                        <div className="flex items-center text-sm text-blue-700 dark:text-blue-300">
                                            <Zap className="w-4 h-4 mr-2 text-blue-500" />
                                            <span>💡 <strong>Analyze trends:</strong> Compare this data to the previous period for deeper insights.</span>
                                        </div>
                                        <button
                                            onClick={() => {
                                                setCompareMode(true);
                                                window.scrollTo({ top: 0, behavior: 'smooth' });
                                            }}
                                            className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                                        >
                                            Enable Comparison
                                        </button>
                                    </div>
                                )}
                                {data && (
                                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                        {/* Global KPI Summary */}
                                        {globalStats && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Total Clicks</p>
                                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{globalStats.clicks.toLocaleString()}</p>
                                                </div>
                                                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Total Impressions</p>
                                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{globalStats.impressions.toLocaleString()}</p>
                                                </div>
                                                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Avg. CTR</p>
                                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{globalStats.ctr.toFixed(2)}%</p>
                                                </div>
                                                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Avg. Position</p>
                                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{globalStats.position.toFixed(1)}</p>
                                                </div>
                                            </div>
                                        )}

                                        {!selectedDimensions.includes("date") && (
                                            <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-lg flex items-start text-blue-800 dark:text-blue-300 border border-blue-100 dark:border-blue-900/30">
                                                <Brain className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" />
                                                <p className="text-sm">
                                                    <span className="font-bold">Pro Tip:</span> Select the <span className="font-mono bg-blue-100 dark:bg-blue-800 px-1 rounded">date</span> dimension in the filters to unlock trend graphs and performance comparisons.
                                                </p>
                                            </div>
                                        )}

                                        {/* Global Performance Overview (Moved from Query Analysis) */}
                                        {brandSegmentData && brandKeywords && (
                                            <div className="space-y-6">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                                                        <h3 className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2 font-mono">Non-Brand Performance</h3>
                                                        <div className="flex justify-between items-end">
                                                            <div>
                                                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{brandSegmentData.nonBrand.clicks.toLocaleString()}</p>
                                                                <p className="text-sm text-gray-500">Clicks</p>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                                                                    {brandSegmentData.nonBrand.impressions > 0
                                                                        ? ((brandSegmentData.nonBrand.clicks / brandSegmentData.nonBrand.impressions) * 100).toFixed(2)
                                                                        : 0}%
                                                                </p>
                                                                <p className="text-xs text-gray-500">Avg. CTR</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                                                        <h3 className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wider mb-2 font-mono">Brand Performance</h3>
                                                        <div className="flex justify-between items-end">
                                                            <div>
                                                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{brandSegmentData.brand.clicks.toLocaleString()}</p>
                                                                <p className="text-sm text-gray-500">Clicks</p>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                                                                    {brandSegmentData.brand.impressions > 0
                                                                        ? ((brandSegmentData.brand.clicks / brandSegmentData.brand.impressions) * 100).toFixed(2)
                                                                        : 0}%
                                                                </p>
                                                                <p className="text-xs text-gray-500">Avg. CTR</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {brandTrendData && selectedDimensions.includes("date") && !compareMode && (
                                                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                                                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-6 flex items-center">
                                                            <PieChartIcon className="w-4 h-4 mr-2 text-blue-500" />
                                                            Brand vs Non-Brand Click Trend
                                                        </h3>
                                                        <div className="h-[300px] w-full">
                                                            <ResponsiveContainer width="100%" height="100%">
                                                                <LineChart data={brandTrendData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.1} />
                                                                    <XAxis dataKey="period" stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
                                                                    <YAxis stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
                                                                    <Tooltip
                                                                        contentStyle={{
                                                                            backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                                                            borderRadius: '8px',
                                                                            border: 'none',
                                                                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                                                                        }}
                                                                    />
                                                                    <Legend iconType="circle" />
                                                                    <Line type="monotone" dataKey="brandClicks" name="Brand Clicks" stroke="#22c55e" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                                                    <Line type="monotone" dataKey="nonBrandClicks" name="Non-Brand Clicks" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                                                </LineChart>
                                                            </ResponsiveContainer>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
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
                                                <>
                                                    <button
                                                        onClick={() => setActiveTab("analysis")}
                                                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${activeTab === "analysis"
                                                            ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                                                            : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                                                            }`}
                                                    >
                                                        Query Analysis
                                                    </button>

                                                    <button
                                                        onClick={() => setActiveTab("directory")}
                                                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${activeTab === "directory"
                                                            ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                                                            : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                                                            }`}
                                                    >
                                                        Category Analysis
                                                    </button>
                                                </>
                                            )}
                                            {pageAnalysis && (
                                                <button
                                                    onClick={() => setActiveTab("page_analysis")}
                                                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap flex items-center ${activeTab === "page_analysis"
                                                        ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                                                        : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                                                        }`}
                                                >
                                                    <LayoutDashboard className="w-3 h-3 mr-1" />
                                                    Page Analysis
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
                                            {strikingDistanceData && (
                                                <button
                                                    onClick={() => setActiveTab("striking_distance")}
                                                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${activeTab === "striking_distance"
                                                        ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                                                        : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                                                        }`}
                                                >
                                                    Striking Distance
                                                </button>
                                            )}
                                            {ctrOpportunityData && (
                                                <button
                                                    onClick={() => setActiveTab("ctr_opportunity")}
                                                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${activeTab === "ctr_opportunity"
                                                        ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                                                        : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                                                        }`}
                                                >
                                                    CTR Opps
                                                </button>
                                            )}
                                            <button
                                                onClick={() => {
                                                    setActiveTab("pop");
                                                    setCompareType("previous_period");
                                                    if (comparisonData && fetchedCompareType && fetchedCompareType !== "previous_period") {
                                                        setComparisonData(null);
                                                        setFetchedCompareType(null);
                                                    }
                                                }}
                                                className={`px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap flex items-center ${activeTab === "pop"
                                                    ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                                                    : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                                                    }`}
                                            >
                                                <Zap className="w-3 h-3 mr-1" />
                                                PoP Diff
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setActiveTab("yoy");
                                                    setCompareType("previous_year");
                                                    if (comparisonData && fetchedCompareType && fetchedCompareType !== "previous_year") {
                                                        setComparisonData(null);
                                                        setFetchedCompareType(null);
                                                    }
                                                }}
                                                className={`px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap flex items-center ${activeTab === "yoy"
                                                    ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                                                    : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                                                    }`}
                                            >
                                                <RefreshCw className="w-3 h-3 mr-1" />
                                                YoY Diff
                                            </button>
                                            {intentAnalysis && (
                                                <button
                                                    onClick={() => setActiveTab("intent")}
                                                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap flex items-center ${activeTab === "intent"
                                                        ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                                                        : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                                                        }`}
                                                >
                                                    <Brain className="w-3 h-3 mr-1" />
                                                    Intent
                                                </button>
                                            )}
                                            {decayAnalysis && (
                                                <button
                                                    onClick={() => setActiveTab("decay")}
                                                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap flex items-center ${activeTab === "decay"
                                                        ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                                                        : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                                                        }`}
                                                >
                                                    <TrendingDown className="w-3 h-3 mr-1" />
                                                    Decay
                                                </button>
                                            )}

                                        </div>

                                        <div className="space-y-6">
                                            <p className="text-sm text-gray-500 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/10 p-4 rounded-lg flex items-center">
                                                <Brain className="w-4 h-4 mr-2 text-blue-500" />
                                                View the performance charts and KPIs at the top for a broader overview of brand visibility.
                                            </p>
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
                                                            downloadCsv(data, `gsc_export_${selectedProperty}.csv`)
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
                                                                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                                                                        onClick={() => handleSort(dim)}
                                                                    >
                                                                        <div className="flex items-center">
                                                                            {dim}
                                                                            {sortConfig?.key === dim ? (
                                                                                sortConfig.direction === "asc" ? <ArrowUp className="w-4 h-4 ml-1" /> : <ArrowDown className="w-4 h-4 ml-1" />
                                                                            ) : (
                                                                                <ArrowUpDown className="w-4 h-4 ml-1 opacity-50" />
                                                                            )}
                                                                        </div>
                                                                    </th>
                                                                ))}
                                                                {selectedDimensions.includes("query") && (
                                                                    <th
                                                                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                                                                        onClick={() => handleSort("wordCount")}
                                                                    >
                                                                        <div className="flex items-center">
                                                                            Words
                                                                            {sortConfig?.key === "wordCount" ? (
                                                                                sortConfig.direction === "asc" ? <ArrowUp className="w-4 h-4 ml-1" /> : <ArrowDown className="w-4 h-4 ml-1" />
                                                                            ) : (
                                                                                <ArrowUpDown className="w-4 h-4 ml-1 opacity-50" />
                                                                            )}
                                                                        </div>
                                                                    </th>
                                                                )}
                                                                <th
                                                                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                                                                    onClick={() => handleSort("clicks")}
                                                                >
                                                                    <div className="flex items-center">
                                                                        Clicks
                                                                        {sortConfig?.key === "clicks" ? (
                                                                            sortConfig.direction === "asc" ? <ArrowUp className="w-4 h-4 ml-1" /> : <ArrowDown className="w-4 h-4 ml-1" />
                                                                        ) : (
                                                                            <ArrowUpDown className="w-4 h-4 ml-1 opacity-50" />
                                                                        )}
                                                                    </div>
                                                                </th>
                                                                <th
                                                                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                                                                    onClick={() => handleSort("impressions")}
                                                                >
                                                                    <div className="flex items-center">
                                                                        Imp.
                                                                        {sortConfig?.key === "impressions" ? (
                                                                            sortConfig.direction === "asc" ? <ArrowUp className="w-4 h-4 ml-1" /> : <ArrowDown className="w-4 h-4 ml-1" />
                                                                        ) : (
                                                                            <ArrowUpDown className="w-4 h-4 ml-1 opacity-50" />
                                                                        )}
                                                                    </div>
                                                                </th>
                                                                <th
                                                                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                                                                    onClick={() => handleSort("ctr")}
                                                                >
                                                                    <div className="flex items-center">
                                                                        CTR
                                                                        {sortConfig?.key === "ctr" ? (
                                                                            sortConfig.direction === "asc" ? <ArrowUp className="w-4 h-4 ml-1" /> : <ArrowDown className="w-4 h-4 ml-1" />
                                                                        ) : (
                                                                            <ArrowUpDown className="w-4 h-4 ml-1 opacity-50" />
                                                                        )}
                                                                    </div>
                                                                </th>
                                                                <th
                                                                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                                                                    onClick={() => handleSort("position")}
                                                                >
                                                                    <div className="flex items-center">
                                                                        Pos
                                                                        {sortConfig?.key === "position" ? (
                                                                            sortConfig.direction === "asc" ? <ArrowUp className="w-4 h-4 ml-1" /> : <ArrowDown className="w-4 h-4 ml-1" />
                                                                        ) : (
                                                                            <ArrowUpDown className="w-4 h-4 ml-1 opacity-50" />
                                                                        )}
                                                                    </div>
                                                                </th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                                            {sortedData?.slice(0, 100).map((row, i) => (
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
                                                                    {selectedDimensions.includes("query") && (
                                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                                            {row.wordCount}
                                                                        </td>
                                                                    )}
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
                                                    {data.length > 100 && (
                                                        <div className="px-6 py-3 bg-gray-50 dark:bg-gray-900/30 text-center text-sm text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700">
                                                            Showing first 100 rows of {data.length.toLocaleString()}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Page Analysis Tab */}
                                        {activeTab === "page_analysis" && pageAnalysis && (
                                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                                                <div className="flex justify-between items-center mb-6">
                                                    <div>
                                                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Page Analysis (Pivot)</h2>
                                                        <p className="text-gray-500 dark:text-gray-400 text-sm">
                                                            Grouping data by page with nested queries.
                                                        </p>
                                                    </div>
                                                    <button
                                                        onClick={() => downloadCsv(pageAnalysis.flatMap(p => p.queries.map(q => ({ page: p.page, ...q }))), `page_analysis_${selectedProperty}.csv`)}
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
                                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Page / Query</th>
                                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Clicks</th>
                                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Impr.</th>
                                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">CTR</th>
                                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Pos.</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                                            {pageAnalysis.slice(0, 50).map((page, idx) => (
                                                                <Fragment key={idx}>
                                                                    <tr
                                                                        className="bg-blue-50/30 dark:bg-blue-900/5 font-bold border-l-4 border-blue-500 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                                                        onClick={() => togglePageExpansion(page.page)}
                                                                    >
                                                                        <td className="px-6 py-4 text-sm text-blue-600 dark:text-blue-400 truncate max-w-lg" title={page.page}>
                                                                            <div className="flex items-center">
                                                                                {expandedPages.has(page.page) ? (
                                                                                    <ChevronDown className="w-4 h-4 mr-2" />
                                                                                ) : (
                                                                                    <ChevronRight className="w-4 h-4 mr-2" />
                                                                                )}
                                                                                {formatUrl(page.page)}
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-white font-bold">{page.totalClicks.toLocaleString()}</td>
                                                                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-white font-bold">{page.totalImpressions.toLocaleString()}</td>
                                                                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-white font-bold">{((page.totalClicks / page.totalImpressions) * 100).toFixed(2)}%</td>
                                                                        <td className="px-6 py-4 text-xs text-gray-500 italic">Avg {page.avgPosition.toFixed(1)} ({page.queryCount} queries)</td>
                                                                    </tr>
                                                                    {expandedPages.has(page.page) && page.queries.slice(0, 15).map((q, qIdx) => (
                                                                        <tr key={`${idx}-${qIdx}`} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border-l-4 border-transparent">
                                                                            <td className="pl-12 pr-6 py-2 text-sm text-gray-600 dark:text-gray-400">{q.query}</td>
                                                                            <td className="px-6 py-2 text-sm text-gray-500 dark:text-gray-400">{q.clicks.toLocaleString()}</td>
                                                                            <td className="px-6 py-2 text-sm text-gray-500 dark:text-gray-400">{q.impressions.toLocaleString()}</td>
                                                                            <td className="px-6 py-2 text-sm text-gray-500 dark:text-gray-400">{(q.ctr * 100).toFixed(2)}%</td>
                                                                            <td className="px-6 py-2 text-sm text-gray-500 dark:text-gray-400">{q.position.toFixed(1)}</td>
                                                                        </tr>
                                                                    ))}
                                                                </Fragment>
                                                            ))}
                                                        </tbody>
                                                    </table>
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

                                                <div className="h-[400px] w-full mb-8 overflow-x-auto">
                                                    <div style={{ minWidth: `${Math.max(800, (queryAnalysis?.length || 0) * 60)}px`, height: '100%' }}>
                                                        <ResponsiveContainer width="100%" height="100%">
                                                            <BarChart
                                                                data={queryAnalysis}
                                                                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                                                            >
                                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.2} />
                                                                <XAxis dataKey="month" stroke="#9CA3AF" />
                                                                <YAxis stroke="#9CA3AF" />
                                                                <Tooltip
                                                                    content={({ active, payload }) => {
                                                                        if (!active || !payload || !payload.length) return null;
                                                                        const data = payload[0].payload;
                                                                        const total = data.totalQueries || 0;
                                                                        return (
                                                                            <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
                                                                                <p className="font-semibold text-gray-900 dark:text-white mb-2">{data.month}</p>
                                                                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Total: {total} queries</p>
                                                                                {payload.map((entry: any, index: number) => (
                                                                                    <div key={index} className="flex items-center justify-between gap-4 text-sm">
                                                                                        <span style={{ color: entry.color }}>{entry.name}:</span>
                                                                                        <span className="font-medium text-gray-900 dark:text-white">
                                                                                            {entry.value} ({total > 0 ? ((entry.value / total) * 100).toFixed(1) : 0}%)
                                                                                        </span>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        );
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
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <p className="text-gray-500 dark:text-gray-400 text-sm">
                                                                Queries where multiple pages are competing for rankings
                                                            </p>
                                                            {selectedDimensions.includes("date") && (
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                                                    <RefreshCw className="w-3 h-3 mr-1 animate-spin-slow" />
                                                                    Aggregated across dates
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-4">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Min Threshold:</span>
                                                            <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                                                                {[5, 10, 15, 20, 25].map((val) => (
                                                                    <button
                                                                        key={val}
                                                                        onClick={() => setMinCannibalizationThreshold(val)}
                                                                        className={`px-2 py-1 text-xs font-medium rounded-md transition-all ${minCannibalizationThreshold === val
                                                                            ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm"
                                                                            : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                                                                            }`}
                                                                    >
                                                                        {val}%
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                                                            <button
                                                                onClick={() => setUrlDisplayMode("full")}
                                                                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${urlDisplayMode === "full" ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"}`}
                                                            >
                                                                Full URL
                                                            </button>
                                                            <button
                                                                onClick={() => setUrlDisplayMode("path")}
                                                                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${urlDisplayMode === "path" ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"}`}
                                                            >
                                                                Path Only
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="overflow-x-auto border rounded-lg border-gray-200 dark:border-gray-700">
                                                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                                        <thead className="bg-gray-50 dark:bg-gray-900/30">
                                                            <tr>
                                                                <th
                                                                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                                                                    onClick={() => handleSort("query")}
                                                                >
                                                                    <div className="flex items-center">
                                                                        Query
                                                                        {sortConfig?.key === "query" ? (
                                                                            sortConfig.direction === "asc" ? <ArrowUp className="w-4 h-4 ml-1" /> : <ArrowDown className="w-4 h-4 ml-1" />
                                                                        ) : (
                                                                            <ArrowUpDown className="w-4 h-4 ml-1 opacity-50" />
                                                                        )}
                                                                    </div>
                                                                </th>
                                                                <th
                                                                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                                                                    onClick={() => handleSort("pageCount")}
                                                                >
                                                                    <div className="flex items-center" title="Number of unique pages ranking for this query">
                                                                        Unique Pages
                                                                        {sortConfig?.key === "pageCount" ? (
                                                                            sortConfig.direction === "asc" ? <ArrowUp className="w-4 h-4 ml-1" /> : <ArrowDown className="w-4 h-4 ml-1" />
                                                                        ) : (
                                                                            <ArrowUpDown className="w-4 h-4 ml-1 opacity-50" />
                                                                        )}
                                                                    </div>
                                                                </th>
                                                                <th
                                                                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                                                                    onClick={() => handleSort("totalClicks")}
                                                                >
                                                                    <div className="flex items-center">
                                                                        Total Clicks
                                                                        {sortConfig?.key === "totalClicks" ? (
                                                                            sortConfig.direction === "asc" ? <ArrowUp className="w-4 h-4 ml-1" /> : <ArrowDown className="w-4 h-4 ml-1" />
                                                                        ) : (
                                                                            <ArrowUpDown className="w-4 h-4 ml-1 opacity-50" />
                                                                        )}
                                                                    </div>
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
                                                            {sortedCannibalizationData?.map((item) => (
                                                                <Fragment key={item.query}>
                                                                    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer" onClick={() => toggleQueryExpansion(item.query)}>
                                                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white flex items-center">
                                                                            {expandedQueries.has(item.query) ? (
                                                                                <ChevronDown className="w-4 h-4 mr-2 text-gray-500" />
                                                                            ) : (
                                                                                <ChevronRight className="w-4 h-4 mr-2 text-gray-500" />
                                                                            )}
                                                                            {item.query}
                                                                        </td>
                                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                                            {item.pageCount}
                                                                        </td>
                                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                                            {item.totalClicks}
                                                                        </td>
                                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                                            <span className="max-w-xs truncate inline-block align-bottom" title={item.pages[0]?.url}>
                                                                                {formatUrl(item.pages[0]?.url || "")}
                                                                            </span>
                                                                        </td>
                                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                                            <span className="max-w-xs truncate inline-block align-bottom" title={item.pages[1]?.url}>
                                                                                {formatUrl(item.pages[1]?.url || "")}
                                                                            </span>
                                                                        </td>
                                                                    </tr>
                                                                    {expandedQueries.has(item.query) && (
                                                                        <tr className="bg-gray-50 dark:bg-gray-900/50">
                                                                            <td colSpan={5} className="px-6 py-4">
                                                                                <div className="overflow-x-auto">
                                                                                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                                                                        <thead className="bg-gray-100 dark:bg-gray-800">
                                                                                            <tr>
                                                                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700" onClick={() => handleChildSort('url')}>URL {childSortConfig?.key === 'url' ? (childSortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 inline" /> : <ArrowDown className="w-3 h-3 inline" />) : <ArrowUpDown className="w-3 h-3 inline opacity-50" />}</th>
                                                                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700" onClick={() => handleChildSort('clicks')}>Clicks {childSortConfig?.key === 'clicks' ? (childSortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 inline" /> : <ArrowDown className="w-3 h-3 inline" />) : <ArrowUpDown className="w-3 h-3 inline opacity-50" />}</th>
                                                                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700" onClick={() => handleChildSort('impressions')}>Impr. {childSortConfig?.key === 'impressions' ? (childSortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 inline" /> : <ArrowDown className="w-3 h-3 inline" />) : <ArrowUpDown className="w-3 h-3 inline opacity-50" />}</th>
                                                                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Share</th>
                                                                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700" onClick={() => handleChildSort('ctr')}>CTR {childSortConfig?.key === 'ctr' ? (childSortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 inline" /> : <ArrowDown className="w-3 h-3 inline" />) : <ArrowUpDown className="w-3 h-3 inline opacity-50" />}</th>
                                                                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700" onClick={() => handleChildSort('position')}>Pos {childSortConfig?.key === 'position' ? (childSortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 inline" /> : <ArrowDown className="w-3 h-3 inline" />) : <ArrowUpDown className="w-3 h-3 inline opacity-50" />}</th>
                                                                                            </tr>
                                                                                        </thead>
                                                                                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                                                                            {getSortedPages(item.pages).map((page) => (
                                                                                                <tr key={page.url} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                                                                    <td className="px-4 py-2 text-sm text-gray-900 dark:text-white break-all">
                                                                                                        <a href={page.url} target="_blank" rel="noopener noreferrer" className="hover:underline text-blue-600 dark:text-blue-400">
                                                                                                            {page.url}
                                                                                                        </a>
                                                                                                    </td>
                                                                                                    <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">{page.clicks}</td>
                                                                                                    <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">{page.impressions}</td>
                                                                                                    <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                                                                                                        {item.totalImpressions > 0 ? ((page.impressions / item.totalImpressions) * 100).toFixed(1) : "0.0"}%
                                                                                                    </td>
                                                                                                    <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">{(page.ctr * 100).toFixed(2)}%</td>
                                                                                                    <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">{page.position.toFixed(1)}</td>
                                                                                                </tr>
                                                                                            ))}
                                                                                        </tbody>
                                                                                    </table>
                                                                                </div>
                                                                            </td>
                                                                        </tr>
                                                                    )}
                                                                </Fragment>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>

                                            </div>
                                        )
                                        }

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
                                                    <div className="flex items-center gap-4">
                                                        <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                                                            <button
                                                                onClick={() => setUrlDisplayMode("full")}
                                                                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${urlDisplayMode === "full" ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"}`}
                                                            >
                                                                Full URL
                                                            </button>
                                                            <button
                                                                onClick={() => setUrlDisplayMode("path")}
                                                                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${urlDisplayMode === "path" ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"}`}
                                                            >
                                                                Path Only
                                                            </button>
                                                        </div>
                                                        {selectedQcUrls.length > 0 && (
                                                            <button
                                                                onClick={() => {
                                                                    setSelectedQcUrls([]);
                                                                    setHasManuallyClearedQc(true);
                                                                }}
                                                                className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center"
                                                            >
                                                                <RefreshCw className="w-3 h-3 mr-1" />
                                                                Clear Chart Selection
                                                            </button>
                                                        )}
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
                                                            {queryCountTopPages?.map((page, index) => (
                                                                <Line
                                                                    key={page.page}
                                                                    type="monotone"
                                                                    dataKey={page.page}
                                                                    name={(() => {
                                                                        const formatted = formatUrl(page.page);
                                                                        return formatted.length > 50 ? formatted.substring(0, 50) + '...' : formatted;
                                                                    })()}
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
                                                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-10">
                                                                    Chart
                                                                </th>
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
                                                            {queryCountData.map((row, i) => {
                                                                const isImplicitlySelected = selectedQcUrls.length === 0 && !hasManuallyClearedQc && i === 0;
                                                                const isSelected = selectedQcUrls.includes(row.page) || isImplicitlySelected;

                                                                return (
                                                                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                                                        <td className="px-4 py-4 text-center">
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={isSelected}
                                                                                onChange={() => {
                                                                                    if (isSelected) {
                                                                                        // If it was explicitly selected, remove it.
                                                                                        // If it was implicitly selected (fallback), we are now manually interacting, so "unselect" means add nothing but set manual flag.
                                                                                        if (selectedQcUrls.includes(row.page)) {
                                                                                            const newSelection = selectedQcUrls.filter(u => u !== row.page);
                                                                                            setSelectedQcUrls(newSelection);
                                                                                            if (newSelection.length === 0) setHasManuallyClearedQc(true);
                                                                                        } else {
                                                                                            // Was implicit, now explicit remove
                                                                                            setHasManuallyClearedQc(true);
                                                                                        }
                                                                                    } else {
                                                                                        // Add to selection
                                                                                        setSelectedQcUrls([...selectedQcUrls, row.page]);
                                                                                        setHasManuallyClearedQc(true);
                                                                                    }
                                                                                }}
                                                                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                                                                            />
                                                                        </td>
                                                                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-white max-w-md truncate" title={row.page}>
                                                                            {formatUrl(row.page)}
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
                                                                )
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}

                                        {/* Striking Distance Tab */}
                                        {activeTab === "striking_distance" && strikingDistanceData && (
                                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                                                <div className="flex justify-between items-center mb-6">
                                                    <div>
                                                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                                            Striking Distance Report
                                                        </h2>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <p className="text-gray-500 dark:text-gray-400 text-sm">
                                                                Queries ranking in positions 11-20. High potential for quick wins.
                                                            </p>
                                                            {selectedDimensions.includes("date") && (
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                                                    Aggregated across dates
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => downloadCsv(strikingDistanceData, `striking_distance_${selectedProperty}.csv`)}
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
                                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Query</th>
                                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Impr.</th>
                                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Pos.</th>
                                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">CTR</th>
                                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Clicks</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                                            {strikingDistanceData.slice(0, 100).map((row, i) => (
                                                                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                                    <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{row.keys[selectedDimensions.indexOf("query")]}</td>
                                                                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{row.impressions.toLocaleString()}</td>
                                                                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{row.position.toFixed(1)}</td>
                                                                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{(row.ctr * 100).toFixed(2)}%</td>
                                                                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{row.clicks}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}

                                        {/* CTR Opportunity Tab */}
                                        {activeTab === "ctr_opportunity" && ctrOpportunityData && (
                                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                                                <div className="flex justify-between items-center mb-6">
                                                    <div>
                                                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                                            CTR Opportunity Analysis
                                                        </h2>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <p className="text-gray-500 dark:text-gray-400 text-sm">
                                                                High ranking queries (Pos &lt; 10) with lower than expected CTR (&lt; 3%).
                                                            </p>
                                                            {selectedDimensions.includes("date") && (
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                                                    Aggregated across dates
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => downloadCsv(ctrOpportunityData, `ctr_opportunities_${selectedProperty}.csv`)}
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
                                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Query</th>
                                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Pos.</th>
                                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Impr.</th>
                                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">CTR</th>
                                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Clicks</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                                            {ctrOpportunityData.slice(0, 100).map((row, i) => (
                                                                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                                    <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{row.keys[selectedDimensions.indexOf("query")]}</td>
                                                                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{row.position.toFixed(1)}</td>
                                                                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{row.impressions.toLocaleString()}</td>
                                                                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{(row.ctr * 100).toFixed(2)}%</td>
                                                                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{row.clicks}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}

                                        {/* Period over Period Tab */}
                                        {/* Period over Period Tab */}
                                        {(activeTab === "pop" || activeTab === "yoy") && (
                                            <div className="space-y-6">
                                                {!comparisonData && (
                                                    <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border-2 border-dashed border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center text-center">
                                                        <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-4">
                                                            <RefreshCw className="w-8 h-8 text-blue-500 animate-spin-slow" />
                                                        </div>
                                                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Comparison Data Needed</h3>
                                                        <p className="text-gray-500 dark:text-gray-400 max-w-md mb-6">
                                                            To view {activeTab === "pop" ? "Period over Period" : "Year over Year"} insights, we need to fetch data for the comparison period.
                                                        </p>
                                                        <button
                                                            onClick={() => {
                                                                const type = activeTab === "pop" ? "previous_period" : "previous_year";
                                                                setCompareMode(true);
                                                                setCompareType(type);
                                                                setTimeout(() => handleFetchData(), 100);
                                                            }}
                                                            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg hover:shadow-xl hover:bg-blue-700 transition-all flex items-center mx-auto"
                                                        >
                                                            <Zap className="w-4 h-4 mr-2" />
                                                            Fetch Comparison Data
                                                        </button>
                                                    </div>
                                                )}

                                                {popAnalysis && (
                                                    <>
                                                        {/* Comparison Trend Chart */}
                                                        {comparisonTrendData && selectedDimensions.includes("date") && (
                                                            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                                                                <div className="flex justify-between items-center mb-6">
                                                                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider flex items-center">
                                                                        <TrendingDown className="w-4 h-4 mr-2 text-blue-500" />
                                                                        {activeTab === "pop" ? "PoP" : "YoY"} {popMetric === "clicks" ? "Click" : "Impression"} Trend Comparison
                                                                    </h3>
                                                                    <div className="flex bg-gray-100 dark:bg-gray-700 p-0.5 rounded-lg">
                                                                        <button
                                                                            onClick={() => setPopMetric("clicks")}
                                                                            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${popMetric === "clicks" ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm" : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"}`}
                                                                        >
                                                                            Clicks
                                                                        </button>
                                                                        <button
                                                                            onClick={() => setPopMetric("impressions")}
                                                                            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${popMetric === "impressions" ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm" : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"}`}
                                                                        >
                                                                            Impressions
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                                <div className="h-[300px] w-full">
                                                                    <ResponsiveContainer width="100%" height="100%">
                                                                        <LineChart data={comparisonTrendData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.1} />
                                                                            <XAxis dataKey="day" label={{ value: 'Day of Period', position: 'insideBottom', offset: -5 }} stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
                                                                            <YAxis stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
                                                                            <Tooltip
                                                                                content={({ active, payload }) => {
                                                                                    if (!active || !payload || !payload.length) return null;
                                                                                    const data = payload[0].payload;
                                                                                    return (
                                                                                        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
                                                                                            <p className="font-semibold text-gray-900 dark:text-white mb-2">Day {data.day}</p>
                                                                                            <div className="space-y-1">
                                                                                                <p className="text-xs text-blue-600 font-medium">Current ({data.currentDate}): {popMetric === "clicks" ? data.currentClicks.toLocaleString() : data.currentImpr.toLocaleString()} {popMetric === "clicks" ? "Clicks" : "Impr"}</p>
                                                                                                <p className="text-xs text-gray-400 font-medium">Comparison ({data.prevDate}): {popMetric === "clicks" ? data.prevClicks.toLocaleString() : data.prevImpr.toLocaleString()} {popMetric === "clicks" ? "Clicks" : "Impr"}</p>
                                                                                            </div>
                                                                                        </div>
                                                                                    );
                                                                                }}
                                                                            />
                                                                            <Legend />
                                                                            <Line type="monotone" dataKey={popMetric === "clicks" ? "currentClicks" : "currentImpr"} name="Current Period" stroke="#3b82f6" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                                                                            <Line type="monotone" dataKey={popMetric === "clicks" ? "prevClicks" : "prevImpr"} name="Previous Period" stroke="#9ca3af" strokeWidth={2} strokeDasharray="5 5" dot={false} activeDot={{ r: 4 }} />
                                                                        </LineChart>
                                                                    </ResponsiveContainer>
                                                                </div>
                                                            </div>
                                                        )}

                                                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                                                            <div className="flex justify-between items-center mb-6">
                                                                <div>
                                                                    <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
                                                                        <Zap className="w-5 h-5 mr-2 text-yellow-500" />
                                                                        {activeTab === "pop" ? "Winners & Losers (PoP)" : "Year-over-Year Comparison (YoY)"}
                                                                    </h2>
                                                                    <p className="text-gray-500 dark:text-gray-400 text-sm">
                                                                        {compareMode && activeComparison?.compare
                                                                            ? `Comparing ${activeComparison.current.start} - ${activeComparison.current.end} vs ${activeComparison.compare.start} - ${activeComparison.compare.end}`
                                                                            : "Comparison mode is disabled. Enable it in the settings above to see data."}
                                                                    </p>
                                                                </div>
                                                                <div className="flex gap-2">
                                                                    {compareMode && ((activeTab === "yoy" && compareType !== "previous_year") || (activeTab === "pop" && compareType !== "previous_period")) && (
                                                                        <button
                                                                            onClick={() => {
                                                                                setCompareType(activeTab === "yoy" ? "previous_year" : "previous_period");
                                                                                setTimeout(() => handleFetchData(), 100);
                                                                            }}
                                                                            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                                                                        >
                                                                            <RefreshCw className="h-4 w-4 mr-2 animate-spin-slow" />
                                                                            Sync & Fetch {activeTab === "yoy" ? "YoY" : "PoP"}
                                                                        </button>
                                                                    )}
                                                                    <button
                                                                        onClick={() => downloadCsv(popAnalysis, `${activeTab}_analysis_${selectedProperty}.csv`)}
                                                                        className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                                                                    >
                                                                        <Download className="h-4 w-4 mr-2" />
                                                                        Download CSV
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            <div className="overflow-x-auto border rounded-lg border-gray-200 dark:border-gray-700">
                                                                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                                                    <thead className="bg-gray-50 dark:bg-gray-900/30">
                                                                        <tr>
                                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{selectedDimensions.filter(d => d !== 'date').join(' / ')}</th>
                                                                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" colSpan={2}>Clicks</th>
                                                                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" colSpan={2}>Impressions</th>
                                                                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" colSpan={2}>Position</th>
                                                                        </tr>
                                                                        <tr>
                                                                            <th className="px-6 py-1"></th>
                                                                            <th className="px-3 py-1 text-center text-[10px] text-gray-400 uppercase">Actual</th>
                                                                            <th className="px-3 py-1 text-center text-[10px] text-gray-400 uppercase">%</th>
                                                                            <th className="px-3 py-1 text-center text-[10px] text-gray-400 uppercase">Actual</th>
                                                                            <th className="px-3 py-1 text-center text-[10px] text-gray-400 uppercase">%</th>
                                                                            <th className="px-3 py-1 text-center text-[10px] text-gray-400 uppercase">Actual</th>
                                                                            <th className="px-3 py-1 text-center text-[10px] text-gray-400 uppercase">%</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                                                        {popAnalysis.slice(0, 100).map((row, i) => (
                                                                            <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                                                <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white truncate max-w-[300px]" title={row.key}>{row.key}</td>
                                                                                <td className={`px-3 py-4 text-sm text-center font-semibold ${row.clicks.diff > 0 ? "text-green-600" : row.clicks.diff < 0 ? "text-red-600" : "text-gray-500"}`}>
                                                                                    {row.clicks.diff > 0 ? "+" : ""}{row.clicks.diff.toLocaleString()}
                                                                                    <div className="text-[10px] text-gray-400 font-normal">({row.clicks.prev.toLocaleString()} → {row.clicks.current.toLocaleString()})</div>
                                                                                </td>
                                                                                <td className="px-3 py-4 text-center">
                                                                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${row.clicks.pcent > 0 ? "bg-green-100 text-green-800" : row.clicks.pcent < 0 ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-800"}`}>
                                                                                        {row.clicks.pcent.toFixed(1)}%
                                                                                    </span>
                                                                                </td>
                                                                                <td className={`px-3 py-4 text-sm text-center font-semibold ${row.impressions.diff > 0 ? "text-green-600" : row.impressions.diff < 0 ? "text-red-600" : "text-gray-500"}`}>
                                                                                    {row.impressions.diff > 0 ? "+" : ""}{row.impressions.diff.toLocaleString()}
                                                                                    <div className="text-[10px] text-gray-400 font-normal">({row.impressions.prev.toLocaleString()} → {row.impressions.current.toLocaleString()})</div>
                                                                                </td>
                                                                                <td className="px-3 py-4 text-center">
                                                                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${row.impressions.pcent > 0 ? "bg-green-100 text-green-800" : row.impressions.pcent < 0 ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-800"}`}>
                                                                                        {row.impressions.pcent.toFixed(1)}%
                                                                                    </span>
                                                                                </td>
                                                                                <td className={`px-3 py-4 text-sm text-center font-semibold ${row.position.diff > 0 ? "text-green-600" : row.position.diff < 0 ? "text-red-600" : "text-gray-500"}`}>
                                                                                    {row.position.diff > 0 ? "+" : ""}{row.position.diff.toFixed(1)}
                                                                                    <div className="text-[10px] text-gray-400 font-normal">({row.position.prev.toFixed(1)} → {row.position.current.toFixed(1)})</div>
                                                                                </td>
                                                                                <td className="px-3 py-4 text-center">
                                                                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${row.position.pcent > 0 ? "bg-green-100 text-green-800" : row.position.pcent < 0 ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-800"}`}>
                                                                                        {row.position.pcent.toFixed(1)}%
                                                                                    </span>
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        )}

                                        {/* Intent Tab */}
                                        {activeTab === "intent" && intentAnalysis && (
                                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                                                <div className="flex justify-between items-center mb-6">
                                                    <div>
                                                        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
                                                            <Brain className="w-5 h-5 mr-2 text-purple-500" />
                                                            Intent Clustering
                                                        </h2>
                                                        <p className="text-gray-500 dark:text-gray-400 text-sm">
                                                            Queries grouped by search intent using keyword pattern matching.
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                                                    <div className="h-[300px]">
                                                        <ResponsiveContainer width="100%" height="100%">
                                                            <PieChart>
                                                                <Pie
                                                                    data={intentAnalysis}
                                                                    dataKey="clicks"
                                                                    nameKey="intent"
                                                                    cx="50%"
                                                                    cy="50%"
                                                                    outerRadius={80}
                                                                    label={(entry: any) => `${entry.intent}: ${entry.clicks}`}
                                                                >
                                                                    {intentAnalysis.map((entry, index) => (
                                                                        <Cell key={`cell-${index}`} fill={[
                                                                            "#3b82f6", // transactional - blue
                                                                            "#22c55e", // informational - green
                                                                            "#f59e0b", // commercial - amber
                                                                            "#8b5cf6", // navigational - violet
                                                                            "#94a3b8"  // other - slate
                                                                        ][index % 5]} />
                                                                    ))}
                                                                </Pie>
                                                                <Tooltip />
                                                                <Legend />
                                                            </PieChart>
                                                        </ResponsiveContainer>
                                                    </div>
                                                    <div className="flex flex-col justify-center">
                                                        <div className="space-y-4">
                                                            {intentAnalysis.map((item, idx) => (
                                                                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                                                                    <div className="flex items-center">
                                                                        <div className="w-3 h-3 rounded-full mr-2" style={{
                                                                            backgroundColor: [
                                                                                "#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6", "#94a3b8"
                                                                            ][idx % 5]
                                                                        }} />
                                                                        <span className="font-medium text-gray-900 dark:text-white">{item.intent}</span>
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <span className="text-sm font-bold text-gray-900 dark:text-white">{item.clicks.toLocaleString()} Clicks</span>
                                                                        <p className="text-[10px] text-gray-500">{item.queryCount} queries • Avg Pos: {item.avgPos.toFixed(1)}</p>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Decay Tab */}
                                        {activeTab === "decay" && decayAnalysis && (
                                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                                                <div className="flex justify-between items-center mb-6">
                                                    <div>
                                                        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
                                                            <TrendingDown className="w-5 h-5 mr-2 text-red-500" />
                                                            Content Decay Alerts
                                                        </h2>
                                                        <div className="flex items-center gap-4 mt-1">
                                                            <p className="text-gray-500 dark:text-gray-400 text-sm">
                                                                Pages seeing the largest drops in clicks and impressions PoP.
                                                            </p>
                                                            <div className="flex bg-gray-100 dark:bg-gray-700 p-0.5 rounded-lg border border-gray-200 dark:border-gray-600">
                                                                <button
                                                                    onClick={() => setDecayFilter("all")}
                                                                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${decayFilter === "all" ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm" : "text-gray-500 hover:text-gray-700 dark:text-gray-400"}`}
                                                                >
                                                                    All
                                                                </button>
                                                                <button
                                                                    onClick={() => setDecayFilter("high_risk")}
                                                                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${decayFilter === "high_risk" ? "bg-red-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-700 dark:text-gray-400"}`}
                                                                >
                                                                    High Risk Only
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => downloadCsv(decayAnalysis, `decay_analysis_${selectedProperty}.csv`)}
                                                        className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                                                    >
                                                        <Download className="h-4 w-4 mr-2" />
                                                        Download CSV
                                                    </button>

                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                    {decayAnalysis
                                                        .filter(item => decayFilter === "all" || item.severity === 'high')
                                                        .slice(0, 24).map((item, i) => (
                                                            <div key={i} className={`p-4 rounded-xl border ${item.severity === 'high' ? 'bg-red-50 border-red-100 dark:bg-red-900/10 dark:border-red-900/30' : 'bg-orange-50 border-orange-100 dark:bg-orange-900/10 dark:border-orange-900/30'}`}>
                                                                <div className="flex justify-between items-start mb-2">
                                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${item.severity === 'high' ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'}`}>
                                                                        {item.severity} Risk
                                                                    </span>
                                                                </div>
                                                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate mb-3" title={item.page}>
                                                                    {item.page}
                                                                </p>
                                                                <div className="flex justify-between items-end">
                                                                    <div>
                                                                        <p className="text-lg font-bold text-gray-900 dark:text-white">{item.clickDiff.toLocaleString()}</p>
                                                                        <p className="text-[10px] text-gray-500 uppercase tracking-wider">Click Loss</p>
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <p className="text-sm font-bold text-red-600">{item.clickPcent.toFixed(1)}%</p>
                                                                        <p className="text-[10px] text-gray-500 uppercase tracking-wider">Click Drop</p>
                                                                    </div>
                                                                </div>
                                                                <div className="mt-3 pt-3 border-t border-gray-200/50 dark:border-gray-700/50 flex justify-between items-end">
                                                                    <div>
                                                                        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{item.imprDiff.toLocaleString()}</p>
                                                                        <p className="text-[10px] text-gray-500 uppercase tracking-wider">Impr loss</p>
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <p className="text-sm font-semibold text-orange-600">{item.imprPcent.toFixed(1)}%</p>
                                                                        <p className="text-[10px] text-gray-500 uppercase tracking-wider">Impr drop</p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </main>
            </div >
        </ThemeProvider >
    );
}
