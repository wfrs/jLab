/**
 * Plasmid Cassettes API Routes
 * GET: List cassettes on a plasmid (ordered by position)
 * POST: Create a cassette on a plasmid
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
import { createCassetteSchema } from '@/shared/validation/cassette-schemas';
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
 * GET /api/plasmids/[id]/cassettes
 * List all cassettes on a plasmid, ordered by position
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  const { id: plasmidId } = params;

  try {
    logger.info('GET /api/plasmids/[id]/cassettes', { correlationId, plasmidId });

    const cassettes = await cassetteService.listPlasmidCassettes(plasmidId);

    return NextResponse.json(createSuccessEnvelope(cassettes, correlationId), { status: 200 });
  } catch (error) {
    logger.error('GET /api/plasmids/[id]/cassettes failed', error as Error, {
      correlationId,
      plasmidId,
    });
    const envelope = createErrorEnvelope(error, correlationId);
    return NextResponse.json(envelope, { status: statusForErrorEnvelope(envelope) });
  }
}

/**
 * POST /api/plasmids/[id]/cassettes
 * Create a cassette on the plasmid; position defaults to end of list
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  const { id: plasmidId } = params;

  try {
    const body = await request.json().catch(() => {
      throw new ApiError('INVALID_JSON', 'VALIDATION', 'Request body must be valid JSON');
    });

    const input = createCassetteSchema.parse(body);

    logger.info('POST /api/plasmids/[id]/cassettes', {
      correlationId,
      plasmidId,
      cassetteName: input.name,
    });

    const cassette = await cassetteService.createCassette(
      stripUndefined({
        ...input,
        id: input.id || randomUUID(),
        plasmidId,
      })
    );

    logger.info('Cassette created successfully', {
      correlationId,
      cassetteId: cassette.id,
      plasmidId,
    });

    return NextResponse.json(createSuccessEnvelope(cassette, correlationId), { status: 201 });
  } catch (error) {
    logger.error('POST /api/plasmids/[id]/cassettes failed', error as Error, {
      correlationId,
      plasmidId,
    });
    const envelope = createErrorEnvelope(error, correlationId);
    return NextResponse.json(envelope, { status: statusForErrorEnvelope(envelope) });
  }
}
