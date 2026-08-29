/**
 * Integration Tests: Glossary Feature API route handlers
 */

import { Knex } from 'knex';
import { setQueryBuilder } from '@infrastructure/query-builder';
import { createTestDb, createTestSchema, cleanTestDb } from '../helpers/test-db';

type ListRoutes = typeof import('@app/api/glossary/features/route');
type ItemRoutes = typeof import('@app/api/glossary/features/[id]/route');

let listRoutes: ListRoutes;
let itemRoutes: ItemRoutes;
let db: Knex;

const BASE_URL = 'http://localhost/api/glossary/features';

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
  return listRoutes.POST(asNextRequest(jsonRequest(BASE_URL, 'POST', body)));
}

describe('Glossary Feature API routes (Integration)', () => {
  beforeAll(async () => {
    db = createTestDb();
    setQueryBuilder(db);
    await createTestSchema(db);

    listRoutes = await import('@app/api/glossary/features/route');
    itemRoutes = await import('@app/api/glossary/features/[id]/route');
  });

  afterAll(async () => {
    await db.destroy();
    setQueryBuilder(null);
  });

  beforeEach(async () => {
    await cleanTestDb(db);
  });

  describe('POST /api/glossary/features', () => {
    it('creates a feature and returns 201 with the normalized annotation', async () => {
      const response = await createViaApi({ annotation: 'my-feature v2' });
      expect(response.status).toBe(201);

      const json = await response.json();
      expect(json.data.annotation).toBe('my_feature_v2');
      expect(json.data.risk).toBe('No Risk');
      expect(json.correlationId).toBe('test-correlation-id');
    });

    it('returns 400 for a missing annotation', async () => {
      const response = await createViaApi({ alias: 'nameless' });
      expect(response.status).toBe(400);
    });

    it('returns 400 for a duplicate (after normalization)', async () => {
      await createViaApi({ annotation: 'my_feature' });
      const response = await createViaApi({ annotation: 'my-feature' });
      expect(response.status).toBe(400);

      const json = await response.json();
      expect(json.message).toContain('already exists');
    });

    it('returns 400 for unknown fields', async () => {
      const response = await createViaApi({ annotation: 'x', synced: true });
      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/glossary/features', () => {
    it('lists features ordered by annotation', async () => {
      await createViaApi({ annotation: 'GFP' });
      await createViaApi({ annotation: 'AmpR' });

      const response = await listRoutes.GET(asNextRequest(jsonRequest(BASE_URL, 'GET')));
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.data.map((f: { annotation: string }) => f.annotation)).toEqual(['AmpR', 'GFP']);
    });

    it('filters with ?search=', async () => {
      await createViaApi({ annotation: 'GFP', alias: 'green' });
      await createViaApi({ annotation: 'AmpR' });

      const response = await listRoutes.GET(
        asNextRequest(jsonRequest(`${BASE_URL}?search=green`, 'GET'))
      );
      const json = await response.json();
      expect(json.data.map((f: { annotation: string }) => f.annotation)).toEqual(['GFP']);
    });
  });

  describe('PATCH /api/glossary/features/[id]', () => {
    it('updates and normalizes the annotation', async () => {
      const created = await (await createViaApi({ annotation: 'GFP' })).json();
      const id = created.data.id;

      const response = await itemRoutes.PATCH(
        asNextRequest(jsonRequest(`${BASE_URL}/${id}`, 'PATCH', { annotation: 'e GFP' })),
        { params: { id } }
      );
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.data.annotation).toBe('e_GFP');
    });

    it('returns 404 for a missing feature', async () => {
      const response = await itemRoutes.PATCH(
        asNextRequest(jsonRequest(`${BASE_URL}/ghost`, 'PATCH', { risk: 'RG2' })),
        { params: { id: 'ghost' } }
      );
      expect(response.status).toBe(404);
    });

    it('returns 400 for an empty update body', async () => {
      const created = await (await createViaApi({ annotation: 'GFP' })).json();
      const id = created.data.id;

      const response = await itemRoutes.PATCH(
        asNextRequest(jsonRequest(`${BASE_URL}/${id}`, 'PATCH', {})),
        { params: { id } }
      );
      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/glossary/features/[id]', () => {
    it('deletes a feature', async () => {
      const created = await (await createViaApi({ annotation: 'doomed' })).json();
      const id = created.data.id;

      const response = await itemRoutes.DELETE(
        asNextRequest(jsonRequest(`${BASE_URL}/${id}`, 'DELETE')),
        { params: { id } }
      );
      expect(response.status).toBe(200);
      expect(await db('glossary_features').where('id', id).first()).toBeUndefined();
    });

    it('returns 404 for a missing feature', async () => {
      const response = await itemRoutes.DELETE(
        asNextRequest(jsonRequest(`${BASE_URL}/ghost`, 'DELETE')),
        { params: { id: 'ghost' } }
      );
      expect(response.status).toBe(404);
    });
  });
});
