import React, { useState } from 'react';
import { LOCATION_MAP, LANGUAGE_MAP } from '@/lib/types';

interface SeasonalityInputProps {
    onSubmit: (data: {
        keywords: string[];
        location: string;
        language: string;
        leadTimeDays: number;
        categoryMap: Record<string, string>;
        apiLogin?: string;
        apiPassword?: string;
    }) => void;
    isLoading: boolean;
    initialValues?: {
        keywords: string[];
        location: string;
        language: string;
        leadTimeDays: number;
        categoryMap: Record<string, string>;
        apiLogin?: string;
        apiPassword?: string;
    };
}

export default function SeasonalityInput({ onSubmit, isLoading, initialValues }: SeasonalityInputProps) {
    const [input, setInput] = useState(() => {
        if (!initialValues) return '';
        return initialValues.keywords.map(k => {
            const cat = initialValues.categoryMap[k];
            return cat ? `${k} | ${cat}` : k;
        }).join('\n');
    });
    const [location, setLocation] = useState(initialValues?.location || 'United Kingdom');
    const [language, setLanguage] = useState(initialValues?.language || 'English');
    const [leadTime, setLeadTime] = useState(initialValues?.leadTimeDays || 90);
    const [apiLogin, setApiLogin] = useState(initialValues?.apiLogin || '');
    const [apiPassword, setApiPassword] = useState(initialValues?.apiPassword || '');
    const [showApiCreds, setShowApiCreds] = useState(!!initialValues?.apiLogin);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const lines = input.split('\n').map(l => l.trim()).filter(l => l);
        if (lines.length === 0) {
            setError('Please enter at least one keyword.');
            return;
        }

        if (lines.length > 500) {
            setError(`Too many keywords (${lines.length}). Please limit to 500.`);
            return;
        }

        // Parse categories if present (format: "keyword | category")
        const keywords: string[] = [];
        const categoryMap: Record<string, string> = {};

        lines.forEach(line => {
            const parts = line.split('|').map(p => p.trim());
            const keyword = parts[0];
            if (keyword) {
                keywords.push(keyword);
                if (parts.length > 1 && parts[1]) {
                    categoryMap[keyword] = parts[1];
                }
            }
        });

        onSubmit({
            keywords,
            location,
            language,
            leadTimeDays: leadTime,
            categoryMap,
            apiLogin: apiLogin || undefined,
            apiPassword: apiPassword || undefined,
        });
    };

    const loadExample = () => {
        setInput(
            "winter coats | Clothing\nsummer dresses | Clothing\nchristmas gifts | Seasonal\nsunscreen | Health\nflu vaccine | Health\nback to school supplies | Events\nhalloween costumes | Events\nvalentines day gifts | Events"
        );
    };

    const clearInput = () => {
        setInput('');
        setError(null);
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Keywords (one per line)
                        </label>
                        <div className="space-x-4">
                            <button
                                type="button"
                                onClick={clearInput}
                                className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            >
                                Clear
                            </button>
                            <button
                                type="button"
                                onClick={loadExample}
                                className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400"
                            >
                                Paste Example
                            </button>
                        </div>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                        Optional: Add category with pipe, e.g. "keyword | category"
                    </p>
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        rows={10}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white font-mono text-sm"
                        placeholder="winter coats&#10;summer dresses | Clothing&#10;..."
                        disabled={isLoading}
                    />
                    {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Location
                        </label>
                        <select
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            disabled={isLoading}
                        >
                            {Object.keys(LOCATION_MAP).map(loc => (
                                <option key={loc} value={loc}>{loc}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Language
                        </label>
                        <select
                            value={language}
                            onChange={(e) => setLanguage(e.target.value)}
                            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            disabled={isLoading}
                        >
                            {Object.keys(LANGUAGE_MAP).map(lang => (
                                <option key={lang} value={lang}>{lang}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Lead Time (Days)
                        </label>
                        <select
                            value={leadTime}
                            onChange={(e) => setLeadTime(Number(e.target.value))}
                            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            disabled={isLoading}
                        >
                            <option value={30}>30 Days</option>
                            <option value={60}>60 Days</option>
                            <option value={90}>90 Days</option>
                            <option value={120}>120 Days</option>
                        </select>
                    </div>
                </div>

                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <button
                        type="button"
                        onClick={() => setShowApiCreds(!showApiCreds)}
                        className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 flex items-center"
                    >
                        <span className="mr-1">{showApiCreds ? '▼' : '▶'}</span>
                        API Settings (Optional)
                    </button>

                    {showApiCreds && (
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-md">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    DataForSEO Login
                                </label>
                                <input
                                    type="text"
                                    value={apiLogin}
                                    onChange={(e) => setApiLogin(e.target.value)}
                                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    placeholder="email@example.com"
                                    disabled={isLoading}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    DataForSEO Password
                                </label>
                                <input
                                    type="password"
                                    value={apiPassword}
                                    onChange={(e) => setApiPassword(e.target.value)}
                                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    placeholder="API Password"
                                    disabled={isLoading}
                                />
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 md:col-span-2">
                                Leave blank to use server-side environment variables.
                            </p>
                        </div>
                    )}
                </div>

                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={isLoading}
                        className={`px-6 py-2 rounded-md text-white font-medium ${isLoading
                            ? 'bg-blue-400 cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                            }`}
                    >
                        {isLoading ? (
                            <span className="flex items-center">
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Fetching Data...
                            </span>
                        ) : (
                            'Get Seasonal Search Volumes'
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}
