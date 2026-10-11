/**
 * Query builder (knex) initialization (ADR-0005)
 * SQL-agnostic query builder for SQLite
 *
 * The schema is created on first connection, so a fresh clone works after
 * `npm run dev` alone: sqlite3 silently creates an empty file when the
 * database does not exist yet, and every route would otherwise fail with
 * "no such table" until someone ran `npm run db:init`.
 */

import knex, { Knex } from 'knex';
import { initializeDatabase } from './database-init';
import { Logger } from './logger';

const logger = new Logger({ operation: 'query-builder-init' });

/**
 * A private in-memory database cannot be bootstrapped from a second
 * connection (each `:memory:` open is a separate database), so callers using
 * one own their schema. Only tests do this (tests/helpers/test-db.ts).
 */
const IN_MEMORY_DATABASE = ':memory:';

let queryBuilder: Knex | null = null;
let schemaReady: Promise<void> | null = null;

/**
 * Create any missing tables once per process, through a short-lived
 * connection of its own: the pool's connection is still being created while
 * this runs, so it cannot be used. Idempotent, never touches existing data.
 */
function ensureSchema(dbPath: string): Promise<void> {
  if (dbPath === IN_MEMORY_DATABASE) {
    return Promise.resolve();
  }
  if (!schemaReady) {
    const bootstrap = knex({
      client: 'sqlite3',
      connection: { filename: dbPath },
      useNullAsDefault: true,
    });
    schemaReady = initializeDatabase(bootstrap)
      .finally(() => bootstrap.destroy())
      .catch((error: unknown) => {
        // Let the next connection attempt retry instead of caching the failure
        schemaReady = null;
        throw error;
      });
  }
  return schemaReady;
}

export function getQueryBuilder(): Knex {
  if (!queryBuilder) {
    const dbPath = process.env.DATABASE_URL || './jlab.db';

    queryBuilder = knex({
      client: 'sqlite3',
      connection: {
        filename: dbPath,
      },
      useNullAsDefault: true,
      pool: {
        // Every query waits for the connection, and the connection waits for
        // the schema, so no caller has to await initialization explicitly.
        afterCreate: (connection: unknown, done: (err: Error | null, conn: unknown) => void) => {
          ensureSchema(dbPath).then(
            () => done(null, connection),
            (error: unknown) => {
              logger.error('Schema initialization failed', error as Error);
              done(error as Error, connection);
            }
          );
        },
      },
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
    schemaReady = null;
    logger.info('Query builder connection closed');
  }
}
