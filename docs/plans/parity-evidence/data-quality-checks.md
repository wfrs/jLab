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

- 318/318 Jest tests passing (22 new in `tests/integration/data-quality.test.ts`:
  clean-database and empty-database baselines, one per check, API-route cases,
  gate-consistency assertions, and seven covering per-plasmid readiness)
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

## Row-level readiness indicator (locked UX requirement, shipped 2026-08-29)

`docs/architecture/ui-ux-direction.md` lists a "row-level Formblatt-Z
readiness indicator" among the locked cassette/insert UX requirements. It was
deferred at the glossary milestone (see `glossary-and-token-editor.md`)
because it needed the GMO and report layers. Both now exist, and the
computation is the per-plasmid subset of the checks above, so it is
implemented in the same service rather than recomputed:

- `DataQualityService.plasmidReadiness()` returns one entry per plasmid with
  a level and human-readable reasons.
- `blocked` — this plasmid's own data is what the export gate rejects
  (cassette token not in the glossary, feature with no/unresolvable organism,
  GMO organism not in the glossary). Reasons are deduplicated, so a token
  repeated across cassettes is reported once.
- `incomplete` — generation succeeds, but the plasmid has no cassettes, no
  GMO records (so it never appears in Formblatt-Z), or no original vector.
- `ready` — contributes complete rows.
- `GET /api/plasmids/readiness`; rendered by `PlasmidReadinessCell` as a
  "Formblatt Z" column: a severity dot plus a short label, with the reasons
  as a tooltip and in the accessible name.

Consistency with the gate is asserted by test: if any plasmid is `blocked`,
the global report's `ok` is false.

Per the locked UX direction the indicator is a **soft** signal — the row stays
editable and saveable, and nothing is blocked at the row level. Readiness is
refreshed on mount, after create/duplicate/delete, and when the detail panel
closes (cassettes, GMOs and the original vector are all panel-edited); plain
table edits cannot change readiness, so they do not trigger a refetch.

**Route note:** `/api/plasmids/readiness` is a static segment that sits
alongside the dynamic `/api/plasmids/[id]`. Next.js gives static segments
precedence; verified live that `/api/plasmids/<uuid>` still returns 200 and an
unknown id still returns 404.
