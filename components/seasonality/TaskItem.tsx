import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { KeywordSeasonality } from '@/lib/types';
import { format } from 'date-fns';
import SeasonalityChart from './SeasonalityChart';
import { getActionType } from '@/lib/seasonality';

interface TaskItemProps {
    task: KeywordSeasonality;
    month: Date;
    onMove: (keyword: string, currentMonth: string, direction: 'prev' | 'next') => void;
    onRemove: (keyword: string) => void;
}

export default function TaskItem({ task, month, onMove, onRemove }: TaskItemProps) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: task.keyword,
        data: {
            task,
            originalMonth: format(month, 'yyyy-MM')
        }
    });

    const style = {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 1000 : 'auto',
        position: 'relative' as 'relative', // Explicitly cast to match CSSProperties
    };

    return (
        <div ref={setNodeRef} style={style} className="border-b border-gray-200 dark:border-gray-700 last:border-b-0">
            <details className="group">
                <summary className="p-4 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer transition-colors flex items-center justify-between list-none">
                    <div className="flex items-center flex-1">
                        {/* Drag Handle */}
                        <div
                            className="mr-3 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            {...attributes}
                            {...listeners}
                            onClick={(e) => e.stopPropagation()} // Prevent details toggle when clicking handle
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                            </svg>
                        </div>

                        <div>
                            <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                                {task.keyword}
                            </h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Peak in {task.peakMonth} • Priority: {task.priorityScore.toFixed(1)}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center space-x-2">
                        <div className="flex items-center space-x-1 mr-2">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onMove(task.keyword, format(month, 'yyyy-MM'), 'prev');
                                }}
                                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:text-gray-500 dark:hover:text-gray-300 dark:hover:bg-gray-700 rounded transition-colors"
                                title="Move to Prev Month"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onMove(task.keyword, format(month, 'yyyy-MM'), 'next');
                                }}
                                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:text-gray-500 dark:hover:text-gray-300 dark:hover:bg-gray-700 rounded transition-colors"
                                title="Move to Next Month"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onRemove(task.keyword);
                                }}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:text-gray-500 dark:hover:text-red-400 dark:hover:bg-red-900/20 rounded transition-colors"
                                title="Remove from Calendar"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </button>
                        </div>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getActionType(task).color}`}>
                            {getActionType(task).type}
                        </span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${task.seasonalityType === 'Sharp Seasonal' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                            }`}>
                            {task.seasonalityType}
                        </span>
                        <span className="transform group-open:rotate-180 transition-transform ml-2">
                            <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </span>
                    </div>
                </summary>

                <div className="p-6 bg-gray-50 dark:bg-gray-900/50 space-y-4 cursor-default" onPointerDown={(e) => e.stopPropagation()}>
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
                    {task.serpData && task.serpData.topUrls && task.serpData.topUrls.length > 0 && (
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

                            {/* AI Overview & Target Domain Status */}
                            <div className="grid grid-cols-2 gap-4 mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                                <div>
                                    <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">AI Overview</span>
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${task.serpData.serpFeatures?.includes('AI Overview') ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}>
                                        {task.serpData.serpFeatures?.includes('AI Overview') ? '✓ Present' : '✗ Not Present'}
                                    </span>
                                </div>
                                {task.serpData.inAiOverview !== undefined && (
                                    <div>
                                        <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Your Domain in AI Overview</span>
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${task.serpData.inAiOverview ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}>
                                            {task.serpData.inAiOverview ? '✓ Yes' : '✗ No'}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Target Domain Ranking */}
                            {task.serpData.currentRank !== undefined && task.serpData.currentUrl && (
                                <div className="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                                    <span className="text-xs text-gray-500 dark:text-gray-400 block mb-2">Your Domain Ranking</span>
                                    <div className="flex items-start space-x-2">
                                        <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 font-bold text-xs">
                                            #{task.serpData.currentRank}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <a href={task.serpData.currentUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline truncate block text-xs">
                                                {task.serpData.currentUrl}
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* AI Overview Content */}
                            {task.serpData.aiOverviewText && (
                                <details className="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                                    <summary className="text-xs text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300 mb-2">
                                        AI Overview Content (Click to expand)
                                    </summary>
                                    <div className="mt-2 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                                        {task.serpData.aiOverviewText}
                                    </div>
                                </details>
                            )}

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
        </div>
    );
}
