/**
 * OrganismTargetRepository
 * Data access layer for the target organism shortlist (ADR-0005)
 */

import { Repository, RepositoryOptions } from './repository';
import { OrganismTarget } from '@domain/types';
import { getQueryBuilder } from '@infrastructure/query-builder';
import { Logger } from '@infrastructure/logger';

export class OrganismTargetRepository extends Repository<OrganismTarget> {
  constructor(logger?: Logger, options?: RepositoryOptions) {
    super(getQueryBuilder(), 'organism_targets', { ...options, ...(logger && { logger }) });
  }

  /**
   * List all targets in insertion order (legacy listed by autoincrement id);
   * name breaks ties for same-instant inserts.
   */
  async listAll(): Promise<OrganismTarget[]> {
    this.logger.info('OrganismTargetRepository.listAll');

    try {
      const results = await this.qb(this.table)
        .orderBy('createdAt', 'asc')
        .orderBy('organismName', 'asc');
      return (results as OrganismTarget[]) || [];
    } catch (error) {
      this.logger.error('OrganismTargetRepository.listAll failed', error as Error);
      throw error;
    }
  }

  /**
   * Get a target by exact organism name (case-insensitive, matching how the
   * organism glossary resolves full names)
   */
  async getByOrganismName(organismName: string): Promise<OrganismTarget | null> {
    this.logger.info('OrganismTargetRepository.getByOrganismName', { organismName });

    try {
      const result = await this.qb(this.table)
        .whereRaw('LOWER(organismName) = LOWER(?)', [organismName])
        .first();
      return (result as OrganismTarget) || null;
    } catch (error) {
      this.logger.error('OrganismTargetRepository.getByOrganismName failed', error as Error, {
        organismName,
      });
      throw error;
    }
  }
}
