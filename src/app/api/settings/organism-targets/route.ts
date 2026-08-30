/**
 * Target Organism List API Routes
 * GET: List the target organism shortlist (favourites flagged)
 * POST: Add a glossary organism to the list
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
import { createOrganismTargetSchema } from '@/shared/validation/organism-gmo-schemas';
import { randomUUID } from 'crypto';

const logger = new Logger();
const service = new OrganismTargetService(logger);

/**
 * GET /api/settings/organism-targets
 */
export async function GET(request: NextRequest) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();

  try {
    logger.info('GET /api/settings/organism-targets', { correlationId });

    const targets = await service.listTargets();

    return NextResponse.json(createSuccessEnvelope(targets, correlationId), { status: 200 });
  } catch (error) {
    logger.error('GET /api/settings/organism-targets failed', error as Error, { correlationId });
    const envelope = createErrorEnvelope(error, correlationId);
    return NextResponse.json(envelope, { status: statusForErrorEnvelope(envelope) });
  }
}

/**
 * POST /api/settings/organism-targets
 */
export async function POST(request: NextRequest) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();

  try {
    const body = await request.json().catch(() => {
      throw new ApiError('INVALID_JSON', 'VALIDATION', 'Request body must be valid JSON');
    });

    const input = createOrganismTargetSchema.parse(body);

    logger.info('POST /api/settings/organism-targets', {
      correlationId,
      organismName: input.organismName,
    });

    const target = await service.addTarget({
      id: input.id || randomUUID(),
      organismName: input.organismName,
    });

    return NextResponse.json(createSuccessEnvelope(target, correlationId), { status: 201 });
  } catch (error) {
    logger.error('POST /api/settings/organism-targets failed', error as Error, { correlationId });
    const envelope = createErrorEnvelope(error, correlationId);
    return NextResponse.json(envelope, { status: statusForErrorEnvelope(envelope) });
  }
}
