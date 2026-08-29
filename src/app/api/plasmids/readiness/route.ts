/**
 * Plasmid Readiness API Route
 * GET: Formblatt-Z readiness for every plasmid (locked UX requirement:
 * row-level readiness indicator in the plasmid table).
 * Follows ADR-0008 (API response envelopes).
 */

import { NextRequest, NextResponse } from 'next/server';
import { DataQualityService } from '@/services/data-quality.service';
import { Logger } from '@/infrastructure/logger';
import {
  createSuccessEnvelope,
  createErrorEnvelope,
  statusForErrorEnvelope,
} from '@/shared/api-envelope';
import { randomUUID } from 'crypto';

const logger = new Logger();
const dataQualityService = new DataQualityService(logger);

/**
 * GET /api/plasmids/readiness
 * One entry per plasmid. Not-ready plasmids are data, not request errors,
 * so this always answers 200 when the computation succeeded.
 */
export async function GET(request: NextRequest) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();

  try {
    logger.info('GET /api/plasmids/readiness', { correlationId });

    const readiness = await dataQualityService.plasmidReadiness();

    return NextResponse.json(createSuccessEnvelope(readiness, correlationId), { status: 200 });
  } catch (error) {
    logger.error('GET /api/plasmids/readiness failed', error as Error, { correlationId });
    const envelope = createErrorEnvelope(error, correlationId);
    return NextResponse.json(envelope, { status: statusForErrorEnvelope(envelope) });
  }
}
