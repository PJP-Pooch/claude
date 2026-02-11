"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import Papa from "papaparse";
import {
    TrendingUp,
    TrendingDown,
    DollarSign,
    ShoppingCart,
    Target,
    Users,
    Download,
    Loader2,
    AlertCircle,
    ExternalLink,
    Award,
    Upload,
    ArrowLeft,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    Search,
} from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { ThemeProvider } from "@/components/ThemeProvider";
import PriceCorrelationChart from "./PriceCorrelationChart";

// Date preset type
type DatePreset = "last7" | "last28" | "last90" | "mtd" | "custom";

// Product performance data structure
interface ShoppingProduct {
    productId: string;
    title: string;
    brand: string;
    category: string;
    subCategory?: string;
    price: number;
    currency: string;

    // Performance metrics
    clicks: number;
    impressions: number;
    ctr: number;
    conversions: number;
    conversionValue: number;
    cost: number;
    roas: number;
    cpa: number;

    // Competitive intelligence
    competitiveData?: {
        yourRank: number | null;
        competitorCount: number;
        lowestPrice: number;
        highestPrice: number;
        avgPrice: number;
        pricePosition: string;
        priceGap: number;
        topCompetitor: {
            name: string;
            price: number;
            domain: string;
        } | null;
    } | null;
}

// Date presets
const DATE_PRESETS: { value: DatePreset; label: string }[] = [
    { value: "last7", label: "Last 7 Days" },
    { value: "last28", label: "Last 28 Days" },
    { value: "last90", label: "Last 90 Days" },
    { value: "mtd", label: "Month to Date" },
    { value: "custom", label: "Custom Range" },
];

// Calculate date range from preset
function getDateRangeFromPreset(preset: DatePreset): { start: Date; end: Date } {
    const end = new Date();
    const start = new Date();

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
            start.setDate(1);
            break;
        case "custom":
            start.setDate(end.getDate() - 28);
            break;
    }

    return { start, end };
}

// Format date for API
function formatDateForApi(date: Date): string {
    return date.toISOString().split("T")[0]!;
}

// Format currency
function formatCurrency(value: number, currency?: string): string {
    return new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: currency || "GBP",
    }).format(value);
}

// Format number
function formatNumber(value: number): string {
    return new Intl.NumberFormat("en-GB").format(Math.round(value));
}

// Format percent
function formatPercent(value: number): string {
    return `${value.toFixed(2)}%`;
}

// KPI Card Component
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
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    {title}
                </h3>
                <Icon className="h-5 w-5 text-gray-400" />
            </div>
            <div className="flex items-baseline gap-2">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {value}
                </p>
                {trend && (
                    <span
                        className={`flex items-center text-sm ${trend === "up"
                            ? "text-green-600"
                            : trend === "down"
                                ? "text-red-600"
                                : "text-gray-600"
                            }`}
                    >
                        {trend === "up" ? (
                            <TrendingUp className="h-4 w-4" />
                        ) : trend === "down" ? (
                            <TrendingDown className="h-4 w-4" />
                        ) : null}
                    </span>
                )}
            </div>
            {subtitle && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {subtitle}
                </p>
            )}
        </div>
    );
}

export default function ShoppingAdsPerformancePage() {
    const { data: session, status } = useSession();

    // State
    const [merchantAccounts, setMerchantAccounts] = useState<any[]>([]);
    const [selectedMerchant, setSelectedMerchant] = useState<string>("");
    const [datePreset, setDatePreset] = useState<DatePreset>("last28");
    const [startDate, setStartDate] = useState<string>("");
    const [endDate, setEndDate] = useState<string>("");
    const [products, setProducts] = useState<ShoppingProduct[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [includeCompetitiveIntel, setIncludeCompetitiveIntel] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [sortField, setSortField] = useState<keyof ShoppingProduct>("clicks");
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
    const [loadingCompetitiveData, setLoadingCompetitiveData] = useState<Set<string>>(new Set());

    // CSV Upload Logic
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadStatus, setUploadStatus] = useState<{ message: string; type: 'success' | 'error' | '' }>({ message: '', type: '' });

    const cleanCurrency = (val: string | number): number => {
        if (typeof val === 'number') return val;
        if (!val) return 0;
        return parseFloat(val.toString().replace(/[£$,]/g, '').trim()) || 0;
    };

    const cleanNumber = (val: string | number): number => {
        if (typeof val === 'number') return val;
        if (!val) return 0;
        return parseFloat(val.toString().replace(/[,]/g, '').trim()) || 0;
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setUploadStatus({ message: 'Parsing CSV...', type: '' });

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                try {
                    const data = results.data as Record<string, any>[];
                    if (!data || data.length === 0) {
                        setUploadStatus({ message: 'CSV appears empty or invalid.', type: 'error' });
                        return;
                    }

                    // Map product IDs to metrics
                    const metricsMap = new Map<string, { clicks: number; impressions: number; cost: number; conversions: number; conversionValue: number }>();
                    let matchedCount = 0;

                    // console.log('CSV Headers:', Object.keys(data[0]));

                    data.forEach(row => {
                        // Try various column names for ID
                        const rawId = row['Item ID'] || row['Offer ID'] || row['Product ID'] || row['id'] || row['item_id'];
                        if (!rawId) return;

                        // Normalize ID: remove channel prefixes (e.g. "online:en:GB:12345" -> "12345")
                        const normalizedId = rawId.split(':').pop()?.toLowerCase() || '';

                        const clicks = cleanNumber(row['Clicks'] || row['clicks']);
                        const impressions = cleanNumber(row['Impressions'] || row['Impr.'] || row['impressions']);
                        const cost = cleanCurrency(row['Cost'] || row['cost']);
                        const conversions = cleanNumber(row['Conversions'] || row['conversions'] || row['Conv.'] || row['All conv.']);
                        const conversionValue = cleanCurrency(row['Conv. value'] || row['Conversion value'] || row['Total conv. value'] || row['All conv. value'] || row['conversion_value']);

                        metricsMap.set(rawId.toLowerCase(), { clicks, impressions, cost, conversions, conversionValue });
                        metricsMap.set(normalizedId, { clicks, impressions, cost, conversions, conversionValue });
                    });

                    // Update products state with new metrics
                    setProducts(prevProducts => {
                        let matchedCount = 0;
                        let createdCount = 0;

                        // First, try to update existing products
                        const updatedProducts = prevProducts.map(p => {
                            const pId = p.productId.toLowerCase();
                            // Try exact match or normalized match
                            const metrics = metricsMap.get(pId) || metricsMap.get(pId.split(':').pop() || '');

                            if (metrics) {
                                matchedCount++;
                                const cost = metrics.cost;
                                const conversionValue = metrics.conversionValue;

                                return {
                                    ...p,
                                    clicks: metrics.clicks,
                                    impressions: metrics.impressions,
                                    cost: cost,
                                    conversions: metrics.conversions,
                                    conversionValue: conversionValue,
                                    ctr: metrics.impressions > 0 ? (metrics.clicks / metrics.impressions) * 100 : 0,
                                    roas: cost > 0 ? conversionValue / cost : 0,
                                    cpa: metrics.conversions > 0 ? cost / metrics.conversions : 0,
                                };
                            }
                            return p;
                        });

                        // If no products exist, create products from CSV data
                        if (prevProducts.length === 0) {
                            const newProducts: ShoppingProduct[] = [];

                            data.forEach(row => {
                                const rawId = row['Item ID'] || row['Offer ID'] || row['Product ID'] || row['id'] || row['item_id'];
                                if (!rawId) return;

                                const title = row['Product title'] || row['Product'] || row['Item'] || rawId;
                                const clicks = cleanNumber(row['Clicks'] || row['clicks']);
                                const impressions = cleanNumber(row['Impressions'] || row['Impr.'] || row['impressions']);
                                const cost = cleanCurrency(row['Cost'] || row['cost']);
                                const conversions = cleanNumber(row['Conversions'] || row['conversions'] || row['Conv.'] || row['All conv.']);
                                const conversionValue = cleanCurrency(row['Conv. value'] || row['Conversion value'] || row['Total conv. value'] || row['All conv. value'] || row['conversion_value']);

                                newProducts.push({
                                    productId: rawId,
                                    title: title,
                                    brand: row['Brand'] || 'Unknown',
                                    category: row['Category'] || row['Product type'] || 'Uncategorized',
                                    price: cleanCurrency(row['Price'] || 0),
                                    currency: 'GBP',
                                    clicks: clicks,
                                    impressions: impressions,
                                    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
                                    conversions: conversions,
                                    conversionValue: conversionValue,
                                    cost: cost,
                                    roas: cost > 0 ? conversionValue / cost : 0,
                                    cpa: conversions > 0 ? cost / conversions : 0,
                                    competitiveData: null
                                });
                                createdCount++;
                            });

                            setUploadStatus({
                                message: `Successfully created ${createdCount} products from Google Ads CSV!`,
                                type: 'success'
                            });

                            return newProducts;
                        }

                        // Return updated products if we had existing products
                        setUploadStatus({
                            message: `Successfully merged Google Ads data for ${matchedCount} products!`,
                            type: 'success'
                        });

                        return updatedProducts;
                    });

                    // Clear status after 5 seconds
                    setTimeout(() => setUploadStatus({ message: '', type: '' }), 5000);

                } catch (err) {
                    console.error('CSV Parse Error:', err);
                    setUploadStatus({ message: 'Failed to parse CSV. Check console.', type: 'error' });
                }
            },
            error: (error) => {
                console.error('Papa Parse Error:', error);
                setUploadStatus({ message: `Error parsing file: ${error.message}`, type: 'error' });
            }
        });

        // Reset input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Initialize dates
    useEffect(() => {
        const { start, end } = getDateRangeFromPreset(datePreset);
        setStartDate(formatDateForApi(start));
        setEndDate(formatDateForApi(end));
    }, [datePreset]);

    // Fetch Merchant Center accounts
    useEffect(() => {
        if (status === "authenticated") {
            fetchMerchantAccounts();
        }
    }, [status]);

    const fetchMerchantAccounts = async () => {
        try {
            const response = await fetch("/api/merchant/accounts");
            const data = await response.json();

            if (data.error) {
                console.error("Merchant Center error:", data.error);
                setError(data.error);
                return;
            }

            setMerchantAccounts(data.accounts || []);
            if (data.accounts?.length > 0) {
                setSelectedMerchant(data.accounts[0].id);
            }
        } catch (err) {
            console.error("Failed to fetch Merchant Center accounts:", err);
            setError("Failed to load Merchant Center accounts");
        }
    };

    // Fetch Shopping Ads performance
    const handleFetchData = async () => {
        if (!selectedMerchant) {
            setError("Please select a Merchant Center account");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const response = await fetch("/api/merchant/shopping-performance", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    merchantId: selectedMerchant,
                    startDate,
                    endDate,
                    includeCompetitiveIntel: false, // Competitive data is now fetched per-product on-demand
                }),
            });

            const data = await response.json();

            if (data.error) {
                setError(data.error);
                return;
            }

            setProducts(data.products || []);
        } catch (err) {
            console.error("Failed to fetch Shopping Ads data:", err);
            setError("Failed to fetch Shopping Ads performance data");
        } finally {
            setLoading(false);
        }
    };

    // Filter and sort products
    const filteredProducts = useMemo(() => {
        let filtered = products;

        // Search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(
                (p) =>
                    p.title.toLowerCase().includes(query) ||
                    p.brand.toLowerCase().includes(query) ||
                    p.category.toLowerCase().includes(query)
            );
        }

        // Sort
        filtered.sort((a, b) => {
            const aVal = a[sortField];
            const bVal = b[sortField];

            if (typeof aVal === "number" && typeof bVal === "number") {
                return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
            }

            return 0;
        });

        return filtered;
    }, [products, searchQuery, sortField, sortDirection]);

    // Check if any products have competitive data
    const hasCompetitiveData = useMemo(() => {
        return products.some(p => p.competitiveData !== null);
    }, [products]);

    // Calculate KPIs
    const kpis = useMemo(() => {
        const totalProducts = products.length;
        const totalClicks = products.reduce((sum, p) => sum + p.clicks, 0);
        const totalCost = products.reduce((sum, p) => sum + p.cost, 0);
        const totalConversions = products.reduce((sum, p) => sum + p.conversions, 0);
        const totalConversionValue = products.reduce((sum, p) => sum + p.conversionValue, 0);
        const avgRoas = totalCost > 0 ? totalConversionValue / totalCost : 0;
        const avgCpa = totalConversions > 0 ? totalCost / totalConversions : 0;

        return {
            totalProducts,
            totalClicks,
            totalCost,
            totalConversions,
            avgRoas,
            avgCpa,
        };
    }, [products]);

    // Handle sort
    const handleSort = (field: keyof ShoppingProduct) => {
        if (sortField === field) {
            setSortDirection(sortDirection === "asc" ? "desc" : "asc");
        } else {
            setSortField(field);
            setSortDirection("desc");
        }
    };

    // Fetch competitive data for a single product
    const fetchCompetitiveDataForProduct = async (product: ShoppingProduct) => {
        const productId = product.productId;

        // Add to loading set
        setLoadingCompetitiveData(prev => new Set(prev).add(productId));

        try {
            const searchQuery = `${product.brand} ${product.title}`.substring(0, 100);

            const response = await fetch('/api/merchant/google-shopping/products', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    keyword: searchQuery,
                    location_code: 2826, // UK
                    language_code: 'en',
                    depth: 40,
                }),
            });

            if (response.ok) {
                const competitiveData = await response.json();
                const items = competitiveData.tasks?.[0]?.result?.[0]?.items || [];

                if (items.length > 0) {
                    // Find your product in the results
                    const yourRank = items.findIndex((item: any) =>
                        item.title?.toLowerCase().includes(product.title.toLowerCase().substring(0, 30))
                    ) + 1;

                    // Get competitor prices
                    const prices = items
                        .filter((item: any) => item.price)
                        .map((item: any) => item.price)
                        .sort((a: number, b: number) => a - b);

                    const lowestPrice = prices[0] || product.price;
                    const highestPrice = prices[prices.length - 1] || product.price;
                    const avgPrice = prices.length > 0
                        ? prices.reduce((sum: number, p: number) => sum + p, 0) / prices.length
                        : product.price;

                    // Determine price position
                    let pricePosition = 'Competitive';
                    if (product.price <= lowestPrice * 1.05) {
                        pricePosition = 'Cheapest';
                    } else if (product.price >= highestPrice * 0.95) {
                        pricePosition = 'Premium';
                    }

                    // Get top competitor
                    const topCompetitor = items[0];

                    const newCompetitiveData = {
                        yourRank: yourRank || null,
                        competitorCount: items.length,
                        lowestPrice,
                        highestPrice,
                        avgPrice,
                        pricePosition,
                        priceGap: product.price - lowestPrice,
                        topCompetitor: topCompetitor ? {
                            name: topCompetitor.seller_name || topCompetitor.shop_name,
                            price: topCompetitor.price,
                            domain: topCompetitor.domain,
                        } : null,
                    };

                    // Update the product in state
                    setProducts(prevProducts =>
                        prevProducts.map(p =>
                            p.productId === productId
                                ? { ...p, competitiveData: newCompetitiveData }
                                : p
                        )
                    );
                }
            } else {
                console.error('Failed to fetch competitive data:', await response.text());
            }
        } catch (error) {
            console.error(`Failed to fetch competitive data for ${product.title}:`, error);
        } finally {
            // Remove from loading set
            setLoadingCompetitiveData(prev => {
                const newSet = new Set(prev);
                newSet.delete(productId);
                return newSet;
            });
        }
    };

    // Export to CSV
    const handleExportCsv = () => {
        const headers = [
            "Product ID",
            "Title",
            "Brand",
            "Category",
            "Price",
            "Clicks",
            "Impressions",
            "CTR",
            "Conversions",
            "Conversion Value",
            "Cost",
            "ROAS",
            "CPA",
            "Your Rank",
            "Competitor Count",
            "Price Position",
            "Top Competitor",
            "Top Competitor Price",
        ];

        const rows = filteredProducts.map((p) => [
            p.productId,
            p.title,
            p.brand,
            p.category,
            p.price,
            p.clicks,
            p.impressions,
            p.ctr,
            p.conversions,
            p.conversionValue,
            p.cost,
            p.roas,
            p.cpa,
            p.competitiveData?.yourRank || "",
            p.competitiveData?.competitorCount || "",
            p.competitiveData?.pricePosition || "",
            p.competitiveData?.topCompetitor?.name || "",
            p.competitiveData?.topCompetitor?.price || "",
        ]);

        const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `shopping-ads-performance-${startDate}-to-${endDate}.csv`;
        a.click();
    };

    // Render
    if (status === "loading") {
        return (
            <ThemeProvider>
                <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
            </ThemeProvider>
        );
    }

    if (status === "unauthenticated") {
        return (
            <ThemeProvider>
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
                                        Connect your Google account to access Merchant Center and analyze your Shopping Ads performance.
                                    </p>
                                </div>

                                <button
                                    onClick={() => signIn("google", { callbackUrl: "/tools/shopping-ads-performance", prompt: "login consent" })}
                                    className="w-full flex items-center justify-center px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm hover:shadow-md group"
                                >
                                    <Image
                                        src="https://www.google.com/favicon.ico"
                                        alt="Google"
                                        width={20}
                                        height={20}
                                        className="mr-3 filter brightness-0 invert"
                                    />
                                    Sign in with Google
                                </button>
                                <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                                    We only request read-only access to your Merchant Center data.
                                </p>
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
                                    Shopping Ads Performance
                                </h1>
                                <p className="text-lg text-gray-600 dark:text-gray-300">
                                    Analyze your Shopping Ads performance and competitive intelligence.
                                </p>
                            </div>

                            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
                                <div className="mx-auto w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-6">
                                    <ShoppingCart className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                                </div>
                                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                                    Authentication Required
                                </h2>
                                <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                                    Please sign in using the sidebar on the left to access your Merchant Center account and start analyzing your Shopping Ads data.
                                </p>
                            </div>
                        </div>
                    </main>
                </div>
            </ThemeProvider>
        );
    }

    return (
        <ThemeProvider>
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
                {/* Header */}
                <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <Link
                                    href="/"
                                    className="text-blue-600 hover:text-blue-700 transition-colors"
                                >
                                    ← Back to Tools
                                </Link>
                                <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <ShoppingCart className="h-6 w-6" />
                                    Shopping Ads Performance
                                </h1>
                            </div>
                            <div className="flex items-center gap-4">
                                <ThemeToggle />
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-gray-600 dark:text-gray-400">
                                        {session?.user?.email}
                                    </span>
                                    <button
                                        onClick={() => signOut()}
                                        className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                                    >
                                        Sign out
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Main Content */}
                <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    {/* Configuration */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6 border border-gray-200 dark:border-gray-700">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                            Configuration
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            {/* Merchant Center Account */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Merchant Center Account
                                </label>
                                <select
                                    value={selectedMerchant}
                                    onChange={(e) => setSelectedMerchant(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                                >
                                    {merchantAccounts.length === 0 ? (
                                        <option>No accounts found</option>
                                    ) : (
                                        merchantAccounts.map((account) => (
                                            <option key={account.id} value={account.id}>
                                                {account.displayName}
                                            </option>
                                        ))
                                    )}
                                </select>
                            </div>

                            {/* Date Preset */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Date Range
                                </label>
                                <select
                                    value={datePreset}
                                    onChange={(e) => setDatePreset(e.target.value as DatePreset)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                                >
                                    {DATE_PRESETS.map((preset) => (
                                        <option key={preset.value} value={preset.value}>
                                            {preset.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Custom Date Range */}
                        {datePreset === "custom" && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Start Date
                                    </label>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        End Date
                                    </label>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="flex items-center gap-4">
                            <button
                                onClick={handleFetchData}
                                disabled={loading || !selectedMerchant}
                                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-6 rounded-lg transition-colors flex items-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Fetching Data...
                                    </>
                                ) : (
                                    "Fetch Data"
                                )}
                            </button>

                            {/* Hidden File Input */}
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                                accept=".csv"
                                className="hidden"
                            />

                            {/* Upload Button */}
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={products.length === 0}
                                className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-medium py-2 px-6 rounded-lg transition-colors flex items-center gap-2"
                                title={products.length === 0 ? "Fetch products first before uploading data" : "Upload Google Ads 'Shopping - Products' CSV to enrich data"}
                            >
                                <Upload className="h-4 w-4" />
                                Upload GAds CSV
                            </button>

                            {products.length > 0 && (
                                <button
                                    onClick={handleExportCsv}
                                    className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-6 rounded-lg transition-colors flex items-center gap-2"
                                >
                                    <Download className="h-4 w-4" />
                                    Export CSV
                                </button>
                            )}
                        </div>

                        {/* Upload Status */}
                        {uploadStatus.message && (
                            <div className={`mt-4 rounded-lg p-3 text-sm flex items-center gap-2 ${uploadStatus.type === 'error'
                                ? 'bg-red-50 text-red-700 border border-red-200'
                                : 'bg-green-50 text-green-700 border border-green-200'
                                }`}>
                                <AlertCircle className="h-4 w-4" />
                                {uploadStatus.message}
                            </div>
                        )}

                        {error && (
                            <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-2">
                                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                            </div>
                        )}
                    </div>

                    {/* KPIs */}
                    {products.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                            <KpiCard
                                title="Total Products"
                                value={formatNumber(kpis.totalProducts)}
                                icon={ShoppingCart}
                            />
                            <KpiCard
                                title="Total Clicks"
                                value={formatNumber(kpis.totalClicks)}
                                icon={Target}
                            />
                            <KpiCard
                                title="Avg ROAS"
                                value={`${kpis.avgRoas.toFixed(2)}x`}
                                subtitle={`${formatNumber(kpis.totalConversions)} conversions`}
                                icon={TrendingUp}
                            />
                            <KpiCard
                                title="Avg CPA"
                                value={formatCurrency(kpis.avgCpa)}
                                subtitle={`Total cost: ${formatCurrency(kpis.totalCost)}`}
                                icon={DollarSign}
                            />
                        </div>
                    )}

                    {/* Products Table & Analysis */}
                    {products.length > 0 && (
                        <>
                            {/* Analytics Charts */}
                            {includeCompetitiveIntel && (
                                <div className="mb-8">
                                    <PriceCorrelationChart products={filteredProducts} />
                                </div>
                            )}

                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
                                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                                    <div className="flex items-center justify-between">
                                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                            Product Performance
                                        </h2>
                                        <input
                                            type="text"
                                            placeholder="Search products..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 w-64"
                                        />
                                    </div>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="bg-gray-50 dark:bg-gray-700">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-24">
                                                    Actions
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600" onClick={() => handleSort("title")}>
                                                    <div className="flex items-center gap-1">
                                                        Product
                                                        {sortField === "title" ? (
                                                            sortDirection === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                                                        ) : (
                                                            <ArrowUpDown className="w-3 h-3 opacity-30" />
                                                        )}
                                                    </div>
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600" onClick={() => handleSort("price")}>
                                                    <div className="flex items-center gap-1">
                                                        Price
                                                        {sortField === "price" ? (
                                                            sortDirection === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                                                        ) : (
                                                            <ArrowUpDown className="w-3 h-3 opacity-30" />
                                                        )}
                                                    </div>
                                                </th>
                                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600" onClick={() => handleSort("clicks")}>
                                                    <div className="flex items-center justify-end gap-1">
                                                        Clicks
                                                        {sortField === "clicks" ? (
                                                            sortDirection === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                                                        ) : (
                                                            <ArrowUpDown className="w-3 h-3 opacity-30" />
                                                        )}
                                                    </div>
                                                </th>
                                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600" onClick={() => handleSort("impressions")}>
                                                    <div className="flex items-center justify-end gap-1">
                                                        Impr.
                                                        {sortField === "impressions" ? (
                                                            sortDirection === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                                                        ) : (
                                                            <ArrowUpDown className="w-3 h-3 opacity-30" />
                                                        )}
                                                    </div>
                                                </th>
                                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600" onClick={() => handleSort("ctr")}>
                                                    <div className="flex items-center justify-end gap-1">
                                                        CTR
                                                        {sortField === "ctr" ? (
                                                            sortDirection === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                                                        ) : (
                                                            <ArrowUpDown className="w-3 h-3 opacity-30" />
                                                        )}
                                                    </div>
                                                </th>
                                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600" onClick={() => handleSort("conversions")}>
                                                    <div className="flex items-center justify-end gap-1">
                                                        Conv.
                                                        {sortField === "conversions" ? (
                                                            sortDirection === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                                                        ) : (
                                                            <ArrowUpDown className="w-3 h-3 opacity-30" />
                                                        )}
                                                    </div>
                                                </th>
                                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600" onClick={() => handleSort("cost")}>
                                                    <div className="flex items-center justify-end gap-1">
                                                        Cost
                                                        {sortField === "cost" ? (
                                                            sortDirection === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                                                        ) : (
                                                            <ArrowUpDown className="w-3 h-3 opacity-30" />
                                                        )}
                                                    </div>
                                                </th>
                                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600" onClick={() => handleSort("roas")}>
                                                    <div className="flex items-center justify-end gap-1">
                                                        ROAS
                                                        {sortField === "roas" ? (
                                                            sortDirection === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                                                        ) : (
                                                            <ArrowUpDown className="w-3 h-3 opacity-30" />
                                                        )}
                                                    </div>
                                                </th>
                                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600" onClick={() => handleSort("cpa")}>
                                                    <div className="flex items-center justify-end gap-1">
                                                        CPA
                                                        {sortField === "cpa" ? (
                                                            sortDirection === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                                                        ) : (
                                                            <ArrowUpDown className="w-3 h-3 opacity-30" />
                                                        )}
                                                    </div>
                                                </th>
                                                {hasCompetitiveData && (
                                                    <>
                                                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                                            Rank
                                                        </th>
                                                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                                            Competitors
                                                        </th>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                                            Price Position
                                                        </th>
                                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                                            Price Gap
                                                        </th>
                                                    </>
                                                )}
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                            {filteredProducts.map((product) => (
                                                <tr key={product.productId} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                                    <td className="px-6 py-4">
                                                        {product.competitiveData ? (
                                                            <button
                                                                onClick={() => fetchCompetitiveDataForProduct(product)}
                                                                disabled={loadingCompetitiveData.has(product.productId)}
                                                                className="p-2 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors disabled:opacity-50"
                                                                title="Refresh competitive data"
                                                            >
                                                                {loadingCompetitiveData.has(product.productId) ? (
                                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                                ) : (
                                                                    <Search className="h-4 w-4" />
                                                                )}
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={() => fetchCompetitiveDataForProduct(product)}
                                                                disabled={loadingCompetitiveData.has(product.productId)}
                                                                className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors disabled:opacity-50"
                                                                title="Fetch competitive intelligence"
                                                            >
                                                                {loadingCompetitiveData.has(product.productId) ? (
                                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                                ) : (
                                                                    <Search className="h-4 w-4" />
                                                                )}
                                                            </button>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                                                            {product.title}
                                                        </div>
                                                        <div className="text-sm text-gray-500 dark:text-gray-400">
                                                            {product.brand} • {product.category}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                                                        {formatCurrency(product.price, product.currency)}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-right text-gray-900 dark:text-white">
                                                        {formatNumber(product.clicks)}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-right text-gray-900 dark:text-white">
                                                        {formatNumber(product.impressions)}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-right text-gray-900 dark:text-white">
                                                        {formatPercent(product.ctr)}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-right text-gray-900 dark:text-white">
                                                        {formatNumber(product.conversions)}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-right text-gray-900 dark:text-white">
                                                        {formatCurrency(product.cost, product.currency)}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-right">
                                                        <span className={`font-medium ${product.roas >= 3 ? 'text-green-600 dark:text-green-400' : product.roas >= 1.5 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
                                                            {product.roas.toFixed(2)}x
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-right text-gray-900 dark:text-white">
                                                        {formatCurrency(product.cpa, product.currency)}
                                                    </td>
                                                    {hasCompetitiveData && (
                                                        <>
                                                            <td className="px-6 py-4 text-sm text-center">
                                                                {product.competitiveData?.yourRank ? (
                                                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs font-medium">
                                                                        <Award className="h-3 w-3" />
                                                                        #{product.competitiveData.yourRank}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-gray-400">-</span>
                                                                )}
                                                            </td>
                                                            <td className="px-6 py-4 text-sm text-center text-gray-900 dark:text-white">
                                                                {product.competitiveData?.competitorCount || "-"}
                                                            </td>
                                                            <td className="px-6 py-4 text-sm">
                                                                {product.competitiveData?.pricePosition && (
                                                                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${product.competitiveData.pricePosition === 'Cheapest'
                                                                        ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                                                                        : product.competitiveData.pricePosition === 'Premium'
                                                                            ? 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200'
                                                                            : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                                                                        }`}>
                                                                        {product.competitiveData.pricePosition}
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="px-6 py-4 text-sm text-right">
                                                                {product.competitiveData?.priceGap !== undefined && (
                                                                    <span className={`font-medium ${product.competitiveData.priceGap > 0
                                                                        ? 'text-red-600 dark:text-red-400' // More expensive
                                                                        : 'text-green-600 dark:text-green-400' // Cheaper or equal
                                                                        }`}>
                                                                        {product.competitiveData.priceGap > 0 ? '+' : ''}
                                                                        {formatCurrency(product.competitiveData.priceGap, product.currency)}
                                                                    </span>
                                                                )}
                                                            </td>
                                                        </>
                                                    )}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {filteredProducts.length === 0 && (
                                    <div className="text-center py-12">
                                        <p className="text-gray-500 dark:text-gray-400">
                                            No products found matching your search
                                        </p>
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {/* Info Note about Paid vs Free Listings */}
                    {products.length > 0 && (
                        <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                            <div className="flex items-start gap-2">
                                <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                                <div className="text-sm text-blue-600 dark:text-blue-400">
                                    <p className="font-medium mb-1">Data Availability Note</p>
                                    <p>Cost and ROAS metrics are temporarily unavailable pending Google Ads API Developer Token approval (1-2 days). Currently showing Traffic (Clicks, Impressions, CTR) and Competitive Intelligence.</p>
                                    <p className="mt-2 text-xs opacity-75">This data shows <strong>paid Shopping Ads</strong> traffic. For <strong>free listings</strong> (organic Shopping), check the Merchant Center Free Listings report separately.</p>
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </ThemeProvider>
    );
}
