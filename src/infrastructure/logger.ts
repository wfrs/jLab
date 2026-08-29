/**
 * Logger implementation using pino (ADR-0008)
 * Structured JSON logging with correlation ID support
 */

import pino, { Logger as PinoLogger } from 'pino';

const isDev = process.env.NODE_ENV === 'development';

export interface LogContext {
  correlationId?: string;
  userId?: string;
  operation?: string;
  [key: string]: unknown;
}

let globalLogger: PinoLogger;

function getLogger(): PinoLogger {
  if (!globalLogger) {
    const options: any = {
      level: process.env.API_LOG_LEVEL || 'info',
    };

    if (isDev) {
      options.transport = {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      };
    }

    globalLogger = pino(options);
  }
  return globalLogger;
}

/**
 * Create a child logger with correlation ID for request tracking (ADR-0008)
 */
export function createRequestLogger(correlationId: string): PinoLogger {
  return getLogger().child({ correlationId });
}

export class Logger {
  private logger: PinoLogger;

  constructor(context?: LogContext) {
    this.logger = context?.correlationId ? getLogger().child(context) : getLogger();
  }

  debug(msg: string, data?: LogContext): void {
    this.logger.debug(data || {}, msg);
  }

  info(msg: string, data?: LogContext): void {
    this.logger.info(data || {}, msg);
  }

  warn(msg: string, data?: LogContext): void {
    this.logger.warn(data || {}, msg);
  }

  error(msg: string, error?: Error | unknown, data?: LogContext): void {
    if (error instanceof Error) {
      this.logger.error({ ...data, stack: error.stack }, msg, error.message);
    } else {
      this.logger.error(data || {}, msg);
    }
  }
}

/**
 * Redaction utility for logging (ADR-0008)
 * Prevents secrets from being logged
 */
const REDACTED = '[REDACTED]';
const SENSITIVE_KEYS = [
  'password',
  'apiKey',
  'api_key',
  'secret',
  'token',
  'authorization',
  'clientSecret',
  'client_secret',
];

export function redactSensitiveData(obj: unknown): unknown {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => redactSensitiveData(item));
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (
      SENSITIVE_KEYS.some((sensitiveKey) => key.toLowerCase().includes(sensitiveKey.toLowerCase()))
    ) {
      result[key] = REDACTED;
    } else if (typeof value === 'object' && value !== null) {
      result[key] = redactSensitiveData(value);
    } else {
      result[key] = value;
    }
  }

  return result;
}
