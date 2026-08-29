/**
 * Shared test database helper
 * Creates an in-memory SQLite database with the full jlab schema
 * (mirrors docs/plans/DATABASE_SCHEMA_MIGRATION.md).
 */

import knex, { Knex } from 'knex';

export function createTestDb(): Knex {
  return knex({
    client: 'sqlite3',
    connection: ':memory:',
    useNullAsDefault: true,
    pool: { min: 1, max: 1 },
  });
}

export async function createTestSchema(db: Knex): Promise<void> {
  await db.schema.createTableIfNotExists('plasmids', (table) => {
    table.text('id').primary();
    table.text('name').notNullable();
    table.text('description').nullable();
    table.integer('sizeBp').nullable();
    table.text('parentId').nullable();
    table.text('backboneVector').nullable();
    table.enum('status', ['draft', 'validated', 'archived']).defaultTo('draft');
    table.dateTime('createdAt').notNullable();
    table.dateTime('updatedAt').notNullable();
  });

  await db.schema.createTableIfNotExists('cassettes', (table) => {
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

  await db.schema.createTableIfNotExists('primers', (table) => {
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

  await db.schema.createTableIfNotExists('features', (table) => {
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

  await db.schema.createTableIfNotExists('integrations', (table) => {
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

  await db.schema.createTableIfNotExists('project_plasmids', (table) => {
    table.text('projectId').notNullable();
    table.text('plasmidId').notNullable();
    table.dateTime('addedAt').notNullable();
    table.primary(['projectId', 'plasmidId']);
    table.foreign('plasmidId').references('plasmids.id');
  });

  await db.schema.createTableIfNotExists('glossary_features', (table) => {
    table.string('id').primary();
    table.string('annotation').notNullable().unique().index();
    table.string('alias').nullable();
    table.string('risk').notNullable().defaultTo('No Risk');
    table.string('organism').nullable();
    table.string('uid').notNullable();
    table.boolean('synced').notNullable().defaultTo(false);
    table.string('createdAt').notNullable();
    table.string('updatedAt').notNullable();
  });

  await db.schema.createTableIfNotExists('organisms', (table) => {
    table.string('id').primary();
    table.string('fullName').notNullable().unique().index();
    table.string('shortName').nullable();
    table.string('riskGroup').notNullable().defaultTo('1');
    table.string('uid').notNullable();
    table.boolean('synced').notNullable().defaultTo(false);
    table.string('createdAt').notNullable();
    table.string('updatedAt').notNullable();
  });

  await db.schema.createTableIfNotExists('gmos', (table) => {
    table.string('id').primary();
    table.string('plasmidId').notNullable().index();
    table.string('organismName').notNullable();
    table.string('approval').notNullable().defaultTo('-');
    table.integer('targetRiskGroup').notNullable().defaultTo(1);
    table.string('dateGenerated').notNullable();
    table.string('dateDestroyed').nullable();
    table.string('entryDate').notNullable();
    table.string('createdAt').notNullable();
    table.string('updatedAt').notNullable();
    table.foreign('plasmidId').references('plasmids.id').onDelete('CASCADE');
  });

  await db.schema.createTableIfNotExists('settings', (table) => {
    table.string('id').primary();
    table.string('name').notNullable().defaultTo('');
    table.string('initials').notNullable().defaultTo('');
    table.string('email').notNullable().defaultTo('');
    table.string('institution').notNullable().defaultTo('');
    table.boolean('duplicateGmos').notNullable().defaultTo(false);
    table.string('createdAt').notNullable();
    table.string('updatedAt').notNullable();
  });

  await db.schema.createTableIfNotExists('attachments', (table) => {
    table.string('id').primary();
    table.string('plasmidId').notNullable().index();
    table.string('filename').notNullable();
    table.string('mimeType').notNullable().defaultTo('application/octet-stream');
    table.integer('sizeBytes').notNullable();
    table.binary('data').notNullable();
    table.string('createdAt').notNullable();
    table.string('updatedAt').notNullable();
    table.foreign('plasmidId').references('plasmids.id').onDelete('CASCADE');
  });

  await db.schema.createTableIfNotExists('genbank_files', (table) => {
    table.string('plasmidId').primary();
    table.string('filename').notNullable();
    table.text('content').notNullable();
    table.string('createdAt').notNullable();
    table.string('updatedAt').notNullable();
    table.foreign('plasmidId').references('plasmids.id').onDelete('CASCADE');
  });

  await db.schema.createTableIfNotExists('projects', (table) => {
    table.text('id').primary();
    table.text('name').notNullable();
    table.text('description').nullable();
    table.enum('status', ['active', 'archived']).defaultTo('active');
    table.dateTime('createdAt').notNullable();
    table.dateTime('updatedAt').notNullable();
  });
}

/** Deletes all rows, child tables first (respects foreign keys) */
export async function cleanTestDb(db: Knex): Promise<void> {
  await db('project_plasmids').delete();
  await db('attachments').delete();
  await db('genbank_files').delete();
  await db('integrations').delete();
  await db('features').delete();
  await db('primers').delete();
  await db('cassettes').delete();
  await db('gmos').delete();
  await db('plasmids').delete();
  await db('projects').delete();
  await db('glossary_features').delete();
  await db('organisms').delete();
  await db('settings').delete();
}
