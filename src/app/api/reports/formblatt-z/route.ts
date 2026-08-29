/**
 * Formblatt Z Report Route
 * GET: Generate the Formblatt-Z XLSX (German regulatory GMO record)
 * ?lang=de|en selects the column-header language (legacy option).
 * Returns 400 with missingFeatures/missingOrganisms details when the
 * glossary integrity gate fails (legacy blocked with popups).
 */

import { NextRequest, NextResponse } from 'next/server';
import { ReportService } from '@/services/report.service';
import { SettingsService } from '@/services/settings.service';
import { buildFormblattZWorkbook, FormblattLanguage } from '@/services/report-workbook';
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
    const { searchParams } = new URL(request.url);
    const lang: FormblattLanguage = searchParams.get('lang') === 'en' ? 'en' : 'de';
    const settings = await settingsService.getSettings();

    logger.info('GET /api/reports/formblatt-z', { correlationId, lang });

    const rows = await reportService.buildFormblattZRows();
    const buffer = await buildFormblattZWorkbook(rows, lang, settings.institution);

    // Legacy filename: Formblatt-Z_{user name}_{date}.xlsx
    const dateStamp = new Date().toISOString().slice(0, 10);
    const namePart = sanitizeFilenamePart(settings.name);
    const filename = `Formblatt-Z_${namePart ? `${namePart}_` : ''}${dateStamp}.xlsx`;

    logger.info('Formblatt-Z generated', { correlationId, rows: rows.length, filename });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': XLSX_CONTENT_TYPE,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    logger.error('GET /api/reports/formblatt-z failed', error as Error, { correlationId });
    const envelope = createErrorEnvelope(error, correlationId);
    return NextResponse.json(envelope, { status: statusForErrorEnvelope(envelope) });
  }
}
