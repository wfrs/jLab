/**
 * LabelService
 * Assembles label payloads and records what was printed.
 * Services own transactions (ADR-0005) and domain invariants (ADR-0007).
 *
 * A label is a join, not a stored thing: the accession and construct name come
 * from the plasmid, the operator, date and concentration from its *newest*
 * prep. Julia re-preps when a tube runs empty, so the label must always carry
 * the current tube's numbers — pJM0021 has a printed label reading 21.2 ng/µL
 * for a construct that no longer holds that number, which is exactly the drift
 * this removes.
 */

import { randomUUID } from 'crypto';
import { LabelPrintRepository } from './label-print.repository';
import { GlycerolStockRepository } from './glycerol-stock.repository';
import { PlasmidPrepRepository } from './plasmid-prep.repository';
import { PlasmidRepository } from './plasmid.repository';
import { LabelPrint, DomainError } from '@domain/types';
import { GlycerolLabelData, PlasmidLabelData } from '@domain/label-content';
import { compareStockIds } from '@domain/lab-normalization';
import { Logger } from '@infrastructure/logger';
import { getQueryBuilder } from '@infrastructure/query-builder';

/** A plasmid label plus the id it was built from, so the UI can key on it */
export interface PlasmidLabelPayload extends PlasmidLabelData {
  plasmidId: string;
  /** ISO timestamp of the last time this label was printed from jlab */
  lastPrintedAt?: string;
}

/** One past sheet: everything printed together carries one timestamp */
export interface PrintBatch {
  kind: LabelPrint['kind'];
  printedAt: string;
  count: number;
}

/** A glycerol label plus the surrogate id it was built from */
export interface GlycerolLabelPayload extends GlycerolLabelData {
  id: string;
  lastPrintedAt?: string;
}

export class LabelService {
  private plasmidRepository: PlasmidRepository;
  private prepRepository: PlasmidPrepRepository;
  private printRepository: LabelPrintRepository;
  private stockRepository: GlycerolStockRepository;
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger || new Logger();
    this.plasmidRepository = new PlasmidRepository(this.logger);
    this.prepRepository = new PlasmidPrepRepository(this.logger);
    this.printRepository = new LabelPrintRepository(this.logger);
    this.stockRepository = new GlycerolStockRepository(this.logger);
  }

  /**
   * Build one label per requested plasmid, ordered by accession.
   *
   * Ordering is by name rather than by the order ids arrived in: a sheet is
   * cut apart and filed, and accession order is how the boxes are arranged.
   *
   * An unknown id is an error rather than a silently missing label — a short
   * sheet is not something you notice until the tubes are already labelled.
   */
  async buildPlasmidLabels(plasmidIds: string[]): Promise<PlasmidLabelPayload[]> {
    this.logger.info('LabelService.buildPlasmidLabels', { count: plasmidIds.length });

    if (plasmidIds.length === 0) {
      throw new DomainError('VALIDATION', 'At least one plasmid id is required', {
        field: 'ids',
      });
    }

    const unique = Array.from(new Set(plasmidIds));
    const plasmids = await this.plasmidRepository.listByIds(unique);

    const found = new Set(plasmids.map((plasmid) => plasmid.id));
    const missing = unique.filter((id) => !found.has(id));
    if (missing.length > 0) {
      throw new DomainError('NOT_FOUND', `Unknown plasmid(s): ${missing.join(', ')}`, {
        plasmidIds: missing,
      });
    }

    const [latestPreps, lastPrinted] = await Promise.all([
      this.prepRepository.latestForPlasmids(unique),
      this.printRepository.lastPrintedFor('plasmid', unique),
    ]);

    // listByIds already orders by name ascending
    return plasmids.map((plasmid) => {
      const prep = latestPreps.get(plasmid.id);
      const printedAt = lastPrinted.get(plasmid.id);
      return {
        plasmidId: plasmid.id,
        accession: plasmid.name,
        constructName: plasmid.constructName ?? null,
        operatorInitials: prep?.operatorInitials ?? null,
        preppedOn: prep?.preppedOn ?? null,
        concentrationNgUl: prep?.concentrationNgUl ?? null,
        ...(printedAt && { lastPrintedAt: printedAt }),
      };
    });
  }

  /**
   * Build one label per requested glycerol stock, ordered by stock ID.
   *
   * The construct comes from the linked plasmid where there is one, and from
   * the stock's own `constructLabel` where the plasmid is not in jlab — the
   * Agrobacterium sheet names constructs that have no plasmid record.
   */
  async buildGlycerolLabels(stockIds: string[]): Promise<GlycerolLabelPayload[]> {
    this.logger.info('LabelService.buildGlycerolLabels', { count: stockIds.length });

    if (stockIds.length === 0) {
      throw new DomainError('VALIDATION', 'At least one stock id is required', { field: 'ids' });
    }

    const unique = Array.from(new Set(stockIds));
    const stocks = await this.stockRepository.listByIds(unique);

    const found = new Set(stocks.map((stock) => stock.id));
    const missing = unique.filter((id) => !found.has(id));
    if (missing.length > 0) {
      throw new DomainError('NOT_FOUND', `Unknown glycerol stock(s): ${missing.join(', ')}`, {
        stockIds: missing,
      });
    }

    const plasmidIds = Array.from(
      new Set(stocks.map((stock) => stock.plasmidId).filter((id): id is string => Boolean(id)))
    );
    const [plasmids, lastPrinted] = await Promise.all([
      this.plasmidRepository.listByIds(plasmidIds),
      this.printRepository.lastPrintedFor('glycerol', unique),
    ]);
    const byPlasmidId = new Map(plasmids.map((plasmid) => [plasmid.id, plasmid]));

    return stocks
      .map((stock) => {
        const plasmid = stock.plasmidId ? byPlasmidId.get(stock.plasmidId) : undefined;
        const printedAt = lastPrinted.get(stock.id);
        return {
          id: stock.id,
          stockId: stock.stockId,
          organism: stock.organism,
          strain: stock.strain,
          operatorInitials: stock.operatorInitials ?? null,
          // The stock's own name wins over the plasmid's. The two sheets
          // disagree — AJM9 carries `pPXm_35SprFL-sGeNL(C)` while pJM0152 is
          // named `pPXm_35S_sNL(C)` — and the printed label uses the stock's,
          // which is the name written on that tube. A data-quality check
          // surfaces the disagreement rather than the renderer hiding it.
          constructName: stock.constructLabel ?? plasmid?.constructName ?? null,
          accession: plasmid?.name ?? null,
          madeOn: stock.madeOn ?? null,
          ...(printedAt && { lastPrintedAt: printedAt }),
        };
      })
      .sort((a, b) => compareStockIds(a.stockId, b.stockId));
  }

  /**
   * Record that a sheet was generated. One row per label, in one transaction,
   * so a print is either fully recorded or not at all.
   */
  async recordPrints(kind: LabelPrint['kind'], targetIds: string[]): Promise<LabelPrint[]> {
    this.logger.info('LabelService.recordPrints', { kind, count: targetIds.length });

    if (targetIds.length === 0) {
      throw new DomainError('VALIDATION', 'At least one target id is required', {
        field: 'ids',
      });
    }

    const printedAt = new Date().toISOString();
    const prints: LabelPrint[] = Array.from(new Set(targetIds)).map((targetId) => ({
      id: randomUUID(),
      kind,
      targetId,
      printedAt,
      createdAt: new Date(),
    }));

    const db = getQueryBuilder();
    await db.transaction(async (trx) => {
      await this.printRepository.createManyInTransaction(trx, prints);
    });

    return prints;
  }

  /**
   * Past sheets, newest first, so one can be printed again.
   *
   * A sheet gets lost, or gets cut wrong, and the Word workflow's answer was to
   * retype it. Here the set is already recorded.
   */
  async listPrintBatches(limit = 20): Promise<PrintBatch[]> {
    const batches = await this.printRepository.listBatches(limit);
    return batches.map((batch) => ({
      kind: batch.kind as LabelPrint['kind'],
      printedAt: batch.printedAt,
      count: batch.count,
    }));
  }

  /** The ids on one past sheet, for reprinting it */
  async listPrintBatchTargets(kind: LabelPrint['kind'], printedAt: string): Promise<string[]> {
    return this.printRepository.listBatchTargets(kind, printedAt);
  }

  /** Print history for one target, newest first */
  async listPrints(kind: LabelPrint['kind'], targetId: string): Promise<LabelPrint[]> {
    return this.printRepository.listForTarget(kind, targetId);
  }
}
