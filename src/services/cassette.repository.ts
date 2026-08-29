/**
 * CassetteRepository
 * Data access layer for Cassette entities (genetic parts within a plasmid)
 * Extends generic Repository<T> pattern (ADR-0005)
 */

import { Repository, RepositoryOptions } from './repository';
import { Cassette } from '@domain/types';
import { getQueryBuilder } from '@infrastructure/query-builder';
import { Logger } from '@infrastructure/logger';

export class CassetteRepository extends Repository<Cassette> {
  constructor(logger?: Logger, options?: RepositoryOptions) {
    super(getQueryBuilder(), 'cassettes', { ...options, ...(logger && { logger }) });
  }

  /**
   * Get all cassettes for a plasmid, ordered by position
   */
  async getByPlasmid(plasmidId: string): Promise<Cassette[]> {
    this.logger.info('CassetteRepository.getByPlasmid', { plasmidId });

    try {
      const results = await this.qb(this.table)
        .where('plasmidId', plasmidId)
        .orderBy('position', 'asc');

      return (results as Cassette[]) || [];
    } catch (error) {
      this.logger.error('CassetteRepository.getByPlasmid failed', error as Error, { plasmidId });
      throw error;
    }
  }

  /**
   * Highest position currently used on a plasmid, or null when it has no cassettes.
   * Used to append new cassettes at the end by default.
   */
  async maxPosition(plasmidId: string): Promise<number | null> {
    this.logger.info('CassetteRepository.maxPosition', { plasmidId });

    try {
      const row = await this.qb(this.table)
        .where('plasmidId', plasmidId)
        .max('position as maxPosition')
        .first();

      const value = (row as { maxPosition: number | null } | undefined)?.maxPosition;
      return typeof value === 'number' ? value : null;
    } catch (error) {
      this.logger.error('CassetteRepository.maxPosition failed', error as Error, { plasmidId });
      throw error;
    }
  }
}
