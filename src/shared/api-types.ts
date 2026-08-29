/**
 * API Error Envelope (ADR-0008)
 * Standard response format for all API errors
 */
export interface ApiErrorEnvelope {
  code: string;
  category: 'VALIDATION' | 'NOT_FOUND' | 'CONFLICT' | 'INTEGRATION' | 'INTERNAL' | 'UNAUTHORIZED';
  message: string;
  correlationId: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

/**
 * API Success Envelope
 * Standard response format for successful API calls
 */
export interface ApiSuccessEnvelope<T> {
  data: T;
  correlationId: string;
  timestamp: string;
}

/**
 * Error handler for route handlers (ADR-0008)
 * Converts errors to standard API error envelope
 */
export class ApiError extends Error {
  constructor(
    public code: string,
    public category: ApiErrorEnvelope['category'],
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
