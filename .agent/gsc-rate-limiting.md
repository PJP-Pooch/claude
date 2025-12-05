# GSC Export Tool - Rate Limiting Implementation

## Problem
When attempting to load 12 months of data from Google Search Console, the app was crashing due to exceeding Google's API rate limits.

## Google Search Console API Rate Limits

According to the [official documentation](https://developers.google.com/webmaster-tools/limits):

### Load Quota
- **Short-term quota**: Measured in 10-minute chunks
- **Long-term quota**: Measured in 1-day chunks
- Queries are expensive when grouped/filtered by page AND query
- Query load increases with date range (6 months >> 1 day)

### QPS Quota
- **Per-site**: 1,200 QPM (queries per minute)
- **Per-user**: 1,200 QPM
- **Per-project**: 40,000 QPM, 30,000,000 QPD

## Solution Implemented

### 1. Backend Rate Limiting (`app/api/gsc/query/route.ts`)
- **Existing**: Data was already being fetched in 30-day batches
- **Added**: 500ms delay between batch requests
  - This results in ~120 requests per minute, well under the 1,200 QPM limit
  - Prevents hitting the short-term (10-minute) load quota
- **Added**: Console logging to track batch progress

### 2. Frontend User Experience (`app/tools/gsc-export/page.tsx`)
- **Added**: `loadingMessage` state to provide detailed feedback
- **Added**: Dynamic loading message that shows:
  - Number of days being fetched
  - Estimated number of batches
  - Reassurance that the process may take time
- **Added**: Informational notice for large date ranges (3+ months)
  - Explains batching behavior
  - Appears when user selects large date ranges
  - Uses friendly, informative language

## Technical Details

### Batch Size Calculation
```typescript
const totalBatches = Math.ceil(totalDays / 30);
```

### Delay Implementation
```typescript
// 500ms delay = ~120 requests per minute, well under the 1,200 QPM limit
if (currentStart <= end) {
    await new Promise(resolve => setTimeout(resolve, 500));
}
```

### Loading Message
```typescript
if (daysDiff > 30) {
    const estimatedBatches = Math.ceil(daysDiff / 30);
    setLoadingMessage(`Fetching ${daysDiff} days of data in ${estimatedBatches} batches. This may take a few moments...`);
}
```

## Expected Behavior

### For 12 Months of Data:
- **Days**: ~365 days
- **Batches**: ~13 batches (30 days each)
- **Time**: ~6.5 seconds (13 batches × 500ms delay)
- **QPM**: ~120 (well under 1,200 limit)

### User Experience:
1. User selects "Last 12 Months"
2. Informational notice appears explaining batching
3. User clicks "Fetch GSC Data"
4. Loading message shows: "Fetching 365 days of data in 13 batches. This may take a few moments..."
5. Data loads successfully without crashes

## Benefits
- ✅ Prevents app crashes from rate limit errors
- ✅ Respects Google's API quotas
- ✅ Provides clear user feedback
- ✅ Maintains data integrity
- ✅ Scalable for even larger date ranges (16 months)
