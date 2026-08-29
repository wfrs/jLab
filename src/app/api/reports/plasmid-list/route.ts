/**
 * Plasmid List Report Route
 * GET: Generate the plasmid list XLSX (legacy Plasmidlist export)
 */

import { NextRequest, NextResponse } from 'next/server';
import { ReportService } from '@/services/report.service';
import { SettingsService } from '@/services/settings.service';
import { buildPlasmidListWorkbook } from '@/services/report-workbook';
import { sanitizeFilenamePart } from '@/shared/filename';
import { Logger } from '@/infrastructure/logger';
import { createErrorEnvelope, statusForErrorEnvelope } from '@/shared/api-envelope';
import { randomUUID } from 'crypto';

const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const logger = new Logger();
const reportService = new ReportService(logger);
const settingsService = new SettingsService(logger);

export async function GET(request: NextRequest) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();

  try {
    logger.info('GET /api/reports/plasmid-list', { correlationId });

    const settings = await settingsService.getSettings();
    const rows = await reportService.buildPlasmidListRows();
    const dateStamp = new Date().toISOString().slice(0, 10);
    const buffer = await buildPlasmidListWorkbook(rows, dateStamp, settings.initials);

    // Legacy filename: Plasmidlist_{user name}_{date}.xlsx
    const namePart = sanitizeFilenamePart(settings.name);
    const filename = `Plasmidlist_${namePart ? `${namePart}_` : ''}${dateStamp}.xlsx`;

    logger.info('Plasmid list generated', { correlationId, rows: rows.length, filename });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': XLSX_CONTENT_TYPE,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    logger.error('GET /api/reports/plasmid-list failed', error as Error, { correlationId });
    const envelope = createErrorEnvelope(error, correlationId);
    return NextResponse.json(envelope, { status: statusForErrorEnvelope(envelope) });
  }
}
