/**
 * Single Plasmid API Routes
 * GET: Retrieve a specific plasmid
 * PATCH: Update a plasmid
 * DELETE: Delete a plasmid
 * Follows ADR-0008 (API response envelopes), ADR-0007 (Zod at API boundary)
 */

import { NextRequest, NextResponse } from 'next/server';
import { PlasmidService } from '@/services/plasmid.service';
import { Logger } from '@/infrastructure/logger';
import { ApiError } from '@/shared/api-types';
import {
  createSuccessEnvelope,
  createErrorEnvelope,
  statusForErrorEnvelope,
} from '@/shared/api-envelope';
import { updatePlasmidSchema } from '@/shared/validation/plasmid-schemas';
import { stripUndefined } from '@/shared/validation/strip-undefined';
import { randomUUID } from 'crypto';

const logger = new Logger();
const plasmidService = new PlasmidService(logger);

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * GET /api/plasmids/[id]
 * Retrieve a single plasmid by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  const { id } = params;

  try {
    logger.info('GET /api/plasmids/[id]', { correlationId, plasmidId: id });

    // Service throws DomainError NOT_FOUND when the plasmid does not exist
    const plasmid = await plasmidService.getPlasmid(id);

    return NextResponse.json(createSuccessEnvelope(plasmid, correlationId), { status: 200 });
  } catch (error) {
    logger.error('GET /api/plasmids/[id] failed', error as Error, {
      correlationId,
      plasmidId: id,
    });
    const envelope = createErrorEnvelope(error, correlationId);
    return NextResponse.json(envelope, { status: statusForErrorEnvelope(envelope) });
  }
}

/**
 * PATCH /api/plasmids/[id]
 * Update a plasmid (partial update; autosave sends single fields)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  const { id } = params;

  try {
    const body = await request.json().catch(() => {
      throw new ApiError('INVALID_JSON', 'VALIDATION', 'Request body must be valid JSON');
    });

    const updates = stripUndefined(updatePlasmidSchema.parse(body));

    logger.info('PATCH /api/plasmids/[id]', {
      correlationId,
      plasmidId: id,
      fields: Object.keys(updates),
    });

    const plasmid = await plasmidService.updatePlasmid(id, updates);

    logger.info('Plasmid updated successfully', {
      correlationId,
      plasmidId: id,
    });

    return NextResponse.json(createSuccessEnvelope(plasmid, correlationId), { status: 200 });
  } catch (error) {
    logger.error('PATCH /api/plasmids/[id] failed', error as Error, {
      correlationId,
      plasmidId: id,
    });
    const envelope = createErrorEnvelope(error, correlationId);
    return NextResponse.json(envelope, { status: statusForErrorEnvelope(envelope) });
  }
}

/**
 * DELETE /api/plasmids/[id]
 * Delete a plasmid (cascades to related records)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  const { id } = params;

  try {
    logger.info('DELETE /api/plasmids/[id]', {
      correlationId,
      plasmidId: id,
    });

    await plasmidService.deletePlasmid(id);

    logger.info('Plasmid deleted successfully', {
      correlationId,
      plasmidId: id,
    });

    return NextResponse.json(createSuccessEnvelope({ id }, correlationId), { status: 200 });
  } catch (error) {
    logger.error('DELETE /api/plasmids/[id] failed', error as Error, {
      correlationId,
      plasmidId: id,
    });
    const envelope = createErrorEnvelope(error, correlationId);
    return NextResponse.json(envelope, { status: statusForErrorEnvelope(envelope) });
  }
}
