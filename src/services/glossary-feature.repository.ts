/**
 * GlossaryFeatureRepository
 * Data access layer for the nucleic-acid feature glossary (ADR-0005)
 */

import { Repository, RepositoryOptions } from './repository';
import { GlossaryFeature } from '@domain/types';
import { getQueryBuilder } from '@infrastructure/query-builder';
import { Logger } from '@infrastructure/logger';

export class GlossaryFeatureRepository extends Repository<GlossaryFeature> {
  constructor(logger?: Logger, options?: RepositoryOptions) {
    super(getQueryBuilder(), 'glossary_features', { ...options, ...(logger && { logger }) });
  }

  /**
   * Get a glossary feature by exact annotation.
   * Case-sensitive — cassette token resolution is case-sensitive in legacy GMOCU.
   */
  async getByAnnotation(annotation: string): Promise<GlossaryFeature | null> {
    this.logger.info('GlossaryFeatureRepository.getByAnnotation', { annotation });

    try {
      const result = await this.qb(this.table).where('annotation', annotation).first();
      return (result as GlossaryFeature) || null;
    } catch (error) {
      this.logger.error('GlossaryFeatureRepository.getByAnnotation failed', error as Error, {
        annotation,
      });
      throw error;
    }
  }

  /**
   * List all glossary features ordered by annotation
   */
  async listAll(): Promise<GlossaryFeature[]> {
    this.logger.info('GlossaryFeatureRepository.listAll');

    try {
      const results = await this.qb(this.table).orderBy('annotation', 'asc');
      return (results as GlossaryFeature[]) || [];
    } catch (error) {
      this.logger.error('GlossaryFeatureRepository.listAll failed', error as Error);
      throw error;
    }
  }

  /**
   * Search glossary features by annotation or alias (case-insensitive substring)
   */
  async search(query: string): Promise<GlossaryFeature[]> {
    this.logger.info('GlossaryFeatureRepository.search', { query });

    try {
      const searchQuery = `%${query}%`;
      const results = await this.qb(this.table)
        .whereRaw('LOWER(annotation) LIKE LOWER(?)', [searchQuery])
        .orWhereRaw('LOWER(alias) LIKE LOWER(?)', [searchQuery])
        .orderBy('annotation', 'asc');

      return (results as GlossaryFeature[]) || [];
    } catch (error) {
      this.logger.error('GlossaryFeatureRepository.search failed', error as Error, { query });
      throw error;
    }
  }
}
