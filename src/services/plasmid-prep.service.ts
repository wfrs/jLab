/**
 * PlasmidPrepService
 * Business logic for plasmid preparations.
 * Services own transactions (ADR-0005) and domain invariants (ADR-0007).
 *
 * Preps are recorded in batches because that is how the bench works: a run of
 * minipreps shares one date and one operator, and the concentrations are read
 * off the Nanodrop in a single sitting. pJM0084-pJM0096 all carry 06.11.24 in
 * the lab's spreadsheet; pJM0153-pJM0161 all carry 12.03.25.
 *
 * Recording date, operator and concentration as one row is the point. The
 * spreadsheet keeps one of each per plasmid and updating them by hand is three
 * separate edits, which left pJM0055 holding an old date beside a new
 * concentration — a pairing that never existed at the bench.
 */

import { randomUUID } from 'crypto';
import { PlasmidPrepRepository } from './plasmid-prep.repository';
import { PlasmidRepository } from './plasmid.repository';
import { PlasmidPrep, DomainError } from '@domain/types';
import { Logger } from '@infrastructure/logger';
import { getQueryBuilder } from '@infrastructure/query-builder';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface PrepEntry {
  plasmidId: string;
  /** Absent when prepped but not yet measured */
  concentrationNgUl?: number | null;
}

export interface RecordPrepBatchInput {
  /** ISO date shared by the whole batch */
  preppedOn: string;
  /** Initials shared by the whole batch — 'JM', 'INA', 'LN' */
  operatorInitials: string;
  entries: PrepEntry[];
}

function assertIsoDate(value: string, field: string): void {
  if (!ISO_DATE_PATTERN.test(value)) {
    throw new DomainError('VALIDATION', `${field} must be an ISO date (YYYY-MM-DD)`, {
      field,
      value,
    });
  }
}

export class PlasmidPrepService {
  private repository: PlasmidPrepRepository;
  private plasmidRepository: PlasmidRepository;
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger || new Logger();
    this.repository = new PlasmidPrepRepository(this.logger);
    this.plasmidRepository = new PlasmidRepository(this.logger);
  }

  /** Every prep for a plasmid, newest first */
  async listForPlasmid(plasmidId: string): Promise<PlasmidPrep[]> {
    return this.repository.listForPlasmid(plasmidId);
  }

  /** The current tube, or null when the plasmid has never been prepped */
  async latestForPlasmid(plasmidId: string): Promise<PlasmidPrep | null> {
    return this.repository.latestForPlasmid(plasmidId);
  }

  async latestForPlasmids(plasmidIds: string[]): Promise<Map<string, PlasmidPrep>> {
    return this.repository.latestForPlasmids(plasmidIds);
  }

  /** The current tube of every plasmid that has been prepped */
  async latestForAllPlasmids(): Promise<Map<string, PlasmidPrep>> {
    return this.repository.latestForAll();
  }

  /**
   * Record one prep per selected plasmid, sharing a date and operator.
   * All-or-nothing: an unknown plasmid or a bad concentration rolls the whole
   * batch back, so a half-recorded prep session cannot exist.
   */
  async recordBatch(input: RecordPrepBatchInput): Promise<PlasmidPrep[]> {
    this.logger.info('PlasmidPrepService.recordBatch', {
      preppedOn: input.preppedOn,
      operatorInitials: input.operatorInitials,
      count: input.entries.length,
    });

    assertIsoDate(input.preppedOn, 'preppedOn');

    const initials = input.operatorInitials.trim();
    if (initials.length === 0) {
      throw new DomainError('VALIDATION', 'operatorInitials is required', {
        field: 'operatorInitials',
      });
    }

    if (input.entries.length === 0) {
      throw new DomainError('VALIDATION', 'At least one plasmid is required', {
        field: 'entries',
      });
    }

    const seen = new Set<string>();
    for (const entry of input.entries) {
      if (seen.has(entry.plasmidId)) {
        throw new DomainError('VALIDATION', 'A plasmid appears twice in one prep batch', {
          field: 'entries',
          plasmidId: entry.plasmidId,
        });
      }
      seen.add(entry.plasmidId);

      const concentration = entry.concentrationNgUl;
      if (concentration !== undefined && concentration !== null) {
        if (!Number.isFinite(concentration) || concentration < 0) {
          throw new DomainError('VALIDATION', 'Concentration must be a positive number', {
            field: 'concentrationNgUl',
            plasmidId: entry.plasmidId,
            value: concentration,
          });
        }
      }
    }

    const plasmidIds = Array.from(seen);
    const found = await this.plasmidRepository.listByIds(plasmidIds);
    const knownIds = new Set(found.map((plasmid) => plasmid.id));
    const missing = plasmidIds.filter((id) => !knownIds.has(id));
    if (missing.length > 0) {
      throw new DomainError('NOT_FOUND', `Unknown plasmid(s): ${missing.join(', ')}`, {
        plasmidIds: missing,
      });
    }

    const now = new Date();
    const preps: PlasmidPrep[] = input.entries.map((entry) => ({
      id: randomUUID(),
      plasmidId: entry.plasmidId,
      preppedOn: input.preppedOn,
      operatorInitials: initials,
      ...(entry.concentrationNgUl !== undefined &&
        entry.concentrationNgUl !== null && { concentrationNgUl: entry.concentrationNgUl }),
      createdAt: now,
      updatedAt: now,
    }));

    const db = getQueryBuilder();
    await db.transaction(async (trx) => {
      await this.repository.createManyInTransaction(trx, preps);
    });

    this.logger.info('PlasmidPrepService.recordBatch complete', { created: preps.length });
    return preps;
  }
}
