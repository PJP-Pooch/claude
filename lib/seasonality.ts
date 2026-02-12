import { KeywordSeasonality, MonthlySV, SeasonalityType, ContentStage } from './types';
import { addDays, format, subMonths, getMonth, getYear, parseISO, differenceInDays } from 'date-fns';

// ============================================================================
// Constants & Configuration
// ============================================================================

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

// ============================================================================
// Core Logic
// ============================================================================

/**
 * Analyzes historical search volume to produce seasonality metrics and forecasts
 */
export function analyzeSeasonality(
    keyword: string,
    history: MonthlySV[],
    leadTimeDays: number = 90,
    category?: string
): KeywordSeasonality {
    // 1. Basic Metrics
    const validHistory = history.filter(h => h.searchVolume >= 0);
    const volumes = validHistory.map(h => h.searchVolume);

    const average = volumes.length > 0
        ? Math.round(volumes.reduce((a, b) => a + b, 0) / volumes.length)
        : 0;

    const peakVolume = volumes.length > 0 ? volumes.reduce((max, val) => Math.max(max, val), 0) : 0;
    const difference = peakVolume - average;
    const percentDifference = average > 0 ? (difference / average) * 100 : 0;

    // Calculate YoY Growth
    let yoyGrowth = 0;
    if (validHistory.length >= 13) {
        const lastPoint = validHistory[validHistory.length - 1];
        if (lastPoint) {
            const previousYearPoint = validHistory.find(
                h => h.year === lastPoint.year - 1 && h.month === lastPoint.month
            );

            if (previousYearPoint && previousYearPoint.searchVolume > 0) {
                yoyGrowth = ((lastPoint.searchVolume - previousYearPoint.searchVolume) / previousYearPoint.searchVolume) * 100;
            }
        }
    }

    // 2. Identify Peak Month (based on average of all years if multiple years exist)
    // Group by month index (1-12)
    const monthTotals = new Array(13).fill(0);
    const monthCounts = new Array(13).fill(0);

    validHistory.forEach(h => {
        monthTotals[h.month] += h.searchVolume;
        monthCounts[h.month]++;
    });

    let peakMonthIndex = 1;
    let maxAvgMonthVol = -1;

    for (let i = 1; i <= 12; i++) {
        const avg = monthCounts[i] > 0 ? monthTotals[i] / monthCounts[i] : 0;
        if (avg > maxAvgMonthVol) {
            maxAvgMonthVol = avg;
            peakMonthIndex = i;
        }
    }

    const peakMonth = MONTH_NAMES[peakMonthIndex - 1];

    // 3. Forecasting (Simple Seasonal Naive + Trend)
    // If we have data for the same month last year, use it. 
    // Otherwise fallback to average.
    const forecastMonthly: MonthlySV[] = [];
    const lastDate = validHistory.length > 0
        ? new Date(validHistory[validHistory.length - 1]!.year, validHistory[validHistory.length - 1]!.month - 1)
        : new Date();

    for (let i = 1; i <= 12; i++) {
        const futureDate = addDays(lastDate, i * 30); // Approx next month
        const targetMonth = getMonth(futureDate) + 1; // 1-12
        const targetYear = getYear(futureDate);

        // Find same month in history
        const sameMonthData = validHistory.filter(h => h.month === targetMonth);

        let forecastVal = average;
        if (sameMonthData.length > 0) {
            // Use the most recent year's data for that month, or average of last 2 years
            forecastVal = sameMonthData[sameMonthData.length - 1]!.searchVolume;
        }

        forecastMonthly.push({
            year: targetYear,
            month: targetMonth,
            searchVolume: Math.round(forecastVal),
            isForecast: true
        });
    }

    // 4. Actionability & Planning
    // "Start Optimizing By": Peak date minus lead time
    // We need the NEXT occurrence of the peak month
    const today = new Date();
    let nextPeakDate = new Date(today.getFullYear(), peakMonthIndex - 1, 1);

    if (nextPeakDate < today) {
        nextPeakDate.setFullYear(today.getFullYear() + 1);
    }

    const startOptimizingDate = subMonths(nextPeakDate, Math.floor(leadTimeDays / 30));

    // Priority Score (0-10)
    // Factors: Volume, Seasonal Growth, Urgency, YoY Trend
    const volumeScore = Math.min(average / 1000, 4); // Max 4 points for volume (reduced to make room for other factors)
    const growthScore = Math.min(Math.max(percentDifference / 50, 0), 3); // Max 3 points for seasonal growth

    const daysToStart = differenceInDays(startOptimizingDate, today);
    let urgencyScore = 0;
    if (daysToStart < 0) urgencyScore = 2; // Overdue
    else if (daysToStart < 30) urgencyScore = 2; // Urgent
    else if (daysToStart < 60) urgencyScore = 1; // Upcoming

    // YoY Growth Bonus (0-1 points) - Prioritize growing keywords
    let yoyScore = 0;
    if (yoyGrowth > 20) yoyScore = 1; // Strong growth
    else if (yoyGrowth > 10) yoyScore = 0.5; // Moderate growth
    else if (yoyGrowth < -10) yoyScore = -0.5; // Declining keywords get penalized

    const priorityScore = Math.min(Math.max(volumeScore + growthScore + urgencyScore + yoyScore, 0), 10);

    // Seasonality Type Classification
    let seasonalityType: SeasonalityType = 'Mixed';
    if (percentDifference > 200) seasonalityType = 'Sharp Seasonal'; // Very strong seasonal pattern (e.g., harvest mites)
    else if (percentDifference > 100) seasonalityType = 'Growing'; // Strong seasonal pattern
    else if (percentDifference > 30) seasonalityType = 'Steady'; // Moderate variation
    else if (percentDifference < -30) seasonalityType = 'Declining'; // Declining trend
    else seasonalityType = 'Mixed'; // Relatively flat

    // Content Stage
    let contentStage: ContentStage = 'Off-season';
    if (daysToStart < 0 && daysToStart > -30) contentStage = 'Pre-peak';
    else if (daysToStart <= -30 && daysToStart > -90) contentStage = 'Near-peak';
    else if (daysToStart <= -90) contentStage = 'Post-peak';

    // Content Suggestion
    let contentSuggestion = '';
    if (seasonalityType === 'Sharp Seasonal') {
        contentSuggestion = `Prepare content ${leadTimeDays} days in advance. Focus on timely updates and social promotion during peak.`;
    } else if (seasonalityType === 'Growing') {
        contentSuggestion = 'Invest in evergreen content and link building to capture long-term growth.';
    } else {
        contentSuggestion = 'Maintain consistent content schedule. Focus on conversion optimization.';
    }

    return {
        keyword,
        monthly: validHistory,
        forecastMonthly,
        average,
        peakMonth: MONTH_NAMES[peakMonthIndex - 1] || 'Unknown',
        peakMonthIndex,
        peakVolume,
        difference,
        percentDifference,
        yoyGrowth,
        leadTimeDays,
        startOptimizingDate: format(startOptimizingDate, 'yyyy-MM-dd'),
        priorityScore,
        seasonalityType,
        contentStage,
        contentSuggestion,
        category
    };
}

/**
 * Aggregates seasonality data by category
 */
export function aggregateByCategory(keywords: KeywordSeasonality[]) {
    const categories: Record<string, {
        average: number;
        peakMonth: string;
        keywords: string[];
    }> = {};

    const grouped = keywords.reduce((acc, k) => {
        const cat = k.category || 'Uncategorized';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(k);
        return acc;
    }, {} as Record<string, KeywordSeasonality[]>);

    Object.entries(grouped).forEach(([cat, items]) => {
        const totalAvg = items.reduce((sum, k) => sum + k.average, 0);

        // Find aggregate peak month
        const monthTotals = new Array(13).fill(0);
        items.forEach(k => {
            k.monthly.forEach(m => {
                monthTotals[m.month] += m.searchVolume;
            });
        });

        let peakMonthIndex = 1;
        let maxVol = -1;
        for (let i = 1; i <= 12; i++) {
            if (monthTotals[i] > maxVol) {
                maxVol = monthTotals[i];
                peakMonthIndex = i;
            }
        }

        categories[cat] = {
            average: Math.round(totalAvg),
            peakMonth: MONTH_NAMES[peakMonthIndex - 1] || 'Unknown',
            keywords: items.map(k => k.keyword)
        };
    });

    return categories;
}

export const getActionType = (keyword: KeywordSeasonality): { type: 'Upcycle' | 'Review' | 'New Content'; color: string } => {
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
