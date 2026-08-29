/**
 * Integration Tests: data quality checks (service and API route)
 * Legacy parity (gmocu.py check_plasmids L1696 / check_features L1729 /
 * check_organisms L1774): missing cassette tokens, missing organisms,
 * duplicate names, records without backbone/cassettes/GMOs, incomplete
 * glossary entries, and unused ("redundant") glossary entries.
 */

import { Knex } from 'knex';
import { randomUUID } from 'crypto';
import { DataQualityService, HealthCheck, HealthReport } from '@services/data-quality.service';
import { setQueryBuilder } from '@infrastructure/query-builder';
import { createTestDb, createTestSchema, cleanTestDb } from '../helpers/test-db';

type HealthRoute = typeof import('@app/api/health/route');

let healthRoute: HealthRoute;
let service: DataQualityService;
let db: Knex;

const asNextRequest = (req: Request) => req as never;
const now = () => new Date().toISOString();

/** Finds a check by id and returns its items (fails loudly if absent) */
function itemsOf(report: HealthReport, id: string): string[] {
  const check = report.checks.find((c: HealthCheck) => c.id === id);
  if (!check) {
    throw new Error(`check not found: ${id}`);
  }
  return check.items;
}

async function addPlasmid(
  name: string,
  overrides: Partial<{ backboneVector: string | null }> = {}
): Promise<string> {
  const id = randomUUID();
  await db('plasmids').insert({
    id,
    name,
    description: null,
    sizeBp: null,
    parentId: null,
    backboneVector: 'pUC19',
    status: 'draft',
    createdAt: now(),
    updatedAt: now(),
    ...overrides,
  });
  return id;
}

async function addCassette(plasmidId: string, content: string): Promise<void> {
  await db('cassettes').insert({
    id: randomUUID(),
    plasmidId,
    name: content,
    sequence: null,
    type: 'other',
    position: 0,
    createdAt: now(),
    updatedAt: now(),
  });
}

async function addFeature(
  annotation: string,
  overrides: Partial<{ alias: string | null; organism: string | null; risk: string }> = {}
): Promise<void> {
  await db('glossary_features').insert({
    id: randomUUID(),
    annotation,
    alias: `${annotation} alias`,
    risk: 'No Risk',
    organism: 'Escherichia coli',
    uid: randomUUID().replace(/-/g, ''),
    synced: false,
    createdAt: now(),
    updatedAt: now(),
    ...overrides,
  });
}

async function addOrganism(fullName: string, shortName: string | null = null): Promise<void> {
  await db('organisms').insert({
    id: randomUUID(),
    fullName,
    shortName,
    riskGroup: '1',
    uid: randomUUID().replace(/-/g, ''),
    synced: false,
    createdAt: now(),
    updatedAt: now(),
  });
}

async function addGmo(plasmidId: string, organismName: string): Promise<void> {
  await db('gmos').insert({
    id: randomUUID(),
    plasmidId,
    organismName,
    approval: '-',
    targetRiskGroup: 1,
    dateGenerated: '2026-01-01',
    dateDestroyed: null,
    entryDate: '2026-01-01',
    createdAt: now(),
    updatedAt: now(),
  });
}

/** A database with no findings at all — the baseline for each test */
async function seedCleanDatabase(): Promise<string> {
  await addOrganism('Escherichia coli', 'E. coli');
  await addFeature('pLac');
  const plasmidId = await addPlasmid('pClean');
  await addCassette(plasmidId, 'pLac');
  await addGmo(plasmidId, 'Escherichia coli');
  return plasmidId;
}

describe('Data quality checks (Integration)', () => {
  beforeAll(async () => {
    db = createTestDb();
    setQueryBuilder(db);
    await createTestSchema(db);
    service = new DataQualityService();
    healthRoute = await import('@app/api/health/route');
  });

  afterAll(async () => {
    await db.destroy();
    setQueryBuilder(null);
  });

  beforeEach(async () => {
    await cleanTestDb(db);
  });

  describe('clean database', () => {
    it('reports ok with every check passing', async () => {
      await seedCleanDatabase();

      const report = await service.runChecks();

      expect(report.ok).toBe(true);
      expect(report.errorCount).toBe(0);
      expect(report.warningCount).toBe(0);
      expect(report.infoCount).toBe(0);
      expect(report.checks.every((c) => c.items.length === 0)).toBe(true);
      // Every check is always present, passing ones included
      expect(report.checks).toHaveLength(10);
    });

    it('is empty-database safe', async () => {
      const report = await service.runChecks();

      expect(report.ok).toBe(true);
      expect(report.checks.every((c) => c.items.length === 0)).toBe(true);
    });
  });

  describe('error-level checks (block Formblatt-Z)', () => {
    it('reports cassette tokens missing from the glossary as "plasmid: token"', async () => {
      await seedCleanDatabase();
      const plasmidId = await addPlasmid('pMissing');
      await addCassette(plasmidId, 'pLac-GHOST');
      await addGmo(plasmidId, 'Escherichia coli');

      const report = await service.runChecks();

      expect(itemsOf(report, 'missing-features')).toEqual(['pMissing: GHOST']);
      expect(report.ok).toBe(false);
      expect(report.errorCount).toBe(1);
    });

    it('ignores bracket variants when resolving tokens (legacy tokenization)', async () => {
      await seedCleanDatabase();
      const plasmidId = await addPlasmid('pVariant');
      await addCassette(plasmidId, 'pLac[v2]');
      await addGmo(plasmidId, 'Escherichia coli');

      const report = await service.runChecks();

      expect(itemsOf(report, 'missing-features')).toEqual([]);
    });

    it('reports organisms referenced by features or GMOs but absent from the glossary', async () => {
      await seedCleanDatabase();
      await addFeature('T7term', { organism: 'Aequorea victoria' });
      const plasmidId = await addPlasmid('pOrg');
      await addCassette(plasmidId, 'T7term');
      await addGmo(plasmidId, 'Bacillus subtilis');

      const report = await service.runChecks();

      expect(itemsOf(report, 'missing-organisms')).toEqual(
        expect.arrayContaining(['T7term: Aequorea victoria', 'GMO: Bacillus subtilis'])
      );
      expect(report.ok).toBe(false);
    });
  });

  describe('warning-level checks (record completeness)', () => {
    it('reports duplicate plasmid names once each', async () => {
      await seedCleanDatabase();
      await addPlasmid('pDupe');
      await addPlasmid('pDupe');
      await addPlasmid('pDupe');

      const report = await service.runChecks();

      expect(itemsOf(report, 'duplicate-plasmid-names')).toEqual(['pDupe']);
      // Warnings never block exports
      expect(report.ok).toBe(true);
      expect(report.warningCount).toBeGreaterThan(0);
    });

    it('reports plasmids with a blank original vector (null or whitespace)', async () => {
      await seedCleanDatabase();
      await addPlasmid('pNullVector', { backboneVector: null });
      await addPlasmid('pBlankVector', { backboneVector: '   ' });

      const report = await service.runChecks();

      expect(itemsOf(report, 'plasmids-without-backbone').sort()).toEqual([
        'pBlankVector',
        'pNullVector',
      ]);
    });

    it('reports plasmids without cassettes and without GMOs', async () => {
      await seedCleanDatabase();
      await addPlasmid('pBare');

      const report = await service.runChecks();

      expect(itemsOf(report, 'plasmids-without-cassettes')).toEqual(['pBare']);
      expect(itemsOf(report, 'plasmids-without-gmos')).toEqual(['pBare']);
    });

    it('reports glossary features with empty alias, organism, or risk', async () => {
      await seedCleanDatabase();
      await addFeature('noAlias', { alias: '' });
      await addFeature('noOrganism', { organism: null });

      const report = await service.runChecks();

      const items = itemsOf(report, 'incomplete-glossary-features');
      expect(items).toEqual(
        expect.arrayContaining(['noAlias: missing alias', 'noOrganism: missing organism'])
      );
    });

    it('reports duplicate organism short names', async () => {
      await seedCleanDatabase();
      await addOrganism('Escherichia coli K-12', 'E. coli');

      const report = await service.runChecks();

      expect(itemsOf(report, 'duplicate-organism-short-names')).toEqual(['E. coli']);
    });
  });

  describe('info-level checks (housekeeping)', () => {
    it('reports glossary features no cassette uses', async () => {
      await seedCleanDatabase();
      await addFeature('neverUsed');

      const report = await service.runChecks();

      expect(itemsOf(report, 'redundant-features')).toEqual(['neverUsed']);
      expect(report.ok).toBe(true);
      expect(report.infoCount).toBeGreaterThan(0);
    });

    it('reports organisms nothing references, matching by short or full name', async () => {
      await seedCleanDatabase();
      await addOrganism('Unused organism', 'U. org');
      // Referenced by short name only — must NOT be reported as unused
      await addOrganism('Aequorea victoria', 'A. victoria');
      await addFeature('GFP', { organism: 'A. victoria' });
      const plasmidId = await addPlasmid('pGfp');
      await addCassette(plasmidId, 'GFP');
      await addGmo(plasmidId, 'Escherichia coli');

      const report = await service.runChecks();

      expect(itemsOf(report, 'redundant-organisms')).toEqual(['Unused organism']);
    });
  });

  describe('GET /api/health', () => {
    it('returns the full report in a success envelope', async () => {
      await seedCleanDatabase();

      const response = await healthRoute.GET(
        asNextRequest(new Request('http://localhost/api/health'))
      );
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.ok).toBe(true);
      expect(json.data.checks).toHaveLength(10);
      expect(json.correlationId).toBeDefined();
    });

    it('returns 200 with ok=false when findings exist (findings are data, not errors)', async () => {
      await seedCleanDatabase();
      const plasmidId = await addPlasmid('pBroken');
      await addCassette(plasmidId, 'NOPE');
      await addGmo(plasmidId, 'Escherichia coli');

      const response = await healthRoute.GET(
        asNextRequest(new Request('http://localhost/api/health'))
      );
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.ok).toBe(false);
      expect(json.data.errorCount).toBe(1);
    });
  });

  describe('plasmidReadiness (row-level Formblatt-Z indicator)', () => {
    const levelOf = (
      entries: Awaited<ReturnType<DataQualityService['plasmidReadiness']>>,
      id: string
    ) => entries.find((e) => e.plasmidId === id);

    it('marks a complete plasmid ready with no reasons', async () => {
      const plasmidId = await seedCleanDatabase();

      const entries = await service.plasmidReadiness();

      expect(entries).toHaveLength(1);
      expect(levelOf(entries, plasmidId)).toEqual({
        plasmidId,
        level: 'ready',
        reasons: [],
      });
    });

    it('blocks the plasmid whose cassette token is unknown', async () => {
      const cleanId = await seedCleanDatabase();
      const brokenId = await addPlasmid('pBroken');
      await addCassette(brokenId, 'pLac-GHOST');
      await addGmo(brokenId, 'Escherichia coli');

      const entries = await service.plasmidReadiness();

      expect(levelOf(entries, brokenId)?.level).toBe('blocked');
      expect(levelOf(entries, brokenId)?.reasons).toContain(
        'Cassette token not in glossary: GHOST'
      );
      // The healthy plasmid is unaffected by its neighbour
      expect(levelOf(entries, cleanId)?.level).toBe('ready');
    });

    it('blocks on an unresolvable GMO organism and on a feature organism', async () => {
      await seedCleanDatabase();
      const gmoId = await addPlasmid('pBadGmo');
      await addCassette(gmoId, 'pLac');
      await addGmo(gmoId, 'Bacillus subtilis');

      await addFeature('orphanFeat', { organism: 'Nonexistent organism' });
      const featId = await addPlasmid('pBadFeature');
      await addCassette(featId, 'orphanFeat');
      await addGmo(featId, 'Escherichia coli');

      const entries = await service.plasmidReadiness();

      expect(levelOf(entries, gmoId)?.reasons).toContain(
        'GMO organism not in glossary: Bacillus subtilis'
      );
      expect(levelOf(entries, featId)?.reasons).toContain(
        'Organism not in glossary: Nonexistent organism (feature orphanFeat)'
      );
    });

    it('marks plasmids incomplete for missing cassettes, GMOs, or original vector', async () => {
      await seedCleanDatabase();
      const bareId = await addPlasmid('pBare', { backboneVector: null });

      const entries = await service.plasmidReadiness();
      const bare = levelOf(entries, bareId);

      expect(bare?.level).toBe('incomplete');
      expect(bare?.reasons).toEqual([
        'No cassettes — contributes no nucleic acids or donor organisms',
        'No GMO records — will not appear in Formblatt-Z',
        'No original vector (Ausgangsvektor)',
      ]);
    });

    it('reports blocking reasons before incomplete ones, deduplicated', async () => {
      await seedCleanDatabase();
      const id = await addPlasmid('pBoth', { backboneVector: null });
      // Same unknown token twice — one reason, not two
      await addCassette(id, 'GHOST');
      await addCassette(id, 'GHOST-pLac');

      const entries = await service.plasmidReadiness();
      const entry = levelOf(entries, id);

      expect(entry?.level).toBe('blocked');
      expect(entry?.reasons).toEqual([
        'Cassette token not in glossary: GHOST',
        'No GMO records — will not appear in Formblatt-Z',
        'No original vector (Ausgangsvektor)',
      ]);
    });

    it('agrees with the global gate: any blocked plasmid means ok is false', async () => {
      await seedCleanDatabase();
      const id = await addPlasmid('pGate');
      await addCassette(id, 'MISSING_TOKEN');
      await addGmo(id, 'Escherichia coli');

      const [entries, report] = await Promise.all([
        service.plasmidReadiness(),
        service.runChecks(),
      ]);

      expect(entries.some((e) => e.level === 'blocked')).toBe(true);
      expect(report.ok).toBe(false);
    });

    it('GET /api/plasmids/readiness returns one entry per plasmid', async () => {
      await seedCleanDatabase();
      await addPlasmid('pSecond');

      const readinessRoute = await import('@app/api/plasmids/readiness/route');
      const response = await readinessRoute.GET(
        asNextRequest(new Request('http://localhost/api/plasmids/readiness'))
      );
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data).toHaveLength(2);
      expect(json.data.map((e: { level: string }) => e.level).sort()).toEqual([
        'incomplete',
        'ready',
      ]);
    });
  });

  describe('consistency with the export gate', () => {
    it('ok matches the ReportService glossary integrity gate', async () => {
      await seedCleanDatabase();
      const plasmidId = await addPlasmid('pGate');
      await addCassette(plasmidId, 'UNKNOWN_TOKEN');
      await addGmo(plasmidId, 'Escherichia coli');

      const report = await service.runChecks();
      const { ReportService } = await import('@services/report.service');
      const integrity = await new ReportService().checkGlossaryIntegrity();

      expect(report.ok).toBe(integrity.ok);
      expect(itemsOf(report, 'missing-features')).toEqual(integrity.missingFeatures);
    });
  });
});
