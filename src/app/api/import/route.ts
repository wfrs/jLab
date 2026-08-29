/**
 * Database Import API Route
 * POST: Upload a legacy GMOCU v1 SQLite file (multipart/form-data).
 * - dryRun=1: inspect only — returns importable plasmid names
 * - names (JSON array): import just those candidates; omitted = import all
 * Follows ADR-0008 (API response envelopes), ADR-0007 (validation at boundary)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ImportService } from '@/services/import.service';
import { Logger } from '@/infrastructure/logger';
import {
  createSuccessEnvelope,
  createErrorEnvelope,
  statusForErrorEnvelope,
} from '@/shared/api-envelope';
import { ApiError } from '@/shared/api-types';
import { randomUUID } from 'crypto';

const logger = new Logger();
const importService = new ImportService(logger);

const namesSchema = z.array(z.string().min(1));

interface ParsedImportRequest {
  data: Buffer;
  dryRun: boolean;
  names?: string[];
}

async function parseImportRequest(request: NextRequest): Promise<ParsedImportRequest> {
  const formData = await request.formData().catch(() => {
    throw new ApiError(
      'INVALID_FORM',
      'VALIDATION',
      'Request must be multipart/form-data with a "file" field'
    );
  });

  const file = formData.get('file');
  if (!(file instanceof Blob)) {
    throw new ApiError('MISSING_FILE', 'VALIDATION', 'Form field "file" must be a file');
  }
  const data = Buffer.from(await file.arrayBuffer());

  const dryRunField = formData.get('dryRun');
  const dryRun = dryRunField === '1' || dryRunField === 'true';

  const namesField = formData.get('names');
  let names: string[] | undefined;
  if (typeof namesField === 'string' && namesField.length > 0) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(namesField);
    } catch {
      throw new ApiError(
        'INVALID_NAMES',
        'VALIDATION',
        'Form field "names" must be a JSON array of plasmid names'
      );
    }
    names = namesSchema.parse(parsed);
  }

  return dryRun ? { data, dryRun } : { data, dryRun, ...(names && { names }) };
}

/**
 * POST /api/import
 * Inspect or import a legacy GMOCU v1 database file
 */
export async function POST(request: NextRequest) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();

  try {
    const { data, dryRun, names } = await parseImportRequest(request);

    logger.info('POST /api/import', {
      correlationId,
      sizeBytes: data.length,
      dryRun,
      selectedNames: names?.length,
    });

    if (dryRun) {
      const inspection = await importService.inspectSource(data);
      return NextResponse.json(createSuccessEnvelope(inspection, correlationId), { status: 200 });
    }

    const result = await importService.importFromSource(data, names);

    logger.info('Database import completed', {
      correlationId,
      importedPlasmids: result.importedPlasmids.length,
      addedFeatures: result.addedFeatures.length,
      addedOrganisms: result.addedOrganisms.length,
    });

    return NextResponse.json(createSuccessEnvelope(result, correlationId), { status: 200 });
  } catch (error) {
    logger.error('POST /api/import failed', error as Error, { correlationId });
    const envelope = createErrorEnvelope(error, correlationId);
    return NextResponse.json(envelope, { status: statusForErrorEnvelope(envelope) });
  }
}
