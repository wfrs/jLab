/**
 * Single Glossary Feature API Routes
 * PATCH: Update a glossary feature
 * DELETE: Delete a glossary feature
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
import { updateGlossaryFeatureSchema } from '@/shared/validation/glossary-schemas';
import { stripUndefined } from '@/shared/validation/strip-undefined';
import { randomUUID } from 'crypto';

const logger = new Logger();
const glossaryService = new GlossaryFeatureService(logger);

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * PATCH /api/glossary/features/[id]
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  const { id } = params;

  try {
    const body = await request.json().catch(() => {
      throw new ApiError('INVALID_JSON', 'VALIDATION', 'Request body must be valid JSON');
    });

    const updates = stripUndefined(updateGlossaryFeatureSchema.parse(body));

    logger.info('PATCH /api/glossary/features/[id]', {
      correlationId,
      featureId: id,
      fields: Object.keys(updates),
    });

    const feature = await glossaryService.updateFeature(id, updates);

    logger.info('Glossary feature updated successfully', { correlationId, featureId: id });

    return NextResponse.json(createSuccessEnvelope(feature, correlationId), { status: 200 });
  } catch (error) {
    logger.error('PATCH /api/glossary/features/[id] failed', error as Error, {
      correlationId,
      featureId: id,
    });
    const envelope = createErrorEnvelope(error, correlationId);
    return NextResponse.json(envelope, { status: statusForErrorEnvelope(envelope) });
  }
}

/**
 * DELETE /api/glossary/features/[id]
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  const { id } = params;

  try {
    logger.info('DELETE /api/glossary/features/[id]', { correlationId, featureId: id });

    await glossaryService.deleteFeature(id);

    logger.info('Glossary feature deleted successfully', { correlationId, featureId: id });

    return NextResponse.json(createSuccessEnvelope({ id }, correlationId), { status: 200 });
  } catch (error) {
    logger.error('DELETE /api/glossary/features/[id] failed', error as Error, {
      correlationId,
      featureId: id,
    });
    const envelope = createErrorEnvelope(error, correlationId);
    return NextResponse.json(envelope, { status: statusForErrorEnvelope(envelope) });
  }
}
