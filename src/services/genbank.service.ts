/**
 * GenbankService
 * The plasmid's GenBank record — at most one per plasmid, keyed by plasmidId
 * (legacy stored it as Plasmids.genebank/gb_name; import overwrote in place).
 * Legacy parity: only .gb/.gbk files are accepted; the file is read as text.
 */

import { getQueryBuilder } from '@infrastructure/query-builder';
import { PlasmidRepository } from './plasmid.repository';
import { GenbankFile, GenbankMeta, DomainError } from '@domain/types';
import { Logger } from '@infrastructure/logger';

/** GenBank files are plain text; 5 MB covers even large annotated genomes */
export const MAX_GENBANK_BYTES = 5 * 1024 * 1024;

/**
 * Legacy extension gate (gmocu.py: "File must have .gb or .gbk extension.").
 * v2 accepts the extensions case-insensitively (legacy compared exact case).
 */
export function isGenbankFilename(filename: string): boolean {
  return /\.(gb|gbk)$/i.test(filename.trim());
}

export interface SetGenbankInput {
  plasmidId: string;
  filename: string;
  content: string;
}

function toMeta(record: GenbankFile): GenbankMeta {
  const { content, ...rest } = record;
  return { ...rest, sizeBytes: Buffer.byteLength(content, 'utf8') };
}

export class GenbankService {
  private plasmidRepository: PlasmidRepository;
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger || new Logger();
    this.plasmidRepository = new PlasmidRepository(this.logger);
  }

  private async requirePlasmid(plasmidId: string): Promise<void> {
    const plasmid = await this.plasmidRepository.getById(plasmidId);
    if (!plasmid) {
      throw new DomainError('NOT_FOUND', `Plasmid not found: ${plasmidId}`, { plasmidId });
    }
  }

  /**
   * Get the plasmid's GenBank metadata; null when no file is stored
   */
  async getMeta(plasmidId: string): Promise<GenbankMeta | null> {
    this.logger.info('GenbankService.getMeta', { plasmidId });
    await this.requirePlasmid(plasmidId);

    try {
      const db = getQueryBuilder();
      const record = (await db('genbank_files').where('plasmidId', plasmidId).first()) as
        GenbankFile | undefined;
      return record ? toMeta(record) : null;
    } catch (error) {
      this.logger.error('GenbankService.getMeta failed', error as Error, { plasmidId });
      throw new DomainError('DATABASE', 'Failed to load GenBank file', {
        cause: error instanceof Error ? error.message : String(error),
        plasmidId,
      });
    }
  }

  /**
   * Get the full GenBank record for download; throws NOT_FOUND when absent
   * (legacy: "There is no Genebank file to download.")
   */
  async getFile(plasmidId: string): Promise<GenbankFile> {
    this.logger.info('GenbankService.getFile', { plasmidId });
    await this.requirePlasmid(plasmidId);

    try {
      const record = (await getQueryBuilder()('genbank_files')
        .where('plasmidId', plasmidId)
        .first()) as GenbankFile | undefined;
      if (!record) {
        throw new DomainError('NOT_FOUND', 'There is no GenBank file to download', { plasmidId });
      }
      return record;
    } catch (error) {
      if (error instanceof DomainError) {
        throw error;
      }
      this.logger.error('GenbankService.getFile failed', error as Error, { plasmidId });
      throw new DomainError('DATABASE', 'Failed to load GenBank file', {
        cause: error instanceof Error ? error.message : String(error),
        plasmidId,
      });
    }
  }

  /**
   * Store or replace the plasmid's GenBank file (legacy import semantics:
   * a new import overwrites the previous content and filename)
   */
  async setFile(input: SetGenbankInput): Promise<GenbankMeta> {
    this.logger.info('GenbankService.setFile', {
      plasmidId: input.plasmidId,
      filename: input.filename,
    });

    const filename = input.filename.trim();
    if (filename.length === 0) {
      throw new DomainError('VALIDATION', 'GenBank filename is required', { field: 'filename' });
    }
    if (!isGenbankFilename(filename)) {
      throw new DomainError('VALIDATION', 'File must have .gb or .gbk extension', {
        field: 'filename',
        filename,
      });
    }
    if (input.content.length === 0) {
      throw new DomainError('VALIDATION', 'GenBank file is empty', { field: 'file' });
    }
    if (Buffer.byteLength(input.content, 'utf8') > MAX_GENBANK_BYTES) {
      throw new DomainError('VALIDATION', 'GenBank file exceeds the 5 MB size limit', {
        field: 'file',
        maxBytes: MAX_GENBANK_BYTES,
      });
    }

    await this.requirePlasmid(input.plasmidId);

    try {
      const db = getQueryBuilder();
      const now = new Date().toISOString();
      const existing = await db('genbank_files').where('plasmidId', input.plasmidId).first();

      if (existing) {
        await db('genbank_files')
          .where('plasmidId', input.plasmidId)
          .update({ filename, content: input.content, updatedAt: now });
      } else {
        await db('genbank_files').insert({
          plasmidId: input.plasmidId,
          filename,
          content: input.content,
          createdAt: now,
          updatedAt: now,
        });
      }

      const record = (await db('genbank_files')
        .where('plasmidId', input.plasmidId)
        .first()) as GenbankFile;

      this.logger.info('GenbankService.setFile succeeded', {
        plasmidId: input.plasmidId,
        replaced: Boolean(existing),
      });

      return toMeta(record);
    } catch (error) {
      if (error instanceof DomainError) {
        throw error;
      }
      this.logger.error('GenbankService.setFile failed', error as Error, {
        plasmidId: input.plasmidId,
      });
      throw new DomainError('DATABASE', 'Failed to store GenBank file', {
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Remove the plasmid's GenBank file
   */
  async deleteFile(plasmidId: string): Promise<void> {
    this.logger.info('GenbankService.deleteFile', { plasmidId });
    await this.requirePlasmid(plasmidId);

    try {
      const deleted = await getQueryBuilder()('genbank_files')
        .where('plasmidId', plasmidId)
        .delete();
      if (deleted === 0) {
        throw new DomainError('NOT_FOUND', 'There is no GenBank file to remove', { plasmidId });
      }
      this.logger.info('GenbankService.deleteFile succeeded', { plasmidId });
    } catch (error) {
      if (error instanceof DomainError) {
        throw error;
      }
      this.logger.error('GenbankService.deleteFile failed', error as Error, { plasmidId });
      throw new DomainError('DATABASE', 'Failed to remove GenBank file', {
        cause: error instanceof Error ? error.message : String(error),
        plasmidId,
      });
    }
  }
}
