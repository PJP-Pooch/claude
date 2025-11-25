'use client';

import { useState } from 'react';
import Link from 'next/link';
import ThemeToggle from '@/components/ThemeToggle';
import { ThemeProvider } from '@/components/ThemeProvider';

export default function Home() {
  const [feedbackType, setFeedbackType] = useState('Feedback');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackEmail, setFeedbackEmail] = useState('');
  const [feedbackStatus, setFeedbackStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackStatus('submitting');

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: feedbackType,
          message: feedbackMessage,
          email: feedbackEmail,
        }),
      });

      if (response.ok) {
        setFeedbackStatus('success');
        setFeedbackMessage('');
        setFeedbackEmail('');
        setTimeout(() => setFeedbackStatus('idle'), 3000);
      } else {
        setFeedbackStatus('error');
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
      setFeedbackStatus('error');
    }
  };

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
      features: [
        'Historical search volume trends',
        '12-month demand forecasting',
        'Seasonality type classification',
        'Content calendar planning',
        'Actionability scoring',
      ],
    },
    // Placeholder for future tools
    {
      id: 'coming-soon-1',
      title: 'More Tools Coming Soon',
      description: 'We\'re working on additional SEO and content analysis tools to help you optimize your digital presence.',
      icon: (
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      ),
      href: '#',
      color: 'from-gray-400 to-gray-500',
      features: [
        'More features in development',
        'Stay tuned for updates',
      ],
      disabled: true,
    },
  ];

  return (
    <ThemeProvider>
      <ThemeToggle />
      <main className="min-h-screen bg-gray-100 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8 transition-colors">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-12 text-center">
            <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4">
              SEO Analysis Tools
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Powerful tools to analyze, optimize, and improve your search engine performance
            </p>
          </div>

          {/* Tools Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8">
            {tools.map((tool) => (
              <Link
                key={tool.id}
                href={tool.href}
                className={`block group ${tool.disabled ? 'pointer-events-none' : ''}`}
              >
                <div
                  className={`h-full bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden transition-all duration-300 ${tool.disabled
                    ? 'opacity-60'
                    : 'hover:shadow-2xl hover:-translate-y-2'
                    }`}
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


          {/* Feedback Form */}
          <div className="mt-20 max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Feedback & Bug Reports
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                Help us improve! Let us know if you found a bug or have a suggestion.
              </p>
            </div>

            <form onSubmit={handleSubmitFeedback} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Type
                  </label>
                  <select
                    id="type"
                    value={feedbackType}
                    onChange={(e) => setFeedbackType(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  >
                    <option value="Feedback">General Feedback</option>
                    <option value="Bug Report">Bug Report</option>
                    <option value="Feature Request">Feature Request</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Email (Optional)
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={feedbackEmail}
                    onChange={(e) => setFeedbackEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Message
                </label>
                <textarea
                  id="message"
                  value={feedbackMessage}
                  onChange={(e) => setFeedbackMessage(e.target.value)}
                  required
                  rows={4}
                  placeholder="Tell us what you think or describe the issue..."
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={feedbackStatus === 'submitting' || feedbackStatus === 'success'}
                  className={`px-6 py-2 rounded-lg font-semibold text-white transition-all duration-200 ${feedbackStatus === 'success'
                    ? 'bg-green-600 hover:bg-green-700'
                    : feedbackStatus === 'error'
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-blue-600 hover:bg-blue-700'
                    } disabled:opacity-70 disabled:cursor-not-allowed flex items-center`}
                >
                  {feedbackStatus === 'submitting' ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Sending...
                    </>
                  ) : feedbackStatus === 'success' ? (
                    <>
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Sent Successfully!
                    </>
                  ) : feedbackStatus === 'error' ? (
                    'Error - Try Again'
                  ) : (
                    'Send Feedback'
                  )}
                </button>
              </div>
            </form>
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
    </ThemeProvider >
  );
}
