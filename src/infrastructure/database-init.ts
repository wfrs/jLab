/**
 * Database Schema Initialization
 * Creates all required tables for jlab if they don't exist.
 * Idempotent and non-destructive: existing tables (and their data) are
 * left untouched. Single source of truth for the schema — used by both
 * the /api/init route and `npm run db:init`.
 */

import { Knex } from 'knex';
import { Logger } from '@infrastructure/logger';

const logger = new Logger({ operation: 'db-init' });

async function createTableIfMissing(
  qb: Knex,
  tableName: string,
  builder: (table: Knex.CreateTableBuilder) => void
): Promise<void> {
  const exists = await qb.schema.hasTable(tableName);
  if (exists) {
    logger.debug(`Table already exists, skipping: ${tableName}`);
    return;
  }
  await qb.schema.createTable(tableName, builder);
  logger.info(`Created table: ${tableName}`);
}

/**
 * Add any of the named columns that the table does not already have.
 * Additive only — existing columns and their data are never touched.
 */
async function addColumnsIfMissing(
  qb: Knex,
  tableName: string,
  columns: Record<string, (table: Knex.AlterTableBuilder) => void>
): Promise<void> {
  const toAdd: Array<[string, (table: Knex.AlterTableBuilder) => void]> = [];
  for (const [column, builder] of Object.entries(columns)) {
    if (!(await qb.schema.hasColumn(tableName, column))) {
      toAdd.push([column, builder]);
    }
  }

  if (toAdd.length === 0) {
    return;
  }
  await qb.schema.alterTable(tableName, (table) => {
    for (const [, builder] of toAdd) {
      builder(table);
    }
  });
  logger.info(`Added ${tableName} columns: ${toAdd.map(([c]) => c).join(', ')}`);
}

/**
 * Initialize database schema
 * Safe to call multiple times; never drops or modifies existing tables.
 */
export async function initializeDatabase(qb: Knex): Promise<void> {
  logger.info('Initializing database schema...');

  try {
    await createTableIfMissing(qb, 'plasmids', (table) => {
      table.string('id').primary();
      table.string('name').notNullable().index();
      table.text('description').nullable();
      table.integer('sizeBp').nullable().index();
      table.string('parentId').nullable().index();
      table.string('backboneVector').nullable();
      table.enum('status', ['draft', 'validated', 'archived']).notNullable().index();
      table.string('createdAt').notNullable();
      table.string('updatedAt').notNullable();
    });

    // Additive migration for databases created before backboneVector existed
    const hasBackboneVector = await qb.schema.hasColumn('plasmids', 'backboneVector');
    if (!hasBackboneVector) {
      await qb.schema.alterTable('plasmids', (table) => {
        table.string('backboneVector').nullable();
      });
      logger.info('Added plasmids.backboneVector column');
    }

    // Additive migration for the lab spreadsheet import (docs/plans/label-printing.md §0.2)
    await addColumnsIfMissing(qb, 'plasmids', {
      constructName: (table) => table.string('constructName').nullable().index(),
      insertName: (table) => table.string('insertName').nullable(),
      insertSizeBp: (table) => table.integer('insertSizeBp').nullable(),
      category: (table) => table.string('category').nullable().index(),
      bacterialResistance: (table) => table.string('bacterialResistance').nullable(),
      plantResistance: (table) => table.string('plantResistance').nullable(),
      box: (table) => table.integer('box').nullable().index(),
      sequencingResult: (table) => table.text('sequencingResult').nullable(),
      sequencingDate: (table) => table.string('sequencingDate').nullable(),
      comment: (table) => table.text('comment').nullable(),
      notes: (table) => table.text('notes').nullable(),
    });

    await createTableIfMissing(qb, 'cassettes', (table) => {
      table.string('id').primary();
      table.string('plasmidId').notNullable().index();
      table.string('name').notNullable();
      table.text('sequence').nullable();
      table
        .enum('type', ['promoter', 'terminator', 'marker', 'origin', 'resistance', 'other'])
        .notNullable();
      table.integer('position').notNullable();
      table.string('createdAt').notNullable();
      table.string('updatedAt').notNullable();
      table.foreign('plasmidId').references('plasmids.id').onDelete('CASCADE');
    });

    await createTableIfMissing(qb, 'primers', (table) => {
      table.string('id').primary();
      table.string('plasmidId').notNullable().index();
      table.string('name').notNullable();
      table.text('sequence').notNullable();
      table.float('tmCelsius').nullable();
      table.float('gcPercent').nullable();
      table.string('createdAt').notNullable();
      table.string('updatedAt').notNullable();
      table.foreign('plasmidId').references('plasmids.id').onDelete('CASCADE');
    });

    await createTableIfMissing(qb, 'features', (table) => {
      table.string('id').primary();
      table.string('plasmidId').notNullable().index();
      table.string('name').notNullable();
      table
        .enum('type', ['gene', 'promoter', 'terminator', 'rbs', 'his_tag', 'flag_tag', 'other'])
        .notNullable();
      table.integer('startPos').notNullable();
      table.integer('endPos').notNullable();
      table.enum('strand', ['+', '-']).notNullable();
      table.string('createdAt').notNullable();
      table.string('updatedAt').notNullable();
      table.foreign('plasmidId').references('plasmids.id').onDelete('CASCADE');
    });

    await createTableIfMissing(qb, 'glossary_features', (table) => {
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

    await createTableIfMissing(qb, 'organisms', (table) => {
      table.string('id').primary();
      table.string('fullName').notNullable().unique().index();
      table.string('shortName').nullable();
      table.string('riskGroup').notNullable().defaultTo('1');
      table.string('uid').notNullable();
      table.boolean('synced').notNullable().defaultTo(false);
      table.string('createdAt').notNullable();
      table.string('updatedAt').notNullable();
    });

    await createTableIfMissing(qb, 'gmos', (table) => {
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

    await createTableIfMissing(qb, 'attachments', (table) => {
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

    await createTableIfMissing(qb, 'genbank_files', (table) => {
      table.string('plasmidId').primary();
      table.string('filename').notNullable();
      table.text('content').notNullable();
      table.string('createdAt').notNullable();
      table.string('updatedAt').notNullable();
      table.foreign('plasmidId').references('plasmids.id').onDelete('CASCADE');
    });

    await createTableIfMissing(qb, 'projects', (table) => {
      table.string('id').primary();
      table.string('name').notNullable().unique().index();
      table.text('description').nullable();
      table.enum('status', ['active', 'archived']).notNullable().defaultTo('active').index();
      table.string('createdAt').notNullable();
      table.string('updatedAt').notNullable();
    });

    await createTableIfMissing(qb, 'project_plasmids', (table) => {
      table.string('projectId').notNullable().index();
      table.string('plasmidId').notNullable().index();
      table.string('addedAt').notNullable();
      table.primary(['projectId', 'plasmidId']);
      table.foreign('projectId').references('projects.id').onDelete('CASCADE');
      table.foreign('plasmidId').references('plasmids.id').onDelete('CASCADE');
    });

    await createTableIfMissing(qb, 'settings', (table) => {
      table.string('id').primary();
      table.string('name').notNullable().defaultTo('');
      table.string('initials').notNullable().defaultTo('');
      table.string('email').notNullable().defaultTo('');
      table.string('institution').notNullable().defaultTo('');
      table.boolean('duplicateGmos').notNullable().defaultTo(false);
      table.string('createdAt').notNullable();
      table.string('updatedAt').notNullable();
    });

    await createTableIfMissing(qb, 'users', (table) => {
      table.string('id').primary();
      table.string('name').notNullable();
      table.string('email').nullable().unique().index();
      table.string('passwordHash').notNullable();
      table.string('createdAt').notNullable();
      table.string('updatedAt').notNullable();
    });

    await createTableIfMissing(qb, 'integrations', (table) => {
      table.string('id').primary();
      table.string('plasmidId').notNullable().index();
      table
        .enum('type', ['google_drive', 'google_sheets', 'genbank', 'ice', 'filebrowser'])
        .notNullable()
        .index();
      table.string('externalId').notNullable();
      table.string('lastSync').nullable();
      table.enum('syncStatus', ['pending', 'synced', 'error']).notNullable().defaultTo('pending');
      table.text('errorMessage').nullable();
      table.string('createdAt').notNullable();
      table.string('updatedAt').notNullable();
      table.foreign('plasmidId').references('plasmids.id').onDelete('CASCADE');
    });

    // One row per preparation. The newest is the current tube; older rows are
    // the audit trail of who prepped what (docs/plans/label-printing.md §0.1).
    await createTableIfMissing(qb, 'plasmid_preps', (table) => {
      table.string('id').primary();
      table.string('plasmidId').notNullable().index();
      table.string('preppedOn').notNullable().index();
      table.string('operatorInitials').notNullable();
      table.float('concentrationNgUl').nullable();
      table.string('createdAt').notNullable();
      table.string('updatedAt').notNullable();
      table.foreign('plasmidId').references('plasmids.id').onDelete('CASCADE');
    });

    // E. coli stocks mirror plasmids; Agrobacterium stocks are numbered
    // independently and may carry no plasmid at all.
    await createTableIfMissing(qb, 'glycerol_stocks', (table) => {
      table.string('id').primary();
      table.string('stockId').notNullable().unique().index();
      table.string('plasmidId').nullable().index();
      table.string('organism').notNullable();
      table.string('strain').notNullable();
      table.string('constructLabel').nullable();
      table.string('madeOn').nullable().index();
      table.string('operatorInitials').nullable();
      table.string('bacterialResistance').nullable();
      table.string('externalSource').nullable();
      table.string('sourceNote').nullable();
      table.string('parentStockId').nullable().index();
      table.string('createdAt').notNullable();
      table.string('updatedAt').notNullable();
      table.foreign('plasmidId').references('plasmids.id').onDelete('SET NULL');
    });

    // What jlab has actually generated — the record the Word workflow lacked.
    await createTableIfMissing(qb, 'label_prints', (table) => {
      table.string('id').primary();
      table.enum('kind', ['plasmid', 'glycerol']).notNullable();
      table.string('targetId').notNullable();
      table.string('printedAt').notNullable().index();
      table.string('createdAt').notNullable();
      table.index(['kind', 'targetId']);
    });

    logger.info('Database schema initialization complete');
  } catch (error) {
    logger.error('Database initialization failed', error as Error);
    throw error;
  }
}
