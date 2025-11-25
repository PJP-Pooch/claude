import React, { useState } from 'react';
import { KeywordSeasonality } from '@/lib/types';
import { format, parseISO, addMonths, subMonths, startOfMonth } from 'date-fns';
import { DndContext, DragEndEvent, DragOverlay, useSensor, useSensors, PointerSensor, useDroppable } from '@dnd-kit/core';
import TaskItem from './TaskItem';

interface SeasonalityCalendarProps {
    keywords: KeywordSeasonality[];
    onSelectKeyword: (keyword: KeywordSeasonality) => void;
}

function DroppableMonth({ month, children }: { month: Date, children: React.ReactNode }) {
    const { setNodeRef, isOver } = useDroppable({
        id: format(month, 'yyyy-MM'),
        data: { month }
    });

    return (
        <div ref={setNodeRef} className={`bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden transition-shadow ${isOver ? 'ring-2 ring-blue-500 ring-opacity-50' : ''}`}>
            <div className="bg-gray-50 dark:bg-gray-900 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {format(month, 'MMMM yyyy')}
                </h3>
            </div>
            <div className="min-h-[50px]">
                {children}
            </div>
        </div>
    );
}

export default function SeasonalityCalendar({ keywords, onSelectKeyword }: SeasonalityCalendarProps) {
    const [removedKeywords, setRemovedKeywords] = useState<Set<string>>(new Set());
    const [movedKeywords, setMovedKeywords] = useState<Record<string, string>>({});
    const [startMonth, setStartMonth] = useState<Date>(startOfMonth(new Date()));
    const [activeId, setActiveId] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    );

    const handleRemove = (keyword: string) => {
        const newRemoved = new Set(removedKeywords);
        newRemoved.add(keyword);
        setRemovedKeywords(newRemoved);
    };

    const handleMove = (keyword: string, currentMonth: string, direction: 'prev' | 'next') => {
        const currentDate = parseISO(currentMonth + '-01');
        const newDate = direction === 'next' ? addMonths(currentDate, 1) : subMonths(currentDate, 1);
        const newDateStr = format(newDate, 'yyyy-MM-dd');

        setMovedKeywords(prev => ({
            ...prev,
            [keyword]: newDateStr
        }));
    };

    const handleDragStart = (event: any) => {
        setActiveId(event.active.id);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (over && active.id) {
            const keyword = active.id as string;
            // If dropped on a month container (which has id 'yyyy-MM')
            // or dropped on another task (we need to find the month)

            // Since we are using Droppable for months, 'over.id' should be the month string
            // unless we implement sortable lists.
            // Let's assume over.id is the month key 'yyyy-MM'.

            const targetMonthStr = over.id as string;

            // Simple validation to check if it looks like a date
            if (!targetMonthStr.match(/^\d{4}-\d{2}$/)) {
                // If dropped on a task, we might need to find its parent container or just ignore
                // For now, let's assume we only drop on the month container
                return;
            }

            const newDateStr = targetMonthStr + '-01';

            setMovedKeywords(prev => ({
                ...prev,
                [keyword]: newDateStr
            }));
        }
    };

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
        if (removedKeywords.has(k.keyword)) return;

        // Use moved date if available, otherwise original date
        const date = movedKeywords[k.keyword] || k.startOptimizingDate;
        const monthKey = date.substring(0, 7); // YYYY-MM
        if (!tasksByMonth[monthKey]) {
            tasksByMonth[monthKey] = [];
        }
        tasksByMonth[monthKey].push(k);
    });

    // Get next 12 months starting from selected start month
    const months = Array.from({ length: 12 }, (_, i) => addMonths(startMonth, i));

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
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="space-y-8">
                <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-4">
                        <label htmlFor="startMonth" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Start Month:
                        </label>
                        <input
                            type="month"
                            id="startMonth"
                            value={format(startMonth, 'yyyy-MM')}
                            onChange={(e) => setStartMonth(parseISO(e.target.value + '-01'))}
                            className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        />
                    </div>
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

                    return (
                        <DroppableMonth key={monthKey} month={month}>
                            {tasks.length === 0 ? (
                                <div className="p-4 text-sm text-gray-400 dark:text-gray-500 text-center italic">
                                    No tasks planned for this month
                                </div>
                            ) : (
                                tasks.map(task => (
                                    <TaskItem
                                        key={task.keyword}
                                        task={task}
                                        month={month}
                                        onMove={handleMove}
                                        onRemove={handleRemove}
                                    />
                                ))
                            )}
                        </DroppableMonth>
                    );
                })}
            </div>
            <DragOverlay>
                {activeId ? (
                    <div className="bg-white dark:bg-gray-800 p-4 rounded shadow-lg border border-blue-500 opacity-90">
                        <span className="font-medium text-gray-900 dark:text-white">{activeId}</span>
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
}
