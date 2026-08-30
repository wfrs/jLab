/**
 * Database reset
 * GET  /api/database/reset — what a reset would delete (no side effects)
 * POST /api/database/reset — back up, then clear everything except settings
 *
 * The confirmation phrase is checked server-side as well as in the UI, so a
 * stray or replayed POST cannot wipe the database on its own.
 */

import { NextRequest, NextResponse } from 'next/server';
import { DatabaseResetService } from '@/services/database-reset.service';
import { Logger } from '@/infrastructure/logger';
import { ApiError } from '@/shared/api-types';
import {
  createSuccessEnvelope,
  createErrorEnvelope,
  statusForErrorEnvelope,
} from '@/shared/api-envelope';
import { resetDatabaseSchema } from '@/shared/validation/database-schemas';
import { randomUUID } from 'crypto';

const logger = new Logger();
const resetService = new DatabaseResetService(logger);

export async function GET(request: NextRequest) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();

  try {
    logger.info('GET /api/database/reset', { correlationId });
    const preview = await resetService.preview();
    return NextResponse.json(createSuccessEnvelope(preview, correlationId), { status: 200 });
  } catch (error) {
    logger.error('GET /api/database/reset failed', error as Error, { correlationId });
    const envelope = createErrorEnvelope(error, correlationId);
    return NextResponse.json(envelope, { status: statusForErrorEnvelope(envelope) });
  }
}

export async function POST(request: NextRequest) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();

  try {
    const body = await request.json().catch(() => {
      throw new ApiError('INVALID_JSON', 'VALIDATION', 'Request body must be valid JSON');
    });

    const input = resetDatabaseSchema.parse(body);

    logger.warn('POST /api/database/reset — clearing all data', { correlationId });

    const result = await resetService.reset(input.confirmation);

    logger.warn('Database reset complete', {
      correlationId,
      totalRows: result.totalRows,
      backupPath: result.backupPath,
    });

    return NextResponse.json(createSuccessEnvelope(result, correlationId), { status: 200 });
  } catch (error) {
    logger.error('POST /api/database/reset failed', error as Error, { correlationId });
    const envelope = createErrorEnvelope(error, correlationId);
    return NextResponse.json(envelope, { status: statusForErrorEnvelope(envelope) });
  }
}
