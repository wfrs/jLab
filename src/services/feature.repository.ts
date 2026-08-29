/**
 * FeatureRepository
 * Data access layer for per-plasmid sequence features (ADR-0005)
 */

import { Repository, RepositoryOptions } from './repository';
import { Feature } from '@domain/types';
import { getQueryBuilder } from '@infrastructure/query-builder';
import { Logger } from '@infrastructure/logger';

export class FeatureRepository extends Repository<Feature> {
  constructor(logger?: Logger, options?: RepositoryOptions) {
    super(getQueryBuilder(), 'features', { ...options, ...(logger && { logger }) });
  }

  /**
   * Get all features on a plasmid, ordered by position
   */
  async getByPlasmid(plasmidId: string): Promise<Feature[]> {
    this.logger.info('FeatureRepository.getByPlasmid', { plasmidId });

    try {
      const results = await this.qb(this.table)
        .where('plasmidId', plasmidId)
        .orderBy('startPos', 'asc')
        .orderBy('endPos', 'asc');

      return (results as Feature[]) || [];
    } catch (error) {
      this.logger.error('FeatureRepository.getByPlasmid failed', error as Error, { plasmidId });
      throw error;
    }
  }
}
