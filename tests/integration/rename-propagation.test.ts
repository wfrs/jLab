/**
 * Integration Tests: rename propagation
 * Feature annotation renames flow into cassette content (legacy
 * update_cassettes); organism renames flow into GMO records and
 * glossary-feature organism references.
 */

import { Knex } from 'knex';
import { GlossaryFeatureService } from '@services/glossary-feature.service';
import { OrganismService } from '@services/organism.service';
import { setQueryBuilder } from '@infrastructure/query-builder';
import { createTestDb, createTestSchema, cleanTestDb } from '../helpers/test-db';

const NOW = new Date().toISOString();

describe('Rename propagation (Integration)', () => {
  let featureService: GlossaryFeatureService;
  let organismService: OrganismService;
  let db: Knex;

  beforeAll(async () => {
    db = createTestDb();
    setQueryBuilder(db);
    await createTestSchema(db);
    featureService = new GlossaryFeatureService();
    organismService = new OrganismService();
  });

  afterAll(async () => {
    await db.destroy();
    setQueryBuilder(null);
  });

  beforeEach(async () => {
    await cleanTestDb(db);
    await db('plasmids').insert({
      id: 'p-1',
      name: 'pTest',
      status: 'draft',
      createdAt: NOW,
      updatedAt: NOW,
    });
  });

  describe('feature annotation rename', () => {
    beforeEach(async () => {
      await featureService.createFeature({ id: 'f-gfp', annotation: 'GFP' });
      await featureService.createFeature({ id: 'f-rfp', annotation: 'RFP' });
      await db('cassettes').insert([
        {
          id: 'cas-1',
          plasmidId: 'p-1',
          name: 'GFP-RFP',
          type: 'other',
          position: 0,
          createdAt: NOW,
          updatedAt: NOW,
        },
        {
          id: 'cas-2',
          plasmidId: 'p-1',
          name: 'GFP[bright]-GFPx',
          type: 'other',
          position: 1,
          createdAt: NOW,
          updatedAt: NOW,
        },
        {
          id: 'cas-3',
          plasmidId: 'p-1',
          name: 'RFP',
          type: 'other',
          position: 2,
          createdAt: NOW,
          updatedAt: NOW,
        },
      ]);
    });

    it('propagates the rename into cassette content (full tokens, variants kept)', async () => {
      const updated = await featureService.updateFeature('f-gfp', { annotation: 'eGFP' });
      expect(updated.annotation).toBe('eGFP');

      const cassettes = await db('cassettes').orderBy('position');
      expect(cassettes.map((c: { name: string }) => c.name)).toEqual([
        'eGFP-RFP',
        // Variant preserved; substring token GFPx untouched
        'eGFP[bright]-GFPx',
        // Cassette without the token untouched
        'RFP',
      ]);
    });

    it('normalizes the new annotation before propagating', async () => {
      await featureService.updateFeature('f-gfp', { annotation: 'e GFP' });
      const cassette = await db('cassettes').where('id', 'cas-1').first();
      expect(cassette.name).toBe('e_GFP-RFP');
    });

    it('does not touch cassettes on a non-rename update', async () => {
      const before = await db('cassettes').where('id', 'cas-1').first();
      await featureService.updateFeature('f-gfp', { risk: 'RG2' });
      const after = await db('cassettes').where('id', 'cas-1').first();
      expect(after.name).toBe(before.name);
      expect(after.updatedAt).toBe(before.updatedAt);
    });

    it('still rejects renames that clash with an existing annotation', async () => {
      await expect(
        featureService.updateFeature('f-gfp', { annotation: 'RFP' })
      ).rejects.toMatchObject({ code: 'VALIDATION' });
      const cassette = await db('cassettes').where('id', 'cas-1').first();
      expect(cassette.name).toBe('GFP-RFP');
    });
  });

  describe('organism rename', () => {
    beforeEach(async () => {
      await organismService.createOrganism({
        id: 'org-1',
        fullName: 'Escherichia coli K-12',
        shortName: 'E. coli',
        riskGroup: '1',
      });
      await featureService.createFeature({
        id: 'f-1',
        annotation: 'pLac',
        organism: 'E. coli',
      });
      await featureService.createFeature({
        id: 'f-2',
        annotation: 'oriC',
        organism: 'Escherichia coli K-12',
      });
      await db('gmos').insert({
        id: 'gmo-1',
        plasmidId: 'p-1',
        organismName: 'Escherichia coli K-12',
        approval: '-',
        targetRiskGroup: 1,
        dateGenerated: '2026-08-01',
        dateDestroyed: null,
        entryDate: '2026-08-01',
        createdAt: NOW,
        updatedAt: NOW,
      });
    });

    it('full-name rename propagates into GMOs and full-name feature references', async () => {
      await organismService.updateOrganism('org-1', { fullName: 'Escherichia coli MG1655' });

      const gmo = await db('gmos').where('id', 'gmo-1').first();
      expect(gmo.organismName).toBe('Escherichia coli MG1655');

      const fullNameRef = await db('glossary_features').where('id', 'f-2').first();
      expect(fullNameRef.organism).toBe('Escherichia coli MG1655');

      // Short-name reference untouched by a full-name rename
      const shortNameRef = await db('glossary_features').where('id', 'f-1').first();
      expect(shortNameRef.organism).toBe('E. coli');
    });

    it('short-name rename propagates into short-name feature references', async () => {
      await organismService.updateOrganism('org-1', { shortName: 'E. coli K12' });

      const shortNameRef = await db('glossary_features').where('id', 'f-1').first();
      expect(shortNameRef.organism).toBe('E. coli K12');

      // GMOs link by full name — untouched
      const gmo = await db('gmos').where('id', 'gmo-1').first();
      expect(gmo.organismName).toBe('Escherichia coli K-12');
    });

    it('non-rename updates do not touch linked records', async () => {
      await organismService.updateOrganism('org-1', { riskGroup: '2' });
      const gmo = await db('gmos').where('id', 'gmo-1').first();
      expect(gmo.organismName).toBe('Escherichia coli K-12');
    });
  });
});
