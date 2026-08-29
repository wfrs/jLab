/**
 * Glossary Excel Import API Route
 * POST: Upload a glossary .xlsx template (multipart/form-data, field "file").
 * Whichever of the "features" / "organisms" sheets are present are imported.
 * Follows ADR-0008 (API response envelopes), ADR-0007 (validation at boundary)
 */

import { NextRequest, NextResponse } from 'next/server';
import { GlossaryExcelService } from '@/services/glossary-excel.service';
import { Logger } from '@/infrastructure/logger';
import {
  createSuccessEnvelope,
  createErrorEnvelope,
  statusForErrorEnvelope,
} from '@/shared/api-envelope';
import { readUploadedFile } from '@/shared/http-file';
import { randomUUID } from 'crypto';

const logger = new Logger();
const glossaryExcelService = new GlossaryExcelService(logger);

/**
 * POST /api/glossary/import
 * Adds entries that do not exist yet; existing ones are reported, never
 * overwritten (legacy "we will only add new entries" semantics).
 */
export async function POST(request: NextRequest) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();

  try {
    const file = await readUploadedFile(request);

    logger.info('POST /api/glossary/import', {
      correlationId,
      filename: file.filename,
      sizeBytes: file.data.length,
    });

    const result = await glossaryExcelService.importWorkbook(file.data);

    logger.info('Glossary import completed', {
      correlationId,
      featuresAdded: result.features.added.length,
      organismsAdded: result.organisms.added.length,
    });

    return NextResponse.json(createSuccessEnvelope(result, correlationId), { status: 200 });
  } catch (error) {
    logger.error('POST /api/glossary/import failed', error as Error, { correlationId });
    const envelope = createErrorEnvelope(error, correlationId);
    return NextResponse.json(envelope, { status: statusForErrorEnvelope(envelope) });
  }
}
