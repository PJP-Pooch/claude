# Implementation Plan: GSC Export Enhancements & Roadmap

## 1. Advanced Filtering Features
**Objective:** Add granular filtering for 'Page' and 'Query' dimensions to refine data exports.

### Frontend Changes (`app/tools/gsc-export/page.tsx`)
- **New State Variables:**
  - `pageFilterType`: 'contains' | 'equals' | 'notContains' | 'notEquals' | 'includingRegex' | 'excludingRegex'
  - `pageFilterValue`: string
  - `queryFilterType`: (same options as above)
  - `queryFilterValue`: string
- **UI Components:**
  - Add collapsible "Advanced Filters" section.
  - Implement dropdowns for filter types and text inputs for values (matching the user's reference image).
  - Add "Reset Filters" functionality.
- **Logic Update:**
  - Modify `handleFetchData` to construct the `filters` array dynamically based on the new state variables before sending to the API.

### Backend Changes (`app/api/gsc/query/route.ts`)
- No major changes required as the API already accepts and forwards a `filters` array to the Google Search Console API.

## 2. Cannibalization Analysis
**Objective:** Identify queries where multiple pages from the same domain are competing for rankings, potentially splitting traffic.

### Implementation Logic
1. **Data Requirement:** Ensure `query` and `page` dimensions are both selected.
2. **Processing Algorithm:**
   - Group fetched rows by `query`.
   - For each query, collect all unique `page` URLs.
   - **Flag Condition:** If a query has > 1 unique page with > X impressions (e.g., 10) or > 0 clicks.
   - **Metrics Calculation:** Calculate total clicks/impressions for the query and the share of each page.
3. **Visualization:**
   - Display a "Cannibalization Report" table.
   - Columns: `Query`, `Competing Pages (Count)`, `Top Page`, `Secondary Page`, `Total Clicks`, `Lost Opportunity (est.)`.
   - Allow expanding a row to see the specific pages and their individual metrics (Position, CTR, Clicks).

## 3. Query Counting Analysis (New Request)
**Objective:** Track the number of unique queries a page ranks for over time to measure content growth or decay.

### Implementation Logic
1. **Data Requirement:** Ensure `page`, `query`, and `date` dimensions are selected.
2. **Processing Algorithm:**
   - Group rows by `page` and `month` (derived from date).
   - Count unique `query` values for each page-month combination.
   - Identify top X pages by total query count to visualize.
3. **Visualization:**
   - **Chart:** Line chart showing "Unique Queries" over time for the top 5-10 pages.
   - **Table:** Page | Month | Query Count | Change vs Previous Month.

## 4. Brainstorming & Roadmap (SEO Stack Inspired)
**Target Audience:** Pooch and Mutt SEO Team (D2C Pet Food Brand)
**Goal:** High-impact, low-effort tools to drive organic growth.

| Feature Idea | Description | Impact | Effort | Priority |
| :--- | :--- | :--- | :--- | :--- |
| **Query Counting** | **(Planned)** Track the breadth of a page's keyword footprint over time. Rising counts = growing authority. | High | Medium | 1 |
| **Content Decay Tracker** | Identify pages that have lost significant traffic/rankings over the last 3-6 months compared to the previous period. | High | Medium | 2 |
| **Striking Distance Keywords** | Filter queries ranking in positions 4-20. "Low hanging fruit" for optimization. | High | Low | 3 |
| **Zero-Click Search Analysis** | Analyze queries with high impressions but low CTR (excluding position factors). | Medium | Medium | 4 |
| **Brand vs. Non-Brand Split** | Automatically categorize queries into "Brand" and "Non-Brand". | High | Low | 5 |
| **Product Category Performance** | Regex-based grouping of pages into categories (e.g., `/dry-food/`) to track aggregate performance. | High | Medium | 6 |
| **Seasonality Overlay** | Overlay GSC data with the "Seasonal Search Volume Explorer" data. | Medium | High | 7 |

## Next Steps
1. Implement **Advanced Filters** (Page/Query).
2. Implement **Cannibalization Analysis**.
3. Implement **Query Counting Analysis**.
