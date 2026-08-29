# Parity Evidence: Data Quality Checks

**Date:** 2026-08-29
**Scope:** DataQualityService (10 record-completeness and glossary-housekeeping checks), GET /api/health, DataQualitySection card on /reports

Grounded in the legacy source in-repo: `gmocu/gmocu.py` `check_plasmids()` (L1696–1727), `check_features()` (L1729–1772), `check_organisms()` (L1774–1802), and their call sites (L1892–1894 at startup, L1916–1917 and L1942–1943 after cassette/feature saves, L2049).

---

## Legacy behavior preserved

| Legacy behavior                                                                         | New implementation                                                                      | Verified by         |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------- |
| Cassette tokens missing from the feature glossary, reported as `plasmid: token` (L1755) | `missing-features` check (error) — delegates to `checkGlossaryIntegrity()`              | Service + API tests |
| Variants in `[...]` stripped before token resolution (L1746)                            | `cassetteBaseTokens()` — shared with the report gate                                    | `prom[v2]` test     |
| Organisms used by features/GMOs missing from the organism glossary (L1787–1791)         | `missing-organisms` check (error), reported as `annotation: organism` / `GMO: organism` | Service tests       |
| Empty fields in the feature glossary (L1734)                                            | `incomplete-glossary-features` check (warning), naming the blank fields                 | Service tests       |
| Duplicate plasmid names (L1703)                                                         | `duplicate-plasmid-names` check (warning)                                               | Service tests       |
| Plasmids with no backbone vector (L1705)                                                | `plasmids-without-backbone` check (warning); v2 also treats NULL/whitespace as blank    | Service tests       |
| Plasmids with no cassettes (L1708–1713)                                                 | `plasmids-without-cassettes` check (warning)                                            | Service tests       |
| Plasmids with no GMO records (L1715–1720)                                               | `plasmids-without-gmos` check (warning)                                                 | Service tests       |
| Glossary features referenced by no cassette — legacy `redundant` (L1757)                | `redundant-features` check (info)                                                       | Service tests       |
| Organisms referenced by no feature or GMO — legacy `redundant` (L1792)                  | `redundant-organisms` check (info); matches by short OR full name                       | Service tests       |
| Duplicate organism short names — legacy `dupes` (L1786)                                 | `duplicate-organism-short-names` check (warning)                                        | Service tests       |

## Deliberate improvement: legacy computed these and threw them away

This is the headline finding of the parity study. In legacy:

- **`check_plasmids()` has no popup at all.** It computes duplicate names,
  missing backbone, missing cassettes and missing GMOs, returns all four
  lists — and every call site discards the return value. The four
  diagnostics were dead code; a user could never see them.
- **`check_features()` and `check_organisms()` popup only for the _missing_
  cases.** Their `redundant` and `dupes` lists are likewise computed and
  discarded at every call site.

v2 surfaces all of them, graded by severity:

- **error** — blocks Formblatt-Z generation (the two integrity-gate checks)
- **warning** — record is incomplete; export still runs
- **info** — housekeeping only; nothing is broken

## Other deliberate deviations

- **On demand, not on startup + every save.** Legacy ran the checks at launch
  and after each cassette/feature save, interrupting with blocking modals.
  v2 runs them when the /reports page opens and on an explicit "Re-check",
  matching the locked UX direction (soft warnings, no modal interruptions).
- **`duplicate-feature-annotations` is not implemented.** Legacy checked it;
  in v2 `glossary_features.annotation` carries a UNIQUE constraint, so the
  condition cannot occur. Organism _short_ names are not unique in v2, so
  that check is kept.
- **Blank detection is stricter.** Legacy compared against `''`; v2 treats
  NULL and whitespace-only as blank too.
- **One source of truth for the gate.** The two error checks delegate to
  `ReportService.checkGlossaryIntegrity()` rather than reimplementing it, so
  the Data quality card and the export gate can never disagree — asserted by
  a dedicated test.

## Verification results

- 311/311 Jest tests passing (15 new in `tests/integration/data-quality.test.ts`:
  clean-database and empty-database baselines, one per check, two API-route
  cases, and a gate-consistency assertion)
- `tsc --noEmit` clean; ESLint clean; Prettier applied
- **Live against the real 244-plasmid database:** `ok: true`, 5 of 10 checks
  clean, correctly finding 4 plasmids without an original vector, 4 without
  cassettes, 5 without GMO records, 3 glossary features missing an alias, and
  2 unused glossary features
- **Error path verified live:** a temporary plasmid with cassette
  `pLac-NOSUCHTOKEN` flipped the report to `ok: false` / `errorCount: 1` with
  the item `zzTempCheck: NOSUCHTOKEN`; deleting it restored `ok: true`
- Browser smoke on /reports: card renders passing, warning and error states;
  severity dots and per-check item chips; no console errors. Screenshots captured

## Test matrix

- Happy path: clean database reports ok with all 10 checks present and empty
- Validation path: each check verified against a purpose-built violation
- Error path: empty database is safe; API returns 200 with `ok:false` for
  findings (findings are data, not request failures)
- Regression path: full suite 311/311; export gate unchanged
- Compatibility path: n/a (read-only feature, no schema change)

## Follow-up

The per-plasmid subset of this computation is what the still-unfulfilled
locked UX requirement "row-level Formblatt-Z readiness indicator"
(`docs/architecture/ui-ux-direction.md`) needs. That is the natural next
change and should reuse `DataQualityService` rather than recompute.
