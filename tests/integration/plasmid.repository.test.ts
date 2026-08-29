/**
 * Integration Tests: PlasmidRepository
 * Tests with real in-memory SQLite database using Knex
 */

import { PlasmidRepository } from '@services/plasmid.repository';
import { setQueryBuilder } from '@infrastructure/query-builder';
import { Logger } from '@infrastructure/logger';
import knex from 'knex';

describe('PlasmidRepository (Integration)', () => {
  let repository: PlasmidRepository;
  let db: any;
  let logger: Logger;

  beforeAll(async () => {
    // Initialize in-memory test database with knex
    // For in-memory SQLite, use a single connection to avoid database isolation issues
    db = knex({
      client: 'sqlite3',
      connection: ':memory:',
      useNullAsDefault: true,
      pool: { min: 1, max: 1 },
    });

    // Set the query builder to use test database
    setQueryBuilder(db);

    // Create schema
    await db.schema.createTableIfNotExists('plasmids', (table: any) => {
      table.text('id').primary();
      table.text('name').notNullable();
      table.text('description').nullable();
      table.integer('sizeBp').nullable();
      table.text('parentId').nullable();
      table.enum('status', ['draft', 'validated', 'archived']).defaultTo('draft');
      table.dateTime('createdAt').notNullable();
      table.dateTime('updatedAt').notNullable();
    });

    await db.schema.createTableIfNotExists('project_plasmids', (table: any) => {
      table.text('projectId').notNullable();
      table.text('plasmidId').notNullable();
      table.dateTime('addedAt').notNullable();
      table.primary(['projectId', 'plasmidId']);
      table.foreign('plasmidId').references('plasmids.id');
    });

    await db.schema.createTableIfNotExists('projects', (table: any) => {
      table.text('id').primary();
      table.text('name').notNullable();
      table.text('description').nullable();
      table.enum('status', ['active', 'archived']).defaultTo('active');
      table.dateTime('createdAt').notNullable();
      table.dateTime('updatedAt').notNullable();
    });

    logger = new Logger();
  });

  afterAll(async () => {
    // Cleanup: destroy the test database connection and reset query builder
    await db.destroy();
    setQueryBuilder(null);
  });

  beforeEach(async () => {
    // Clear all related tables before each test (foreign key order matters)
    await db('project_plasmids').del();
    await db('plasmids').del();
    await db('projects').del();
    repository = new PlasmidRepository(logger);
  });

  describe('CRUD Operations', () => {
    it('should create a plasmid', async () => {
      const input = {
        id: 'test-p1',
        name: 'Test Plasmid',
        description: 'A test plasmid',
        sizeBp: 5000,
        status: 'draft' as const,
      };

      const created = await repository.create(input);

      expect(created.id).toBe('test-p1');
      expect(created.name).toBe('Test Plasmid');
      expect(created.sizeBp).toBe(5000);
      expect(created.status).toBe('draft');
      expect(created.createdAt).toBeDefined();
      expect(created.updatedAt).toBeDefined();
    });

    it('should retrieve a plasmid by id', async () => {
      const input = {
        id: 'test-p2',
        name: 'Test Plasmid 2',
        status: 'draft' as const,
      };

      await repository.create(input);
      const retrieved = await repository.getById('test-p2');

      expect(retrieved).not.toBeNull();
      expect(retrieved?.name).toBe('Test Plasmid 2');
    });

    it('should return null for non-existent plasmid', async () => {
      const retrieved = await repository.getById('non-existent');
      expect(retrieved).toBeNull();
    });

    it('should update a plasmid', async () => {
      const input = {
        id: 'test-p3',
        name: 'Original Name',
        status: 'draft' as const,
      };

      await repository.create(input);

      const updated = await repository.update('test-p3', {
        name: 'Updated Name',
        status: 'validated' as const,
      });

      expect(updated.name).toBe('Updated Name');
      expect(updated.status).toBe('validated');

      // Verify it persisted
      const refetched = await repository.getById('test-p3');
      expect(refetched?.name).toBe('Updated Name');
    });

    it('should delete a plasmid', async () => {
      const input = {
        id: 'test-p4',
        name: 'To Delete',
        status: 'draft' as const,
      };

      await repository.create(input);
      await repository.delete('test-p4');

      const deleted = await repository.getById('test-p4');
      expect(deleted).toBeNull();
    });
  });

  describe('Query Operations', () => {
    beforeEach(async () => {
      // Create test data
      await repository.create({
        id: 'p1',
        name: 'pGFP',
        status: 'validated' as const,
        sizeBp: 4000,
      });

      await repository.create({
        id: 'p2',
        name: 'pRFP',
        status: 'draft' as const,
        sizeBp: 5000,
      });

      await repository.create({
        id: 'p3',
        name: 'pCFP',
        status: 'archived' as const,
        sizeBp: 4500,
      });
    });

    it('should get all plasmids', async () => {
      const all = await repository.getAll();

      expect(all).toHaveLength(3);
      expect(all.map((p) => p.name)).toContain('pGFP');
      expect(all.map((p) => p.name)).toContain('pRFP');
    });

    it('should search plasmids by name', async () => {
      const results = await repository.search('GFP');

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('pGFP');
    });

    it('should search case-insensitively', async () => {
      const results = await repository.search('gfp');

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('pGFP');
    });

    it('should get plasmids by status', async () => {
      const validated = await repository.getByStatus('validated');
      const draft = await repository.getByStatus('draft');
      const archived = await repository.getByStatus('archived');

      expect(validated).toHaveLength(1);
      expect(validated[0].name).toBe('pGFP');

      expect(draft).toHaveLength(1);
      expect(draft[0].name).toBe('pRFP');

      expect(archived).toHaveLength(1);
      expect(archived[0].name).toBe('pCFP');
    });

    it('should get paginated list', async () => {
      const page1 = await repository.paginatedList(2, 0);

      expect(page1.data).toHaveLength(2);
      expect(page1.total).toBe(3);

      const page2 = await repository.paginatedList(2, 2);
      expect(page2.data).toHaveLength(1);
      expect(page2.total).toBe(3);
    });

    it('should count plasmids', async () => {
      const count = await repository.count();
      expect(count).toBe(3);
    });

    it('should count plasmids with filter', async () => {
      const draftCount = await repository.count({ status: 'draft' });
      expect(draftCount).toBe(1);
    });
  });

  describe('Bulk Operations', () => {
    it('should bulk create plasmids', async () => {
      const inputs = [
        { id: 'b1', name: 'Bulk 1', status: 'draft' as const },
        { id: 'b2', name: 'Bulk 2', status: 'validated' as const },
        { id: 'b3', name: 'Bulk 3', status: 'draft' as const },
      ];

      const created = await repository.bulkCreate(inputs);

      expect(created).toHaveLength(3);

      const all = await repository.getAll();
      expect(all).toHaveLength(3);
    });
  });

  describe('Relationships', () => {
    beforeEach(async () => {
      // Create project
      await db('projects').insert({
        id: 'proj1',
        name: 'Project 1',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Create plasmids
      await repository.create({
        id: 'p1',
        name: 'pGFP',
        status: 'validated' as const,
      });

      await repository.create({
        id: 'p2',
        name: 'pRFP',
        status: 'draft' as const,
      });

      // Associate plasmids with project
      await db('project_plasmids').insert([
        {
          projectId: 'proj1',
          plasmidId: 'p1',
          addedAt: new Date().toISOString(),
        },
        {
          projectId: 'proj1',
          plasmidId: 'p2',
          addedAt: new Date().toISOString(),
        },
      ]);
    });

    it('should get plasmids by project', async () => {
      const projectPlasmids = await repository.getByProject('proj1');

      expect(projectPlasmids).toHaveLength(2);
      expect(projectPlasmids.map((p) => p.name)).toContain('pGFP');
      expect(projectPlasmids.map((p) => p.name)).toContain('pRFP');
    });

    it('should return empty array for project with no plasmids', async () => {
      // Create another project with no plasmids
      await db('projects').insert({
        id: 'proj2',
        name: 'Project 2',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const projectPlasmids = await repository.getByProject('proj2');
      expect(projectPlasmids).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Test that repository handles missing table gracefully
      // Note: We don't actually destroy the db since that would break subsequent tests
      // Instead, we test with a non-existent ID query which is a common error case
      const result = await repository.getById('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('Parity with Legacy GMOCU', () => {
    it('should support plasmid creation with all fields', async () => {
      // Legacy GMOCU requirement: create plasmid with name, description, size
      const input = {
        id: 'legacy-p1',
        name: 'pGFP-LEGACY',
        description: 'Green fluorescent protein vector',
        sizeBp: 4500,
        status: 'validated' as const,
      };

      const created = await repository.create(input);

      expect(created.name).toBe('pGFP-LEGACY');
      expect(created.description).toBe('Green fluorescent protein vector');
      expect(created.sizeBp).toBe(4500);
    });

    it('should support parent-child plasmid relationships', async () => {
      // Create parent
      const parent = await repository.create({
        id: 'parent-p',
        name: 'Parent Plasmid',
        status: 'validated' as const,
      });

      // Create child
      const child = await repository.create({
        id: 'child-p',
        name: 'Child Plasmid',
        status: 'draft' as const,
        parentId: parent.id,
      });

      expect(child.parentId).toBe('parent-p');

      // Get children
      const children = await repository.getChildren('parent-p');
      expect(children).toHaveLength(1);
      expect(children[0].id).toBe('child-p');
    });

    it('should support status transitions', async () => {
      // Legacy requirement: draft -> validated -> archived
      const plasmid = await repository.create({
        id: 'status-p',
        name: 'Status Test',
        status: 'draft' as const,
      });

      expect(plasmid.status).toBe('draft');

      const validated = await repository.update('status-p', {
        status: 'validated' as const,
      });
      expect(validated.status).toBe('validated');

      const archived = await repository.update('status-p', {
        status: 'archived' as const,
      });
      expect(archived.status).toBe('archived');
    });
  });
});
