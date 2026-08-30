/**
 * Target Organism Entry API Routes
 * PATCH: Toggle an entry's favourite flag
 * DELETE: Remove an entry from the target list
 * Follows ADR-0008 (API response envelopes), ADR-0007 (Zod at API boundary)
 */

import { NextRequest, NextResponse } from 'next/server';
import { OrganismTargetService } from '@/services/organism-target.service';
import { Logger } from '@/infrastructure/logger';
import { ApiError } from '@/shared/api-types';
import {
  createSuccessEnvelope,
  createErrorEnvelope,
  statusForErrorEnvelope,
} from '@/shared/api-envelope';
import { updateOrganismTargetSchema } from '@/shared/validation/organism-gmo-schemas';
import { randomUUID } from 'crypto';

const logger = new Logger();
const service = new OrganismTargetService(logger);

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * PATCH /api/settings/organism-targets/[id]
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  const { id } = params;

  try {
    const body = await request.json().catch(() => {
      throw new ApiError('INVALID_JSON', 'VALIDATION', 'Request body must be valid JSON');
    });

    const input = updateOrganismTargetSchema.parse(body);

    logger.info('PATCH /api/settings/organism-targets/[id]', {
      correlationId,
      id,
      favourite: input.favourite,
    });

    const target = await service.setFavourite(id, input.favourite);

    return NextResponse.json(createSuccessEnvelope(target, correlationId), { status: 200 });
  } catch (error) {
    logger.error('PATCH /api/settings/organism-targets/[id] failed', error as Error, {
      correlationId,
      id,
    });
    const envelope = createErrorEnvelope(error, correlationId);
    return NextResponse.json(envelope, { status: statusForErrorEnvelope(envelope) });
  }
}

/**
 * DELETE /api/settings/organism-targets/[id]
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  const { id } = params;

  try {
    logger.info('DELETE /api/settings/organism-targets/[id]', { correlationId, id });

    await service.removeTarget(id);

    return NextResponse.json(createSuccessEnvelope({ id }, correlationId), { status: 200 });
  } catch (error) {
    logger.error('DELETE /api/settings/organism-targets/[id] failed', error as Error, {
      correlationId,
      id,
    });
    const envelope = createErrorEnvelope(error, correlationId);
    return NextResponse.json(envelope, { status: statusForErrorEnvelope(envelope) });
  }
}
