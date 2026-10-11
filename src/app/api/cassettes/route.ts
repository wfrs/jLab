/**
 * Cassettes across the library
 * GET /api/cassettes — every cassette, by plasmid then position. The plasmid
 * table shows each row's cassettes from this and offers the distinct contents
 * for reuse, since many plasmids carry the same cassette.
 * Follows ADR-0008 (API response envelopes)
 */

import { NextRequest, NextResponse } from 'next/server';
import { CassetteService } from '@/services/cassette.service';
import { Logger } from '@/infrastructure/logger';
import {
  createSuccessEnvelope,
  createErrorEnvelope,
  statusForErrorEnvelope,
} from '@/shared/api-envelope';
import { randomUUID } from 'crypto';

const logger = new Logger();
const cassetteService = new CassetteService(logger);

export async function GET(request: NextRequest) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();

  try {
    logger.info('GET /api/cassettes', { correlationId });

    const cassettes = await cassetteService.listAllCassettes();

    return NextResponse.json(createSuccessEnvelope(cassettes, correlationId), { status: 200 });
  } catch (error) {
    logger.error('GET /api/cassettes failed', error as Error, { correlationId });
    const envelope = createErrorEnvelope(error, correlationId);
    return NextResponse.json(envelope, { status: statusForErrorEnvelope(envelope) });
  }
}
