/**
 * One glycerol stock
 * PATCH  /api/glycerol-stocks/[id] — edit in place; setting madeOn records a remake
 * DELETE /api/glycerol-stocks/[id]
 */

import { NextRequest, NextResponse } from 'next/server';
import { GlycerolStockService } from '@/services/glycerol-stock.service';
import { Logger } from '@/infrastructure/logger';
import { ApiError } from '@/shared/api-types';
import {
  createSuccessEnvelope,
  createErrorEnvelope,
  statusForErrorEnvelope,
} from '@/shared/api-envelope';
import { updateGlycerolStockSchema } from '@/shared/validation/label-schemas';
import { stripUndefined } from '@/shared/validation/strip-undefined';
import { randomUUID } from 'crypto';

const logger = new Logger();
const service = new GlycerolStockService(logger);

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();

  try {
    const body = await request.json().catch(() => {
      throw new ApiError('INVALID_JSON', 'VALIDATION', 'Request body must be valid JSON');
    });

    const patch = updateGlycerolStockSchema.parse(body);

    logger.info('PATCH /api/glycerol-stocks/[id]', {
      correlationId,
      id: params.id,
      fields: Object.keys(patch),
    });

    const stock = await service.update(params.id, stripUndefined(patch));

    return NextResponse.json(createSuccessEnvelope(stock, correlationId), { status: 200 });
  } catch (error) {
    logger.error('PATCH /api/glycerol-stocks/[id] failed', error as Error, { correlationId });
    const envelope = createErrorEnvelope(error, correlationId);
    return NextResponse.json(envelope, { status: statusForErrorEnvelope(envelope) });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();

  try {
    logger.info('DELETE /api/glycerol-stocks/[id]', { correlationId, id: params.id });
    await service.delete(params.id);
    return NextResponse.json(createSuccessEnvelope({ deleted: true }, correlationId), {
      status: 200,
    });
  } catch (error) {
    logger.error('DELETE /api/glycerol-stocks/[id] failed', error as Error, { correlationId });
    const envelope = createErrorEnvelope(error, correlationId);
    return NextResponse.json(envelope, { status: statusForErrorEnvelope(envelope) });
  }
}
