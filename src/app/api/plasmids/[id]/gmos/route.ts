/**
 * Plasmid GMOs API Routes
 * GET: List GMOs on a plasmid
 * POST: Create a GMO on a plasmid
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
import { createGmoSchema } from '@/shared/validation/organism-gmo-schemas';
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
 * GET /api/plasmids/[id]/gmos
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  const { id: plasmidId } = params;

  try {
    logger.info('GET /api/plasmids/[id]/gmos', { correlationId, plasmidId });

    const gmos = await gmoService.listPlasmidGmos(plasmidId);

    return NextResponse.json(createSuccessEnvelope(gmos, correlationId), { status: 200 });
  } catch (error) {
    logger.error('GET /api/plasmids/[id]/gmos failed', error as Error, {
      correlationId,
      plasmidId,
    });
    const envelope = createErrorEnvelope(error, correlationId);
    return NextResponse.json(envelope, { status: statusForErrorEnvelope(envelope) });
  }
}

/**
 * POST /api/plasmids/[id]/gmos
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  const { id: plasmidId } = params;

  try {
    const body = await request.json().catch(() => {
      throw new ApiError('INVALID_JSON', 'VALIDATION', 'Request body must be valid JSON');
    });

    const input = createGmoSchema.parse(body);

    logger.info('POST /api/plasmids/[id]/gmos', {
      correlationId,
      plasmidId,
      organismName: input.organismName,
    });

    const gmo = await gmoService.createGmo(
      stripUndefined({
        ...input,
        id: input.id || randomUUID(),
        plasmidId,
      })
    );

    logger.info('GMO created successfully', { correlationId, gmoId: gmo.id, plasmidId });

    return NextResponse.json(createSuccessEnvelope(gmo, correlationId), { status: 201 });
  } catch (error) {
    logger.error('POST /api/plasmids/[id]/gmos failed', error as Error, {
      correlationId,
      plasmidId,
    });
    const envelope = createErrorEnvelope(error, correlationId);
    return NextResponse.json(envelope, { status: statusForErrorEnvelope(envelope) });
  }
}
