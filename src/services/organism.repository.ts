/**
 * OrganismRepository
 * Data access layer for the organism glossary (ADR-0005)
 */

import { Repository, RepositoryOptions } from './repository';
import { Organism } from '@domain/types';
import { getQueryBuilder } from '@infrastructure/query-builder';
import { Logger } from '@infrastructure/logger';

export class OrganismRepository extends Repository<Organism> {
  constructor(logger?: Logger, options?: RepositoryOptions) {
    super(getQueryBuilder(), 'organisms', { ...options, ...(logger && { logger }) });
  }

  /**
   * Get an organism by exact full name (case-insensitive)
   */
  async getByFullName(fullName: string): Promise<Organism | null> {
    this.logger.info('OrganismRepository.getByFullName', { fullName });

    try {
      const result = await this.qb(this.table)
        .whereRaw('LOWER(fullName) = LOWER(?)', [fullName])
        .first();
      return (result as Organism) || null;
    } catch (error) {
      this.logger.error('OrganismRepository.getByFullName failed', error as Error, { fullName });
      throw error;
    }
  }

  /**
   * List all organisms ordered by full name
   */
  async listAll(): Promise<Organism[]> {
    this.logger.info('OrganismRepository.listAll');

    try {
      const results = await this.qb(this.table).orderBy('fullName', 'asc');
      return (results as Organism[]) || [];
    } catch (error) {
      this.logger.error('OrganismRepository.listAll failed', error as Error);
      throw error;
    }
  }

  /**
   * Search organisms by full or short name (case-insensitive substring)
   */
  async search(query: string): Promise<Organism[]> {
    this.logger.info('OrganismRepository.search', { query });

    try {
      const searchQuery = `%${query}%`;
      const results = await this.qb(this.table)
        .whereRaw('LOWER(fullName) LIKE LOWER(?)', [searchQuery])
        .orWhereRaw('LOWER(shortName) LIKE LOWER(?)', [searchQuery])
        .orderBy('fullName', 'asc');

      return (results as Organism[]) || [];
    } catch (error) {
      this.logger.error('OrganismRepository.search failed', error as Error, { query });
      throw error;
    }
  }
}
