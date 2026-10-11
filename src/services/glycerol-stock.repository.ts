/**
 * GlycerolStockRepository
 * Data access for frozen bacterial stocks (ADR-0005).
 *
 * Stock IDs are the lab's own identifiers ('CJM1', 'AJM5.1') and are unique,
 * so most lookups go through `getByStockId` rather than the surrogate id.
 */

import { Repository, RepositoryOptions } from './repository';
import { GlycerolStock } from '@domain/types';
import { getQueryBuilder } from '@infrastructure/query-builder';
import { Logger } from '@infrastructure/logger';

export class GlycerolStockRepository extends Repository<GlycerolStock> {
  constructor(logger?: Logger, options?: RepositoryOptions) {
    super(getQueryBuilder(), 'glycerol_stocks', { ...options, ...(logger && { logger }) });
  }

  /** Look up by the lab's own identifier */
  async getByStockId(stockId: string): Promise<GlycerolStock | null> {
    this.logger.debug('GlycerolStockRepository.getByStockId', { stockId });

    try {
      const result = await this.qb(this.table).where('stockId', stockId).first();
      return (result as GlycerolStock) || null;
    } catch (error) {
      this.logger.error('GlycerolStockRepository.getByStockId failed', error as Error, { stockId });
      throw error;
    }
  }

  /** Every stock made from one plasmid — an E. coli one, and any Agrobacterium ones */
  async listByPlasmid(plasmidId: string): Promise<GlycerolStock[]> {
    this.logger.debug('GlycerolStockRepository.listByPlasmid', { plasmidId });

    try {
      const results = await this.qb(this.table).where('plasmidId', plasmidId).orderBy('stockId');
      return (results as GlycerolStock[]) || [];
    } catch (error) {
      this.logger.error('GlycerolStockRepository.listByPlasmid failed', error as Error, {
        plasmidId,
      });
      throw error;
    }
  }

  /** Every stock in the freezer, for the plasmid table's stock columns */
  async listAll(): Promise<GlycerolStock[]> {
    this.logger.debug('GlycerolStockRepository.listAll');

    try {
      const results = await this.qb(this.table).orderBy('stockId');
      return (results as GlycerolStock[]) || [];
    } catch (error) {
      this.logger.error('GlycerolStockRepository.listAll failed', error as Error);
      throw error;
    }
  }

  /** Every stock belonging to any of these plasmids, in one query */
  async listByPlasmids(plasmidIds: string[]): Promise<GlycerolStock[]> {
    if (plasmidIds.length === 0) {
      return [];
    }
    try {
      const results = await this.qb(this.table).whereIn('plasmidId', plasmidIds).orderBy('stockId');
      return (results as GlycerolStock[]) || [];
    } catch (error) {
      this.logger.error('GlycerolStockRepository.listByPlasmids failed', error as Error);
      throw error;
    }
  }

  /** Stocks by id, for building a label sheet */
  async listByIds(ids: string[]): Promise<GlycerolStock[]> {
    if (ids.length === 0) {
      return [];
    }
    try {
      const results = await this.qb(this.table).whereIn('id', ids);
      return (results as GlycerolStock[]) || [];
    } catch (error) {
      this.logger.error('GlycerolStockRepository.listByIds failed', error as Error);
      throw error;
    }
  }
}
