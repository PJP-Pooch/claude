# Implementation Plan: Custom Period Selection for PoP Comparison

## Objective
Implement custom period selection for Period-over-Period (PoP) comparison in the GSC Export tool. This allows users to compare the current selected date range against a previous period (e.g., previous period, same period last year, or a custom range) to analyze performance changes.

## 1. UI Enhancements (app/tools/gsc-export/page.tsx)
-   **Add "Compare" Toggle**: A switch/checkbox to enable comparison mode.
-   **Add Comparison Range Selector**:
    -   Options: "Previous period" (default), "Previous year", "Custom".
    -   When "Custom" is selected, show Start/End date pickers for the comparison range.
-   **Display Selected Ranges**: Clearly show the "Current Period" and "Comparison Period" dates to the user.

## 2. State Management
-   Expand `compareMode` (boolean) usage.
-   Add state:
    -   `compareType`: 'previous_period' | 'previous_year' | 'custom'
    -   `compareStartDate`: string
    -   `compareEndDate`: string

## 3. Data Fetching Logic (handleFetchData)
-   **Current Behavior**: Fetches a single date range.
-   **New Behavior**:
    -   If `compareMode` is active:
        -   Calculate `currentRange` (start, end).
        -   Calculate `compareRange` (start, end) based on `compareType`.
        -   **Strategy**: Perform two parallel API requests to `/api/gsc/query`.
            -   Request 1: Current Period data.
            -   Request 2: Comparison Period data.
        -   **Data Merging**:
            -   Tag rows from Request 1 as `period: 'current'`.
            -   Tag rows from Request 2 as `period: 'compare'`.
            -   Combine into a unified `data` state array (or keep separate state if cleaner, but unified fits current architecture better, provided we handle the specific analysis logic).
            -   *Alternative*: Keep using `data` for the "Current" view, and `compareData` for the comparison?
            -   *Decision*: Unified `data` array is risky because other charts (like "Over Time") might get confused by non-contiguous dates (e.g., last year vs this year).
            -   **Better Strategy**: Store `compareData` separately or add a `period` property to the `GscRow` type (or a wrapper type) so downstream components know which period a row belongs to.
            -   However, strict `GscRow` compatibility is needed for existing `filteredData` logic.
            -   *Refined Strategy*:
                -   Main `data` state holds **Current Period** data (preserves existing charts).
                -   New state `comparisonData` holds **Comparison Period** data.
                -   `popAnalysis` memo will use both `data` and `comparisonData` to compute diffs.

## 4. Analysis Logic Updates
-   **`popAnalysis`**:
    -   Currently splits `filteredData` by date midpoint.
    -   **Update**:
        -   Accept `filteredData` (Current) and `comparisonData` (Previous).
        -   Match rows by keys (Query/Page).
        -   Compute `current` metrics from `filteredData`.
        -   Compute `prev` metrics from `comparisonData`.
        -   Calculate diffs.

## 5. Backend Changes
-   No changes expected in `/api/gsc/query` if it handles standard date ranges correctly.

## 6. Validation
-   Verify "Previous Period" calculations (e.g. if current is 7 days, previous is preceding 7 days).
-   Verify "Previous Year" matching.
-   Verify "Custom" ranges.
-   Ensure existing charts (Trends, etc.) continue to show "Current" data correctly without being polluted by "Comparison" data (or decide if they should show both).
-   *Note*: The "Trend" chart might want to show both lines? For now, stick to PoP table being the primary consumer.

