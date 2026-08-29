/**
 * API envelope helpers (ADR-0008)
 * Framework-free: builds plain envelope objects + status codes so route
 * handlers stay thin and the logic is unit-testable without Next.js.
 */

import { ZodError } from 'zod';
import { DomainError } from '@domain/types';
import { ApiError, ApiErrorEnvelope, ApiSuccessEnvelope } from './api-types';

/** Maps DomainError codes to API error categories */
const DOMAIN_CODE_TO_CATEGORY: Record<string, ApiErrorEnvelope['category']> = {
  VALIDATION: 'VALIDATION',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  DATABASE: 'INTERNAL',
  INTEGRATION: 'INTEGRATION',
};

/** Maps error categories to HTTP status codes */
const CATEGORY_TO_STATUS: Record<ApiErrorEnvelope['category'], number> = {
  VALIDATION: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTEGRATION: 502,
  INTERNAL: 500,
};

export function createSuccessEnvelope<T>(data: T, correlationId: string): ApiSuccessEnvelope<T> {
  return {
    data,
    correlationId,
    timestamp: new Date().toISOString(),
  };
}

export function createErrorEnvelope(error: unknown, correlationId: string): ApiErrorEnvelope {
  const timestamp = new Date().toISOString();

  if (error instanceof ApiError) {
    const envelope: ApiErrorEnvelope = {
      code: error.code,
      category: error.category,
      message: error.message,
      correlationId,
      timestamp,
    };
    if (error.details !== undefined) {
      envelope.details = error.details;
    }
    return envelope;
  }

  if (error instanceof DomainError) {
    const envelope: ApiErrorEnvelope = {
      code: error.code,
      category: DOMAIN_CODE_TO_CATEGORY[error.code] || 'INTERNAL',
      message: error.message,
      correlationId,
      timestamp,
    };
    if (error.details !== undefined) {
      envelope.details = error.details;
    }
    return envelope;
  }

  if (error instanceof ZodError) {
    const firstIssue = error.issues[0];
    return {
      code: 'VALIDATION_ERROR',
      category: 'VALIDATION',
      message: firstIssue
        ? `${firstIssue.path.length > 0 ? `${firstIssue.path.join('.')}: ` : ''}${firstIssue.message}`
        : 'Invalid request body',
      correlationId,
      details: {
        issues: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
          code: issue.code,
        })),
      },
      timestamp,
    };
  }

  const message = error instanceof Error ? error.message : 'Unknown error occurred';
  return {
    code: 'INTERNAL_ERROR',
    category: 'INTERNAL',
    message,
    correlationId,
    timestamp,
  };
}

/** HTTP status code for an error envelope */
export function statusForErrorEnvelope(envelope: ApiErrorEnvelope): number {
  return CATEGORY_TO_STATUS[envelope.category] ?? 500;
}
