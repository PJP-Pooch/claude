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

    const peakVolume = Math.max(...volumes, 0);
    const difference = peakVolume - average;
    const percentDifference = average > 0 ? (difference / average) * 100 : 0;

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

    const startOptimizingDate = addDays(nextPeakDate, -leadTimeDays);

    // 5. Priority Score
    // Log(Avg + 1) * (1 + Seasonality/100)
    // Higher volume + higher seasonality = higher priority
    const seasonalityScore = percentDifference / 100;
    const priorityScore = Math.log10(average + 1) * (1 + seasonalityScore);

    // 6. Seasonality Type Classification
    let seasonalityType: SeasonalityType = 'Steady';
    if (percentDifference > 75) {
        seasonalityType = 'Sharp Seasonal';
    } else if (percentDifference > 25) {
        seasonalityType = 'Mixed';
    } else {
        // Check trend
        const firstHalf = volumes.slice(0, Math.floor(volumes.length / 2));
        const secondHalf = volumes.slice(Math.floor(volumes.length / 2));
        const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / (firstHalf.length || 1);
        const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / (secondHalf.length || 1);

        if (avgSecond > avgFirst * 1.2) seasonalityType = 'Growing';
        else if (avgSecond < avgFirst * 0.8) seasonalityType = 'Declining';
    }

    // 7. Content Stage
    // Determine where we are relative to the next peak
    const daysToPeak = differenceInDays(nextPeakDate, today);
    let contentStage: ContentStage = 'Off-season';
    let contentSuggestion = '';

    if (daysToPeak > 90 && daysToPeak <= 180) {
        contentStage = 'Pre-peak';
        contentSuggestion = 'Create/update long-form content, plan internal links.';
    } else if (daysToPeak > 30 && daysToPeak <= 90) {
        contentStage = 'Near-peak';
        contentSuggestion = 'Push internal links, add promo modules, optimize for snippets.';
    } else if (daysToPeak >= -30 && daysToPeak <= 30) {
        contentStage = 'Near-peak'; // Active peak
        contentSuggestion = 'Monitor performance, ensure technical stability.';
    } else if (daysToPeak < -30 && daysToPeak > -90) {
        contentStage = 'Post-peak';
        contentSuggestion = 'Review performance, update notes, archive promos.';
    } else {
        contentStage = 'Off-season';
        contentSuggestion = 'Maintain evergreen value, plan for next cycle.';
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
