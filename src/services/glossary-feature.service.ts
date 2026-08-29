/**
 * GlossaryFeatureService
 * Business logic for the nucleic-acid feature glossary.
 * Services own transactions (ADR-0005) and domain invariants (ADR-0007).
 *
 * Legacy parity: annotations are normalized on write exactly like GMOCU
 * ('-'→'_', '['→'(', ']'→')', ' '→'_') and must be unique.
 */

import { randomUUID } from 'crypto';
import { GlossaryFeatureRepository } from './glossary-feature.repository';
import { GlossaryFeature, DomainError } from '@domain/types';
import { normalizeAnnotation, renameTokenInContent } from '@domain/cassette-tokens';
import { Logger } from '@infrastructure/logger';
import { getQueryBuilder } from '@infrastructure/query-builder';

const DEFAULT_RISK = 'No Risk';

export interface CreateGlossaryFeatureInput {
  id?: string;
  annotation: string;
  alias?: string;
  risk?: string;
  organism?: string;
}

export interface UpdateGlossaryFeatureInput {
  annotation?: string;
  alias?: string | null;
  risk?: string;
  organism?: string | null;
}

export class GlossaryFeatureService {
  private repository: GlossaryFeatureRepository;
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger || new Logger();
    this.repository = new GlossaryFeatureRepository(this.logger);
  }

  /**
   * Create a glossary feature; the annotation is normalized (legacy parity)
   */
  async createFeature(data: CreateGlossaryFeatureInput): Promise<GlossaryFeature> {
    this.logger.info('GlossaryFeatureService.createFeature', { annotation: data.annotation });

    const annotation = normalizeAnnotation(data.annotation || '');
    if (annotation.length === 0) {
      throw new DomainError('VALIDATION', 'Annotation is required', { field: 'annotation' });
    }

    const existing = await this.repository.getByAnnotation(annotation);
    if (existing) {
      throw new DomainError('VALIDATION', `Annotation "${annotation}" already exists`, {
        field: 'annotation',
        existingId: existing.id,
      });
    }

    try {
      const feature = await this.repository.create({
        ...data,
        annotation,
        risk: data.risk || DEFAULT_RISK,
        uid: randomUUID().replace(/-/g, ''),
        synced: false,
      });

      this.logger.info('GlossaryFeatureService.createFeature succeeded', {
        id: feature.id,
        annotation: feature.annotation,
      });

      return feature;
    } catch (error) {
      if (error instanceof DomainError) {
        throw error;
      }
      this.logger.error('GlossaryFeatureService.createFeature failed', error as Error, { data });
      throw new DomainError('DATABASE', 'Failed to create glossary feature', {
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Update a glossary feature.
   * Renaming an annotation propagates into all cassette content strings
   * (legacy update_cassettes: full tokens only, variants preserved).
   * Legacy also propagated into plasmid aliases — v2 has no alias field.
   */
  async updateFeature(id: string, updates: UpdateGlossaryFeatureInput): Promise<GlossaryFeature> {
    this.logger.info('GlossaryFeatureService.updateFeature', { id });

    const existing = await this.repository.getById(id);
    if (!existing) {
      throw new DomainError('NOT_FOUND', `Glossary feature not found: ${id}`, { id });
    }

    const normalized: UpdateGlossaryFeatureInput = { ...updates };

    if (updates.annotation !== undefined) {
      const annotation = normalizeAnnotation(updates.annotation);
      if (annotation.length === 0) {
        throw new DomainError('VALIDATION', 'Annotation cannot be empty', {
          field: 'annotation',
        });
      }
      const clash = await this.repository.getByAnnotation(annotation);
      if (clash && clash.id !== id) {
        throw new DomainError('VALIDATION', `Annotation "${annotation}" already exists`, {
          field: 'annotation',
          existingId: clash.id,
        });
      }
      normalized.annotation = annotation;
    }

    const isRename =
      normalized.annotation !== undefined && normalized.annotation !== existing.annotation;

    try {
      if (isRename) {
        // Rename + cassette propagation must land together (service owns the
        // transaction, ADR-0005)
        const db = getQueryBuilder();
        const oldAnnotation = existing.annotation;
        const newAnnotation = normalized.annotation as string;
        let cassettesUpdated = 0;

        await db.transaction(async (trx) => {
          const now = new Date().toISOString();
          await trx('glossary_features')
            .where('id', id)
            .update({ ...normalized, updatedAt: now });

          const cassettes = (await trx('cassettes').select('id', 'name')) as {
            id: string;
            name: string;
          }[];
          for (const cassette of cassettes) {
            const renamed = renameTokenInContent(cassette.name, oldAnnotation, newAnnotation);
            if (renamed !== cassette.name) {
              await trx('cassettes')
                .where('id', cassette.id)
                .update({ name: renamed, updatedAt: now });
              cassettesUpdated += 1;
            }
          }
        });

        this.logger.info('GlossaryFeatureService.updateFeature renamed annotation', {
          id,
          oldAnnotation,
          newAnnotation,
          cassettesUpdated,
        });

        const updated = await this.repository.getById(id);
        if (!updated) {
          throw new DomainError('DATABASE', `Feature not found after update: ${id}`, { id });
        }
        return updated;
      }

      const updated = await this.repository.update(id, normalized);

      this.logger.info('GlossaryFeatureService.updateFeature succeeded', {
        id: updated.id,
        fields: Object.keys(updates),
      });

      return updated;
    } catch (error) {
      if (error instanceof DomainError) {
        throw error;
      }
      this.logger.error('GlossaryFeatureService.updateFeature failed', error as Error, {
        id,
        updates,
      });
      throw new DomainError('DATABASE', 'Failed to update glossary feature', {
        cause: error instanceof Error ? error.message : String(error),
        id,
      });
    }
  }

  /**
   * Delete a glossary feature
   */
  async deleteFeature(id: string): Promise<void> {
    this.logger.info('GlossaryFeatureService.deleteFeature', { id });

    const existing = await this.repository.getById(id);
    if (!existing) {
      throw new DomainError('NOT_FOUND', `Glossary feature not found: ${id}`, { id });
    }

    try {
      await this.repository.delete(id);
      this.logger.info('GlossaryFeatureService.deleteFeature succeeded', { id });
    } catch (error) {
      this.logger.error('GlossaryFeatureService.deleteFeature failed', error as Error, { id });
      throw new DomainError('DATABASE', 'Failed to delete glossary feature', {
        cause: error instanceof Error ? error.message : String(error),
        id,
      });
    }
  }

  /**
   * List glossary features, optionally filtered by search query
   */
  async listFeatures(search?: string): Promise<GlossaryFeature[]> {
    this.logger.info('GlossaryFeatureService.listFeatures', { search });

    try {
      return search ? await this.repository.search(search) : await this.repository.listAll();
    } catch (error) {
      this.logger.error('GlossaryFeatureService.listFeatures failed', error as Error, { search });
      throw new DomainError('DATABASE', 'Failed to list glossary features', {
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
