/**
 * Plasmid Features API Routes
 * GET: List features on a plasmid (ordered by position)
 * POST: Create a feature
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
import { createFeatureSchema } from '@/shared/validation/feature-schemas';
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
 * GET /api/plasmids/[id]/features
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  const { id: plasmidId } = params;

  try {
    logger.info('GET /api/plasmids/[id]/features', { correlationId, plasmidId });

    const features = await featureService.listPlasmidFeatures(plasmidId);

    return NextResponse.json(createSuccessEnvelope(features, correlationId), { status: 200 });
  } catch (error) {
    logger.error('GET /api/plasmids/[id]/features failed', error as Error, {
      correlationId,
      plasmidId,
    });
    const envelope = createErrorEnvelope(error, correlationId);
    return NextResponse.json(envelope, { status: statusForErrorEnvelope(envelope) });
  }
}

/**
 * POST /api/plasmids/[id]/features
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  const { id: plasmidId } = params;

  try {
    const body = await request.json().catch(() => {
      throw new ApiError('INVALID_JSON', 'VALIDATION', 'Request body must be valid JSON');
    });

    const input = createFeatureSchema.parse(body);

    logger.info('POST /api/plasmids/[id]/features', {
      correlationId,
      plasmidId,
      featureName: input.name,
    });

    const feature = await featureService.createFeature(
      stripUndefined({
        ...input,
        id: input.id || randomUUID(),
        plasmidId,
      })
    );

    logger.info('Feature created successfully', {
      correlationId,
      featureId: feature.id,
      plasmidId,
    });

    return NextResponse.json(createSuccessEnvelope(feature, correlationId), { status: 201 });
  } catch (error) {
    logger.error('POST /api/plasmids/[id]/features failed', error as Error, {
      correlationId,
      plasmidId,
    });
    const envelope = createErrorEnvelope(error, correlationId);
    return NextResponse.json(envelope, { status: statusForErrorEnvelope(envelope) });
  }
}
