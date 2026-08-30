/**
 * GlycerolStockService
 * Business logic for frozen bacterial stocks (ADR-0005, ADR-0007).
 *
 * Remaking a stock overwrites `madeOn` rather than adding a row. That is the
 * lab's own model, confirmed against CJM348, CJM353, CJM369 and CJM370, where
 * the spreadsheet holds only the latest date each time — unlike plasmid preps,
 * where the concentration changes with every prep and the history matters.
 */

import { randomUUID } from 'crypto';
import { GlycerolStockRepository } from './glycerol-stock.repository';
import { GlycerolStock, DomainError } from '@domain/types';
import { Logger } from '@infrastructure/logger';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface CreateGlycerolStockInput {
  stockId: string;
  plasmidId?: string | null;
  organism: string;
  strain: string;
  constructLabel?: string | null;
  madeOn?: string | null;
  operatorInitials?: string | null;
  bacterialResistance?: string | null;
}

export type UpdateGlycerolStockInput = Partial<Omit<CreateGlycerolStockInput, 'stockId'>> & {
  stockId?: string;
};

function assertOptionalIsoDate(value: string | null | undefined, field: string): void {
  if (value === null || value === undefined || value === '') {
    return;
  }
  if (!ISO_DATE_PATTERN.test(value)) {
    throw new DomainError('VALIDATION', `${field} must be an ISO date (YYYY-MM-DD)`, {
      field,
      value,
    });
  }
}

export class GlycerolStockService {
  private repository: GlycerolStockRepository;
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger || new Logger();
    this.repository = new GlycerolStockRepository(this.logger);
  }

  async listForPlasmid(plasmidId: string): Promise<GlycerolStock[]> {
    return this.repository.listByPlasmid(plasmidId);
  }

  async listForPlasmids(plasmidIds: string[]): Promise<GlycerolStock[]> {
    return this.repository.listByPlasmids(plasmidIds);
  }

  async create(input: CreateGlycerolStockInput): Promise<GlycerolStock> {
    this.logger.info('GlycerolStockService.create', { stockId: input.stockId });

    const stockId = input.stockId?.trim();
    if (!stockId) {
      throw new DomainError('VALIDATION', 'Stock ID is required', { field: 'stockId' });
    }
    if (!input.organism?.trim()) {
      throw new DomainError('VALIDATION', 'Organism is required', { field: 'organism' });
    }
    if (!input.strain?.trim()) {
      throw new DomainError('VALIDATION', 'Strain is required', { field: 'strain' });
    }
    assertOptionalIsoDate(input.madeOn, 'madeOn');

    // Stock IDs are the lab's own identifiers and are written on the tube;
    // two records claiming one tube is a bug the freezer cannot resolve
    const existing = await this.repository.getByStockId(stockId);
    if (existing) {
      throw new DomainError('CONFLICT', `Stock ${stockId} already exists`, { field: 'stockId' });
    }

    const now = new Date();
    const stock: GlycerolStock = {
      id: randomUUID(),
      stockId,
      organism: input.organism.trim(),
      strain: input.strain.trim(),
      ...(input.plasmidId && { plasmidId: input.plasmidId }),
      ...(input.constructLabel?.trim() && { constructLabel: input.constructLabel.trim() }),
      ...(input.madeOn && { madeOn: input.madeOn }),
      ...(input.operatorInitials?.trim() && { operatorInitials: input.operatorInitials.trim() }),
      ...(input.bacterialResistance?.trim() && {
        bacterialResistance: input.bacterialResistance.trim(),
      }),
      createdAt: now,
      updatedAt: now,
    };

    await this.repository.create(stock);
    return stock;
  }

  /**
   * Update a stock in place. Setting `madeOn` is how a remake is recorded —
   * the tube is new, the number on it is not.
   */
  async update(id: string, patch: UpdateGlycerolStockInput): Promise<GlycerolStock> {
    this.logger.info('GlycerolStockService.update', { id, fields: Object.keys(patch) });

    const existing = await this.repository.getById(id);
    if (!existing) {
      throw new DomainError('NOT_FOUND', 'Glycerol stock not found', { id });
    }

    assertOptionalIsoDate(patch.madeOn, 'madeOn');

    if (patch.stockId !== undefined) {
      const stockId = patch.stockId.trim();
      if (!stockId) {
        throw new DomainError('VALIDATION', 'Stock ID is required', { field: 'stockId' });
      }
      const clash = await this.repository.getByStockId(stockId);
      if (clash && clash.id !== id) {
        throw new DomainError('CONFLICT', `Stock ${stockId} already exists`, { field: 'stockId' });
      }
    }
    for (const field of ['organism', 'strain'] as const) {
      if (patch[field] !== undefined && !patch[field]?.trim()) {
        throw new DomainError('VALIDATION', `${field} cannot be empty`, { field });
      }
    }

    const updated = await this.repository.update(id, {
      ...patch,
      updatedAt: new Date(),
    } as Partial<GlycerolStock>);

    if (!updated) {
      throw new DomainError('NOT_FOUND', 'Glycerol stock not found', { id });
    }
    return updated;
  }

  async delete(id: string): Promise<void> {
    const existing = await this.repository.getById(id);
    if (!existing) {
      throw new DomainError('NOT_FOUND', 'Glycerol stock not found', { id });
    }
    await this.repository.delete(id);
  }
}
