/**
 * Integration Tests: Phase 3 — reprint from history, and the Golden Gate
 * part data endpoint.
 */

import { Knex } from 'knex';
import { randomUUID } from 'crypto';
import { LabelService } from '@services/label.service';
import { setQueryBuilder } from '@infrastructure/query-builder';
import { createTestDb, createTestSchema, cleanTestDb } from '../helpers/test-db';

type PrintsRoute = typeof import('@app/api/labels/prints/route');
type GoldenGateRoute = typeof import('@app/api/tools/golden-gate/route');

let printsRoute: PrintsRoute;
let goldenGateRoute: GoldenGateRoute;
let labelService: LabelService;
let db: Knex;

const asNextRequest = (req: Request) => req as never;
const now = () => new Date().toISOString();

async function addPlasmid(
  name: string,
  overrides: { constructName?: string | null; sizeBp?: number | null } = {}
): Promise<string> {
  const id = randomUUID();
  await db('plasmids').insert({
    id,
    name,
    constructName: overrides.constructName ?? null,
    sizeBp: overrides.sizeBp ?? null,
    status: 'draft',
    createdAt: now(),
    updatedAt: now(),
  });
  return id;
}

async function addPrep(plasmidId: string, preppedOn: string, concentrationNgUl: number | null) {
  await db('plasmid_preps').insert({
    id: randomUUID(),
    plasmidId,
    preppedOn,
    operatorInitials: 'JM',
    concentrationNgUl,
    createdAt: now(),
    updatedAt: now(),
  });
}

describe('Phase 3', () => {
  beforeAll(async () => {
    db = createTestDb();
    setQueryBuilder(db);
    await createTestSchema(db);

    printsRoute = await import('@app/api/labels/prints/route');
    goldenGateRoute = await import('@app/api/tools/golden-gate/route');
    labelService = new LabelService();
  });

  afterAll(async () => {
    await db.destroy();
    setQueryBuilder(null);
  });

  beforeEach(async () => {
    await cleanTestDb(db);
  });

  describe('reprint from history', () => {
    it('groups a sheet by the timestamp its labels share', async () => {
      const first = await addPlasmid('pJM0001');
      const second = await addPlasmid('pJM0002');

      await labelService.recordPrints('plasmid', [first, second]);

      const batches = await labelService.listPrintBatches();

      expect(batches).toHaveLength(1);
      expect(batches[0]).toMatchObject({ kind: 'plasmid', count: 2 });
    });

    it('returns the exact ids that were on a past sheet', async () => {
      const first = await addPlasmid('pJM0001');
      const second = await addPlasmid('pJM0002');

      const prints = await labelService.recordPrints('plasmid', [first, second]);
      const printedAt = prints[0]!.printedAt;

      const ids = await labelService.listPrintBatchTargets('plasmid', printedAt);

      expect(ids.sort()).toEqual([first, second].sort());
    });

    it('keeps two prints of the same labels as separate sheets', async () => {
      const id = await addPlasmid('pJM0001');

      await labelService.recordPrints('plasmid', [id]);
      // A second print a moment later is a different sheet
      await new Promise((resolve) => setTimeout(resolve, 5));
      await labelService.recordPrints('plasmid', [id]);

      expect(await labelService.listPrintBatches()).toHaveLength(2);
    });

    it('does not mix plasmid and glycerol sheets', async () => {
      const plasmid = await addPlasmid('pJM0001');
      await db('glycerol_stocks').insert({
        id: 'stock-1',
        stockId: 'CJM1',
        organism: 'E. coli',
        strain: 'TOP10',
        createdAt: now(),
        updatedAt: now(),
      });

      await labelService.recordPrints('plasmid', [plasmid]);
      await labelService.recordPrints('glycerol', ['stock-1']);

      const batches = await labelService.listPrintBatches();
      expect(batches.map((batch) => batch.kind).sort()).toEqual(['glycerol', 'plasmid']);
      expect(batches.every((batch) => batch.count === 1)).toBe(true);
    });

    it('is empty before anything has been printed', async () => {
      expect(await labelService.listPrintBatches()).toEqual([]);
    });

    describe('GET /api/labels/prints', () => {
      it('lists past sheets', async () => {
        const id = await addPlasmid('pJM0001');
        await labelService.recordPrints('plasmid', [id]);

        const response = await printsRoute.GET(
          asNextRequest(new Request('http://localhost/api/labels/prints'))
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.data.batches).toHaveLength(1);
      });

      it('returns one sheet’s ids when asked for it', async () => {
        const id = await addPlasmid('pJM0001');
        const [print] = await labelService.recordPrints('plasmid', [id]);

        const response = await printsRoute.GET(
          asNextRequest(
            new Request(
              `http://localhost/api/labels/prints?kind=plasmid&printedAt=${encodeURIComponent(
                print!.printedAt
              )}`
            )
          )
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.data.ids).toEqual([id]);
      });

      it('400s on a bad kind', async () => {
        const response = await printsRoute.GET(
          asNextRequest(
            new Request('http://localhost/api/labels/prints?kind=sticker&printedAt=2026-01-01')
          )
        );

        expect(response.status).toBe(400);
      });
    });
  });

  describe('Golden Gate part data', () => {
    it('joins each plasmid to its size and newest concentration', async () => {
      const id = await addPlasmid('pJM0001', { constructName: 'pMiso000', sizeBp: 4860 });
      await addPrep(id, '2024-01-31', 48);
      await addPrep(id, '2025-03-25', 148.6);

      const response = await goldenGateRoute.GET(
        asNextRequest(new Request(`http://localhost/api/tools/golden-gate?ids=${id}`))
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.parts[0]).toMatchObject({
        name: 'pJM0001',
        constructName: 'pMiso000',
        sizeBp: 4860,
        // the newest prep, not the first
        concentrationNgUl: 148.6,
      });
    });

    it('reports a missing size and a missing concentration as null', async () => {
      const id = await addPlasmid('pJM0002');

      const response = await goldenGateRoute.GET(
        asNextRequest(new Request(`http://localhost/api/tools/golden-gate?ids=${id}`))
      );
      const body = await response.json();

      expect(body.data.parts[0]).toMatchObject({ sizeBp: null, concentrationNgUl: null });
    });

    it('404s for an unknown plasmid', async () => {
      const response = await goldenGateRoute.GET(
        asNextRequest(new Request('http://localhost/api/tools/golden-gate?ids=nope'))
      );

      expect(response.status).toBe(404);
    });

    it('400s without ids', async () => {
      const response = await goldenGateRoute.GET(
        asNextRequest(new Request('http://localhost/api/tools/golden-gate'))
      );

      expect(response.status).toBe(400);
    });
  });
});
