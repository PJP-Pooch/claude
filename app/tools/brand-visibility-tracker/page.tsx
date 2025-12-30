
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
    sources?: { title?: string; url?: string; domain?: string; source_name?: string }[];
    annotations?: { title?: string; url?: string; domain?: string; source_name?: string }[];
    fan_out_queries?: string[];
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

const getCategoryColor = (category: string) => {
    if (category === "Your Brand") return "#3b82f6"; // blue-500
    if (category === "Competitor") return "#f87171"; // red-400
    return "#94a3b8"; // slate-400
};

const HighlightText = ({ text, targets }: { text: string, targets: string[] }) => {
    if (!targets.length || !text) return <>{text || "No text content available."}</>;

    // Filter out empty targets and escape for regex
    const sortedTargets = targets
        .filter(t => t.trim().length > 0)
        .sort((a, b) => b.length - a.length); // Match longer strings first

    if (sortedTargets.length === 0) return <>{text}</>;

    const pattern = sortedTargets
        .map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('|');

    const regex = new RegExp(`(${pattern})`, 'gi');
    const parts = text.split(regex);

    return (
        <>
            {parts.map((part, i) =>
                regex.test(part) ? (
                    <mark key={i} className="bg-yellow-200 dark:bg-yellow-800/60 text-gray-900 dark:text-white px-0.5 rounded font-bold border-b border-yellow-400 dark:border-yellow-600 transition-colors">
                        {part}
                    </mark>
                ) : (
                    part
                )
            )}
        </>
    );
};


export default function BrandVisibilityPage() {
    const [prompts, setPrompts] = useState("");
    const [targetBrands, setTargetBrands] = useState("");
    const [competitorBrands, setCompetitorBrands] = useState("");
    const [location, setLocation] = useState("United States");
    const [selectedModels, setSelectedModels] = useState<string[]>(["chat_gpt"]);
    const [apiLogin, setApiLogin] = useState("");
    const [apiPassword, setApiPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [data, setData] = useState<Record<string, ApiResponse> | null>(null);
    const [error, setError] = useState("");

    const availableModels = [
        { id: "chat_gpt", name: "ChatGPT" },
        { id: "gemini", name: "Google Gemini" },
        { id: "claude", name: "Anthropic Claude" },
        { id: "perplexity", name: "Perplexity" }
    ];

    const toggleModel = (id: string) => {
        setSelectedModels(prev =>
            prev.includes(id)
                ? prev.filter(m => m !== id)
                : [...prev, id]
        );
    };

    const handleAnalyze = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setData(null);

        if (selectedModels.length === 0) {
            setError("Please select at least one AI model.");
            return;
        }

        const promptList = prompts.split('\n').filter(p => p.trim().length > 0);
        if (promptList.length === 0) {
            setError("Please enter at least one prompt.");
            return;
        }

        setLoading(true);

        try {
            const promises = selectedModels.map(async (modelId) => {
                const res = await fetch("/api/brand-visibility", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        prompts: promptList,
                        location,
                        model: modelId,
                        targetBrands,
                        competitorBrands,
                        login: apiLogin || undefined,
                        password: apiPassword || undefined
                    })
                });

                if (!res.ok) {
                    const errData = await res.json();
                    throw new Error(errData.error || `Failed to analyze with ${modelId}`);
                }

                return { modelId, data: await res.json() as ApiResponse };
            });

            const results = await Promise.all(promises);
            const dataMap: Record<string, ApiResponse> = {};
            results.forEach(r => {
                dataMap[r.modelId] = r.data;
            });

            setData(dataMap);

        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setLoading(false);
        }
    };

    // Prepare data for charts (Aggregate across all models)
    const getChartData = () => {
        if (!data) return [];

        // Aggregate counts from all models
        const aggregatedCounts: Record<string, number> = {};

        const categoriesMap: Record<string, string> = {};

        Object.entries(data).forEach(([_, modelData]) => {
            Object.entries(modelData.aggregates.brand_counts).forEach(([brand, count]) => {
                aggregatedCounts[brand] = (aggregatedCounts[brand] || 0) + count;
                if (!categoriesMap[brand] || categoriesMap[brand] === "Other") {
                    categoriesMap[brand] = modelData.aggregates.brand_categories[brand] || "Other";
                }
            });
        });

        return Object.entries(aggregatedCounts)
            .map(([name, value]) => ({
                name,
                value,
                category: categoriesMap[name] || "Other"
            }))
            .sort((a, b) => b.value - a.value);
    };

    const downloadCSV = () => {
        if (!data) return;

        // Collate all unique brands
        const allBrands = new Set<string>();
        const brandCategories: Record<string, string> = {};
        const brandUrls: Record<string, Set<string>> = {};

        // Metrics per model
        const modelMentions: Record<string, Record<string, number>> = {}; // brand -> model -> count

        Object.entries(data).forEach(([modelId, modelData]) => {
            Object.entries(modelData.aggregates.brand_counts).forEach(([brand, count]) => {
                allBrands.add(brand);
                brandCategories[brand] = modelData.aggregates.brand_categories[brand] || brandCategories[brand] || "Unknown";

                if (!modelMentions[brand]) modelMentions[brand] = {};
                modelMentions[brand][modelId] = count;

                const urls = modelData.aggregates.associated_urls[brand];
                if (urls) {
                    if (!brandUrls[brand]) brandUrls[brand] = new Set();
                    const set = brandUrls[brand] as Set<string>;
                    urls.forEach(u => set.add(u));
                }
            });
        });

        const headers = ["Brand Name", "Category", ...selectedModels.map(m => `${availableModels.find(am => am.id === m)?.name || m} Mentions`), "Total Mentions", "Associated URLs"];

        const rows = Array.from(allBrands).map(brand => {
            const total = selectedModels.reduce((acc, m) => acc + (modelMentions[brand]?.[m] || 0), 0);
            const urls = Array.from(brandUrls[brand] || []).join("; ");

            return [
                brand,
                brandCategories[brand] || "Unknown",
                ...selectedModels.map(m => (modelMentions[brand]?.[m] || 0).toString()),
                total.toString(),
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
        a.download = `brand-visibility-comparison.csv`;
        a.click();
    };

    const allTrackingBrands = [
        ...targetBrands.toLowerCase().split(',').map(b => b.trim()).filter(b => b),
        ...competitorBrands.toLowerCase().split(',').map(b => b.trim()).filter(b => b)
    ];

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
                            Analyze & Compare brand visibility across AI models.
                            Select multiple models to side-by-side comparison.
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
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                Your Brands (Target)
                                            </label>
                                            <input
                                                type="text"
                                                value={targetBrands}
                                                onChange={(e) => setTargetBrands(e.target.value)}
                                                className="block w-full rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500 p-3"
                                                placeholder="e.g. MyBrand"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                Competitor Brands
                                            </label>
                                            <input
                                                type="text"
                                                value={competitorBrands}
                                                onChange={(e) => setCompetitorBrands(e.target.value)}
                                                className="block w-full rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500 p-3"
                                                placeholder="e.g. Rival1, Rival2"
                                            />
                                        </div>
                                    </div>
                                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                        Target brands are tracked vs competitors based on text mentions.
                                    </p>
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

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            AI Models (Select to Compare)
                                        </label>
                                        <div className="grid grid-cols-2 gap-3">
                                            {availableModels.map((m) => (
                                                <div
                                                    key={m.id}
                                                    onClick={() => toggleModel(m.id)}
                                                    className={`cursor-pointer border rounded-lg p-3 flex items-center space-x-3 transition-colors ${selectedModels.includes(m.id)
                                                        ? 'bg-blue-50 border-blue-500 dark:bg-blue-900/20 dark:border-blue-400'
                                                        : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'
                                                        }`}
                                                >
                                                    <div className={`w-5 h-5 rounded border flex items-center justify-center ${selectedModels.includes(m.id)
                                                        ? 'bg-blue-600 border-blue-600'
                                                        : 'border-gray-300 bg-white dark:bg-gray-700'
                                                        }`}>
                                                        {selectedModels.includes(m.id) && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                                                    </div>
                                                    <span className="text-sm font-medium text-gray-900 dark:text-white">{m.name}</span>
                                                </div>
                                            ))}
                                        </div>
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
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Net Reach</p>
                                    {(() => {
                                        const totalResponses = Object.values(data).reduce((acc, m) => acc + m.results.length, 0);
                                        const responsesWithUs = Object.values(data).reduce((acc, m) => {
                                            return acc + m.results.filter(r =>
                                                r.brand_entities?.some(e => e.category === "Your Brand")
                                            ).length;
                                        }, 0);
                                        const reachPct = totalResponses > 0 ? ((responsesWithUs / totalResponses) * 100).toFixed(0) : 0;
                                        return (
                                            <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
                                                {reachPct}%
                                            </p>
                                        );
                                    })()}
                                </div>
                                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Share of Voice</p>
                                    {(() => {
                                        const totalMentions = chartData.reduce((acc, d) => acc + d.value, 0);
                                        const usMentions = chartData
                                            .filter(d => d.category === "Your Brand")
                                            .reduce((acc, d) => acc + d.value, 0);
                                        const sov = totalMentions > 0 ? ((usMentions / totalMentions) * 100).toFixed(1) : 0;
                                        return (
                                            <p className="mt-2 text-3xl font-bold text-blue-600 dark:text-blue-400">
                                                {sov}%
                                            </p>
                                        );
                                    })()}
                                </div>
                                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Top Competitor</p>
                                    {(() => {
                                        const competitors = chartData.filter(d => d.category === "Competitor");
                                        const topComp = competitors.length > 0 ? competitors[0] : null;
                                        return (
                                            <p className="mt-2 text-xl font-bold text-gray-900 dark:text-white truncate">
                                                {topComp ? topComp.name : "None Found"}
                                            </p>
                                        );
                                    })()}
                                </div>
                                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Citations</p>
                                    <p className="mt-2 text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                                        {chartData.reduce((acc, d) => acc + d.value, 0)}
                                    </p>
                                </div>
                            </div>

                            {/* Charts */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Pie Chart - Share of Voice */}
                                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm min-h-[400px]">
                                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-6">Aggregated Share of Voice</h3>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <PieChart>
                                            <Pie
                                                data={chartData}
                                                cx="50%"
                                                cy="50%"
                                                labelLine={false}
                                                label={({ cx, cy, midAngle, outerRadius, name, percent }: any) => {
                                                    if (percent < 0.05) return null;
                                                    const RADIAN = Math.PI / 180;
                                                    const radius = outerRadius * 1.2;
                                                    const x = cx + radius * Math.cos(-midAngle * RADIAN);
                                                    const y = cy + radius * Math.sin(-midAngle * RADIAN);
                                                    return (
                                                        <text x={x} y={y} fill="#9ca3af" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={11} fontWeight="600">
                                                            {`${name} ${(percent * 100).toFixed(0)}%`}
                                                        </text>
                                                    );
                                                }}
                                                outerRadius={100}
                                                fill="#8884d8"
                                                dataKey="value"
                                            >
                                                {chartData.map((entry: any, index: number) => (
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
                                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-6">Top Brands (Aggregate)</h3>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart
                                            data={chartData.slice(0, 10)}
                                            layout="vertical"
                                            margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                                            <YAxis
                                                dataKey="name"
                                                type="category"
                                                width={100}
                                                tick={{ fill: '#9ca3af', fontSize: 12 }}
                                            />
                                            <RechartsTooltip cursor={{ fill: 'transparent' }} />
                                            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                                {chartData.slice(0, 10).map((entry: any, index: number) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Data Table */}
                            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">Detailed Brand Comparison</h3>
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
                                                {selectedModels.map(modelKey => (
                                                    <th key={modelKey} scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider bg-gray-100 dark:bg-gray-600">
                                                        {availableModels.find(m => m.id === modelKey)?.name}
                                                    </th>
                                                ))}
                                                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                                                    Total Mentions
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                            {chartData.map((item, idx: number) => {
                                                const isTarget = isTargetBrand(item.name);

                                                // We need to look up data for this brand across all models
                                                // Category can be taken from any model that found it
                                                let category = "Unknown";

                                                const modelCounts = selectedModels.map(m => {
                                                    const modelData = data[m];
                                                    const count = modelData?.aggregates.brand_counts[item.name] || 0;
                                                    // Update category if we find a more specific one (and haven't found one yet or it's unknown)
                                                    if (category === "Unknown" && modelData?.aggregates.brand_categories[item.name]) {
                                                        category = modelData.aggregates.brand_categories[item.name] || "Unknown";
                                                    }
                                                    return count;
                                                });


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
                                                            {category}
                                                        </td>
                                                        {modelCounts.map((count, i) => (
                                                            <td key={i} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-medium">
                                                                {count > 0 ? count : "-"}
                                                            </td>
                                                        ))}
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white">
                                                            {item.value}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Analysis Details (Side-by-Side Snippets) */}
                            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">Analysis Details (Side-by-Side)</h3>
                                </div>
                                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                                    {/* We iterate prompts from the first model's result, assuming all models processed the same prompts in same order */}
                                    {Object.values(data)[0]?.results.map((_, promptIdx) => {
                                        const promptText = Object.values(data)[0]?.results[promptIdx]?.prompt || "Unknown Prompt";

                                        return (
                                            <div key={promptIdx} className="p-6">
                                                <h4 className="font-medium text-lg text-gray-900 dark:text-gray-100 mb-4 pb-2 border-b dark:border-gray-700">
                                                    Q: {promptText}
                                                </h4>

                                                <div className={`grid gap-6 ${selectedModels.length > 1 ? 'grid-cols-1 xl:grid-cols-2' : 'grid-cols-1'}`}>
                                                    {selectedModels.map(modelKey => {
                                                        const result = data[modelKey]?.results[promptIdx];
                                                        const modelName = availableModels.find(m => m.id === modelKey)?.name;

                                                        if (!result) return null;

                                                        return (
                                                            <div key={modelKey} className="flex flex-col h-full bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                                                                <div className="flex items-center justify-between mb-3">
                                                                    <span className="font-bold text-gray-700 dark:text-gray-300 flex items-center">
                                                                        {modelName}
                                                                    </span>
                                                                    <span className={`px-2 py-0.5 text-xs rounded-full ${result.status === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                                        {result.status}
                                                                    </span>
                                                                </div>

                                                                {/* Brands */}
                                                                <div className="mb-3">
                                                                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Brands Found</span>
                                                                    <div className="mt-1">
                                                                        {result.brand_entities && result.brand_entities.length > 0 ? (
                                                                            <div className="flex flex-wrap gap-1">
                                                                                {result.brand_entities.map((e, idx) => (
                                                                                    <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
                                                                                        {e.title}
                                                                                    </span>
                                                                                ))}
                                                                            </div>
                                                                        ) : (
                                                                            <span className="text-sm text-gray-400 italic">No brands detected</span>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                {/* Fan-out */}
                                                                {result.fan_out_queries && result.fan_out_queries.length > 0 && (
                                                                    <div className="mb-3">
                                                                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Related Queries</span>
                                                                        <div className="mt-1 flex flex-wrap gap-1">
                                                                            {result.fan_out_queries.slice(0, 3).map((q, i) => (
                                                                                <span key={i} className="inline-flex px-2 py-0.5 rounded text-xs bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300 border border-purple-100 dark:border-purple-800">
                                                                                    {q}
                                                                                </span>
                                                                            ))}
                                                                            {result.fan_out_queries.length > 3 && (
                                                                                <span className="text-xs text-gray-400 self-center">+{result.fan_out_queries.length - 3} more</span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* Sources */}
                                                                {result.sources && result.sources.length > 0 && (
                                                                    <div className="mb-3">
                                                                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Sources ({result.sources.length})</span>
                                                                        <ul className="mt-1 space-y-1 text-xs text-gray-400">
                                                                            {result.sources.map((s, i) => (
                                                                                <li key={i} className="truncate">
                                                                                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                                                                                        {s.domain || s.title || "View Source"}
                                                                                    </a>
                                                                                </li>
                                                                            ))}
                                                                        </ul>
                                                                    </div>
                                                                )}

                                                                {/* Annotations */}
                                                                {result.annotations && result.annotations.length > 0 && (
                                                                    <div className="mb-3">
                                                                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Annotations ({result.annotations.length})</span>
                                                                        <ul className="mt-1 space-y-1 text-xs text-gray-400">
                                                                            {result.annotations.map((s, i) => (
                                                                                <li key={i} className="truncate">
                                                                                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                                                                                        {s.title || s.domain || "View Annotation"}
                                                                                    </a>
                                                                                </li>
                                                                            ))}
                                                                        </ul>
                                                                    </div>
                                                                )}

                                                                {/* Snippet */}
                                                                <div className="mt-auto pt-3 border-t border-gray-200 dark:border-gray-700">
                                                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Response Snippet</p>
                                                                    <div className="bg-white dark:bg-gray-800 p-2 rounded border border-gray-100 dark:border-gray-700 max-h-60 overflow-y-auto">
                                                                        <p className="text-xs text-gray-600 dark:text-gray-300 font-mono whitespace-pre-wrap leading-relaxed">
                                                                            <HighlightText
                                                                                text={result.text_snippet || ""}
                                                                                targets={allTrackingBrands}
                                                                            />
                                                                        </p>
                                                                    </div>
                                                                </div>

                                                                {result.error && (
                                                                    <p className="mt-2 text-xs text-red-600 font-semibold">{result.error}</p>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                        </div>
                    )}
                </div>
            </div>
        </ThemeProvider>
    );
}
