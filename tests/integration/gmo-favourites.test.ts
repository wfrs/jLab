/**
 * Integration Tests: Batch-add favourite organisms as GMOs
 * (legacy -ADDFAV-, gmocu.py:2112-2137)
 */

import { Knex } from 'knex';
import { GmoService } from '@services/gmo.service';
import { OrganismService } from '@services/organism.service';
import { OrganismTargetService } from '@services/organism-target.service';
import { setQueryBuilder } from '@infrastructure/query-builder';
import { createTestDb, createTestSchema, cleanTestDb } from '../helpers/test-db';

type FavouritesRoute = typeof import('@app/api/plasmids/[id]/gmos/favourites/route');

const PLASMID_ID = 'plasmid-1';
const asNextRequest = (req: Request) => req as never;
const today = new Date().toISOString().slice(0, 10);

describe('Add favourite organisms as GMOs (Integration)', () => {
  let gmoService: GmoService;
  let organismService: OrganismService;
  let targetService: OrganismTargetService;
  let route: FavouritesRoute;
  let db: Knex;

  beforeAll(async () => {
    db = createTestDb();
    setQueryBuilder(db);
    await createTestSchema(db);
    gmoService = new GmoService();
    organismService = new OrganismService();
    targetService = new OrganismTargetService();
    route = await import('@app/api/plasmids/[id]/gmos/favourites/route');
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
    await organismService.createOrganism({
      id: 'org-coli',
      fullName: 'Escherichia coli',
      shortName: 'EsCo',
      riskGroup: '1',
    });
    await organismService.createOrganism({
      id: 'org-agro',
      fullName: 'Agrobacterium tumefaciens',
      riskGroup: '2',
    });
  });

  async function favouriteBoth(): Promise<void> {
    const coli = await targetService.addTarget({ organismName: 'Escherichia coli' });
    const agro = await targetService.addTarget({ organismName: 'Agrobacterium tumefaciens' });
    await targetService.setFavourite(coli.id, true);
    await targetService.setFavourite(agro.id, true);
  }

  it('adds every favourite with single-add defaults (approval "-", RG from glossary)', async () => {
    await favouriteBoth();

    const result = await gmoService.addFavouritesAsGmos(PLASMID_ID);

    expect(result.skipped).toEqual([]);
    expect(result.created.map((gmo) => gmo.organismName).sort()).toEqual([
      'Agrobacterium tumefaciens',
      'Escherichia coli',
    ]);
    const coli = result.created.find((gmo) => gmo.organismName === 'Escherichia coli');
    expect(coli).toMatchObject({
      approval: '-',
      targetRiskGroup: 1,
      dateGenerated: today,
      dateDestroyed: null,
    });
    // RG seeds per organism, not per batch
    const agro = result.created.find((gmo) => gmo.organismName === 'Agrobacterium tumefaciens');
    expect(agro!.targetRiskGroup).toBe(2);
  });

  it('leaves non-favourite targets out of the batch', async () => {
    const coli = await targetService.addTarget({ organismName: 'Escherichia coli' });
    await targetService.addTarget({ organismName: 'Agrobacterium tumefaciens' });
    await targetService.setFavourite(coli.id, true);

    const result = await gmoService.addFavouritesAsGmos(PLASMID_ID);

    expect(result.created.map((gmo) => gmo.organismName)).toEqual(['Escherichia coli']);
  });

  it('skips organisms that already have a live GMO (deviation: legacy duplicated)', async () => {
    await favouriteBoth();
    await gmoService.createGmo({
      id: 'gmo-live',
      plasmidId: PLASMID_ID,
      organismName: 'Escherichia coli',
    });

    const result = await gmoService.addFavouritesAsGmos(PLASMID_ID);

    expect(result.created.map((gmo) => gmo.organismName)).toEqual(['Agrobacterium tumefaciens']);
    expect(result.skipped).toEqual(['Escherichia coli']);
  });

  it('recognizes an imported GMO recorded under the organism short name', async () => {
    await favouriteBoth();
    // v1 imports store the legacy short name — createGmo would normalize, so
    // seed the row the way the importer leaves it
    const now = new Date().toISOString();
    await db('gmos').insert({
      id: 'gmo-imported',
      plasmidId: PLASMID_ID,
      organismName: 'EsCo',
      approval: '-',
      targetRiskGroup: 1,
      dateGenerated: '2024-01-23',
      dateDestroyed: null,
      entryDate: '2024-01-23',
      createdAt: now,
      updatedAt: now,
    });

    const result = await gmoService.addFavouritesAsGmos(PLASMID_ID);

    expect(result.created.map((gmo) => gmo.organismName)).toEqual(['Agrobacterium tumefaciens']);
    expect(result.skipped).toEqual(['Escherichia coli']);
  });

  it('a destroyed GMO does not block re-adding its organism', async () => {
    await favouriteBoth();
    const gmo = await gmoService.createGmo({
      id: 'gmo-destroyed',
      plasmidId: PLASMID_ID,
      organismName: 'Escherichia coli',
    });
    await gmoService.updateGmo(gmo.id, { dateDestroyed: today });

    const result = await gmoService.addFavouritesAsGmos(PLASMID_ID);

    expect(result.skipped).toEqual([]);
    expect(result.created.map((gmo2) => gmo2.organismName).sort()).toEqual([
      'Agrobacterium tumefaciens',
      'Escherichia coli',
    ]);
    // The plasmid now carries three records: the destroyed one and two live
    expect(await db('gmos').where('plasmidId', PLASMID_ID)).toHaveLength(3);
  });

  it('does nothing when no favourites are configured', async () => {
    await targetService.addTarget({ organismName: 'Escherichia coli' });

    const result = await gmoService.addFavouritesAsGmos(PLASMID_ID);

    expect(result).toEqual({ created: [], skipped: [] });
  });

  it('rejects an unknown plasmid', async () => {
    await expect(gmoService.addFavouritesAsGmos('nope')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  describe('POST /api/plasmids/[id]/gmos/favourites', () => {
    it('returns the created and skipped sets', async () => {
      await favouriteBoth();
      await gmoService.createGmo({
        id: 'gmo-live',
        plasmidId: PLASMID_ID,
        organismName: 'Escherichia coli',
      });

      const response = await route.POST(
        asNextRequest(
          new Request(`http://localhost/api/plasmids/${PLASMID_ID}/gmos/favourites`, {
            method: 'POST',
          })
        ),
        { params: { id: PLASMID_ID } }
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.created).toHaveLength(1);
      expect(body.data.created[0].organismName).toBe('Agrobacterium tumefaciens');
      expect(body.data.skipped).toEqual(['Escherichia coli']);
    });

    it('404s for an unknown plasmid', async () => {
      const response = await route.POST(
        asNextRequest(
          new Request('http://localhost/api/plasmids/nope/gmos/favourites', { method: 'POST' })
        ),
        { params: { id: 'nope' } }
      );

      expect(response.status).toBe(404);
    });
  });
});
