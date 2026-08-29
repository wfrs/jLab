/**
 * Organism Glossary API Routes
 * GET: List organisms (optional ?search=)
 * POST: Create an organism
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
import { createOrganismSchema } from '@/shared/validation/organism-gmo-schemas';
import { stripUndefined } from '@/shared/validation/strip-undefined';
import { randomUUID } from 'crypto';

const logger = new Logger();
const organismService = new OrganismService(logger);

/**
 * GET /api/glossary/organisms
 */
export async function GET(request: NextRequest) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');

    logger.info('GET /api/glossary/organisms', { correlationId, search });

    const organisms = await organismService.listOrganisms(search || undefined);

    return NextResponse.json(createSuccessEnvelope(organisms, correlationId), { status: 200 });
  } catch (error) {
    logger.error('GET /api/glossary/organisms failed', error as Error, { correlationId });
    const envelope = createErrorEnvelope(error, correlationId);
    return NextResponse.json(envelope, { status: statusForErrorEnvelope(envelope) });
  }
}

/**
 * POST /api/glossary/organisms
 */
export async function POST(request: NextRequest) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();

  try {
    const body = await request.json().catch(() => {
      throw new ApiError('INVALID_JSON', 'VALIDATION', 'Request body must be valid JSON');
    });

    const input = createOrganismSchema.parse(body);

    logger.info('POST /api/glossary/organisms', {
      correlationId,
      fullName: input.fullName,
    });

    const organism = await organismService.createOrganism(
      stripUndefined({
        ...input,
        id: input.id || randomUUID(),
      })
    );

    logger.info('Organism created successfully', { correlationId, organismId: organism.id });

    return NextResponse.json(createSuccessEnvelope(organism, correlationId), { status: 201 });
  } catch (error) {
    logger.error('POST /api/glossary/organisms failed', error as Error, { correlationId });
    const envelope = createErrorEnvelope(error, correlationId);
    return NextResponse.json(envelope, { status: statusForErrorEnvelope(envelope) });
  }
}
