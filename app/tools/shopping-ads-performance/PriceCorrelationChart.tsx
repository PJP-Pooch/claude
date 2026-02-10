"use client";

import React from 'react';
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

type ProductData = {
    title: string;
    price: number;
    competitiveData?: {
        yourRank: number | null;
        lowestPrice: number;
        priceGap: number;
        competitorCount: number;
    } | null;
};

interface PriceCorrelationChartProps {
    products: ProductData[];
}

export default function PriceCorrelationChart({ products }: PriceCorrelationChartProps) {
    // Filter products that have competitive data and a valid rank
    const data = products
        .filter(p => p.competitiveData && p.competitiveData.yourRank && p.competitiveData.lowestPrice > 0)
        .map(p => {
            const gap = p.competitiveData!.priceGap;
            const lowest = p.competitiveData!.lowestPrice;
            const gapPercent = (gap / lowest) * 100;

            return {
                name: p.title.substring(0, 30) + '...',
                fullTitle: p.title,
                rank: p.competitiveData!.yourRank,
                gapPercent: parseFloat(gapPercent.toFixed(1)),
                price: p.price,
                competitors: p.competitiveData!.competitorCount
            };
        });

    if (data.length < 3) {
        return (
            <div className="flex items-center justify-center h-64 bg-gray-50 dark:bg-gray-800 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
                <p className="text-gray-500 text-sm">Not enough data for correlation analysis (need at least 3 ranked products)</p>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Price Competitiveness vs. Rank Correlation
            </h3>
            <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis
                            type="number"
                            dataKey="gapPercent"
                            name="Price Gap %"
                            unit="%"
                            domain={['dataMin - 5', 'dataMax + 5']}
                            label={{ value: 'Price Difference vs Lowest Competitor (%)', position: 'bottom', offset: 0 }}
                        />
                        <YAxis
                            type="number"
                            dataKey="rank"
                            name="Rank"
                            reversed={true} // Rank 1 is top
                            domain={[1, 'dataMax + 1']}
                            label={{ value: 'Google Shopping Rank', angle: -90, position: 'insideLeft' }}
                        />
                        <ZAxis type="number" dataKey="competitors" range={[50, 400]} name="Competitors" />
                        <Tooltip
                            cursor={{ strokeDasharray: '3 3' }}
                            content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                    const data = payload[0].payload;
                                    return (
                                        <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded shadow-lg text-xs">
                                            <p className="font-bold mb-1">{data.fullTitle}</p>
                                            <p>Rank: #{data.rank}</p>
                                            <p className={data.gapPercent > 0 ? "text-red-500" : "text-green-500"}>
                                                Price Gap: {data.gapPercent > 0 ? '+' : ''}{data.gapPercent}%
                                            </p>
                                            <p className="text-gray-500">{data.competitors} competitors</p>
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />
                        <Legend />
                        <Scatter name="Products" data={data} fill="#3b82f6" fillOpacity={0.6} />
                    </ScatterChart>
                </ResponsiveContainer>
            </div>
            <p className="mt-4 text-xs text-center text-gray-500">
                Chart shows how your price gap (%) correlates with ranking. High negative gap (cheaper) should theoretically correlate with better (lower number) rank.
            </p>
        </div>
    );
}
