# SERP Query Clustering App

A production-ready Next.js 14 application that analyzes SERP (Search Engine Results Page) data to discover content opportunities and identify cannibalization issues using AI-powered query fan-out and SERP-similarity clustering.

## Features

- **Query Fan-out**: Uses Gemini AI to generate diverse, semantically-related sub-queries covering multiple intents (informational, commercial, transactional, navigational)
- **SERP Analysis**: Retrieves real-time SERP data from DataForSEO API with support for multiple locations, languages, and devices
- **Intelligent Clustering**: Groups queries by SERP similarity using overlap-based connected components algorithm
- **Action Recommendations**: Provides actionable insights including:
  - Target page ranking status
  - Cannibalization detection
  - Content expansion opportunities
  - New page suggestions
- **AI Overview Detection**: Tracks presence of AI-generated overviews in search results
- **Export Capabilities**: Export results to CSV and JSON formats
- **Mock Mode**: Test the application without API credentials using sample data

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript (strict mode, no `any`)
- **Validation**: Zod
- **Styling**: Tailwind CSS
- **APIs**:
  - Google Gemini API (query generation & embeddings)
  - DataForSEO API v3 (SERP data)
- **Testing**: Jest
- **CSV Export**: PapaParse

## Prerequisites

- Node.js 18+ or compatible runtime
- pnpm (recommended) or npm
- Gemini API key ([Get one here](https://makersuite.google.com/app/apikey))
- DataForSEO API credentials ([Sign up here](https://dataforseo.com/))

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd serp-query-clustering-app
```

2. Install dependencies:
```bash
pnpm install
# or
npm install
```

3. Create environment file:
```bash
cp .env.example .env
```

4. (Optional) Add your API credentials to `.env`:
```env
GEMINI_API_KEY=your_gemini_api_key_here
DATAFORSEO_LOGIN=your_dataforseo_login_here
DATAFORSEO_PASSWORD=your_dataforseo_password_here
```

Note: You can also provide API credentials directly in the UI form.

## Running the Application

### Development Mode

```bash
pnpm dev
# or
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
pnpm build
pnpm start
# or
npm run build
npm start
```

### Running Tests

```bash
pnpm test
# or
npm test
```

## Usage

### Basic Workflow

1. **Fill in the Form**:
   - Enter your target query (e.g., "content marketing strategy")
   - Provide the URL of the page you want to analyze
   - Enter API credentials (or enable Mock Mode)
   - Adjust clustering threshold (1-10, default: 4)
   - Select location, language, and device

2. **Start Analysis**: Click "Start Analysis" to begin the three-step process:
   - **Fan-out**: Generates 15-40 related sub-queries
   - **SERP**: Fetches search results for each query
   - **Cluster**: Groups queries and generates recommendations

3. **Review Results**:
   - **Sub-Queries Table**: View generated queries with intent classification
   - **SERP Results**: See ranking data and AI Overview presence
   - **Clusters**: Examine query groupings by SERP similarity
   - **Actions**: Get specific recommendations for each query/cluster

4. **Export Data**: Download results as CSV or JSON for further analysis

### Mock Mode

Enable "Mock Mode" in the form to test the application without API credentials. This generates sample data for all steps.

### Example Analysis

**Target Query**: "best seo tools"
**Target Page**: "https://example.com/seo-tools-guide"

**Generated Sub-Queries** (sample):
- "what are the best seo tools" (info)
- "best seo tools for small business" (comm)
- "buy seo software" (trans)
- "seo tools comparison" (comm)
- "free vs paid seo tools" (info)

**Clustering Results** (with threshold=4):
- **Cluster 1**: Informational queries about tool features
- **Cluster 2**: Commercial comparison queries
- **Cluster 3**: Transactional purchase intent queries

**Action Recommendations**:
- ✅ Target page ranks for "best seo tools" → Great!
- ⚠️ Different page ranks for "seo tools comparison" in same cluster → Potential cannibalization
- ➕ Expand target page to cover "free vs paid seo tools"
- 🆕 Create new page for "buy seo software" (different intent)

## Configuration

### Clustering Overlap Threshold

The threshold (1-10) determines how similar queries must be to cluster together:
- **1-3 (Loose)**: Groups queries with minimal SERP overlap
- **4-6 (Moderate)**: Balanced grouping (recommended)
- **7-10 (Strict)**: Only clusters queries with high SERP similarity

### Location & Language Mapping

The app supports 17 locations and 13 languages. See `lib/types.ts` for complete mappings to DataForSEO codes.

## API Costs & Rate Limits

### DataForSEO Pricing

- **SERP API**: ~$0.1-0.5 per query (varies by location/device)
- **Rate Limits**: Approximately 2000 requests/hour (depends on plan)
- **Cost Example**: 30 sub-queries = ~$3-15 per analysis

The app implements:
- Exponential backoff on 429 errors
- Up to 4 retries for failed requests
- Batch processing with configurable concurrency (default: 5)

### Gemini API

- **Generous free tier**: 60 requests/minute
- **Cost**: Minimal for query generation and embeddings
- **Rate Limits**: Built-in retry logic with exponential backoff

## Project Structure

```
/app
  /api
    /fanout/route.ts      # Query fan-out endpoint
    /serp/route.ts        # SERP retrieval endpoint
    /cluster/route.ts     # Clustering & recommendations endpoint
  page.tsx                # Main UI page
  layout.tsx              # App layout
  globals.css             # Global styles
/lib
  gemini.ts               # Gemini API client
  dataforseo.ts           # DataForSEO API client
  cluster.ts              # Clustering algorithms
  bucketing.ts            # Action bucketing logic
  normalize.ts            # URL normalization utilities
  types.ts                # Shared TypeScript types
  errors.ts               # Typed error classes
/components
  Form.tsx                # Input form component
  Results.tsx             # Results display component
  Diagnostics.tsx         # Logs and diagnostics component
/tests
  normalize.test.ts       # Normalization tests
  cluster.test.ts         # Clustering tests
  bucketing.test.ts       # Bucketing tests
```

## Action Buckets Explained

### ✅ Great: Target page ranks
The target page ranks on page 1 for this query. No action needed.

### ✅ OK: Different topic
Another page from your domain ranks, but clustering suggests it covers a different topic. Keep separate.

### ⚠️ Cannibalization risk
Another page from your domain ranks for a query in the same cluster as your target. Consider:
1. Consolidating content into the target page
2. Using canonical tags
3. Adjusting internal linking

### ➕ Expand target page
High semantic similarity to target page content. Add a section addressing this query with:
- Relevant H2/H3 headings
- FAQs
- Internal links
- Schema markup

### 🆕 Create new page
Low semantic similarity. Create separate content piece with:
- Dedicated page structure
- Targeted keywords
- Unique value proposition

## Troubleshooting

### "Fan-out failed"
- Check Gemini API key is valid
- Ensure you have available quota
- Try enabling Mock Mode to test

### "SERP fetch failed"
- Verify DataForSEO credentials
- Check account balance
- Ensure location/language combination is valid
- Try reducing number of queries

### "Clustering failed"
- Ensure threshold is between 1-10
- Check that SERP results were successfully fetched
- Review diagnostics panel for specific errors

### Rate Limit Errors
- The app automatically retries with exponential backoff
- If persistent, wait a few minutes and try again
- Consider reducing concurrency or batch size

## Development

### Adding New Locations

Edit `lib/types.ts` and add to `LOCATION_MAP`:
```typescript
export const LOCATION_MAP: Record<string, number> = {
  // ... existing locations
  'New Location': 1234, // DataForSEO location code
};
```

### Adding New Languages

Edit `lib/types.ts` and add to `LANGUAGE_MAP`:
```typescript
export const LANGUAGE_MAP: Record<string, string> = {
  // ... existing languages
  'New Language': 'xx', // ISO language code
};
```

### Customizing Fan-out Prompt

Edit the prompt in `lib/gemini.ts` function `fanOutQueries()` to adjust query generation strategy.

## Security Notes

- API keys entered in the UI are kept in memory only (not persisted)
- Use environment variables for production deployments
- Never commit `.env` file to version control
- Consider using secret management services in production

## License

MIT

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## Support

For issues and feature requests, please open an issue on GitHub.

## Roadmap

- [ ] Support for additional search engines (Bing, Yahoo)
- [ ] Historical SERP tracking
- [ ] Competitor analysis features
- [ ] Automated reporting and alerts
- [ ] Integration with Google Search Console
- [ ] Bulk URL analysis

## Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- SERP data by [DataForSEO](https://dataforseo.com/)
- AI by [Google Gemini](https://ai.google.dev/)
