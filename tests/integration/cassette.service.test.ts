/**
 * Integration Tests: CassetteService
 * Tests business logic, domain validation, position management
 */

import { Knex } from 'knex';
import { CassetteService } from '@services/cassette.service';
import { setQueryBuilder } from '@infrastructure/query-builder';
import { createTestDb, createTestSchema, cleanTestDb } from '../helpers/test-db';

describe('CassetteService (Integration)', () => {
  let service: CassetteService;
  let db: Knex;

  const PLASMID_ID = 'plasmid-1';

  beforeAll(async () => {
    db = createTestDb();
    setQueryBuilder(db);
    await createTestSchema(db);
    service = new CassetteService();
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

  describe('createCassette', () => {
    it('creates a cassette with explicit position', async () => {
      const cassette = await service.createCassette({
        id: 'cas-1',
        plasmidId: PLASMID_ID,
        name: 'pLac',
        type: 'promoter',
        position: 5,
      });

      expect(cassette.name).toBe('pLac');
      expect(cassette.type).toBe('promoter');
      expect(cassette.position).toBe(5);
      expect(cassette.plasmidId).toBe(PLASMID_ID);
    });

    it('defaults position to 0 on an empty plasmid', async () => {
      const cassette = await service.createCassette({
        plasmidId: PLASMID_ID,
        id: 'cas-1',
        name: 'first',
        type: 'other',
      });
      expect(cassette.position).toBe(0);
    });

    it('appends after the current last cassette when position omitted', async () => {
      await service.createCassette({
        id: 'cas-1',
        plasmidId: PLASMID_ID,
        name: 'first',
        type: 'other',
        position: 3,
      });

      const second = await service.createCassette({
        id: 'cas-2',
        plasmidId: PLASMID_ID,
        name: 'second',
        type: 'other',
      });
      expect(second.position).toBe(4);
    });

    it('rejects an empty name', async () => {
      await expect(
        service.createCassette({ plasmidId: PLASMID_ID, name: '  ', type: 'other' })
      ).rejects.toMatchObject({ code: 'VALIDATION' });
    });

    it('rejects an invalid type', async () => {
      await expect(
        service.createCassette({
          plasmidId: PLASMID_ID,
          name: 'x',
          type: 'enhancer' as never,
        })
      ).rejects.toMatchObject({ code: 'VALIDATION' });
    });

    it('rejects a negative position', async () => {
      await expect(
        service.createCassette({ plasmidId: PLASMID_ID, name: 'x', type: 'other', position: -1 })
      ).rejects.toMatchObject({ code: 'VALIDATION' });
    });

    it('rejects a non-existent plasmid', async () => {
      await expect(
        service.createCassette({ plasmidId: 'ghost', name: 'x', type: 'other' })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  describe('updateCassette', () => {
    beforeEach(async () => {
      await service.createCassette({
        id: 'cas-1',
        plasmidId: PLASMID_ID,
        name: 'original',
        type: 'other',
        position: 0,
      });
    });

    it('updates fields', async () => {
      const updated = await service.updateCassette('cas-1', {
        name: 'renamed',
        type: 'marker',
        position: 2,
      });
      expect(updated.name).toBe('renamed');
      expect(updated.type).toBe('marker');
      expect(updated.position).toBe(2);
    });

    it('clears sequence with null', async () => {
      await service.updateCassette('cas-1', { sequence: 'ATGC' });
      const cleared = await service.updateCassette('cas-1', { sequence: null });
      expect(cleared.sequence).toBeNull();
    });

    it('rejects an empty name', async () => {
      await expect(service.updateCassette('cas-1', { name: ' ' })).rejects.toMatchObject({
        code: 'VALIDATION',
      });
    });

    it('rejects a non-existent cassette', async () => {
      await expect(service.updateCassette('ghost', { name: 'x' })).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });
  });

  describe('deleteCassette', () => {
    it('deletes a cassette', async () => {
      await service.createCassette({
        id: 'cas-1',
        plasmidId: PLASMID_ID,
        name: 'x',
        type: 'other',
      });

      await service.deleteCassette('cas-1');
      expect(await db('cassettes').where('id', 'cas-1').first()).toBeUndefined();
    });

    it('rejects a non-existent cassette', async () => {
      await expect(service.deleteCassette('ghost')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  describe('listPlasmidCassettes', () => {
    it('returns cassettes ordered by position', async () => {
      await service.createCassette({
        id: 'cas-b',
        plasmidId: PLASMID_ID,
        name: 'B',
        type: 'other',
        position: 2,
      });
      await service.createCassette({
        id: 'cas-a',
        plasmidId: PLASMID_ID,
        name: 'A',
        type: 'other',
        position: 0,
      });

      const cassettes = await service.listPlasmidCassettes(PLASMID_ID);
      expect(cassettes.map((c) => c.name)).toEqual(['A', 'B']);
    });

    it('returns empty list for a plasmid without cassettes', async () => {
      expect(await service.listPlasmidCassettes(PLASMID_ID)).toEqual([]);
    });

    it('rejects a non-existent plasmid', async () => {
      await expect(service.listPlasmidCassettes('ghost')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });
  });

  describe('parity: plasmid delete cascades to cassettes', () => {
    it('cassettes are removed when the parent plasmid is deleted via PlasmidService', async () => {
      const { PlasmidService } = await import('@services/plasmid.service');
      const plasmidService = new PlasmidService();

      await service.createCassette({
        id: 'cas-1',
        plasmidId: PLASMID_ID,
        name: 'x',
        type: 'other',
      });

      await plasmidService.deletePlasmid(PLASMID_ID);
      expect(await db('cassettes').where('plasmidId', PLASMID_ID).first()).toBeUndefined();
    });
  });
});
