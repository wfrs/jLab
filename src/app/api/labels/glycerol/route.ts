/**
 * Glycerol stock label payloads
 * GET /api/labels/glycerol?ids=a,b,c
 *
 * Returns one label per stock, joined to its plasmid where there is one,
 * ordered by stock ID. Follows ADR-0008 and ADR-0007.
 */

import { NextRequest, NextResponse } from 'next/server';
import { LabelService } from '@/services/label.service';
import { Logger } from '@/infrastructure/logger';
import {
  createSuccessEnvelope,
  createErrorEnvelope,
  statusForErrorEnvelope,
} from '@/shared/api-envelope';
import { labelIdsQuerySchema } from '@/shared/validation/label-schemas';
import { randomUUID } from 'crypto';

const logger = new Logger();
const labelService = new LabelService(logger);

export async function GET(request: NextRequest) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();

  try {
    const { searchParams } = new URL(request.url);
    const ids = labelIdsQuerySchema.parse(searchParams.get('ids') ?? '');

    logger.info('GET /api/labels/glycerol', { correlationId, count: ids.length });

    const labels = await labelService.buildGlycerolLabels(ids);

    return NextResponse.json(createSuccessEnvelope({ labels }, correlationId), { status: 200 });
  } catch (error) {
    logger.error('GET /api/labels/glycerol failed', error as Error, { correlationId });
    const envelope = createErrorEnvelope(error, correlationId);
    return NextResponse.json(envelope, { status: statusForErrorEnvelope(envelope) });
  }
}
