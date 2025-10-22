export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, context);
    this.name = 'ValidationError';
  }
}

export class GeminiAPIError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'GEMINI_API_ERROR', 502, context);
    this.name = 'GeminiAPIError';
  }
}

export class DataForSEOAPIError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'DATAFORSEO_API_ERROR', 502, context);
    this.name = 'DataForSEOAPIError';
  }
}

export class RateLimitError extends AppError {
  constructor(
    message: string,
    public retryAfter?: number,
    context?: Record<string, unknown>
  ) {
    super(message, 'RATE_LIMIT_ERROR', 429, context);
    this.name = 'RateLimitError';
  }
}

export class ClusteringError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'CLUSTERING_ERROR', 500, context);
    this.name = 'ClusteringError';
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function handleError(error: unknown): {
  message: string;
  code: string;
  statusCode: number;
  context?: Record<string, unknown>;
} {
  if (isAppError(error)) {
    return {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      context: error.context,
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      code: 'UNKNOWN_ERROR',
      statusCode: 500,
    };
  }

  return {
    message: 'An unknown error occurred',
    code: 'UNKNOWN_ERROR',
    statusCode: 500,
  };
}
