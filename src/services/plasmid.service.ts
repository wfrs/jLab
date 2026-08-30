/**
 * PlasmidService
 * Business logic orchestration for Plasmid domain
 * Services own all transactions (ADR-0013)
 * Services validate domain invariants (ADR-0007)
 */

import { PlasmidRepository } from './plasmid.repository';
import { SettingsService } from './settings.service';
import { Cassette, Gmo, Plasmid, DomainError } from '@domain/types';
import { Logger } from '@infrastructure/logger';
import { getQueryBuilder } from '@infrastructure/query-builder';
import { randomUUID } from 'crypto';

export interface CreatePlasmidInput {
  id?: string;
  name: string;
  description?: string;
  sizeBp?: number;
  parentId?: string;
  backboneVector?: string;
  status?: Plasmid['status'];
}

export interface UpdatePlasmidInput {
  name?: string;
  description?: string;
  /** `null` clears the stored size */
  sizeBp?: number | null;
  status?: Plasmid['status'];
  /** `null` detaches from the parent plasmid */
  parentId?: string | null;
  /** `null` clears the backbone vector */
  backboneVector?: string | null;
}

export class PlasmidService {
  private repository: PlasmidRepository;
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger || new Logger();
    this.repository = new PlasmidRepository(this.logger);
  }

  /**
   * Create a new plasmid
   * Validates domain invariants before persistence
   */
  async createPlasmid(data: CreatePlasmidInput): Promise<Plasmid> {
    this.logger.info('PlasmidService.createPlasmid', { name: data.name });

    // Domain invariant: name is required
    if (!data.name || data.name.trim().length === 0) {
      throw new DomainError('VALIDATION', 'Plasmid name is required', { field: 'name' });
    }

    // Domain invariant: name is unique (exact match — search() would also
    // reject names that are substrings of existing names/descriptions)
    const existing = await this.repository.getByName(data.name);
    if (existing) {
      throw new DomainError('VALIDATION', `Plasmid with name "${data.name}" already exists`, {
        field: 'name',
        existingId: existing.id,
      });
    }

    // Domain invariant: status must be valid
    const validStatuses: Plasmid['status'][] = ['draft', 'validated', 'archived'];
    const status = data.status || 'draft';
    if (!validStatuses.includes(status)) {
      throw new DomainError('VALIDATION', `Invalid plasmid status: ${status}`, {
        field: 'status',
        validValues: validStatuses,
      });
    }

    // Domain invariant: size must be positive if provided
    if (data.sizeBp !== undefined && data.sizeBp <= 0) {
      throw new DomainError('VALIDATION', 'Plasmid size must be greater than 0', {
        field: 'sizeBp',
        value: data.sizeBp,
      });
    }

    // Domain invariant: if parentId provided, parent must exist
    if (data.parentId) {
      const parent = await this.repository.getById(data.parentId);
      if (!parent) {
        throw new DomainError('VALIDATION', `Parent plasmid not found: ${data.parentId}`, {
          field: 'parentId',
          parentId: data.parentId,
        });
      }
    }

    try {
      // Service owns the transaction
      return await this.withTransaction(async () => {
        const plasmid = await this.repository.create({
          ...data,
          status,
        });

        this.logger.info('PlasmidService.createPlasmid succeeded', {
          id: plasmid.id,
          name: plasmid.name,
        });

        return plasmid;
      });
    } catch (error) {
      if (error instanceof DomainError) {
        throw error;
      }
      this.logger.error('PlasmidService.createPlasmid failed', error as Error, { data });
      throw new DomainError('DATABASE', 'Failed to create plasmid', {
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Update an existing plasmid
   */
  async updatePlasmid(id: string, updates: UpdatePlasmidInput): Promise<Plasmid> {
    this.logger.info('PlasmidService.updatePlasmid', { id });

    // Domain invariant: plasmid must exist
    const existing = await this.repository.getById(id);
    if (!existing) {
      throw new DomainError('NOT_FOUND', `Plasmid not found: ${id}`, { id });
    }

    // Domain invariant: name cannot be empty if provided
    if (updates.name !== undefined && updates.name.trim().length === 0) {
      throw new DomainError('VALIDATION', 'Plasmid name cannot be empty', { field: 'name' });
    }

    // Domain invariant: renamed plasmid must keep name unique (excluding itself)
    if (updates.name !== undefined) {
      const clash = await this.repository.getByName(updates.name);
      if (clash && clash.id !== id) {
        throw new DomainError('VALIDATION', `Plasmid with name "${updates.name}" already exists`, {
          field: 'name',
          existingId: clash.id,
        });
      }
    }

    // Domain invariant: status must be valid if provided
    if (updates.status !== undefined) {
      const validStatuses: Plasmid['status'][] = ['draft', 'validated', 'archived'];
      if (!validStatuses.includes(updates.status)) {
        throw new DomainError('VALIDATION', `Invalid plasmid status: ${updates.status}`, {
          field: 'status',
          validValues: validStatuses,
        });
      }
    }

    // Domain invariant: size must be positive if provided (null clears the size)
    if (typeof updates.sizeBp === 'number' && updates.sizeBp <= 0) {
      throw new DomainError('VALIDATION', 'Plasmid size must be greater than 0', {
        field: 'sizeBp',
        value: updates.sizeBp,
      });
    }

    // Domain invariant: if reparenting, parent must exist and cannot be itself
    if (typeof updates.parentId === 'string') {
      if (updates.parentId === id) {
        throw new DomainError('VALIDATION', 'Plasmid cannot be its own parent', {
          field: 'parentId',
        });
      }
      const parent = await this.repository.getById(updates.parentId);
      if (!parent) {
        throw new DomainError('VALIDATION', `Parent plasmid not found: ${updates.parentId}`, {
          field: 'parentId',
          parentId: updates.parentId,
        });
      }
    }

    try {
      return await this.withTransaction(async () => {
        const updated = await this.repository.update(id, updates);

        this.logger.info('PlasmidService.updatePlasmid succeeded', {
          id: updated.id,
          fields: Object.keys(updates),
        });

        return updated;
      });
    } catch (error) {
      if (error instanceof DomainError) {
        throw error;
      }
      this.logger.error('PlasmidService.updatePlasmid failed', error as Error, { id, updates });
      throw new DomainError('DATABASE', 'Failed to update plasmid', {
        cause: error instanceof Error ? error.message : String(error),
        id,
      });
    }
  }

  /**
   * Delete a plasmid
   * Cascades to related cassettes, primers, features
   */
  async deletePlasmid(id: string): Promise<void> {
    this.logger.info('PlasmidService.deletePlasmid', { id });

    // Domain invariant: plasmid must exist
    const existing = await this.repository.getById(id);
    if (!existing) {
      throw new DomainError('NOT_FOUND', `Plasmid not found: ${id}`, { id });
    }

    try {
      return await this.withTransaction(async () => {
        // Delete related records (cascade)
        const db = getQueryBuilder();

        // Delete cassettes
        await db('cassettes').where('plasmidId', id).delete();
        this.logger.debug('Deleted cassettes', { plasmidId: id });

        // Delete primers
        await db('primers').where('plasmidId', id).delete();
        this.logger.debug('Deleted primers', { plasmidId: id });

        // Delete features
        await db('features').where('plasmidId', id).delete();
        this.logger.debug('Deleted features', { plasmidId: id });

        // Delete integrations
        await db('integrations').where('plasmidId', id).delete();
        this.logger.debug('Deleted integrations', { plasmidId: id });

        // Delete GMOs
        await db('gmos').where('plasmidId', id).delete();
        this.logger.debug('Deleted GMOs', { plasmidId: id });

        // Delete attachments
        await db('attachments').where('plasmidId', id).delete();
        this.logger.debug('Deleted attachments', { plasmidId: id });

        // Delete GenBank file
        await db('genbank_files').where('plasmidId', id).delete();
        this.logger.debug('Deleted GenBank file', { plasmidId: id });

        // Delete project associations
        await db('project_plasmids').where('plasmidId', id).delete();
        this.logger.debug('Deleted project associations', { plasmidId: id });

        // Delete preps — a preparation has no meaning without its plasmid
        await db('plasmid_preps').where('plasmidId', id).delete();
        this.logger.debug('Deleted preps', { plasmidId: id });

        // Delete this plasmid's label print history
        await db('label_prints').where({ kind: 'plasmid', targetId: id }).delete();
        this.logger.debug('Deleted label print history', { plasmidId: id });

        // Glycerol stocks are kept and unlinked, not deleted: the tube is still
        // in the freezer, and an Agrobacterium stock is numbered independently
        // and may carry a strain that outlives any one plasmid record.
        await db('glycerol_stocks').where('plasmidId', id).update({ plasmidId: null });
        this.logger.debug('Unlinked glycerol stocks', { plasmidId: id });

        // Delete the plasmid itself
        await this.repository.delete(id);

        this.logger.info('PlasmidService.deletePlasmid succeeded', { id });
      });
    } catch (error) {
      if (error instanceof DomainError) {
        throw error;
      }
      this.logger.error('PlasmidService.deletePlasmid failed', error as Error, { id });
      throw new DomainError('DATABASE', 'Failed to delete plasmid', {
        cause: error instanceof Error ? error.message : String(error),
        id,
      });
    }
  }

  /**
   * Duplicate a plasmid (legacy -DUPLICATE- event, gmocu.py 2051–2086).
   * Copies the content-describing fields (name + ' (Copy)', description,
   * sizeBp, backboneVector) and all cassettes; status and dates reset to
   * defaults. GMOs are copied only when the duplicateGmos setting is on,
   * with today's dates and destroyed cleared. GenBank file and attachments
   * are NOT copied (legacy leaves them behind too).
   */
  async duplicatePlasmid(id: string): Promise<Plasmid> {
    this.logger.info('PlasmidService.duplicatePlasmid', { id });

    const source = await this.repository.getById(id);
    if (!source) {
      throw new DomainError('NOT_FOUND', `Plasmid not found: ${id}`, { id });
    }

    // Legacy appends ' (Copy)'; v2 enforces unique names, so number clashes
    const copyName = await this.nextCopyName(source.name);

    try {
      return await this.withTransaction(async () => {
        const db = getQueryBuilder();
        const now = new Date().toISOString();
        const today = now.slice(0, 10);

        const created = await this.repository.create({
          id: randomUUID(),
          name: copyName,
          status: 'draft',
          ...(source.description != null && { description: source.description }),
          ...(source.sizeBp != null && { sizeBp: source.sizeBp }),
          ...(source.backboneVector != null && { backboneVector: source.backboneVector }),
        });

        // Duplicate cassettes (legacy copies every cassette's content)
        const cassettes = (await db('cassettes')
          .where('plasmidId', id)
          .orderBy('position', 'asc')) as Cassette[];
        for (const cassette of cassettes) {
          await db('cassettes').insert({
            id: randomUUID(),
            plasmidId: created.id,
            name: cassette.name,
            sequence: cassette.sequence ?? null,
            type: cassette.type,
            position: cassette.position,
            createdAt: now,
            updatedAt: now,
          });
        }

        // Duplicate GMOs only when enabled in settings, "but with current
        // date" (legacy): dateGenerated/entryDate today, destroyed cleared
        const settings = await new SettingsService(this.logger).getSettings();
        let gmoCount = 0;
        if (Boolean(Number(settings.duplicateGmos))) {
          const gmos = (await db('gmos').where('plasmidId', id)) as Gmo[];
          for (const gmo of gmos) {
            await db('gmos').insert({
              id: randomUUID(),
              plasmidId: created.id,
              organismName: gmo.organismName,
              approval: gmo.approval,
              targetRiskGroup: gmo.targetRiskGroup,
              dateGenerated: today,
              dateDestroyed: null,
              entryDate: today,
              createdAt: now,
              updatedAt: now,
            });
          }
          gmoCount = gmos.length;
        }

        this.logger.info('PlasmidService.duplicatePlasmid succeeded', {
          sourceId: id,
          newId: created.id,
          name: created.name,
          cassettes: cassettes.length,
          gmos: gmoCount,
        });

        return created;
      });
    } catch (error) {
      if (error instanceof DomainError) {
        throw error;
      }
      this.logger.error('PlasmidService.duplicatePlasmid failed', error as Error, { id });
      throw new DomainError('DATABASE', 'Failed to duplicate plasmid', {
        cause: error instanceof Error ? error.message : String(error),
        id,
      });
    }
  }

  /**
   * First free copy name: "X (Copy)", then "X (Copy 2)", "X (Copy 3)", …
   */
  private async nextCopyName(sourceName: string): Promise<string> {
    let candidate = `${sourceName} (Copy)`;
    let counter = 2;
    while (await this.repository.getByName(candidate)) {
      candidate = `${sourceName} (Copy ${counter})`;
      counter += 1;
    }
    return candidate;
  }

  /**
   * Get a single plasmid
   */
  async getPlasmid(id: string): Promise<Plasmid> {
    this.logger.info('PlasmidService.getPlasmid', { id });

    try {
      const plasmid = await this.repository.getById(id);
      if (!plasmid) {
        throw new DomainError('NOT_FOUND', `Plasmid not found: ${id}`, { id });
      }
      return plasmid;
    } catch (error) {
      if (error instanceof DomainError) {
        throw error;
      }
      this.logger.error('PlasmidService.getPlasmid failed', error as Error, { id });
      throw new DomainError('DATABASE', 'Failed to retrieve plasmid', {
        cause: error instanceof Error ? error.message : String(error),
        id,
      });
    }
  }

  /**
   * List plasmids for a project
   */
  async listProjectPlasmids(projectId: string): Promise<Plasmid[]> {
    this.logger.info('PlasmidService.listProjectPlasmids', { projectId });

    try {
      return await this.repository.getByProject(projectId);
    } catch (error) {
      this.logger.error('PlasmidService.listProjectPlasmids failed', error as Error, {
        projectId,
      });
      throw new DomainError('DATABASE', 'Failed to list project plasmids', {
        cause: error instanceof Error ? error.message : String(error),
        projectId,
      });
    }
  }

  /**
   * Search plasmids
   */
  async searchPlasmids(query: string): Promise<Plasmid[]> {
    this.logger.info('PlasmidService.searchPlasmids', { query });

    try {
      return await this.repository.search(query);
    } catch (error) {
      this.logger.error('PlasmidService.searchPlasmids failed', error as Error, { query });
      throw new DomainError('DATABASE', 'Failed to search plasmids', {
        cause: error instanceof Error ? error.message : String(error),
        query,
      });
    }
  }

  /**
   * Get paginated list
   */
  async listPlasmids(
    limit: number = 20,
    offset: number = 0
  ): Promise<{ data: Plasmid[]; total: number }> {
    this.logger.info('PlasmidService.listPlasmids', { limit, offset });

    try {
      return await this.repository.paginatedList(limit, offset);
    } catch (error) {
      this.logger.error('PlasmidService.listPlasmids failed', error as Error, { limit, offset });
      throw new DomainError('DATABASE', 'Failed to list plasmids', {
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Helper: transaction wrapper
   * Service owns transaction lifecycle (ADR-0013)
   */
  private async withTransaction<T>(callback: () => Promise<T>): Promise<T> {
    try {
      // Note: SQLite with async doesn't support true transactions in the same way
      // For now, we execute the callback directly
      // In production with proper transaction support, this would wrap in BEGIN/COMMIT/ROLLBACK
      const result = await callback();
      return result;
    } catch (error) {
      // If callback fails, we just re-throw
      // Proper transaction rollback would happen here in a full implementation
      throw error;
    }
  }
}
