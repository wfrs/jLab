/**
 * Database initialization and connection (ADR-0005)
 * SQLite async driver with connection pooling
 */

import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import { Logger } from './logger';

const logger = new Logger({ operation: 'database-init' });

// Promisify sqlite3 methods for async/await usage
interface DbConnection {
  run: (sql: string, params?: unknown[]) => Promise<{ lastID: number; changes: number }>;
  get: (sql: string, params?: unknown[]) => Promise<unknown>;
  all: (sql: string, params?: unknown[]) => Promise<unknown[]>;
  exec: (sql: string) => Promise<void>;
  close: () => Promise<void>;
}

let instance: DbConnection | null = null;

export async function getDatabase(): Promise<DbConnection> {
  if (instance) {
    return instance;
  }

  const dbPath = process.env.DATABASE_URL || './jlab.db';
  const timeout = parseInt(process.env.DATABASE_TIMEOUT || '5000', 10);

  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        logger.error('Failed to open database', err);
        reject(err);
        return;
      }

      logger.info('Database connection opened', { dbPath });

      const connection: DbConnection = {
        run: promisify(
          (
            sql: string,
            params: unknown[] | undefined,
            callback: (err: Error | null, result: any) => void
          ) => {
            db.run(sql, params, callback);
          }
        ).bind(db) as any,

        get: promisify(
          (
            sql: string,
            params: unknown[] | undefined,
            callback: (err: Error | null, row: unknown) => void
          ) => {
            db.get(sql, params, callback);
          }
        ).bind(db) as any,

        all: promisify(
          (
            sql: string,
            params: unknown[] | undefined,
            callback: (err: Error | null, rows: unknown[]) => void
          ) => {
            db.all(sql, params, callback);
          }
        ).bind(db) as any,

        exec: promisify((sql: string, callback: (err: Error | null) => void) => {
          db.exec(sql, callback);
        }).bind(db) as any,

        close: promisify((callback: (err: Error | null) => void) => {
          db.close(callback);
        }).bind(db) as any,
      };

      instance = connection;
      resolve(connection);
    });

    db.configure('busyTimeout', timeout);
  });
}

/**
 * Transaction helper (ADR-0005)
 * Services own transactions via this helper
 */
export async function withTransaction<T>(callback: (db: DbConnection) => Promise<T>): Promise<T> {
  const db = await getDatabase();

  try {
    await db.exec('BEGIN TRANSACTION');
    logger.debug('Transaction started');

    const result = await callback(db);

    await db.exec('COMMIT');
    logger.debug('Transaction committed');

    return result;
  } catch (error) {
    await db.exec('ROLLBACK');
    logger.error('Transaction rolled back', error as Error);
    throw error;
  }
}

/**
 * Close database connection (cleanup)
 */
export async function closeDatabase(): Promise<void> {
  if (instance) {
    await instance.close();
    instance = null;
    logger.info('Database connection closed');
  }
}
