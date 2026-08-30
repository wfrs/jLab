/**
 * Prep history for one plasmid
 * GET /api/plasmids/[id]/preps — newest first; the first row is the current tube.
 */

import { NextRequest, NextResponse } from 'next/server';
import { PlasmidPrepService } from '@/services/plasmid-prep.service';
import { Logger } from '@/infrastructure/logger';
import {
  createSuccessEnvelope,
  createErrorEnvelope,
  statusForErrorEnvelope,
} from '@/shared/api-envelope';
import { randomUUID } from 'crypto';

const logger = new Logger();
const prepService = new PlasmidPrepService(logger);

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();

  try {
    logger.info('GET /api/plasmids/[id]/preps', { correlationId, plasmidId: params.id });

    const preps = await prepService.listForPlasmid(params.id);

    return NextResponse.json(createSuccessEnvelope({ preps }, correlationId), { status: 200 });
  } catch (error) {
    logger.error('GET /api/plasmids/[id]/preps failed', error as Error, { correlationId });
    const envelope = createErrorEnvelope(error, correlationId);
    return NextResponse.json(envelope, { status: statusForErrorEnvelope(envelope) });
  }
}
