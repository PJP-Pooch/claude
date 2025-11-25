import React from 'react';
import { KeywordSeasonality } from '@/lib/types';
import { format, parseISO, addMonths } from 'date-fns';
import SeasonalityChart from './SeasonalityChart';

interface SeasonalityCalendarProps {
    keywords: KeywordSeasonality[];
    onSelectKeyword: (keyword: KeywordSeasonality) => void;
}

export default function SeasonalityCalendar({ keywords, onSelectKeyword }: SeasonalityCalendarProps) {
    // Determine action type based on current ranking
    const getActionType = (keyword: KeywordSeasonality): { type: 'Upcycle' | 'Review' | 'New Content'; color: string } => {
        const rank = keyword.serpData?.currentRank;

        if (!rank) {
            return { type: 'New Content', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' };
        }

        if (rank <= 20) {
            return { type: 'Upcycle', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' };
        }

        // rank 21-100
        return { type: 'Review', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' };
    };

    // Group tasks by month
    const tasksByMonth: Record<string, KeywordSeasonality[]> = {};

    keywords.forEach(k => {
        const date = k.startOptimizingDate;
        const monthKey = date.substring(0, 7); // YYYY-MM
        if (!tasksByMonth[monthKey]) {
            tasksByMonth[monthKey] = [];
        }
        tasksByMonth[monthKey].push(k);
    });

    // Get next 12 months
    const today = new Date();
    const months = Array.from({ length: 12 }, (_, i) => addMonths(today, i));

    const downloadCalendarCSV = () => {
        const headers = [
            'Subject', 'Start Date', 'Description', 'Priority', 'Seasonality Type', 'Action'
        ];

        const rows: string[][] = [];

        Object.values(tasksByMonth).forEach(monthTasks => {
            monthTasks.forEach(task => {
                const action = getActionType(task);
                rows.push([
                    task.keyword,
                    task.startOptimizingDate,
                    `Peak in ${task.peakMonth}. ${task.contentSuggestion}`,
                    task.priorityScore.toFixed(1),
                    task.seasonalityType,
                    action.type
                ]);
            });
        });

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', 'seasonality_calendar.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-8">
            <div className="flex justify-end">
                <button
                    onClick={downloadCalendarCSV}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                    Export Calendar
                </button>
            </div>
            {months.map(month => {
                const monthKey = format(month, 'yyyy-MM');
                const tasks = tasksByMonth[monthKey] || [];

                if (tasks.length === 0) return null;

                return (
                    <div key={monthKey} className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                        <div className="bg-gray-50 dark:bg-gray-900 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                {format(month, 'MMMM yyyy')}
                            </h3>
                        </div>
                        <div>
                            {tasks.map(task => (
                                <details key={task.keyword} className="group border-b border-gray-200 dark:border-gray-700 last:border-b-0">
                                    <summary className="p-4 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer transition-colors flex items-center justify-between list-none">
                                        <div>
                                            <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                                                {task.keyword}
                                            </h4>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                Peak in {task.peakMonth} • Priority: {task.priorityScore.toFixed(1)}
                                            </p>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getActionType(task).color}`}>
                                                {getActionType(task).type}
                                            </span>
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${task.seasonalityType === 'Sharp Seasonal' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                                                }`}>
                                                {task.seasonalityType}
                                            </span>
                                            <span className="text-sm text-gray-500 dark:text-gray-400">
                                                {format(parseISO(task.startOptimizingDate), 'MMM d')}
                                            </span>
                                            <span className="transform group-open:rotate-180 transition-transform ml-2">
                                                <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </span>
                                        </div>
                                    </summary>
                                    <div className="p-6 bg-gray-50 dark:bg-gray-900/50 space-y-4">
                                        {/* Chart */}
                                        <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
                                            <h5 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Historical & Forecast</h5>
                                            <div className="h-64 w-full">
                                                <SeasonalityChart keywordData={task} minimal={true} />
                                            </div>
                                        </div>

                                        {/* Planning Insights */}
                                        <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
                                            <h5 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Planning Insights</h5>
                                            <div className="grid grid-cols-3 gap-4 mb-4">
                                                <div>
                                                    <span className="text-xs text-gray-500 dark:text-gray-400 block">Content Stage</span>
                                                    <span className="text-sm text-gray-900 dark:text-white font-medium">{task.contentStage}</span>
                                                </div>
                                                <div>
                                                    <span className="text-xs text-gray-500 dark:text-gray-400 block">Lead Time</span>
                                                    <span className="text-sm text-gray-900 dark:text-white font-medium">{task.leadTimeDays} days</span>
                                                </div>
                                                <div>
                                                    <span className="text-xs text-gray-500 dark:text-gray-400 block">Start Date</span>
                                                    <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">{task.startOptimizingDate}</span>
                                                </div>
                                            </div>
                                            <div>
                                                <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Suggestion</span>
                                                <p className="text-sm text-gray-700 dark:text-gray-300">{task.contentSuggestion}</p>
                                            </div>
                                        </div>

                                        {/* SERP Intelligence */}
                                        {task.serpData && (
                                            <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
                                                <h5 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">SERP Intelligence</h5>
                                                <div className="grid grid-cols-3 gap-4 mb-4">
                                                    <div>
                                                        <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Search Intent</span>
                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${task.serpData.intent === 'Transactional' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                                            task.serpData.intent === 'Commercial' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                                                task.serpData.intent === 'Informational' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                                                                    'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                                                            }`}>
                                                            {task.serpData.intent}
                                                        </span>
                                                    </div>
                                                    {task.serpData.difficulty !== undefined && (
                                                        <div>
                                                            <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Difficulty</span>
                                                            <span className="text-sm text-gray-900 dark:text-white font-medium">{task.serpData.difficulty}/100</span>
                                                        </div>
                                                    )}
                                                    {task.serpData.cpc !== undefined && (
                                                        <div>
                                                            <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">CPC</span>
                                                            <span className="text-sm text-gray-900 dark:text-white font-medium">${task.serpData.cpc.toFixed(2)}</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* SERP Features */}
                                                {task.serpData.serpFeatures && task.serpData.serpFeatures.length > 0 && (
                                                    <div className="mb-4">
                                                        <span className="text-xs text-gray-500 dark:text-gray-400 block mb-2">SERP Features</span>
                                                        <div className="flex flex-wrap gap-1">
                                                            {task.serpData.serpFeatures.map((feature, idx) => (
                                                                <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                                                                    {feature}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Top URLs */}
                                                {task.serpData.topUrls && task.serpData.topUrls.length > 0 && (
                                                    <div>
                                                        <span className="text-xs text-gray-500 dark:text-gray-400 block mb-2">Top Ranking URLs</span>
                                                        <div className="space-y-2">
                                                            {task.serpData.topUrls.map((urlData, idx) => (
                                                                <div key={idx} className="flex items-start space-x-2 text-xs">
                                                                    <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 font-medium">
                                                                        {urlData.position}
                                                                    </span>
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="text-gray-900 dark:text-white font-medium truncate">{urlData.title}</p>
                                                                        <a href={urlData.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline truncate block">
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
                                </details>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
