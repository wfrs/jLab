/**
 * OrganismTargetService
 * Business logic for the target organism shortlist and its favourite subset.
 * Services own transactions (ADR-0005) and domain invariants (ADR-0007).
 *
 * Legacy parity (gmocu.py Settings tab):
 * - Targets are picked from the organism glossary (-ADDSELORGA-, the combo
 *   was fed by SELECT short_name FROM Organisms).
 * - Favourites could only be created by copying an existing target
 *   (-COPYFAVORGA-); here that is the `favourite` flag on the target row.
 *
 * Documented deviations (docs/plans/parity-evidence/organism-target-lists.md):
 * - Entries store the glossary full name (jlab's organism identity), not the
 *   short name.
 * - Duplicate entries are rejected (legacy allowed inserting the same
 *   organism repeatedly; duplicates serve no purpose in a shortlist).
 * - Removing a target removes its favourite status with it, so the legacy
 *   "Not all elements in Favourite organisms are present in Target
 *   organisms" error state cannot exist.
 */

import { randomUUID } from 'crypto';
import { OrganismTargetRepository } from './organism-target.repository';
import { OrganismRepository } from './organism.repository';
import { OrganismTarget, DomainError } from '@domain/types';
import { Logger } from '@infrastructure/logger';

/** SQLite hands booleans back as 0/1 — normalize at the service boundary */
function normalize(target: OrganismTarget): OrganismTarget {
  return { ...target, favourite: Boolean(target.favourite) };
}

export class OrganismTargetService {
  private repository: OrganismTargetRepository;
  private organismRepository: OrganismRepository;
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger || new Logger();
    this.repository = new OrganismTargetRepository(this.logger);
    this.organismRepository = new OrganismRepository(this.logger);
  }

  /**
   * List targets in insertion order (legacy listed by autoincrement id)
   */
  async listTargets(): Promise<OrganismTarget[]> {
    this.logger.info('OrganismTargetService.listTargets');

    try {
      return (await this.repository.listAll()).map(normalize);
    } catch (error) {
      this.logger.error('OrganismTargetService.listTargets failed', error as Error);
      throw new DomainError('DATABASE', 'Failed to list target organisms', {
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Favourite targets only, in list order — the batch-add set
   */
  async listFavourites(): Promise<OrganismTarget[]> {
    return (await this.listTargets()).filter((target) => target.favourite);
  }

  /**
   * Add an organism to the target list.
   * The organism must exist in the glossary (the legacy combo only offered
   * glossary entries); the entry stores the glossary full name.
   */
  async addTarget(data: { id?: string; organismName: string }): Promise<OrganismTarget> {
    this.logger.info('OrganismTargetService.addTarget', { organismName: data.organismName });

    const organism = await this.organismRepository.getByFullName((data.organismName || '').trim());
    if (!organism) {
      throw new DomainError('VALIDATION', `Organism not in glossary: ${data.organismName}`, {
        field: 'organismName',
        organismName: data.organismName,
      });
    }

    const existing = await this.repository.getByOrganismName(organism.fullName);
    if (existing) {
      throw new DomainError('VALIDATION', `"${organism.fullName}" is already in the target list`, {
        field: 'organismName',
        existingId: existing.id,
      });
    }

    try {
      const target = await this.repository.create({
        id: data.id ?? randomUUID(),
        organismName: organism.fullName,
        favourite: false,
      });

      this.logger.info('OrganismTargetService.addTarget succeeded', {
        id: target.id,
        organismName: target.organismName,
      });

      return normalize(target);
    } catch (error) {
      if (error instanceof DomainError) {
        throw error;
      }
      this.logger.error('OrganismTargetService.addTarget failed', error as Error, { data });
      throw new DomainError('DATABASE', 'Failed to add target organism', {
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Mark or unmark a target as favourite (legacy Copy button / favourite
   * list delete)
   */
  async setFavourite(id: string, favourite: boolean): Promise<OrganismTarget> {
    this.logger.info('OrganismTargetService.setFavourite', { id, favourite });

    const existing = await this.repository.getById(id);
    if (!existing) {
      throw new DomainError('NOT_FOUND', `Target organism not found: ${id}`, { id });
    }

    try {
      const updated = await this.repository.update(id, { favourite });
      return normalize(updated);
    } catch (error) {
      this.logger.error('OrganismTargetService.setFavourite failed', error as Error, { id });
      throw new DomainError('DATABASE', 'Failed to update target organism', {
        cause: error instanceof Error ? error.message : String(error),
        id,
      });
    }
  }

  /**
   * Remove a target (its favourite status goes with it)
   */
  async removeTarget(id: string): Promise<void> {
    this.logger.info('OrganismTargetService.removeTarget', { id });

    const existing = await this.repository.getById(id);
    if (!existing) {
      throw new DomainError('NOT_FOUND', `Target organism not found: ${id}`, { id });
    }

    try {
      await this.repository.delete(id);
      this.logger.info('OrganismTargetService.removeTarget succeeded', { id });
    } catch (error) {
      this.logger.error('OrganismTargetService.removeTarget failed', error as Error, { id });
      throw new DomainError('DATABASE', 'Failed to remove target organism', {
        cause: error instanceof Error ? error.message : String(error),
        id,
      });
    }
  }
}
