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

    return (
        <div className="space-y-8">
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
