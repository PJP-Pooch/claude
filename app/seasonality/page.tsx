'use client';

import React, { useState } from 'react';
import { SeasonalityResponse, KeywordSeasonality } from '@/lib/types';
import SeasonalityInput from '@/components/seasonality/SeasonalityInput';
import SeasonalityDashboard from '@/components/seasonality/SeasonalityDashboard';
import SeasonalityChart from '@/components/seasonality/SeasonalityChart';
import SeasonalityCalendar from '@/components/seasonality/SeasonalityCalendar';
import { Calendar, LayoutDashboard, TrendingUp } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import { ThemeProvider } from '@/components/ThemeProvider';

type ViewMode = 'dashboard' | 'calendar';

export default function SeasonalityPage() {
    const [data, setData] = useState<SeasonalityResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedKeyword, setSelectedKeyword] = useState<KeywordSeasonality | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
    const [lastInput, setLastInput] = useState<any>(null);

    const handleSubmit = async (inputData: any) => {
        setIsLoading(true);
        setError(null);
        setData(null);
        setSelectedKeyword(null);
        setLastInput(inputData);

        try {
            const response = await fetch('/api/seasonality', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(inputData),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to fetch seasonality data');
            }

            setData(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    const handleNewSearch = () => {
        setData(null);
        setError(null);
        setSelectedKeyword(null);
    };

    return (
        <ThemeProvider>
            <ThemeToggle />
            <main className="min-h-screen bg-gray-100 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8 transition-colors">
                <div className="w-full mx-auto">
                    {/* Header with Back Button */}
                    <div className="mb-6 flex items-center justify-between pr-16">
                        <a
                            href="/"
                            className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                        >
                            <svg
                                className="w-5 h-5 mr-2"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                                />
                            </svg>
                            <span className="font-medium">Back to Tools</span>
                        </a>
                    </div>

                    <div className="mb-8">
                        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                            Seasonal Search Volume Explorer
                        </h1>
                        <p className="text-gray-600 dark:text-gray-300">
                            Analyze historical search trends, forecast future demand, and plan your content calendar.
                        </p>
                    </div>

                    {/* Split Layout: Input Left, Results Right */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Left Column: Input Form */}
                        <div className="lg:col-span-1">
                            <SeasonalityInput
                                onSubmit={handleSubmit}
                                isLoading={isLoading}
                                initialValues={lastInput}
                            />
                        </div>

                        {/* Right Column: Results */}
                        <div className="lg:col-span-2">
                            {error && (
                                <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-400 p-4 mb-6">
                                    <div className="flex">
                                        <div className="flex-shrink-0">
                                            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                        <div className="ml-3">
                                            <p className="text-sm text-red-700 dark:text-red-200">{error}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {data ? (
                                <div className="space-y-6">
                                    {/* View Toggles and Actions */}
                                    <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 pb-4">
                                        <div className="flex space-x-4">
                                            <button
                                                onClick={() => setViewMode('dashboard')}
                                                className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${viewMode === 'dashboard'
                                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                                                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                                                    }`}
                                            >
                                                <LayoutDashboard className="w-4 h-4 mr-2" />
                                                Dashboard
                                            </button>
                                            <button
                                                onClick={() => setViewMode('calendar')}
                                                className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${viewMode === 'calendar'
                                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                                                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                                                    }`}
                                            >
                                                <Calendar className="w-4 h-4 mr-2" />
                                                Calendar
                                            </button>
                                        </div>
                                        <button
                                            onClick={handleNewSearch}
                                            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                                        >
                                            New Search
                                        </button>
                                    </div>

                                    {/* Full Width Dashboard or Calendar */}
                                    {viewMode === 'dashboard' && (
                                        <SeasonalityDashboard
                                            data={data}
                                            onSelectKeyword={setSelectedKeyword}
                                            selectedKeyword={selectedKeyword}
                                        />
                                    )}
                                    {viewMode === 'calendar' && (
                                        <SeasonalityCalendar
                                            keywords={data.keywords}
                                            onSelectKeyword={setSelectedKeyword}
                                        />
                                    )}

                                    {/* Chart Below Table - Full Width */}
                                    {selectedKeyword && (
                                        <div className="space-y-6">
                                            {/* Chart Container - Bigger */}
                                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                                                    {selectedKeyword.keyword} - Historical & Forecast
                                                </h3>
                                                <div className="h-96 w-full">
                                                    <SeasonalityChart keywordData={selectedKeyword} />
                                                </div>
                                            </div>

                                            {/* Planning Insights */}
                                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                                                    Planning Insights
                                                </h3>
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                    <div>
                                                        <span className="text-sm text-gray-500 dark:text-gray-400 block">Content Stage</span>
                                                        <span className="font-medium text-gray-900 dark:text-white text-lg">{selectedKeyword.contentStage}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-sm text-gray-500 dark:text-gray-400 block">Lead Time</span>
                                                        <span className="font-medium text-gray-900 dark:text-white text-lg">{selectedKeyword.leadTimeDays} days</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-sm text-gray-500 dark:text-gray-400 block">Start Date</span>
                                                        <span className="font-medium text-blue-600 dark:text-blue-400 text-lg">{selectedKeyword.startOptimizingDate}</span>
                                                    </div>
                                                </div>
                                                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                                                    <span className="text-sm text-gray-500 dark:text-gray-400 block mb-2">Suggestion</span>
                                                    <p className="text-sm text-gray-700 dark:text-gray-300">
                                                        {selectedKeyword.contentSuggestion}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* SERP Data */}
                                            {selectedKeyword.serpData && (
                                                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                                                        SERP Intelligence
                                                    </h3>
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                                                        <div>
                                                            <span className="text-sm text-gray-500 dark:text-gray-400 block">Search Intent</span>
                                                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium mt-1 ${selectedKeyword.serpData.intent === 'Transactional' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                                                    selectedKeyword.serpData.intent === 'Commercial' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                                                        selectedKeyword.serpData.intent === 'Informational' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                                                                            'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                                                                }`}>
                                                                {selectedKeyword.serpData.intent}
                                                            </span>
                                                        </div>
                                                        {selectedKeyword.serpData.difficulty !== undefined && (
                                                            <div>
                                                                <span className="text-sm text-gray-500 dark:text-gray-400 block">Keyword Difficulty</span>
                                                                <div className="flex items-center mt-2">
                                                                    <div className="w-full bg-gray-200 rounded-full h-3 mr-3 dark:bg-gray-700">
                                                                        <div
                                                                            className={`h-3 rounded-full ${selectedKeyword.serpData.difficulty > 70 ? 'bg-red-600' :
                                                                                    selectedKeyword.serpData.difficulty > 40 ? 'bg-yellow-600' :
                                                                                        'bg-green-600'
                                                                                }`}
                                                                            style={{ width: `${selectedKeyword.serpData.difficulty}%` }}
                                                                        ></div>
                                                                    </div>
                                                                    <span className="font-medium text-gray-900 dark:text-white">{selectedKeyword.serpData.difficulty}/100</span>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {selectedKeyword.serpData.cpc !== undefined && (
                                                            <div>
                                                                <span className="text-sm text-gray-500 dark:text-gray-400 block">CPC</span>
                                                                <span className="font-medium text-gray-900 dark:text-white text-lg">${selectedKeyword.serpData.cpc.toFixed(2)}</span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {selectedKeyword.serpData.serpFeatures.length > 0 && (
                                                        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                                                            <span className="text-sm text-gray-500 dark:text-gray-400 block mb-2">SERP Features</span>
                                                            <div className="flex flex-wrap gap-2">
                                                                {selectedKeyword.serpData.serpFeatures.map((feature, idx) => (
                                                                    <span key={idx} className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                                                                        {feature}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {selectedKeyword.serpData.topUrls.length > 0 && (
                                                        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                                                            <span className="text-sm text-gray-500 dark:text-gray-400 block mb-3">Top Ranking URLs</span>
                                                            <div className="space-y-2">
                                                                {selectedKeyword.serpData.topUrls.map((urlData, idx) => (
                                                                    <div key={idx} className="flex items-start space-x-3 text-sm">
                                                                        <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 font-medium text-xs">
                                                                            {urlData.position}
                                                                        </span>
                                                                        <div className="flex-1 min-w-0">
                                                                            <p className="text-gray-900 dark:text-white font-medium truncate">{urlData.title}</p>
                                                                            <a href={urlData.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline truncate block text-xs">
                                                                                {urlData.url}
                                                                            </a>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="bg-white dark:bg-gray-800 p-12 rounded-lg shadow-md text-center">
                                    <div className="text-gray-400 dark:text-gray-500 mb-4">
                                        <TrendingUp className="mx-auto h-24 w-24" />
                                    </div>
                                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Ready to Analyze</h3>
                                    <p className="text-gray-600 dark:text-gray-400">
                                        Fill in the form and click "Get Seasonal Search Volumes" to begin.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </ThemeProvider>
    );
}
