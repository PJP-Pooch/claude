"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useState, useEffect, useMemo } from "react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Cell
} from "recharts";
import { Download, Loader2, Search, AlertCircle, Filter, ArrowLeft, RefreshCw, ShoppingBag, TrendingUp, TrendingDown, Minus } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { ThemeProvider } from "@/components/ThemeProvider";
import Link from "next/link";

type PriceCompetitivenessItem = {
    id: string;
    title: string;
    brand: string;
    productTypeL1?: string;
    productTypeL2?: string;
    countryCode: string;
    currencyCode: string;
    price: number;
    benchmarkPrice: number;
    diff: number;
    diffPct: number;
    pricePosition: 'Underpriced' | 'Competitive' | 'Overpriced';
};

export default function MerchantPriceCompetitivenessPage() {
    const { data: session, status } = useSession();
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<PriceCompetitivenessItem[] | null>(null);
    const [error, setError] = useState("");
    const [merchantAccountId, setMerchantAccountId] = useState("");

    // Filters
    const [countryFilter, setCountryFilter] = useState("all");
    const [productTypeFilter, setProductTypeFilter] = useState("");
    const [priceBucketFilter, setPriceBucketFilter] = useState("all");

    // Sorting & Pagination
    const [sortField, setSortField] = useState<keyof PriceCompetitivenessItem>("diffPct");
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 50;

    // Derived Data
    const uniqueCountries = useMemo(() => {
        if (!data) return [];
        return Array.from(new Set(data.map(item => item.countryCode))).sort();
    }, [data]);

    const stats = useMemo(() => {
        if (!data) return null;
        const total = data.length;
        const underpriced = data.filter(i => i.pricePosition === 'Underpriced').length;
        const competitive = data.filter(i => i.pricePosition === 'Competitive').length;
        const overpriced = data.filter(i => i.pricePosition === 'Overpriced').length;
        const avgDiff = data.reduce((acc, curr) => acc + curr.diffPct, 0) / total;

        return { total, underpriced, competitive, overpriced, avgDiff };
    }, [data]);

    const chartData = useMemo(() => {
        if (!stats) return [];
        return [
            { name: 'Underpriced', count: stats.underpriced, color: '#22c55e' },
            { name: 'Competitive', count: stats.competitive, color: '#3b82f6' },
            { name: 'Overpriced', count: stats.overpriced, color: '#ef4444' },
        ];
    }, [stats]);

    const filteredAndSortedData = useMemo(() => {
        if (!data) return [];

        // Note: Server-side filtering is already applied for major filters, 
        // but we can add client-side refinement if needed.

        return [...data].sort((a, b) => {
            const aValue = a[sortField];
            const bValue = b[sortField];

            if (typeof aValue === 'string' && typeof bValue === 'string') {
                return sortDirection === 'asc'
                    ? aValue.localeCompare(bValue)
                    : bValue.localeCompare(aValue);
            }

            if (typeof aValue === 'number' && typeof bValue === 'number') {
                return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
            }

            return 0;
        });
    }, [data, sortField, sortDirection]);

    const paginatedData = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredAndSortedData.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredAndSortedData, currentPage]);

    const totalPages = Math.ceil(filteredAndSortedData.length / itemsPerPage);

    const handleFetchData = async () => {
        if (!merchantAccountId.trim()) {
            setError("Please enter your Merchant Center Account ID");
            return;
        }

        setLoading(true);
        setError("");
        setData(null);

        try {
            const res = await fetch("/api/merchant/price-competitiveness", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    merchantAccountId: merchantAccountId.trim(),
                    countryCode: countryFilter,
                    productType: productTypeFilter,
                    priceBucket: priceBucketFilter
                }),
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || "Failed to fetch data");
            }

            const result = await res.json();
            setData(result.rows);
            setCurrentPage(1); // Reset to first page on new fetch
        } catch (err: any) {
            setError(err.message || "Failed to fetch data. Please try again.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const downloadCsv = () => {
        if (!data || data.length === 0) return;

        const headers = [
            "ID", "Title", "Brand", "Product Type L1", "Product Type L2",
            "Country", "Currency", "Our Price", "Benchmark Price",
            "Diff", "Diff %", "Position"
        ];

        const csvRows = data.map(row => [
            JSON.stringify(row.id),
            JSON.stringify(row.title),
            JSON.stringify(row.brand),
            JSON.stringify(row.productTypeL1 || ""),
            JSON.stringify(row.productTypeL2 || ""),
            row.countryCode,
            row.currencyCode,
            row.price,
            row.benchmarkPrice,
            row.diff,
            row.diffPct.toFixed(2),
            row.pricePosition
        ].join(","));

        const csvContent = [headers.join(","), ...csvRows].join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `merchant_price_competitiveness_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleSort = (field: keyof PriceCompetitivenessItem) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
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
            <div className="min-h-screen bg-gray-100 dark:bg-gray-900 transition-colors pb-12">
                {/* Header */}
                <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-20">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                        <div className="flex items-center">
                            <Link href="/" className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mr-4 transition-colors">
                                <ArrowLeft className="w-5 h-5" />
                            </Link>
                            <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
                                <ShoppingBag className="w-6 h-6 mr-2 text-blue-600 dark:text-blue-400" />
                                Merchant Center Price Competitiveness
                            </h1>
                        </div>
                        <div className="flex items-center space-x-4">
                            {!session ? (
                                <button
                                    onClick={() => signIn("google")}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                                >
                                    Sign In
                                </button>
                            ) : (
                                <div className="flex items-center space-x-3">
                                    <span className="text-sm text-gray-600 dark:text-gray-300 hidden sm:inline">
                                        {session.user?.email}
                                    </span>
                                    <button
                                        onClick={() => signOut()}
                                        className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-medium"
                                    >
                                        Sign Out
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    {!session ? (
                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center max-w-2xl mx-auto mt-12">
                            <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-6">
                                <ShoppingBag className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                                Authentication Required
                            </h2>
                            <p className="text-gray-600 dark:text-gray-300 mb-8">
                                Please sign in with your Google account to access Merchant Center data.
                                Ensure your account has access to the Merchant Center property you wish to analyze.
                            </p>
                            <button
                                onClick={() => signIn("google")}
                                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                            >
                                Sign In with Google
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {/* Controls Card */}
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                                {/* Merchant Account ID Input */}
                                <div className="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Merchant Center Account ID
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Enter your Merchant Center Account ID (e.g., 123456789)"
                                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={merchantAccountId}
                                        onChange={(e) => setMerchantAccountId(e.target.value)}
                                    />
                                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                        Find your Account ID in the <a href="https://merchants.google.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">Google Merchant Center</a> URL or settings.
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                            Country
                                        </label>
                                        <select
                                            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={countryFilter}
                                            onChange={(e) => setCountryFilter(e.target.value)}
                                        >
                                            <option value="all">All Countries</option>
                                            {uniqueCountries.map(c => (
                                                <option key={c} value={c}>{c}</option>
                                            ))}
                                            <option value="GB">United Kingdom (GB)</option>
                                            <option value="US">United States (US)</option>
                                            <option value="DE">Germany (DE)</option>
                                            <option value="FR">France (FR)</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                            Product Type
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="e.g. Dog Food"
                                            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={productTypeFilter}
                                            onChange={(e) => setProductTypeFilter(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                            Price Position
                                        </label>
                                        <select
                                            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={priceBucketFilter}
                                            onChange={(e) => setPriceBucketFilter(e.target.value)}
                                        >
                                            <option value="all">All Positions</option>
                                            <option value="Underpriced">Underpriced (≤ -10%)</option>
                                            <option value="Competitive">Competitive (±10%)</option>
                                            <option value="Overpriced">Overpriced (&gt; +10%)</option>
                                        </select>
                                    </div>
                                    <div className="flex items-end">
                                        <button
                                            onClick={handleFetchData}
                                            disabled={loading}
                                            className={`w-full flex items-center justify-center px-4 py-2 rounded-lg font-medium text-white transition-all ${loading
                                                    ? "bg-gray-400 cursor-not-allowed"
                                                    : "bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg"
                                                }`}
                                        >
                                            {loading ? (
                                                <>
                                                    <Loader2 className="animate-spin mr-2 h-5 w-5" />
                                                    Fetching...
                                                </>
                                            ) : (
                                                <>
                                                    <RefreshCw className="mr-2 h-5 w-5" />
                                                    Fetch Data
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {error && (
                                <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 p-4 rounded-lg border border-red-200 dark:border-red-800 flex items-center">
                                    <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0" />
                                    {error}
                                </div>
                            )}

                            {data && stats && (
                                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    {/* Stats Grid */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                                            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Total Products</h3>
                                            <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
                                            <p className="text-xs text-gray-500 mt-1">with benchmark data</p>
                                        </div>
                                        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                                            <h3 className="text-sm font-medium text-green-600 dark:text-green-400 mb-1 flex items-center">
                                                <TrendingDown className="w-4 h-4 mr-1" /> Underpriced
                                            </h3>
                                            <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.underpriced}</p>
                                            <p className="text-xs text-gray-500 mt-1">
                                                {((stats.underpriced / stats.total) * 100).toFixed(1)}% of total
                                            </p>
                                        </div>
                                        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                                            <h3 className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-1 flex items-center">
                                                <Minus className="w-4 h-4 mr-1" /> Competitive
                                            </h3>
                                            <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.competitive}</p>
                                            <p className="text-xs text-gray-500 mt-1">
                                                {((stats.competitive / stats.total) * 100).toFixed(1)}% of total
                                            </p>
                                        </div>
                                        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                                            <h3 className="text-sm font-medium text-red-600 dark:text-red-400 mb-1 flex items-center">
                                                <TrendingUp className="w-4 h-4 mr-1" /> Overpriced
                                            </h3>
                                            <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.overpriced}</p>
                                            <p className="text-xs text-gray-500 mt-1">
                                                {((stats.overpriced / stats.total) * 100).toFixed(1)}% of total
                                            </p>
                                        </div>
                                    </div>

                                    {/* Chart Section */}
                                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Price Position Distribution</h3>
                                        <div className="h-[300px] w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.1} />
                                                    <XAxis dataKey="name" stroke="#9CA3AF" />
                                                    <YAxis stroke="#9CA3AF" />
                                                    <Tooltip
                                                        contentStyle={{
                                                            backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                                            borderRadius: '8px',
                                                            border: 'none',
                                                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                                                        }}
                                                    />
                                                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                                                        {chartData.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                                        ))}
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    {/* Data Table */}
                                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                                        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Product Details</h3>
                                            <button
                                                onClick={downloadCsv}
                                                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                                            >
                                                <Download className="h-4 w-4 mr-2" />
                                                Download CSV
                                            </button>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                                <thead className="bg-gray-50 dark:bg-gray-900/30">
                                                    <tr>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Product</th>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Country</th>
                                                        <th
                                                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
                                                            onClick={() => handleSort('price')}
                                                        >
                                                            Our Price
                                                        </th>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Benchmark</th>
                                                        <th
                                                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
                                                            onClick={() => handleSort('diffPct')}
                                                        >
                                                            Diff %
                                                        </th>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Position</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                                    {paginatedData.map((item) => (
                                                        <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                            <td className="px-6 py-4">
                                                                <div className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-xs" title={item.title}>
                                                                    {item.title}
                                                                </div>
                                                                <div className="text-xs text-gray-500 dark:text-gray-400">{item.brand}</div>
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                                {item.productTypeL1}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                                {item.countryCode}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white font-medium">
                                                                {item.price.toFixed(2)} {item.currencyCode}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                                {item.benchmarkPrice.toFixed(2)} {item.currencyCode}
                                                            </td>
                                                            <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${item.diffPct > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                                                                }`}>
                                                                {item.diffPct > 0 ? '+' : ''}{item.diffPct.toFixed(1)}%
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap">
                                                                <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${item.pricePosition === 'Underpriced'
                                                                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                                                        : item.pricePosition === 'Overpriced'
                                                                            ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                                                                            : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                                                                    }`}>
                                                                    {item.pricePosition}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        {/* Pagination */}
                                        <div className="bg-gray-50 dark:bg-gray-900/30 px-6 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                                            <div className="text-sm text-gray-500 dark:text-gray-400">
                                                Page {currentPage} of {totalPages}
                                            </div>
                                            <div className="flex space-x-2">
                                                <button
                                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                                    disabled={currentPage === 1}
                                                    className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                                >
                                                    Previous
                                                </button>
                                                <button
                                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                                    disabled={currentPage === totalPages}
                                                    className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                                >
                                                    Next
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </main>
            </div>
        </ThemeProvider>
    );
}
