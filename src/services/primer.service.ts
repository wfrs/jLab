/**
 * PrimerService
 * Business logic for PCR primers on a plasmid (v2 entity — no legacy
 * counterpart; part of the locked v2 schema design). Sequences are stored
 * uppercase; gcPercent and tmCelsius are derived from the sequence on
 * every write (Wallace rule for short unambiguous oligos, else null).
 */

import { PrimerRepository } from './primer.repository';
import { PlasmidRepository } from './plasmid.repository';
import { Primer, DomainError } from '@domain/types';
import { gcPercent, isValidPrimerSequence, wallaceTm } from '@domain/primer-calc';
import { Logger } from '@infrastructure/logger';
import { randomUUID } from 'crypto';

export const PRIMER_SEQUENCE_MAX_LENGTH = 500;

export interface CreatePrimerInput {
  id?: string;
  plasmidId: string;
  name: string;
  sequence: string;
}

export interface UpdatePrimerInput {
  name?: string;
  sequence?: string;
}

/** Normalize + validate a sequence; returns the stored (uppercase) form */
function normalizeSequence(raw: string): string {
  const sequence = raw.trim().toUpperCase();
  if (sequence.length === 0) {
    throw new DomainError('VALIDATION', 'Primer sequence is required', { field: 'sequence' });
  }
  if (sequence.length > PRIMER_SEQUENCE_MAX_LENGTH) {
    throw new DomainError(
      'VALIDATION',
      `Primer sequence exceeds ${PRIMER_SEQUENCE_MAX_LENGTH} bases`,
      { field: 'sequence', length: sequence.length }
    );
  }
  if (!isValidPrimerSequence(sequence)) {
    throw new DomainError(
      'VALIDATION',
      'Primer sequence may only contain IUPAC nucleotide codes (ACGT + degenerate)',
      { field: 'sequence' }
    );
  }
  return sequence;
}

export class PrimerService {
  private repository: PrimerRepository;
  private plasmidRepository: PlasmidRepository;
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger || new Logger();
    this.repository = new PrimerRepository(this.logger);
    this.plasmidRepository = new PlasmidRepository(this.logger);
  }

  /**
   * Create a primer on a plasmid
   */
  async createPrimer(data: CreatePrimerInput): Promise<Primer> {
    this.logger.info('PrimerService.createPrimer', {
      plasmidId: data.plasmidId,
      name: data.name,
    });

    if (!data.name || data.name.trim().length === 0) {
      throw new DomainError('VALIDATION', 'Primer name is required', { field: 'name' });
    }
    const sequence = normalizeSequence(data.sequence);

    const plasmid = await this.plasmidRepository.getById(data.plasmidId);
    if (!plasmid) {
      throw new DomainError('NOT_FOUND', `Plasmid not found: ${data.plasmidId}`, {
        plasmidId: data.plasmidId,
      });
    }

    try {
      const tm = wallaceTm(sequence);
      const primer = await this.repository.create({
        id: data.id || randomUUID(),
        plasmidId: data.plasmidId,
        name: data.name.trim(),
        sequence,
        gcPercent: gcPercent(sequence),
        ...(tm !== null && { tmCelsius: tm }),
      });

      this.logger.info('PrimerService.createPrimer succeeded', {
        id: primer.id,
        plasmidId: primer.plasmidId,
      });

      return primer;
    } catch (error) {
      if (error instanceof DomainError) {
        throw error;
      }
      this.logger.error('PrimerService.createPrimer failed', error as Error, { data });
      throw new DomainError('DATABASE', 'Failed to create primer', {
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Update a primer; a sequence change recomputes gcPercent/tmCelsius
   */
  async updatePrimer(id: string, updates: UpdatePrimerInput): Promise<Primer> {
    this.logger.info('PrimerService.updatePrimer', { id });

    const existing = await this.repository.getById(id);
    if (!existing) {
      throw new DomainError('NOT_FOUND', `Primer not found: ${id}`, { id });
    }

    if (updates.name !== undefined && updates.name.trim().length === 0) {
      throw new DomainError('VALIDATION', 'Primer name cannot be empty', { field: 'name' });
    }

    const patch: Record<string, unknown> = {};
    if (updates.name !== undefined) {
      patch.name = updates.name.trim();
    }
    if (updates.sequence !== undefined) {
      const sequence = normalizeSequence(updates.sequence);
      patch.sequence = sequence;
      patch.gcPercent = gcPercent(sequence);
      patch.tmCelsius = wallaceTm(sequence);
    }

    try {
      const updated = await this.repository.update(id, patch);

      this.logger.info('PrimerService.updatePrimer succeeded', {
        id: updated.id,
        fields: Object.keys(patch),
      });

      return updated;
    } catch (error) {
      if (error instanceof DomainError) {
        throw error;
      }
      this.logger.error('PrimerService.updatePrimer failed', error as Error, { id, updates });
      throw new DomainError('DATABASE', 'Failed to update primer', {
        cause: error instanceof Error ? error.message : String(error),
        id,
      });
    }
  }

  /**
   * Delete a primer
   */
  async deletePrimer(id: string): Promise<void> {
    this.logger.info('PrimerService.deletePrimer', { id });

    const existing = await this.repository.getById(id);
    if (!existing) {
      throw new DomainError('NOT_FOUND', `Primer not found: ${id}`, { id });
    }

    try {
      await this.repository.delete(id);
      this.logger.info('PrimerService.deletePrimer succeeded', { id });
    } catch (error) {
      this.logger.error('PrimerService.deletePrimer failed', error as Error, { id });
      throw new DomainError('DATABASE', 'Failed to delete primer', {
        cause: error instanceof Error ? error.message : String(error),
        id,
      });
    }
  }

  /**
   * List primers on a plasmid (alphabetical)
   */
  async listPlasmidPrimers(plasmidId: string): Promise<Primer[]> {
    this.logger.info('PrimerService.listPlasmidPrimers', { plasmidId });

    // Distinguish "no primers" from "no plasmid"
    const plasmid = await this.plasmidRepository.getById(plasmidId);
    if (!plasmid) {
      throw new DomainError('NOT_FOUND', `Plasmid not found: ${plasmidId}`, { plasmidId });
    }

    try {
      return await this.repository.getByPlasmid(plasmidId);
    } catch (error) {
      this.logger.error('PrimerService.listPlasmidPrimers failed', error as Error, { plasmidId });
      throw new DomainError('DATABASE', 'Failed to list primers', {
        cause: error instanceof Error ? error.message : String(error),
        plasmidId,
      });
    }
  }
}
