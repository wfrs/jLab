/**
 * Integration Tests: ReportService (Formblatt Z + plasmid list)
 * Verifies the glossary integrity gate and legacy-parity row assembly
 */

import { Knex } from 'knex';
import { ReportService } from '@services/report.service';
import { setQueryBuilder } from '@infrastructure/query-builder';
import { createTestDb, createTestSchema, cleanTestDb } from '../helpers/test-db';

describe('ReportService (Integration)', () => {
  let service: ReportService;
  let db: Knex;

  const NOW = new Date().toISOString();

  beforeAll(async () => {
    db = createTestDb();
    setQueryBuilder(db);
    await createTestSchema(db);
    service = new ReportService();
  });

  afterAll(async () => {
    await db.destroy();
    setQueryBuilder(null);
  });

  beforeEach(async () => {
    await cleanTestDb(db);
  });

  /** Seeds a fully consistent dataset: 1 plasmid, 2 cassette tokens, 1 GMO */
  async function seedConsistentData() {
    await db('organisms').insert([
      {
        id: 'org-ecoli',
        fullName: 'Escherichia coli K-12',
        shortName: 'E. coli',
        riskGroup: '1',
        uid: 'u1',
        synced: false,
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        id: 'org-jelly',
        fullName: 'Aequorea victoria',
        shortName: 'A. victoria',
        riskGroup: '1',
        uid: 'u2',
        synced: false,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ]);

    await db('glossary_features').insert([
      {
        id: 'f-plac',
        annotation: 'pLac',
        alias: 'lac promoter',
        risk: 'No Risk',
        organism: 'E. coli',
        uid: 'fu1',
        synced: false,
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        id: 'f-gfp',
        annotation: 'GFP',
        alias: 'green fluorescent protein',
        risk: '',
        organism: 'A. victoria',
        uid: 'fu2',
        synced: false,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ]);

    await db('plasmids').insert({
      id: 'p-1',
      name: 'pTest',
      backboneVector: 'pUC19',
      status: 'draft',
      createdAt: NOW,
      updatedAt: NOW,
    });

    await db('cassettes').insert({
      id: 'cas-1',
      plasmidId: 'p-1',
      name: 'pLac-GFP[bright]',
      type: 'other',
      position: 0,
      createdAt: NOW,
      updatedAt: NOW,
    });

    await db('gmos').insert({
      id: 'gmo-1',
      plasmidId: 'p-1',
      organismName: 'Escherichia coli K-12',
      approval: 'Az. 42',
      targetRiskGroup: 1,
      dateGenerated: '2026-08-01',
      dateDestroyed: null,
      entryDate: '2026-08-02',
      createdAt: NOW,
      updatedAt: NOW,
    });
  }

  describe('checkGlossaryIntegrity', () => {
    it('passes on a consistent dataset', async () => {
      await seedConsistentData();
      const result = await service.checkGlossaryIntegrity();
      expect(result.ok).toBe(true);
      expect(result.missingFeatures).toEqual([]);
      expect(result.missingOrganisms).toEqual([]);
    });

    it('flags cassette tokens missing from the feature glossary as "plasmid: token"', async () => {
      await seedConsistentData();
      await db('cassettes').insert({
        id: 'cas-2',
        plasmidId: 'p-1',
        name: 'pLac-XXX',
        type: 'other',
        position: 1,
        createdAt: NOW,
        updatedAt: NOW,
      });

      const result = await service.checkGlossaryIntegrity();
      expect(result.ok).toBe(false);
      expect(result.missingFeatures).toEqual(['pTest: XXX']);
    });

    it('flags feature organisms missing from the organism glossary', async () => {
      await seedConsistentData();
      await db('glossary_features').where('id', 'f-gfp').update({ organism: 'Ghost fish' });

      const result = await service.checkGlossaryIntegrity();
      expect(result.ok).toBe(false);
      expect(result.missingOrganisms).toEqual(['GFP: Ghost fish']);
    });

    it('flags features with no organism set and GMO organisms not in the glossary', async () => {
      await seedConsistentData();
      await db('glossary_features').where('id', 'f-plac').update({ organism: null });
      await db('organisms').where('id', 'org-ecoli').delete();

      const result = await service.checkGlossaryIntegrity();
      expect(result.ok).toBe(false);
      expect(result.missingOrganisms).toContain('pLac: (no organism set)');
      expect(result.missingOrganisms).toContain('GMO: Escherichia coli K-12');
    });
  });

  describe('buildFormblattZRows', () => {
    it('throws a VALIDATION DomainError with details when the gate fails', async () => {
      await seedConsistentData();
      await db('cassettes').insert({
        id: 'cas-2',
        plasmidId: 'p-1',
        name: 'YYY',
        type: 'other',
        position: 1,
        createdAt: NOW,
        updatedAt: NOW,
      });

      await expect(service.buildFormblattZRows()).rejects.toMatchObject({
        code: 'VALIDATION',
        details: { missingFeatures: ['pTest: YYY'] },
      });
    });

    it('assembles one legacy-parity row per GMO', async () => {
      await seedConsistentData();

      const rows = await service.buildFormblattZRows();
      expect(rows).toHaveLength(1);

      const row = rows[0];
      expect(row.no).toBe('1');
      // Donor: feature organisms of the used tokens, joined with |
      expect(row.donor).toBe('E. coli|A. victoria');
      expect(row.donorRg).toBe('1|1');
      expect(row.recipient).toBe('Escherichia coli K-12');
      expect(row.recipientRg).toBe('1');
      expect(row.vector).toBe('pUC19');
      // Tokens with variants stripped
      expect(row.dna).toBe('pLac|GFP');
      // Empty risk becomes 'None' (legacy)
      expect(row.dnaRisk).toBe('No Risk|None');
      // GMO name = organism short name + '-' + plasmid name (legacy composition)
      expect(row.gmoName).toBe('E. coli-pTest');
      expect(row.gmoRg).toBe('1');
      expect(row.gmoApproval).toBe('Az. 42');
      expect(row.dateGenerated).toBe('2026-08-01');
      expect(row.dateDestroyed).toBe('');
      expect(row.entryDate).toBe('2026-08-02');
    });

    it('returns empty rows when there are no GMOs', async () => {
      await seedConsistentData();
      await db('gmos').delete();
      expect(await service.buildFormblattZRows()).toEqual([]);
    });
  });

  describe('buildPlasmidListRows', () => {
    it('lists plasmids ordered by name with v2 fields', async () => {
      await seedConsistentData();
      await db('plasmids').insert({
        id: 'p-2',
        name: 'pAlpha',
        description: 'first',
        sizeBp: 1234,
        status: 'validated',
        createdAt: NOW,
        updatedAt: NOW,
      });

      const rows = await service.buildPlasmidListRows();
      expect(rows.map((r) => r.name)).toEqual(['pAlpha', 'pTest']);
      expect(rows[0]).toMatchObject({
        no: 1,
        description: 'first',
        sizeBp: '1234',
        status: 'validated',
      });
      expect(rows[1].backboneVector).toBe('pUC19');
    });
  });
});
