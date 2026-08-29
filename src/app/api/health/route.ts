/**
 * Data Quality API Route
 * GET: Run every record-completeness and glossary-housekeeping check
 * (legacy check_plasmids / check_features / check_organisms).
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
 * GET /api/health
 * Returns the full check report. Always 200 when the checks themselves ran —
 * findings are data, not request errors; read `ok` for the export gate.
 */
export async function GET(request: NextRequest) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();

  try {
    logger.info('GET /api/health', { correlationId });

    const report = await dataQualityService.runChecks();

    return NextResponse.json(createSuccessEnvelope(report, correlationId), { status: 200 });
  } catch (error) {
    logger.error('GET /api/health failed', error as Error, { correlationId });
    const envelope = createErrorEnvelope(error, correlationId);
    return NextResponse.json(envelope, { status: statusForErrorEnvelope(envelope) });
  }
}
