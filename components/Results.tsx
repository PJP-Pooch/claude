'use client';

import { useState, useRef, useEffect } from 'react';
import { SubQuery, SerpResult, Cluster, ClusterRecommendation } from '@/lib/types';
import Papa from 'papaparse';

type ResultsProps = {
  subQueries?: SubQuery[];
  serpResults?: SerpResult[];
  clusters?: Cluster[];
  recommendations?: ClusterRecommendation[];
  targetQuery?: string;
  onRemoveQuery?: (query: string) => void;
  onAddQuery?: (query: string, intent: 'info' | 'comm' | 'trans' | 'nav', rationale: string) => void;
};

export default function Results({ subQueries, serpResults, clusters, recommendations, targetQuery, onRemoveQuery, onAddQuery }: ResultsProps) {
  const [expandedSections, setExpandedSections] = useState({
    subQueries: false,
    serpResults: false,
    aiOverviews: false,
    clusters: false,
    recommendations: false,
  });

  // State for adding new queries
  const [newQueryText, setNewQueryText] = useState('');
  const [newQueryIntent, setNewQueryIntent] = useState<'info' | 'comm' | 'trans' | 'nav'>('info');

  // Track which SERP result rows are expanded
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  // Track which AI Overview items are expanded
  const [expandedAIOverviews, setExpandedAIOverviews] = useState<Set<number>>(new Set());

  // Track which cluster is selected
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);

  // Track which action types are expanded
  const [expandedActionTypes, setExpandedActionTypes] = useState<Set<string>>(new Set());

  // Filter state for search/filtering
  const [filterText, setFilterText] = useState('');

  // Column widths for SERP table
  const [columnWidths, setColumnWidths] = useState({
    query: 200,
    url: 400,
    clientUrl: 400,
    aiOverview: 120,
    aiCitation: 100,
    targetPage: 120,
    otherUrl: 300,
    firstMatch: 120,
  });

  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const toggleRow = (index: number) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const toggleAIOverview = (index: number) => {
    setExpandedAIOverviews(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const toggleActionType = (actionType: string) => {
    setExpandedActionTypes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(actionType)) {
        newSet.delete(actionType);
      } else {
        newSet.add(actionType);
      }
      return newSet;
    });
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleMouseDown = (e: React.MouseEvent, columnKey: string) => {
    e.preventDefault();
    setResizingColumn(columnKey);
    startXRef.current = e.clientX;
    startWidthRef.current = columnWidths[columnKey as keyof typeof columnWidths];
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (resizingColumn) {
        const diff = e.clientX - startXRef.current;
        const newWidth = Math.max(80, startWidthRef.current + diff);
        setColumnWidths(prev => ({
          ...prev,
          [resizingColumn]: newWidth,
        }));
      }
    };

    const handleMouseUp = () => {
      setResizingColumn(null);
    };

    if (resizingColumn) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingColumn]);
  const downloadCSV = (data: unknown[], filename: string) => {
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  };

  const downloadJSON = (data: unknown, filename: string) => {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'ok_other_page_diff_cluster':
        return '✅';
      case 'cannibalisation':
        return '⚠️';
      case 'expand_target_page':
        return '➕';
      case 'new_page':
        return '🆕';
      default:
        return '•';
    }
  };

  const getActionLabel = (type: string) => {
    switch (type) {
      case 'ok_other_page_diff_cluster':
        return 'OK: Different topic';
      case 'cannibalisation':
        return 'Cannibalization risk';
      case 'expand_target_page':
        return 'Expand target page';
      case 'new_page':
        return 'Create new page';
      default:
        return type;
    }
  };

  // Apply filtering
  const filteredSubQueries = subQueries?.filter(sq =>
    sq.q.toLowerCase().includes(filterText.toLowerCase()) ||
    sq.intent.toLowerCase().includes(filterText.toLowerCase()) ||
    sq.rationale?.toLowerCase().includes(filterText.toLowerCase())
  );

  const filteredSerpResults = serpResults?.filter(sr =>
    sr.q.toLowerCase().includes(filterText.toLowerCase()) ||
    sr.firstMatch?.url.toLowerCase().includes(filterText.toLowerCase())
  );

  const filteredRecommendations = recommendations?.filter(rec =>
    rec.exemplar.toLowerCase().includes(filterText.toLowerCase()) ||
    rec.queries.some(q => q.toLowerCase().includes(filterText.toLowerCase())) ||
    rec.actions.some(a => a.q.toLowerCase().includes(filterText.toLowerCase()))
  );

  return (
    <div className="space-y-8">
      {/* Global Search Bar */}
      {(subQueries || serpResults || recommendations) && (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md">
          <div className="relative">
            <input
              type="text"
              placeholder="Search across all results (queries, URLs, actions, clusters...)"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="w-full px-4 py-2 pl-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
            <svg
              className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {filterText && (
              <button
                onClick={() => setFilterText('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          {filterText && (
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              Found: {filteredSubQueries?.length || 0} queries, {filteredSerpResults?.length || 0} SERP results, {filteredRecommendations?.length || 0} clusters
            </p>
          )}
        </div>
      )}

      {/* Sub-Queries Table */}
      {filteredSubQueries && filteredSubQueries.length > 0 && (
        <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <div className="flex justify-between items-center mb-4">
            <button
              onClick={() => toggleSection('subQueries')}
              className="flex items-center space-x-2 text-xl font-bold text-gray-900 dark:text-white hover:text-blue-600 transition-colors"
            >
              <span>Sub-Queries ({filteredSubQueries.length}{filterText && ` of ${subQueries?.length}`})</span>
              <svg
                className={`w-5 h-5 transform transition-transform ${expandedSections.subQueries ? 'rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button
              onClick={() => downloadCSV(filteredSubQueries, 'sub-queries.csv')}
              className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
            >
              Export CSV
            </button>
          </div>
          {expandedSections.subQueries && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Query
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Cluster
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Intent
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Rationale
                    </th>
                    {onRemoveQuery && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredSubQueries.map((sq, idx) => {
                    // Find which cluster this query belongs to
                    const cluster = clusters?.find(c => c.queries.includes(sq.q));

                    // Highlight target keyword in query
                    const highlightKeyword = (text: string) => {
                      if (!targetQuery) return text;
                      const keywords = targetQuery.toLowerCase().split(' ');
                      let highlighted = text;

                      // Try to match full phrase first
                      const regex = new RegExp(`(${targetQuery})`, 'gi');
                      if (regex.test(text)) {
                        const parts = text.split(regex);
                        return (
                          <>
                            {parts.map((part, i) =>
                              regex.test(part) ? (
                                <mark key={i} className="bg-yellow-200 dark:bg-yellow-600 font-semibold px-0.5 rounded">
                                  {part}
                                </mark>
                              ) : (
                                <span key={i}>{part}</span>
                              )
                            )}
                          </>
                        );
                      }

                      return text;
                    };

                    const isTargetRow = sq.q === targetQuery;

                    return (
                      <tr
                        key={idx}
                        className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${
                          isTargetRow
                            ? 'bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-400 dark:border-amber-600'
                            : ''
                        }`}
                      >
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                          {isTargetRow && <span className="mr-2">🎯</span>}
                          {highlightKeyword(sq.q)}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {cluster ? (
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              cluster.id === 'target'
                                ? 'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200'
                                : 'bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200'
                            }`}>
                              {cluster.id === 'target' ? '🎯 Target' : cluster.id.replace('cluster-', 'C')}
                            </span>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-500 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              sq.intent === 'info'
                                ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                                : sq.intent === 'comm'
                                ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                                : sq.intent === 'trans'
                                ? 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200'
                                : 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200'
                            }`}
                          >
                            {sq.intent}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{sq.rationale}</td>
                        {onRemoveQuery && (
                          <td className="px-4 py-3 text-sm">
                            {!isTargetRow && (
                              <button
                                onClick={() => onRemoveQuery(sq.q)}
                                className="px-2 py-1 text-xs bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
                                title="Remove this query"
                              >
                                Remove
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Add Query Form */}
              {onAddQuery && (
                <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Add Custom Query</h4>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      value={newQueryText}
                      onChange={(e) => setNewQueryText(e.target.value)}
                      placeholder="Enter query text..."
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <select
                      value={newQueryIntent}
                      onChange={(e) => setNewQueryIntent(e.target.value as 'info' | 'comm' | 'trans' | 'nav')}
                      className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="info">Info</option>
                      <option value="comm">Commercial</option>
                      <option value="trans">Transactional</option>
                      <option value="nav">Navigational</option>
                    </select>
                    <button
                      onClick={() => {
                        if (newQueryText.trim()) {
                          onAddQuery(newQueryText.trim(), newQueryIntent, 'Custom query added by user');
                          setNewQueryText('');
                        }
                      }}
                      disabled={!newQueryText.trim()}
                      className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                      Add Query
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* SERP Results Table */}
      {filteredSerpResults && filteredSerpResults.length > 0 && (
        <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <div className="flex justify-between items-center mb-4">
            <button
              onClick={() => toggleSection('serpResults')}
              className="flex items-center space-x-2 text-xl font-bold text-gray-900 dark:text-white hover:text-blue-600 transition-colors"
            >
              <span>SERP Results ({filteredSerpResults.length}{filterText && ` of ${serpResults?.length}`})</span>
              <svg
                className={`w-5 h-5 transform transition-transform ${expandedSections.serpResults ? 'rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <div className="space-x-2">
              <button
                onClick={() =>
                  downloadCSV(
                    filteredSerpResults.map((sr) => ({
                      query: sr.q,
                      aiOverview: sr.aiOverview,
                      targetPageOnPage1: sr.targetPageOnPage1,
                      sameDomainOnPage1: sr.sameDomainOnPage1,
                      firstMatchPosition: sr.firstMatch?.position || '',
                      firstMatchUrl: sr.firstMatch?.url || '',
                    })),
                    'serp-results.csv'
                  )
                }
                className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
              >
                Export CSV
              </button>
            </div>
          </div>
          {expandedSections.serpResults && (
            <div className="overflow-x-auto max-h-[600px] relative">
              <table className="min-w-full divide-y divide-gray-200" style={{ tableLayout: 'fixed' }}>
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider relative"
                      style={{ width: `${columnWidths.query}px` }}
                    >
                      Query
                      <div
                        className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-500 active:bg-blue-600"
                        onMouseDown={(e) => handleMouseDown(e, 'query')}
                      />
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider relative"
                      style={{ width: `${columnWidths.clientUrl}px` }}
                    >
                      First Client URL
                      <div
                        className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-500 active:bg-blue-600"
                        onMouseDown={(e) => handleMouseDown(e, 'clientUrl')}
                      />
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider relative"
                      style={{ width: `${columnWidths.firstMatch}px` }}
                    >
                      Ranking Absolute
                      <div
                        className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-500 active:bg-blue-600"
                        onMouseDown={(e) => handleMouseDown(e, 'firstMatch')}
                      />
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider relative"
                      style={{ width: `${columnWidths.aiOverview}px` }}
                    >
                      AI Overview
                      <div
                        className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-500 active:bg-blue-600"
                        onMouseDown={(e) => handleMouseDown(e, 'aiOverview')}
                      />
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider relative"
                      style={{ width: `${columnWidths.aiCitation}px` }}
                    >
                      AI Citation
                      <div
                        className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-500 active:bg-blue-600"
                        onMouseDown={(e) => handleMouseDown(e, 'aiCitation')}
                      />
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider relative"
                      style={{ width: `${columnWidths.targetPage}px` }}
                    >
                      Target Page
                      <div
                        className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-500 active:bg-blue-600"
                        onMouseDown={(e) => handleMouseDown(e, 'targetPage')}
                      />
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider relative"
                      style={{ width: `${columnWidths.otherUrl}px` }}
                    >
                      Other URL
                      <div
                        className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-500 active:bg-blue-600"
                        onMouseDown={(e) => handleMouseDown(e, 'otherUrl')}
                      />
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredSerpResults.map((sr, idx) => (
                    <>
                      <tr key={idx} className="hover:bg-gray-50 cursor-pointer" onClick={() => toggleRow(idx)}>
                        <td className="px-4 py-3 text-sm text-gray-900 overflow-hidden" style={{ width: `${columnWidths.query}px` }}>
                          <div className="flex items-center space-x-2">
                            <svg
                              className={`w-4 h-4 transform transition-transform ${expandedRows.has(idx) ? 'rotate-90' : ''}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            <div className="truncate" title={sr.q}>{sr.q}</div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 overflow-hidden" style={{ width: `${columnWidths.clientUrl}px` }}>
                          {(() => {
                            if (!sr.firstMatch) return <span className="text-gray-400">—</span>;
                            return (
                              <a
                                href={sr.firstMatch.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 hover:underline truncate block"
                                title={sr.firstMatch.url}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {sr.firstMatch.url}
                              </a>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 overflow-hidden" style={{ width: `${columnWidths.firstMatch}px` }}>
                          {sr.firstMatch ? `#${sr.firstMatch.position}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm overflow-hidden" style={{ width: `${columnWidths.aiOverview}px` }}>
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              sr.aiOverview === 'present'
                                ? 'bg-yellow-100 text-yellow-800'
                                : sr.aiOverview === 'absent'
                                ? 'bg-gray-100 text-gray-800'
                                : 'bg-gray-50 text-gray-500'
                            }`}
                          >
                            {sr.aiOverview}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm overflow-hidden" style={{ width: `${columnWidths.aiCitation}px` }}>
                          {(() => {
                            if (!sr.aiOverviewData || !sr.aiOverviewData.urls || sr.aiOverviewData.urls.length === 0) {
                              return <span className="text-gray-400">—</span>;
                            }

                            // Helper function to strip hash fragments from URLs for comparison
                            const stripHash = (url: string) => {
                              try {
                                const urlObj = new URL(url);
                                return `${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname}${urlObj.search}`;
                              } catch {
                                return url;
                              }
                            };

                            // Helper function to get domain from URL
                            const getDomain = (url: string) => {
                              try {
                                const urlObj = new URL(url);
                                return urlObj.hostname.replace(/^www\./, '');
                              } catch {
                                return '';
                              }
                            };

                            // Get the target page URL
                            const targetPageUrl = serpResults?.find(s => s.q === targetQuery)?.firstMatch?.url;
                            if (!targetPageUrl) {
                              return <span className="text-gray-400">—</span>;
                            }

                            const targetUrlWithoutHash = stripHash(targetPageUrl);
                            const targetDomain = getDomain(targetPageUrl);

                            // Check if exact target page is cited
                            const isExactCited = sr.aiOverviewData.urls.some(u => {
                              const citationUrlWithoutHash = stripHash(u.url);
                              return citationUrlWithoutHash === targetUrlWithoutHash;
                            });

                            if (isExactCited) {
                              return (
                                <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                                  Cited
                                </span>
                              );
                            }

                            // Check if same domain but different URL is cited
                            const isSameDomainCited = sr.aiOverviewData.urls.some(u => {
                              return getDomain(u.url) === targetDomain;
                            });

                            if (isSameDomainCited) {
                              return (
                                <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                                  Other URL
                                </span>
                              );
                            }

                            return (
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                                Not cited
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-3 text-sm overflow-hidden" style={{ width: `${columnWidths.targetPage}px` }}>
                          {sr.targetPageOnPage1 ? (
                            <span className="text-green-600 font-medium">✓ Ranks</span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 overflow-hidden" style={{ width: `${columnWidths.otherUrl}px` }}>
                          {(() => {
                            // Show URL if same domain ranks but it's NOT the target page
                            if (sr.sameDomainOnPage1 && !sr.targetPageOnPage1 && sr.firstMatch) {
                              return (
                                <a
                                  href={sr.firstMatch.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 hover:underline truncate block"
                                  title={sr.firstMatch.url}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {sr.firstMatch.url}
                                </a>
                              );
                            }
                            return <span className="text-gray-400">—</span>;
                          })()}
                        </td>
                      </tr>
                      {expandedRows.has(idx) && (
                        <tr key={`${idx}-expanded`} className="bg-gray-50 dark:bg-gray-800">
                          <td colSpan={6} className="px-4 py-4">
                            <div className="grid grid-cols-2 gap-6">
                              {/* AI Overview URLs Column */}
                              <div>
                                <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-3 flex items-center">
                                  <svg className="w-4 h-4 mr-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                  </svg>
                                  AI Overview URLs
                                </h4>
                                {sr.aiOverviewData && sr.aiOverviewData.urls.length > 0 ? (
                                  <div className="space-y-2">
                                    {sr.aiOverviewData.urls.map((urlData, urlIdx) => {
                                      const isTargetDomain = sr.firstMatch && urlData.url.includes(new URL(sr.firstMatch.url).hostname.replace('www.', ''));
                                      return (
                                        <div
                                          key={urlIdx}
                                          className={`flex items-start space-x-2 p-3 rounded border ${
                                            isTargetDomain
                                              ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
                                              : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600'
                                          }`}
                                        >
                                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium flex-shrink-0 ${
                                            isTargetDomain
                                              ? 'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200'
                                              : 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200'
                                          }`}>
                                            {urlIdx + 1}
                                          </span>
                                          <div className="flex-1 min-w-0">
                                            <a
                                              href={urlData.url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className={`text-sm block truncate hover:underline ${
                                                isTargetDomain
                                                  ? 'text-green-700 dark:text-green-400 font-semibold'
                                                  : 'text-blue-600 dark:text-blue-400'
                                              }`}
                                              title={urlData.url}
                                            >
                                              {urlData.url}
                                            </a>
                                            {urlData.title && (
                                              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 truncate">{urlData.title}</p>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <p className="text-gray-500 dark:text-gray-400 text-sm italic">No AI Overview for this query</p>
                                )}
                              </div>

                              {/* Organic Results Column */}
                              <div>
                                <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-3 flex items-center">
                                  <svg className="w-4 h-4 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                  </svg>
                                  Organic Results (Top 10)
                                </h4>
                                {sr.top10 && sr.top10.length > 0 ? (
                                  <div className="space-y-2">
                                    {sr.top10.map((result, resultIdx) => {
                                      const isTargetDomain = sr.firstMatch && result.url.includes(new URL(sr.firstMatch.url).hostname.replace('www.', ''));
                                      return (
                                        <div
                                          key={resultIdx}
                                          className={`flex items-start space-x-2 p-3 rounded border ${
                                            isTargetDomain
                                              ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
                                              : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600'
                                          }`}
                                        >
                                          <div className="flex-shrink-0 w-8 text-center">
                                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${
                                              isTargetDomain
                                                ? 'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200'
                                                : 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                                            }`}>
                                              {result.position}
                                            </span>
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <a
                                              href={result.url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className={`text-sm block hover:underline font-medium ${
                                                isTargetDomain
                                                  ? 'text-green-700 dark:text-green-400 font-semibold'
                                                  : 'text-blue-600 dark:text-blue-400'
                                              }`}
                                            >
                                              {result.title}
                                            </a>
                                            <div className={`text-xs mt-1 truncate ${
                                              isTargetDomain
                                                ? 'text-green-700 dark:text-green-400'
                                                : 'text-gray-600 dark:text-gray-400'
                                            }`}>
                                              {result.url}
                                            </div>
                                            {result.snippet && (
                                              <p className="text-gray-600 dark:text-gray-400 text-xs mt-1 line-clamp-2">{result.snippet}</p>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <p className="text-gray-500 dark:text-gray-400 text-sm">No results available</p>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* AI Overviews */}
      {serpResults && serpResults.some(sr => sr.aiOverviewData) && (
        <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <div className="flex justify-between items-center mb-4">
            <button
              onClick={() => toggleSection('aiOverviews')}
              className="flex items-center space-x-2 text-xl font-bold text-gray-900 dark:text-white hover:text-blue-600 transition-colors"
            >
              <span>AI Overviews ({serpResults.filter(sr => sr.aiOverviewData).length})</span>
              <svg
                className={`w-5 h-5 transform transition-transform ${expandedSections.aiOverviews ? 'rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          {expandedSections.aiOverviews && (
            <div className="space-y-3">
              {serpResults.filter(sr => sr.aiOverviewData).map((sr, idx) => {
                const isExpanded = expandedAIOverviews.has(idx);
                const targetDomain = sr.firstMatch ? new URL(sr.firstMatch.url).hostname.replace('www.', '') : '';

                // Calculate citation rank and domain count for collapsed view
                const getDomainFromUrl = (url: string) => {
                  try {
                    return new URL(url).hostname.replace('www.', '');
                  } catch {
                    return '';
                  }
                };

                const targetDomainCitations = sr.aiOverviewData?.urls
                  .map((urlData, urlIdx) => ({
                    domain: getDomainFromUrl(urlData.url),
                    rank: urlIdx + 1,
                    url: urlData.url
                  }))
                  .filter(citation => citation.domain === targetDomain) || [];

                const firstCitationRank = targetDomainCitations.length > 0 ? targetDomainCitations[0]?.rank : null;
                const domainCitationCount = targetDomainCitations.length;

                return (
                  <div key={idx} className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 overflow-hidden">
                    {/* Collapsible Header */}
                    <button
                      onClick={() => toggleAIOverview(idx)}
                      className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <svg
                          className={`w-4 h-4 transform transition-transform text-gray-500 ${isExpanded ? 'rotate-90' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        <svg className="w-5 h-5 text-purple-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        <span className="font-semibold text-gray-900 dark:text-white text-left">{sr.q}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        {firstCitationRank !== null && (
                          <span className="text-xs font-semibold text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900 px-2 py-1 rounded-full">
                            Rank #{firstCitationRank} • {domainCitationCount} {domainCitationCount === 1 ? 'citation' : 'citations'}
                          </span>
                        )}
                        <span className="text-xs text-gray-500 dark:text-gray-400 bg-purple-100 dark:bg-purple-900 px-2 py-1 rounded-full">
                          {sr.aiOverviewData?.urls.length || 0} URLs
                        </span>
                      </div>
                    </button>

                    {/* Collapsible Content */}
                    {isExpanded && (
                      <div className="px-5 pb-4 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-700 dark:to-gray-600">
                        <div className="mb-4 p-4 bg-white dark:bg-gray-800 rounded-md border border-blue-200 dark:border-blue-900 shadow-sm">
                          <div className="prose prose-sm dark:prose-invert max-w-none">
                            {(() => {
                              // Strip out URLs and format text nicely
                              const text = sr.aiOverviewData?.text || '';

                              // Extract citation numbers that correspond to target domain
                              const targetCitationNumbers: number[] = [];
                              const citationRegex = /\[(\d+)\]/g;
                              let match;
                              const textBeforeClean = text;

                              // Find all citation numbers in the original text
                              while ((match = citationRegex.exec(textBeforeClean)) !== null) {
                                const citationNum = parseInt(match[1] || '0', 10);
                                // Check if this citation index corresponds to a target domain URL
                                if (sr.aiOverviewData?.urls[citationNum - 1]) {
                                  const citedUrl = sr.aiOverviewData.urls[citationNum - 1]?.url || '';
                                  const citedDomain = getDomainFromUrl(citedUrl);
                                  if (citedDomain === targetDomain) {
                                    targetCitationNumbers.push(citationNum);
                                  }
                                }
                              }

                              // Remove URLs but keep citation numbers temporarily
                              const cleanText = text
                                .replace(/https?:\/\/[^\s]+/g, '')
                                .replace(/\s+/g, ' ') // Clean up extra whitespace
                                .trim();

                              // Split into sentences for better readability
                              const sentences = cleanText.split(/\.\s+/).filter(s => s.trim());

                              // Function to highlight target domain citations in text
                              const highlightCitations = (sentence: string) => {
                                const parts: React.ReactNode[] = [];
                                let lastIndex = 0;
                                const regex = /\[(\d+)\]/g;
                                let citationMatch;

                                while ((citationMatch = regex.exec(sentence)) !== null) {
                                  const citationNum = parseInt(citationMatch[1] || '0', 10);
                                  const isTargetCitation = targetCitationNumbers.includes(citationNum);

                                  // Add text before the citation
                                  if (citationMatch.index > lastIndex) {
                                    parts.push(sentence.substring(lastIndex, citationMatch.index));
                                  }

                                  // Add the citation with or without highlighting
                                  parts.push(
                                    <mark
                                      key={citationMatch.index}
                                      className={isTargetCitation ? 'bg-green-200 dark:bg-green-700 font-semibold px-1 rounded' : 'bg-transparent'}
                                    >
                                      {citationMatch[0]}
                                    </mark>
                                  );

                                  lastIndex = regex.lastIndex;
                                }

                                // Add remaining text
                                if (lastIndex < sentence.length) {
                                  parts.push(sentence.substring(lastIndex));
                                }

                                return parts.length > 0 ? parts : sentence;
                              };

                              return sentences.map((sentence, i) => (
                                <p key={i} className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-2 last:mb-0">
                                  {highlightCitations(sentence.trim())}{i < sentences.length - 1 ? '.' : ''}
                                </p>
                              ));
                            })()}
                          </div>
                        </div>

                        {sr.aiOverviewData && sr.aiOverviewData.urls.length > 0 && (
                          <div>
                            <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-2">
                              Referenced URLs ({sr.aiOverviewData.urls.length})
                            </h4>
                            <div className="space-y-2">
                              {sr.aiOverviewData.urls.map((urlData, urlIdx) => {
                                const isTargetDomain = targetDomain && urlData.url.includes(targetDomain);
                                return (
                                  <div
                                    key={urlIdx}
                                    className={`flex items-start space-x-2 p-3 rounded border ${
                                      isTargetDomain
                                        ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
                                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                                    }`}
                                  >
                                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium flex-shrink-0 ${
                                      isTargetDomain
                                        ? 'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200'
                                        : 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                                    }`}>
                                      {urlIdx + 1}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                      <a
                                        href={urlData.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={`text-sm block truncate hover:underline ${
                                          isTargetDomain
                                            ? 'text-green-700 dark:text-green-400 font-bold'
                                            : 'text-blue-600 dark:text-blue-400'
                                        }`}
                                        title={urlData.url}
                                      >
                                        {urlData.url}
                                      </a>
                                      {urlData.title && (
                                        <p className={`text-xs mt-1 ${
                                          isTargetDomain
                                            ? 'text-green-700 dark:text-green-400 font-semibold'
                                            : 'text-gray-600 dark:text-gray-400'
                                        }`}>
                                          {urlData.title}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Clusters */}
      {clusters && clusters.length > 0 && (
        <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <div className="flex justify-between items-center mb-4">
            <button
              onClick={() => toggleSection('clusters')}
              className="flex items-center space-x-2 text-xl font-bold text-gray-900 dark:text-white hover:text-blue-600 transition-colors"
            >
              <span>Clusters ({clusters.length})</span>
              <svg
                className={`w-5 h-5 transform transition-transform ${expandedSections.clusters ? 'rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button
              onClick={() =>
                downloadCSV(
                  clusters.flatMap((c) => c.queries.map((q) => ({ clusterId: c.id, exemplar: c.exemplar, query: q }))),
                  'clusters.csv'
                )
              }
              className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
            >
              Export CSV
            </button>
          </div>
          {expandedSections.clusters && (
            <div className="space-y-6">
              {/* Bubble Visualization */}
              <div className="flex flex-wrap gap-4 p-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-600 rounded-lg min-h-[400px] items-center justify-center">
                {clusters.map((cluster) => {
                  const queryCount = cluster.queries.length;
                  // Size based on query count (min 80px, max 200px)
                  const size = Math.min(200, Math.max(80, 60 + queryCount * 15));
                  const isSelected = selectedCluster === cluster.id;
                  const isTargetCluster = cluster.id === 'target';

                  // Color palette for bubbles
                  const colors = [
                    'from-blue-400 to-blue-600',
                    'from-purple-400 to-purple-600',
                    'from-pink-400 to-pink-600',
                    'from-green-400 to-green-600',
                    'from-yellow-400 to-yellow-600',
                    'from-red-400 to-red-600',
                    'from-indigo-400 to-indigo-600',
                    'from-teal-400 to-teal-600',
                  ];
                  const colorIndex = clusters.indexOf(cluster) % colors.length;

                  // Use special gold gradient for target cluster
                  const bubbleColor = isTargetCluster
                    ? 'from-amber-400 via-yellow-500 to-orange-500'
                    : colors[colorIndex];

                  return (
                    <button
                      key={cluster.id}
                      onClick={() => setSelectedCluster(isSelected ? null : cluster.id)}
                      className={`relative flex-shrink-0 rounded-full bg-gradient-to-br ${bubbleColor} shadow-lg hover:shadow-2xl transform transition-all duration-300 hover:scale-110 cursor-pointer group ${
                        isSelected ? 'ring-4 ring-yellow-400 scale-110' : ''
                      } ${isTargetCluster ? 'ring-2 ring-amber-300' : ''}`}
                      style={{ width: `${size}px`, height: `${size}px` }}
                      title={`Click to view ${cluster.id}`}
                    >
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-3">
                        <div className="text-center">
                          {isTargetCluster && (
                            <div className="text-xl mb-1">🎯</div>
                          )}
                          <div className={`font-bold mb-1 ${queryCount > 5 ? 'text-2xl' : 'text-lg'}`}>
                            {queryCount}
                          </div>
                          <div className="text-xs opacity-90 line-clamp-2 uppercase font-semibold">
                            {isTargetCluster ? 'Target' : cluster.id.replace('cluster-', 'C')}
                          </div>
                        </div>
                      </div>
                      {/* Hover tooltip */}
                      <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-3 py-2 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                        {cluster.exemplar.substring(0, 40)}...
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Selected Cluster Details */}
              {selectedCluster && clusters.find(c => c.id === selectedCluster) && (
                <div className="border-2 border-yellow-400 dark:border-yellow-600 rounded-lg p-5 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-gray-700 dark:to-gray-600 animate-fadeIn">
                  {(() => {
                    const cluster = clusters.find(c => c.id === selectedCluster)!;
                    return (
                      <>
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="font-bold text-xl text-gray-900 dark:text-white flex items-center">
                              {cluster.id === 'target' ? (
                                <span className="mr-2 text-2xl">🎯</span>
                              ) : (
                                <svg className="w-6 h-6 mr-2 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                              )}
                              {cluster.id === 'target' ? 'Target Cluster' : cluster.id.replace('cluster-', 'Cluster ')}
                            </h3>
                            <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                              <span className="font-semibold">Exemplar:</span> {cluster.exemplar}
                            </p>
                          </div>
                          <button
                            onClick={() => setSelectedCluster(null)}
                            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                          >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-inner mb-4">
                          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                            Queries in this cluster ({cluster.queries.length}):
                          </p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {cluster.queries.map((q, idx) => (
                              <div
                                key={idx}
                                className="flex items-start space-x-2 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-600 p-3 rounded-lg border border-blue-200 dark:border-blue-900"
                              >
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-bold flex-shrink-0">
                                  {idx + 1}
                                </span>
                                <span className="text-sm text-gray-900 dark:text-white">{q}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* URL Overlap Matrix */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-inner">
                          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                            Top 10 URL Comparison (Side-by-Side):
                          </p>
                          <div className="overflow-x-auto">
                            <table className="min-w-full text-xs border-collapse">
                              <thead>
                                <tr className="bg-gray-100 dark:bg-gray-700">
                                  <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-left font-semibold text-gray-700 dark:text-gray-300 sticky left-0 bg-gray-100 dark:bg-gray-700 z-10 min-w-[200px] max-w-[200px]">
                                    Query
                                  </th>
                                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(pos => (
                                    <th key={pos} className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-center font-semibold text-gray-700 dark:text-gray-300 min-w-[150px]">
                                      #{pos}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {cluster.queries.map((query, qIdx) => {
                                  const serpResult = serpResults?.find(sr => sr.q === query);
                                  return (
                                    <tr key={qIdx} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                      <td className="border border-gray-300 dark:border-gray-600 px-2 py-2 font-medium text-gray-900 dark:text-white sticky left-0 bg-white dark:bg-gray-800 z-10 max-w-[200px]">
                                        <div className="truncate" title={query}>
                                          {query}
                                        </div>
                                      </td>
                                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(pos => {
                                        const result = serpResult?.top10?.find(r => r.position === pos);
                                        if (!result) {
                                          return (
                                            <td key={pos} className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-center text-gray-400">
                                              —
                                            </td>
                                          );
                                        }

                                        // Extract domain from URL for display
                                        const domain = result.url.replace(/^https?:\/\//, '').split('/')[0];

                                        // Check if any query in cluster has the same URL at any position
                                        const urlAppearances = cluster.queries.map(q => {
                                          const sr = serpResults?.find(s => s.q === q);
                                          return sr?.top10?.find(r => r.url === result.url);
                                        }).filter(Boolean).length;

                                        // Highlight if URL appears multiple times across queries
                                        const isShared = urlAppearances > 1;

                                        return (
                                          <td
                                            key={pos}
                                            className={`border border-gray-300 dark:border-gray-600 px-2 py-2 ${
                                              isShared
                                                ? 'bg-green-50 dark:bg-green-900/20'
                                                : ''
                                            }`}
                                          >
                                            <a
                                              href={result.url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className={`block truncate hover:underline ${
                                                isShared
                                                  ? 'text-green-700 dark:text-green-400 font-semibold'
                                                  : 'text-blue-600 dark:text-blue-400'
                                              }`}
                                              title={`${result.title}\n${result.url}\n${isShared ? `Appears in ${urlAppearances} queries` : ''}`}
                                            >
                                              {domain}
                                            </a>
                                          </td>
                                        );
                                      })}
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                          <div className="mt-3 flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded"></div>
                              <span>Shared URL (appears in multiple queries)</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded"></div>
                              <span>Unique URL</span>
                            </div>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Recommendations/Actions */}
      {filteredRecommendations && filteredRecommendations.length > 0 && (
        <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <div className="flex justify-between items-center mb-4">
            <button
              onClick={() => toggleSection('recommendations')}
              className="flex items-center space-x-2 text-xl font-bold text-gray-900 dark:text-white hover:text-blue-600 transition-colors"
            >
              <span>Action Recommendations ({filteredRecommendations.length}{filterText && ` of ${recommendations?.length}`})</span>
              <svg
                className={`w-5 h-5 transform transition-transform ${expandedSections.recommendations ? 'rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button
              onClick={() =>
                downloadCSV(
                  (filteredRecommendations || []).flatMap((rec) =>
                    rec.actions.map((action) => ({
                      clusterId: rec.clusterId,
                      exemplar: rec.exemplar,
                      query: action.q,
                      actionType: action.type,
                      actionLabel: getActionLabel(action.type),
                      details:
                        action.type === 'ok_other_page_diff_cluster'
                          ? action.details
                          : action.type === 'cannibalisation'
                          ? action.recommendedFix
                          : action.type === 'expand_target_page'
                          ? 'See outline in JSON export'
                          : 'See brief in JSON export',
                    }))
                  ),
                  'actions.csv'
                )
              }
              className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
            >
              Export CSV
            </button>
          </div>
          {expandedSections.recommendations && (
            <div className="space-y-6">
              {(() => {
                // Group all actions by type
                const actionsByType: Record<string, Array<{ action: any; clusterId: string; exemplar: string }>> = {};

                filteredRecommendations.forEach((rec) => {
                  rec.actions.forEach((action) => {
                    if (!actionsByType[action.type]) {
                      actionsByType[action.type] = [];
                    }
                    actionsByType[action.type]!.push({
                      action,
                      clusterId: rec.clusterId,
                      exemplar: rec.exemplar
                    });
                  });
                });

                // Sort action types by priority (most important first)
                const actionTypeOrder = [
                  'cannibalisation',
                  'expand_target_page',
                  'new_page',
                  'ok_other_page_diff_cluster'
                ];

                return actionTypeOrder
                  .filter(actionType => actionsByType[actionType])
                  .map((actionType) => {
                    const isExpanded = expandedActionTypes.has(actionType);
                    return (
                      <div key={actionType} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
                        <button
                          onClick={() => toggleActionType(actionType)}
                          className="flex items-center space-x-2 mb-4 w-full hover:opacity-80 transition-opacity"
                        >
                          <span className="text-xl">{getActionIcon(actionType)}</span>
                          <h3 className="font-semibold text-gray-900 dark:text-white text-lg">
                            {getActionLabel(actionType)} ({actionsByType[actionType]!.length})
                          </h3>
                          <svg
                            className={`w-5 h-5 ml-auto transform transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>

                        {isExpanded && (
                          <div className="space-y-3">
                            {actionsByType[actionType]!.map((item, idx) => (
                          <div
                            key={idx}
                            className={`p-3 rounded-md ${
                              actionType === 'cannibalisation'
                                ? 'bg-red-50 border border-red-200'
                                : 'bg-gray-50 border border-gray-200'
                            }`}
                          >
                            <div className="space-y-2">
                              <div className="flex justify-between items-start">
                                <p className="text-sm text-gray-700">
                                  <span className="font-medium">Query:</span> {item.action.q}
                                </p>
                                <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded">
                                  {item.clusterId}
                                </span>
                              </div>
                              
                              <div className="text-sm text-gray-600">
                                {item.action.type === 'ok_other_page_diff_cluster' && (
                                  <>
                                    <p>{item.action.details}</p>
                                    {item.action.suggestions && (
                                      <details className="mt-2">
                                        <summary className="cursor-pointer text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
                                          View improvement suggestions
                                        </summary>
                                        <div className="mt-2 text-xs bg-white dark:bg-gray-700 p-3 rounded border border-gray-200 dark:border-gray-600 whitespace-pre-wrap">
                                          {item.action.suggestions}
                                        </div>
                                      </details>
                                    )}
                                  </>
                                )}
                                {item.action.type === 'cannibalisation' && (
                                  <p>{item.action.recommendedFix}</p>
                                )}
                                {item.action.type === 'expand_target_page' && (
                                  <details className="mt-2">
                                    <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                                      View content outline
                                    </summary>
                                    <pre className="mt-2 text-xs bg-white p-2 rounded border overflow-x-auto">
                                      {item.action.outline}
                                    </pre>
                                  </details>
                                )}
                                {item.action.type === 'new_page' && (
                                  <details className="mt-2">
                                    <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                                      View page brief
                                    </summary>
                                    <pre className="mt-2 text-xs bg-white p-2 rounded border overflow-x-auto">
                                      {item.action.pageBrief}
                                    </pre>
                                  </details>
                                )}
                              </div>
                            </div>
                          </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  });
              })()}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
