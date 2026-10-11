/**
 * Integration Tests: Plasmid API route handlers
 * Exercises the full stack: route → Zod validation → service → repository → SQLite
 * Verifies envelope format (ADR-0008) and HTTP status mapping.
 */

import { Knex } from 'knex';
import { setQueryBuilder } from '@infrastructure/query-builder';
import { createTestDb, createTestSchema, cleanTestDb } from '../helpers/test-db';
import { MAX_PAGE_SIZE } from '@/shared/pagination';

// Route modules instantiate PlasmidService (and thus the query builder) at
// import time, so the test query builder must be registered before importing.
type ListRoutes = typeof import('@app/api/plasmids/route');
type ItemRoutes = typeof import('@app/api/plasmids/[id]/route');

let listRoutes: ListRoutes;
let itemRoutes: ItemRoutes;
let db: Knex;

const BASE_URL = 'http://localhost/api/plasmids';

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

// Route handlers only use headers/url/json() from NextRequest, so a standard
// Request is sufficient at runtime.
const asNextRequest = (req: Request) => req as never;

async function createViaApi(body: Record<string, unknown>): Promise<Response> {
  return listRoutes.POST(asNextRequest(jsonRequest(BASE_URL, 'POST', body)));
}

describe('Plasmid API routes (Integration)', () => {
  beforeAll(async () => {
    db = createTestDb();
    setQueryBuilder(db);
    await createTestSchema(db);

    listRoutes = await import('@app/api/plasmids/route');
    itemRoutes = await import('@app/api/plasmids/[id]/route');
  });

  afterAll(async () => {
    await db.destroy();
    setQueryBuilder(null);
  });

  beforeEach(async () => {
    await cleanTestDb(db);
  });

  describe('POST /api/plasmids', () => {
    it('creates a plasmid and returns 201 with a success envelope', async () => {
      const response = await createViaApi({ name: 'pGFP', sizeBp: 5400 });
      expect(response.status).toBe(201);

      const json = await response.json();
      expect(json.correlationId).toBe('test-correlation-id');
      expect(json.timestamp).toBeDefined();
      expect(json.data.name).toBe('pGFP');
      expect(json.data.sizeBp).toBe(5400);
      expect(json.data.status).toBe('draft');
      expect(json.data.id).toBeDefined();
    });

    it('returns 400 with a VALIDATION envelope for a missing name', async () => {
      const response = await createViaApi({ sizeBp: 100 });
      expect(response.status).toBe(400);

      const json = await response.json();
      expect(json.category).toBe('VALIDATION');
      expect(json.code).toBe('VALIDATION_ERROR');
      expect(json.correlationId).toBe('test-correlation-id');
    });

    it('returns 400 for unknown fields (strict schema)', async () => {
      const response = await createViaApi({ name: 'p1', sizebp: 100 });
      expect(response.status).toBe(400);
    });

    it('returns 400 for invalid JSON body', async () => {
      const request = new Request(BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json{',
      });
      const response = await listRoutes.POST(asNextRequest(request));
      expect(response.status).toBe(400);

      const json = await response.json();
      expect(json.code).toBe('INVALID_JSON');
    });

    it('returns 400 for a duplicate name', async () => {
      await createViaApi({ name: 'pDup' });
      const response = await createViaApi({ name: 'pDup' });
      expect(response.status).toBe(400);

      const json = await response.json();
      expect(json.category).toBe('VALIDATION');
      expect(json.message).toContain('already exists');
    });

    it('allows a name that is a substring of an existing name', async () => {
      await createViaApi({ name: 'pGFP-long-variant' });
      const response = await createViaApi({ name: 'pGFP' });
      expect(response.status).toBe(201);
    });
  });

  describe('GET /api/plasmids', () => {
    it('lists plasmids with pagination metadata', async () => {
      await createViaApi({ name: 'pAAA' });
      await createViaApi({ name: 'pBBB' });

      const response = await listRoutes.GET(asNextRequest(jsonRequest(BASE_URL, 'GET')));
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.data.total).toBe(2);
      expect(json.data.data).toHaveLength(2);
      expect(json.data.data.map((p: { name: string }) => p.name)).toEqual(['pAAA', 'pBBB']);
    });

    it('caps the page size at MAX_PAGE_SIZE and honours the offset', async () => {
      const names = Array.from(
        { length: MAX_PAGE_SIZE + 2 },
        (_, i) => `p${String(i).padStart(4, '0')}`
      );
      for (const name of names) {
        await createViaApi({ name });
      }

      const firstPage = await (
        await listRoutes.GET(asNextRequest(jsonRequest(`${BASE_URL}?limit=1000`, 'GET')))
      ).json();
      expect(firstPage.data.total).toBe(names.length);
      expect(firstPage.data.limit).toBe(MAX_PAGE_SIZE);
      expect(firstPage.data.data).toHaveLength(MAX_PAGE_SIZE);

      const secondPage = await (
        await listRoutes.GET(
          asNextRequest(
            jsonRequest(`${BASE_URL}?limit=${MAX_PAGE_SIZE}&offset=${MAX_PAGE_SIZE}`, 'GET')
          )
        )
      ).json();
      expect(secondPage.data.data.map((p: { name: string }) => p.name)).toEqual(
        names.slice(MAX_PAGE_SIZE)
      );
    });

    it('filters by search query', async () => {
      await createViaApi({ name: 'pGFP', description: 'fluorescent' });
      await createViaApi({ name: 'pRFP', description: 'red protein' });

      const response = await listRoutes.GET(
        asNextRequest(jsonRequest(`${BASE_URL}?search=GFP`, 'GET'))
      );
      const json = await response.json();
      expect(json.data.total).toBe(1);
      expect(json.data.data[0].name).toBe('pGFP');
    });
  });

  describe('GET /api/plasmids/[id]', () => {
    it('returns a single plasmid', async () => {
      const created = await (await createViaApi({ name: 'pOne' })).json();

      const response = await itemRoutes.GET(
        asNextRequest(jsonRequest(`${BASE_URL}/${created.data.id}`, 'GET')),
        { params: { id: created.data.id } }
      );
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.data.name).toBe('pOne');
    });

    it('returns 404 with NOT_FOUND envelope for a missing plasmid', async () => {
      const response = await itemRoutes.GET(asNextRequest(jsonRequest(`${BASE_URL}/nope`, 'GET')), {
        params: { id: 'nope' },
      });
      expect(response.status).toBe(404);

      const json = await response.json();
      expect(json.category).toBe('NOT_FOUND');
    });
  });

  describe('PATCH /api/plasmids/[id]', () => {
    it('updates a single field (autosave shape) and returns the full record', async () => {
      const created = await (await createViaApi({ name: 'pPatch', sizeBp: 100 })).json();
      const id = created.data.id;

      const response = await itemRoutes.PATCH(
        asNextRequest(jsonRequest(`${BASE_URL}/${id}`, 'PATCH', { sizeBp: 4200 })),
        { params: { id } }
      );
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.data.sizeBp).toBe(4200);
      expect(json.data.name).toBe('pPatch');
    });

    it('clears sizeBp with null', async () => {
      const created = await (await createViaApi({ name: 'pClear', sizeBp: 100 })).json();
      const id = created.data.id;

      const response = await itemRoutes.PATCH(
        asNextRequest(jsonRequest(`${BASE_URL}/${id}`, 'PATCH', { sizeBp: null })),
        { params: { id } }
      );
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.data.sizeBp).toBeNull();
    });

    it('returns 400 when renaming to an existing name', async () => {
      await createViaApi({ name: 'pTaken' });
      const created = await (await createViaApi({ name: 'pRename' })).json();
      const id = created.data.id;

      const response = await itemRoutes.PATCH(
        asNextRequest(jsonRequest(`${BASE_URL}/${id}`, 'PATCH', { name: 'pTaken' })),
        { params: { id } }
      );
      expect(response.status).toBe(400);

      const json = await response.json();
      expect(json.message).toContain('already exists');
    });

    it('allows saving the unchanged name back (rename to self)', async () => {
      const created = await (await createViaApi({ name: 'pSelf' })).json();
      const id = created.data.id;

      const response = await itemRoutes.PATCH(
        asNextRequest(jsonRequest(`${BASE_URL}/${id}`, 'PATCH', { name: 'pSelf' })),
        { params: { id } }
      );
      expect(response.status).toBe(200);
    });

    it('updates and clears the lab spreadsheet fields', async () => {
      const created = await (await createViaApi({ name: 'pLab' })).json();
      const id = created.data.id;
      const labFields = {
        constructName: 'pMiso000',
        insertName: 'GFP',
        insertSizeBp: 720,
        category: 'CDS',
        bacterialResistance: 'Kan',
        plantResistance: 'Hyg',
        box: 3,
        sequencingResult: 'good; ONT',
        sequencingDate: '2025-03-25',
        comment: 'cloned by LN',
        notes: 'other comment',
      };

      const updated = await (
        await itemRoutes.PATCH(
          asNextRequest(jsonRequest(`${BASE_URL}/${id}`, 'PATCH', labFields)),
          { params: { id } }
        )
      ).json();
      expect(updated.data).toMatchObject(labFields);

      const cleared = await (
        await itemRoutes.PATCH(
          asNextRequest(
            jsonRequest(`${BASE_URL}/${id}`, 'PATCH', { box: null, sequencingDate: null })
          ),
          { params: { id } }
        )
      ).json();
      expect(cleared.data.box).toBeNull();
      expect(cleared.data.sequencingDate).toBeNull();
      expect(cleared.data.constructName).toBe('pMiso000');
    });

    it('rejects a sequencing date that is not ISO formatted', async () => {
      const created = await (await createViaApi({ name: 'pDate' })).json();
      const id = created.data.id;

      const response = await itemRoutes.PATCH(
        asNextRequest(jsonRequest(`${BASE_URL}/${id}`, 'PATCH', { sequencingDate: '25.03.2025' })),
        { params: { id } }
      );
      expect(response.status).toBe(400);
    });

    it('returns 400 for an empty update body', async () => {
      const created = await (await createViaApi({ name: 'pEmpty' })).json();
      const id = created.data.id;

      const response = await itemRoutes.PATCH(
        asNextRequest(jsonRequest(`${BASE_URL}/${id}`, 'PATCH', {})),
        { params: { id } }
      );
      expect(response.status).toBe(400);
    });

    it('returns 404 for a missing plasmid', async () => {
      const response = await itemRoutes.PATCH(
        asNextRequest(jsonRequest(`${BASE_URL}/nope`, 'PATCH', { name: 'pNew' })),
        { params: { id: 'nope' } }
      );
      expect(response.status).toBe(404);
    });

    it('returns 400 when reparenting to a non-existent parent', async () => {
      const created = await (await createViaApi({ name: 'pChild' })).json();
      const id = created.data.id;

      const response = await itemRoutes.PATCH(
        asNextRequest(jsonRequest(`${BASE_URL}/${id}`, 'PATCH', { parentId: 'ghost' })),
        { params: { id } }
      );
      expect(response.status).toBe(400);
    });

    it('returns 400 when a plasmid is set as its own parent', async () => {
      const created = await (await createViaApi({ name: 'pOuro' })).json();
      const id = created.data.id;

      const response = await itemRoutes.PATCH(
        asNextRequest(jsonRequest(`${BASE_URL}/${id}`, 'PATCH', { parentId: id })),
        { params: { id } }
      );
      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/plasmids/[id]', () => {
    it('deletes a plasmid and cascades to related records', async () => {
      const created = await (await createViaApi({ name: 'pDel' })).json();
      const id = created.data.id;

      const now = new Date().toISOString();
      await db('cassettes').insert({
        id: 'cas-1',
        plasmidId: id,
        name: 'cassette',
        type: 'promoter',
        position: 0,
        createdAt: now,
        updatedAt: now,
      });

      const response = await itemRoutes.DELETE(
        asNextRequest(jsonRequest(`${BASE_URL}/${id}`, 'DELETE')),
        { params: { id } }
      );
      expect(response.status).toBe(200);

      expect(await db('plasmids').where('id', id).first()).toBeUndefined();
      expect(await db('cassettes').where('plasmidId', id).first()).toBeUndefined();
    });

    it('returns 404 for a missing plasmid', async () => {
      const response = await itemRoutes.DELETE(
        asNextRequest(jsonRequest(`${BASE_URL}/nope`, 'DELETE')),
        { params: { id: 'nope' } }
      );
      expect(response.status).toBe(404);
    });
  });
});
