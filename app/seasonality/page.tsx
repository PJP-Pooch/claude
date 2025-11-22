'use client';

import React, { useState } from 'react';
import { SeasonalityResponse, KeywordSeasonality } from '@/lib/types';
import SeasonalityInput from '@/components/seasonality/SeasonalityInput';
import SeasonalityDashboard from '@/components/seasonality/SeasonalityDashboard';
import SeasonalityChart from '@/components/seasonality/SeasonalityChart';
import SeasonalityCalendar from '@/components/seasonality/SeasonalityCalendar';
import { Calendar, LayoutDashboard, TrendingUp } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';

type ViewMode = 'dashboard' | 'calendar';

export default function SeasonalityPage() {
    const [data, setData] = useState<SeasonalityResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedKeyword, setSelectedKeyword] = useState<KeywordSeasonality | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>('dashboard');

    const handleSubmit = async (inputData: any) => {
        setIsLoading(true);
        setError(null);
        setData(null);
        setSelectedKeyword(null);

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

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
                <div className="mb-8 flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                            Seasonal Search Volume Explorer
                        </h1>
                        <p className="mt-2 text-gray-600 dark:text-gray-400">
                            Analyze historical search trends, forecast future demand, and plan your content calendar.
                        </p>
                    </div>
                    <ThemeToggle />
                </div>

                {!data && (
                    <SeasonalityInput onSubmit={handleSubmit} isLoading={isLoading} />
                )}

                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-400 p-4 mb-8">
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

                {data && (
                    <div className="space-y-6">
                        {/* View Toggles */}
                        <div className="flex space-x-4 border-b border-gray-200 dark:border-gray-700 pb-4">
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

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Main Content Area (2/3 width) */}
                            <div className="lg:col-span-2 space-y-6">
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
                            </div>

                            {/* Sidebar / Details Panel (1/3 width) */}
                            <div className="lg:col-span-1 space-y-6">
                                {selectedKeyword ? (
                                    <div className="sticky top-6 space-y-6">
                                        <SeasonalityChart keywordData={selectedKeyword} />

                                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                                                Planning Insights
                                            </h3>
                                            <div className="space-y-4">
                                                <div>
                                                    <span className="text-sm text-gray-500 dark:text-gray-400 block">Content Stage</span>
                                                    <span className="font-medium text-gray-900 dark:text-white">{selectedKeyword.contentStage}</span>
                                                </div>
                                                <div>
                                                    <span className="text-sm text-gray-500 dark:text-gray-400 block">Suggestion</span>
                                                    <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                                                        {selectedKeyword.contentSuggestion}
                                                    </p>
                                                </div>
                                                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-gray-500 dark:text-gray-400">Lead Time</span>
                                                        <span className="font-medium text-gray-900 dark:text-white">{selectedKeyword.leadTimeDays} days</span>
                                                    </div>
                                                    <div className="flex justify-between text-sm mt-2">
                                                        <span className="text-gray-500 dark:text-gray-400">Start Date</span>
                                                        <span className="font-medium text-blue-600 dark:text-blue-400">{selectedKeyword.startOptimizingDate}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center text-gray-500 dark:text-gray-400">
                                        <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                        <p>Select a keyword to see detailed analysis and forecast.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
