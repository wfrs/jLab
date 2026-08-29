/**
 * Database initialization script
 * Delegates to the shared schema initializer (src/infrastructure/database-init.ts)
 * so the CLI and the /api/init route create identical schemas.
 *
 * Usage: npm run db:init
 */

import knex from 'knex';
import { Logger } from '../src/infrastructure/logger';
import { initializeDatabase } from '../src/infrastructure/database-init';

const logger = new Logger({ operation: 'db-init-script' });
const dbPath = process.env.DATABASE_URL || './jlab.db';

async function main() {
  logger.info('Initializing database', { dbPath });

  const db = knex({
    client: 'sqlite3',
    connection: { filename: dbPath },
    useNullAsDefault: true,
  });

  try {
    await initializeDatabase(db);
    logger.info('Database ready', { dbPath });
  } finally {
    await db.destroy();
  }
}

main().catch((error) => {
  logger.error('db:init failed', error as Error);
  process.exit(1);
});
