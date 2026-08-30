/**
 * Glycerol stocks
 * GET  /api/glycerol-stocks?plasmidIds=a,b,c — stocks belonging to those plasmids
 * POST /api/glycerol-stocks — record a new stock
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
import { createGlycerolStockSchema } from '@/shared/validation/label-schemas';
import { stripUndefined } from '@/shared/validation/strip-undefined';
import { randomUUID } from 'crypto';

const logger = new Logger();
const service = new GlycerolStockService(logger);

export async function GET(request: NextRequest) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();

  try {
    const { searchParams } = new URL(request.url);
    const plasmidIds = (searchParams.get('plasmidIds') ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);

    logger.info('GET /api/glycerol-stocks', { correlationId, count: plasmidIds.length });

    const stocks = await service.listForPlasmids(plasmidIds);

    return NextResponse.json(createSuccessEnvelope({ stocks }, correlationId), { status: 200 });
  } catch (error) {
    logger.error('GET /api/glycerol-stocks failed', error as Error, { correlationId });
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

    const input = createGlycerolStockSchema.parse(body);

    logger.info('POST /api/glycerol-stocks', { correlationId, stockId: input.stockId });

    const stock = await service.create(stripUndefined(input));

    return NextResponse.json(createSuccessEnvelope(stock, correlationId), { status: 201 });
  } catch (error) {
    logger.error('POST /api/glycerol-stocks failed', error as Error, { correlationId });
    const envelope = createErrorEnvelope(error, correlationId);
    return NextResponse.json(envelope, { status: statusForErrorEnvelope(envelope) });
  }
}
