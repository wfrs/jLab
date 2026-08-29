/**
 * GmoRepository
 * Data access layer for GMO records (ADR-0005)
 */

import { Repository, RepositoryOptions } from './repository';
import { Gmo } from '@domain/types';
import { getQueryBuilder } from '@infrastructure/query-builder';
import { Logger } from '@infrastructure/logger';

export class GmoRepository extends Repository<Gmo> {
  constructor(logger?: Logger, options?: RepositoryOptions) {
    super(getQueryBuilder(), 'gmos', { ...options, ...(logger && { logger }) });
  }

  /**
   * Get all GMOs for a plasmid, newest generated first
   */
  async getByPlasmid(plasmidId: string): Promise<Gmo[]> {
    this.logger.info('GmoRepository.getByPlasmid', { plasmidId });

    try {
      const results = await this.qb(this.table)
        .where('plasmidId', plasmidId)
        .orderBy('dateGenerated', 'desc')
        .orderBy('organismName', 'asc');

      return (results as Gmo[]) || [];
    } catch (error) {
      this.logger.error('GmoRepository.getByPlasmid failed', error as Error, { plasmidId });
      throw error;
    }
  }
}
