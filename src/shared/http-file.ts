/**
 * File upload/download helpers for route handlers
 */

import { ApiError } from './api-types';

export interface UploadedFile {
  filename: string;
  mimeType: string;
  data: Buffer;
}

/**
 * Read the "file" field from a multipart/form-data request.
 * Throws a VALIDATION ApiError when the body is not multipart or the field
 * is missing/not a file.
 */
export async function readUploadedFile(request: Request): Promise<UploadedFile> {
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

  const filename = 'name' in file && typeof file.name === 'string' ? file.name : '';
  const data = Buffer.from(await file.arrayBuffer());

  return {
    filename,
    mimeType: file.type || 'application/octet-stream',
    data,
  };
}

/**
 * Content-Disposition header for a download, safe against header injection
 * and non-ASCII filenames (RFC 5987 filename* with an ASCII fallback).
 */
export function contentDispositionAttachment(filename: string): string {
  const fallback = filename.replace(/["\\\r\n]/g, '_').replace(/[^\x20-\x7e]/g, '_');
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
