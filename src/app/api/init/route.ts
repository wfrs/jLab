/**
 * Database initialization route
 * Runs once to set up the database schema
 * Call /api/init/reset to force re-initialization
 */

import { getQueryBuilder } from '@/infrastructure/query-builder';
import { initializeDatabase } from '@/infrastructure/database-init';

let initialized = false;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const reset = url.searchParams.has('reset');

  try {
    if (!initialized || reset) {
      const qb = getQueryBuilder();
      await initializeDatabase(qb);
      initialized = true;
    }

    return Response.json({
      success: true,
      message: 'Database initialization complete',
    });
  } catch (error) {
    console.error('Database initialization failed:', error);
    initialized = false;
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
