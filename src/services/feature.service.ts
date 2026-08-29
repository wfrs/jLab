/**
 * FeatureService
 * Business logic for annotated sequence regions on a plasmid (v2 entity —
 * no legacy counterpart; part of the locked v2 schema design).
 * Positions are 1-based and inclusive; startPos ≤ endPos (wrap-around
 * features across the origin are entered as two features).
 */

import { FeatureRepository } from './feature.repository';
import { PlasmidRepository } from './plasmid.repository';
import { Feature, DomainError } from '@domain/types';
import { Logger } from '@infrastructure/logger';
import { randomUUID } from 'crypto';

const VALID_FEATURE_TYPES: Feature['type'][] = [
  'gene',
  'promoter',
  'terminator',
  'rbs',
  'his_tag',
  'flag_tag',
  'other',
];

export interface CreateFeatureInput {
  id?: string;
  plasmidId: string;
  name: string;
  type: Feature['type'];
  startPos: number;
  endPos: number;
  strand?: Feature['strand'];
}

export interface UpdateFeatureInput {
  name?: string;
  type?: Feature['type'];
  startPos?: number;
  endPos?: number;
  strand?: Feature['strand'];
}

function assertPosition(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new DomainError('VALIDATION', `${field} must be a positive integer (1-based)`, {
      field,
      value,
    });
  }
}

function assertRange(startPos: number, endPos: number): void {
  if (startPos > endPos) {
    throw new DomainError('VALIDATION', 'startPos must not be greater than endPos', {
      field: 'startPos',
      startPos,
      endPos,
    });
  }
}

export class FeatureService {
  private repository: FeatureRepository;
  private plasmidRepository: PlasmidRepository;
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger || new Logger();
    this.repository = new FeatureRepository(this.logger);
    this.plasmidRepository = new PlasmidRepository(this.logger);
  }

  /**
   * Create a feature on a plasmid
   */
  async createFeature(data: CreateFeatureInput): Promise<Feature> {
    this.logger.info('FeatureService.createFeature', {
      plasmidId: data.plasmidId,
      name: data.name,
    });

    if (!data.name || data.name.trim().length === 0) {
      throw new DomainError('VALIDATION', 'Feature name is required', { field: 'name' });
    }
    if (!VALID_FEATURE_TYPES.includes(data.type)) {
      throw new DomainError('VALIDATION', `Invalid feature type: ${data.type}`, {
        field: 'type',
        validValues: VALID_FEATURE_TYPES,
      });
    }
    assertPosition(data.startPos, 'startPos');
    assertPosition(data.endPos, 'endPos');
    assertRange(data.startPos, data.endPos);
    const strand = data.strand ?? '+';
    if (strand !== '+' && strand !== '-') {
      throw new DomainError('VALIDATION', `Invalid strand: ${strand}`, {
        field: 'strand',
        validValues: ['+', '-'],
      });
    }

    const plasmid = await this.plasmidRepository.getById(data.plasmidId);
    if (!plasmid) {
      throw new DomainError('NOT_FOUND', `Plasmid not found: ${data.plasmidId}`, {
        plasmidId: data.plasmidId,
      });
    }

    try {
      const feature = await this.repository.create({
        id: data.id || randomUUID(),
        plasmidId: data.plasmidId,
        name: data.name.trim(),
        type: data.type,
        startPos: data.startPos,
        endPos: data.endPos,
        strand,
      });

      this.logger.info('FeatureService.createFeature succeeded', {
        id: feature.id,
        plasmidId: feature.plasmidId,
      });

      return feature;
    } catch (error) {
      if (error instanceof DomainError) {
        throw error;
      }
      this.logger.error('FeatureService.createFeature failed', error as Error, { data });
      throw new DomainError('DATABASE', 'Failed to create feature', {
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Update a feature (position edits validate against the merged range)
   */
  async updateFeature(id: string, updates: UpdateFeatureInput): Promise<Feature> {
    this.logger.info('FeatureService.updateFeature', { id });

    const existing = await this.repository.getById(id);
    if (!existing) {
      throw new DomainError('NOT_FOUND', `Feature not found: ${id}`, { id });
    }

    if (updates.name !== undefined && updates.name.trim().length === 0) {
      throw new DomainError('VALIDATION', 'Feature name cannot be empty', { field: 'name' });
    }
    if (updates.type !== undefined && !VALID_FEATURE_TYPES.includes(updates.type)) {
      throw new DomainError('VALIDATION', `Invalid feature type: ${updates.type}`, {
        field: 'type',
        validValues: VALID_FEATURE_TYPES,
      });
    }
    if (updates.startPos !== undefined) assertPosition(updates.startPos, 'startPos');
    if (updates.endPos !== undefined) assertPosition(updates.endPos, 'endPos');
    if (updates.strand !== undefined && updates.strand !== '+' && updates.strand !== '-') {
      throw new DomainError('VALIDATION', `Invalid strand: ${updates.strand}`, {
        field: 'strand',
        validValues: ['+', '-'],
      });
    }
    // Validate the range the row will have after the patch
    assertRange(updates.startPos ?? existing.startPos, updates.endPos ?? existing.endPos);

    const patch: Record<string, unknown> = { ...updates };
    if (updates.name !== undefined) {
      patch.name = updates.name.trim();
    }

    try {
      const updated = await this.repository.update(id, patch);

      this.logger.info('FeatureService.updateFeature succeeded', {
        id: updated.id,
        fields: Object.keys(patch),
      });

      return updated;
    } catch (error) {
      if (error instanceof DomainError) {
        throw error;
      }
      this.logger.error('FeatureService.updateFeature failed', error as Error, { id, updates });
      throw new DomainError('DATABASE', 'Failed to update feature', {
        cause: error instanceof Error ? error.message : String(error),
        id,
      });
    }
  }

  /**
   * Delete a feature
   */
  async deleteFeature(id: string): Promise<void> {
    this.logger.info('FeatureService.deleteFeature', { id });

    const existing = await this.repository.getById(id);
    if (!existing) {
      throw new DomainError('NOT_FOUND', `Feature not found: ${id}`, { id });
    }

    try {
      await this.repository.delete(id);
      this.logger.info('FeatureService.deleteFeature succeeded', { id });
    } catch (error) {
      this.logger.error('FeatureService.deleteFeature failed', error as Error, { id });
      throw new DomainError('DATABASE', 'Failed to delete feature', {
        cause: error instanceof Error ? error.message : String(error),
        id,
      });
    }
  }

  /**
   * List features on a plasmid (by position)
   */
  async listPlasmidFeatures(plasmidId: string): Promise<Feature[]> {
    this.logger.info('FeatureService.listPlasmidFeatures', { plasmidId });

    // Distinguish "no features" from "no plasmid"
    const plasmid = await this.plasmidRepository.getById(plasmidId);
    if (!plasmid) {
      throw new DomainError('NOT_FOUND', `Plasmid not found: ${plasmidId}`, { plasmidId });
    }

    try {
      return await this.repository.getByPlasmid(plasmidId);
    } catch (error) {
      this.logger.error('FeatureService.listPlasmidFeatures failed', error as Error, {
        plasmidId,
      });
      throw new DomainError('DATABASE', 'Failed to list features', {
        cause: error instanceof Error ? error.message : String(error),
        plasmidId,
      });
    }
  }
}
