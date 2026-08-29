/**
 * Integration Tests: OrganismService + GmoService
 * Covers glossary CRUD/uniqueness and GMO lifecycle (create → destroy → delete)
 */

import { Knex } from 'knex';
import { OrganismService } from '@services/organism.service';
import { GmoService } from '@services/gmo.service';
import { PlasmidService } from '@services/plasmid.service';
import { setQueryBuilder } from '@infrastructure/query-builder';
import { createTestDb, createTestSchema, cleanTestDb } from '../helpers/test-db';

const PLASMID_ID = 'plasmid-1';
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

describe('OrganismService + GmoService (Integration)', () => {
  let organismService: OrganismService;
  let gmoService: GmoService;
  let db: Knex;

  beforeAll(async () => {
    db = createTestDb();
    setQueryBuilder(db);
    await createTestSchema(db);
    organismService = new OrganismService();
    gmoService = new GmoService();
  });

  afterAll(async () => {
    await db.destroy();
    setQueryBuilder(null);
  });

  beforeEach(async () => {
    await cleanTestDb(db);
    const now = new Date().toISOString();
    await db('plasmids').insert({
      id: PLASMID_ID,
      name: 'pTest',
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    });
  });

  describe('OrganismService', () => {
    it('creates an organism with defaults', async () => {
      const organism = await organismService.createOrganism({
        id: 'org-1',
        fullName: 'Escherichia coli K-12',
      });
      expect(organism.fullName).toBe('Escherichia coli K-12');
      expect(organism.riskGroup).toBe('1');
      expect(organism.uid).toHaveLength(32);
    });

    it('rejects duplicate full names (case-insensitive)', async () => {
      await organismService.createOrganism({ id: 'org-1', fullName: 'E. coli' });
      await expect(
        organismService.createOrganism({ id: 'org-2', fullName: 'e. COLI' })
      ).rejects.toMatchObject({ code: 'VALIDATION' });
    });

    it('updates fields and rejects rename clashes', async () => {
      await organismService.createOrganism({ id: 'org-1', fullName: 'E. coli' });
      await organismService.createOrganism({ id: 'org-2', fullName: 'S. cerevisiae' });

      const updated = await organismService.updateOrganism('org-1', {
        shortName: 'E. coli',
        riskGroup: '2',
      });
      expect(updated.shortName).toBe('E. coli');
      expect(updated.riskGroup).toBe('2');

      await expect(
        organismService.updateOrganism('org-1', { fullName: 'S. cerevisiae' })
      ).rejects.toMatchObject({ code: 'VALIDATION' });
    });

    it('lists ordered and searches by full/short name', async () => {
      await organismService.createOrganism({
        id: 'org-1',
        fullName: 'Saccharomyces cerevisiae',
        shortName: 'yeast',
      });
      await organismService.createOrganism({ id: 'org-2', fullName: 'Escherichia coli' });

      expect((await organismService.listOrganisms()).map((o) => o.fullName)).toEqual([
        'Escherichia coli',
        'Saccharomyces cerevisiae',
      ]);
      expect((await organismService.listOrganisms('yeast')).map((o) => o.fullName)).toEqual([
        'Saccharomyces cerevisiae',
      ]);
    });

    it('deletes an organism', async () => {
      await organismService.createOrganism({ id: 'org-1', fullName: 'E. coli' });
      await organismService.deleteOrganism('org-1');
      expect(await db('organisms').where('id', 'org-1').first()).toBeUndefined();
    });
  });

  describe('GmoService', () => {
    beforeEach(async () => {
      await organismService.createOrganism({
        id: 'org-1',
        fullName: 'Escherichia coli K-12',
        riskGroup: '2',
      });
    });

    it('creates a GMO with legacy defaults and RG seeded from the organism', async () => {
      const gmo = await gmoService.createGmo({
        id: 'gmo-1',
        plasmidId: PLASMID_ID,
        organismName: 'Escherichia coli K-12',
      });

      expect(gmo.approval).toBe('-');
      expect(gmo.targetRiskGroup).toBe(2);
      expect(gmo.dateGenerated).toMatch(ISO_DATE_PATTERN);
      expect(gmo.entryDate).toMatch(ISO_DATE_PATTERN);
      expect(gmo.dateDestroyed).toBeNull();
    });

    it('allows overriding target risk group and dateGenerated', async () => {
      const gmo = await gmoService.createGmo({
        id: 'gmo-1',
        plasmidId: PLASMID_ID,
        organismName: 'Escherichia coli K-12',
        targetRiskGroup: 1,
        dateGenerated: '2026-01-15',
      });
      expect(gmo.targetRiskGroup).toBe(1);
      expect(gmo.dateGenerated).toBe('2026-01-15');
    });

    it('resolves the organism name case-insensitively to the glossary spelling', async () => {
      const gmo = await gmoService.createGmo({
        id: 'gmo-1',
        plasmidId: PLASMID_ID,
        organismName: 'escherichia COLI k-12',
      });
      expect(gmo.organismName).toBe('Escherichia coli K-12');
    });

    it('rejects an organism not in the glossary', async () => {
      await expect(
        gmoService.createGmo({ plasmidId: PLASMID_ID, organismName: 'Martian microbe' })
      ).rejects.toMatchObject({ code: 'VALIDATION' });
    });

    it('rejects a non-existent plasmid', async () => {
      await expect(
        gmoService.createGmo({ plasmidId: 'ghost', organismName: 'Escherichia coli K-12' })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('rejects an invalid dateGenerated', async () => {
      await expect(
        gmoService.createGmo({
          plasmidId: PLASMID_ID,
          organismName: 'Escherichia coli K-12',
          dateGenerated: '15.01.2026',
        })
      ).rejects.toMatchObject({ code: 'VALIDATION' });
    });

    it('marks destruction via dateDestroyed and can revert it', async () => {
      await gmoService.createGmo({
        id: 'gmo-1',
        plasmidId: PLASMID_ID,
        organismName: 'Escherichia coli K-12',
      });

      const destroyed = await gmoService.updateGmo('gmo-1', { dateDestroyed: '2026-09-01' });
      expect(destroyed.dateDestroyed).toBe('2026-09-01');

      const reverted = await gmoService.updateGmo('gmo-1', { dateDestroyed: null });
      expect(reverted.dateDestroyed).toBeNull();
    });

    it('lists GMOs for a plasmid and deletes records', async () => {
      await gmoService.createGmo({
        id: 'gmo-1',
        plasmidId: PLASMID_ID,
        organismName: 'Escherichia coli K-12',
      });

      expect(await gmoService.listPlasmidGmos(PLASMID_ID)).toHaveLength(1);

      await gmoService.deleteGmo('gmo-1');
      expect(await gmoService.listPlasmidGmos(PLASMID_ID)).toHaveLength(0);
    });

    it('parity: plasmid delete cascades to its GMOs', async () => {
      await gmoService.createGmo({
        id: 'gmo-1',
        plasmidId: PLASMID_ID,
        organismName: 'Escherichia coli K-12',
      });

      await new PlasmidService().deletePlasmid(PLASMID_ID);
      expect(await db('gmos').where('plasmidId', PLASMID_ID).first()).toBeUndefined();
    });
  });
});
