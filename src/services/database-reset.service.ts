/**
 * DatabaseResetService
 * Clears every table except `settings`, after taking a backup of the database
 * file. Services own transactions (ADR-0005).
 *
 * This is the most destructive thing jlab can do, and unlike everything else it
 * cannot be undone from inside the app: 263 attachments and 239 GenBank files
 * live as BLOBs in the database and nowhere else, and the project is not under
 * version control. The backup is therefore not a nicety — it is the only way
 * back, and a reset that cannot write one does not run.
 *
 * Legacy GMOCU sets the same precedent: its only destructive operation (a
 * schema migration at gmocu.py:480) calls `connection.backup(dst)` first and
 * tells the user "you will find a backup in the GMOCU folder in any case".
 * `VACUUM INTO` is the modern equivalent of that API.
 */

import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { basename, join } from 'path';
import { randomUUID } from 'crypto';
import { Knex } from 'knex';
import { DomainError } from '@domain/types';
import { Logger } from '@infrastructure/logger';
import { getQueryBuilder } from '@infrastructure/query-builder';

/**
 * Typed exactly, so adding a table to the schema without adding it here is a
 * compile-time decision rather than a silent survivor. The order deletes
 * children before parents; SQLite does not enforce the foreign keys here, but
 * a readable order is the one that stays correct if it ever does.
 */
export const RESET_TABLES = [
  'label_prints',
  'plasmid_preps',
  'glycerol_stocks',
  'attachments',
  'genbank_files',
  'primers',
  'features',
  'cassettes',
  'gmos',
  'project_plasmids',
  'integrations',
  'plasmids',
  'projects',
  'glossary_features',
  'organism_targets',
  'organisms',
  'users',
] as const;

export type ResetTable = (typeof RESET_TABLES)[number];

/**
 * The only table that survives. Settings holds the initials printed on every
 * label and the institution on every Formblatt-Z; wiping it would leave the
 * app booting into a half-configured state for no benefit.
 */
export const PRESERVED_TABLES = ['settings'] as const;

/** Typed by the caller, checked by the server — a stray POST cannot wipe. */
export const RESET_CONFIRMATION = 'DELETE ALL DATA';

export interface ResetPreview {
  counts: Record<string, number>;
  totalRows: number;
  databaseSizeBytes: number | null;
  /** Null when the database is in memory and cannot be backed up */
  backupDirectory: string | null;
}

export interface ResetResult {
  deleted: Record<string, number>;
  totalRows: number;
  backupPath: string;
  backupSizeBytes: number;
  /** Bytes the file shrank by once the freed pages were reclaimed */
  reclaimedBytes: number;
}

export interface BackupSnapshot {
  /** Download name, e.g. jlab-backup-20260830-114500.db */
  filename: string;
  sizeBytes: number;
  bytes: Buffer;
}

export class DatabaseResetService {
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger || new Logger();
  }

  private db(): Knex {
    return getQueryBuilder();
  }

  /**
   * Where the live database file is, or null when it is in memory.
   * Read from the live connection rather than the environment, so the path
   * reported is unambiguously the file being cleared.
   */
  databasePath(): string | null {
    const connection = this.db().client?.config?.connection as { filename?: string } | undefined;
    const filename = connection?.filename;
    if (!filename || filename === ':memory:' || filename.startsWith('file::memory:')) {
      return null;
    }
    return filename;
  }

  private async fileSize(path: string): Promise<number | null> {
    try {
      const stat = await fs.stat(path);
      return stat.size;
    } catch {
      return null;
    }
  }

  /** What a reset would delete, so the confirmation can state real numbers */
  async preview(): Promise<ResetPreview> {
    const counts: Record<string, number> = {};
    let totalRows = 0;

    for (const table of RESET_TABLES) {
      const row = (await this.db()(table).count({ count: '*' }).first()) as
        { count?: number } | undefined;
      const count = Number(row?.count ?? 0);
      counts[table] = count;
      totalRows += count;
    }

    const path = this.databasePath();

    return {
      counts,
      totalRows,
      databaseSizeBytes: path ? await this.fileSize(path) : null,
      backupDirectory: path ? this.backupPathFor(path, new Date()) : null,
    };
  }

  /**
   * `jlab.db` -> `jlab.db.backup-20260829-215500`.
   *
   * Beside the database rather than in a subdirectory, so someone who has lost
   * their data finds the backup in the first place they look — the same place
   * GMOCU puts its own.
   */
  backupPathFor(databasePath: string, at: Date): string {
    return `${databasePath}.backup-${this.timestamp(at)}`;
  }

  /** YYYYMMDD-HHMMSS, local time — sorts chronologically as a string */
  private timestamp(at: Date): string {
    const pad = (value: number) => String(value).padStart(2, '0');
    return (
      `${at.getFullYear()}${pad(at.getMonth() + 1)}${pad(at.getDate())}` +
      `-${pad(at.getHours())}${pad(at.getMinutes())}${pad(at.getSeconds())}`
    );
  }

  /**
   * Copy the whole database to `path` using SQLite's own VACUUM INTO, which
   * writes a consistent, defragmented snapshot from inside the engine. A plain
   * file copy can tear if a write lands mid-read; this cannot.
   *
   * VACUUM INTO refuses to write over an existing file, which is a property
   * worth keeping rather than working around.
   */
  async backup(path: string): Promise<number> {
    this.logger.info('DatabaseResetService.backup', { path });

    try {
      await this.db().raw('VACUUM INTO ?', [path]);
    } catch (error) {
      // Most likely the path is taken — the timestamp is per-second, so a
      // second reset inside the same second lands on the same name. Failing
      // closed is right; failing with a raw SQLITE_NOTADB is not.
      throw new DomainError(
        'DATABASE',
        `Could not write the backup to ${path}, so nothing was deleted. ` +
          'If a backup from this second already exists, wait a moment and try again.',
        { path, cause: error instanceof Error ? error.message : String(error) }
      );
    }

    const size = await this.fileSize(path);
    if (size === null || size === 0) {
      throw new DomainError('DATABASE', 'Backup file was not written; nothing was deleted', {
        path,
      });
    }
    return size;
  }

  /**
   * A consistent snapshot of the whole database for the user to download
   * (Settings → Data). VACUUM INTO a temporary file, read it back, delete
   * the temporary file.
   *
   * Legacy precedent: GMOCU offered "Shall we make a backup of the current
   * database in the Download folder as gmocu_backup_{date}.db" before a DB
   * import (gmocu.py:1567) — the same snapshot, handed to the user. Restoring
   * is replacing the database file with the downloaded one.
   */
  async downloadSnapshot(): Promise<BackupSnapshot> {
    const databasePath = this.databasePath();
    if (!databasePath) {
      throw new DomainError(
        'VALIDATION',
        'The database is in memory — there is no file to back up',
        {}
      );
    }

    // A unique name in the OS temp dir: VACUUM INTO refuses existing files,
    // and this name never exists
    const tempPath = join(tmpdir(), `jlab-snapshot-${randomUUID()}.db`);
    this.logger.info('DatabaseResetService.downloadSnapshot', { tempPath });

    try {
      try {
        await this.db().raw('VACUUM INTO ?', [tempPath]);
      } catch (error) {
        throw new DomainError('DATABASE', 'Could not write the backup snapshot', {
          cause: error instanceof Error ? error.message : String(error),
        });
      }

      const bytes = await fs.readFile(tempPath);
      if (bytes.length === 0) {
        throw new DomainError('DATABASE', 'Backup snapshot came out empty', {});
      }

      const base = basename(databasePath).replace(/\.db$/i, '') || 'jlab';
      return {
        filename: `${base}-backup-${this.timestamp(new Date())}.db`,
        sizeBytes: bytes.length,
        bytes,
      };
    } finally {
      await fs.unlink(tempPath).catch(() => {
        // Best effort — a stray file in the temp dir is the OS's to clean
      });
    }
  }

  /**
   * Back up, then clear every table except `settings`.
   *
   * The backup happens first and outside the transaction — VACUUM cannot run
   * inside one — so a failure to write it aborts before a single row is
   * deleted.
   */
  async reset(confirmation: string): Promise<ResetResult> {
    if (confirmation !== RESET_CONFIRMATION) {
      throw new DomainError('VALIDATION', `Confirmation must be exactly "${RESET_CONFIRMATION}"`, {
        field: 'confirmation',
      });
    }

    const databasePath = this.databasePath();
    if (!databasePath) {
      throw new DomainError(
        'VALIDATION',
        'Refusing to reset an in-memory database: no backup can be written',
        {}
      );
    }

    const before = await this.preview();
    const sizeBefore = before.databaseSizeBytes ?? 0;

    const backupPath = this.backupPathFor(databasePath, new Date());
    const backupSizeBytes = await this.backup(backupPath);

    this.logger.warn('DatabaseResetService.reset clearing all data', {
      totalRows: before.totalRows,
      backupPath,
    });

    const deleted: Record<string, number> = {};
    await this.db().transaction(async (trx) => {
      for (const table of RESET_TABLES) {
        deleted[table] = await trx(table).delete();
      }
    });

    // Reclaim the freed pages, or the file stays its old size on disk — the
    // 80 MB of attachments would still be sitting there after a "reset".
    await this.db().raw('VACUUM');
    const sizeAfter = (await this.fileSize(databasePath)) ?? sizeBefore;

    const totalRows = Object.values(deleted).reduce((sum, count) => sum + count, 0);

    this.logger.warn('DatabaseResetService.reset complete', {
      totalRows,
      backupPath,
      reclaimedBytes: Math.max(0, sizeBefore - sizeAfter),
    });

    return {
      deleted,
      totalRows,
      backupPath,
      backupSizeBytes,
      reclaimedBytes: Math.max(0, sizeBefore - sizeAfter),
    };
  }
}
