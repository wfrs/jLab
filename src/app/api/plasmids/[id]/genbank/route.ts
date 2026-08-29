/**
 * Plasmid GenBank API Routes
 * GET: Metadata for the plasmid's GenBank file (data: null when absent);
 *      ?download=1 streams the file text under its stored filename
 * PUT: Upload/replace the GenBank file (multipart/form-data, field "file";
 *      legacy gate: .gb/.gbk extension only)
 * DELETE: Remove the GenBank file
 * Follows ADR-0008 (API response envelopes), ADR-0007 (validation at boundary)
 */

import { NextRequest, NextResponse } from 'next/server';
import { GenbankService } from '@/services/genbank.service';
import { Logger } from '@/infrastructure/logger';
import {
  createSuccessEnvelope,
  createErrorEnvelope,
  statusForErrorEnvelope,
} from '@/shared/api-envelope';
import { readUploadedFile, contentDispositionAttachment } from '@/shared/http-file';
import { randomUUID } from 'crypto';

const logger = new Logger();
const genbankService = new GenbankService(logger);

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * GET /api/plasmids/[id]/genbank
 * Metadata by default; ?download=1 returns the file itself
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  const { id: plasmidId } = params;
  const wantsDownload = new URL(request.url).searchParams.get('download') === '1';

  try {
    logger.info('GET /api/plasmids/[id]/genbank', { correlationId, plasmidId, wantsDownload });

    if (wantsDownload) {
      const file = await genbankService.getFile(plasmidId);
      return new NextResponse(file.content, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': contentDispositionAttachment(file.filename),
        },
      });
    }

    const meta = await genbankService.getMeta(plasmidId);
    return NextResponse.json(createSuccessEnvelope(meta, correlationId), { status: 200 });
  } catch (error) {
    logger.error('GET /api/plasmids/[id]/genbank failed', error as Error, {
      correlationId,
      plasmidId,
    });
    const envelope = createErrorEnvelope(error, correlationId);
    return NextResponse.json(envelope, { status: statusForErrorEnvelope(envelope) });
  }
}

/**
 * PUT /api/plasmids/[id]/genbank
 * Store or replace the plasmid's GenBank file
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  const { id: plasmidId } = params;

  try {
    const file = await readUploadedFile(request);

    logger.info('PUT /api/plasmids/[id]/genbank', {
      correlationId,
      plasmidId,
      filename: file.filename,
      sizeBytes: file.data.length,
    });

    const meta = await genbankService.setFile({
      plasmidId,
      filename: file.filename,
      content: file.data.toString('utf8'),
    });

    logger.info('GenBank file stored successfully', { correlationId, plasmidId });

    return NextResponse.json(createSuccessEnvelope(meta, correlationId), { status: 200 });
  } catch (error) {
    logger.error('PUT /api/plasmids/[id]/genbank failed', error as Error, {
      correlationId,
      plasmidId,
    });
    const envelope = createErrorEnvelope(error, correlationId);
    return NextResponse.json(envelope, { status: statusForErrorEnvelope(envelope) });
  }
}

/**
 * DELETE /api/plasmids/[id]/genbank
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  const { id: plasmidId } = params;

  try {
    logger.info('DELETE /api/plasmids/[id]/genbank', { correlationId, plasmidId });

    await genbankService.deleteFile(plasmidId);

    return NextResponse.json(createSuccessEnvelope({ plasmidId }, correlationId), { status: 200 });
  } catch (error) {
    logger.error('DELETE /api/plasmids/[id]/genbank failed', error as Error, {
      correlationId,
      plasmidId,
    });
    const envelope = createErrorEnvelope(error, correlationId);
    return NextResponse.json(envelope, { status: statusForErrorEnvelope(envelope) });
  }
}
