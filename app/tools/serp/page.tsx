'use client';

import { useState, useEffect } from 'react';
import Form from '@/components/Form';
import Results from '@/components/Results';
import Diagnostics from '@/components/Diagnostics';
import ThemeToggle from '@/components/ThemeToggle';
import { ThemeProvider } from '@/components/ThemeProvider';
import { AppInput, SubQuery, SerpResult, Cluster, ClusterRecommendation, DiagnosticLog } from '@/lib/types';

type Step = 'idle' | 'fanout' | 'awaiting_confirmation' | 'serp' | 'cluster' | 'complete';

type SavedState = {
  step: Step;
  subQueries: SubQuery[];
  serpResults: SerpResult[];
  clusters: Cluster[];
  recommendations: ClusterRecommendation[];
  logs: DiagnosticLog[];
  targetQuery: string;
  pendingInput: AppInput | null;
  timestamp: number;
};

const STORAGE_KEY = 'serp-analysis-state';
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

export default function Home() {
  const [step, setStep] = useState<Step>('idle');
  const [subQueries, setSubQueries] = useState<SubQuery[]>([]);
  const [serpResults, setSerpResults] = useState<SerpResult[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [recommendations, setRecommendations] = useState<ClusterRecommendation[]>([]);
  const [logs, setLogs] = useState<DiagnosticLog[]>([]);
  const [targetQuery, setTargetQuery] = useState<string>('');
  const [pendingInput, setPendingInput] = useState<AppInput | null>(null);
  const [savedStateAvailable, setSavedStateAvailable] = useState(false);

  // Check for saved state on mount
  useEffect(() => {
    try {
      const savedData = localStorage.getItem(STORAGE_KEY);
      if (savedData) {
        const parsed: SavedState = JSON.parse(savedData);
        const age = Date.now() - parsed.timestamp;

        // Only restore if less than 24 hours old and not completed
        if (age < MAX_AGE_MS && parsed.step !== 'idle' && parsed.step !== 'complete') {
          setSavedStateAvailable(true);
        } else if (age >= MAX_AGE_MS) {
          // Clean up old state
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch (error) {
      console.error('Failed to load saved state:', error);
    }
  }, []);

  // Save state whenever it changes (except when idle)
  useEffect(() => {
    if (step !== 'idle') {
      try {
        const state: SavedState = {
          step,
          subQueries,
          serpResults,
          clusters,
          recommendations,
          logs,
          targetQuery,
          pendingInput,
          timestamp: Date.now(),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (error) {
        console.error('Failed to save state:', error);
      }
    }
  }, [step, subQueries, serpResults, clusters, recommendations, logs, targetQuery, pendingInput]);

  const restoreSavedState = () => {
    try {
      const savedData = localStorage.getItem(STORAGE_KEY);
      if (savedData) {
        const parsed: SavedState = JSON.parse(savedData);
        setStep(parsed.step);
        setSubQueries(parsed.subQueries);
        setSerpResults(parsed.serpResults);
        setClusters(parsed.clusters);
        setRecommendations(parsed.recommendations);
        setLogs(parsed.logs);
        setTargetQuery(parsed.targetQuery);
        setPendingInput(parsed.pendingInput);
        setSavedStateAvailable(false);
        addLog('info', 'Restored previous analysis from ' + new Date(parsed.timestamp).toLocaleString());
      }
    } catch (error) {
      console.error('Failed to restore state:', error);
      addLog('error', 'Failed to restore saved analysis');
    }
  };

  const clearSavedState = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      setSavedStateAvailable(false);
    } catch (error) {
      console.error('Failed to clear saved state:', error);
    }
  };

  const addLog = (level: DiagnosticLog['level'], message: string, context?: Record<string, unknown>) => {
    setLogs((prev) => [
      ...prev,
      {
        level,
        timestamp: new Date().toISOString(),
        message,
        context,
      },
    ]);
  };

  const handleRemoveQuery = (query: string) => {
    setSubQueries(prev => prev.filter(sq => sq.q !== query));
    addLog('info', `Removed query: "${query}"`);
  };

  const handleAddQuery = (query: string, intent: 'info' | 'comm' | 'trans' | 'nav', rationale: string) => {
    const newQuery: SubQuery = { q: query, intent, rationale };
    setSubQueries(prev => [...prev, newQuery]);
    addLog('info', `Added query: "${query}" with intent: ${intent}`);
  };

  const handleSubmit = async (input: AppInput) => {
    // Reset state and clear any saved progress
    clearSavedState();
    setSubQueries([]);
    setSerpResults([]);
    setClusters([]);
    setRecommendations([]);
    setLogs([]);
    setTargetQuery(input.targetQuery);
    setPendingInput(input);

    try {
      let queries: string[] = [];
      let subQueryObjects: SubQuery[] = [];

      // Always include the target query first
      const targetQueryObject: SubQuery = {
        q: input.targetQuery,
        intent: 'info' as const,
        rationale: 'Target keyword'
      };

      // Check if custom queries are provided
      if (input.customQueries && input.customQueries.trim()) {
        // Use custom queries
        addLog('info', 'Using custom sub-queries...');
        queries = input.customQueries
          .split('\n')
          .map(q => q.trim())
          .filter(q => q.length > 0);

        // Create SubQuery objects with default intent
        subQueryObjects = queries.map(q => ({
          q,
          intent: 'info' as const,
          rationale: 'Custom query provided by user'
        }));

        // Add target query at the beginning if not already included
        if (!queries.includes(input.targetQuery)) {
          subQueryObjects.unshift(targetQueryObject);
          queries.unshift(input.targetQuery);
        }

        setSubQueries(subQueryObjects);
        addLog('info', `Using ${queries.length} queries (including target keyword)`);
      } else {
        // Step 1: Fan-out queries with AI
        setStep('fanout');
        addLog('info', 'Starting query fan-out with OpenAI...');
        const fanoutResponse = await fetch('/api/fanout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetQuery: input.targetQuery,
            openaiApiKey: input.openaiApiKey,
            mockMode: input.mockMode,
          }),
        });

        if (!fanoutResponse.ok) {
          const error = await fanoutResponse.json();
          throw new Error(error.error || 'Fan-out failed');
        }

        const fanoutData = await fanoutResponse.json();
        subQueryObjects = fanoutData.subQueries;
        queries = subQueryObjects.map((sq: SubQuery) => sq.q);

        // Add target query at the beginning if not already included
        if (!queries.includes(input.targetQuery)) {
          subQueryObjects.unshift(targetQueryObject);
          queries.unshift(input.targetQuery);
        }

        setSubQueries(subQueryObjects);
        addLog('info', `Generated ${subQueryObjects.length} queries (including target keyword)`);
      }

      // Wait for user confirmation before proceeding
      setStep('awaiting_confirmation');
      addLog('info', 'Please review the sub-queries and click "Confirm & Continue" to proceed');
    } catch (error) {
      addLog('error', error instanceof Error ? error.message : 'Unknown error occurred');
      setStep('idle');
    }
  };

  const handleConfirm = async () => {
    if (!pendingInput) return;

    try {
      const queries = subQueries.map(sq => sq.q);

      // Step 2: Fetch SERP results
      setStep('serp');
      addLog('info', 'Fetching SERP results from DataForSEO...');
      const serpResponse = await fetch('/api/serp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queries,
          targetPageUrl: pendingInput.targetPageUrl,
          location: pendingInput.location,
          language: pendingInput.language,
          device: pendingInput.device,
          dataForSeoApiLogin: pendingInput.dataForSeoApiLogin,
          dataForSeoApiPassword: pendingInput.dataForSeoApiPassword,
          mockMode: pendingInput.mockMode,
        }),
      });

      if (!serpResponse.ok) {
        const error = await serpResponse.json();
        throw new Error(error.error || 'SERP fetch failed');
      }

      const serpData = await serpResponse.json();
      setSerpResults(serpData.results);
      addLog('info', `Fetched SERP results for ${serpData.diagnostics.successCount} queries`);

      if (serpData.diagnostics.failureCount > 0) {
        addLog(
          'warning',
          `${serpData.diagnostics.failureCount} queries failed`,
          { errors: serpData.diagnostics.errors }
        );
      }

      // Step 3: Cluster and generate recommendations
      setStep('cluster');
      addLog('info', 'Clustering queries and generating recommendations...');
      const clusterResponse = await fetch('/api/cluster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serpResults: serpData.results,
          targetQuery: pendingInput.targetQuery,
          targetPageUrl: pendingInput.targetPageUrl,
          clusteringOverlapThreshold: pendingInput.clusteringOverlapThreshold,
          openaiApiKey: pendingInput.openaiApiKey,
        }),
      });

      if (!clusterResponse.ok) {
        const error = await clusterResponse.json();
        throw new Error(error.error || 'Clustering failed');
      }

      const clusterData = await clusterResponse.json();
      setClusters(clusterData.clusters);
      setRecommendations(clusterData.recommendations);
      addLog('info', `Created ${clusterData.diagnostics.clusterCount} clusters`);

      setStep('complete');
      addLog('info', 'Analysis complete!');
    } catch (error) {
      addLog('error', error instanceof Error ? error.message : 'Unknown error occurred');
      setStep('idle');
    }
  };

  const getStepLabel = (currentStep: Step): string => {
    switch (currentStep) {
      case 'fanout':
        return 'Fan-out: Generating sub-queries...';
      case 'awaiting_confirmation':
        return 'Awaiting Confirmation: Review and confirm sub-queries';
      case 'serp':
        return 'SERP: Fetching search results...';
      case 'cluster':
        return 'Cluster: Analyzing and generating recommendations...';
      case 'complete':
        return 'Complete';
      default:
        return '';
    }
  };

  return (
    <ThemeProvider>
      <ThemeToggle />
      <main className="min-h-screen bg-gray-100 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8 transition-colors">
        <div className="w-full mx-auto">
        {/* Home Link and Resume Button */}
        <div className="mb-6 flex items-center justify-between">
          <a
            href="/"
            className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
          >
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            <span className="font-medium">Back to Tools</span>
          </a>

          {savedStateAvailable && (
            <div className="flex gap-2">
              <button
                onClick={restoreSavedState}
                className="inline-flex items-center px-4 py-2 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600 transition-colors shadow-md"
              >
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Resume Previous Analysis
              </button>
              <button
                onClick={clearSavedState}
                className="px-3 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 transition-colors"
                title="Dismiss"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          )}
        </div>

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">Query Fan Out Analysis</h1>
          <p className="text-gray-600 dark:text-gray-300">
            Analyze SERP results to discover content opportunities and identify cannibalization issues.
          </p>
        </div>

        {/* Progress Indicator */}
        {step !== 'idle' && (
          <div className="mb-6 bg-white p-4 rounded-lg shadow-md">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Progress</span>
              <span className="text-sm text-gray-600">{getStepLabel(step)}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                style={{
                  width:
                    step === 'fanout'
                      ? '25%'
                      : step === 'awaiting_confirmation'
                      ? '33%'
                      : step === 'serp'
                      ? '66%'
                      : step === 'cluster'
                      ? '90%'
                      : '100%',
                }}
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <Form onSubmit={handleSubmit} isLoading={step !== 'idle' && step !== 'complete' && step !== 'awaiting_confirmation'} />

            {logs.length > 0 && (
              <div className="mt-6">
                <Diagnostics logs={logs} currentStep={step !== 'idle' ? getStepLabel(step) : undefined} />
              </div>
            )}
          </div>

          <div className="lg:col-span-2">
            {(subQueries.length > 0 || serpResults.length > 0 || clusters.length > 0 || recommendations.length > 0) && (
              <>
                <Results
                  subQueries={subQueries.length > 0 ? subQueries : undefined}
                  serpResults={serpResults.length > 0 ? serpResults : undefined}
                  clusters={clusters.length > 0 ? clusters : undefined}
                  recommendations={recommendations.length > 0 ? recommendations : undefined}
                  targetQuery={targetQuery || undefined}
                  onRemoveQuery={step === 'awaiting_confirmation' ? handleRemoveQuery : undefined}
                  onAddQuery={step === 'awaiting_confirmation' ? handleAddQuery : undefined}
                />

                {/* Confirmation Button */}
                {step === 'awaiting_confirmation' && (
                  <div className="mt-6 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                          Ready to Continue?
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          Review the sub-queries above. You can add or remove queries before proceeding.
                        </p>
                      </div>
                      <button
                        onClick={handleConfirm}
                        className="px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors shadow-md hover:shadow-lg"
                      >
                        Confirm & Continue
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {step === 'idle' && subQueries.length === 0 && (
              <div className="bg-white p-12 rounded-lg shadow-md text-center">
                <div className="text-gray-400 mb-4">
                  <svg
                    className="mx-auto h-24 w-24"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Ready to Analyze</h3>
                <p className="text-gray-600">
                  Fill in the form and click &quot;Start Analysis&quot; to begin.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
    </ThemeProvider>
  );
}
