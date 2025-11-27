"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from "recharts";
import { Download, Loader2 } from "lucide-react";

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
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<GscRow[] | null>(null);
    const [queryAnalysis, setQueryAnalysis] = useState<QueryPositionRow[] | null>(
        null

    );
    const [error, setError] = useState("");

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
            // Find date index in dimensions. The API returns keys in order of requested dimensions.
            // But actually, GSC API returns keys array. We need to know which index corresponds to 'date'.
            // However, the prompt says "Parse row.date". The GSC API response structure puts dimension values in `keys` array.
            // We need to map dimensions to keys.
            // Let's assume the user selects dimensions in a way we can map.
            // Actually, standardizing: let's look for a date-like string in keys if we can, or rely on dimension order.
            // Better: The API response doesn't label keys. We must rely on the order we sent.
            // Wait, `selectedDimensions` is what we sent.

            const dateIndex = selectedDimensions.indexOf("date");
            if (dateIndex === -1) return;

            const dateStr = row.keys[dateIndex];
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

    const downloadCsv = (data: any[], filename: string) => {
        if (!data || data.length === 0) return;

        // Flatten GscRow keys for CSV
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

    if (status === "loading") {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
            </div>
        );
    }

    if (!session) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
                <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-md border border-gray-100">
                    <h1 className="text-2xl font-bold mb-4 text-gray-900">
                        Connect Search Console
                    </h1>
                    <p className="text-gray-600 mb-6">
                        Sign in with Google to access your Search Console data. We request
                        read-only access to fetch your analytics.
                    </p>
                    <button
                        onClick={() => signIn("google")}
                        className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center w-full"
                    >
                        Sign in with Google
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">
                        GSC Bulk Export & Query Insights
                    </h1>
                    <p className="text-gray-600 mt-2">
                        Export full Google Search Console data and analyze query positions.
                    </p>
                </div>
                <button
                    onClick={() => signOut()}
                    className="text-sm text-gray-500 hover:text-gray-700"
                >
                    Sign out
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                            Property
                        </label>
                        <select
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                        <label className="block text-sm font-medium text-gray-700">
                            Date Range
                        </label>
                        <select
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                                <label className="block text-sm font-medium text-gray-700">
                                    Start
                                </label>
                                <input
                                    type="date"
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                    value={customStartDate}
                                    onChange={(e) => setCustomStartDate(e.target.value)}
                                />
                            </div>
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-gray-700">
                                    End
                                </label>
                                <input
                                    type="date"
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                    value={customEndDate}
                                    onChange={(e) => setCustomEndDate(e.target.value)}
                                />
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                            Search Type
                        </label>
                        <select
                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
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
                        <label className="block text-sm font-medium text-gray-700">
                            Device
                        </label>
                        <select
                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
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
                        <label className="block text-sm font-medium text-gray-700">
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
                                            ? "bg-blue-100 text-blue-800 border-blue-200 border"
                                            : "bg-gray-100 text-gray-600 border-gray-200 border hover:bg-gray-200"
                                        }`}
                                >
                                    {dim}
                                </button>
                            ))}
                        </div>
                        {(!selectedDimensions.includes("query") ||
                            !selectedDimensions.includes("date")) && (
                                <p className="text-xs text-amber-600 mt-1">
                                    Select both &apos;query&apos; and &apos;date&apos; to enable Query Position Analysis.
                                </p>
                            )}
                    </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-gray-100">
                    <button
                        onClick={handleFetchData}
                        disabled={loading || !selectedProperty}
                        className={`flex items-center px-6 py-3 rounded-lg font-medium text-white transition-all ${loading || !selectedProperty
                                ? "bg-gray-400 cursor-not-allowed"
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
                <div className="bg-red-50 text-red-700 p-4 rounded-lg border border-red-200">
                    {error}
                </div>
            )}

            {data && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">Raw Data</h2>
                                <p className="text-gray-500 text-sm">
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
                        <div className="overflow-x-auto border rounded-lg">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        {selectedDimensions.map((dim) => (
                                            <th
                                                key={dim}
                                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                            >
                                                {dim}
                                            </th>
                                        ))}
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Clicks
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Imp.
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            CTR
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Pos
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {data.slice(0, 10).map((row, i) => (
                                        <tr key={i}>
                                            {row.keys &&
                                                row.keys.map((k, j) => (
                                                    <td
                                                        key={j}
                                                        className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 max-w-xs truncate"
                                                        title={k}
                                                    >
                                                        {k}
                                                    </td>
                                                ))}
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {row.clicks}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {row.impressions}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {(row.ctr * 100).toFixed(2)}%
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {row.position.toFixed(1)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {data.length > 10 && (
                                <div className="px-6 py-3 bg-gray-50 text-center text-sm text-gray-500 border-t">
                                    Showing first 10 rows of {data.length.toLocaleString()}
                                </div>
                            )}
                        </div>
                    </div>

                    {queryAnalysis && (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900">
                                        Query Position Analysis
                                    </h2>
                                    <p className="text-gray-500 text-sm">
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
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="month" />
                                        <YAxis />
                                        <Tooltip />
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

                            <div className="overflow-x-auto border rounded-lg">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Month
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Pos 1-3
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Pos 4-10
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Pos 11-20
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Pos 20+
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Total
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {queryAnalysis.map((row) => (
                                            <tr key={row.month}>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                    {row.month}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {row.positions_1_3}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {row.positions_4_10}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {row.positions_11_20}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {row.positions_20_plus}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
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
        </div>
    );
}
