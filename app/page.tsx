'use client';

import Link from 'next/link';
import { useState } from 'react';
import ThemeToggle from '@/components/ThemeToggle';
import { ThemeProvider } from '@/components/ThemeProvider';

export default function Home() {
  const [apiFilter, setApiFilter] = useState<'all' | 'dataforseo' | 'google'>('all');

  const tools = [
    {
      id: 'serp',
      title: 'Query Fan Out Analysis',
      description: 'Analyze SERP results to discover content opportunities and identify cannibalization issues using AI-powered query fan-out and SERP-similarity clustering.',
      icon: (
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      href: '/tools/serp',
      color: 'from-blue-500 to-indigo-600',
      apiType: 'dataforseo',
      features: [
        'AI-powered query generation',
        'SERP similarity clustering',
        'Cannibalization detection',
        'Content gap analysis',
        'AI Overview tracking',
      ],
    },
    {
      id: 'seasonality',
      title: 'Seasonal Search Volume Explorer',
      description: 'Analyze historical search trends, forecast future demand, and plan your content calendar with seasonality insights.',
      icon: (
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
        </svg>
      ),
      href: '/seasonality',
      color: 'from-green-500 to-teal-600',
      apiType: 'dataforseo',
      features: [
        'Historical search volume trends',
        '12-month demand forecasting',
        'Seasonality type classification',
        'Content calendar planning',
        'Actionability scoring',
      ],
    },
    {
      id: 'social-serp',
      title: 'Social SERP Explorer',
      description: 'Fetch Reddit, Pinterest, Instagram, TikTok, and YouTube results for your keyword via DataForSEO, and export them to Excel.',
      icon: (
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      href: '/tools/social-serp',
      color: 'from-purple-500 to-pink-600',
      apiType: 'dataforseo',
      features: [
        'Multi-platform search',
        'Reddit, TikTok, Instagram & more',
        'Excel export',
        'Live SERP data',
        'Domain filtering',
      ],
    },
    {
      id: 'gsc-export',
      title: 'GSC Bulk Export & Query Insights',
      description: 'Export all your Google Search Console queries with full metrics, analyze query position distribution, and identify optimization opportunities.',
      icon: (
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      href: '/tools/gsc-export',
      color: 'from-orange-500 to-red-600',
      apiType: 'google',
      features: [
        'OAuth integration with GSC',
        'Bulk export all queries',
        'Position distribution analysis',
        'Monthly trend visualization',
        'CSV export with full metrics',
      ],
    },
    {
      id: 'product-price-monitor',
      title: 'Product Price Monitor',
      description: 'Track product prices and availability on Google Shopping. Monitor competitor pricing, analyze seller information, and export data for analysis.',
      icon: (
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      href: '/tools/product-price-monitor',
      color: 'from-emerald-500 to-green-600',
      apiType: 'dataforseo',
      features: [
        'Real-time price tracking',
        'Competitor comparison',
        'Seller information analysis',
        'Stock availability monitoring',
        'CSV export functionality',
      ],
    },
    {
      id: 'brand-visibility',
      title: 'Brand Visibility Tracker',
      description: 'Analyze brand mentions and share of voice in ChatGPT responses. Identify competitors and track brand presence in AI-generated content.',
      icon: (
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
        </svg>
      ),
      href: '/tools/brand-visibility-tracker',
      color: 'from-cyan-500 to-blue-600',
      apiType: 'dataforseo',
      features: [
        'Share of Voice Analysis',
        'Competitor Tracking',
        'ChatGPT Response Analysis',
        'Aggregated Brand Mentions',
        'Data Export',
      ],
    },
    /*
    {
      id: 'merchant-price',
      title: 'Merchant Center Price Competitiveness',
      description: 'Compare your Merchant Center prices vs Google’s benchmark to find overpriced or underpriced products and improve Shopping ROAS.',
      icon: (
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
      ),
      href: '/tools/merchant-price-competitiveness',
      color: 'from-blue-500 to-cyan-600',
      apiType: 'google',
      features: [
        'Price competitiveness benchmarks',
        'Identify under/overpriced products',
        'Market Insights data',
        'Visual price distribution',
        'CSV export',
      ],
    },
    */
    // Placeholder for future tools
    {
      id: 'coming-soon-1',
      title: 'More Tools Coming Soon',
      description: "We're working on additional SEO and content analysis tools to help you optimize your digital presence.",
      icon: (
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      ),
      href: '#',
      color: 'from-gray-400 to-gray-500',
      apiType: 'all',
      features: [
        'More features in development',
        'Stay tuned for updates',
      ],
      disabled: true,
    },
  ];

  const filteredTools = tools.filter(tool =>
    apiFilter === 'all' || tool.apiType === apiFilter || tool.apiType === 'all'
  );

  return (
    <ThemeProvider>
      <ThemeToggle />
      <main className="min-h-screen bg-gray-100 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8 transition-colors">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8 text-center">
            <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4">
              SEO Analysis Tools
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto mb-8">
              Powerful tools to analyze, optimize, and improve your search engine performance
            </p>

            {/* API Toggle */}
            <div className="inline-flex bg-white dark:bg-gray-800 rounded-lg p-1 shadow-sm border border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setApiFilter('all')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${apiFilter === 'all'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
              >
                All Tools
              </button>
              <button
                onClick={() => setApiFilter('dataforseo')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${apiFilter === 'dataforseo'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
              >
                DataForSEO API
              </button>
              <button
                onClick={() => setApiFilter('google')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${apiFilter === 'google'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
              >
                Google API
              </button>
            </div>
          </div>

          {/* Tools Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8">
            {filteredTools.map((tool) => (
              <Link
                key={tool.id}
                href={tool.href}
                className={`block group ${tool.disabled ? 'pointer-events-none' : ''}`}
              >
                <div
                  className={`h-full bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden transition-all duration-300 ${tool.disabled ? 'opacity-60' : 'hover:shadow-2xl hover:-translate-y-2'}`}
                >
                  {/* Card Header */}
                  <div className={`bg-gradient-to-r ${tool.color} p-6 text-white`}>
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0">
                        {tool.icon}
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold mb-1">
                          {tool.title}
                        </h2>
                        {tool.disabled && (
                          <span className="inline-block px-2 py-1 text-xs bg-white/20 rounded-full">
                            Coming Soon
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-6">
                    <p className="text-gray-600 dark:text-gray-300 mb-4">
                      {tool.description}
                    </p>

                    {/* Features List */}
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide mb-3">
                        Features
                      </h3>
                      <ul className="space-y-2">
                        {tool.features.map((feature, idx) => (
                          <li
                            key={idx}
                            className="flex items-start space-x-2 text-sm text-gray-700 dark:text-gray-300"
                          >
                            <svg
                              className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Card Footer */}
                  {!tool.disabled && (
                    <div className="px-6 pb-6">
                      <div className="flex items-center text-blue-600 dark:text-blue-400 font-semibold group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">
                        <span>Launch Tool</span>
                        <svg
                          className="w-5 h-5 ml-2 transform group-hover:translate-x-1 transition-transform"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13 7l5 5m0 0l-5 5m5-5H6"
                          />
                        </svg>
                      </div>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-16 text-center text-gray-600 dark:text-gray-400">
            <p className="text-sm mb-2">
              Built with Next.js 14 • Powered by OpenAI & DataForSEO
            </p>
            <p className="text-sm">
              Questions? Connect with me on <a href="https://www.linkedin.com/in/phillippratt1/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline dark:text-blue-400">LinkedIn</a>
            </p>
          </div>
        </div>
      </main>
    </ThemeProvider>
  );
}
