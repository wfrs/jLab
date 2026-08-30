/**
 * Batch-add Favourite GMOs API Route
 * POST: Add every favourite organism as a GMO on the plasmid
 * (legacy -ADDFAV-). No body — the favourite set is server state.
 * Follows ADR-0008 (API response envelopes)
 */

import { NextRequest, NextResponse } from 'next/server';
import { GmoService } from '@/services/gmo.service';
import { Logger } from '@/infrastructure/logger';
import {
  createSuccessEnvelope,
  createErrorEnvelope,
  statusForErrorEnvelope,
} from '@/shared/api-envelope';
import { randomUUID } from 'crypto';

const logger = new Logger();
const gmoService = new GmoService(logger);

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * POST /api/plasmids/[id]/gmos/favourites
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  const { id: plasmidId } = params;

  try {
    logger.info('POST /api/plasmids/[id]/gmos/favourites', { correlationId, plasmidId });

    const result = await gmoService.addFavouritesAsGmos(plasmidId);

    logger.info('Favourite GMOs added', {
      correlationId,
      plasmidId,
      created: result.created.length,
      skipped: result.skipped.length,
    });

    return NextResponse.json(createSuccessEnvelope(result, correlationId), { status: 200 });
  } catch (error) {
    logger.error('POST /api/plasmids/[id]/gmos/favourites failed', error as Error, {
      correlationId,
      plasmidId,
    });
    const envelope = createErrorEnvelope(error, correlationId);
    return NextResponse.json(envelope, { status: statusForErrorEnvelope(envelope) });
  }
}
