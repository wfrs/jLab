/**
 * Integration Tests: Target organism shortlist
 * (legacy OrganismSelection + OrganismFavourites, gmocu.py Settings tab)
 *
 * Covers OrganismTargetService, the propagation paths in OrganismService
 * (rename follows, delete cascades), and the /api/settings/organism-targets
 * routes.
 */

import { Knex } from 'knex';
import { OrganismService } from '@services/organism.service';
import { OrganismTargetService } from '@services/organism-target.service';
import { setQueryBuilder } from '@infrastructure/query-builder';
import { createTestDb, createTestSchema, cleanTestDb } from '../helpers/test-db';

type ListRoute = typeof import('@app/api/settings/organism-targets/route');
type EntryRoute = typeof import('@app/api/settings/organism-targets/[id]/route');

const asNextRequest = (req: Request) => req as never;

describe('Target organism shortlist (Integration)', () => {
  let organismService: OrganismService;
  let targetService: OrganismTargetService;
  let listRoute: ListRoute;
  let entryRoute: EntryRoute;
  let db: Knex;

  beforeAll(async () => {
    db = createTestDb();
    setQueryBuilder(db);
    await createTestSchema(db);
    organismService = new OrganismService();
    targetService = new OrganismTargetService();
    listRoute = await import('@app/api/settings/organism-targets/route');
    entryRoute = await import('@app/api/settings/organism-targets/[id]/route');
  });

  afterAll(async () => {
    await db.destroy();
    setQueryBuilder(null);
  });

  beforeEach(async () => {
    await cleanTestDb(db);
    await organismService.createOrganism({
      id: 'org-coli',
      fullName: 'Escherichia coli',
      shortName: 'E. coli',
      riskGroup: '1',
    });
    await organismService.createOrganism({
      id: 'org-agro',
      fullName: 'Agrobacterium tumefaciens',
      riskGroup: '1',
    });
  });

  describe('OrganismTargetService', () => {
    it('adds a glossary organism and stores its canonical full name', async () => {
      const target = await targetService.addTarget({ organismName: '  escherichia COLI ' });

      expect(target.organismName).toBe('Escherichia coli');
      expect(target.favourite).toBe(false);
    });

    it('rejects an organism that is not in the glossary', async () => {
      // Legacy could not produce this state (the combo only offered glossary
      // entries), so the API guards it instead of trusting the client
      await expect(
        targetService.addTarget({ organismName: 'Bacillus subtilis' })
      ).rejects.toMatchObject({
        code: 'VALIDATION',
      });
    });

    it('rejects a duplicate entry (deviation: legacy allowed duplicates)', async () => {
      await targetService.addTarget({ organismName: 'Escherichia coli' });
      await expect(
        targetService.addTarget({ organismName: 'ESCHERICHIA coli' })
      ).rejects.toMatchObject({
        code: 'VALIDATION',
      });
    });

    it('lists in insertion order (legacy listed by autoincrement id)', async () => {
      // Force distinct createdAt values — inserts within the same millisecond
      // would otherwise fall back to alphabetical order
      await db('organism_targets').insert([
        {
          id: 't-1',
          organismName: 'Escherichia coli',
          favourite: false,
          createdAt: '2026-01-02T00:00:00.000Z',
          updatedAt: '2026-01-02T00:00:00.000Z',
        },
        {
          id: 't-2',
          organismName: 'Agrobacterium tumefaciens',
          favourite: false,
          createdAt: '2026-01-03T00:00:00.000Z',
          updatedAt: '2026-01-03T00:00:00.000Z',
        },
      ]);

      expect((await targetService.listTargets()).map((t) => t.organismName)).toEqual([
        'Escherichia coli',
        'Agrobacterium tumefaciens',
      ]);
    });

    it('toggles the favourite flag (legacy Copy / favourite delete)', async () => {
      const target = await targetService.addTarget({ organismName: 'Escherichia coli' });

      const starred = await targetService.setFavourite(target.id, true);
      expect(starred.favourite).toBe(true);
      expect((await targetService.listFavourites()).map((t) => t.organismName)).toEqual([
        'Escherichia coli',
      ]);

      const unstarred = await targetService.setFavourite(target.id, false);
      expect(unstarred.favourite).toBe(false);
      expect(await targetService.listFavourites()).toEqual([]);
    });

    it('removes an entry, and its favourite status with it', async () => {
      const target = await targetService.addTarget({ organismName: 'Escherichia coli' });
      await targetService.setFavourite(target.id, true);

      await targetService.removeTarget(target.id);

      expect(await targetService.listTargets()).toEqual([]);
      expect(await targetService.listFavourites()).toEqual([]);
    });

    it('404s operations on unknown entries', async () => {
      await expect(targetService.setFavourite('nope', true)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
      await expect(targetService.removeTarget('nope')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });
  });

  describe('propagation from the organism glossary', () => {
    it('renaming an organism renames its target entry', async () => {
      const target = await targetService.addTarget({ organismName: 'Escherichia coli' });
      await targetService.setFavourite(target.id, true);

      await organismService.updateOrganism('org-coli', { fullName: 'Escherichia coli K-12' });

      const targets = await targetService.listTargets();
      expect(targets).toHaveLength(1);
      expect(targets[0]).toMatchObject({
        organismName: 'Escherichia coli K-12',
        favourite: true,
      });
    });

    it('merges target entries when a rename lands on an already-targeted name', async () => {
      const coli = await targetService.addTarget({ organismName: 'Escherichia coli' });
      await targetService.setFavourite(coli.id, true);
      await targetService.addTarget({ organismName: 'Agrobacterium tumefaciens' });

      // Normally glossary uniqueness blocks renaming onto a taken name, and
      // service-level deletion cascades the target row away. Reach the
      // collision the way real data would (external edits, old backups):
      // drop the glossary row directly, leaving its target row orphaned,
      // then rename E. coli into the freed name.
      await db('organisms').where('id', 'org-agro').delete();
      await organismService.updateOrganism('org-coli', {
        fullName: 'Agrobacterium tumefaciens',
      });

      const targets = await targetService.listTargets();
      expect(targets).toHaveLength(1);
      // The surviving row keeps favourite because either side had it
      expect(targets[0]).toMatchObject({
        organismName: 'Agrobacterium tumefaciens',
        favourite: true,
      });
    });

    it('deleting an organism removes its target entry', async () => {
      const target = await targetService.addTarget({ organismName: 'Escherichia coli' });
      await targetService.setFavourite(target.id, true);
      await targetService.addTarget({ organismName: 'Agrobacterium tumefaciens' });

      await organismService.deleteOrganism('org-coli');

      expect((await targetService.listTargets()).map((t) => t.organismName)).toEqual([
        'Agrobacterium tumefaciens',
      ]);
    });
  });

  describe('API routes', () => {
    it('GET lists targets', async () => {
      await targetService.addTarget({ organismName: 'Escherichia coli' });

      const response = await listRoute.GET(
        asNextRequest(new Request('http://localhost/api/settings/organism-targets'))
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data).toHaveLength(1);
      expect(body.data[0]).toMatchObject({ organismName: 'Escherichia coli', favourite: false });
    });

    it('POST adds a target', async () => {
      const response = await listRoute.POST(
        asNextRequest(
          new Request('http://localhost/api/settings/organism-targets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ organismName: 'Escherichia coli' }),
          })
        )
      );
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.data.organismName).toBe('Escherichia coli');
    });

    it('POST 400s on an organism outside the glossary and on duplicates', async () => {
      const unknown = await listRoute.POST(
        asNextRequest(
          new Request('http://localhost/api/settings/organism-targets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ organismName: 'Bacillus subtilis' }),
          })
        )
      );
      expect(unknown.status).toBe(400);

      await targetService.addTarget({ organismName: 'Escherichia coli' });
      const duplicate = await listRoute.POST(
        asNextRequest(
          new Request('http://localhost/api/settings/organism-targets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ organismName: 'Escherichia coli' }),
          })
        )
      );
      expect(duplicate.status).toBe(400);
    });

    it('PATCH toggles favourite; DELETE removes; both 404 on unknown ids', async () => {
      const target = await targetService.addTarget({ organismName: 'Escherichia coli' });

      const patched = await entryRoute.PATCH(
        asNextRequest(
          new Request(`http://localhost/api/settings/organism-targets/${target.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ favourite: true }),
          })
        ),
        { params: { id: target.id } }
      );
      expect(patched.status).toBe(200);
      expect((await patched.json()).data.favourite).toBe(true);

      const deleted = await entryRoute.DELETE(
        asNextRequest(
          new Request(`http://localhost/api/settings/organism-targets/${target.id}`, {
            method: 'DELETE',
          })
        ),
        { params: { id: target.id } }
      );
      expect(deleted.status).toBe(200);
      expect(await targetService.listTargets()).toEqual([]);

      const patchMissing = await entryRoute.PATCH(
        asNextRequest(
          new Request('http://localhost/api/settings/organism-targets/nope', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ favourite: true }),
          })
        ),
        { params: { id: 'nope' } }
      );
      expect(patchMissing.status).toBe(404);
    });
  });
});
