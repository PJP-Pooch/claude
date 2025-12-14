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
    specs?: { name: string; value: string }[];
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
    // Additional fields for stock status and sales messaging
    availability?: string;
    condition?: string;
    old_price?: number | null;
    price_tag?: string;
    product_condition?: string;
};

// ... (existing code)

// Inside fetchSellers for Product ID Search (approx line 170 in updated file positions)
// need to locate where syntheticProduct is created

// Inside fetchSellers (in search loop) and handleSearch (for product ids)

// Let's modify the ProductResult type first
// Then find where mapping happens.

/* In handleSearch (Product ID logic) */
// const syntheticProduct: ProductResult = {
//     ...
//     specs: productInfo?.specs || [],
// };


/* In fetchSellers (Expansion logic) */
// We need to update the product in state with the newly fetched specs from productInfo
// The current fetchSellers only updates 'sellerCache'. It doesn't update 'products' state for the specs.
// We should update 'products' state if productInfo is available.



export default function ProductPriceMonitorPage() {
    const [keyword, setKeyword] = useState("");
    const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
    const [location, setLocation] = useState("United Kingdom");
    const [depth, setDepth] = useState(40);
    const [priceMin, setPriceMin] = useState("");
    const [priceMax, setPriceMax] = useState("");
    const [apiLogin, setApiLogin] = useState("");
    const [apiPassword, setApiPassword] = useState("");
    const [showAdvanced, setShowAdvanced] = useState(false);

    const [searchType, setSearchType] = useState<"keyword" | "url" | "brand">("keyword");
    const [loading, setLoading] = useState(false);
    const [products, setProducts] = useState<ProductResult[]>([]);
    const [error, setError] = useState("");
    const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
    const [sellerCache, setSellerCache] = useState<Record<string, SellerInfo[]>>({});

    const [loadingProducts, setLoadingProducts] = useState<Record<string, boolean>>({});
    const [sortState, setSortState] = useState<Record<string, { field: 'total_price', direction: 'asc' | 'desc' }>>({});
    const [targetDomain, setTargetDomain] = useState("");

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

    const COUNTRY_CODES: Record<string, string> = {
        "United States": "us",
        "United Kingdom": "gb",
        "Canada": "ca",
        "Australia": "au",
        "Germany": "de",
        "France": "fr",
        "Spain": "es",
        "Italy": "it",
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
        setSelectedProducts(new Set());
        const countryCode = COUNTRY_CODES[location] || "us";
        try {
            if (searchType === 'url') {
                // Search by Product ID(s) - support multiple IDs separated by commas or newlines
                const productIds = keyword
                    .split(/[,\n]/)
                    .map(id => id.trim())
                    .filter(id => id.length > 0);

                if (productIds.length === 0) {
                    setError("Please enter at least one Product ID.");
                    setLoading(false);
                    return;
                }

                // Fetch sellers for all product IDs in parallel
                const fetchPromises = productIds.map(async (productId) => {
                    try {
                        const sellersRes = await fetch("/api/merchant/google-shopping/sellers", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                product_id: productId,
                                location_code: LOCATION_CODES[location],
                                language_code: "en",
                                dataforseoLogin: apiLogin || undefined,
                                dataforseoPassword: apiPassword || undefined,
                            }),
                        });

                        if (!sellersRes.ok) {
                            return { productId, error: `Failed to fetch: ${sellersRes.statusText}`, sellers: [] as SellerInfo[], product: null };
                        }

                        const sellersData = await sellersRes.json();

                        if (sellersData.tasks && sellersData.tasks[0]?.result?.[0]?.items) {
                            const resultObj = sellersData.tasks[0].result[0];
                            const sellerItems = resultObj.items as SellerInfo[];
                            const productInfo = resultObj.item; // This usually contains the product metadata like images

                            if (sellerItems.length === 0) {
                                return { productId, error: "No sellers found", sellers: [] as SellerInfo[], product: null };
                            }

                            const firstSeller = sellerItems[0];
                            // Use details for title if available, otherwise title (which might be seller name sometimes)
                            const productTitle = firstSeller?.details || firstSeller?.title || "Product Found";

                            // Use the URL from the API result if available (usually points to the product on Google Shopping)
                            // Otherwise fallback to a search for the ID
                            // We use 'q' parameter instead of 'gid:' as it is more robust if the ID is not strictly a GID
                            const googleShoppingUrl = productInfo?.url || `https://www.google.com/search?tbm=shop&q=${productId}&gl=${countryCode}&hl=en`;

                            const syntheticProduct: ProductResult = {
                                product_id: productId,
                                title: productInfo?.title || productTitle,
                                price: firstSeller?.price ?? firstSeller?.base_price ?? null,
                                currency: firstSeller?.currency,
                                shop_name: "Various Sellers",
                                product_images: productInfo?.images || [], // Use images from the main item object
                                available: true,
                                shopping_url: googleShoppingUrl,
                                specs: productInfo?.specs_info || [] // Use specs_info from the main item object
                            };

                            return { productId, error: null, sellers: sellerItems, product: syntheticProduct };
                        } else {
                            return { productId, error: sellersData.tasks?.[0]?.status_message || "No data found", sellers: [] as SellerInfo[], product: null };
                        }
                    } catch (err) {
                        return { productId, error: `Error: ${err instanceof Error ? err.message : 'Unknown error'}`, sellers: [] as SellerInfo[], product: null };
                    }
                });

                const results = await Promise.all(fetchPromises);

                // Collect successful products and sellers
                const successfulProducts: ProductResult[] = [];
                const newSellerCache: Record<string, SellerInfo[]> = {};
                const errors: string[] = [];

                results.forEach(result => {
                    if (result.product && result.sellers.length > 0) {
                        successfulProducts.push(result.product);
                        newSellerCache[result.productId] = result.sellers;
                    } else if (result.error) {
                        errors.push(`${result.productId}: ${result.error}`);
                    }
                });

                if (successfulProducts.length > 0) {
                    setProducts(successfulProducts);
                    setSellerCache(newSellerCache);
                    // Do not auto-expand products by default
                    setExpandedProducts(new Set());
                }

                if (errors.length > 0 && successfulProducts.length === 0) {
                    setError(errors.join('\n'));
                } else if (errors.length > 0) {
                    // Show partial errors as warning
                    console.warn('Some products failed:', errors);
                }

            } else {
                // Search by Keyword or Brand - Use Products Endpoint
                let searchKeyword = keyword.trim();

                if (searchType === 'brand') {
                    // specific logic for brand search
                    // Use only the first brand name (primary) for the search query, split by | or newline
                    const primaryBrand = (searchKeyword.split(/[|\n]/)[0] || "").trim();
                    searchKeyword = primaryBrand;
                }

                const res = await fetch("/api/merchant/google-shopping/products", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        keyword: searchKeyword,
                        location_code: LOCATION_CODES[location],
                        language_code: "en",
                        depth,
                        price_min: priceMin ? parseFloat(priceMin) : undefined,
                        price_max: priceMax ? parseFloat(priceMax) : undefined,
                        dataforseoLogin: apiLogin || undefined,
                        dataforseoPassword: apiPassword || undefined,
                    }),
                });

                const responseText = await res.text();
                let data;
                try {
                    data = JSON.parse(responseText);
                } catch (e) {
                    console.error("Failed to parse API response:", responseText);
                    throw new Error(`Server error (${res.status}): The response was not valid JSON.`);
                }

                if (!res.ok) {
                    throw new Error(data.error || "Failed to fetch product data");
                }
                console.log("API Response:", data);

                if (data.tasks && data.tasks[0]?.result?.[0]?.items) {
                    const items = data.tasks[0].result[0].items;
                    console.log(`Found ${items.length} products`);

                    const updatedItems = items.slice(0, depth).map((item: ProductResult, idx: number) => {
                        let shoppingUrl = item.shopping_url;
                        let extractedId = item.product_id;

                        // Try to extract ID from URL if missing
                        if (!extractedId && (item.shopping_url || item.url)) {
                            const urlToCheck = item.shopping_url || item.url || '';
                            // Match common patterns for Google Shopping IDs
                            const pidMatch = urlToCheck.match(/(?:pid:|productid:|product\/)(\d+)/);
                            if (pidMatch) {
                                extractedId = pidMatch[1];
                            }
                        }

                        // Encapsulate ID generation to ensure every item has one
                        const finalId = extractedId || `missing-id-${idx}-${Date.now()}`;

                        // Use the URL from API as-is, or construct a simple one if missing
                        if (!shoppingUrl && extractedId) {
                            shoppingUrl = `https://www.google.com/shopping/product/${extractedId}`;
                        }

                        return {
                            ...item,
                            product_id: finalId,
                            shopping_url: shoppingUrl
                        };
                    });

                    setProducts(updatedItems);
                    // Do not auto-expand products by default
                    setExpandedProducts(new Set());
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
        if (!product.product_id) return;

        const newExpanded = new Set(expandedProducts);
        if (newExpanded.has(product.product_id)) {
            newExpanded.delete(product.product_id);
        } else {
            newExpanded.add(product.product_id);
        }
        setExpandedProducts(newExpanded);
    };

    const handleSelectAll = () => {
        // If all selectable products are selected, deselect all. Otherwise, select all.
        const allIds = products.map(p => p.product_id).filter(Boolean) as string[];
        if (selectedProducts.size === allIds.length && allIds.length > 0) {
            setSelectedProducts(new Set());
        } else {
            setSelectedProducts(new Set(allIds));
        }
    };

    const handleRemoveProduct = (productId: string) => {
        setProducts(prev => prev.filter(p => p.product_id !== productId));
        if (selectedProducts.has(productId)) {
            const newSelected = new Set(selectedProducts);
            newSelected.delete(productId);
            setSelectedProducts(newSelected);
        }
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

    const toggleProductSelection = (productId: string) => {
        const newSelected = new Set(selectedProducts);
        if (newSelected.has(productId)) {
            newSelected.delete(productId);
        } else {
            newSelected.add(productId);
        }
        setSelectedProducts(newSelected);
    };

    const copySelectedIds = () => {
        const validIds = Array.from(selectedProducts).filter(id => !id.startsWith('missing-id-'));

        if (validIds.length === 0) {
            alert("No valid Product IDs to copy.");
            return;
        }

        const ids = validIds.join('\n');
        navigator.clipboard.writeText(ids);
        alert(`${validIds.length} valid Product IDs copied to clipboard!${selectedProducts.size > validIds.length ? ` (${selectedProducts.size - validIds.length} generated IDs ignored)` : ''}`);
    };

    const downloadSelectedCSV = () => {
        if (selectedProducts.size === 0) return;
        // reuse download logic but filter by selected
        const selectedItems = products.filter(p => p.product_id && selectedProducts.has(p.product_id));

        const headers = ["Product ID", "Product Title", "Price", "Link"];
        const rows = selectedItems.map(p => [
            p.product_id || "",
            p.title || "",
            p.price ? p.price.toString() : "",
            p.shopping_url || ""
        ]);

        const csv = [
            headers.join(","),
            ...rows.map(row => row.map(cell => `"${(cell || "").replace(/"/g, '""')}"`).join(",")),
        ].join("\n");

        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `brand-products-${keyword}.csv`;
        a.click();
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
                const resultObj = data.tasks[0].result[0];
                const items = resultObj.items;
                const productInfo = resultObj.item;

                // Take top 5 items in original order (no sorting)
                const topItems = items.slice(0, 5);

                // Update cache
                setSellerCache(prev => ({
                    ...prev,
                    [product.product_id!]: topItems
                }));

                // If we also got specs_info, update the main product in the products list
                if (productInfo?.specs_info) {
                    setProducts(prev => prev.map(p =>
                        p.product_id === product.product_id
                            ? { ...p, specs: productInfo.specs_info }
                            : p
                    ));
                }
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

        const headers = ["Product ID", "Product Title", "Position", "Seller", "Price", "Total Price", "Shipping", "Rating", "Votes", "Shopping Link", "Seller Link"];
        const rows: string[][] = [];

        products.forEach(p => {
            const sellers = sellerCache[p.product_id!] || [];
            if (sellers.length > 0) {
                sellers.forEach((seller, index) => {
                    const price = seller.price ?? seller.base_price ?? 0;
                    const shipping = seller.shipping_price ?? 0;
                    const total = seller.total_price ?? (price + shipping);

                    rows.push([
                        p.product_id || "",
                        p.title || "",
                        (index + 1).toString(),
                        seller.title || seller.seller_name || seller.domain || "",
                        (price).toFixed(2),
                        (total).toFixed(2),
                        (shipping).toFixed(2),
                        p.product_rating?.value?.toString() || "",
                        p.product_rating?.votes_count?.toString() || "",
                        p.shopping_url || "",
                        seller.url || ""
                    ]);
                });
            } else {
                // Add the product row even if no sellers loaded yet, with basic info
                rows.push([
                    p.product_id || "",
                    p.title || "",
                    "", // Position
                    p.shop_name || "", // Fallback to shop name if no specific seller list
                    p.price ? p.price.toString() : "",
                    "", // Total
                    "", // Shipping
                    p.product_rating?.value?.toString() || "",
                    p.product_rating?.votes_count?.toString() || "",
                    p.shopping_url || "",
                    p.url || ""
                ]);
            }
        });

        const csv = [
            headers.join(","),
            ...rows.map(row => row.map(cell => `"${(cell || "").replace(/"/g, '""')}"`).join(",")),
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
                                            onChange={() => {
                                                setSearchType('keyword');
                                                setKeyword("");
                                                setProducts([]);
                                                setError("");
                                                setPriceMin("");
                                                setPriceMax("");
                                            }}
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
                                            onChange={() => {
                                                setSearchType('url');
                                                setKeyword("");
                                                setProducts([]);
                                                setError("");
                                                setPriceMin("");
                                                setPriceMax("");
                                            }}
                                        />
                                        <span className="ml-2 text-gray-700 dark:text-gray-300">Product ID</span>
                                    </label>
                                    <label className="inline-flex items-center">
                                        <input
                                            type="radio"
                                            className="form-radio text-blue-600"
                                            name="searchType"
                                            value="brand"
                                            checked={searchType === 'brand'}
                                            onChange={() => {
                                                setSearchType('brand');
                                                setKeyword("");
                                                setProducts([]);
                                                setError("");
                                                setPriceMin("");
                                                setPriceMax("");
                                            }}
                                        />
                                        <span className="ml-2 text-gray-700 dark:text-gray-300">Brand</span>
                                    </label>
                                </div>
                                <div className="relative">
                                    {searchType === 'keyword' ? (
                                        <>
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
                                                placeholder="e.g., running shoes, wireless headphones"
                                            />
                                        </>
                                    ) : searchType === 'brand' ? (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Brand Name (Use | for variations)</label>
                                            <input
                                                type="text"
                                                value={keyword}
                                                onChange={(e) => setKeyword(e.target.value)}
                                                required
                                                className="block w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors"
                                                placeholder="e.g. Pooch & Mutt|Pooch and Mutt"
                                            />
                                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                                First value used for search, all used for matching.
                                            </p>
                                        </div>
                                    ) : (
                                        <div>
                                            <textarea
                                                id="keyword"
                                                value={keyword}
                                                onChange={(e) => setKeyword(e.target.value)}
                                                required
                                                rows={3}
                                                className="block w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors font-mono"
                                                placeholder={`Enter Product ID(s) - one per line or comma-separated
e.g., 12693300312433459747
     5678901234567890123`}
                                            />
                                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                                Supports multiple Product IDs separated by commas or new lines
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Main Settings Row */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location</label>
                                    <select
                                        value={location}
                                        onChange={(e) => setLocation(e.target.value)}
                                        className="block w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                    >
                                        {Object.keys(LOCATION_CODES).map(loc => (
                                            <option key={loc} value={loc}>{loc}</option>
                                        ))}
                                    </select>
                                </div>
                                {searchType !== 'url' && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Results Depth</label>
                                        <input
                                            type="number"
                                            value={depth}
                                            onChange={(e) => setDepth(parseInt(e.target.value))}
                                            min={1}
                                            max={120}
                                            className="block w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                        />
                                    </div>
                                )}
                                {searchType !== 'url' && (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Min Price</label>
                                            <input
                                                type="number"
                                                value={priceMin}
                                                onChange={(e) => setPriceMin(e.target.value)}
                                                placeholder="0"
                                                className="block w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max Price</label>
                                            <input
                                                type="number"
                                                value={priceMax}
                                                onChange={(e) => setPriceMax(e.target.value)}
                                                placeholder="Any"
                                                className="block w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                            />
                                        </div>
                                    </div>
                                )}
                                {searchType !== 'brand' && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Your Brand/Domain Match <span className="text-xs text-gray-500">(optional)</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={targetDomain}
                                            onChange={(e) => setTargetDomain(e.target.value)}
                                            placeholder="e.g., brand.com|Brand Name"
                                            className="block w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* API Login Details Toggle */}
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
                                    API Login Details
                                    {(!apiLogin && !apiPassword) && (
                                        <span className="ml-2 text-xs text-amber-500 flex items-center">
                                            <AlertCircle className="w-3 h-3 mr-1" />
                                            (Check if not set in env)
                                        </span>
                                    )}
                                </button>
                            </div>

                            {/* API Login Details Panel */}
                            {showAdvanced && (
                                <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-700">
                                    <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">DataForSEO Credentials</h4>
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
                                        Required. Enter your DataForSEO credentials here.
                                    </p>
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
                                        {searchType === 'brand' && (
                                            <span className="block mt-1 text-xs text-gray-500">
                                                {selectedProducts.size} selected for bulk action
                                            </span>
                                        )}
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleSelectAll}
                                        className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                    >
                                        {selectedProducts.size > 0 && selectedProducts.size === products.length ? 'Deselect All' : 'Select All'}
                                    </button>
                                    {selectedProducts.size > 0 && (
                                        <>
                                            <button
                                                onClick={copySelectedIds}
                                                className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                            >
                                                Copy IDs
                                            </button>
                                            <button
                                                onClick={downloadSelectedCSV}
                                                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                                            >
                                                Export Selected
                                            </button>
                                        </>
                                    )}
                                    <button
                                        onClick={downloadCSV}
                                        className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                                    >
                                        <Download className="h-4 w-4 mr-2" />
                                        Export All
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                {products.map((product, index) => {
                                    const isExpanded = product.product_id ? expandedProducts.has(product.product_id) : false;

                                    return (
                                        <div key={product.product_id || index} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden relative group">

                                            <button
                                                onClick={(e) => {
                                                    // note: if checkbox is clicked, we toggled specific selection, handled by stopPropagation
                                                    handleSelectProduct(product);
                                                }}
                                                className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900/50 flex justify-between items-start hover:bg-gray-100 dark:hover:bg-gray-900/70 transition-colors text-left"
                                            >
                                                <div className="flex items-center gap-3 mr-4">
                                                    {searchType === 'brand' && (
                                                        <input
                                                            type="checkbox"
                                                            checked={product.product_id ? selectedProducts.has(product.product_id) : false}
                                                            onChange={(e) => {
                                                                e.stopPropagation();
                                                                if (product.product_id) toggleProductSelection(product.product_id);
                                                            }}
                                                            className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                                        />
                                                    )}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex items-start gap-3">
                                                        <div className="flex flex-col gap-1 mt-1 min-w-[3rem]">
                                                            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                                                                #{product.rank_absolute || product.rank_group || (index + 1) || '-'}
                                                            </span>
                                                            {(() => {
                                                                const sellers = sellerCache[product.product_id!] || [];
                                                                if (targetDomain && sellers.length > 0) {
                                                                    const matchTargets = targetDomain.toLowerCase().split('|').map(t => t.trim().replace(/^(https?:\/\/)?(www\.)?/, '')).filter(Boolean);

                                                                    const matchIndex = sellers.findIndex(s => {
                                                                        const sDomain = (s.domain || s.url || '').toLowerCase();
                                                                        const sName = (s.seller_name || '').toLowerCase();
                                                                        return matchTargets.some(target => sDomain.includes(target) || sName.includes(target));
                                                                    });

                                                                    if (matchIndex !== -1) {
                                                                        const rank = matchIndex + 1;
                                                                        const isTop3 = rank <= 3;
                                                                        return (
                                                                            <span className={`px-2 py-0.5 text-[10px] rounded-md whitespace-nowrap w-fit ${isTop3
                                                                                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                                                                : "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
                                                                                }`}>
                                                                                My Rank: #{rank}
                                                                            </span>
                                                                        );
                                                                    } else {
                                                                        return (
                                                                            <span className="px-2 py-0.5 text-[10px] rounded-md whitespace-nowrap w-fit bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                                                                                Not Ranked
                                                                            </span>
                                                                        );
                                                                    }
                                                                }
                                                                return null;
                                                            })()}
                                                        </div>
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
                                                                <span className="text-xs text-gray-400 font-mono">
                                                                    ID: {product.product_id}
                                                                </span>
                                                                {product.available !== undefined && (
                                                                    <span className={product.available ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                                                                        {product.available ? "In Stock" : "Out of Stock"}
                                                                    </span>
                                                                )}
                                                                {product.specs && (
                                                                    <span className="text-gray-500 dark:text-gray-400 border-l border-gray-300 dark:border-gray-600 pl-3 ml-1">
                                                                        {product.specs.find(s => s.name === 'Size')?.value && (
                                                                            <span className="font-medium text-gray-700 dark:text-gray-300 mr-2">
                                                                                Size: {product.specs.find(s => s.name === 'Size')?.value}
                                                                            </span>
                                                                        )}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="text-right flex flex-col items-end">
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
                                                            {product.url && product.url !== product.shopping_url && (
                                                                <a
                                                                    href={product.url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-sm text-green-600 dark:text-green-400 hover:underline block mt-1"
                                                                    onClick={(e) => e.stopPropagation()}
                                                                >
                                                                    Visit Website
                                                                </a>
                                                            )}
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (product.product_id) handleRemoveProduct(product.product_id);
                                                                }}
                                                                className="text-sm text-red-500 hover:text-red-700 hover:underline block mt-2"
                                                            >
                                                                Remove
                                                            </button>
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
                                                                            Offers
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
                                                                            const total = seller.total_price ?? ((shipping == null || shipping === 0) ? price : null);

                                                                            const sellerDomain = seller.domain || seller.url || '';

                                                                            let matchTargets: string[] = [];
                                                                            if (searchType === 'brand') {
                                                                                matchTargets = keyword.toLowerCase().split(/[|\n]/).map(t => t.trim()).filter(Boolean);
                                                                            } else {
                                                                                matchTargets = targetDomain.toLowerCase().split('|').map(t => t.trim().replace(/^(https?:\/\/)?(www\.)?/, '')).filter(Boolean);
                                                                            }

                                                                            const isTargetMatch = matchTargets.length > 0 && matchTargets.some(target =>
                                                                                sellerDomain.toLowerCase().includes(target) ||
                                                                                (seller.seller_name || '').toLowerCase().includes(target) ||
                                                                                (seller.title || '').toLowerCase().includes(target)
                                                                            );
                                                                            const position = idx + 1;
                                                                            const isTopPosition = isTargetMatch && position === 1;

                                                                            return (
                                                                                <tr
                                                                                    key={idx}
                                                                                    className={`transition-colors ${isTopPosition
                                                                                        ? 'bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border-l-4 border-yellow-500'
                                                                                        : isTargetMatch
                                                                                            ? 'bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500'
                                                                                            : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                                                                        }`}
                                                                                >
                                                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                                                                        <div className="flex flex-col">
                                                                                            <div className="flex items-center gap-2">
                                                                                                {isTopPosition ? (
                                                                                                    <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold text-white bg-gradient-to-r from-yellow-500 to-amber-500 rounded-full shadow-sm">
                                                                                                        🏆 #1
                                                                                                    </span>
                                                                                                ) : isTargetMatch ? (
                                                                                                    <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold text-white bg-green-500 rounded-full">
                                                                                                        #{position}
                                                                                                    </span>
                                                                                                ) : null}
                                                                                                <span className={
                                                                                                    isTopPosition
                                                                                                        ? 'text-amber-700 dark:text-amber-400 font-bold'
                                                                                                        : isTargetMatch
                                                                                                            ? 'text-green-700 dark:text-green-400 font-semibold'
                                                                                                            : ''
                                                                                                }>
                                                                                                    {seller.title || seller.seller_name || seller.domain || "Unknown Seller"}
                                                                                                </span>
                                                                                            </div>
                                                                                            {seller.availability && (
                                                                                                <div className={`text-xs mt-1 ${seller.availability.toLowerCase().includes('out of stock')
                                                                                                    ? 'text-red-500 font-medium'
                                                                                                    : 'text-green-600 dark:text-green-400'
                                                                                                    }`}>
                                                                                                    {seller.availability}
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                    </td>
                                                                                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${isTopPosition ? 'text-amber-700 dark:text-amber-400' : isTargetMatch ? 'text-green-700 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                                                                                        {seller.currency || ''} {price.toFixed(2)}
                                                                                    </td>
                                                                                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${isTopPosition ? 'text-amber-700 dark:text-amber-400' : isTargetMatch ? 'text-green-700 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                                                                                        {shipping != null && shipping > 0
                                                                                            ? `${seller.currency || ''} ${shipping.toFixed(2)}`
                                                                                            : "Free"}
                                                                                    </td>
                                                                                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold ${isTopPosition ? 'text-amber-700 dark:text-amber-400 font-bold' : isTargetMatch ? 'text-green-700 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>
                                                                                        {total != null ? `${seller.currency || ''} ${total.toFixed(2)}` : 'N/A'}
                                                                                    </td>

                                                                                    <td className="px-6 py-4 text-sm max-w-xs">
                                                                                        <div className="flex flex-col gap-1">
                                                                                            {seller.old_price && seller.old_price > price && (
                                                                                                <span className="text-red-500 dark:text-red-400">
                                                                                                    <span className="line-through text-gray-400 mr-1">
                                                                                                        {seller.currency || ''} {seller.old_price.toFixed(2)}
                                                                                                    </span>
                                                                                                    <span className="font-medium">
                                                                                                        {Math.round(((seller.old_price - price) / seller.old_price) * 100)}% off
                                                                                                    </span>
                                                                                                </span>
                                                                                            )}
                                                                                            {seller.price_tag && (
                                                                                                <span className="text-purple-600 dark:text-purple-400 text-xs">
                                                                                                    {seller.price_tag}
                                                                                                </span>
                                                                                            )}
                                                                                            {seller.details && !seller.old_price && !seller.price_tag && (
                                                                                                <span className="text-gray-500 dark:text-gray-400 truncate" title={seller.details}>
                                                                                                    {seller.details}
                                                                                                </span>
                                                                                            )}
                                                                                            {!seller.old_price && !seller.price_tag && !seller.details && (
                                                                                                <span className="text-gray-400">-</span>
                                                                                            )}
                                                                                        </div>
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
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div >
            </main >
        </ThemeProvider >
    );
}
