/**
 * PlasmidRepository
 * Data access layer for Plasmid entities
 * Extends generic Repository<T> pattern (ADR-0005)
 */

import { Repository, RepositoryOptions } from './repository';
import { Plasmid } from '@domain/types';
import { getQueryBuilder } from '@infrastructure/query-builder';
import { Logger } from '@infrastructure/logger';

export class PlasmidRepository extends Repository<Plasmid> {
  constructor(logger?: Logger, options?: RepositoryOptions) {
    super(getQueryBuilder(), 'plasmids', { ...options, ...(logger && { logger }) });
  }

  /**
   * Get all plasmids for a specific project
   * Uses project_plasmids junction table to find plasmids
   */
  async getByProject(projectId: string): Promise<Plasmid[]> {
    this.logger.info('PlasmidRepository.getByProject', { projectId });

    try {
      const results = await this.qb('plasmids')
        .innerJoin('project_plasmids', 'plasmids.id', 'project_plasmids.plasmidId')
        .where('project_plasmids.projectId', projectId)
        .select('plasmids.*')
        .orderBy('plasmids.name', 'asc');

      return (results as Plasmid[]) || [];
    } catch (error) {
      this.logger.error('PlasmidRepository.getByProject failed', error as Error, {
        projectId,
      });
      throw error;
    }
  }

  /**
   * Get a plasmid by exact name (case-insensitive)
   * Used for uniqueness checks — unlike search(), this does NOT match substrings
   */
  async getByName(name: string): Promise<Plasmid | null> {
    this.logger.info('PlasmidRepository.getByName', { name });

    try {
      const result = await this.qb(this.table).whereRaw('LOWER(name) = LOWER(?)', [name]).first();

      return (result as Plasmid) || null;
    } catch (error) {
      this.logger.error('PlasmidRepository.getByName failed', error as Error, { name });
      throw error;
    }
  }

  /**
   * Search plasmids by name or description
   * Case-insensitive partial match
   */
  async search(query: string): Promise<Plasmid[]> {
    this.logger.info('PlasmidRepository.search', { query });

    try {
      const searchQuery = `%${query}%`;
      const results = await this.qb(this.table)
        .whereRaw('LOWER(name) LIKE LOWER(?)', [searchQuery])
        .orWhereRaw('LOWER(description) LIKE LOWER(?)', [searchQuery])
        .orderBy('name', 'asc');

      return (results as Plasmid[]) || [];
    } catch (error) {
      this.logger.error('PlasmidRepository.search failed', error as Error, { query });
      throw error;
    }
  }

  /**
   * Get paginated list of plasmids with total count
   */
  async paginatedList(
    limit: number = 20,
    offset: number = 0
  ): Promise<{ data: Plasmid[]; total: number }> {
    this.logger.info('PlasmidRepository.paginatedList', { limit, offset });

    try {
      const total = await this.count();
      const data = await this.qb(this.table).orderBy('name', 'asc').limit(limit).offset(offset);

      return {
        data: (data as Plasmid[]) || [],
        total,
      };
    } catch (error) {
      this.logger.error('PlasmidRepository.paginatedList failed', error as Error, {
        limit,
        offset,
      });
      throw error;
    }
  }

  /**
   * Get plasmids by status
   */
  async getByStatus(status: Plasmid['status']): Promise<Plasmid[]> {
    this.logger.info('PlasmidRepository.getByStatus', { status });

    try {
      const results = await this.qb(this.table).where('status', status).orderBy('name', 'asc');

      return (results as Plasmid[]) || [];
    } catch (error) {
      this.logger.error('PlasmidRepository.getByStatus failed', error as Error, { status });
      throw error;
    }
  }

  /**
   * Get child plasmids (derived from parent)
   */
  async getChildren(parentId: string): Promise<Plasmid[]> {
    this.logger.info('PlasmidRepository.getChildren', { parentId });

    try {
      const results = await this.qb(this.table).where('parentId', parentId).orderBy('name', 'asc');

      return (results as Plasmid[]) || [];
    } catch (error) {
      this.logger.error('PlasmidRepository.getChildren failed', error as Error, { parentId });
      throw error;
    }
  }

  /**
   * Get all plasmids with their project associations
   */
  async getAllWithProjects(): Promise<(Plasmid & { projectIds: string[] })[]> {
    this.logger.info('PlasmidRepository.getAllWithProjects');

    try {
      // Get all plasmids
      const plasmids = await this.qb(this.table).orderBy('name', 'asc');

      // For each plasmid, fetch associated projects
      const results = await Promise.all(
        (plasmids as Plasmid[]).map(async (plasmid) => {
          const projects = await this.qb('project_plasmids')
            .where('plasmidId', plasmid.id)
            .select('projectId');

          return {
            ...plasmid,
            projectIds: projects.map((p) => p.projectId),
          };
        })
      );

      return results;
    } catch (error) {
      this.logger.error('PlasmidRepository.getAllWithProjects failed', error as Error);
      throw error;
    }
  }
}
