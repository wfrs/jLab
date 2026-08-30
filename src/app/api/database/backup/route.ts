/**
 * Database backup download
 * GET /api/database/backup — a consistent snapshot of the whole database
 * as a .db file (VACUUM INTO under the hood; legacy gmocu.py:1567 offered
 * the same file before imports).
 */

import { NextRequest, NextResponse } from 'next/server';
import { DatabaseResetService } from '@/services/database-reset.service';
import { Logger } from '@/infrastructure/logger';
import { createErrorEnvelope, statusForErrorEnvelope } from '@/shared/api-envelope';
import { contentDispositionAttachment } from '@/shared/http-file';
import { randomUUID } from 'crypto';

const logger = new Logger();
const service = new DatabaseResetService(logger);

export async function GET(request: NextRequest) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();

  try {
    logger.info('GET /api/database/backup', { correlationId });

    const snapshot = await service.downloadSnapshot();

    logger.info('Backup snapshot ready', {
      correlationId,
      filename: snapshot.filename,
      sizeBytes: snapshot.sizeBytes,
    });

    return new NextResponse(new Uint8Array(snapshot.bytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': contentDispositionAttachment(snapshot.filename),
        'Content-Length': String(snapshot.sizeBytes),
      },
    });
  } catch (error) {
    logger.error('GET /api/database/backup failed', error as Error, { correlationId });
    const envelope = createErrorEnvelope(error, correlationId);
    return NextResponse.json(envelope, { status: statusForErrorEnvelope(envelope) });
  }
}
