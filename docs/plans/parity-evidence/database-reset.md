# Parity evidence — Danger zone: delete all data

Feature: a Settings option that empties every table except `settings`, after
backing up the database file.

## Why the usual parity gate does not apply

Legacy GMOCU has **no user-facing purge**. Its only destructive operation is a
schema migration (`gmocu.py:480`, `gmocu.py:491`) that drops and rebuilds the
`Features` and `Organisms` tables — and it takes a backup first:

```python
connection.backup(dst, pages=1, progress=progress)
...
sg.popup_yes_no('… you will find a backup in the GMOCU folder in any case')
```

There is no behaviour to match, so the legacy app contributes a _convention_
rather than a specification: **never destroy without writing a backup first, and
tell the user where it is.** That is the shape this feature copies.

## Decisions, and who made them

| Decision    | Choice                                                    | Source |
| ----------- | --------------------------------------------------------- | ------ |
| Scope       | Everything except `settings` — glossary and GMOs included | Robin  |
| Safety net  | Automatic backup of the `.db` file before deleting        | Robin  |
| Visibility  | Always visible in Settings, including for the lab user    | Robin  |
| GMO records | Cleared like any other table, no separate opt-in          | Robin  |

Three concerns were raised before the decision and are recorded here because
the design does not mitigate them, it accepts them:

1. **263 attachments and 239 GenBank files are BLOBs living only in the
   database**, and the project is not under version control. The backup file is
   the sole route back.
2. **372 GMO records** are the rows behind the Formblatt-Z reports, which are
   regulatory documentation. They are cleared with everything else.
3. The card is **visible to the lab user**, not gated to dev builds.

The confirmation ritual and the backup are therefore load-bearing rather than
decorative, and are what the tests concentrate on.

## Design

**Backup via `VACUUM INTO`,** not a file copy. SQLite writes a consistent,
defragmented snapshot from inside the engine; a plain copy can tear if a write
lands mid-read. It is the modern equivalent of the `connection.backup()` API
GMOCU calls. Measured on the real 80.5 MB database: 80.5 MB out,
`pragma integrity_check` → `ok`.

**The backup is written before the transaction opens** — `VACUUM` cannot run
inside one — so a backup that cannot be written aborts the reset with every row
still in place. `VACUUM INTO` refuses to overwrite an existing file, a property
kept rather than worked around.

**`VACUUM` afterwards reclaims the freed pages.** Without it a "delete all data"
leaves an 80 MB file of empty pages on disk. Measured: 80.5 MB → 0.3 MB.

**The phrase `DELETE ALL DATA` is checked on the server**, not only in the UI,
so a stray or replayed POST cannot wipe the database. Typing a phrase forces a
context switch that a yes/no dialog does not.

**The UI states real numbers before it will accept anything** — per-table row
counts fetched from `GET /api/database/reset`, the database size, and named
warnings for the attachment, GenBank and GMO counts.

**`settings` survives** because it holds the initials printed on every label and
the institution on every Formblatt-Z.

## Evidence

### Automated — `tests/integration/database-reset.test.ts`, 15 tests

The load-bearing ones:

```
names every table in the database except the preserved ones
  -> sqlite_master compared against RESET_TABLES + PRESERVED_TABLES
writes a backup that still holds the deleted data
  -> integrity_check ok; the attachment BLOB reads back byte-for-byte
deletes nothing when the backup cannot be written
  -> path occupied, reset rejected, all rows still present
refuses an in-memory database, which cannot be backed up
rejects a wrong confirmation phrase and deletes nothing
  -> 'delete all data', 'yes', '' all rejected; data intact
```

The schema-coverage test is the one that earns its keep over time: a table added
later and not added to `RESET_TABLES` would otherwise survive a "delete all
data" silently. **It immediately found that `tests/helpers/test-db.ts` was
missing the `users` table** that `database-init.ts:227` creates — a pre-existing
gap in the test schema, now fixed.

Full suite: **494 Jest tests**, 15 Playwright, `tsc` clean, ESLint 0 errors.

### Live — preview and refusals against the real database

```
GET  /api/database/reset      1471 rows, 80.5 MB
                              gmos 372, cassettes 266, attachments 263,
                              plasmids 244, genbank_files 239,
                              glossary_features 60, organisms 27
POST {}                                        -> 400
POST {"confirmation":"yes"}                    -> 400
POST {"confirmation":"delete all data"}        -> 400   (case matters)
plasmids after all of the above                -> 244   (unchanged)
/settings renders the Danger zone card
```

### Live — the destructive path, on a copy of the real database

Run against a temporary copy so `jlab.db` was never at risk:

```
working copy         80.5 MB, 1471 rows
reset                deleted 1471 rows
  backup             80.5 MB, integrity_check ok
  freed              80.2 MB on disk
after                0 rows, 0.3 MB
settings preserved   true (initials JL -> JL)
backup contents      plasmids 244, attachments 263, genbank_files 239,
                     gmos 372, glossary_features 60
                     first attachment "sequencing_result.ab1" -> 2048 bytes restored
```

`./jlab.db` verified unchanged afterwards: 1471 rows, 80.5 MB.

## Known sharp edges

**The backup name is per-second.** Two resets inside the same second collide,
and `VACUUM INTO` refuses the second one. It fails closed with no data lost, and
the error now says so in words instead of surfacing `SQLITE_NOTADB`.

**Backups are never cleaned up.** Each reset leaves another 80 MB file beside
the database. They are gitignored (`*.db.backup-*`); nothing prunes them.

**There is no restore button.** Recovery means stopping the app and renaming the
backup over `jlab.db` by hand.
