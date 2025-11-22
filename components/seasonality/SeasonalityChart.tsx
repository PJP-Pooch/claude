import React from 'react';
import { KeywordSeasonality } from '@/lib/types';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
    Legend
} from 'recharts';
import { format, parseISO } from 'date-fns';

interface SeasonalityChartProps {
    keywordData: KeywordSeasonality;
}

export default function SeasonalityChart({ keywordData }: SeasonalityChartProps) {
    // Combine history and forecast for the chart
    const historyData = keywordData.monthly.map(m => ({
        date: `${m.year}-${String(m.month).padStart(2, '0')}`,
        displayDate: `${m.year}-${String(m.month).padStart(2, '0')}`,
        volume: m.searchVolume,
        type: 'History'
    }));

    const forecastData = keywordData.forecastMonthly.map(m => ({
        date: `${m.year}-${String(m.month).padStart(2, '0')}`,
        displayDate: `${m.year}-${String(m.month).padStart(2, '0')}`,
        forecast: m.searchVolume,
        type: 'Forecast'
    }));

    // Merge data points that share the same date (transition point)
    const combinedData = [...historyData];

    forecastData.forEach(f => {
        const existing = combinedData.find(d => d.date === f.date);
        if (existing) {
            // @ts-ignore
            existing.forecast = f.forecast;
        } else {
            combinedData.push({
                ...f,
                volume: undefined
            } as any);
        }
    });

    combinedData.sort((a, b) => a.date.localeCompare(b.date));

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 h-96">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {keywordData.keyword}
                    </h3>
                    <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400 mt-1">
                        <span>Peak: {keywordData.peakMonth} ({keywordData.peakVolume.toLocaleString()})</span>
                        <span>Start Optimizing: {keywordData.startOptimizingDate}</span>
                    </div>
                </div>
                <div className="text-right">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${keywordData.seasonalityType === 'Sharp Seasonal' ? 'bg-red-100 text-red-800' :
                            keywordData.seasonalityType === 'Growing' ? 'bg-green-100 text-green-800' :
                                'bg-blue-100 text-blue-800'
                        }`}>
                        {keywordData.seasonalityType}
                    </span>
                </div>
            </div>

            <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                    data={combinedData}
                    margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                    <defs>
                        <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8} />
                            <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10B981" stopOpacity={0.8} />
                            <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                        dataKey="displayDate"
                        tickFormatter={(str) => {
                            const [y, m] = str.split('-');
                            return `${m}/${y.slice(2)}`;
                        }}
                        minTickGap={30}
                    />
                    <YAxis />
                    <Tooltip
                        labelFormatter={(label) => format(parseISO(label), 'MMMM yyyy')}
                        formatter={(value: number) => [value.toLocaleString(), undefined]}
                    />
                    <Legend />
                    <ReferenceLine x={keywordData.startOptimizingDate.substring(0, 7)} stroke="red" label="Start" strokeDasharray="3 3" />
                    <Area
                        type="monotone"
                        dataKey="volume"
                        name="Historical Volume"
                        stroke="#3B82F6"
                        fillOpacity={1}
                        fill="url(#colorVolume)"
                    />
                    <Area
                        type="monotone"
                        dataKey="forecast"
                        name="Forecast"
                        stroke="#10B981"
                        strokeDasharray="5 5"
                        fillOpacity={1}
                        fill="url(#colorForecast)"
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
