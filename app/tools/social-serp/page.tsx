'use client';

import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Download, ExternalLink, Search, AlertCircle, CheckCircle2 } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import { ThemeProvider } from '@/components/ThemeProvider';
import { LOCATION_MAP, LANGUAGE_MAP } from '@/lib/types';

const PLATFORMS = ["Reddit", "Pinterest", "Instagram", "TikTok", "YouTube"];

interface PlatformResult {
    platform: string;
    query: string;
    rows: { title: string; url: string }[];
    error?: string;
}

export default function SocialSerpPage() {
    // Form State
    const [baseKeyword, setBaseKeyword] = useState('');
    const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(PLATFORMS);
    const [location, setLocation] = useState('United Kingdom');
    const [language, setLanguage] = useState('English');
    const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
    const [depth, setDepth] = useState(100);
    const [apiLogin, setApiLogin] = useState('');
    const [apiPassword, setApiPassword] = useState('');
    const [showAdvanced, setShowAdvanced] = useState(false);

    // App State
    const [isLoading, setIsLoading] = useState(false);
    const [results, setResults] = useState<PlatformResult[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [expandedPlatforms, setExpandedPlatforms] = useState<Set<string>>(new Set());

    const togglePlatform = (platform: string) => {
        setExpandedPlatforms(prev => {
            const newSet = new Set(prev);
            if (newSet.has(platform)) {
                newSet.delete(platform);
            } else {
                newSet.add(platform);
            }
            return newSet;
        });
    };

    const handlePlatformToggle = (platform: string) => {
        setSelectedPlatforms(prev =>
            prev.includes(platform)
                ? prev.filter(p => p !== platform)
                : [...prev, platform]
        );
    };

    const handleSelectAllPlatforms = () => {
        if (selectedPlatforms.length === PLATFORMS.length) {
            setSelectedPlatforms([]);
        } else {
            setSelectedPlatforms(PLATFORMS);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!baseKeyword.trim()) return;
        if (selectedPlatforms.length === 0) {
            setError("Please select at least one platform.");
            return;
        }

        setIsLoading(true);
        setError(null);
        setResults(null);

        try {
            const response = await fetch('/api/social-serp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    baseKeyword,
                    platforms: selectedPlatforms,
                    dataforseoLogin: apiLogin || undefined,
                    dataforseoPassword: apiPassword || undefined,
                    locationCode: LOCATION_MAP[location],
                    languageCode: LANGUAGE_MAP[language],
                    device,
                    depth
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to fetch results');
            }

            setResults(data.results);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    const downloadExcel = () => {
        if (!results) return;

        const wb = XLSX.utils.book_new();

        results.forEach(result => {
            // Create worksheet data: Header + Rows
            const wsData = [
                ["Title", "URL"],
                ...result.rows.map(row => [row.title, row.url])
            ];

            const ws = XLSX.utils.aoa_to_sheet(wsData);
            XLSX.utils.book_append_sheet(wb, ws, result.platform);
        });

        const date = new Date().toISOString().split('T')[0];
        const safeKeyword = baseKeyword.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        XLSX.writeFile(wb, `social_serp_export_${safeKeyword}_${date}.xlsx`);
    };

    return (
        <ThemeProvider>
            <ThemeToggle />
            <main className="min-h-screen bg-gray-100 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8 transition-colors">
                <div className="max-w-5xl mx-auto">
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
                            Social SERP Explorer
                        </h1>
                        <p className="text-gray-600 dark:text-gray-300 text-lg">
                            Fetch Reddit, Pinterest, Instagram, TikTok, and YouTube results for your keyword via DataForSEO, and export them to Excel.
                        </p>
                    </div>

                    {/* Input Form */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden mb-8">
                        <form onSubmit={handleSubmit} className="p-6 space-y-6">
                            {/* Base Keyword */}
                            <div>
                                <label htmlFor="baseKeyword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Base Keyword *
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Search className="h-5 w-5 text-gray-400" />
                                    </div>
                                    <input
                                        type="text"
                                        id="baseKeyword"
                                        value={baseKeyword}
                                        onChange={(e) => setBaseKeyword(e.target.value)}
                                        required
                                        className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors"
                                        placeholder="e.g. best dog food"
                                    />
                                </div>
                            </div>

                            {/* Platforms */}
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Target Platforms
                                    </label>
                                    <button
                                        type="button"
                                        onClick={handleSelectAllPlatforms}
                                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                                    >
                                        {selectedPlatforms.length === PLATFORMS.length ? 'Deselect All' : 'Select All'}
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                                    {PLATFORMS.map(platform => (
                                        <label
                                            key={platform}
                                            className={`
                                                flex items-center justify-center px-4 py-3 border rounded-lg cursor-pointer transition-all
                                                ${selectedPlatforms.includes(platform)
                                                    ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300'
                                                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700'
                                                }
                                            `}
                                        >
                                            <input
                                                type="checkbox"
                                                className="sr-only"
                                                checked={selectedPlatforms.includes(platform)}
                                                onChange={() => handlePlatformToggle(platform)}
                                            />
                                            <span className="font-medium">{platform}</span>
                                        </label>
                                    ))}
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
                                            {Object.keys(LOCATION_MAP).map(loc => (
                                                <option key={loc} value={loc}>{loc}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Language</label>
                                        <select
                                            value={language}
                                            onChange={(e) => setLanguage(e.target.value)}
                                            className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm dark:bg-gray-700 dark:text-white"
                                        >
                                            {Object.keys(LANGUAGE_MAP).map(lang => (
                                                <option key={lang} value={lang}>{lang}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Device</label>
                                        <div className="flex space-x-4 mt-2">
                                            <label className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    checked={device === 'desktop'}
                                                    onChange={() => setDevice('desktop')}
                                                    className="text-blue-600 focus:ring-blue-500"
                                                />
                                                <span>Desktop</span>
                                            </label>
                                            <label className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    checked={device === 'mobile'}
                                                    onChange={() => setDevice('mobile')}
                                                    className="text-blue-600 focus:ring-blue-500"
                                                />
                                                <span>Mobile</span>
                                            </label>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Search Depth</label>
                                        <input
                                            type="number"
                                            value={depth}
                                            onChange={(e) => setDepth(parseInt(e.target.value))}
                                            min={1}
                                            max={700}
                                            className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm dark:bg-gray-700 dark:text-white"
                                        />
                                    </div>
                                    <div className="md:col-span-2 border-t border-gray-200 dark:border-gray-600 pt-4 mt-2">
                                        <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">DataForSEO Credentials (Optional)</h4>
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
                                            Leave blank to use server-side environment variables.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Submit Button */}
                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className={`
                                        w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white 
                                        transition-all duration-200
                                        ${isLoading
                                            ? 'bg-blue-400 cursor-not-allowed'
                                            : 'bg-blue-600 hover:bg-blue-700 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                                        }
                                    `}
                                >
                                    {isLoading ? (
                                        <>
                                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Running Social SERP Search...
                                        </>
                                    ) : (
                                        'Run Social SERP Search'
                                    )}
                                </button>
                                <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-3">
                                    This tool makes 1 Live SERP request per selected platform. Estimate your DataForSEO cost accordingly.
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

                    {/* Results Section */}
                    {results && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-700 pb-4">
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Results</h2>
                                    <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                                        Found {results.reduce((acc, curr) => acc + curr.rows.length, 0)} results across {results.length} platforms.
                                    </p>
                                </div>
                                <button
                                    onClick={downloadExcel}
                                    className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                                >
                                    <Download className="h-4 w-4 mr-2" />
                                    Download Excel
                                </button>
                            </div>

                            <div className="grid grid-cols-1 gap-6">
                                {results.map((result) => (
                                    <div key={result.platform} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                                        <button
                                            onClick={() => togglePlatform(result.platform)}
                                            className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900/50 flex justify-between items-center hover:bg-gray-100 dark:hover:bg-gray-900/70 transition-colors"
                                        >
                                            <div className="flex items-center space-x-3">
                                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                                    {result.platform}
                                                </h3>
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                                    {result.rows.length} results
                                                </span>
                                            </div>
                                            <div className="flex items-center space-x-3">
                                                <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                                                    Query: {result.query}
                                                </span>
                                                <svg
                                                    className={`w-5 h-5 text-gray-500 transition-transform ${expandedPlatforms.has(result.platform) ? 'rotate-180' : ''}`}
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                    stroke="currentColor"
                                                >
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </div>
                                        </button>

                                        {expandedPlatforms.has(result.platform) && (
                                            <>
                                                {result.error ? (
                                                    <div className="p-6 text-center text-red-500 dark:text-red-400 text-sm border-t border-gray-200 dark:border-gray-700">
                                                        Error fetching results: {result.error}
                                                    </div>
                                                ) : result.rows.length === 0 ? (
                                                    <div className="p-8 text-center text-gray-500 dark:text-gray-400 italic border-t border-gray-200 dark:border-gray-700">
                                                        No results found for this platform.
                                                    </div>
                                                ) : (
                                                    <div className="overflow-x-auto border-t border-gray-200 dark:border-gray-700">
                                                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                                            <thead className="bg-gray-50 dark:bg-gray-900/30">
                                                                <tr>
                                                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-2/3">
                                                                        Title
                                                                    </th>
                                                                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                                        Action
                                                                    </th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                                                {result.rows.map((row, idx) => (
                                                                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                                                        <td className="px-6 py-4">
                                                                            <div className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2">
                                                                                {row.title}
                                                                            </div>
                                                                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate max-w-lg">
                                                                                {row.url}
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                                            <a
                                                                                href={row.url}
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 inline-flex items-center"
                                                                            >
                                                                                Open <ExternalLink className="h-3 w-3 ml-1" />
                                                                            </a>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </ThemeProvider>
    );
}
