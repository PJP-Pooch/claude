import { z } from 'zod';

// ============================================================================
// Input Schemas
// ============================================================================

export const InputSchema = z.object({
  targetQuery: z.string().min(1, 'Target query is required'),
  targetPageUrl: z.string().url('Must be a valid URL'),
  openaiApiKey: z.string().min(1, 'OpenAI API key is required'),
  dataForSeoApiLogin: z.string().min(1, 'DataForSEO login is required'),
  dataForSeoApiPassword: z.string().min(1, 'DataForSEO password is required'),
  location: z.string().default('United Kingdom'),
  language: z.string().default('English'),
  searchEngine: z.literal('google').default('google'),
  device: z.enum(['desktop', 'mobile']).default('desktop'),
  clusteringOverlapThreshold: z.number().int().min(1).max(10).default(4),
  mockMode: z.boolean().optional().default(false),
  customQueries: z.string().optional(), // One query per line
});

export type AppInput = z.infer<typeof InputSchema>;

// ============================================================================
// Sub-Query Types
// ============================================================================

export const IntentSchema = z.enum(['info', 'comm', 'trans', 'nav']);
export type Intent = z.infer<typeof IntentSchema>;

export const SubQuerySchema = z.object({
  q: z.string(),
  intent: IntentSchema,
  rationale: z.string(),
});

export type SubQuery = z.infer<typeof SubQuerySchema>;

export const SubQueryArraySchema = z.array(SubQuerySchema);

// ============================================================================
// SERP Result Types
// ============================================================================

export const OrganicResultSchema = z.object({
  position: z.number(),
  url: z.string(),
  title: z.string(),
  snippet: z.string().optional(),
});

export type OrganicResult = z.infer<typeof OrganicResultSchema>;

export const AIOverviewSchema = z.enum(['present', 'absent', 'unknown']);
export type AIOverview = z.infer<typeof AIOverviewSchema>;

export const AIOverviewDataSchema = z.object({
  text: z.string(),
  urls: z.array(z.object({
    url: z.string(),
    title: z.string().optional(),
  })),
}).optional();

export type AIOverviewData = z.infer<typeof AIOverviewDataSchema>;

export const SerpResultSchema = z.object({
  q: z.string(),
  top10: z.array(OrganicResultSchema),
  aiOverview: AIOverviewSchema,
  aiOverviewData: AIOverviewDataSchema,
  targetPageOnPage1: z.boolean(),
  sameDomainOnPage1: z.boolean(),
  firstMatch: z.object({
    position: z.number(),
    url: z.string(),
  }).optional(),
});

export type SerpResult = z.infer<typeof SerpResultSchema>;

// ============================================================================
// Clustering Types
// ============================================================================

export const ClusterSchema = z.object({
  id: z.string(),
  queries: z.array(z.string()),
  exemplar: z.string(),
  overlapMatrix: z.array(z.array(z.number())),
});

export type Cluster = z.infer<typeof ClusterSchema>;

// ============================================================================
// Action Types
// ============================================================================

export const ActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('great_target_page_ranking'),
    q: z.string(),
    details: z.string(),
  }),
  z.object({
    type: z.literal('ok_other_page_diff_cluster'),
    q: z.string(),
    otherUrl: z.string(),
    details: z.string(),
  }),
  z.object({
    type: z.literal('cannibalisation'),
    q: z.string(),
    otherUrl: z.string(),
    recommendedFix: z.string(),
  }),
  z.object({
    type: z.literal('expand_target_page'),
    q: z.string(),
    outline: z.string(),
  }),
  z.object({
    type: z.literal('new_page'),
    q: z.string(),
    pageBrief: z.string(),
  }),
]);

export type Action = z.infer<typeof ActionSchema>;

// ============================================================================
// Cluster Recommendation Types
// ============================================================================

export const ClusterRecommendationSchema = z.object({
  clusterId: z.string(),
  exemplar: z.string(),
  queries: z.array(z.string()),
  aiOverviewPresence: z.array(AIOverviewSchema),
  actions: z.array(ActionSchema),
});

export type ClusterRecommendation = z.infer<typeof ClusterRecommendationSchema>;

// ============================================================================
// API Response Types
// ============================================================================

export type FanoutResponse = {
  subQueries: SubQuery[];
  diagnostics: {
    timestamp: string;
    model: string;
    tokensUsed?: number;
  };
};

export type SerpResponse = {
  results: SerpResult[];
  diagnostics: {
    timestamp: string;
    totalQueries: number;
    successCount: number;
    failureCount: number;
    errors: Array<{ query: string; error: string }>;
  };
};

export type ClusterResponse = {
  clusters: Cluster[];
  recommendations: ClusterRecommendation[];
  diagnostics: {
    timestamp: string;
    clusterCount: number;
    threshold: number;
  };
};

// ============================================================================
// DataForSEO Specific Types
// ============================================================================

export type DataForSEOLocation = {
  location_code: number;
  location_name: string;
  location_code_parent: number | null;
  country_iso_code: string;
  location_type: string;
};

export type DataForSEOLanguage = {
  language_name: string;
  language_code: string;
};

// Map common location names to DataForSEO location codes
export const LOCATION_MAP: Record<string, number> = {
  'United Kingdom': 2826,
  'United States': 2840,
  'Canada': 2124,
  'Australia': 2036,
  'Germany': 2276,
  'France': 2250,
  'Spain': 2724,
  'Italy': 2380,
  'Netherlands': 2528,
  'Belgium': 2056,
  'Switzerland': 2756,
  'Austria': 2040,
  'Ireland': 2372,
  'New Zealand': 2554,
  'India': 2356,
  'Singapore': 2702,
  'Japan': 2392,
};

// Map common language names to DataForSEO language codes
export const LANGUAGE_MAP: Record<string, string> = {
  'English': 'en',
  'Spanish': 'es',
  'French': 'fr',
  'German': 'de',
  'Italian': 'it',
  'Dutch': 'nl',
  'Portuguese': 'pt',
  'Russian': 'ru',
  'Chinese': 'zh',
  'Japanese': 'ja',
  'Korean': 'ko',
  'Arabic': 'ar',
  'Hindi': 'hi',
};

// ============================================================================
// OpenAI API Types
// ============================================================================

export type OpenAIEmbeddingRequest = {
  model: string;
  input: string;
};

export type OpenAIEmbeddingResponse = {
  data: Array<{
    embedding: number[];
  }>;
};

export type OpenAIFanoutRequest = {
  targetQuery: string;
  apiKey: string;
};

export type OpenAISimilarityRequest = {
  text1: string;
  text2: string;
  apiKey: string;
};

// ============================================================================
// Diagnostic Types
// ============================================================================

export type DiagnosticLog = {
  level: 'info' | 'warning' | 'error';
  timestamp: string;
  message: string;
  context?: Record<string, unknown>;
};

export type DiagnosticState = {
  logs: DiagnosticLog[];
  rateLimitStatus?: {
    remaining: number;
    reset: string;
  };
};
