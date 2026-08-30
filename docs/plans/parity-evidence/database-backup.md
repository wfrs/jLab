# Parity Evidence: Database Backup Download

**Date:** 2026-08-30
**Scope:** User-facing backup — download the whole database as one .db file
from Settings → Data.

## Legacy behavior

GMOCU never had a standalone backup button; backups existed only as guards
before risky operations:

- Before the uid schema migration (gmocu.py:464): silent
  `connection.backup(dst)` to `gmocu_backup_{YYYY-MM-DD}.db` in the user
  data folder.
- Before a DB import (gmocu.py:1566): a yes/no prompt — "Shall we make a
  backup of the current database in the Download folder as
  gmocu_backup_{date}.db" — then the same `connection.backup()`.

jlab already mirrors the guard pattern (the danger-zone reset writes a
VACUUM INTO backup beside the database before deleting anything, evidence
in database-reset.md). What was missing is the file the user can take away.

## v2 implementation

- `DatabaseResetService.downloadSnapshot()`: VACUUM INTO a uniquely named
  file in the OS temp dir (VACUUM INTO refuses existing paths; a UUID name
  never collides), read the bytes, delete the temp file (best effort, in
  `finally`). Refuses an in-memory database with a VALIDATION error. The
  timestamp format is shared with the reset's `backupPathFor` naming.
- `GET /api/database/backup` serves the bytes as an attachment
  (`jlab-backup-YYYYMMDD-HHMMSS.db`, name derived from the database
  filename) with Content-Length, using the shared
  `contentDispositionAttachment` helper — same response shape as the
  attachment download route.
- `DatabaseBackupSection` card at the top of Settings → Data: explains that
  the one file IS the full backup (attachments and GenBank live as BLOBs in
  the DB), advises taking one before imports (the legacy prompt's intent),
  states how to restore, shows the current database size (reused from the
  reset preview endpoint), and triggers the download via
  `window.location.href` (the GenBank/attachment download pattern).
- `formatBytes` extracted from DangerZoneSection into
  `src/shared/format-bytes.ts` and shared by both cards.

## Deviations

- On-demand instead of prompt-gated: legacy only offered the backup when
  about to do something risky; jlab keeps it one click away at any time.
  The import-time intent is preserved as advice on the card rather than an
  interrupting prompt.
- Snapshot via `VACUUM INTO` rather than the `sqlite3.backup()` API — the
  same engine-consistent copy, already the reset's mechanism.

## Verification

- `tests/integration/database-backup.test.ts` (5 tests, file-backed DBs):
  the snapshot carries the SQLite magic and reopens as a working database
  containing the seeded row; no `jlab-snapshot-*` files left in the temp
  dir; in-memory DB refused (service error + route 400); route serves
  correct Content-Type/Disposition/Length.
- Full suites green: 601 Jest (39 suites), `tsc` clean, Prettier clean.
- Live against the real database: GET /api/database/backup returned 200
  with `jlab-backup-20260830-110957.db`, 84,770,816 bytes matching
  Content-Length; the downloaded file opened with knex and matched the live
  app (390 plasmids = live total, 262 attachments, 238 GenBank files,
  settings initials intact). Settings card screenshot (`backup-card.png`)
  shows "Current size: 80.9 MB". Temp download removed afterwards.

## Incident during authoring (resolved)

The first version of the test file embedded a literal NUL byte inside the
`'SQLite format 3\u0000'` magic-string assertion — the same defect class
that made PlasmidLabel.tsx binary to git (commit 597d026). Caught by grep
before committing; the byte is now the six-character `\u0000` escape and
the file scans clean.
