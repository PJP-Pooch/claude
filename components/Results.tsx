'use client';

import { useState } from 'react';
import { SubQuery, SerpResult, Cluster, ClusterRecommendation } from '@/lib/types';
import Papa from 'papaparse';

type ResultsProps = {
  subQueries?: SubQuery[];
  serpResults?: SerpResult[];
  clusters?: Cluster[];
  recommendations?: ClusterRecommendation[];
};

export default function Results({ subQueries, serpResults, clusters, recommendations }: ResultsProps) {
  const [subQueryFilter, setSubQueryFilter] = useState('');
  const [serpFilter, setSerpFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
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
      case 'great_target_page_ranking':
        return '✅';
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
      case 'great_target_page_ranking':
        return 'Great: Target page ranks';
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

  // Apply filters
  const filteredSubQueries = subQueries?.filter((sq) =>
    sq.q.toLowerCase().includes(subQueryFilter.toLowerCase()) ||
    sq.intent.toLowerCase().includes(subQueryFilter.toLowerCase()) ||
    sq.rationale.toLowerCase().includes(subQueryFilter.toLowerCase())
  );

  const filteredSerpResults = serpResults?.filter((sr) =>
    sr.q.toLowerCase().includes(serpFilter.toLowerCase())
  );

  const filteredRecommendations = recommendations?.map((rec) => ({
    ...rec,
    actions: rec.actions.filter((action) =>
      action.q.toLowerCase().includes(actionFilter.toLowerCase()) ||
      getActionLabel(action.type).toLowerCase().includes(actionFilter.toLowerCase())
    ),
  })).filter((rec) => rec.actions.length > 0 || actionFilter === '');

  return (
    <div className="space-y-8">
      {/* Sub-Queries Table */}
      {subQueries && subQueries.length > 0 && (
        <section className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">
              Sub-Queries ({filteredSubQueries?.length || 0}/{subQueries.length})
            </h2>
            <div className="space-x-2">
              <button
                onClick={() => downloadCSV(subQueries, 'sub-queries.csv')}
                className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
              >
                Export CSV
              </button>
              <button
                onClick={() => downloadJSON(subQueries, 'sub-queries.json')}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Export JSON
              </button>
            </div>
          </div>
          <div className="mb-4">
            <input
              type="text"
              placeholder="🔍 Search sub-queries..."
              value={subQueryFilter}
              onChange={(e) => setSubQueryFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Query
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Intent
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rationale
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredSubQueries?.map((sq, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{sq.q}</td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          sq.intent === 'info'
                            ? 'bg-blue-100 text-blue-800'
                            : sq.intent === 'comm'
                            ? 'bg-green-100 text-green-800'
                            : sq.intent === 'trans'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-orange-100 text-orange-800'
                        }`}
                      >
                        {sq.intent}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{sq.rationale}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* SERP Results Table */}
      {serpResults && serpResults.length > 0 && (
        <section className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">
              SERP Results ({filteredSerpResults?.length || 0}/{serpResults.length})
            </h2>
            <div className="space-x-2">
              <button
                onClick={() =>
                  downloadCSV(
                    serpResults.map((sr) => ({
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
          <div className="mb-4">
            <input
              type="text"
              placeholder="🔍 Search SERP results..."
              value={serpFilter}
              onChange={(e) => setSerpFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Query
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    AI Overview
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Target Page
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Same Domain
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    First Match
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredSerpResults?.map((sr, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{sr.q}</td>
                    <td className="px-4 py-3 text-sm">
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
                    <td className="px-4 py-3 text-sm">
                      {sr.targetPageOnPage1 ? (
                        <span className="text-green-600 font-medium">✓ Ranks</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {sr.sameDomainOnPage1 ? (
                        <span className="text-blue-600 font-medium">✓ Yes</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {sr.firstMatch ? `#${sr.firstMatch.position}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Clusters */}
      {clusters && clusters.length > 0 && (
        <section className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">Clusters ({clusters.length})</h2>
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
          <div className="space-y-4">
            {clusters.map((cluster) => (
              <div key={cluster.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-semibold text-gray-900">{cluster.id}</h3>
                    <p className="text-sm text-gray-600">
                      Exemplar: <span className="font-medium">{cluster.exemplar}</span>
                    </p>
                  </div>
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                    {cluster.queries.length} queries
                  </span>
                </div>
                <div className="mt-2">
                  <p className="text-sm text-gray-700 mb-1">Queries:</p>
                  <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                    {cluster.queries.map((q, idx) => (
                      <li key={idx}>{q}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recommendations/Actions */}
      {recommendations && recommendations.length > 0 && (
        <section className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">Action Recommendations</h2>
            <button
              onClick={() =>
                downloadCSV(
                  recommendations.flatMap((rec) =>
                    rec.actions.map((action) => ({
                      clusterId: rec.clusterId,
                      exemplar: rec.exemplar,
                      query: action.q,
                      actionType: action.type,
                      actionLabel: getActionLabel(action.type),
                      details:
                        action.type === 'great_target_page_ranking'
                          ? action.details
                          : action.type === 'ok_other_page_diff_cluster'
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
          <div className="mb-4">
            <input
              type="text"
              placeholder="🔍 Search actions by query or type..."
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="space-y-6">
            {filteredRecommendations?.map((rec) => (
              <div key={rec.clusterId} className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-2">{rec.clusterId}</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Exemplar: <span className="font-medium">{rec.exemplar}</span>
                </p>
                <div className="space-y-3">
                  {rec.actions.map((action, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-md ${
                        action.type === 'cannibalisation'
                          ? 'bg-red-50 border border-red-200'
                          : action.type === 'great_target_page_ranking'
                          ? 'bg-green-50 border border-green-200'
                          : 'bg-gray-50 border border-gray-200'
                      }`}
                    >
                      <div className="flex items-start space-x-2">
                        <span className="text-lg">{getActionIcon(action.type)}</span>
                        <div className="flex-1">
                          <p className="font-medium text-sm text-gray-900">{getActionLabel(action.type)}</p>
                          <p className="text-sm text-gray-700 mt-1">
                            <span className="font-medium">Query:</span> {action.q}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            {action.type === 'great_target_page_ranking' && action.details}
                            {action.type === 'ok_other_page_diff_cluster' && action.details}
                            {action.type === 'cannibalisation' && action.recommendedFix}
                            {action.type === 'expand_target_page' && (
                              <details className="mt-2">
                                <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                                  View content outline
                                </summary>
                                <pre className="mt-2 text-xs bg-white p-2 rounded border overflow-x-auto">
                                  {action.outline}
                                </pre>
                              </details>
                            )}
                            {action.type === 'new_page' && (
                              <details className="mt-2">
                                <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                                  View page brief
                                </summary>
                                <pre className="mt-2 text-xs bg-white p-2 rounded border overflow-x-auto">
                                  {action.pageBrief}
                                </pre>
                              </details>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
