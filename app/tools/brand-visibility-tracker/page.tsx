
"use client";

import { useState } from "react";
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import ThemeToggle from '@/components/ThemeToggle';
import { ThemeProvider } from '@/components/ThemeProvider';
import { Loader2, Download, Search, AlertCircle, CheckCircle } from "lucide-react";

// Types
type BrandEntity = {
    title: string;
    category?: string;
    markdown?: string;
    urls?: string[];
};

type PromptResult = {
    prompt: string;
    status: "success" | "error";
    error?: string;
    brand_entities?: BrandEntity[];
    text_snippet?: string;
};

type AggregateData = {
    total_prompts: number;
    brand_counts: Record<string, number>;
    brand_categories: Record<string, string>;
    associated_urls: Record<string, string[]>;
};

type ApiResponse = {
    results: PromptResult[];
    aggregates: AggregateData;
};

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#8dd1e1', '#a4de6c', '#d0ed57'];

export default function BrandVisibilityPage() {
    const [prompts, setPrompts] = useState("");
    const [targetBrands, setTargetBrands] = useState("");
    const [location, setLocation] = useState("United States");
    const [apiLogin, setApiLogin] = useState("");
    const [apiPassword, setApiPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [data, setData] = useState<ApiResponse | null>(null);
    const [error, setError] = useState("");

    const handleAnalyze = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setData(null);

        const promptList = prompts.split('\n').filter(p => p.trim().length > 0);
        if (promptList.length === 0) {
            setError("Please enter at least one prompt.");
            return;
        }

        setLoading(true);

        try {
            const res = await fetch("/api/brand-visibility", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompts: promptList,
                    location,
                    login: apiLogin || undefined,
                    password: apiPassword || undefined
                })
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || "Failed to analyze prompts");
            }

            const resultData = await res.json();
            setData(resultData);

        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setLoading(false);
        }
    };

    // Prepare data for charts
    const getChartData = () => {
        if (!data) return [];
        const counts = data.aggregates.brand_counts;
        return Object.entries(counts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    };

    const downloadCSV = () => {
        if (!data) return;
        const currentData = data;

        const headers = ["Brand Name", "Category", "Mentions", "Share of Voice %", "Associated URLs"];
        const totalMentions = Object.values(currentData.aggregates.brand_counts).reduce((a, b) => a + b, 0);

        const rows = Object.keys(currentData.aggregates.brand_counts).map(brand => {
            const count = currentData.aggregates.brand_counts[brand] || 0;
            const sov = totalMentions > 0 ? ((count / totalMentions) * 100).toFixed(2) : "0";
            const urls = currentData.aggregates.associated_urls[brand]?.join("; ") || "";

            return [
                brand,
                currentData.aggregates.brand_categories[brand] || "Unknown",
                count.toString(),
                sov,
                urls
            ];
        });

        const csv = [
            headers.join(","),
            ...rows.map(row => row.map(cell => `"${(cell || "").replace(/"/g, '""')}"`).join(",")),
        ].join("\n");

        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `brand-visibility-report.csv`;
        a.click();
    };

    const targetBrandSet = new Set(
        targetBrands.toLowerCase().split(',').map(b => b.trim()).filter(b => b)
    );

    const isTargetBrand = (brandName: string) => {
        if (targetBrandSet.size === 0) return false;
        return targetBrandSet.has(brandName.toLowerCase());
    };

    const chartData = getChartData();
    const totalMentions = chartData.reduce((acc, item) => acc + item.value, 0);

    return (
        <ThemeProvider>
            <ThemeToggle />
            <div className="min-h-screen bg-gray-100 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8 transition-colors">
                <div className="max-w-7xl mx-auto space-y-8">

                    {/* Header */}
                    <div className="text-center md:text-left">
                        <a
                            href="/"
                            className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors mb-4"
                        >
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            <span className="font-medium">Back to Tools</span>
                        </a>
                        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                            Brand Visibility Tracker
                        </h1>
                        <p className="text-lg text-gray-600 dark:text-gray-300 max-w-3xl">
                            Analyze brand mentions and share of voice in AI-generated responses (ChatGPT).
                            Identify competitors and authority sources across your topic clusters.
                        </p>
                    </div>

                    {/* Input Section */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                        <form onSubmit={handleAnalyze} className="space-y-6">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Prompts / Topic Questions (One per line)
                                        </label>
                                        <textarea
                                            value={prompts}
                                            onChange={(e) => setPrompts(e.target.value)}
                                            rows={8}
                                            className="block w-full rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500 p-3"
                                            placeholder={`What are the best running shoes?\nTop CRM for small business\nAlternatives to Salesforce`}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Target Brands (Optional, comma separated)
                                        </label>
                                        <input
                                            type="text"
                                            value={targetBrands}
                                            onChange={(e) => setTargetBrands(e.target.value)}
                                            className="block w-full rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500 p-3"
                                            placeholder="e.g. Nike, Adidas, Salesforce"
                                        />
                                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                            Used to highlight specific brands in the results table.
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Location
                                        </label>
                                        <select
                                            value={location}
                                            onChange={(e) => setLocation(e.target.value)}
                                            className="block w-full rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500 p-3"
                                        >
                                            <option value="United States">United States</option>
                                            <option value="United Kingdom">United Kingdom</option>
                                            <option value="Canada">Canada</option>
                                            <option value="Australia">Australia</option>
                                            <option value="Germany">Germany</option>
                                            <option value="France">France</option>
                                        </select>
                                    </div>

                                    {/* Advanced / Credentials */}
                                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                                        <button
                                            type="button"
                                            onClick={() => setShowAdvanced(!showAdvanced)}
                                            className="flex items-center text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800"
                                        >
                                            {showAdvanced ? 'Hide API Credentials' : 'Show API Credentials (if not in env)'}
                                        </button>

                                        {showAdvanced && (
                                            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <input
                                                    type="text"
                                                    placeholder="Login"
                                                    value={apiLogin}
                                                    onChange={(e) => setApiLogin(e.target.value)}
                                                    className="block w-full rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white p-2 text-sm"
                                                />
                                                <input
                                                    type="password"
                                                    placeholder="Password"
                                                    value={apiPassword}
                                                    onChange={(e) => setApiPassword(e.target.value)}
                                                    className="block w-full rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white p-2 text-sm"
                                                />
                                            </div>
                                        )}
                                    </div>

                                    <div className="pt-4">
                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="w-full flex justify-center items-center py-4 px-6 border border-transparent rounded-lg shadow-sm text-base font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            {loading ? (
                                                <>
                                                    <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5" />
                                                    Analyzing Prompts...
                                                </>
                                            ) : (
                                                <>
                                                    <Search className="-ml-1 mr-3 h-5 w-5" />
                                                    Start Analysis
                                                </>
                                            )}
                                        </button>
                                    </div>

                                    {error && (
                                        <div className="rounded-md bg-red-50 dark:bg-red-900/30 p-4">
                                            <div className="flex">
                                                <div className="flex-shrink-0">
                                                    <AlertCircle className="h-5 w-5 text-red-400" aria-hidden="true" />
                                                </div>
                                                <div className="ml-3">
                                                    <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                                                        Error
                                                    </h3>
                                                    <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                                                        {error}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </form>
                    </div>

                    {/* Results Section */}
                    {data && (
                        <div className="space-y-8 animate-in fade-in duration-500">

                            <div className="flex items-center justify-between">
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Analysis Results</h2>
                                <button
                                    onClick={downloadCSV}
                                    className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                >
                                    <Download className="-ml-1 mr-2 h-4 w-4" />
                                    Export CSV
                                </button>
                            </div>

                            {/* KPI Metrics */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Prompts Analyzed</p>
                                    <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{data.aggregates.total_prompts}</p>
                                </div>
                                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Unique Brands Found</p>
                                    <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{Object.keys(data.aggregates.brand_counts).length}</p>
                                </div>
                                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Top Brand (Most Mentions)</p>
                                    {/* Extract topBrand variable and use it */}
                                    {(() => {
                                        const topBrand = chartData[0];
                                        return (
                                            <>
                                                <p className="mt-2 text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                                                    {topBrand?.name || "N/A"}
                                                </p>
                                                {topBrand && (
                                                    <p className="text-sm text-gray-500 mt-1">
                                                        {topBrand.value} mentions (Share of Voice: {totalMentions > 0 ? ((topBrand.value / totalMentions) * 100).toFixed(1) : 0}%)
                                                    </p>
                                                )}
                                            </>
                                        );
                                    })()}
                                </div>
                            </div>

                            {/* Charts */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Pie Chart - Share of Voice */}
                                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm min-h-[400px]">
                                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-6">Share of Voice (Brand Mentions)</h3>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <PieChart>
                                            <Pie
                                                data={chartData}
                                                cx="50%"
                                                cy="50%"
                                                labelLine={false}
                                                label={({ name, percent }: { name?: string; percent?: number }) => (name && percent && percent > 0.05) ? `${name} ${(percent * 100).toFixed(0)}%` : ''}
                                                outerRadius={100}
                                                fill="#8884d8"
                                                dataKey="value"
                                            >
                                                {chartData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <RechartsTooltip />
                                            <Legend />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>

                                {/* Bar Chart */}
                                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm min-h-[400px]">
                                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-6">Top Brands by Mentions</h3>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart
                                            data={chartData.slice(0, 10)}
                                            layout="vertical"
                                            margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis type="number" />
                                            <YAxis dataKey="name" type="category" width={100} />
                                            <RechartsTooltip />
                                            <Bar dataKey="value" fill="#3b82f6" name="Mentions" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Data Table */}
                            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">Detailed Brand Report</h3>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                        <thead className="bg-gray-50 dark:bg-gray-700">
                                            <tr>
                                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                                    Brand Name
                                                </th>
                                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                                    Category
                                                </th>
                                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                                    Mentions
                                                </th>
                                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                                    Share of Voice
                                                </th>
                                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                                    Associated URLs/Sources
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                            {chartData.map((item, idx) => {
                                                const isTarget = isTargetBrand(item.name);
                                                const sov = totalMentions > 0 ? ((item.value / totalMentions) * 100).toFixed(2) : "0";
                                                const urls = data!.aggregates.associated_urls[item.name];
                                                const category = data!.aggregates.brand_categories[item.name];

                                                return (
                                                    <tr key={idx} className={isTarget ? "bg-blue-50 dark:bg-blue-900/20" : ""}>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                                            {item.name}
                                                            {isTarget && (
                                                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100">
                                                                    Target
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                            {category || "N/A"}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                            {item.value}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                            {sov}%
                                                        </td>
                                                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                                                            {urls && urls.length > 0 ? (
                                                                <span title={urls.join('\n')}>
                                                                    {urls.length} sources (hover to view)
                                                                </span>
                                                            ) : (
                                                                <span className="text-gray-400">-</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Prompt Details (Raw Response) */}
                            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">Analysis Details</h3>
                                </div>
                                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                                    {data.results.map((result, idx) => (
                                        <div key={idx} className="p-6">
                                            <div className="flex items-center justify-between mb-2">
                                                <h4 className="font-medium text-gray-900 dark:text-gray-100">{result.prompt}</h4>
                                                <span className={`px-2 py-1 text-xs rounded-full ${result.status === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                    {result.status}
                                                </span>
                                            </div>
                                            {result.brand_entities && result.brand_entities.length > 0 ? (
                                                <div className="mb-2">
                                                    <span className="text-sm text-gray-500">Brands found: </span>
                                                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                                                        {result.brand_entities.map(e => e.title).join(", ")}
                                                    </span>
                                                </div>
                                            ) : (
                                                <div className="mb-2 text-sm text-yellow-600 dark:text-yellow-400">
                                                    No brands detected in this response.
                                                </div>
                                            )}

                                            <div className="mt-4 bg-gray-50 dark:bg-gray-900 p-4 rounded-md">
                                                <p className="text-xs uppercase text-gray-500 mb-1 font-semibold">ChatGPT Response Snippet</p>
                                                <p className="text-sm text-gray-700 dark:text-gray-300 font-mono whitespace-pre-wrap">
                                                    {result.text_snippet || "No text content available."}
                                                </p>
                                                {result.error && (
                                                    <p className="mt-2 text-sm text-red-600 font-semibold">Error: {result.error}</p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                        </div>
                    )}
                </div>
            </div>
        </ThemeProvider>
    );
}
