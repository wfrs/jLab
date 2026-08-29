/**
 * Single Organism API Routes
 * PATCH: Update an organism
 * DELETE: Delete an organism
 * Follows ADR-0008 (API response envelopes), ADR-0007 (Zod at API boundary)
 */

import { NextRequest, NextResponse } from 'next/server';
import { OrganismService } from '@/services/organism.service';
import { Logger } from '@/infrastructure/logger';
import { ApiError } from '@/shared/api-types';
import {
  createSuccessEnvelope,
  createErrorEnvelope,
  statusForErrorEnvelope,
} from '@/shared/api-envelope';
import { updateOrganismSchema } from '@/shared/validation/organism-gmo-schemas';
import { stripUndefined } from '@/shared/validation/strip-undefined';
import { randomUUID } from 'crypto';

const logger = new Logger();
const organismService = new OrganismService(logger);

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * PATCH /api/glossary/organisms/[id]
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  const { id } = params;

  try {
    const body = await request.json().catch(() => {
      throw new ApiError('INVALID_JSON', 'VALIDATION', 'Request body must be valid JSON');
    });

    const updates = stripUndefined(updateOrganismSchema.parse(body));

    logger.info('PATCH /api/glossary/organisms/[id]', {
      correlationId,
      organismId: id,
      fields: Object.keys(updates),
    });

    const organism = await organismService.updateOrganism(id, updates);

    logger.info('Organism updated successfully', { correlationId, organismId: id });

    return NextResponse.json(createSuccessEnvelope(organism, correlationId), { status: 200 });
  } catch (error) {
    logger.error('PATCH /api/glossary/organisms/[id] failed', error as Error, {
      correlationId,
      organismId: id,
    });
    const envelope = createErrorEnvelope(error, correlationId);
    return NextResponse.json(envelope, { status: statusForErrorEnvelope(envelope) });
  }
}

/**
 * DELETE /api/glossary/organisms/[id]
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  const { id } = params;

  try {
    logger.info('DELETE /api/glossary/organisms/[id]', { correlationId, organismId: id });

    await organismService.deleteOrganism(id);

    logger.info('Organism deleted successfully', { correlationId, organismId: id });

    return NextResponse.json(createSuccessEnvelope({ id }, correlationId), { status: 200 });
  } catch (error) {
    logger.error('DELETE /api/glossary/organisms/[id] failed', error as Error, {
      correlationId,
      organismId: id,
    });
    const envelope = createErrorEnvelope(error, correlationId);
    return NextResponse.json(envelope, { status: statusForErrorEnvelope(envelope) });
  }
}
