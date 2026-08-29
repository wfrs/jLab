/**
 * Integration Tests: PlasmidService
 * Tests business logic, domain validation, transactions
 */

import { DomainError } from '@domain/types';
import { PlasmidService, CreatePlasmidInput } from '@services/plasmid.service';
import { setQueryBuilder } from '@infrastructure/query-builder';
import { Logger } from '@infrastructure/logger';
import knex from 'knex';

describe('PlasmidService (Integration)', () => {
  let service: PlasmidService;
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

    await db.schema.createTableIfNotExists('cassettes', (table: any) => {
      table.text('id').primary();
      table.text('plasmidId').notNullable();
      table.text('name').notNullable();
      table.text('sequence').nullable();
      table
        .enum('type', ['promoter', 'terminator', 'marker', 'origin', 'resistance', 'other'])
        .notNullable();
      table.integer('position').notNullable().defaultTo(0);
      table.dateTime('createdAt').notNullable();
      table.dateTime('updatedAt').notNullable();
      table.foreign('plasmidId').references('plasmids.id');
    });

    await db.schema.createTableIfNotExists('primers', (table: any) => {
      table.text('id').primary();
      table.text('plasmidId').notNullable();
      table.text('name').notNullable();
      table.text('sequence').notNullable();
      table.decimal('tmCelsius', 5, 2).nullable();
      table.decimal('gcPercent', 5, 2).nullable();
      table.dateTime('createdAt').notNullable();
      table.dateTime('updatedAt').notNullable();
      table.foreign('plasmidId').references('plasmids.id');
    });

    await db.schema.createTableIfNotExists('features', (table: any) => {
      table.text('id').primary();
      table.text('plasmidId').notNullable();
      table.text('name').notNullable();
      table
        .enum('type', ['gene', 'promoter', 'terminator', 'rbs', 'his_tag', 'flag_tag', 'other'])
        .notNullable();
      table.integer('startPos').notNullable();
      table.integer('endPos').notNullable();
      table.enum('strand', ['+', '-']).defaultTo('+');
      table.dateTime('createdAt').notNullable();
      table.dateTime('updatedAt').notNullable();
      table.foreign('plasmidId').references('plasmids.id');
    });

    await db.schema.createTableIfNotExists('gmos', (table: any) => {
      table.string('id').primary();
      table.string('plasmidId').notNullable();
      table.string('organismName').notNullable();
      table.string('approval').notNullable().defaultTo('-');
      table.integer('targetRiskGroup').notNullable().defaultTo(1);
      table.string('dateGenerated').notNullable();
      table.string('dateDestroyed').nullable();
      table.string('entryDate').notNullable();
      table.dateTime('createdAt').notNullable();
      table.dateTime('updatedAt').notNullable();
      table.foreign('plasmidId').references('plasmids.id');
    });

    await db.schema.createTableIfNotExists('attachments', (table: any) => {
      table.string('id').primary();
      table.string('plasmidId').notNullable();
      table.string('filename').notNullable();
      table.string('mimeType').notNullable().defaultTo('application/octet-stream');
      table.integer('sizeBytes').notNullable();
      table.binary('data').notNullable();
      table.string('createdAt').notNullable();
      table.string('updatedAt').notNullable();
      table.foreign('plasmidId').references('plasmids.id');
    });

    await db.schema.createTableIfNotExists('genbank_files', (table: any) => {
      table.string('plasmidId').primary();
      table.string('filename').notNullable();
      table.text('content').notNullable();
      table.string('createdAt').notNullable();
      table.string('updatedAt').notNullable();
      table.foreign('plasmidId').references('plasmids.id');
    });

    await db.schema.createTableIfNotExists('integrations', (table: any) => {
      table.text('id').primary();
      table.text('plasmidId').notNullable();
      table
        .enum('type', ['google_drive', 'google_sheets', 'genbank', 'ice', 'filebrowser'])
        .notNullable();
      table.text('externalId').notNullable();
      table.dateTime('lastSync').nullable();
      table.enum('syncStatus', ['pending', 'synced', 'error']).defaultTo('pending');
      table.text('errorMessage').nullable();
      table.dateTime('createdAt').notNullable();
      table.dateTime('updatedAt').notNullable();
      table.foreign('plasmidId').references('plasmids.id');
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
    await db('cassettes').del();
    await db('primers').del();
    await db('features').del();
    await db('integrations').del();
    await db('project_plasmids').del();
    await db('plasmids').del();
    await db('projects').del();
    service = new PlasmidService(logger);
  });

  describe('Create Plasmid', () => {
    it('should create a plasmid with required fields', async () => {
      const input: CreatePlasmidInput = {
        id: 'p1',
        name: 'Test Plasmid',
      };

      const created = await service.createPlasmid(input);

      expect(created.id).toBe('p1');
      expect(created.name).toBe('Test Plasmid');
      expect(created.status).toBe('draft'); // default status
      expect(created.createdAt).toBeDefined();
    });

    it('should create a plasmid with all fields', async () => {
      const input: CreatePlasmidInput = {
        id: 'p2',
        name: 'Full Plasmid',
        description: 'Complete plasmid with all fields',
        sizeBp: 5000,
        status: 'validated',
      };

      const created = await service.createPlasmid(input);

      expect(created.name).toBe('Full Plasmid');
      expect(created.description).toBe('Complete plasmid with all fields');
      expect(created.sizeBp).toBe(5000);
      expect(created.status).toBe('validated');
    });

    it('should reject plasmid with empty name', async () => {
      const input: CreatePlasmidInput = {
        id: 'p3',
        name: '   ', // whitespace only
      };

      try {
        await service.createPlasmid(input);
        fail('Should have thrown DomainError');
      } catch (error) {
        expect(error).toBeInstanceOf(DomainError);
        expect((error as DomainError).code).toBe('VALIDATION');
        expect((error as DomainError).message).toContain('name is required');
      }
    });

    it('should reject plasmid with undefined name', async () => {
      const input: CreatePlasmidInput = {
        id: 'p4',
        name: '',
      };

      try {
        await service.createPlasmid(input);
        fail('Should have thrown DomainError');
      } catch (error) {
        expect(error).toBeInstanceOf(DomainError);
        expect((error as DomainError).code).toBe('VALIDATION');
      }
    });

    it('should reject duplicate plasmid name', async () => {
      const input: CreatePlasmidInput = {
        id: 'p5',
        name: 'Duplicate Name',
      };

      await service.createPlasmid(input);

      try {
        await service.createPlasmid({
          ...input,
          id: 'p6', // different id, same name
        });
        fail('Should have thrown DomainError');
      } catch (error) {
        expect(error).toBeInstanceOf(DomainError);
        expect((error as DomainError).code).toBe('VALIDATION');
        expect((error as DomainError).message).toContain('already exists');
      }
    });

    it('should reject invalid status', async () => {
      const input: CreatePlasmidInput = {
        id: 'p7',
        name: 'Invalid Status',
        status: 'invalid' as any,
      };

      try {
        await service.createPlasmid(input);
        fail('Should have thrown DomainError');
      } catch (error) {
        expect(error).toBeInstanceOf(DomainError);
        expect((error as DomainError).code).toBe('VALIDATION');
        expect((error as DomainError).message).toContain('Invalid plasmid status');
      }
    });

    it('should reject negative size', async () => {
      const input: CreatePlasmidInput = {
        id: 'p8',
        name: 'Negative Size',
        sizeBp: -1000,
      };

      try {
        await service.createPlasmid(input);
        fail('Should have thrown DomainError');
      } catch (error) {
        expect(error).toBeInstanceOf(DomainError);
        expect((error as DomainError).code).toBe('VALIDATION');
        expect((error as DomainError).message).toContain('greater than 0');
      }
    });

    it('should reject zero size', async () => {
      const input: CreatePlasmidInput = {
        id: 'p9',
        name: 'Zero Size',
        sizeBp: 0,
      };

      try {
        await service.createPlasmid(input);
        fail('Should have thrown DomainError');
      } catch (error) {
        expect(error).toBeInstanceOf(DomainError);
        expect((error as DomainError).code).toBe('VALIDATION');
      }
    });

    it('should reject non-existent parent', async () => {
      const input: CreatePlasmidInput = {
        id: 'p10',
        name: 'Child Plasmid',
        parentId: 'non-existent-parent',
      };

      try {
        await service.createPlasmid(input);
        fail('Should have thrown DomainError');
      } catch (error) {
        expect(error).toBeInstanceOf(DomainError);
        expect((error as DomainError).code).toBe('VALIDATION');
        expect((error as DomainError).message).toContain('Parent plasmid not found');
      }
    });

    it('should create child plasmid with valid parent', async () => {
      const parent = await service.createPlasmid({
        id: 'parent',
        name: 'Parent Plasmid',
      });

      const child = await service.createPlasmid({
        id: 'child',
        name: 'Child Plasmid',
        parentId: parent.id,
      });

      expect(child.parentId).toBe(parent.id);
    });
  });

  describe('Update Plasmid', () => {
    beforeEach(async () => {
      await service.createPlasmid({
        id: 'test',
        name: 'Original Name',
        status: 'draft',
      });
    });

    it('should update plasmid name', async () => {
      const updated = await service.updatePlasmid('test', {
        name: 'Updated Name',
      });

      expect(updated.name).toBe('Updated Name');
    });

    it('should update plasmid status', async () => {
      const updated = await service.updatePlasmid('test', {
        status: 'validated',
      });

      expect(updated.status).toBe('validated');
    });

    it('should reject non-existent plasmid', async () => {
      try {
        await service.updatePlasmid('non-existent', { name: 'New Name' });
        fail('Should have thrown DomainError');
      } catch (error) {
        expect(error).toBeInstanceOf(DomainError);
        expect((error as DomainError).code).toBe('NOT_FOUND');
      }
    });

    it('should reject empty name', async () => {
      try {
        await service.updatePlasmid('test', { name: '   ' });
        fail('Should have thrown DomainError');
      } catch (error) {
        expect(error).toBeInstanceOf(DomainError);
        expect((error as DomainError).code).toBe('VALIDATION');
      }
    });

    it('should reject invalid status update', async () => {
      try {
        await service.updatePlasmid('test', { status: 'invalid' as any });
        fail('Should have thrown DomainError');
      } catch (error) {
        expect(error).toBeInstanceOf(DomainError);
        expect((error as DomainError).code).toBe('VALIDATION');
      }
    });
  });

  describe('Delete Plasmid', () => {
    it('should delete a plasmid', async () => {
      await service.createPlasmid({
        id: 'to-delete',
        name: 'To Delete',
      });

      await service.deletePlasmid('to-delete');

      try {
        await service.getPlasmid('to-delete');
        fail('Should have thrown DomainError');
      } catch (error) {
        expect(error).toBeInstanceOf(DomainError);
        expect((error as DomainError).code).toBe('NOT_FOUND');
      }
    });

    it('should cascade delete related cassettes', async () => {
      const plasmid = await service.createPlasmid({
        id: 'p-with-cassettes',
        name: 'With Cassettes',
      });

      // Create cassettes
      await db('cassettes').insert([
        {
          id: 'c1',
          plasmidId: plasmid.id,
          name: 'Cassette 1',
          type: 'promoter',
          position: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'c2',
          plasmidId: plasmid.id,
          name: 'Cassette 2',
          type: 'terminator',
          position: 2,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);

      const cassettesBeforeDelete = await db('cassettes').where('plasmidId', plasmid.id);
      expect(cassettesBeforeDelete).toHaveLength(2);

      await service.deletePlasmid(plasmid.id);

      const cassettesAfterDelete = await db('cassettes').where('plasmidId', plasmid.id);
      expect(cassettesAfterDelete).toHaveLength(0);
    });

    it('should cascade delete related primers', async () => {
      const plasmid = await service.createPlasmid({
        id: 'p-with-primers',
        name: 'With Primers',
      });

      // Create primers
      await db('primers').insert({
        id: 'primer1',
        plasmidId: plasmid.id,
        name: 'Primer 1',
        sequence: 'ACGTACGT',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const primersBeforeDelete = await db('primers').where('plasmidId', plasmid.id);
      expect(primersBeforeDelete).toHaveLength(1);

      await service.deletePlasmid(plasmid.id);

      const primersAfterDelete = await db('primers').where('plasmidId', plasmid.id);
      expect(primersAfterDelete).toHaveLength(0);
    });

    it('should reject deletion of non-existent plasmid', async () => {
      try {
        await service.deletePlasmid('non-existent');
        fail('Should have thrown DomainError');
      } catch (error) {
        expect(error).toBeInstanceOf(DomainError);
        expect((error as DomainError).code).toBe('NOT_FOUND');
      }
    });
  });

  describe('Query Operations', () => {
    beforeEach(async () => {
      await service.createPlasmid({ id: 'p1', name: 'pGFP', status: 'validated' });
      await service.createPlasmid({ id: 'p2', name: 'pRFP', status: 'draft' });
      await service.createPlasmid({ id: 'p3', name: 'pCFP', status: 'archived' });
    });

    it('should get a plasmid', async () => {
      const plasmid = await service.getPlasmid('p1');
      expect(plasmid.name).toBe('pGFP');
    });

    it('should throw NOT_FOUND for non-existent plasmid', async () => {
      try {
        await service.getPlasmid('non-existent');
        fail('Should have thrown DomainError');
      } catch (error) {
        expect(error).toBeInstanceOf(DomainError);
        expect((error as DomainError).code).toBe('NOT_FOUND');
      }
    });

    it('should list all plasmids', async () => {
      const result = await service.listPlasmids(10, 0);
      expect(result.data).toHaveLength(3);
      expect(result.total).toBe(3);
    });

    it('should list paginated plasmids', async () => {
      const page1 = await service.listPlasmids(2, 0);
      expect(page1.data).toHaveLength(2);
      expect(page1.total).toBe(3);

      const page2 = await service.listPlasmids(2, 2);
      expect(page2.data).toHaveLength(1);
      expect(page2.total).toBe(3);
    });

    it('should search plasmids', async () => {
      const results = await service.searchPlasmids('GFP');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('pGFP');
    });

    it('should list project plasmids', async () => {
      // Create project and associate plasmids
      await db('projects').insert({
        id: 'proj1',
        name: 'Project 1',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

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

      const projectPlasmids = await service.listProjectPlasmids('proj1');
      expect(projectPlasmids).toHaveLength(2);
    });
  });

  describe('Parity with Legacy GMOCU', () => {
    it('should support complete plasmid lifecycle', async () => {
      // Create in draft
      const draft = await service.createPlasmid({
        id: 'lifecycle-p',
        name: 'Lifecycle Plasmid',
        description: 'Test lifecycle',
        sizeBp: 5000,
        status: 'draft',
      });

      expect(draft.status).toBe('draft');

      // Validate
      const validated = await service.updatePlasmid('lifecycle-p', {
        status: 'validated',
      });
      expect(validated.status).toBe('validated');

      // Archive
      const archived = await service.updatePlasmid('lifecycle-p', {
        status: 'archived',
      });
      expect(archived.status).toBe('archived');

      // Delete
      await service.deletePlasmid('lifecycle-p');

      try {
        await service.getPlasmid('lifecycle-p');
        fail('Should have been deleted');
      } catch (error) {
        expect((error as DomainError).code).toBe('NOT_FOUND');
      }
    });

    it('should support plasmid versioning via parent-child', async () => {
      const v1 = await service.createPlasmid({
        id: 'v1',
        name: 'pGFP v1',
        status: 'validated',
      });

      const v2 = await service.createPlasmid({
        id: 'v2',
        name: 'pGFP v2',
        status: 'draft',
        parentId: v1.id,
      });

      expect(v2.parentId).toBe(v1.id);
    });
  });
});
