/**
 * Settings API Routes
 * GET: Read the (singleton) settings
 * PATCH: Partially update the settings
 * Follows ADR-0008 (API response envelopes), ADR-0007 (Zod at API boundary)
 */

import { NextRequest, NextResponse } from 'next/server';
import { SettingsService } from '@/services/settings.service';
import { Logger } from '@/infrastructure/logger';
import { ApiError } from '@/shared/api-types';
import {
  createSuccessEnvelope,
  createErrorEnvelope,
  statusForErrorEnvelope,
} from '@/shared/api-envelope';
import { updateSettingsSchema } from '@/shared/validation/settings-schemas';
import { stripUndefined } from '@/shared/validation/strip-undefined';
import { randomUUID } from 'crypto';

const logger = new Logger();
const settingsService = new SettingsService(logger);

/**
 * GET /api/settings
 */
export async function GET(request: NextRequest) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();

  try {
    logger.info('GET /api/settings', { correlationId });

    const settings = await settingsService.getSettings();

    return NextResponse.json(createSuccessEnvelope(settings, correlationId), { status: 200 });
  } catch (error) {
    logger.error('GET /api/settings failed', error as Error, { correlationId });
    const envelope = createErrorEnvelope(error, correlationId);
    return NextResponse.json(envelope, { status: statusForErrorEnvelope(envelope) });
  }
}

/**
 * PATCH /api/settings
 */
export async function PATCH(request: NextRequest) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();

  try {
    const body = await request.json().catch(() => {
      throw new ApiError('INVALID_JSON', 'VALIDATION', 'Request body must be valid JSON');
    });

    const updates = stripUndefined(updateSettingsSchema.parse(body));

    logger.info('PATCH /api/settings', { correlationId, fields: Object.keys(updates) });

    const settings = await settingsService.updateSettings(updates);

    logger.info('Settings updated successfully', { correlationId });

    return NextResponse.json(createSuccessEnvelope(settings, correlationId), { status: 200 });
  } catch (error) {
    logger.error('PATCH /api/settings failed', error as Error, { correlationId });
    const envelope = createErrorEnvelope(error, correlationId);
    return NextResponse.json(envelope, { status: statusForErrorEnvelope(envelope) });
  }
}
