/**
 * Query builder schema bootstrap (Integration)
 * A fresh clone has no jlab.db; the first connection must create the schema
 * so `npm run dev` alone yields a working app (regression: v1 import failed
 * with "no such table: plasmids" on a fresh checkout).
 */

import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { closeQueryBuilder, getQueryBuilder, setQueryBuilder } from '@infrastructure/query-builder';

const EXPECTED_TABLES = [
  'plasmids',
  'cassettes',
  'gmos',
  'attachments',
  'genbank_files',
  'glossary_features',
  'organisms',
  'organism_targets',
  'settings',
];

describe('Query builder schema bootstrap', () => {
  let tempDir: string;
  let dbPath: string;
  const originalDatabaseUrl = process.env.DATABASE_URL;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jlab-bootstrap-'));
    dbPath = path.join(tempDir, 'jlab.db');
    process.env.DATABASE_URL = dbPath;
    setQueryBuilder(null);
  });

  afterEach(async () => {
    await closeQueryBuilder();
    process.env.DATABASE_URL = originalDatabaseUrl;
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('creates the schema on first use when the database file does not exist', async () => {
    await expect(fs.access(dbPath)).rejects.toBeDefined();

    const db = getQueryBuilder();
    const rows = await db('plasmids').select('name');

    expect(rows).toEqual([]);
    for (const table of EXPECTED_TABLES) {
      expect(await db.schema.hasTable(table)).toBe(true);
    }
  });

  it('serves concurrent first queries once the schema is ready', async () => {
    const db = getQueryBuilder();
    const [plasmids, organisms, settings] = await Promise.all([
      db('plasmids').count({ n: '*' }).first(),
      db('organisms').count({ n: '*' }).first(),
      db('settings').count({ n: '*' }).first(),
    ]);

    expect(plasmids).toEqual({ n: 0 });
    expect(organisms).toEqual({ n: 0 });
    expect(settings).toEqual({ n: 0 });
  });

  it('keeps existing data when the same file is opened again', async () => {
    const now = new Date().toISOString();
    await getQueryBuilder()('plasmids').insert({
      id: 'p1',
      name: 'pKeep',
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    });
    await closeQueryBuilder();

    const rows = await getQueryBuilder()('plasmids').select('name');

    expect(rows).toEqual([{ name: 'pKeep' }]);
  });

  it('rejects queries with the open error when the database directory is missing', async () => {
    process.env.DATABASE_URL = path.join(tempDir, 'missing-dir', 'jlab.db');
    await closeQueryBuilder();

    await expect(getQueryBuilder()('plasmids').select('name')).rejects.toThrow(/SQLITE_CANTOPEN/);
  });
});
