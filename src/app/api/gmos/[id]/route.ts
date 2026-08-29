/**
 * Single GMO API Routes
 * PATCH: Update a GMO (setting dateDestroyed marks destruction)
 * DELETE: Delete a GMO record
 * Follows ADR-0008 (API response envelopes), ADR-0007 (Zod at API boundary)
 */

import { NextRequest, NextResponse } from 'next/server';
import { GmoService } from '@/services/gmo.service';
import { Logger } from '@/infrastructure/logger';
import { ApiError } from '@/shared/api-types';
import {
  createSuccessEnvelope,
  createErrorEnvelope,
  statusForErrorEnvelope,
} from '@/shared/api-envelope';
import { updateGmoSchema } from '@/shared/validation/organism-gmo-schemas';
import { stripUndefined } from '@/shared/validation/strip-undefined';
import { randomUUID } from 'crypto';

const logger = new Logger();
const gmoService = new GmoService(logger);

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * PATCH /api/gmos/[id]
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  const { id } = params;

  try {
    const body = await request.json().catch(() => {
      throw new ApiError('INVALID_JSON', 'VALIDATION', 'Request body must be valid JSON');
    });

    const updates = stripUndefined(updateGmoSchema.parse(body));

    logger.info('PATCH /api/gmos/[id]', {
      correlationId,
      gmoId: id,
      fields: Object.keys(updates),
    });

    const gmo = await gmoService.updateGmo(id, updates);

    logger.info('GMO updated successfully', { correlationId, gmoId: id });

    return NextResponse.json(createSuccessEnvelope(gmo, correlationId), { status: 200 });
  } catch (error) {
    logger.error('PATCH /api/gmos/[id] failed', error as Error, { correlationId, gmoId: id });
    const envelope = createErrorEnvelope(error, correlationId);
    return NextResponse.json(envelope, { status: statusForErrorEnvelope(envelope) });
  }
}

/**
 * DELETE /api/gmos/[id]
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  const { id } = params;

  try {
    logger.info('DELETE /api/gmos/[id]', { correlationId, gmoId: id });

    await gmoService.deleteGmo(id);

    logger.info('GMO deleted successfully', { correlationId, gmoId: id });

    return NextResponse.json(createSuccessEnvelope({ id }, correlationId), { status: 200 });
  } catch (error) {
    logger.error('DELETE /api/gmos/[id] failed', error as Error, { correlationId, gmoId: id });
    const envelope = createErrorEnvelope(error, correlationId);
    return NextResponse.json(envelope, { status: statusForErrorEnvelope(envelope) });
  }
}
