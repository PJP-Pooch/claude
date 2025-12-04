"use client";

import { useState } from "react";
import { Search, Loader2, Download, ExternalLink, AlertCircle } from "lucide-react";
import ThemeToggle from '@/components/ThemeToggle';
import { ThemeProvider } from '@/components/ThemeProvider';

type ProductResult = {
    type?: string;
    position?: string;
    rank_group?: number;
    rank_absolute?: number;
    title?: string;
    description?: string;
    product_id?: string;
    price?: number | null;
    currency?: string;
    product_rating?: {
        type?: string;
        position?: string;
        rating_type?: string;
        value?: number;
        votes_count?: number;
        rating_max?: number;
    };
    shop_name?: string;
    seller_name?: string;
    domain?: string;
    url?: string;
    product_images?: any[];
    xpath?: string;
    available?: boolean;
    shopping_url?: string;
};


type SellerInfo = {
    type?: string;
    rank_group?: number;
    rank_absolute?: number;
    domain?: string;
    title?: string;
    seller_name?: string;
    url?: string;
    details?: string;
    base_price?: number | null;
    price?: number | null;
    currency?: string;
    shipping_price?: number | null;
    total_price?: number | null;
};

export default function ProductPriceMonitorPage() {
    const [keyword, setKeyword] = useState("");
    const [location, setLocation] = useState("United Kingdom");
    const [depth, setDepth] = useState(40);
    const [apiLogin, setApiLogin] = useState("");
    const [apiPassword, setApiPassword] = useState("");
    const [showAdvanced, setShowAdvanced] = useState(false);

    const [searchType, setSearchType] = useState<"keyword" | "url">("keyword");
    const [loading, setLoading] = useState(false);
    const [products, setProducts] = useState<ProductResult[]>([]);
    const [error, setError] = useState("");
    const [expandedProducts, setExpandedProducts] = useState<Set<number>>(new Set());
    const [sellerCache, setSellerCache] = useState<Record<string, SellerInfo[]>>({});

    const [loadingProducts, setLoadingProducts] = useState<Record<string, boolean>>({});
    const [sortState, setSortState] = useState<Record<string, { field: 'total_price', direction: 'asc' | 'desc' }>>({});

    const LOCATION_CODES: Record<string, number> = {
        "United States": 2840,
        "United Kingdom": 2826,
        "Canada": 2124,
        "Australia": 2036,
        "Germany": 2276,
        "France": 2250,
        "Spain": 2724,
        "Italy": 2380,
    };

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        console.log(`Searching for "${keyword}" with depth ${depth}`);

        if (!keyword.trim()) {
            setError("Please enter a product keyword");
            return;
        }

        setLoading(true);
        setError("");
        setProducts([]);
        // Search by Keyword - Use Products Endpoint
        const res = await fetch("/api/merchant/google-shopping/products", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                keyword: keyword.trim(),
                location_code: LOCATION_CODES[location],
                language_code: "en",
                depth,
                dataforseoLogin: apiLogin || undefined,
                dataforseoPassword: apiPassword || undefined,
            }),
        });

        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || "Failed to fetch product data");
        }

        const data = await res.json();
        console.log("API Response:", data);

        if (data.tasks && data.tasks[0]?.result?.[0]?.items) {
            const items = data.tasks[0].result[0].items;
            console.log(`Found ${items.length} products`);
            setProducts(items.slice(0, depth));
        } else if (data.tasks && data.tasks[0]?.status_message) {
            setError(`DataForSEO Error: ${data.tasks[0].status_message}`);
        } else {
            setError("No products found for this search.");
        }
    }
} catch (err) {
    console.error(err);
    setError(err instanceof Error ? err.message : "Failed to fetch product data");
} finally {
    setLoading(false);
}
    };

const handleSelectProduct = (product: ProductResult) => {
    if (!product.product_id) {
        setError("This product doesn't have a valid ID");
        return;
    }

    const productIndex = products.indexOf(product);
    const newExpanded = new Set(expandedProducts);

    if (newExpanded.has(productIndex)) {
        newExpanded.delete(productIndex);
    } else {
        newExpanded.add(productIndex);
    }
    setExpandedProducts(newExpanded);
};

const handleSort = (productId: string) => {
    setSortState(prev => {
        const current = prev[productId] || { field: 'total_price', direction: 'asc' }; // Default to asc if not set
        return {
            ...prev,
            [productId]: {
                field: 'total_price',
                direction: current.direction === 'asc' ? 'desc' : 'asc'
            }
        };
    });
};

const fetchSellers = async (product: ProductResult) => {
    if (!product.product_id) return;

    // Check cache first
    if (sellerCache[product.product_id]) return;

    setLoadingProducts(prev => ({ ...prev, [product.product_id!]: true }));

    try {
        const res = await fetch("/api/merchant/google-shopping/sellers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                product_id: product.product_id,
                location_code: LOCATION_CODES[location],
                language_code: "en",
                dataforseoLogin: apiLogin || undefined,
                dataforseoPassword: apiPassword || undefined,
            }),
        });

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.error || `Failed to fetch seller data: ${res.statusText}`);
        }

        const data = await res.json();

        if (data.tasks && data.tasks[0]?.result?.[0]?.items) {
            const items = data.tasks[0].result[0].items;
            // Take top 5 items in original order (no sorting)
            const topItems = items.slice(0, 5);

            // Update cache
            setSellerCache(prev => ({
                ...prev,
                [product.product_id!]: topItems
            }));
        } else if (data.tasks && data.tasks[0]?.status_message) {
            throw new Error(`DataForSEO Error: ${data.tasks[0].status_message}`);
        }
    } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : "Failed to fetch seller information");
    } finally {
        setLoadingProducts(prev => ({ ...prev, [product.product_id!]: false }));
    }
};

const downloadCSV = () => {
    if (products.length === 0) return;

    const headers = ["Position", "Title", "Shop", "Price", "Currency", "Rating", "Votes", "URL"];
    const rows = products.map(p => [
        p.rank_absolute || p.rank_group || "",
        p.title || "",
        p.shop_name || "",
        p.price !== null && p.price !== undefined ? p.price : "",
        p.currency || "",
        p.product_rating?.value || "",
        p.product_rating?.votes_count || "",
        p.url || "",
    ]);

    const csv = [
        headers.join(","),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `product-monitor-${keyword.replace(/\s+/g, "-")}.csv`;
    a.click();
};

return (
    <ThemeProvider>
        <ThemeToggle />
        <main className="min-h-screen bg-gray-100 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8 transition-colors" suppressHydrationWarning>
            <div className="max-w-5xl mx-auto" suppressHydrationWarning>
                {/* Header */}
                <div className="mb-6">
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
                        Product Price Monitor
                    </h1>
                    <p className="text-gray-600 dark:text-gray-300 text-lg">
                        Track product prices and availability on Google Shopping. Monitor competitor pricing, analyze seller information, and export data for analysis.
                    </p>
                </div>

                {/* Search Form */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden mb-8">
                    <form onSubmit={handleSearch} className="p-6 space-y-6">
                        {/* Product Keyword */}
                        <div>
                            <label htmlFor="keyword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Search By
                            </label>
                            <div className="flex gap-4 mb-3">
                                <label className="inline-flex items-center">
                                    <input
                                        type="radio"
                                        className="form-radio text-blue-600"
                                        name="searchType"
                                        value="keyword"
                                        checked={searchType === 'keyword'}
                                        onChange={() => setSearchType('keyword')}
                                    />
                                    <span className="ml-2 text-gray-700 dark:text-gray-300">Keyword</span>
                                </label>
                                <label className="inline-flex items-center">
                                    <input
                                        type="radio"
                                        className="form-radio text-blue-600"
                                        name="searchType"
                                        value="url"
                                        checked={searchType === 'url'}
                                        onChange={() => setSearchType('url')}
                                    />
                                    <span className="ml-2 text-gray-700 dark:text-gray-300">Product ID</span>
                                </label>
                            </div>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Search className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    type="text"
                                    id="keyword"
                                    value={keyword}
                                    onChange={(e) => setKeyword(e.target.value)}
                                    required
                                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors"
                                    placeholder={searchType === 'keyword' ? "e.g., running shoes, wireless headphones" : "e.g., 12693300312433459747"}
                                />
                            </div>
                        </div>

                        {/* Advanced Settings Toggle */}
                        <div>
                            <button
                                type="button"
                                onClick={() => setShowAdvanced(!showAdvanced)}
                                className="flex items-center text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                            >
                                <svg
                                    className={`w-4 h-4 mr-1 transform transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                                Advanced Settings
                            </button>
                        </div>

                        {/* Advanced Settings Panel */}
                        {showAdvanced && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-700">
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Location</label>
                                    <select
                                        value={location}
                                        onChange={(e) => setLocation(e.target.value)}
                                        className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm dark:bg-gray-700 dark:text-white"
                                    >
                                        {Object.keys(LOCATION_CODES).map(loc => (
                                            <option key={loc} value={loc}>{loc}</option>
                                        ))}
                                    </select>
                                </div>
                                {searchType === 'keyword' && (
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Results Depth</label>
                                        <input
                                            type="number"
                                            value={depth}
                                            onChange={(e) => setDepth(parseInt(e.target.value))}
                                            min={1}
                                            max={120}
                                            className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm dark:bg-gray-700 dark:text-white"
                                        />
                                    </div>
                                )}
                                <div className="md:col-span-2 border-t border-gray-200 dark:border-gray-600 pt-4 mt-2">
                                    <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">DataForSEO Credentials *</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <input
                                                type="text"
                                                placeholder="Login"
                                                value={apiLogin}
                                                onChange={(e) => setApiLogin(e.target.value)}
                                                className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm dark:bg-gray-700 dark:text-white"
                                            />
                                        </div>
                                        <div>
                                            <input
                                                type="password"
                                                placeholder="Password"
                                                value={apiPassword}
                                                onChange={(e) => setApiPassword(e.target.value)}
                                                className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm dark:bg-gray-700 dark:text-white"
                                            />
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                        Required. Leave blank only if you've set DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD as environment variables.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Submit Button */}
                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={loading}
                                className={`
                                        w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white 
                                        transition-all duration-200
                                        ${loading
                                        ? 'bg-blue-400 cursor-not-allowed'
                                        : 'bg-blue-600 hover:bg-blue-700 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                                    }
                                    `}
                            >
                                {loading ? (
                                    <>
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Searching Google Shopping...
                                    </>
                                ) : (
                                    'Search Products'
                                )}
                            </button>
                            <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-3">
                                This tool makes API requests to DataForSEO. Cost: ~$0.0006 per search.
                            </p>
                        </div>
                    </form>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4 mb-8 border border-red-200 dark:border-red-800">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <AlertCircle className="h-5 w-5 text-red-400" aria-hidden="true" />
                            </div>
                            <div className="ml-3">
                                <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Error</h3>
                                <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                                    <p>{error}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Results */}
                {products.length > 0 && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-700 pb-4">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Results</h2>
                                <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                                    Found {products.length} products for "{keyword}"
                                </p>
                            </div>
                            <button
                                onClick={downloadCSV}
                                className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                            >
                                <Download className="h-4 w-4 mr-2" />
                                Download CSV
                            </button>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            {products.map((product, index) => {
                                const isExpanded = expandedProducts.has(index);

                                return (
                                    <div key={index} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                                        <button
                                            onClick={() => handleSelectProduct(product)}
                                            className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900/50 flex justify-between items-start hover:bg-gray-100 dark:hover:bg-gray-900/70 transition-colors text-left"
                                        >
                                            <div className="flex-1">
                                                <div className="flex items-start gap-3">
                                                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 mt-1">
                                                        #{product.rank_absolute || product.rank_group || '-'}
                                                    </span>
                                                    {product.product_images && product.product_images.length > 0 && (
                                                        <img
                                                            src={typeof product.product_images[0] === 'string' ? product.product_images[0] : product.product_images[0].url}
                                                            alt={product.title || 'Product image'}
                                                            className="w-20 h-20 object-contain rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0"
                                                            onError={(e) => {
                                                                e.currentTarget.style.display = 'none';
                                                            }}
                                                        />
                                                    )}
                                                    <div className="flex-1">
                                                        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
                                                            {product.title}
                                                        </h3>
                                                        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                                                            {product.shop_name && (
                                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                                                    {product.shop_name}
                                                                </span>
                                                            )}
                                                            {product.product_rating && (
                                                                <span>
                                                                    ⭐ {product.product_rating.value} ({product.product_rating.votes_count} reviews)
                                                                </span>
                                                            )}
                                                            {product.available !== undefined && (
                                                                <span className={product.available ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                                                                    {product.available ? "In Stock" : "Out of Stock"}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-2xl font-bold text-gray-900 dark:text-white">
                                                            {product.price !== null && product.price !== undefined
                                                                ? `${product.currency || ''} ${product.price.toFixed(2)}`
                                                                : "N/A"}
                                                        </div>
                                                        {product.shopping_url && (
                                                            <a
                                                                href={product.shopping_url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-sm text-blue-600 dark:text-blue-400 hover:underline block mt-1"
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                View on Shopping
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <svg
                                                className={`w-5 h-5 text-gray-500 transition-transform ml-4 flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </button>

                                        {/* Seller Information */}
                                        {isExpanded && (
                                            <div className="border-t border-gray-200 dark:border-gray-700">
                                                {loadingProducts[product.product_id || ''] ? (
                                                    <div className="flex justify-center items-center py-12">
                                                        <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
                                                    </div>
                                                ) : (sellerCache[product.product_id!] || []).length > 0 ? (
                                                    <div className="overflow-x-auto">
                                                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                                            <thead className="bg-gray-50 dark:bg-gray-900/30">
                                                                <tr>
                                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                                        Seller
                                                                    </th>
                                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                                        Price
                                                                    </th>
                                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                                        Shipping
                                                                    </th>
                                                                    <th
                                                                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors select-none group"
                                                                        onClick={() => handleSort(product.product_id!)}
                                                                    >
                                                                        <div className="flex items-center gap-1">
                                                                            Total
                                                                            <span className="text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300">
                                                                                {sortState[product.product_id!]?.direction === 'asc' ? '↑' : sortState[product.product_id!]?.direction === 'desc' ? '↓' : '↕'}
                                                                            </span>
                                                                        </div>
                                                                    </th>
                                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                                        Details
                                                                    </th>
                                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                                        Link
                                                                    </th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                                                {(() => {
                                                                    const sellers = sellerCache[product.product_id!] || [];
                                                                    const currentSort = sortState[product.product_id!];

                                                                    const sortedSellers = [...sellers].sort((a, b) => {
                                                                        if (!currentSort) return 0;

                                                                        const priceA = a.total_price ?? a.price ?? a.base_price ?? Infinity;
                                                                        const priceB = b.total_price ?? b.price ?? b.base_price ?? Infinity;

                                                                        return currentSort.direction === 'asc'
                                                                            ? priceA - priceB
                                                                            : priceB - priceA;
                                                                    });

                                                                    return sortedSellers.map((seller, idx) => {
                                                                        const price = seller.price ?? seller.base_price ?? 0;
                                                                        const shipping = seller.shipping_price;
                                                                        // If total_price is missing, calculate it: if shipping is 0/null, total = price
                                                                        const total = seller.total_price ?? ((shipping == null || shipping === 0) ? price : null);

                                                                        return (
                                                                            <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                                                                    {seller.title || seller.seller_name || seller.domain || "Unknown Seller"}
                                                                                </td>
                                                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                                                    {seller.currency || ''} {price.toFixed(2)}
                                                                                </td>
                                                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                                                    {shipping != null && shipping > 0
                                                                                        ? `${seller.currency || ''} ${shipping.toFixed(2)}`
                                                                                        : "Free"}
                                                                                </td>
                                                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white">
                                                                                    {total != null ? `${seller.currency || ''} ${total.toFixed(2)}` : 'N/A'}
                                                                                </td>
                                                                                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate" title={seller.details}>
                                                                                    {seller.details || "-"}
                                                                                </td>
                                                                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                                                    <a
                                                                                        href={seller.url}
                                                                                        target="_blank"
                                                                                        rel="noopener noreferrer"
                                                                                        className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 inline-flex items-center"
                                                                                    >
                                                                                        View <ExternalLink className="h-3 w-3 ml-1" />
                                                                                    </a>
                                                                                </td>
                                                                            </tr>
                                                                        );

                                                                    })
                                                                })()}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                ) : (
                                                    <div className="flex justify-center py-6">
                                                        <button
                                                            onClick={() => fetchSellers(product)}
                                                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                                        >
                                                            Load Sellers
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                        }
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </main>
    </ThemeProvider >
);
}
