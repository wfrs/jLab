/**
 * OrganismService
 * Business logic for the organism glossary.
 * Services own transactions (ADR-0005) and domain invariants (ADR-0007).
 */

import { randomUUID } from 'crypto';
import { OrganismRepository } from './organism.repository';
import { Organism, DomainError } from '@domain/types';
import { Logger } from '@infrastructure/logger';
import { getQueryBuilder } from '@infrastructure/query-builder';

const DEFAULT_RISK_GROUP = '1';

export interface CreateOrganismInput {
  id?: string;
  fullName: string;
  shortName?: string;
  riskGroup?: string;
}

export interface UpdateOrganismInput {
  fullName?: string;
  shortName?: string | null;
  riskGroup?: string;
}

export class OrganismService {
  private repository: OrganismRepository;
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger || new Logger();
    this.repository = new OrganismRepository(this.logger);
  }

  /**
   * Create an organism
   */
  async createOrganism(data: CreateOrganismInput): Promise<Organism> {
    this.logger.info('OrganismService.createOrganism', { fullName: data.fullName });

    const fullName = (data.fullName || '').trim();
    if (fullName.length === 0) {
      throw new DomainError('VALIDATION', 'Organism full name is required', {
        field: 'fullName',
      });
    }

    const existing = await this.repository.getByFullName(fullName);
    if (existing) {
      throw new DomainError('VALIDATION', `Organism "${fullName}" already exists`, {
        field: 'fullName',
        existingId: existing.id,
      });
    }

    try {
      const organism = await this.repository.create({
        ...data,
        fullName,
        riskGroup: data.riskGroup || DEFAULT_RISK_GROUP,
        uid: randomUUID().replace(/-/g, ''),
        synced: false,
      });

      this.logger.info('OrganismService.createOrganism succeeded', {
        id: organism.id,
        fullName: organism.fullName,
      });

      return organism;
    } catch (error) {
      if (error instanceof DomainError) {
        throw error;
      }
      this.logger.error('OrganismService.createOrganism failed', error as Error, { data });
      throw new DomainError('DATABASE', 'Failed to create organism', {
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Update an organism.
   * Renames propagate into name-linked records: a full-name change updates
   * GMO records, glossary-feature organism references and the target
   * organism list; a short-name change updates glossary-feature organism
   * references (features link by short name in legacy data).
   */
  async updateOrganism(id: string, updates: UpdateOrganismInput): Promise<Organism> {
    this.logger.info('OrganismService.updateOrganism', { id });

    const existing = await this.repository.getById(id);
    if (!existing) {
      throw new DomainError('NOT_FOUND', `Organism not found: ${id}`, { id });
    }

    const normalized: UpdateOrganismInput = { ...updates };

    if (updates.fullName !== undefined) {
      const fullName = updates.fullName.trim();
      if (fullName.length === 0) {
        throw new DomainError('VALIDATION', 'Organism full name cannot be empty', {
          field: 'fullName',
        });
      }
      const clash = await this.repository.getByFullName(fullName);
      if (clash && clash.id !== id) {
        throw new DomainError('VALIDATION', `Organism "${fullName}" already exists`, {
          field: 'fullName',
          existingId: clash.id,
        });
      }
      normalized.fullName = fullName;
    }

    if (updates.riskGroup !== undefined && updates.riskGroup.trim().length === 0) {
      throw new DomainError('VALIDATION', 'Risk group cannot be empty', { field: 'riskGroup' });
    }

    const fullNameChanged =
      normalized.fullName !== undefined && normalized.fullName !== existing.fullName;
    const shortNameChanged =
      normalized.shortName !== undefined && normalized.shortName !== (existing.shortName ?? null);

    try {
      if (fullNameChanged || shortNameChanged) {
        // Rename + propagation into name-linked records land together
        // (service owns the transaction, ADR-0005)
        const db = getQueryBuilder();
        let gmosUpdated = 0;
        let featuresUpdated = 0;

        await db.transaction(async (trx) => {
          const now = new Date().toISOString();
          await trx('organisms')
            .where('id', id)
            .update({ ...normalized, updatedAt: now });

          if (fullNameChanged) {
            const newFullName = normalized.fullName as string;
            gmosUpdated = await trx('gmos')
              .where('organismName', existing.fullName)
              .update({ organismName: newFullName, updatedAt: now });
            featuresUpdated += await trx('glossary_features')
              .where('organism', existing.fullName)
              .update({ organism: newFullName, updatedAt: now });

            // Target list follows the rename. If the new name is somehow
            // already targeted (rename onto a just-deleted-and-recreated
            // organism), merge instead of violating the unique constraint:
            // the surviving row keeps favourite if either row had it.
            const oldTarget = (await trx('organism_targets')
              .where('organismName', existing.fullName)
              .first()) as { id: string; favourite: number | boolean } | undefined;
            if (oldTarget) {
              const clashTarget = (await trx('organism_targets')
                .where('organismName', newFullName)
                .first()) as { id: string; favourite: number | boolean } | undefined;
              if (clashTarget) {
                await trx('organism_targets').where('id', oldTarget.id).delete();
                if (oldTarget.favourite && !clashTarget.favourite) {
                  await trx('organism_targets')
                    .where('id', clashTarget.id)
                    .update({ favourite: true, updatedAt: now });
                }
              } else {
                await trx('organism_targets')
                  .where('id', oldTarget.id)
                  .update({ organismName: newFullName, updatedAt: now });
              }
            }
          }

          if (shortNameChanged && existing.shortName && normalized.shortName) {
            featuresUpdated += await trx('glossary_features')
              .where('organism', existing.shortName)
              .update({ organism: normalized.shortName, updatedAt: now });
          }
        });

        this.logger.info('OrganismService.updateOrganism renamed organism', {
          id,
          gmosUpdated,
          featuresUpdated,
        });

        const updated = await this.repository.getById(id);
        if (!updated) {
          throw new DomainError('DATABASE', `Organism not found after update: ${id}`, { id });
        }
        return updated;
      }

      const updated = await this.repository.update(id, normalized);

      this.logger.info('OrganismService.updateOrganism succeeded', {
        id: updated.id,
        fields: Object.keys(updates),
      });

      return updated;
    } catch (error) {
      if (error instanceof DomainError) {
        throw error;
      }
      this.logger.error('OrganismService.updateOrganism failed', error as Error, { id, updates });
      throw new DomainError('DATABASE', 'Failed to update organism', {
        cause: error instanceof Error ? error.message : String(error),
        id,
      });
    }
  }

  /**
   * Delete an organism.
   * Its target-list entry (if any) goes with it — a target row naming a
   * deleted organism could never be added as a GMO again.
   */
  async deleteOrganism(id: string): Promise<void> {
    this.logger.info('OrganismService.deleteOrganism', { id });

    const existing = await this.repository.getById(id);
    if (!existing) {
      throw new DomainError('NOT_FOUND', `Organism not found: ${id}`, { id });
    }

    try {
      const db = getQueryBuilder();
      await db.transaction(async (trx) => {
        await trx('organism_targets').where('organismName', existing.fullName).delete();
        await trx('organisms').where('id', id).delete();
      });
      this.logger.info('OrganismService.deleteOrganism succeeded', { id });
    } catch (error) {
      this.logger.error('OrganismService.deleteOrganism failed', error as Error, { id });
      throw new DomainError('DATABASE', 'Failed to delete organism', {
        cause: error instanceof Error ? error.message : String(error),
        id,
      });
    }
  }

  /**
   * List organisms, optionally filtered by search query
   */
  async listOrganisms(search?: string): Promise<Organism[]> {
    this.logger.info('OrganismService.listOrganisms', { search });

    try {
      return search ? await this.repository.search(search) : await this.repository.listAll();
    } catch (error) {
      this.logger.error('OrganismService.listOrganisms failed', error as Error, { search });
      throw new DomainError('DATABASE', 'Failed to list organisms', {
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
