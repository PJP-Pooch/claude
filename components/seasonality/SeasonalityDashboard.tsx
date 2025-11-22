import React, { useState } from 'react';
import { KeywordSeasonality, SeasonalityResponse } from '@/lib/types';
import { ArrowUpDown, Download, Filter, Search } from 'lucide-react';

interface SeasonalityDashboardProps {
    data: SeasonalityResponse;
    onSelectKeyword: (keyword: KeywordSeasonality) => void;
    selectedKeyword: KeywordSeasonality | null;
}

type SortField = 'keyword' | 'average' | 'peakVolume' | 'percentDifference' | 'priorityScore' | 'startOptimizingDate';
type SortDirection = 'asc' | 'desc';

export default function SeasonalityDashboard({ data, onSelectKeyword, selectedKeyword }: SeasonalityDashboardProps) {
    const [filter, setFilter] = useState('');
    const [sortField, setSortField] = useState<SortField>('priorityScore');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
    const [showHighPriorityOnly, setShowHighPriorityOnly] = useState(false);
    const [showNext90DaysOnly, setShowNext90DaysOnly] = useState(false);

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    const filteredKeywords = data.keywords.filter(k => {
        const matchesSearch = k.keyword.toLowerCase().includes(filter.toLowerCase()) ||
            (k.category && k.category.toLowerCase().includes(filter.toLowerCase()));

        if (!matchesSearch) return false;

        if (showHighPriorityOnly && k.priorityScore < 3) return false; // Arbitrary threshold

        if (showNext90DaysOnly) {
            const days = (new Date(k.startOptimizingDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24);
            if (days < 0 || days > 90) return false;
        }

        return true;
    });

    const sortedKeywords = [...filteredKeywords].sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];

        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    const downloadCSV = () => {
        const headers = [
            'Keyword', 'Category', 'Average SV', 'Peak Month', 'Peak Vol',
            '% Diff', 'Priority', 'Start Date', 'Type', 'Content Stage'
        ];

        const rows = sortedKeywords.map(k => [
            k.keyword,
            k.category || '',
            k.average,
            k.peakMonth,
            k.peakVolume,
            k.percentDifference.toFixed(1),
            k.priorityScore.toFixed(1),
            k.startOptimizingDate,
            k.seasonalityType,
            k.contentStage
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', 'seasonality_export.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        placeholder="Search keywords or categories..."
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                    />
                </div>

                <div className="flex items-center space-x-4">
                    <label className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300">
                        <input
                            type="checkbox"
                            checked={showHighPriorityOnly}
                            onChange={(e) => setShowHighPriorityOnly(e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span>High Priority</span>
                    </label>

                    <label className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300">
                        <input
                            type="checkbox"
                            checked={showNext90DaysOnly}
                            onChange={(e) => setShowNext90DaysOnly(e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span>Next 90 Days</span>
                    </label>

                    <button
                        onClick={downloadCSV}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                        <Download className="h-4 w-4 mr-2" />
                        Export
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900">
                        <tr>
                            {[
                                { id: 'keyword', label: 'Keyword' },
                                { id: 'average', label: 'Avg SV' },
                                { id: 'peakVolume', label: 'Peak Vol' },
                                { id: 'percentDifference', label: '% Diff' },
                                { id: 'startOptimizingDate', label: 'Start By' },
                                { id: 'priorityScore', label: 'Priority' },
                            ].map((col) => (
                                <th
                                    key={col.id}
                                    scope="col"
                                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                                    onClick={() => handleSort(col.id as SortField)}
                                >
                                    <div className="flex items-center space-x-1">
                                        <span>{col.label}</span>
                                        <ArrowUpDown className="h-3 w-3" />
                                    </div>
                                </th>
                            ))}
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Type
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {sortedKeywords.map((k) => (
                            <tr
                                key={k.keyword}
                                onClick={() => onSelectKeyword(k)}
                                className={`cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors ${selectedKeyword?.keyword === k.keyword ? 'bg-blue-50 dark:bg-blue-900/30' : ''
                                    }`}
                            >
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-gray-900 dark:text-white">{k.keyword}</div>
                                    {k.category && (
                                        <div className="text-xs text-gray-500 dark:text-gray-400">{k.category}</div>
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                    {k.average.toLocaleString()}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                    {k.peakVolume.toLocaleString()}
                                    <span className="text-xs text-gray-400 block">{k.peakMonth}</span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                    <span className={`font-medium ${k.percentDifference > 75 ? 'text-green-600 dark:text-green-400' :
                                            k.percentDifference > 25 ? 'text-yellow-600 dark:text-yellow-400' :
                                                'text-gray-500'
                                        }`}>
                                        +{k.percentDifference.toFixed(0)}%
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                    {k.startOptimizingDate}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                    <div className="flex items-center">
                                        <div className="w-16 bg-gray-200 rounded-full h-2 mr-2 dark:bg-gray-700">
                                            <div
                                                className="bg-blue-600 h-2 rounded-full"
                                                style={{ width: `${Math.min(k.priorityScore * 10, 100)}%` }}
                                            ></div>
                                        </div>
                                        {k.priorityScore.toFixed(1)}
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${k.seasonalityType === 'Sharp Seasonal' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                                            k.seasonalityType === 'Growing' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                                'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                                        }`}>
                                        {k.seasonalityType}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
