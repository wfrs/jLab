/**
 * PrimerRepository
 * Data access layer for PCR primers (ADR-0005)
 */

import { Repository, RepositoryOptions } from './repository';
import { Primer } from '@domain/types';
import { getQueryBuilder } from '@infrastructure/query-builder';
import { Logger } from '@infrastructure/logger';

export class PrimerRepository extends Repository<Primer> {
  constructor(logger?: Logger, options?: RepositoryOptions) {
    super(getQueryBuilder(), 'primers', { ...options, ...(logger && { logger }) });
  }

  /**
   * Get all primers on a plasmid, alphabetically
   */
  async getByPlasmid(plasmidId: string): Promise<Primer[]> {
    this.logger.info('PrimerRepository.getByPlasmid', { plasmidId });

    try {
      const results = await this.qb(this.table)
        .where('plasmidId', plasmidId)
        .orderBy('name', 'asc');

      return (results as Primer[]) || [];
    } catch (error) {
      this.logger.error('PrimerRepository.getByPlasmid failed', error as Error, { plasmidId });
      throw error;
    }
  }
}
