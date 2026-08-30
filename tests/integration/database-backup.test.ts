/**
 * Integration Tests: database backup download.
 *
 * Legacy precedent: GMOCU offered a backup of the database before imports
 * (gmocu.py:1567, `connection.backup(dst)` to gmocu_backup_{date}.db);
 * jlab hands the same snapshot to the browser on demand. The snapshot must
 * be a real, openable SQLite database containing the live data.
 */

import knex, { Knex } from 'knex';
import { randomUUID } from 'crypto';
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { DatabaseResetService } from '@services/database-reset.service';
import { setQueryBuilder } from '@infrastructure/query-builder';
import { createTestSchema } from '../helpers/test-db';

type BackupRoute = typeof import('@app/api/database/backup/route');

let backupRoute: BackupRoute;
let service: DatabaseResetService;
let db: Knex;
let workDir: string;

const asNextRequest = (req: Request) => req as never;
const now = () => new Date().toISOString();

async function fileBackedDatabase(): Promise<void> {
  db = knex({
    client: 'sqlite3',
    connection: { filename: join(workDir, `jlab-${randomUUID()}.db`) },
    useNullAsDefault: true,
    pool: { min: 1, max: 1 },
  });
  setQueryBuilder(db);
  await createTestSchema(db);
  await db('plasmids').insert({
    id: 'plasmid-1',
    name: 'pJM0001',
    status: 'draft',
    createdAt: now(),
    updatedAt: now(),
  });
}

describe('Database backup download (Integration)', () => {
  beforeAll(async () => {
    workDir = mkdtempSync(join(tmpdir(), 'jlab-backup-test-'));
    backupRoute = await import('@app/api/database/backup/route');
    service = new DatabaseResetService();
  });

  afterAll(() => {
    rmSync(workDir, { recursive: true, force: true });
  });

  afterEach(async () => {
    await db?.destroy();
    setQueryBuilder(null);
  });

  it('produces an openable SQLite database containing the live data', async () => {
    await fileBackedDatabase();

    const snapshot = await service.downloadSnapshot();

    expect(snapshot.filename).toMatch(/^jlab-.*-backup-\d{8}-\d{6}\.db$/);
    expect(snapshot.sizeBytes).toBe(snapshot.bytes.length);
    expect(snapshot.bytes.subarray(0, 16).toString('latin1')).toBe('SQLite format 3\u0000');

    // Open the snapshot as its own database and read the row back
    const restoredPath = join(workDir, `restored-${randomUUID()}.db`);
    writeFileSync(restoredPath, snapshot.bytes);
    const restored = knex({
      client: 'sqlite3',
      connection: { filename: restoredPath },
      useNullAsDefault: true,
      pool: { min: 1, max: 1 },
    });
    try {
      const row = await restored('plasmids').where('id', 'plasmid-1').first();
      expect(row).toMatchObject({ name: 'pJM0001' });
    } finally {
      await restored.destroy();
    }
  });

  it('leaves nothing behind in the temp directory', async () => {
    await fileBackedDatabase();
    const before = readdirSync(tmpdir()).filter((name) => name.startsWith('jlab-snapshot-'));

    await service.downloadSnapshot();

    const after = readdirSync(tmpdir()).filter((name) => name.startsWith('jlab-snapshot-'));
    expect(after).toEqual(before);
  });

  it('refuses an in-memory database', async () => {
    db = knex({
      client: 'sqlite3',
      connection: ':memory:',
      useNullAsDefault: true,
      pool: { min: 1, max: 1 },
    });
    setQueryBuilder(db);
    await createTestSchema(db);

    await expect(service.downloadSnapshot()).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  describe('GET /api/database/backup', () => {
    it('serves the snapshot as a named .db attachment', async () => {
      await fileBackedDatabase();

      const response = await backupRoute.GET(
        asNextRequest(new Request('http://localhost/api/database/backup'))
      );

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/octet-stream');
      expect(response.headers.get('Content-Disposition')).toMatch(
        /^attachment; filename="jlab-.*\.db"/
      );

      const body = Buffer.from(await response.arrayBuffer());
      expect(String(body.length)).toBe(response.headers.get('Content-Length'));
      expect(body.subarray(0, 16).toString('latin1')).toBe('SQLite format 3\u0000');
    });

    it('400s for an in-memory database', async () => {
      db = knex({
        client: 'sqlite3',
        connection: ':memory:',
        useNullAsDefault: true,
        pool: { min: 1, max: 1 },
      });
      setQueryBuilder(db);
      await createTestSchema(db);

      const response = await backupRoute.GET(
        asNextRequest(new Request('http://localhost/api/database/backup'))
      );

      expect(response.status).toBe(400);
    });
  });
});
