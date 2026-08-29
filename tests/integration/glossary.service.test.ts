/**
 * Integration Tests: GlossaryFeatureService
 * Tests CRUD, legacy annotation normalization, and uniqueness
 */

import { Knex } from 'knex';
import { GlossaryFeatureService } from '@services/glossary-feature.service';
import { setQueryBuilder } from '@infrastructure/query-builder';
import { createTestDb, createTestSchema, cleanTestDb } from '../helpers/test-db';

describe('GlossaryFeatureService (Integration)', () => {
  let service: GlossaryFeatureService;
  let db: Knex;

  beforeAll(async () => {
    db = createTestDb();
    setQueryBuilder(db);
    await createTestSchema(db);
    service = new GlossaryFeatureService();
  });

  afterAll(async () => {
    await db.destroy();
    setQueryBuilder(null);
  });

  beforeEach(async () => {
    await cleanTestDb(db);
  });

  describe('createFeature', () => {
    it('creates a feature with defaults', async () => {
      const feature = await service.createFeature({ id: 'f-1', annotation: 'GFP' });

      expect(feature.annotation).toBe('GFP');
      expect(feature.risk).toBe('No Risk');
      expect(feature.uid).toHaveLength(32);
      // SQLite stores booleans as 0/1
      expect(Number(feature.synced)).toBe(0);
    });

    it('normalizes the annotation exactly like legacy GMOCU', async () => {
      const feature = await service.createFeature({
        id: 'f-1',
        annotation: 'my-feature [v2] x',
      });
      expect(feature.annotation).toBe('my_feature_(v2)_x');
    });

    it('rejects duplicates after normalization', async () => {
      await service.createFeature({ id: 'f-1', annotation: 'my_feature' });
      await expect(
        service.createFeature({ id: 'f-2', annotation: 'my-feature' })
      ).rejects.toMatchObject({ code: 'VALIDATION' });
    });

    it('rejects an annotation that is empty after trim', async () => {
      await expect(service.createFeature({ annotation: '   ' })).rejects.toMatchObject({
        code: 'VALIDATION',
      });
    });

    it('stores alias, risk, organism', async () => {
      const feature = await service.createFeature({
        id: 'f-1',
        annotation: 'AmpR',
        alias: 'Ampicillin resistance',
        risk: 'RG1',
        organism: 'E. coli',
      });
      expect(feature.alias).toBe('Ampicillin resistance');
      expect(feature.risk).toBe('RG1');
      expect(feature.organism).toBe('E. coli');
    });
  });

  describe('updateFeature', () => {
    beforeEach(async () => {
      await service.createFeature({ id: 'f-1', annotation: 'GFP' });
      await service.createFeature({ id: 'f-2', annotation: 'RFP' });
    });

    it('updates and normalizes a renamed annotation', async () => {
      const updated = await service.updateFeature('f-1', { annotation: 'e GFP' });
      expect(updated.annotation).toBe('e_GFP');
    });

    it('rejects renaming to an existing annotation', async () => {
      await expect(service.updateFeature('f-1', { annotation: 'RFP' })).rejects.toMatchObject({
        code: 'VALIDATION',
      });
    });

    it('allows saving the unchanged annotation back', async () => {
      const updated = await service.updateFeature('f-1', { annotation: 'GFP' });
      expect(updated.annotation).toBe('GFP');
    });

    it('clears alias and organism with null', async () => {
      await service.updateFeature('f-1', { alias: 'x', organism: 'y' });
      const cleared = await service.updateFeature('f-1', { alias: null, organism: null });
      expect(cleared.alias).toBeNull();
      expect(cleared.organism).toBeNull();
    });

    it('rejects a non-existent feature', async () => {
      await expect(service.updateFeature('ghost', { risk: 'RG2' })).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });
  });

  describe('deleteFeature', () => {
    it('deletes a feature', async () => {
      await service.createFeature({ id: 'f-1', annotation: 'GFP' });
      await service.deleteFeature('f-1');
      expect(await db('glossary_features').where('id', 'f-1').first()).toBeUndefined();
    });

    it('rejects a non-existent feature', async () => {
      await expect(service.deleteFeature('ghost')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  describe('listFeatures', () => {
    beforeEach(async () => {
      await service.createFeature({ id: 'f-1', annotation: 'GFP', alias: 'green protein' });
      await service.createFeature({ id: 'f-2', annotation: 'AmpR' });
      await service.createFeature({ id: 'f-3', annotation: 'pLac' });
    });

    it('lists all ordered by annotation', async () => {
      const features = await service.listFeatures();
      expect(features.map((f) => f.annotation)).toEqual(['AmpR', 'GFP', 'pLac']);
    });

    it('searches by annotation or alias (case-insensitive substring)', async () => {
      expect((await service.listFeatures('gfp')).map((f) => f.annotation)).toEqual(['GFP']);
      expect((await service.listFeatures('green')).map((f) => f.annotation)).toEqual(['GFP']);
      expect((await service.listFeatures('p')).map((f) => f.annotation)).toEqual([
        'AmpR',
        'GFP',
        'pLac',
      ]);
    });
  });
});
