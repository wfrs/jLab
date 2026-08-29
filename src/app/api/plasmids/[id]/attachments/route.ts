/**
 * Plasmid Attachments API Routes
 * GET: List attachment metadata for a plasmid (no binary payloads)
 * POST: Upload a file (multipart/form-data, field "file")
 * Follows ADR-0008 (API response envelopes), ADR-0007 (validation at boundary)
 */

import { NextRequest, NextResponse } from 'next/server';
import { AttachmentService } from '@/services/attachment.service';
import { Logger } from '@/infrastructure/logger';
import {
  createSuccessEnvelope,
  createErrorEnvelope,
  statusForErrorEnvelope,
} from '@/shared/api-envelope';
import { readUploadedFile } from '@/shared/http-file';
import { randomUUID } from 'crypto';

const logger = new Logger();
const attachmentService = new AttachmentService(logger);

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * GET /api/plasmids/[id]/attachments
 * List attachment metadata for the plasmid, newest first
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  const { id: plasmidId } = params;

  try {
    logger.info('GET /api/plasmids/[id]/attachments', { correlationId, plasmidId });

    const attachments = await attachmentService.listPlasmidAttachments(plasmidId);

    return NextResponse.json(createSuccessEnvelope(attachments, correlationId), { status: 200 });
  } catch (error) {
    logger.error('GET /api/plasmids/[id]/attachments failed', error as Error, {
      correlationId,
      plasmidId,
    });
    const envelope = createErrorEnvelope(error, correlationId);
    return NextResponse.json(envelope, { status: statusForErrorEnvelope(envelope) });
  }
}

/**
 * POST /api/plasmids/[id]/attachments
 * Store an uploaded file on the plasmid (multipart/form-data, field "file")
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  const { id: plasmidId } = params;

  try {
    const file = await readUploadedFile(request);

    logger.info('POST /api/plasmids/[id]/attachments', {
      correlationId,
      plasmidId,
      filename: file.filename,
      sizeBytes: file.data.length,
    });

    const attachment = await attachmentService.createAttachment({
      id: randomUUID(),
      plasmidId,
      filename: file.filename,
      mimeType: file.mimeType,
      data: file.data,
    });

    logger.info('Attachment stored successfully', {
      correlationId,
      attachmentId: attachment.id,
      plasmidId,
    });

    return NextResponse.json(createSuccessEnvelope(attachment, correlationId), { status: 201 });
  } catch (error) {
    logger.error('POST /api/plasmids/[id]/attachments failed', error as Error, {
      correlationId,
      plasmidId,
    });
    const envelope = createErrorEnvelope(error, correlationId);
    return NextResponse.json(envelope, { status: statusForErrorEnvelope(envelope) });
  }
}
