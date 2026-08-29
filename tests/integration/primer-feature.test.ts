/**
 * Integration Tests: Primers + Features (services and API routes)
 * v2 entities (no legacy counterpart; locked v2 schema design).
 */

import { Knex } from 'knex';
import { randomUUID } from 'crypto';
import { PrimerService } from '@services/primer.service';
import { FeatureService } from '@services/feature.service';
import { PlasmidService } from '@services/plasmid.service';
import { setQueryBuilder } from '@infrastructure/query-builder';
import { createTestDb, createTestSchema, cleanTestDb } from '../helpers/test-db';

type PlasmidPrimersRoute = typeof import('@app/api/plasmids/[id]/primers/route');
type PrimerRoute = typeof import('@app/api/primers/[id]/route');
type PlasmidFeaturesRoute = typeof import('@app/api/plasmids/[id]/features/route');
type FeatureRoute = typeof import('@app/api/features/[id]/route');

let plasmidPrimersRoute: PlasmidPrimersRoute;
let primerRoute: PrimerRoute;
let plasmidFeaturesRoute: PlasmidFeaturesRoute;
let featureRoute: FeatureRoute;
let primerService: PrimerService;
let featureService: FeatureService;
let plasmidService: PlasmidService;
let db: Knex;

const asNextRequest = (req: Request) => req as never;

function jsonRequest(url: string, method: string, body?: unknown): Request {
  const init: RequestInit = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }
  return new Request(url, init);
}

async function createPlasmid(name: string): Promise<string> {
  const plasmid = await plasmidService.createPlasmid({ id: randomUUID(), name });
  return plasmid.id;
}

describe('Primers + Features (Integration)', () => {
  beforeAll(async () => {
    db = createTestDb();
    setQueryBuilder(db);
    await createTestSchema(db);
    primerService = new PrimerService();
    featureService = new FeatureService();
    plasmidService = new PlasmidService();

    plasmidPrimersRoute = await import('@app/api/plasmids/[id]/primers/route');
    primerRoute = await import('@app/api/primers/[id]/route');
    plasmidFeaturesRoute = await import('@app/api/plasmids/[id]/features/route');
    featureRoute = await import('@app/api/features/[id]/route');
  });

  afterAll(async () => {
    await db.destroy();
    setQueryBuilder(null);
  });

  beforeEach(async () => {
    await cleanTestDb(db);
  });

  describe('PrimerService', () => {
    it('stores sequences uppercase and derives GC%/Tm', async () => {
      const plasmidId = await createPlasmid('pPrim001');

      const primer = await primerService.createPrimer({
        plasmidId,
        name: 'M13-fwd',
        sequence: 'gtaaaacgacggccagt',
      });

      expect(primer.sequence).toBe('GTAAAACGACGGCCAGT');
      expect(Number(primer.gcPercent)).toBeCloseTo(52.9, 1);
      expect(Number(primer.tmCelsius)).toBe(52);
    });

    it('rejects invalid sequences and missing plasmids', async () => {
      const plasmidId = await createPlasmid('pPrim002');

      await expect(
        primerService.createPrimer({ plasmidId, name: 'bad', sequence: 'ACGU' })
      ).rejects.toMatchObject({ code: 'VALIDATION' });

      await expect(
        primerService.createPrimer({ plasmidId: 'nope', name: 'x', sequence: 'ACGT' })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('recomputes derived values on sequence update, leaves them on name update', async () => {
      const plasmidId = await createPlasmid('pPrim003');
      const primer = await primerService.createPrimer({
        plasmidId,
        name: 'p1',
        sequence: 'AATT',
      });
      expect(Number(primer.tmCelsius)).toBe(8);

      const renamed = await primerService.updatePrimer(primer.id, { name: 'p1-renamed' });
      expect(Number(renamed.tmCelsius)).toBe(8);
      expect(Number(renamed.gcPercent)).toBe(0);

      const reseq = await primerService.updatePrimer(primer.id, { sequence: 'ggcc' });
      expect(reseq.sequence).toBe('GGCC');
      expect(Number(reseq.tmCelsius)).toBe(16);
      expect(Number(reseq.gcPercent)).toBe(100);

      // Long sequence: GC% still derived, Wallace Tm no longer applies
      const long = await primerService.updatePrimer(primer.id, { sequence: 'A'.repeat(40) });
      expect(long.tmCelsius).toBeNull();
      expect(Number(long.gcPercent)).toBe(0);
    });
  });

  describe('Primer API', () => {
    it('creates, lists alphabetically, updates, and deletes', async () => {
      const plasmidId = await createPlasmid('pPrim004');

      const created = await plasmidPrimersRoute.POST(
        asNextRequest(
          jsonRequest(`http://localhost/api/plasmids/${plasmidId}/primers`, 'POST', {
            name: 'seq-fwd',
            sequence: 'ACGTACGT',
          })
        ),
        { params: { id: plasmidId } }
      );
      expect(created.status).toBe(201);
      const primer = (await created.json()).data;
      expect(Number(primer.gcPercent)).toBe(50);

      await plasmidPrimersRoute.POST(
        asNextRequest(
          jsonRequest(`http://localhost/api/plasmids/${plasmidId}/primers`, 'POST', {
            name: 'a-first',
            sequence: 'GGGG',
          })
        ),
        { params: { id: plasmidId } }
      );

      const listResponse = await plasmidPrimersRoute.GET(
        asNextRequest(new Request(`http://localhost/api/plasmids/${plasmidId}/primers`)),
        { params: { id: plasmidId } }
      );
      const names = ((await listResponse.json()).data as { name: string }[]).map((p) => p.name);
      expect(names).toEqual(['a-first', 'seq-fwd']);

      const patched = await primerRoute.PATCH(
        asNextRequest(
          jsonRequest(`http://localhost/api/primers/${primer.id}`, 'PATCH', { sequence: 'AAAA' })
        ),
        { params: { id: primer.id } }
      );
      expect(Number((await patched.json()).data.tmCelsius)).toBe(8);

      const deleted = await primerRoute.DELETE(
        asNextRequest(
          new Request(`http://localhost/api/primers/${primer.id}`, { method: 'DELETE' })
        ),
        { params: { id: primer.id } }
      );
      expect(deleted.status).toBe(200);
      expect(await db('primers').count('* as c').first()).toMatchObject({ c: 1 });
    });

    it('returns 400 on unknown fields and 404 on unknown ids', async () => {
      const plasmidId = await createPlasmid('pPrim005');

      const bad = await plasmidPrimersRoute.POST(
        asNextRequest(
          jsonRequest(`http://localhost/api/plasmids/${plasmidId}/primers`, 'POST', {
            name: 'x',
            sequence: 'ACGT',
            tmCelsius: 99,
          })
        ),
        { params: { id: plasmidId } }
      );
      expect(bad.status).toBe(400);

      const missing = await primerRoute.PATCH(
        asNextRequest(jsonRequest('http://localhost/api/primers/nope', 'PATCH', { name: 'y' })),
        { params: { id: 'nope' } }
      );
      expect(missing.status).toBe(404);
    });
  });

  describe('FeatureService', () => {
    it('creates with defaults and validates positions', async () => {
      const plasmidId = await createPlasmid('pFeat001');

      const feature = await featureService.createFeature({
        plasmidId,
        name: 'GFP',
        type: 'gene',
        startPos: 100,
        endPos: 816,
      });
      expect(feature.strand).toBe('+');

      await expect(
        featureService.createFeature({
          plasmidId,
          name: 'bad',
          type: 'gene',
          startPos: 0,
          endPos: 10,
        })
      ).rejects.toMatchObject({ code: 'VALIDATION' });

      await expect(
        featureService.createFeature({
          plasmidId,
          name: 'bad',
          type: 'gene',
          startPos: 20,
          endPos: 10,
        })
      ).rejects.toMatchObject({
        code: 'VALIDATION',
        message: 'startPos must not be greater than endPos',
      });
    });

    it('validates the merged range on partial position updates', async () => {
      const plasmidId = await createPlasmid('pFeat002');
      const feature = await featureService.createFeature({
        plasmidId,
        name: 'promoter',
        type: 'promoter',
        startPos: 10,
        endPos: 50,
        strand: '-',
      });

      // endPos 5 would invert the range against the existing startPos 10
      await expect(featureService.updateFeature(feature.id, { endPos: 5 })).rejects.toMatchObject({
        code: 'VALIDATION',
      });

      const moved = await featureService.updateFeature(feature.id, { startPos: 1, endPos: 5 });
      expect([moved.startPos, moved.endPos, moved.strand]).toEqual([1, 5, '-']);
    });

    it('lists ordered by position', async () => {
      const plasmidId = await createPlasmid('pFeat003');
      await featureService.createFeature({
        plasmidId,
        name: 'late',
        type: 'other',
        startPos: 900,
        endPos: 950,
      });
      await featureService.createFeature({
        plasmidId,
        name: 'early',
        type: 'other',
        startPos: 5,
        endPos: 60,
      });

      const list = await featureService.listPlasmidFeatures(plasmidId);
      expect(list.map((f) => f.name)).toEqual(['early', 'late']);
    });
  });

  describe('Feature API', () => {
    it('creates, updates strand, and deletes', async () => {
      const plasmidId = await createPlasmid('pFeat004');

      const created = await plasmidFeaturesRoute.POST(
        asNextRequest(
          jsonRequest(`http://localhost/api/plasmids/${plasmidId}/features`, 'POST', {
            name: 'His6',
            type: 'his_tag',
            startPos: 1,
            endPos: 18,
          })
        ),
        { params: { id: plasmidId } }
      );
      expect(created.status).toBe(201);
      const feature = (await created.json()).data;
      expect(feature.strand).toBe('+');

      const patched = await featureRoute.PATCH(
        asNextRequest(
          jsonRequest(`http://localhost/api/features/${feature.id}`, 'PATCH', { strand: '-' })
        ),
        { params: { id: feature.id } }
      );
      expect((await patched.json()).data.strand).toBe('-');

      const listResponse = await plasmidFeaturesRoute.GET(
        asNextRequest(new Request(`http://localhost/api/plasmids/${plasmidId}/features`)),
        { params: { id: plasmidId } }
      );
      expect((await listResponse.json()).data).toHaveLength(1);

      const deleted = await featureRoute.DELETE(
        asNextRequest(
          new Request(`http://localhost/api/features/${feature.id}`, { method: 'DELETE' })
        ),
        { params: { id: feature.id } }
      );
      expect(deleted.status).toBe(200);
      expect(await db('features').count('* as c').first()).toMatchObject({ c: 0 });
    });

    it('returns 400 for invalid enum values and 404 for unknown plasmids', async () => {
      const plasmidId = await createPlasmid('pFeat005');

      const bad = await plasmidFeaturesRoute.POST(
        asNextRequest(
          jsonRequest(`http://localhost/api/plasmids/${plasmidId}/features`, 'POST', {
            name: 'x',
            type: 'enhancer',
            startPos: 1,
            endPos: 2,
          })
        ),
        { params: { id: plasmidId } }
      );
      expect(bad.status).toBe(400);

      const missing = await plasmidFeaturesRoute.GET(
        asNextRequest(new Request('http://localhost/api/plasmids/nope/features')),
        { params: { id: 'nope' } }
      );
      expect(missing.status).toBe(404);
    });
  });

  describe('Plasmid delete cascade', () => {
    it('removes primers and features with the plasmid', async () => {
      const plasmidId = await createPlasmid('pCascade2');
      await primerService.createPrimer({ plasmidId, name: 'p', sequence: 'ACGT' });
      await featureService.createFeature({
        plasmidId,
        name: 'f',
        type: 'gene',
        startPos: 1,
        endPos: 9,
      });

      await plasmidService.deletePlasmid(plasmidId);

      expect(await db('primers').count('* as c').first()).toMatchObject({ c: 0 });
      expect(await db('features').count('* as c').first()).toMatchObject({ c: 0 });
    });
  });
});
