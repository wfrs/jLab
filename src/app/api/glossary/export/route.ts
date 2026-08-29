/**
 * Glossary Excel Export API Route
 * GET: Download a glossary as .xlsx (legacy -ALLEXCEL- / -USEDEXCEL- and the
 * organism equivalents).
 *   ?entity=features|organisms  which glossary
 *   ?scope=all|used             every entry, or only referenced ones
 * Follows ADR-0008 (API response envelopes) for errors; success is a file.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { GlossaryExcelService, ExportScope } from '@/services/glossary-excel.service';
import { SettingsService } from '@/services/settings.service';
import { Logger } from '@/infrastructure/logger';
import { createErrorEnvelope, statusForErrorEnvelope } from '@/shared/api-envelope';
import { contentDispositionAttachment } from '@/shared/http-file';
import { sanitizeFilenamePart } from '@/shared/filename';
import { randomUUID } from 'crypto';

const logger = new Logger();
const glossaryExcelService = new GlossaryExcelService(logger);
const settingsService = new SettingsService(logger);

const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const querySchema = z.object({
  entity: z.enum(['features', 'organisms']).default('features'),
  scope: z.enum(['all', 'used']).default('all'),
});

/** Legacy filenames: ALL_nucleic_acid_features.xlsx / USED_..._{user}_{date}.xlsx */
function exportFilename(
  entity: 'features' | 'organisms',
  scope: ExportScope,
  userName: string
): string {
  const stem = entity === 'features' ? 'nucleic_acid_features' : 'organisms';
  const parts = [scope.toUpperCase(), '_', stem];
  const user = sanitizeFilenamePart(userName);
  if (user) {
    parts.push('_', user);
  }
  parts.push('_', new Date().toISOString().slice(0, 10), '.xlsx');
  return parts.join('');
}

export async function GET(request: NextRequest) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();

  try {
    const { searchParams } = new URL(request.url);
    const { entity, scope } = querySchema.parse({
      entity: searchParams.get('entity') ?? undefined,
      scope: searchParams.get('scope') ?? undefined,
    });

    logger.info('GET /api/glossary/export', { correlationId, entity, scope });

    const settings = await settingsService.getSettings();
    const workbook =
      entity === 'features'
        ? await glossaryExcelService.exportFeatures(scope, settings.initials)
        : await glossaryExcelService.exportOrganisms(scope, settings.initials);

    return new NextResponse(new Uint8Array(workbook), {
      status: 200,
      headers: {
        'Content-Type': XLSX_CONTENT_TYPE,
        'Content-Disposition': contentDispositionAttachment(
          exportFilename(entity, scope, settings.name)
        ),
      },
    });
  } catch (error) {
    logger.error('GET /api/glossary/export failed', error as Error, { correlationId });
    const envelope = createErrorEnvelope(error, correlationId);
    return NextResponse.json(envelope, { status: statusForErrorEnvelope(envelope) });
  }
}
