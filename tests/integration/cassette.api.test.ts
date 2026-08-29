/**
 * Integration Tests: Cassette API route handlers
 * Exercises the full stack: route → Zod validation → service → repository → SQLite
 */

import { Knex } from 'knex';
import { setQueryBuilder } from '@infrastructure/query-builder';
import { createTestDb, createTestSchema, cleanTestDb } from '../helpers/test-db';

type ListRoutes = typeof import('@app/api/plasmids/[id]/cassettes/route');
type ItemRoutes = typeof import('@app/api/cassettes/[id]/route');

let listRoutes: ListRoutes;
let itemRoutes: ItemRoutes;
let db: Knex;

const PLASMID_ID = 'plasmid-1';
const BASE_URL = `http://localhost/api/plasmids/${PLASMID_ID}/cassettes`;

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

async function createViaApi(body: Record<string, unknown>): Promise<Response> {
  return listRoutes.POST(asNextRequest(jsonRequest(BASE_URL, 'POST', body)), {
    params: { id: PLASMID_ID },
  });
}

describe('Cassette API routes (Integration)', () => {
  beforeAll(async () => {
    db = createTestDb();
    setQueryBuilder(db);
    await createTestSchema(db);

    listRoutes = await import('@app/api/plasmids/[id]/cassettes/route');
    itemRoutes = await import('@app/api/cassettes/[id]/route');
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

  describe('POST /api/plasmids/[id]/cassettes', () => {
    it('creates a cassette and returns 201 with a success envelope', async () => {
      const response = await createViaApi({ name: 'pLac', type: 'promoter' });
      expect(response.status).toBe(201);

      const json = await response.json();
      expect(json.correlationId).toBe('test-correlation-id');
      expect(json.data.name).toBe('pLac');
      expect(json.data.type).toBe('promoter');
      expect(json.data.plasmidId).toBe(PLASMID_ID);
      expect(json.data.position).toBe(0);
    });

    it('appends positions across successive creates', async () => {
      await createViaApi({ name: 'first', type: 'other' });
      const response = await createViaApi({ name: 'second', type: 'other' });
      const json = await response.json();
      expect(json.data.position).toBe(1);
    });

    it('returns 400 for a missing type', async () => {
      const response = await createViaApi({ name: 'x' });
      expect(response.status).toBe(400);

      const json = await response.json();
      expect(json.category).toBe('VALIDATION');
    });

    it('returns 400 when plasmidId is passed in the body', async () => {
      const response = await createViaApi({ name: 'x', type: 'other', plasmidId: 'sneaky' });
      expect(response.status).toBe(400);
    });

    it('returns 404 for a non-existent plasmid', async () => {
      const response = await listRoutes.POST(
        asNextRequest(
          jsonRequest('http://localhost/api/plasmids/ghost/cassettes', 'POST', {
            name: 'x',
            type: 'other',
          })
        ),
        { params: { id: 'ghost' } }
      );
      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/plasmids/[id]/cassettes', () => {
    it('lists cassettes ordered by position', async () => {
      await createViaApi({ name: 'A', type: 'other', position: 1 });
      await createViaApi({ name: 'B', type: 'other', position: 0 });

      const response = await listRoutes.GET(asNextRequest(jsonRequest(BASE_URL, 'GET')), {
        params: { id: PLASMID_ID },
      });
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.data.map((c: { name: string }) => c.name)).toEqual(['B', 'A']);
    });

    it('returns 404 for a non-existent plasmid', async () => {
      const response = await listRoutes.GET(
        asNextRequest(jsonRequest('http://localhost/api/plasmids/ghost/cassettes', 'GET')),
        { params: { id: 'ghost' } }
      );
      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /api/cassettes/[id]', () => {
    it('updates a single field (autosave shape)', async () => {
      const created = await (await createViaApi({ name: 'orig', type: 'other' })).json();
      const id = created.data.id;

      const response = await itemRoutes.PATCH(
        asNextRequest(
          jsonRequest(`http://localhost/api/cassettes/${id}`, 'PATCH', {
            type: 'marker',
          })
        ),
        { params: { id } }
      );
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.data.type).toBe('marker');
      expect(json.data.name).toBe('orig');
    });

    it('returns 400 for an invalid type', async () => {
      const created = await (await createViaApi({ name: 'orig', type: 'other' })).json();
      const id = created.data.id;

      const response = await itemRoutes.PATCH(
        asNextRequest(
          jsonRequest(`http://localhost/api/cassettes/${id}`, 'PATCH', {
            type: 'enhancer',
          })
        ),
        { params: { id } }
      );
      expect(response.status).toBe(400);
    });

    it('returns 404 for a missing cassette', async () => {
      const response = await itemRoutes.PATCH(
        asNextRequest(jsonRequest('http://localhost/api/cassettes/ghost', 'PATCH', { name: 'x' })),
        { params: { id: 'ghost' } }
      );
      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/cassettes/[id]', () => {
    it('deletes a cassette', async () => {
      const created = await (await createViaApi({ name: 'doomed', type: 'other' })).json();
      const id = created.data.id;

      const response = await itemRoutes.DELETE(
        asNextRequest(jsonRequest(`http://localhost/api/cassettes/${id}`, 'DELETE')),
        { params: { id } }
      );
      expect(response.status).toBe(200);
      expect(await db('cassettes').where('id', id).first()).toBeUndefined();
    });

    it('returns 404 for a missing cassette', async () => {
      const response = await itemRoutes.DELETE(
        asNextRequest(jsonRequest('http://localhost/api/cassettes/ghost', 'DELETE')),
        { params: { id: 'ghost' } }
      );
      expect(response.status).toBe(404);
    });
  });
});
