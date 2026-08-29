/**
 * Plasmid Primers API Routes
 * GET: List primers on a plasmid (alphabetical)
 * POST: Create a primer (gcPercent/tmCelsius derived server-side)
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
import { createPrimerSchema } from '@/shared/validation/primer-schemas';
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
 * GET /api/plasmids/[id]/primers
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  const { id: plasmidId } = params;

  try {
    logger.info('GET /api/plasmids/[id]/primers', { correlationId, plasmidId });

    const primers = await primerService.listPlasmidPrimers(plasmidId);

    return NextResponse.json(createSuccessEnvelope(primers, correlationId), { status: 200 });
  } catch (error) {
    logger.error('GET /api/plasmids/[id]/primers failed', error as Error, {
      correlationId,
      plasmidId,
    });
    const envelope = createErrorEnvelope(error, correlationId);
    return NextResponse.json(envelope, { status: statusForErrorEnvelope(envelope) });
  }
}

/**
 * POST /api/plasmids/[id]/primers
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  const { id: plasmidId } = params;

  try {
    const body = await request.json().catch(() => {
      throw new ApiError('INVALID_JSON', 'VALIDATION', 'Request body must be valid JSON');
    });

    const input = createPrimerSchema.parse(body);

    logger.info('POST /api/plasmids/[id]/primers', {
      correlationId,
      plasmidId,
      primerName: input.name,
    });

    const primer = await primerService.createPrimer(
      stripUndefined({
        ...input,
        id: input.id || randomUUID(),
        plasmidId,
      })
    );

    logger.info('Primer created successfully', { correlationId, primerId: primer.id, plasmidId });

    return NextResponse.json(createSuccessEnvelope(primer, correlationId), { status: 201 });
  } catch (error) {
    logger.error('POST /api/plasmids/[id]/primers failed', error as Error, {
      correlationId,
      plasmidId,
    });
    const envelope = createErrorEnvelope(error, correlationId);
    return NextResponse.json(envelope, { status: statusForErrorEnvelope(envelope) });
  }
}
