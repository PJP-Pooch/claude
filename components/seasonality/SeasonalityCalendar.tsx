import React from 'react';
import { KeywordSeasonality } from '@/lib/types';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths } from 'date-fns';

interface SeasonalityCalendarProps {
    keywords: KeywordSeasonality[];
    onSelectKeyword: (keyword: KeywordSeasonality) => void;
}

export default function SeasonalityCalendar({ keywords, onSelectKeyword }: SeasonalityCalendarProps) {
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
            'Subject', 'Start Date', 'Description', 'Priority', 'Seasonality Type'
        ];

        const rows: string[][] = [];

        Object.values(tasksByMonth).forEach(monthTasks => {
            monthTasks.forEach(task => {
                rows.push([
                    `Start optimizing: ${task.keyword}`,
                    task.startOptimizingDate,
                    `Peak in ${task.peakMonth}. ${task.contentSuggestion}`,
                    task.priorityScore.toFixed(1),
                    task.seasonalityType
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
                        <div className="divide-y divide-gray-200 dark:divide-gray-700">
                            {tasks.map(task => (
                                <div
                                    key={task.keyword}
                                    onClick={() => onSelectKeyword(task)}
                                    className="p-4 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer transition-colors flex items-center justify-between"
                                >
                                    <div>
                                        <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                                            Start optimizing: {task.keyword}
                                        </h4>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                            Peak in {task.peakMonth} • Priority: {task.priorityScore.toFixed(1)}
                                        </p>
                                    </div>
                                    <div className="flex items-center space-x-4">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${task.seasonalityType === 'Sharp Seasonal' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                                            }`}>
                                            {task.seasonalityType}
                                        </span>
                                        <span className="text-sm text-gray-500 dark:text-gray-400">
                                            {format(parseISO(task.startOptimizingDate), 'MMM d')}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
