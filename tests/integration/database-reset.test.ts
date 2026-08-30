/**
 * Integration Tests: database reset.
 *
 * The most destructive operation in the app, and the only one that cannot be
 * undone from inside it. These tests care about three things above all: that a
 * reset never runs without a readable backup, that nothing survives it except
 * settings, and that the confirmation cannot be bypassed.
 *
 * No legacy counterpart: GMOCU has no user-facing purge. Its only destructive
 * operation is a schema migration that calls `connection.backup(dst)` first
 * (gmocu.py:480), which is the precedent for backing up before deleting.
 */

import knex, { Knex } from 'knex';
import { randomUUID } from 'crypto';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  DatabaseResetService,
  RESET_CONFIRMATION,
  RESET_TABLES,
  PRESERVED_TABLES,
} from '@services/database-reset.service';
import { setQueryBuilder } from '@infrastructure/query-builder';
import { createTestSchema } from '../helpers/test-db';

type ResetRoute = typeof import('@app/api/database/reset/route');

let resetRoute: ResetRoute;
let service: DatabaseResetService;
let db: Knex;
let workDir: string;
let dbPath: string;

const asNextRequest = (req: Request) => req as never;
const now = () => new Date().toISOString();

/** A file-backed database, because an in-memory one cannot be backed up */
async function freshDatabase(): Promise<void> {
  dbPath = join(workDir, `jlab-${randomUUID()}.db`);
  db = knex({
    client: 'sqlite3',
    connection: { filename: dbPath },
    useNullAsDefault: true,
    pool: { min: 1, max: 1 },
  });
  setQueryBuilder(db);
  await createTestSchema(db);
}

async function seed(): Promise<{ plasmidId: string }> {
  const plasmidId = randomUUID();
  await db('plasmids').insert({
    id: plasmidId,
    name: 'pJM0001',
    constructName: 'pMiso000',
    status: 'draft',
    createdAt: now(),
    updatedAt: now(),
  });
  await db('cassettes').insert({
    id: randomUUID(),
    plasmidId,
    name: 'MCSpSEVA',
    type: 'other',
    position: 0,
    createdAt: now(),
    updatedAt: now(),
  });
  await db('plasmid_preps').insert({
    id: randomUUID(),
    plasmidId,
    preppedOn: '2024-01-31',
    operatorInitials: 'JM',
    concentrationNgUl: 80,
    createdAt: now(),
    updatedAt: now(),
  });
  await db('glycerol_stocks').insert({
    id: randomUUID(),
    stockId: 'CJM1',
    plasmidId,
    organism: 'E. coli',
    strain: 'TOP10',
    createdAt: now(),
    updatedAt: now(),
  });
  await db('label_prints').insert({
    id: randomUUID(),
    kind: 'plasmid',
    targetId: plasmidId,
    printedAt: now(),
    createdAt: now(),
  });
  await db('gmos').insert({
    id: randomUUID(),
    plasmidId,
    organismName: 'Escherichia coli',
    approval: '-',
    targetRiskGroup: 1,
    dateGenerated: '2024-01-31',
    dateDestroyed: null,
    entryDate: '2024-01-31',
    createdAt: now(),
    updatedAt: now(),
  });
  await db('attachments').insert({
    id: randomUUID(),
    plasmidId,
    filename: 'map.png',
    mimeType: 'image/png',
    sizeBytes: 4,
    data: Buffer.from('test'),
    createdAt: now(),
    updatedAt: now(),
  });
  await db('genbank_files').insert({
    plasmidId,
    filename: 'pJM0001.gb',
    content: 'LOCUS test',
    createdAt: now(),
    updatedAt: now(),
  });
  await db('glossary_features').insert({
    id: randomUUID(),
    annotation: 'p35S',
    alias: 'CaMV 35S',
    risk: 'No Risk',
    organism: 'CaMV',
    uid: randomUUID().replace(/-/g, ''),
    synced: false,
    createdAt: now(),
    updatedAt: now(),
  });
  await db('organisms').insert({
    id: randomUUID(),
    fullName: 'Escherichia coli',
    shortName: 'E. coli',
    riskGroup: '1',
    uid: randomUUID().replace(/-/g, ''),
    synced: false,
    createdAt: now(),
    updatedAt: now(),
  });
  await db('settings').insert({
    id: 'default',
    name: 'Julia',
    initials: 'JM',
    email: 'julia@example.org',
    institution: 'Example Institute',
    duplicateGmos: false,
    createdAt: now(),
    updatedAt: now(),
  });
  return { plasmidId };
}

describe('Database reset', () => {
  beforeAll(async () => {
    workDir = mkdtempSync(join(tmpdir(), 'jlab-reset-'));
    resetRoute = await import('@app/api/database/reset/route');
  });

  afterAll(() => {
    setQueryBuilder(null);
    rmSync(workDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    await freshDatabase();
    service = new DatabaseResetService();
  });

  afterEach(async () => {
    await db.destroy();
  });

  describe('coverage of the schema', () => {
    it('names every table in the database except the preserved ones', async () => {
      // The test that matters most over time: a table added later that nobody
      // adds to RESET_TABLES would silently survive a "delete all data".
      const rows = (await db.raw(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
      )) as { name: string }[];

      const inDatabase = rows.map((row) => row.name).sort();
      const accountedFor = [...RESET_TABLES, ...PRESERVED_TABLES].sort();

      expect(inDatabase).toEqual(accountedFor);
    });

    it('preserves settings and nothing else', () => {
      expect(PRESERVED_TABLES).toEqual(['settings']);
      expect(RESET_TABLES).not.toContain('settings');
    });
  });

  describe('preview', () => {
    it('counts what would go, without deleting anything', async () => {
      await seed();

      const preview = await service.preview();

      expect(preview.counts.plasmids).toBe(1);
      expect(preview.counts.attachments).toBe(1);
      expect(preview.counts.gmos).toBe(1);
      expect(preview.totalRows).toBe(10);
      expect(preview.databaseSizeBytes).toBeGreaterThan(0);

      // still all there
      expect(await db('plasmids').count({ c: '*' }).first()).toMatchObject({ c: 1 });
    });

    it('reports the path the backup will be written to', async () => {
      await seed();
      const preview = await service.preview();
      expect(preview.backupDirectory).toMatch(/\.backup-\d{8}-\d{6}$/);
    });
  });

  describe('reset', () => {
    it('empties every table except settings', async () => {
      await seed();

      const result = await service.reset(RESET_CONFIRMATION);

      expect(result.totalRows).toBe(10);
      for (const table of RESET_TABLES) {
        expect(await db(table).count({ c: '*' }).first()).toMatchObject({ c: 0 });
      }
      // The initials printed on every label survive
      const settings = await db('settings').first();
      expect(settings).toMatchObject({ initials: 'JM', institution: 'Example Institute' });
    });

    it('writes a backup that still holds the deleted data', async () => {
      // The backup is the only way back, so it is not enough that a file
      // appears — it has to be a readable database with the rows in it.
      const { plasmidId } = await seed();

      const result = await service.reset(RESET_CONFIRMATION);

      expect(existsSync(result.backupPath)).toBe(true);
      expect(result.backupSizeBytes).toBeGreaterThan(0);

      const backup = knex({
        client: 'sqlite3',
        connection: { filename: result.backupPath },
        useNullAsDefault: true,
      });
      try {
        const integrity = (await backup.raw('pragma integrity_check')) as {
          integrity_check: string;
        }[];
        expect(integrity[0]?.integrity_check).toBe('ok');

        expect(await backup('plasmids').count({ c: '*' }).first()).toMatchObject({ c: 1 });
        expect(await backup('gmos').count({ c: '*' }).first()).toMatchObject({ c: 1 });

        // the attachment BLOB, which exists nowhere else
        const attachment = await backup('attachments').where('plasmidId', plasmidId).first();
        expect(Buffer.from(attachment.data).toString()).toBe('test');

        const genbank = await backup('genbank_files').where('plasmidId', plasmidId).first();
        expect(genbank.content).toBe('LOCUS test');
      } finally {
        await backup.destroy();
      }
    });

    it('reclaims the disk space rather than leaving an 80 MB file of free pages', async () => {
      await seed();
      // A payload big enough that the freed pages are measurable
      await db('attachments').insert({
        id: randomUUID(),
        plasmidId: (await db('plasmids').first()).id,
        filename: 'big.bin',
        mimeType: 'application/octet-stream',
        sizeBytes: 2_000_000,
        data: Buffer.alloc(2_000_000, 7),
        createdAt: now(),
        updatedAt: now(),
      });

      const before = await service.preview();
      const result = await service.reset(RESET_CONFIRMATION);

      expect(before.databaseSizeBytes).toBeGreaterThan(1_000_000);
      expect(result.reclaimedBytes).toBeGreaterThan(1_000_000);

      const after = await service.preview();
      expect(after.databaseSizeBytes).toBeLessThan(before.databaseSizeBytes!);
    });

    it('is a no-op on an already empty database, but still takes a backup', async () => {
      const result = await service.reset(RESET_CONFIRMATION);

      expect(result.totalRows).toBe(0);
      expect(existsSync(result.backupPath)).toBe(true);
    });
  });

  describe('refusing to run', () => {
    it('rejects a wrong confirmation phrase and deletes nothing', async () => {
      await seed();

      await expect(service.reset('delete all data')).rejects.toThrow(/Confirmation must be/);
      await expect(service.reset('yes')).rejects.toThrow(/Confirmation must be/);
      await expect(service.reset('')).rejects.toThrow(/Confirmation must be/);

      expect(await db('plasmids').count({ c: '*' }).first()).toMatchObject({ c: 1 });
    });

    it('refuses an in-memory database, which cannot be backed up', async () => {
      const memory = knex({
        client: 'sqlite3',
        connection: { filename: ':memory:' },
        useNullAsDefault: true,
        pool: { min: 1, max: 1 },
      });
      setQueryBuilder(memory);
      await createTestSchema(memory);

      try {
        await expect(new DatabaseResetService().reset(RESET_CONFIRMATION)).rejects.toThrow(
          /no backup can be written/
        );
      } finally {
        await memory.destroy();
        setQueryBuilder(db);
      }
    });

    it('deletes nothing when the backup cannot be written', async () => {
      // VACUUM INTO refuses an existing path. Occupy the one the service will
      // pick and the reset must abort with the data still there.
      await seed();
      const occupied = join(workDir, `occupied-${randomUUID()}.db`);
      writeFileSync(occupied, 'in the way');
      // Pinned rather than computed: the real path carries a per-second
      // timestamp, and racing it across a second boundary makes the test lie.
      jest.spyOn(service, 'backupPathFor').mockReturnValue(occupied);

      await expect(service.reset(RESET_CONFIRMATION)).rejects.toThrow(/nothing was deleted/);

      expect(await db('plasmids').count({ c: '*' }).first()).toMatchObject({ c: 1 });
      expect(await db('attachments').count({ c: '*' }).first()).toMatchObject({ c: 1 });
    });
  });

  describe('API route', () => {
    it('GET previews without deleting', async () => {
      await seed();

      const response = await resetRoute.GET(
        asNextRequest(new Request('http://localhost/api/database/reset'))
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.totalRows).toBe(10);
      expect(await db('plasmids').count({ c: '*' }).first()).toMatchObject({ c: 1 });
    });

    it('POST with the exact phrase clears the database', async () => {
      await seed();

      const response = await resetRoute.POST(
        asNextRequest(
          new Request('http://localhost/api/database/reset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ confirmation: RESET_CONFIRMATION }),
          })
        )
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.totalRows).toBe(10);
      expect(body.data.backupPath).toMatch(/\.backup-/);
      expect(await db('plasmids').count({ c: '*' }).first()).toMatchObject({ c: 0 });
    });

    it('400s on a missing or wrong phrase, and the data stays', async () => {
      await seed();

      for (const body of [{}, { confirmation: 'nope' }, { confirmation: 'delete all data' }]) {
        const response = await resetRoute.POST(
          asNextRequest(
            new Request('http://localhost/api/database/reset', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            })
          )
        );
        expect(response.status).toBe(400);
      }

      expect(await db('plasmids').count({ c: '*' }).first()).toMatchObject({ c: 1 });
    });

    it('400s on a malformed body', async () => {
      const response = await resetRoute.POST(
        asNextRequest(
          new Request('http://localhost/api/database/reset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: 'not json',
          })
        )
      );

      expect(response.status).toBe(400);
    });
  });
});
