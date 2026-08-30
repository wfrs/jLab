/**
 * LabelPrintRepository
 * Data access for the record of label sheets jlab has generated (ADR-0005).
 *
 * The Word workflow kept no reliable record of what had been printed — some
 * labels were printed and never saved back into the document — so this table
 * exists to answer "did I already print that one?".
 */

import { Knex } from 'knex';
import { Repository, RepositoryOptions } from './repository';
import { LabelPrint } from '@domain/types';
import { getQueryBuilder } from '@infrastructure/query-builder';
import { Logger } from '@infrastructure/logger';

export class LabelPrintRepository extends Repository<LabelPrint> {
  constructor(logger?: Logger, options?: RepositoryOptions) {
    super(getQueryBuilder(), 'label_prints', { ...options, ...(logger && { logger }) });
  }

  /** Every print of one target, newest first */
  async listForTarget(kind: LabelPrint['kind'], targetId: string): Promise<LabelPrint[]> {
    this.logger.debug('LabelPrintRepository.listForTarget', { kind, targetId });

    try {
      const results = await this.qb(this.table)
        .where({ kind, targetId })
        .orderBy('printedAt', 'desc');
      return (results as LabelPrint[]) || [];
    } catch (error) {
      this.logger.error('LabelPrintRepository.listForTarget failed', error as Error, {
        kind,
        targetId,
      });
      throw error;
    }
  }

  /**
   * When each of many targets was last printed, in one query.
   * Feeds the "already printed" hint beside a selection.
   */
  async lastPrintedFor(
    kind: LabelPrint['kind'],
    targetIds: string[]
  ): Promise<Map<string, string>> {
    if (targetIds.length === 0) {
      return new Map();
    }

    try {
      const rows = (await this.qb(this.table)
        .where('kind', kind)
        .whereIn('targetId', targetIds)
        .orderBy('printedAt', 'asc')) as LabelPrint[];

      // Ascending, so each later row overwrites the earlier one
      const last = new Map<string, string>();
      for (const row of rows) {
        last.set(row.targetId, row.printedAt);
      }
      return last;
    } catch (error) {
      this.logger.error('LabelPrintRepository.lastPrintedFor failed', error as Error);
      throw error;
    }
  }

  /**
   * Past sheets, newest first.
   *
   * `recordPrints` stamps every label in one sheet with the same `printedAt`,
   * so a batch is exactly the rows sharing a kind and a timestamp — no extra
   * column needed to group them.
   */
  async listBatches(limit: number): Promise<{ kind: string; printedAt: string; count: number }[]> {
    this.logger.debug('LabelPrintRepository.listBatches', { limit });

    try {
      const rows = (await this.qb(this.table)
        .select('kind', 'printedAt')
        .count({ count: '*' })
        .groupBy('kind', 'printedAt')
        .orderBy('printedAt', 'desc')
        .limit(limit)) as { kind: string; printedAt: string; count: number }[];

      return rows.map((row) => ({ ...row, count: Number(row.count) }));
    } catch (error) {
      this.logger.error('LabelPrintRepository.listBatches failed', error as Error);
      throw error;
    }
  }

  /** The targets of one past sheet */
  async listBatchTargets(kind: LabelPrint['kind'], printedAt: string): Promise<string[]> {
    try {
      const rows = (await this.qb(this.table).where({ kind, printedAt }).select('targetId')) as {
        targetId: string;
      }[];
      return rows.map((row) => row.targetId);
    } catch (error) {
      this.logger.error('LabelPrintRepository.listBatchTargets failed', error as Error);
      throw error;
    }
  }

  /** Insert many print records inside a caller-owned transaction */
  async createManyInTransaction(trx: Knex.Transaction, prints: LabelPrint[]): Promise<void> {
    if (prints.length === 0) {
      return;
    }
    await trx(this.table).insert(prints);
  }
}
