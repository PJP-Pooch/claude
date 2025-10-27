'use client';

import { useState } from 'react';
import { AppInput } from '@/lib/types';

type FormProps = {
  onSubmit: (input: AppInput) => void;
  isLoading: boolean;
};

const LOCATIONS = [
  'United Kingdom',
  'United States',
  'Canada',
  'Australia',
  'Germany',
  'France',
  'Spain',
  'Italy',
  'Netherlands',
  'Belgium',
  'Switzerland',
  'Austria',
  'Ireland',
  'New Zealand',
  'India',
  'Singapore',
  'Japan',
];

const LANGUAGES = [
  'English',
  'Spanish',
  'French',
  'German',
  'Italian',
  'Dutch',
  'Portuguese',
  'Russian',
  'Chinese',
  'Japanese',
  'Korean',
  'Arabic',
  'Hindi',
];

export default function Form({ onSubmit, isLoading }: FormProps) {
  const [targetQuery, setTargetQuery] = useState('');
  const [targetPageUrl, setTargetPageUrl] = useState('');
  const [openaiApiKey, setOpenaiApiKey] = useState(process.env.NEXT_PUBLIC_OPENAI_API_KEY || '');
  const [dataForSeoApiLogin, setDataForSeoApiLogin] = useState(process.env.NEXT_PUBLIC_DATAFORSEO_LOGIN || '');
  const [dataForSeoApiPassword, setDataForSeoApiPassword] = useState(process.env.NEXT_PUBLIC_DATAFORSEO_PASSWORD || '');
  const [location, setLocation] = useState(process.env.NEXT_PUBLIC_DEFAULT_LOCATION || 'United Kingdom');
  const [language, setLanguage] = useState(process.env.NEXT_PUBLIC_DEFAULT_LANGUAGE || 'English');
  const [device, setDevice] = useState<'desktop' | 'mobile'>((process.env.NEXT_PUBLIC_DEFAULT_DEVICE as 'desktop' | 'mobile') || 'desktop');
  const [clusteringOverlapThreshold, setClusteringOverlapThreshold] = useState(parseInt(process.env.NEXT_PUBLIC_DEFAULT_CLUSTERING_OVERLAP || '4'));
  const [maxQueries, setMaxQueries] = useState(parseInt(process.env.NEXT_PUBLIC_MAX_QUERIES || '25'));
  const [mockMode, setMockMode] = useState(process.env.NEXT_PUBLIC_MOCK_MODE === 'true');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    onSubmit({
      targetQuery,
      targetPageUrl,
      openaiApiKey,
      dataForSeoApiLogin,
      dataForSeoApiPassword,
      location,
      language,
      searchEngine: 'google',
      device,
      clusteringOverlapThreshold,
      maxQueries,
      mockMode,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow-md">
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-gray-900">SERP Query Clustering</h2>
        <p className="text-sm text-gray-600">
          Analyze SERP results to discover content opportunities and identify cannibalization issues.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label htmlFor="targetQuery" className="block text-sm font-medium text-gray-700 mb-1">
            Target Query *
          </label>
          <input
            type="text"
            id="targetQuery"
            value={targetQuery}
            onChange={(e) => setTargetQuery(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., content marketing strategy"
          />
        </div>

        <div className="md:col-span-2">
          <label htmlFor="targetPageUrl" className="block text-sm font-medium text-gray-700 mb-1">
            Target Page URL *
          </label>
          <input
            type="url"
            id="targetPageUrl"
            value={targetPageUrl}
            onChange={(e) => setTargetPageUrl(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="https://example.com/your-page"
          />
        </div>

        <div>
          <label htmlFor="dataForSeoApiLogin" className="block text-sm font-medium text-gray-700 mb-1">
            DataForSEO Login {!mockMode && '*'}
          </label>
          <input
            type="text"
            id="dataForSeoApiLogin"
            value={dataForSeoApiLogin}
            onChange={(e) => setDataForSeoApiLogin(e.target.value)}
            required={!mockMode}
            disabled={mockMode}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
            placeholder={mockMode ? "Not needed in mock mode" : "login@example.com"}
          />
          <p className="mt-1 text-xs text-gray-500">
            {mockMode ? "Mock mode uses sample data - no API needed" : "Used to fetch SERP data from Google for each query."}
          </p>
        </div>

        <div>
          <label htmlFor="openaiApiKey" className="block text-sm font-medium text-gray-700 mb-1">
            OpenAI API Key {!mockMode && '*'}
          </label>
          <input
            type="password"
            id="openaiApiKey"
            value={openaiApiKey}
            onChange={(e) => setOpenaiApiKey(e.target.value)}
            required={!mockMode}
            disabled={mockMode}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
            placeholder={mockMode ? "Not needed in mock mode" : "Enter your OpenAI API key"}
          />
          <p className="mt-1 text-xs text-gray-500">
            {mockMode ? "Mock mode uses sample data - no API needed" : "Used to generate sub-queries and semantic analysis. You can add/remove queries after generation."}
          </p>
        </div>

        <div>
          <label htmlFor="dataForSeoApiPassword" className="block text-sm font-medium text-gray-700 mb-1">
            DataForSEO Password {!mockMode && '*'}
          </label>
          <input
            type="password"
            id="dataForSeoApiPassword"
            value={dataForSeoApiPassword}
            onChange={(e) => setDataForSeoApiPassword(e.target.value)}
            required={!mockMode}
            disabled={mockMode}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
            placeholder={mockMode ? "Not needed in mock mode" : "Enter your password"}
          />
        </div>

        {/* Empty div to keep DataForSEO fields grouped on the left */}
        <div></div>

        <div>
          <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
            Location
          </label>
          <select
            id="location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {LOCATIONS.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="language" className="block text-sm font-medium text-gray-700 mb-1">
            Language
          </label>
          <select
            id="language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="device" className="block text-sm font-medium text-gray-700 mb-1">
            Device
          </label>
          <select
            id="device"
            value={device}
            onChange={(e) => setDevice(e.target.value as 'desktop' | 'mobile')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="desktop">Desktop</option>
            <option value="mobile">Mobile</option>
          </select>
        </div>

        <div>
          <label htmlFor="threshold" className="block text-sm font-medium text-gray-700 mb-1">
            Clustering Overlap Threshold: {clusteringOverlapThreshold}
          </label>
          <input
            type="range"
            id="threshold"
            min="1"
            max="10"
            value={clusteringOverlapThreshold}
            onChange={(e) => setClusteringOverlapThreshold(parseInt(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>1 (Loose)</span>
            <span>10 (Strict)</span>
          </div>
        </div>

        <div>
          <label htmlFor="maxQueries" className="block text-sm font-medium text-gray-700 mb-1">
            Max Queries to Analyze
          </label>
          <input
            type="number"
            id="maxQueries"
            min="1"
            max="50"
            value={maxQueries}
            onChange={(e) => setMaxQueries(parseInt(e.target.value) || 1)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="mt-1 text-xs text-gray-600">
            <span className="font-medium">Estimated cost:</span>{' '}
            <span className="text-green-600 font-semibold">
              ${(maxQueries * 0.03).toFixed(2)} - ${(maxQueries * 0.05).toFixed(2)}
            </span>
            {' '}(DataForSEO: ~$0.01/query, OpenAI: ~$0.02-0.04/query)
          </p>
        </div>

        <div className="md:col-span-2">
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
            <label className="flex items-start space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={mockMode}
                onChange={(e) => setMockMode(e.target.checked)}
                className="w-5 h-5 mt-0.5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <div>
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  🎭 Demo Mode - Test Without API Keys
                </span>
                <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                  Try the app with realistic sample data. No API credentials required. Perfect for demos and testing.
                </p>
              </div>
            </label>
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-blue-600 text-white py-3 px-4 rounded-md font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? 'Analyzing...' : 'Start Analysis'}
      </button>
    </form>
  );
}
