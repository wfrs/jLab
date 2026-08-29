/**
 * Primer API Routes
 * PATCH: Update a primer (sequence changes recompute gcPercent/tmCelsius)
 * DELETE: Remove a primer
 * Follows ADR-0008 (API response envelopes), ADR-0007 (Zod at API boundary)
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrimerService } from '@/services/primer.service';
import { Logger } from '@/infrastructure/logger';
import { ApiError } from '@/shared/api-types';
import {
  createSuccessEnvelope,
  createErrorEnvelope,
  statusForErrorEnvelope,
} from '@/shared/api-envelope';
import { updatePrimerSchema } from '@/shared/validation/primer-schemas';
import { stripUndefined } from '@/shared/validation/strip-undefined';
import { randomUUID } from 'crypto';

const logger = new Logger();
const primerService = new PrimerService(logger);

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * PATCH /api/primers/[id]
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  const { id } = params;

  try {
    const body = await request.json().catch(() => {
      throw new ApiError('INVALID_JSON', 'VALIDATION', 'Request body must be valid JSON');
    });

    const updates = updatePrimerSchema.parse(body);

    logger.info('PATCH /api/primers/[id]', { correlationId, id, fields: Object.keys(updates) });

    const primer = await primerService.updatePrimer(id, stripUndefined(updates));

    return NextResponse.json(createSuccessEnvelope(primer, correlationId), { status: 200 });
  } catch (error) {
    logger.error('PATCH /api/primers/[id] failed', error as Error, { correlationId, id });
    const envelope = createErrorEnvelope(error, correlationId);
    return NextResponse.json(envelope, { status: statusForErrorEnvelope(envelope) });
  }
}

/**
 * DELETE /api/primers/[id]
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  const { id } = params;

  try {
    logger.info('DELETE /api/primers/[id]', { correlationId, id });

    await primerService.deletePrimer(id);

    return NextResponse.json(createSuccessEnvelope({ id }, correlationId), { status: 200 });
  } catch (error) {
    logger.error('DELETE /api/primers/[id] failed', error as Error, { correlationId, id });
    const envelope = createErrorEnvelope(error, correlationId);
    return NextResponse.json(envelope, { status: statusForErrorEnvelope(envelope) });
  }
}
