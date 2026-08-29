/**
 * AttachmentService
 * Business logic for per-plasmid file attachments (legacy Attachments table:
 * upload any file as BLOB, download by id, delete). Services own transactions
 * (ADR-0005) and validate domain invariants (ADR-0007).
 */

import { AttachmentRepository } from './attachment.repository';
import { PlasmidRepository } from './plasmid.repository';
import { Attachment, AttachmentMeta, DomainError } from '@domain/types';
import { Logger } from '@infrastructure/logger';
import { randomUUID } from 'crypto';

/**
 * Upload size cap — legacy had none (any file went into the BLOB column);
 * v2 guards the single-file SQLite database against runaway growth.
 */
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

export interface CreateAttachmentInput {
  id?: string;
  plasmidId: string;
  filename: string;
  mimeType?: string;
  data: Buffer;
}

export class AttachmentService {
  private repository: AttachmentRepository;
  private plasmidRepository: PlasmidRepository;
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger || new Logger();
    this.repository = new AttachmentRepository(this.logger);
    this.plasmidRepository = new PlasmidRepository(this.logger);
  }

  /**
   * Store an uploaded file on a plasmid
   */
  async createAttachment(input: CreateAttachmentInput): Promise<AttachmentMeta> {
    this.logger.info('AttachmentService.createAttachment', {
      plasmidId: input.plasmidId,
      filename: input.filename,
      sizeBytes: input.data.length,
    });

    // Domain invariant: filename is required (legacy: "Select a file.")
    if (!input.filename || input.filename.trim().length === 0) {
      throw new DomainError('VALIDATION', 'Attachment filename is required', {
        field: 'filename',
      });
    }

    // Domain invariant: no empty files
    if (input.data.length === 0) {
      throw new DomainError('VALIDATION', 'Attachment file is empty', { field: 'file' });
    }

    // Domain invariant: size cap (v2 guard, see MAX_ATTACHMENT_BYTES)
    if (input.data.length > MAX_ATTACHMENT_BYTES) {
      throw new DomainError('VALIDATION', 'Attachment exceeds the 25 MB size limit', {
        field: 'file',
        sizeBytes: input.data.length,
        maxBytes: MAX_ATTACHMENT_BYTES,
      });
    }

    // Domain invariant: parent plasmid must exist
    const plasmid = await this.plasmidRepository.getById(input.plasmidId);
    if (!plasmid) {
      throw new DomainError('NOT_FOUND', `Plasmid not found: ${input.plasmidId}`, {
        plasmidId: input.plasmidId,
      });
    }

    try {
      const created = await this.repository.create({
        id: input.id || randomUUID(),
        plasmidId: input.plasmidId,
        filename: input.filename.trim(),
        mimeType: input.mimeType || 'application/octet-stream',
        sizeBytes: input.data.length,
        data: input.data,
      });

      this.logger.info('AttachmentService.createAttachment succeeded', {
        id: created.id,
        plasmidId: created.plasmidId,
      });

      const { data: _data, ...meta } = created;
      return meta;
    } catch (error) {
      if (error instanceof DomainError) {
        throw error;
      }
      this.logger.error('AttachmentService.createAttachment failed', error as Error, {
        plasmidId: input.plasmidId,
      });
      throw new DomainError('DATABASE', 'Failed to store attachment', {
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get an attachment including its binary payload (download)
   */
  async getAttachment(id: string): Promise<Attachment> {
    this.logger.info('AttachmentService.getAttachment', { id });

    try {
      const attachment = await this.repository.getById(id);
      if (!attachment) {
        throw new DomainError('NOT_FOUND', `Attachment not found: ${id}`, { id });
      }
      return attachment;
    } catch (error) {
      if (error instanceof DomainError) {
        throw error;
      }
      this.logger.error('AttachmentService.getAttachment failed', error as Error, { id });
      throw new DomainError('DATABASE', 'Failed to retrieve attachment', {
        cause: error instanceof Error ? error.message : String(error),
        id,
      });
    }
  }

  /**
   * Delete an attachment
   */
  async deleteAttachment(id: string): Promise<void> {
    this.logger.info('AttachmentService.deleteAttachment', { id });

    const existing = await this.repository.getById(id);
    if (!existing) {
      throw new DomainError('NOT_FOUND', `Attachment not found: ${id}`, { id });
    }

    try {
      await this.repository.delete(id);
      this.logger.info('AttachmentService.deleteAttachment succeeded', { id });
    } catch (error) {
      if (error instanceof DomainError) {
        throw error;
      }
      this.logger.error('AttachmentService.deleteAttachment failed', error as Error, { id });
      throw new DomainError('DATABASE', 'Failed to delete attachment', {
        cause: error instanceof Error ? error.message : String(error),
        id,
      });
    }
  }

  /**
   * List attachment metadata for a plasmid (no binary payloads)
   */
  async listPlasmidAttachments(plasmidId: string): Promise<AttachmentMeta[]> {
    this.logger.info('AttachmentService.listPlasmidAttachments', { plasmidId });

    // Distinguish "no attachments" from "no plasmid"
    const plasmid = await this.plasmidRepository.getById(plasmidId);
    if (!plasmid) {
      throw new DomainError('NOT_FOUND', `Plasmid not found: ${plasmidId}`, { plasmidId });
    }

    try {
      return await this.repository.listMetaByPlasmid(plasmidId);
    } catch (error) {
      this.logger.error('AttachmentService.listPlasmidAttachments failed', error as Error, {
        plasmidId,
      });
      throw new DomainError('DATABASE', 'Failed to list attachments', {
        cause: error instanceof Error ? error.message : String(error),
        plasmidId,
      });
    }
  }
}
