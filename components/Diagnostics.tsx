'use client';

import { DiagnosticLog } from '@/lib/types';

type DiagnosticsProps = {
  logs: DiagnosticLog[];
  currentStep?: string;
};

export default function Diagnostics({ logs, currentStep }: DiagnosticsProps) {
  if (logs.length === 0 && !currentStep) {
    return null;
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Diagnostics</h2>

      {currentStep && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm font-medium text-blue-900">Current Step: {currentStep}</p>
        </div>
      )}

      {logs.length > 0 && (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {logs.map((log, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-md text-sm ${
                log.level === 'error'
                  ? 'bg-red-50 border border-red-200 text-red-900'
                  : log.level === 'warning'
                  ? 'bg-yellow-50 border border-yellow-200 text-yellow-900'
                  : 'bg-gray-50 border border-gray-200 text-gray-900'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-medium">
                    {log.level === 'error' && '❌ '}
                    {log.level === 'warning' && '⚠️ '}
                    {log.level === 'info' && 'ℹ️ '}
                    {log.message}
                  </p>
                  {log.context && Object.keys(log.context).length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs opacity-75 hover:opacity-100">
                        Show details
                      </summary>
                      <pre className="mt-1 text-xs bg-white p-2 rounded overflow-x-auto">
                        {JSON.stringify(log.context, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
                <span className="text-xs opacity-75 ml-2">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
