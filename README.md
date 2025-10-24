# Query Fan Out Analysis

A production-ready Next.js 14 application that analyzes SERP (Search Engine Results Page) data to discover content opportunities and identify cannibalization issues using AI-powered query fan-out and SERP-similarity clustering.

## Features

- **Query Fan-out**: Uses OpenAI to generate diverse, semantically-related sub-queries covering multiple intents (informational, commercial, transactional, navigational)
- **SERP Analysis**: Retrieves real-time SERP data from DataForSEO API with support for multiple locations, languages, and devices
- **Intelligent Clustering**: Groups queries by SERP similarity using overlap-based connected components algorithm
- **Action Recommendations**: Provides actionable insights including:
  - Target page ranking status
  - Cannibalization detection
  - Content expansion opportunities
  - New page suggestions
- **AI Overview Detection**: Tracks presence of AI-generated overviews in search results with expandable content viewer
- **Dark Mode Support**: Toggle between light and dark themes for comfortable viewing
- **Enhanced UI**: Collapsible sections, resizable table columns, and expandable row details
- **Export Capabilities**: Export results to CSV and JSON formats
- **Mock Mode**: Test the application without API credentials using sample data

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript (strict mode, no `any`)
- **Validation**: Zod
- **Styling**: Tailwind CSS with dark mode support
- **APIs**:
  - OpenAI API (query generation and content briefs)
  - DataForSEO API v3 (SERP data)
- **Testing**: Jest
- **CSV Export**: PapaParse
- **UI Enhancements**: Collapsible sections, resizable columns, theme switching

## Prerequisites

- Node.js 18+ or compatible runtime
- npm or pnpm (recommended)
- OpenAI API key ([Get one here](https://platform.openai.com/api-keys))
- DataForSEO API credentials ([Sign up here](https://dataforseo.com/))

## Installation

### For Windows Users

1. Clone the repository:
```powershell
git clone <repository-url>
cd serp-query-clustering-app
```

2. Install dependencies:
```powershell
npm install
# or if you have pnpm
pnpm install
```

3. Create environment file:
```powershell
copy .env.example .env
```

4. (Optional) Add your API credentials to `.env`:
```env
OPENAI_API_KEY=your_openai_api_key_here
NEXT_PUBLIC_OPENAI_API_KEY=your_openai_api_key_here
DATAFORSEO_LOGIN=your_dataforseo_login_here
DATAFORSEO_PASSWORD=your_dataforseo_password_here
NEXT_PUBLIC_DATAFORSEO_LOGIN=your_dataforseo_login_here
NEXT_PUBLIC_DATAFORSEO_PASSWORD=your_dataforseo_password_here

# Optional: Set default configuration
DEFAULT_LOCATION=United Kingdom
DEFAULT_LANGUAGE=English
DEFAULT_DEVICE=desktop
DEFAULT_CLUSTERING_OVERLAP=4
NEXT_PUBLIC_DEFAULT_LOCATION=United Kingdom
NEXT_PUBLIC_DEFAULT_LANGUAGE=English
NEXT_PUBLIC_DEFAULT_DEVICE=desktop
NEXT_PUBLIC_DEFAULT_CLUSTERING_OVERLAP=4
NEXT_PUBLIC_MOCK_MODE=false
```

### For Linux/macOS Users

1. Clone the repository:
```bash
git clone <repository-url>
cd serp-query-clustering-app
```

2. Install dependencies:
```bash
npm install
# or
pnpm install
```

3. Create environment file:
```bash
cp .env.example .env
```

4. (Optional) Add your API credentials to `.env` (same format as Windows above)

**Note:** You can also provide API credentials directly in the UI form. Environment variables will pre-populate the form fields.

## Running the Application

### Development Mode

**Windows (PowerShell):**
```powershell
npm run dev
# or
pnpm dev
```

**Linux/macOS:**
```bash
npm run dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

**Windows (PowerShell):**
```powershell
npm run build
npm start
# or
pnpm build
pnpm start
```

**Linux/macOS:**
```bash
npm run build
npm start
# or
pnpm build
pnpm start
```

### Running Tests

**Both Windows and Linux/macOS:**
```bash
npm test
# or
pnpm test
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

### Dark Mode

Toggle between light and dark themes using the theme switcher button in the top-right corner of the application. Your preference is automatically saved to browser local storage.

**Features:**
- System-wide dark mode support
- Persistent theme selection
- Optimized for reduced eye strain during extended analysis sessions
- All UI components support both themes

### UI Enhancements

**Collapsible Sections:**
Click on section headers to expand/collapse content areas:
- Sub-Queries
- SERP Results
- AI Overviews
- Clusters
- Recommendations

**Resizable Columns:**
In the SERP Results table, drag column borders to adjust widths according to your preference.

**Expandable Rows:**
Click on any SERP result row to view detailed information including:
- Full query text
- Complete URL lists
- AI Overview content (when present)
- All ranking positions

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

### OpenAI API

- **Pricing**: Pay-as-you-go (typically $0.002-0.01 per query generation)
- **Cost Example**: 30 sub-queries = ~$0.06-0.30 per analysis
- **Rate Limits**: Varies by tier; built-in retry logic with exponential backoff
- **Models Used**: GPT-4 or GPT-3.5-turbo (configurable)

## Project Structure

```
/app
  /api
    /fanout/route.ts      # Query fan-out endpoint (OpenAI)
    /serp/route.ts        # SERP retrieval endpoint (DataForSEO)
    /cluster/route.ts     # Clustering & recommendations endpoint
  page.tsx                # Main UI page with dark mode support
  layout.tsx              # App layout
  globals.css             # Global styles with dark mode
/lib
  openai.ts               # OpenAI API client
  gemini.ts               # Legacy Gemini support (deprecated)
  dataforseo.ts           # DataForSEO API client
  cluster.ts              # Clustering algorithms
  bucketing.ts            # Action bucketing logic
  normalize.ts            # URL normalization utilities
  types.ts                # Shared TypeScript types
  errors.ts               # Typed error classes
/components
  Form.tsx                # Input form component with env defaults
  Results.tsx             # Results display with collapsible sections
  Diagnostics.tsx         # Logs and diagnostics component
  ThemeProvider.tsx       # Dark mode context provider
  ThemeToggle.tsx         # Theme switcher component
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
- Check OpenAI API key is valid
- Ensure you have available quota and credits
- Verify your API key has proper permissions
- Try enabling Mock Mode to test without API calls

### "SERP fetch failed"
- Verify DataForSEO credentials are correct
- Check account balance and available credits
- Ensure location/language combination is valid
- Try reducing number of queries
- Check your network connection and firewall settings (Windows users)

### "Clustering failed"
- Ensure threshold is between 1-10
- Check that SERP results were successfully fetched
- Review diagnostics panel for specific errors
- Verify sufficient SERP data was returned

### Rate Limit Errors
- The app automatically retries with exponential backoff
- If persistent, wait a few minutes and try again
- Consider reducing concurrency or batch size
- Check your OpenAI usage limits

### Windows-Specific Issues

**Port Already in Use:**
If port 3000 is already in use on Windows:
```powershell
# Find process using port 3000
netstat -ano | findstr :3000

# Kill the process (replace PID with actual process ID)
taskkill /PID <PID> /F
```

**PowerShell Execution Policy:**
If you get script execution errors:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

**PATH Issues:**
Ensure Node.js and npm are in your system PATH:
```powershell
node --version
npm --version
```

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

Edit the prompt in `lib/openai.ts` function `fanOutQueries()` to adjust query generation strategy and AI model configuration.

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
- AI query generation by [OpenAI](https://openai.com/)
- Styling with [Tailwind CSS](https://tailwindcss.com/)
