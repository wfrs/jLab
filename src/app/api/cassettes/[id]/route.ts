/**
 * Single Cassette API Routes
 * PATCH: Update a cassette
 * DELETE: Delete a cassette
 * Follows ADR-0008 (API response envelopes), ADR-0007 (Zod at API boundary)
 */

import { NextRequest, NextResponse } from 'next/server';
import { CassetteService } from '@/services/cassette.service';
import { Logger } from '@/infrastructure/logger';
import { ApiError } from '@/shared/api-types';
import {
  createSuccessEnvelope,
  createErrorEnvelope,
  statusForErrorEnvelope,
} from '@/shared/api-envelope';
import { updateCassetteSchema } from '@/shared/validation/cassette-schemas';
import { stripUndefined } from '@/shared/validation/strip-undefined';
import { randomUUID } from 'crypto';

const logger = new Logger();
const cassetteService = new CassetteService(logger);

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * PATCH /api/cassettes/[id]
 * Update a cassette (partial update; autosave sends single fields)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  const { id } = params;

  try {
    const body = await request.json().catch(() => {
      throw new ApiError('INVALID_JSON', 'VALIDATION', 'Request body must be valid JSON');
    });

    const updates = stripUndefined(updateCassetteSchema.parse(body));

    logger.info('PATCH /api/cassettes/[id]', {
      correlationId,
      cassetteId: id,
      fields: Object.keys(updates),
    });

    const cassette = await cassetteService.updateCassette(id, updates);

    logger.info('Cassette updated successfully', { correlationId, cassetteId: id });

    return NextResponse.json(createSuccessEnvelope(cassette, correlationId), { status: 200 });
  } catch (error) {
    logger.error('PATCH /api/cassettes/[id] failed', error as Error, {
      correlationId,
      cassetteId: id,
    });
    const envelope = createErrorEnvelope(error, correlationId);
    return NextResponse.json(envelope, { status: statusForErrorEnvelope(envelope) });
  }
}

/**
 * DELETE /api/cassettes/[id]
 * Delete a cassette
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  const { id } = params;

  try {
    logger.info('DELETE /api/cassettes/[id]', { correlationId, cassetteId: id });

    await cassetteService.deleteCassette(id);

    logger.info('Cassette deleted successfully', { correlationId, cassetteId: id });

    return NextResponse.json(createSuccessEnvelope({ id }, correlationId), { status: 200 });
  } catch (error) {
    logger.error('DELETE /api/cassettes/[id] failed', error as Error, {
      correlationId,
      cassetteId: id,
    });
    const envelope = createErrorEnvelope(error, correlationId);
    return NextResponse.json(envelope, { status: statusForErrorEnvelope(envelope) });
  }
}
