/**
 * Plasmid prep batches
 * POST /api/plasmids/preps — record one prep per plasmid, sharing a date and
 * operator.
 *
 * Batch because that is how the bench works: a run of minipreps shares one
 * date and the concentrations are read off the Nanodrop in a single sitting.
 * All-or-nothing, so a half-recorded session cannot exist.
 */

import { NextRequest, NextResponse } from 'next/server';
import { PlasmidPrepService } from '@/services/plasmid-prep.service';
import { Logger } from '@/infrastructure/logger';
import { ApiError } from '@/shared/api-types';
import {
  createSuccessEnvelope,
  createErrorEnvelope,
  statusForErrorEnvelope,
} from '@/shared/api-envelope';
import { recordPrepBatchSchema } from '@/shared/validation/label-schemas';
import { randomUUID } from 'crypto';

const logger = new Logger();
const prepService = new PlasmidPrepService(logger);

export async function POST(request: NextRequest) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();

  try {
    const body = await request.json().catch(() => {
      throw new ApiError('INVALID_JSON', 'VALIDATION', 'Request body must be valid JSON');
    });

    const input = recordPrepBatchSchema.parse(body);

    logger.info('POST /api/plasmids/preps', {
      correlationId,
      preppedOn: input.preppedOn,
      count: input.entries.length,
    });

    const preps = await prepService.recordBatch({
      preppedOn: input.preppedOn,
      operatorInitials: input.operatorInitials,
      entries: input.entries.map((entry) => ({
        plasmidId: entry.plasmidId,
        ...(entry.concentrationNgUl !== undefined && {
          concentrationNgUl: entry.concentrationNgUl,
        }),
      })),
    });

    return NextResponse.json(createSuccessEnvelope({ preps }, correlationId), { status: 201 });
  } catch (error) {
    logger.error('POST /api/plasmids/preps failed', error as Error, { correlationId });
    const envelope = createErrorEnvelope(error, correlationId);
    return NextResponse.json(envelope, { status: statusForErrorEnvelope(envelope) });
  }
}
