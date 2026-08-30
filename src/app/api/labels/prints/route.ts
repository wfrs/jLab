/**
 * Label print history
 * POST /api/labels/prints — record that a sheet was generated
 *
 * The Word workflow kept no reliable record of what had been printed, which is
 * why gaps in the documents say nothing about the freezer. This does.
 */

import { NextRequest, NextResponse } from 'next/server';
import { LabelService } from '@/services/label.service';
import { Logger } from '@/infrastructure/logger';
import { ApiError } from '@/shared/api-types';
import {
  createSuccessEnvelope,
  createErrorEnvelope,
  statusForErrorEnvelope,
} from '@/shared/api-envelope';
import { recordPrintsSchema } from '@/shared/validation/label-schemas';
import { randomUUID } from 'crypto';

const logger = new Logger();
const labelService = new LabelService(logger);

/**
 * GET without parameters lists past sheets; with `kind` and `printedAt` it
 * returns the ids on one of them, so it can be printed again.
 */
export async function GET(request: NextRequest) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();

  try {
    const { searchParams } = new URL(request.url);
    const kind = searchParams.get('kind');
    const printedAt = searchParams.get('printedAt');

    if (kind && printedAt) {
      if (kind !== 'plasmid' && kind !== 'glycerol') {
        throw new ApiError('INVALID_KIND', 'VALIDATION', 'kind must be plasmid or glycerol');
      }
      const ids = await labelService.listPrintBatchTargets(kind, printedAt);
      return NextResponse.json(createSuccessEnvelope({ ids }, correlationId), { status: 200 });
    }

    const batches = await labelService.listPrintBatches();
    return NextResponse.json(createSuccessEnvelope({ batches }, correlationId), { status: 200 });
  } catch (error) {
    logger.error('GET /api/labels/prints failed', error as Error, { correlationId });
    const envelope = createErrorEnvelope(error, correlationId);
    return NextResponse.json(envelope, { status: statusForErrorEnvelope(envelope) });
  }
}

export async function POST(request: NextRequest) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();

  try {
    const body = await request.json().catch(() => {
      throw new ApiError('INVALID_JSON', 'VALIDATION', 'Request body must be valid JSON');
    });

    const input = recordPrintsSchema.parse(body);

    logger.info('POST /api/labels/prints', {
      correlationId,
      kind: input.kind,
      count: input.ids.length,
    });

    const prints = await labelService.recordPrints(input.kind, input.ids);

    return NextResponse.json(
      createSuccessEnvelope(
        { recorded: prints.length, printedAt: prints[0]?.printedAt },
        correlationId
      ),
      { status: 201 }
    );
  } catch (error) {
    logger.error('POST /api/labels/prints failed', error as Error, { correlationId });
    const envelope = createErrorEnvelope(error, correlationId);
    return NextResponse.json(envelope, { status: statusForErrorEnvelope(envelope) });
  }
}
