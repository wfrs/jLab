/**
 * GmoService
 * Business logic for GMO records linked to plasmids.
 * Services own transactions (ADR-0005) and domain invariants (ADR-0007).
 *
 * Legacy parity: GMOs link to organisms by name (picked from the organism
 * glossary), approval defaults to '-', dates default to today, and
 * destruction sets dateDestroyed (legacy replaced 'tbd' in the summary).
 */

import { GmoRepository } from './gmo.repository';
import { PlasmidRepository } from './plasmid.repository';
import { OrganismRepository } from './organism.repository';
import { OrganismTargetService } from './organism-target.service';
import { Gmo, DomainError } from '@domain/types';
import { Logger } from '@infrastructure/logger';
import { randomUUID } from 'crypto';

const DEFAULT_APPROVAL = '-';
const DEFAULT_TARGET_RISK_GROUP = 1;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface CreateGmoInput {
  id?: string;
  plasmidId: string;
  organismName: string;
  approval?: string;
  targetRiskGroup?: number;
  /** ISO date (YYYY-MM-DD); defaults to today */
  dateGenerated?: string;
}

export interface UpdateGmoInput {
  approval?: string;
  targetRiskGroup?: number;
  dateGenerated?: string;
  /** ISO date to mark destruction; `null` reverts to not destroyed */
  dateDestroyed?: string | null;
}

export interface AddFavouritesResult {
  created: Gmo[];
  /** Favourites left alone because a live GMO for that organism already exists */
  skipped: string[];
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function assertIsoDate(value: string, field: string): void {
  if (!ISO_DATE_PATTERN.test(value)) {
    throw new DomainError('VALIDATION', `${field} must be an ISO date (YYYY-MM-DD)`, {
      field,
      value,
    });
  }
}

export class GmoService {
  private repository: GmoRepository;
  private plasmidRepository: PlasmidRepository;
  private organismRepository: OrganismRepository;
  private organismTargetService: OrganismTargetService;
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger || new Logger();
    this.repository = new GmoRepository(this.logger);
    this.plasmidRepository = new PlasmidRepository(this.logger);
    this.organismRepository = new OrganismRepository(this.logger);
    this.organismTargetService = new OrganismTargetService(this.logger);
  }

  /**
   * Create a GMO on a plasmid.
   * The organism must exist in the organism glossary (legacy: picked from
   * the target organism list); its risk group seeds targetRiskGroup unless
   * explicitly overridden.
   */
  async createGmo(data: CreateGmoInput): Promise<Gmo> {
    this.logger.info('GmoService.createGmo', {
      plasmidId: data.plasmidId,
      organismName: data.organismName,
    });

    // Domain invariant: plasmid must exist
    const plasmid = await this.plasmidRepository.getById(data.plasmidId);
    if (!plasmid) {
      throw new DomainError('NOT_FOUND', `Plasmid not found: ${data.plasmidId}`, {
        plasmidId: data.plasmidId,
      });
    }

    // Domain invariant: organism must exist in the glossary
    const organism = await this.organismRepository.getByFullName(data.organismName || '');
    if (!organism) {
      throw new DomainError('VALIDATION', `Organism not in glossary: ${data.organismName}`, {
        field: 'organismName',
        organismName: data.organismName,
      });
    }

    // Domain invariant: target risk group must be a positive integer
    if (
      data.targetRiskGroup !== undefined &&
      (!Number.isInteger(data.targetRiskGroup) || data.targetRiskGroup < 1)
    ) {
      throw new DomainError('VALIDATION', 'Target risk group must be a positive integer', {
        field: 'targetRiskGroup',
        value: data.targetRiskGroup,
      });
    }

    const dateGenerated = data.dateGenerated ?? todayIsoDate();
    assertIsoDate(dateGenerated, 'dateGenerated');

    // Default target RG from the organism's glossary risk group when numeric
    const glossaryRiskGroup = parseInt(organism.riskGroup, 10);
    const targetRiskGroup =
      data.targetRiskGroup ??
      (Number.isInteger(glossaryRiskGroup) && glossaryRiskGroup >= 1
        ? glossaryRiskGroup
        : DEFAULT_TARGET_RISK_GROUP);

    try {
      const gmo = await this.repository.create({
        ...data,
        organismName: organism.fullName,
        approval: data.approval ?? DEFAULT_APPROVAL,
        targetRiskGroup,
        dateGenerated,
        dateDestroyed: null,
        entryDate: todayIsoDate(),
      });

      this.logger.info('GmoService.createGmo succeeded', {
        id: gmo.id,
        plasmidId: gmo.plasmidId,
      });

      return gmo;
    } catch (error) {
      if (error instanceof DomainError) {
        throw error;
      }
      this.logger.error('GmoService.createGmo failed', error as Error, { data });
      throw new DomainError('DATABASE', 'Failed to create GMO', {
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Add every favourite organism as a GMO on the plasmid (legacy -ADDFAV-,
   * gmocu.py:2112). Each GMO gets the same defaults as a single add:
   * approval '-', target RG seeded from the organism's glossary risk group,
   * dates today.
   *
   * Deviation from legacy (which inserted unconditionally): a favourite whose
   * organism already has a live (non-destroyed) GMO on this plasmid is
   * skipped and reported — pressing the button twice must not double the
   * GMO records. A destroyed GMO does not block; regenerating after
   * destruction is a legitimate new record.
   *
   * Adds are sequential, not one transaction — legacy committed one GMO at a
   * time too, and a mid-batch failure leaves the earlier records standing.
   */
  async addFavouritesAsGmos(plasmidId: string): Promise<AddFavouritesResult> {
    this.logger.info('GmoService.addFavouritesAsGmos', { plasmidId });

    const plasmid = await this.plasmidRepository.getById(plasmidId);
    if (!plasmid) {
      throw new DomainError('NOT_FOUND', `Plasmid not found: ${plasmidId}`, { plasmidId });
    }

    const favourites = await this.organismTargetService.listFavourites();
    const existing = await this.repository.getByPlasmid(plasmidId);

    // Imported v1 GMOs carry glossary short names (AgTu), jlab-created ones
    // full names — resolve both to the glossary entry before comparing, with
    // report.service's findOrganism semantics (exact short OR full name).
    const organisms = await this.organismRepository.getAll();
    const canonical = (name: string): string =>
      organisms.find((o) => o.shortName === name || o.fullName === name)?.fullName ?? name;
    const liveOrganisms = new Set(
      existing.filter((gmo) => !gmo.dateDestroyed).map((gmo) => canonical(gmo.organismName))
    );

    const created: Gmo[] = [];
    const skipped: string[] = [];
    for (const favourite of favourites) {
      if (liveOrganisms.has(canonical(favourite.organismName))) {
        skipped.push(favourite.organismName);
        continue;
      }
      created.push(
        await this.createGmo({
          id: randomUUID(),
          plasmidId,
          organismName: favourite.organismName,
        })
      );
    }

    this.logger.info('GmoService.addFavouritesAsGmos succeeded', {
      plasmidId,
      created: created.length,
      skipped: skipped.length,
    });

    return { created, skipped };
  }

  /**
   * Update a GMO (approval, target RG, dates).
   * Setting dateDestroyed marks destruction (legacy Destroy button).
   */
  async updateGmo(id: string, updates: UpdateGmoInput): Promise<Gmo> {
    this.logger.info('GmoService.updateGmo', { id });

    const existing = await this.repository.getById(id);
    if (!existing) {
      throw new DomainError('NOT_FOUND', `GMO not found: ${id}`, { id });
    }

    if (
      updates.targetRiskGroup !== undefined &&
      (!Number.isInteger(updates.targetRiskGroup) || updates.targetRiskGroup < 1)
    ) {
      throw new DomainError('VALIDATION', 'Target risk group must be a positive integer', {
        field: 'targetRiskGroup',
        value: updates.targetRiskGroup,
      });
    }

    if (updates.approval !== undefined && updates.approval.trim().length === 0) {
      throw new DomainError('VALIDATION', 'Approval cannot be empty (legacy default is "-")', {
        field: 'approval',
      });
    }

    if (updates.dateGenerated !== undefined) {
      assertIsoDate(updates.dateGenerated, 'dateGenerated');
    }
    if (updates.dateDestroyed !== undefined && updates.dateDestroyed !== null) {
      assertIsoDate(updates.dateDestroyed, 'dateDestroyed');
    }

    try {
      const updated = await this.repository.update(id, updates);

      this.logger.info('GmoService.updateGmo succeeded', {
        id: updated.id,
        fields: Object.keys(updates),
      });

      return updated;
    } catch (error) {
      if (error instanceof DomainError) {
        throw error;
      }
      this.logger.error('GmoService.updateGmo failed', error as Error, { id, updates });
      throw new DomainError('DATABASE', 'Failed to update GMO', {
        cause: error instanceof Error ? error.message : String(error),
        id,
      });
    }
  }

  /**
   * Delete a GMO record
   */
  async deleteGmo(id: string): Promise<void> {
    this.logger.info('GmoService.deleteGmo', { id });

    const existing = await this.repository.getById(id);
    if (!existing) {
      throw new DomainError('NOT_FOUND', `GMO not found: ${id}`, { id });
    }

    try {
      await this.repository.delete(id);
      this.logger.info('GmoService.deleteGmo succeeded', { id });
    } catch (error) {
      this.logger.error('GmoService.deleteGmo failed', error as Error, { id });
      throw new DomainError('DATABASE', 'Failed to delete GMO', {
        cause: error instanceof Error ? error.message : String(error),
        id,
      });
    }
  }

  /**
   * List GMOs on a plasmid
   */
  async listPlasmidGmos(plasmidId: string): Promise<Gmo[]> {
    this.logger.info('GmoService.listPlasmidGmos', { plasmidId });

    const plasmid = await this.plasmidRepository.getById(plasmidId);
    if (!plasmid) {
      throw new DomainError('NOT_FOUND', `Plasmid not found: ${plasmidId}`, { plasmidId });
    }

    try {
      return await this.repository.getByPlasmid(plasmidId);
    } catch (error) {
      this.logger.error('GmoService.listPlasmidGmos failed', error as Error, { plasmidId });
      throw new DomainError('DATABASE', 'Failed to list GMOs', {
        cause: error instanceof Error ? error.message : String(error),
        plasmidId,
      });
    }
  }
}
