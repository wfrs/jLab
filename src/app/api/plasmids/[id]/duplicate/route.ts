/**
 * Plasmid Duplicate API Route
 * POST: Duplicate the plasmid (legacy -DUPLICATE- event): copies content
 * fields + cassettes; GMOs only when the duplicateGmos setting is on.
 * Follows ADR-0008 (API response envelopes)
 */

import { NextRequest, NextResponse } from 'next/server';
import { PlasmidService } from '@/services/plasmid.service';
import { Logger } from '@/infrastructure/logger';
import {
  createSuccessEnvelope,
  createErrorEnvelope,
  statusForErrorEnvelope,
} from '@/shared/api-envelope';
import { randomUUID } from 'crypto';

const logger = new Logger();
const plasmidService = new PlasmidService(logger);

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * POST /api/plasmids/[id]/duplicate
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  const { id } = params;

  try {
    logger.info('POST /api/plasmids/[id]/duplicate', { correlationId, id });

    const duplicate = await plasmidService.duplicatePlasmid(id);

    logger.info('Plasmid duplicated successfully', {
      correlationId,
      sourceId: id,
      newId: duplicate.id,
    });

    return NextResponse.json(createSuccessEnvelope(duplicate, correlationId), { status: 201 });
  } catch (error) {
    logger.error('POST /api/plasmids/[id]/duplicate failed', error as Error, {
      correlationId,
      id,
    });
    const envelope = createErrorEnvelope(error, correlationId);
    return NextResponse.json(envelope, { status: statusForErrorEnvelope(envelope) });
  }
}
