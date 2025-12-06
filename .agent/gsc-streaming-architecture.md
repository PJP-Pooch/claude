# GSC Export Tool - Streaming & Rate Limiting

## Overview
To handle large date ranges (e.g., 12-16 months) from Google Search Console without crashing or timing out, we implemented a streaming architecture combined with backend rate limiting.

## Architecture

### 1. Streaming Response (Backend)
Located in `app/api/gsc/query/route.ts`.

Instead of waiting for all data to be fetched before sending a response (which leads to timeouts), the API now streams data using `TransformStream`.

- **Format**: Newline Delimited JSON (NDJSON)
- **Events**:
  - `progress`: `{ type: 'progress', current: 1, total: 13, message: 'Fetching batch 1/13...' }`
  - `complete`: `{ type: 'complete', rows: [...] }`
  - `error`: `{ type: 'error', message: '...' }`

### 2. Stream Consumption (Frontend)
Located in `app/tools/gsc-export/page.tsx`.

The frontend uses the Fetch API's `Response.body.getReader()` to consume the stream.

- **Chunk Processing**: Reads raw binary chunks and decodes them to text.
- **Line Parsing**: Splits text by newline to isolate individual JSON messages.
- **State Updates**:
  - Updates `loadingMessage` in real-time on `progress` events.
  - Updates data state on `complete` events.

### 3. Rate Limiting
To respect Google's quota:
- **Batch Size**: 30 days
- **Delay**: 500ms between batch requests
- **QPM Control**: keeps usage at ~120 QPM (Limit is 1,200 QPM)

## Benefits
1.  **Eliminates Timeouts**: The connection stays active with frequent progress updates, preventing 504 Gateway Timeouts on long requests (~40s+).
2.  **User Experience**: Users see actual progress ("Batch 5 of 13") instead of a frozen loading spinner.
3.  **Reliability**: Rate limiting prevents "Quota Exceeded" errors from Google.
