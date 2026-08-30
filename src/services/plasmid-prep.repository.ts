/**
 * PlasmidPrepRepository
 * Data access for plasmid preparations (ADR-0005).
 *
 * A plasmid is re-prepped when its tube runs empty, so ordering is by
 * `preppedOn` descending — the first row is the current tube.
 */

import { Knex } from 'knex';
import { Repository, RepositoryOptions } from './repository';
import { PlasmidPrep } from '@domain/types';
import { getQueryBuilder } from '@infrastructure/query-builder';
import { Logger } from '@infrastructure/logger';

export class PlasmidPrepRepository extends Repository<PlasmidPrep> {
  constructor(logger?: Logger, options?: RepositoryOptions) {
    super(getQueryBuilder(), 'plasmid_preps', { ...options, ...(logger && { logger }) });
  }

  /** Every prep for one plasmid, newest first */
  async listForPlasmid(plasmidId: string): Promise<PlasmidPrep[]> {
    this.logger.debug('PlasmidPrepRepository.listForPlasmid', { plasmidId });

    try {
      const results = await this.qb(this.table)
        .where('plasmidId', plasmidId)
        .orderBy('preppedOn', 'desc')
        .orderBy('createdAt', 'desc');
      return (results as PlasmidPrep[]) || [];
    } catch (error) {
      this.logger.error('PlasmidPrepRepository.listForPlasmid failed', error as Error, {
        plasmidId,
      });
      throw error;
    }
  }

  /** The current prep for one plasmid, or null when it has never been prepped */
  async latestForPlasmid(plasmidId: string): Promise<PlasmidPrep | null> {
    const [latest] = await this.listForPlasmid(plasmidId);
    return latest ?? null;
  }

  /**
   * The current prep for each of many plasmids, in one query.
   * Used when building a label sheet, where fetching per plasmid would mean
   * one query per label.
   */
  async latestForPlasmids(plasmidIds: string[]): Promise<Map<string, PlasmidPrep>> {
    this.logger.debug('PlasmidPrepRepository.latestForPlasmids', { count: plasmidIds.length });

    if (plasmidIds.length === 0) {
      return new Map();
    }

    try {
      const rows = (await this.qb(this.table)
        .whereIn('plasmidId', plasmidIds)
        .orderBy('preppedOn', 'asc')
        .orderBy('createdAt', 'asc')) as PlasmidPrep[];

      // Ascending order means each later row overwrites the earlier one,
      // leaving the newest prep per plasmid.
      const latest = new Map<string, PlasmidPrep>();
      for (const row of rows) {
        latest.set(row.plasmidId, row);
      }
      return latest;
    } catch (error) {
      this.logger.error('PlasmidPrepRepository.latestForPlasmids failed', error as Error);
      throw error;
    }
  }

  /** Insert many preps inside a caller-owned transaction */
  async createManyInTransaction(trx: Knex.Transaction, preps: PlasmidPrep[]): Promise<void> {
    if (preps.length === 0) {
      return;
    }
    const now = new Date().toISOString();
    await trx(this.table).insert(
      preps.map((prep) => ({ ...prep, createdAt: now, updatedAt: now }))
    );
  }
}
