/**
 * Lab Spreadsheet Import API Route
 * POST: Upload the lab's plasmid workbook (multipart/form-data).
 * - dryRun=1: inspect only — reports sheets and row counts, writes nothing
 * Follows ADR-0008 (API response envelopes), ADR-0007 (validation at boundary)
 *
 * Sits beside /api/import, which takes a legacy GMOCU v1 SQLite file. The
 * workbook is the authoritative source; the .db export is older and thinner.
 */

import { NextRequest, NextResponse } from 'next/server';
import { SpreadsheetImportService } from '@/services/spreadsheet-import.service';
import { SettingsService } from '@/services/settings.service';
import { Logger } from '@/infrastructure/logger';
import {
  createSuccessEnvelope,
  createErrorEnvelope,
  statusForErrorEnvelope,
} from '@/shared/api-envelope';
import { ApiError } from '@/shared/api-types';
import { randomUUID } from 'crypto';

const logger = new Logger();
const importService = new SpreadsheetImportService(logger);
const settingsService = new SettingsService(logger);

async function parseRequest(request: NextRequest): Promise<{ data: Buffer; dryRun: boolean }> {
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

  const dryRunField = formData.get('dryRun');
  return {
    data: Buffer.from(await file.arrayBuffer()),
    dryRun: dryRunField === '1' || dryRunField === 'true',
  };
}

/**
 * POST /api/import/spreadsheet
 * Inspect or import the lab plasmid workbook
 */
export async function POST(request: NextRequest) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();

  try {
    const { data, dryRun } = await parseRequest(request);

    logger.info('POST /api/import/spreadsheet', {
      correlationId,
      sizeBytes: data.length,
      dryRun,
    });

    if (dryRun) {
      const inspection = await importService.inspectWorkbook(data);
      return NextResponse.json(createSuccessEnvelope(inspection, correlationId), { status: 200 });
    }

    // The workbook has no operator column — it belongs to one person, so the
    // imported preps are attributed to the configured user.
    const settings = await settingsService.getSettings();
    const result = await importService.importWorkbook(data, {
      operatorInitials: settings.initials,
    });

    logger.info('Spreadsheet import completed', {
      correlationId,
      plasmidsAdded: result.plasmids.added,
      plasmidsUpdated: result.plasmids.updated,
      preps: result.preps.added,
      stocksAdded: result.stocks.added,
      stockIdMismatches: result.stockIdMismatches.length,
    });

    return NextResponse.json(createSuccessEnvelope(result, correlationId), { status: 200 });
  } catch (error) {
    logger.error('POST /api/import/spreadsheet failed', error as Error, { correlationId });
    const envelope = createErrorEnvelope(error, correlationId);
    return NextResponse.json(envelope, { status: statusForErrorEnvelope(envelope) });
  }
}
