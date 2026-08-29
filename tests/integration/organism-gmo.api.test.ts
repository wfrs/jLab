/**
 * Integration Tests: Organism + GMO API route handlers
 */

import { Knex } from 'knex';
import { setQueryBuilder } from '@infrastructure/query-builder';
import { createTestDb, createTestSchema, cleanTestDb } from '../helpers/test-db';

type OrganismListRoutes = typeof import('@app/api/glossary/organisms/route');
type OrganismItemRoutes = typeof import('@app/api/glossary/organisms/[id]/route');
type GmoListRoutes = typeof import('@app/api/plasmids/[id]/gmos/route');
type GmoItemRoutes = typeof import('@app/api/gmos/[id]/route');

let organismListRoutes: OrganismListRoutes;
let organismItemRoutes: OrganismItemRoutes;
let gmoListRoutes: GmoListRoutes;
let gmoItemRoutes: GmoItemRoutes;
let db: Knex;

const PLASMID_ID = 'plasmid-1';
const ORGANISMS_URL = 'http://localhost/api/glossary/organisms';
const GMOS_URL = `http://localhost/api/plasmids/${PLASMID_ID}/gmos`;

function jsonRequest(url: string, method: string, body?: unknown): Request {
  const init: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-correlation-id': 'test-correlation-id',
    },
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }
  return new Request(url, init);
}

const asNextRequest = (req: Request) => req as never;

describe('Organism + GMO API routes (Integration)', () => {
  beforeAll(async () => {
    db = createTestDb();
    setQueryBuilder(db);
    await createTestSchema(db);

    organismListRoutes = await import('@app/api/glossary/organisms/route');
    organismItemRoutes = await import('@app/api/glossary/organisms/[id]/route');
    gmoListRoutes = await import('@app/api/plasmids/[id]/gmos/route');
    gmoItemRoutes = await import('@app/api/gmos/[id]/route');
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

  async function createOrganismViaApi(body: Record<string, unknown>): Promise<Response> {
    return organismListRoutes.POST(asNextRequest(jsonRequest(ORGANISMS_URL, 'POST', body)));
  }

  async function createGmoViaApi(body: Record<string, unknown>): Promise<Response> {
    return gmoListRoutes.POST(asNextRequest(jsonRequest(GMOS_URL, 'POST', body)), {
      params: { id: PLASMID_ID },
    });
  }

  describe('Organism routes', () => {
    it('POST creates an organism (201) with defaults', async () => {
      const response = await createOrganismViaApi({ fullName: 'Escherichia coli' });
      expect(response.status).toBe(201);

      const json = await response.json();
      expect(json.data.fullName).toBe('Escherichia coli');
      expect(json.data.riskGroup).toBe('1');
    });

    it('POST rejects duplicates (400)', async () => {
      await createOrganismViaApi({ fullName: 'E. coli' });
      const response = await createOrganismViaApi({ fullName: 'E. coli' });
      expect(response.status).toBe(400);
    });

    it('GET lists and searches', async () => {
      await createOrganismViaApi({ fullName: 'Saccharomyces cerevisiae', shortName: 'yeast' });
      await createOrganismViaApi({ fullName: 'Escherichia coli' });

      const all = await (
        await organismListRoutes.GET(asNextRequest(jsonRequest(ORGANISMS_URL, 'GET')))
      ).json();
      expect(all.data).toHaveLength(2);

      const filtered = await (
        await organismListRoutes.GET(
          asNextRequest(jsonRequest(`${ORGANISMS_URL}?search=yeast`, 'GET'))
        )
      ).json();
      expect(filtered.data.map((o: { fullName: string }) => o.fullName)).toEqual([
        'Saccharomyces cerevisiae',
      ]);
    });

    it('PATCH updates, DELETE removes, 404 on missing', async () => {
      const created = await (await createOrganismViaApi({ fullName: 'E. coli' })).json();
      const id = created.data.id;

      const patched = await organismItemRoutes.PATCH(
        asNextRequest(jsonRequest(`${ORGANISMS_URL}/${id}`, 'PATCH', { riskGroup: '2' })),
        { params: { id } }
      );
      expect(patched.status).toBe(200);
      expect((await patched.json()).data.riskGroup).toBe('2');

      const deleted = await organismItemRoutes.DELETE(
        asNextRequest(jsonRequest(`${ORGANISMS_URL}/${id}`, 'DELETE')),
        { params: { id } }
      );
      expect(deleted.status).toBe(200);

      const missing = await organismItemRoutes.PATCH(
        asNextRequest(jsonRequest(`${ORGANISMS_URL}/${id}`, 'PATCH', { riskGroup: '1' })),
        { params: { id } }
      );
      expect(missing.status).toBe(404);
    });
  });

  describe('GMO routes', () => {
    beforeEach(async () => {
      await createOrganismViaApi({ fullName: 'Escherichia coli K-12', riskGroup: '2' });
    });

    it('POST creates a GMO (201) with organism-seeded RG', async () => {
      const response = await createGmoViaApi({ organismName: 'Escherichia coli K-12' });
      expect(response.status).toBe(201);

      const json = await response.json();
      expect(json.data.plasmidId).toBe(PLASMID_ID);
      expect(json.data.targetRiskGroup).toBe(2);
      expect(json.data.approval).toBe('-');
      expect(json.data.dateDestroyed).toBeNull();
    });

    it('POST rejects an organism not in the glossary (400)', async () => {
      const response = await createGmoViaApi({ organismName: 'Unknown bug' });
      expect(response.status).toBe(400);
    });

    it('POST returns 404 for a missing plasmid', async () => {
      const response = await gmoListRoutes.POST(
        asNextRequest(
          jsonRequest('http://localhost/api/plasmids/ghost/gmos', 'POST', {
            organismName: 'Escherichia coli K-12',
          })
        ),
        { params: { id: 'ghost' } }
      );
      expect(response.status).toBe(404);
    });

    it('GET lists GMOs for the plasmid', async () => {
      await createGmoViaApi({ organismName: 'Escherichia coli K-12' });

      const response = await gmoListRoutes.GET(asNextRequest(jsonRequest(GMOS_URL, 'GET')), {
        params: { id: PLASMID_ID },
      });
      expect(response.status).toBe(200);
      expect((await response.json()).data).toHaveLength(1);
    });

    it('PATCH destroys a GMO with a date, rejects malformed dates', async () => {
      const created = await (
        await createGmoViaApi({ organismName: 'Escherichia coli K-12' })
      ).json();
      const id = created.data.id;

      const destroyed = await gmoItemRoutes.PATCH(
        asNextRequest(
          jsonRequest(`http://localhost/api/gmos/${id}`, 'PATCH', { dateDestroyed: '2026-09-01' })
        ),
        { params: { id } }
      );
      expect(destroyed.status).toBe(200);
      expect((await destroyed.json()).data.dateDestroyed).toBe('2026-09-01');

      const bad = await gmoItemRoutes.PATCH(
        asNextRequest(
          jsonRequest(`http://localhost/api/gmos/${id}`, 'PATCH', { dateDestroyed: '01.09.2026' })
        ),
        { params: { id } }
      );
      expect(bad.status).toBe(400);
    });

    it('DELETE removes a GMO record, 404 on missing', async () => {
      const created = await (
        await createGmoViaApi({ organismName: 'Escherichia coli K-12' })
      ).json();
      const id = created.data.id;

      const deleted = await gmoItemRoutes.DELETE(
        asNextRequest(jsonRequest(`http://localhost/api/gmos/${id}`, 'DELETE')),
        { params: { id } }
      );
      expect(deleted.status).toBe(200);

      const missing = await gmoItemRoutes.DELETE(
        asNextRequest(jsonRequest(`http://localhost/api/gmos/${id}`, 'DELETE')),
        { params: { id } }
      );
      expect(missing.status).toBe(404);
    });
  });
});
