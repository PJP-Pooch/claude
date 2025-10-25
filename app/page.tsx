'use client';

import { useState, useEffect } from 'react';
import Form from '@/components/Form';
import Results from '@/components/Results';
import Diagnostics from '@/components/Diagnostics';
import { AppInput, SubQuery, SerpResult, Cluster, ClusterRecommendation, DiagnosticLog } from '@/lib/types';

type Step = 'idle' | 'fanout' | 'serp' | 'cluster' | 'complete';

type SavedState = {
  step: Step;
  subQueries: SubQuery[];
  serpResults: SerpResult[];
  clusters: Cluster[];
  recommendations: ClusterRecommendation[];
  logs: DiagnosticLog[];
  input: AppInput;
  timestamp: number;
};

const STORAGE_KEY = 'serp-analysis-state';
const STORAGE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

export default function Home() {
  const [step, setStep] = useState<Step>('idle');
  const [subQueries, setSubQueries] = useState<SubQuery[]>([]);
  const [serpResults, setSerpResults] = useState<SerpResult[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [recommendations, setRecommendations] = useState<ClusterRecommendation[]>([]);
  const [logs, setLogs] = useState<DiagnosticLog[]>([]);
  const [savedInput, setSavedInput] = useState<AppInput | null>(null);
  const [showResumePrompt, setShowResumePrompt] = useState(false);

  // Check for saved state on mount
  useEffect(() => {
    const savedState = loadSavedState();
    if (savedState) {
      setShowResumePrompt(true);
      setSavedInput(savedState.input);
    }
  }, []);

  // Save progress after state changes
  useEffect(() => {
    if (step !== 'idle' && savedInput) {
      saveProgress();
    }
  }, [step, subQueries, serpResults, clusters, recommendations, logs]);

  const saveProgress = () => {
    if (!savedInput) return;

    const state: SavedState = {
      step,
      subQueries,
      serpResults,
      clusters,
      recommendations,
      logs,
      input: savedInput,
      timestamp: Date.now(),
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('Failed to save progress:', error);
    }
  };

  const loadSavedState = (): SavedState | null => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return null;

      const state: SavedState = JSON.parse(saved);

      // Check if state is expired
      if (Date.now() - state.timestamp > STORAGE_EXPIRY) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }

      return state;
    } catch (error) {
      console.error('Failed to load saved state:', error);
      return null;
    }
  };

  const resumeAnalysis = () => {
    const savedState = loadSavedState();
    if (!savedState) {
      setShowResumePrompt(false);
      return;
    }

    setStep(savedState.step);
    setSubQueries(savedState.subQueries);
    setSerpResults(savedState.serpResults);
    setClusters(savedState.clusters);
    setRecommendations(savedState.recommendations);
    setLogs(savedState.logs);
    setSavedInput(savedState.input);
    setShowResumePrompt(false);

    addLog('info', 'Resumed previous analysis');
  };

  const clearSavedState = () => {
    localStorage.removeItem(STORAGE_KEY);
    setShowResumePrompt(false);
    setSavedInput(null);
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

  const handleSubmit = async (input: AppInput) => {
    // Reset state and clear any old saved state
    clearSavedState();
    setSubQueries([]);
    setSerpResults([]);
    setClusters([]);
    setRecommendations([]);
    setLogs([]);
    setSavedInput(input);
    setStep('fanout');

    try {
      // Step 1: Fan-out queries
      addLog('info', 'Starting query fan-out with Gemini...');
      const fanoutResponse = await fetch('/api/fanout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetQuery: input.targetQuery,
          geminiApiKey: input.geminiApiKey,
          mockMode: input.mockMode,
        }),
      });

      if (!fanoutResponse.ok) {
        const error = await fanoutResponse.json();
        throw new Error(error.error || 'Fan-out failed');
      }

      const fanoutData = await fanoutResponse.json();
      const limitedSubQueries = fanoutData.subQueries.slice(0, input.maxQueries);
      setSubQueries(limitedSubQueries);
      addLog('info', `Generated ${limitedSubQueries.length} sub-queries (max: ${input.maxQueries})`);

      // Step 2: Fetch SERP results
      setStep('serp');
      addLog('info', 'Fetching SERP results from DataForSEO...');
      const serpResponse = await fetch('/api/serp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queries: limitedSubQueries.map((sq: SubQuery) => sq.q),
          targetPageUrl: input.targetPageUrl,
          location: input.location,
          language: input.language,
          device: input.device,
          dataForSeoApiLogin: input.dataForSeoApiLogin,
          dataForSeoApiPassword: input.dataForSeoApiPassword,
          mockMode: input.mockMode,
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
          targetQuery: input.targetQuery,
          targetPageUrl: input.targetPageUrl,
          clusteringOverlapThreshold: input.clusteringOverlapThreshold,
          geminiApiKey: input.geminiApiKey,
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

      // Clear saved state on successful completion
      setTimeout(() => {
        clearSavedState();
      }, 1000);
    } catch (error) {
      addLog('error', error instanceof Error ? error.message : 'Unknown error occurred');
      setStep('idle');
      // Keep saved state on error so user can retry
    }
  };

  const getStepLabel = (currentStep: Step): string => {
    switch (currentStep) {
      case 'fanout':
        return 'Fan-out: Generating sub-queries...';
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
    <main className="min-h-screen bg-gray-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">SERP Query Clustering</h1>
          <p className="text-gray-600">
            Analyze SERP results to discover content opportunities and identify cannibalization issues.
          </p>
        </div>

        {/* Resume Prompt */}
        {showResumePrompt && savedInput && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-sm font-medium text-blue-900 mb-1">
                  📋 Previous Analysis Found
                </h3>
                <p className="text-sm text-blue-700 mb-3">
                  You have an unfinished analysis for &quot;{savedInput.targetQuery}&quot;. Would you like to resume?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={resumeAnalysis}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Resume Analysis
                  </button>
                  <button
                    onClick={clearSavedState}
                    className="px-4 py-2 bg-white text-blue-600 text-sm font-medium rounded-md border border-blue-300 hover:bg-blue-50 transition-colors"
                  >
                    Start Fresh
                  </button>
                </div>
              </div>
              <button
                onClick={clearSavedState}
                className="ml-4 text-blue-400 hover:text-blue-600"
                aria-label="Dismiss"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}

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
            <Form onSubmit={handleSubmit} isLoading={step !== 'idle' && step !== 'complete'} />

            {logs.length > 0 && (
              <div className="mt-6">
                <Diagnostics logs={logs} currentStep={step !== 'idle' ? getStepLabel(step) : undefined} />
              </div>
            )}
          </div>

          <div className="lg:col-span-2">
            {(subQueries.length > 0 || serpResults.length > 0 || clusters.length > 0 || recommendations.length > 0) && (
              <Results
                subQueries={subQueries.length > 0 ? subQueries : undefined}
                serpResults={serpResults.length > 0 ? serpResults : undefined}
                clusters={clusters.length > 0 ? clusters : undefined}
                recommendations={recommendations.length > 0 ? recommendations : undefined}
              />
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
  );
}
