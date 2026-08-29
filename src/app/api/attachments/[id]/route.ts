/**
 * Attachment API Routes
 * GET: Download the attachment's binary content (legacy: file written from
 * the BLOB column under its stored Filename)
 * DELETE: Remove the attachment
 * Follows ADR-0008 (API response envelopes)
 */

import { NextRequest, NextResponse } from 'next/server';
import { AttachmentService } from '@/services/attachment.service';
import { Logger } from '@/infrastructure/logger';
import {
  createSuccessEnvelope,
  createErrorEnvelope,
  statusForErrorEnvelope,
} from '@/shared/api-envelope';
import { contentDispositionAttachment } from '@/shared/http-file';
import { randomUUID } from 'crypto';

const logger = new Logger();
const attachmentService = new AttachmentService(logger);

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * GET /api/attachments/[id]
 * Download the file with its stored filename and content type
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  const { id } = params;

  try {
    logger.info('GET /api/attachments/[id]', { correlationId, id });

    const attachment = await attachmentService.getAttachment(id);

    return new NextResponse(new Uint8Array(attachment.data), {
      status: 200,
      headers: {
        'Content-Type': attachment.mimeType,
        'Content-Disposition': contentDispositionAttachment(attachment.filename),
        'Content-Length': String(attachment.sizeBytes),
      },
    });
  } catch (error) {
    logger.error('GET /api/attachments/[id] failed', error as Error, { correlationId, id });
    const envelope = createErrorEnvelope(error, correlationId);
    return NextResponse.json(envelope, { status: statusForErrorEnvelope(envelope) });
  }
}

/**
 * DELETE /api/attachments/[id]
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  const { id } = params;

  try {
    logger.info('DELETE /api/attachments/[id]', { correlationId, id });

    await attachmentService.deleteAttachment(id);

    return NextResponse.json(createSuccessEnvelope({ id }, correlationId), { status: 200 });
  } catch (error) {
    logger.error('DELETE /api/attachments/[id] failed', error as Error, { correlationId, id });
    const envelope = createErrorEnvelope(error, correlationId);
    return NextResponse.json(envelope, { status: statusForErrorEnvelope(envelope) });
  }
}
