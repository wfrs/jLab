/**
 * Query builder (knex) initialization (ADR-0005)
 * SQL-agnostic query builder for SQLite
 */

import knex, { Knex } from 'knex';
import { Logger } from './logger';

const logger = new Logger({ operation: 'query-builder-init' });

let queryBuilder: Knex | null = null;

export function getQueryBuilder(): Knex {
  if (!queryBuilder) {
    const dbPath = process.env.DATABASE_URL || './jlab.db';

    queryBuilder = knex({
      client: 'sqlite3',
      connection: {
        filename: dbPath,
      },
      useNullAsDefault: true,
      log: {
        warn: (message: string) => logger.warn(message),
        error: (message: string) => logger.error(message),
        deprecate: (message: string) => logger.warn(message),
      },
    });

    logger.info('Query builder initialized', { dbPath });
  }

  return queryBuilder;
}

/**
 * Override query builder (for testing)
 */
export function setQueryBuilder(qb: Knex | null): void {
  queryBuilder = qb;
}

/**
 * Transaction wrapper for knex (ADR-0005)
 */
export async function withQueryTransaction<T>(
  callback: (trx: Knex.Transaction) => Promise<T>
): Promise<T> {
  const qb = getQueryBuilder();
  return qb.transaction(callback);
}

/**
 * Close query builder connection
 */
export async function closeQueryBuilder(): Promise<void> {
  if (queryBuilder) {
    await queryBuilder.destroy();
    queryBuilder = null;
    logger.info('Query builder connection closed');
  }
}
