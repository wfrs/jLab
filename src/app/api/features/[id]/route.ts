/**
 * Feature API Routes
 * PATCH: Update a feature
 * DELETE: Remove a feature
 * Follows ADR-0008 (API response envelopes), ADR-0007 (Zod at API boundary)
 */

import { NextRequest, NextResponse } from 'next/server';
import { FeatureService } from '@/services/feature.service';
import { Logger } from '@/infrastructure/logger';
import { ApiError } from '@/shared/api-types';
import {
  createSuccessEnvelope,
  createErrorEnvelope,
  statusForErrorEnvelope,
} from '@/shared/api-envelope';
import { updateFeatureSchema } from '@/shared/validation/feature-schemas';
import { stripUndefined } from '@/shared/validation/strip-undefined';
import { randomUUID } from 'crypto';

const logger = new Logger();
const featureService = new FeatureService(logger);

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * PATCH /api/features/[id]
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  const { id } = params;

  try {
    const body = await request.json().catch(() => {
      throw new ApiError('INVALID_JSON', 'VALIDATION', 'Request body must be valid JSON');
    });

    const updates = updateFeatureSchema.parse(body);

    logger.info('PATCH /api/features/[id]', { correlationId, id, fields: Object.keys(updates) });

    const feature = await featureService.updateFeature(id, stripUndefined(updates));

    return NextResponse.json(createSuccessEnvelope(feature, correlationId), { status: 200 });
  } catch (error) {
    logger.error('PATCH /api/features/[id] failed', error as Error, { correlationId, id });
    const envelope = createErrorEnvelope(error, correlationId);
    return NextResponse.json(envelope, { status: statusForErrorEnvelope(envelope) });
  }
}

/**
 * DELETE /api/features/[id]
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  const { id } = params;

  try {
    logger.info('DELETE /api/features/[id]', { correlationId, id });

    await featureService.deleteFeature(id);

    return NextResponse.json(createSuccessEnvelope({ id }, correlationId), { status: 200 });
  } catch (error) {
    logger.error('DELETE /api/features/[id] failed', error as Error, { correlationId, id });
    const envelope = createErrorEnvelope(error, correlationId);
    return NextResponse.json(envelope, { status: statusForErrorEnvelope(envelope) });
  }
}
