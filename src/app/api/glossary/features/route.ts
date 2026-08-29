/**
 * Glossary Features API Routes
 * GET: List glossary features (optional ?search=)
 * POST: Create a glossary feature (annotation normalized, legacy parity)
 * Follows ADR-0008 (API response envelopes), ADR-0007 (Zod at API boundary)
 */

import { NextRequest, NextResponse } from 'next/server';
import { GlossaryFeatureService } from '@/services/glossary-feature.service';
import { Logger } from '@/infrastructure/logger';
import { ApiError } from '@/shared/api-types';
import {
  createSuccessEnvelope,
  createErrorEnvelope,
  statusForErrorEnvelope,
} from '@/shared/api-envelope';
import { createGlossaryFeatureSchema } from '@/shared/validation/glossary-schemas';
import { stripUndefined } from '@/shared/validation/strip-undefined';
import { randomUUID } from 'crypto';

const logger = new Logger();
const glossaryService = new GlossaryFeatureService(logger);

/**
 * GET /api/glossary/features
 */
export async function GET(request: NextRequest) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');

    logger.info('GET /api/glossary/features', { correlationId, search });

    const features = await glossaryService.listFeatures(search || undefined);

    return NextResponse.json(createSuccessEnvelope(features, correlationId), { status: 200 });
  } catch (error) {
    logger.error('GET /api/glossary/features failed', error as Error, { correlationId });
    const envelope = createErrorEnvelope(error, correlationId);
    return NextResponse.json(envelope, { status: statusForErrorEnvelope(envelope) });
  }
}

/**
 * POST /api/glossary/features
 */
export async function POST(request: NextRequest) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();

  try {
    const body = await request.json().catch(() => {
      throw new ApiError('INVALID_JSON', 'VALIDATION', 'Request body must be valid JSON');
    });

    const input = createGlossaryFeatureSchema.parse(body);

    logger.info('POST /api/glossary/features', {
      correlationId,
      annotation: input.annotation,
    });

    const feature = await glossaryService.createFeature(
      stripUndefined({
        ...input,
        id: input.id || randomUUID(),
      })
    );

    logger.info('Glossary feature created successfully', {
      correlationId,
      featureId: feature.id,
    });

    return NextResponse.json(createSuccessEnvelope(feature, correlationId), { status: 201 });
  } catch (error) {
    logger.error('POST /api/glossary/features failed', error as Error, { correlationId });
    const envelope = createErrorEnvelope(error, correlationId);
    return NextResponse.json(envelope, { status: statusForErrorEnvelope(envelope) });
  }
}
