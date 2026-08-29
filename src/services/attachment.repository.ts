/**
 * AttachmentRepository
 * Data access layer for plasmid attachments (ADR-0005).
 * List queries select metadata only — the BLOB is fetched per-attachment.
 */

import { Repository, RepositoryOptions } from './repository';
import { Attachment, AttachmentMeta } from '@domain/types';
import { getQueryBuilder } from '@infrastructure/query-builder';
import { Logger } from '@infrastructure/logger';

const META_COLUMNS = [
  'id',
  'plasmidId',
  'filename',
  'mimeType',
  'sizeBytes',
  'createdAt',
  'updatedAt',
];

export class AttachmentRepository extends Repository<Attachment> {
  constructor(logger?: Logger, options?: RepositoryOptions) {
    super(getQueryBuilder(), 'attachments', { ...options, ...(logger && { logger }) });
  }

  /**
   * List attachment metadata for a plasmid (no binary payloads), newest first
   */
  async listMetaByPlasmid(plasmidId: string): Promise<AttachmentMeta[]> {
    this.logger.info('AttachmentRepository.listMetaByPlasmid', { plasmidId });

    try {
      const results = await this.qb(this.table)
        .where('plasmidId', plasmidId)
        .select(META_COLUMNS)
        .orderBy('createdAt', 'desc')
        .orderBy('filename', 'asc');

      return (results as AttachmentMeta[]) || [];
    } catch (error) {
      this.logger.error('AttachmentRepository.listMetaByPlasmid failed', error as Error, {
        plasmidId,
      });
      throw error;
    }
  }
}
