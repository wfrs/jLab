# Parity Evidence: Glossary Excel Import

**Date:** 2026-08-29
**Scope:** GlossaryExcelService.importWorkbook, POST /api/glossary/import, GlossaryImportSection card on /glossary; shared `normalizeRisk`/`trimmedOrNull` extracted to `src/domain/glossary-normalization.ts`

Grounded in the legacy source in-repo: `gmocu/gmocu.py` `add_to_features()` (L721–739), `add_to_organisms()` (L741–753), and their call sites `-ADDFEATURESEXCEL-` (L2412) and `-ADDEXCELORGA-` (L2442). Verified against the real templates shipped with the legacy app: `gmocu/example/glossary_Jores_lab.xlsx` and `gmocu/example/organisms.xlsx`.

---

## Legacy behavior preserved

| Legacy behavior                                                                   | New implementation                                               | Verified by                     |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------- |
| Annotation normalization on import: `-`→`_`, `[`→`(`, `]`→`)`, ` `→`_` (L725-728) | `normalizeAnnotation()` — the same function the glossary UI uses | Real-template test (4 rewrites) |
| Only new entries are added; existing keys are skipped and reported (L729-731)     | `skippedExisting`, never an update                               | "never overwrites" test         |
| Blank/`None` risk becomes `No Risk` (L732 + L1647)                                | `normalizeRisk()`, shared with the v1 database importer          | Real-template test              |
| Features matched by annotation (L724)                                             | Same, after normalization                                        | Normalized-collision test       |
| Organisms matched by short name (L744)                                            | Matched by full name AND short name (see deviations)             | Idempotency test                |
| RG stored as text (L750)                                                          | `riskGroup` text column; missing RG defaults to `1`              | Missing-column test             |
| uid generated locally when the sheet has none                                     | 32-hex uid per row, `synced: false`                              | Import tests                    |

## Deliberate deviations

- **Sheets are located by name, then by header sniff.** Legacy always read
  `sheet_name = 0`. The shipped two-sheet template has `features` first, so
  legacy could import its features but _never its organisms_ — that is why a
  separate single-sheet `organisms.xlsx` exists at all. jlab reads whichever
  of `features` / `organisms` is present (falling back to a header sniff for
  `annotation` / `full_name`), so one upload of the two-sheet template
  imports both, and the single-sheet file still works.
- **Organisms are imported before features** within the same transaction, so
  a two-sheet upload resolves its own organism references.
- **Rows duplicated inside the file are skipped and reported.** Legacy
  deduplicated only against the database, so it would insert both copies.
  This is not hypothetical: _both_ shipped templates contain
  `Discosoma sp. / DiSp` twice, which would violate jlab's unique
  `organisms.fullName`.
- **Organisms match on full name and short name.** jlab makes `fullName`
  unique; legacy compared `short_name` only.
- **Blank alias/organism cells stay NULL.** Legacy's `fillna('None')` wrote
  the literal string `None` into every empty cell, and only the `risk` column
  was later rewritten — leaving `alias = 'None'` and `organism = 'None'` as
  real values in legacy databases.
- **One transaction.** A malformed sheet rolls the whole upload back;
  legacy committed per call and could half-import.
- **Unresolved organisms are reported.** After import, features whose
  organism resolves nowhere are listed, because that condition blocks
  Formblatt-Z generation. Legacy left the user to discover it later.

## Findings in the shipped templates (now test fixtures)

- `glossary_Jores_lab.xlsx`: 93 features, 33 organism rows. All 93 risks are
  the literal `None`. Four annotations require normalization
  (`PEST-2`, `SpCas9-HF1`, `t-arm`, `NLS-B3`), plus `SpCas9 ` with a trailing
  space. `Discosoma sp.` is duplicated.
- Five features (`Nkd1`, `JsiI`, `E2`, `Tip1`, `Tip4`) reference organism
  `UsMa`, which that file does not define — it exists only in
  `organisms.xlsx` (_Ustilago maydis_). Importing the glossary alone
  therefore blocks report generation until the organisms file is imported
  too; a test covers both halves of that sequence.
- `organisms.xlsx`: 34 rows, also containing the duplicate `Discosoma sp.`

## Verification results

- 337/337 Jest tests passing (19 new in `tests/integration/glossary-excel.test.ts`,
  using the two real templates as fixtures plus synthesized edge-case workbooks)
- `tsc --noEmit` clean; ESLint clean; Prettier applied
- **Live browser import of the real template** against the working database:
  44 entries added (38 features, 6 organisms), 55 features and 26 organisms
  correctly skipped as already present, the duplicate `Discosoma sp.` skipped,
  4 annotations normalized, and `UsMa` reported as unresolved. No console errors.
- The live import was a verification step, so it was **reverted afterwards**:
  the 38 features and 6 organisms it created were identified by their shared
  `createdAt` and deleted, restoring 60 features / 27 organisms and returning
  the data-quality report to `ok: true`.

## Test matrix

- Happy path: both real templates; two-sheet and single-sheet shapes
- Validation path: missing key column, no glossary sheet, non-xlsx upload,
  empty upload, missing file field (400 / VALIDATION)
- Error path: malformed second sheet rolls back the first sheet's inserts
- Regression path: idempotent re-import adds nothing; existing entries keep
  their alias and uid; full suite 337/337
- Compatibility path: sheets without `short_name` / `RG` / `alias` columns

## Follow-up

Export (legacy `-ALLEXCEL-` / `-USEDEXCEL-` and the organism equivalents,
L2285–2405) is the other half of inventory §5 and ships separately. Note
legacy derives its "used features" list with `'-'.join(lst).split('-')`,
which does not strip `[variant]` brackets — `cassetteBaseTokens()` should be
used instead.
