# Parity Evidence: GMOCU v1 Database Import

**Date:** 2026-08-29
**Scope:** ImportService (v1 SQLite parsing, mapping, transactional import), POST /api/import (dryRun inspection + selective import), ImportSection card on /settings

Grounded in the legacy source in-repo: `gmocu/gmocu.py` `import_data()` (L1502–1694) and the v1 schema in `gmocu/gmocu.sql`. Verified against the real example databases shipped with the legacy repo (`gmocu/example/GMOCU-0.7/gmocu.db`, `gmocu/example/GMOCU-0.4/gmocu.db`).

---

## Legacy GMOCU behavior preserved

| Legacy behavior                                                                     | New implementation                                                                | Verified by                             |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------- |
| Candidates = source plasmids whose name does not exist locally (L1519)              | `computeCandidates`: source-order names minus local names                          | Service + API tests, UI smoke           |
| User selects a subset or "Import all" (selection dialog L1524–1555)                 | Checkbox list on /settings (preselected = all); omitted `names` = import all       | API tests, UI smoke                     |
| Plasmid content fields copied (L1590)                                               | Field mapping to the v2 plasmid model (see mapping table below)                    | Service tests + live import             |
| Cassettes copied and re-linked to the new plasmid id (L1594–1601)                   | content → `cassettes.name`, source order → position, type `other`                  | Service tests + live import             |
| GMOs copied and re-linked (L1604–1608)                                              | organism_name verbatim, approval/target_RG/dates with legacy defaults              | Service tests + live import             |
| Attachments (BLOBs) copied and re-linked (L1611–1615)                               | file → `attachments.data` byte-for-byte, Filename preserved                        | Service test (BLOB round-trip)          |
| Missing nucleic acid features imported from source by cassette tokens (L1619–1644)  | `cassetteBaseTokens()` (strips `[variant]`, splits on `-`) → copy missing entries  | Service tests + live import             |
| `risk` 'None' → 'No Risk' normalization (L1647)                                     | Applied to imported rows (see deviations)                                          | Service test                            |
| Missing organisms imported (from feature organisms + imported GMOs, L1650–1685)     | Same union; matched by short_name with full_name fallback                          | Service tests + live import             |
| Sources without `uid` columns get new uids (L1640–1644, 1680–1688)                  | `hasColumn` probe; fresh 32-hex uid when absent                                    | Service test (pre-0.5 fixture)          |
| GMO summary copied (`GMO_summary`)                                                  | Not stored — v2 derives the summary at render time (established v2 design)         | organisms-and-gmos.md                   |

## Legacy → v2 plasmid field mapping

| Legacy column                       | v2 destination                                                        |
| ----------------------------------- | --------------------------------------------------------------------- |
| name                                | `name`                                                                |
| status (SelectionValues id)         | `status`: Complete → validated, Abandoned → archived, else draft      |
| purpose / summary / clone / marker  | folded into `description` (purpose first, others as labeled lines)    |
| backbone_vector                     | `backboneVector`                                                      |
| genebank + gb_name                  | `genbank_files` row (v2 normalization; `.gb` appended when missing)   |
| date                                | `createdAt` (midnight UTC of the legacy entry date)                   |
| alias                               | dropped — derived data (legacy `update_alias` regenerates it from cassette content) |
| gb, FKattachment, organism_selector | dropped — legacy UI/derived state with no v2 meaning                  |
| target_RG, generated, destroyed     | not copied from the plasmid row — the same data arrives via the GMO rows |

## Documented deviations (all safety-motivated)

- **Case-insensitive name matching** — legacy compared names case-sensitively; v2
  enforces case-insensitive plasmid-name uniqueness, so candidates are matched
  the same way (prevents importing a name that differs only in case).
- **Duplicate names within the source import once** — legacy imported every
  same-named row (creating local duplicates); v2 imports the first and reports
  the rest in `skippedDuplicateNames`.
- **Single transaction** — legacy committed after the plasmid loop and again
  after each glossary phase; v2 wraps the entire import in one transaction, so
  a failure leaves the local database untouched.
- **Risk normalization is scoped** — legacy ran a substring
  `REPLACE(risk,'None','No Risk')` over the entire local Features table
  (mutating unrelated rows, e.g. 'None known'); v2 normalizes exact
  `'None'`/empty on imported rows only.
- **No backup prompt** — legacy offered a full-DB backup copy before import;
  v2's single transaction removes the failure mode it guarded against.
  A backup/export feature can ship separately if wanted.
- **Attachment mimeType** is `application/octet-stream` (legacy stored no
  content type); download behavior matches the legacy save-to-disk flow.

## Verification results

- 296/296 Jest tests passing (16 new in `tests/integration/import.test.ts`:
  3 inspection + 7 service import + 6 API route)
- `tsc --noEmit` clean; ESLint clean (one pre-existing page warning); Prettier applied
- **Live end-to-end against the real legacy example DBs** (dev server + curl):
  - GMOCU-0.7 and GMOCU-0.4 example `gmocu.db` both inspect correctly
    (candidates pCW001–pCW004)
  - Imported pCW001/pCW002: status validated (legacy Complete), composed
    description, backboneVector pET28a, cassette `Pt7-EGFP-tag6His-Tt7`,
    GMO with real generated/destroyed dates, 10.3 KB GenBank file,
    attachments copied byte-for-byte (0-byte placeholders in the example DB
    are 0 bytes locally — faithful copy; non-empty BLOB round-trip is
    covered by tests)
- **Playwright UI smoke** on /settings: file picked → 4 candidates listed and
  preselected → Select none disables Import → Import 4 plasmids → success
  summary (6 cassettes, 7 GMOs, 2 attachments, 4 GenBank files, 13 features,
  3 organisms) → re-selecting the same file reports "No new plasmids to
  import". Screenshots captured. Test data cleaned up afterwards.

## Test matrix

- Happy path: full import, selective import, import-all via API
- Validation path: non-SQLite file, SQLite without GMOCU tables, empty upload,
  malformed `names` field, missing file field (all 400/VALIDATION, no writes)
- Error path: source connection always destroyed + temp file removed (finally)
- Regression path: existing plasmids/glossary entries never overwritten or
  duplicated; full suite 296/296
- Compatibility path: v0.7 (uid columns) and pre-0.5 (no uid columns) sources
