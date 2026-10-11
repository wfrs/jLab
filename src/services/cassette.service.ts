/**
 * CassetteService
 * Business logic orchestration for the Cassette domain
 * Services own all transactions (ADR-0005) and validate domain invariants (ADR-0007)
 */

import { CassetteRepository } from './cassette.repository';
import { PlasmidRepository } from './plasmid.repository';
import { Cassette, DomainError } from '@domain/types';
import { Logger } from '@infrastructure/logger';

const VALID_CASSETTE_TYPES: Cassette['type'][] = [
  'promoter',
  'terminator',
  'marker',
  'origin',
  'resistance',
  'other',
];

export interface CreateCassetteInput {
  id?: string;
  plasmidId: string;
  name: string;
  sequence?: string;
  type: Cassette['type'];
  /** Omitted → appended after the plasmid's current last cassette */
  position?: number;
}

export interface UpdateCassetteInput {
  name?: string;
  /** `null` clears the stored sequence */
  sequence?: string | null;
  type?: Cassette['type'];
  position?: number;
}

export class CassetteService {
  private repository: CassetteRepository;
  private plasmidRepository: PlasmidRepository;
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger || new Logger();
    this.repository = new CassetteRepository(this.logger);
    this.plasmidRepository = new PlasmidRepository(this.logger);
  }

  /**
   * Create a cassette on a plasmid
   */
  async createCassette(data: CreateCassetteInput): Promise<Cassette> {
    this.logger.info('CassetteService.createCassette', {
      plasmidId: data.plasmidId,
      name: data.name,
    });

    // Domain invariant: name is required
    if (!data.name || data.name.trim().length === 0) {
      throw new DomainError('VALIDATION', 'Cassette name is required', { field: 'name' });
    }

    // Domain invariant: type must be valid
    if (!VALID_CASSETTE_TYPES.includes(data.type)) {
      throw new DomainError('VALIDATION', `Invalid cassette type: ${data.type}`, {
        field: 'type',
        validValues: VALID_CASSETTE_TYPES,
      });
    }

    // Domain invariant: position must be non-negative if provided
    if (data.position !== undefined && data.position < 0) {
      throw new DomainError('VALIDATION', 'Cassette position cannot be negative', {
        field: 'position',
        value: data.position,
      });
    }

    // Domain invariant: parent plasmid must exist
    const plasmid = await this.plasmidRepository.getById(data.plasmidId);
    if (!plasmid) {
      throw new DomainError('NOT_FOUND', `Plasmid not found: ${data.plasmidId}`, {
        plasmidId: data.plasmidId,
      });
    }

    try {
      // Default position: append after the current last cassette
      let position = data.position;
      if (position === undefined) {
        const max = await this.repository.maxPosition(data.plasmidId);
        position = max === null ? 0 : max + 1;
      }

      const cassette = await this.repository.create({
        ...data,
        position,
      });

      this.logger.info('CassetteService.createCassette succeeded', {
        id: cassette.id,
        plasmidId: cassette.plasmidId,
      });

      return cassette;
    } catch (error) {
      if (error instanceof DomainError) {
        throw error;
      }
      this.logger.error('CassetteService.createCassette failed', error as Error, { data });
      throw new DomainError('DATABASE', 'Failed to create cassette', {
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Update an existing cassette
   */
  async updateCassette(id: string, updates: UpdateCassetteInput): Promise<Cassette> {
    this.logger.info('CassetteService.updateCassette', { id });

    // Domain invariant: cassette must exist
    const existing = await this.repository.getById(id);
    if (!existing) {
      throw new DomainError('NOT_FOUND', `Cassette not found: ${id}`, { id });
    }

    // Domain invariant: name cannot be empty if provided
    if (updates.name !== undefined && updates.name.trim().length === 0) {
      throw new DomainError('VALIDATION', 'Cassette name cannot be empty', { field: 'name' });
    }

    // Domain invariant: type must be valid if provided
    if (updates.type !== undefined && !VALID_CASSETTE_TYPES.includes(updates.type)) {
      throw new DomainError('VALIDATION', `Invalid cassette type: ${updates.type}`, {
        field: 'type',
        validValues: VALID_CASSETTE_TYPES,
      });
    }

    // Domain invariant: position must be non-negative if provided
    if (updates.position !== undefined && updates.position < 0) {
      throw new DomainError('VALIDATION', 'Cassette position cannot be negative', {
        field: 'position',
        value: updates.position,
      });
    }

    try {
      const updated = await this.repository.update(id, updates);

      this.logger.info('CassetteService.updateCassette succeeded', {
        id: updated.id,
        fields: Object.keys(updates),
      });

      return updated;
    } catch (error) {
      if (error instanceof DomainError) {
        throw error;
      }
      this.logger.error('CassetteService.updateCassette failed', error as Error, { id, updates });
      throw new DomainError('DATABASE', 'Failed to update cassette', {
        cause: error instanceof Error ? error.message : String(error),
        id,
      });
    }
  }

  /**
   * Delete a cassette
   */
  async deleteCassette(id: string): Promise<void> {
    this.logger.info('CassetteService.deleteCassette', { id });

    // Domain invariant: cassette must exist
    const existing = await this.repository.getById(id);
    if (!existing) {
      throw new DomainError('NOT_FOUND', `Cassette not found: ${id}`, { id });
    }

    try {
      await this.repository.delete(id);
      this.logger.info('CassetteService.deleteCassette succeeded', { id });
    } catch (error) {
      if (error instanceof DomainError) {
        throw error;
      }
      this.logger.error('CassetteService.deleteCassette failed', error as Error, { id });
      throw new DomainError('DATABASE', 'Failed to delete cassette', {
        cause: error instanceof Error ? error.message : String(error),
        id,
      });
    }
  }

  /** Every cassette in the library, by plasmid then position */
  async listAllCassettes(): Promise<Cassette[]> {
    this.logger.info('CassetteService.listAllCassettes');

    try {
      return await this.repository.listAll();
    } catch (error) {
      this.logger.error('CassetteService.listAllCassettes failed', error as Error);
      throw new DomainError('DATABASE', 'Failed to list cassettes', {
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * List cassettes on a plasmid (ordered by position)
   */
  async listPlasmidCassettes(plasmidId: string): Promise<Cassette[]> {
    this.logger.info('CassetteService.listPlasmidCassettes', { plasmidId });

    // Domain invariant: plasmid must exist (distinguishes "no cassettes" from "no plasmid")
    const plasmid = await this.plasmidRepository.getById(plasmidId);
    if (!plasmid) {
      throw new DomainError('NOT_FOUND', `Plasmid not found: ${plasmidId}`, { plasmidId });
    }

    try {
      return await this.repository.getByPlasmid(plasmidId);
    } catch (error) {
      this.logger.error('CassetteService.listPlasmidCassettes failed', error as Error, {
        plasmidId,
      });
      throw new DomainError('DATABASE', 'Failed to list cassettes', {
        cause: error instanceof Error ? error.message : String(error),
        plasmidId,
      });
    }
  }
}
