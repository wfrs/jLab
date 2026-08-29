# Parity Evidence: Rename Propagation

**Date:** 2026-08-27
**Scope:** Feature annotation renames propagate into cassette content; organism renames propagate into GMO records and glossary-feature organism references.

Grounded in the legacy source in-repo: `gmocu.py` `update_cassettes` (L756, regex `(?<=-)OLD(?=[-[])` on `-content-`) and `update_alias` (L772).

---

## Legacy GMOCU behavior preserved

| Legacy behavior                                         | New implementation                                                       | Verified by                                   |
| ------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------- |
| Annotation rename rewrites cassette content             | GlossaryFeatureService.updateFeature → renameTokenInContent per cassette | Unit + integration tests + live UI round-trip |
| Full tokens only — substrings of other tokens untouched | Token-boundary matching via parseCassetteTokens (GFPx stays)             | Unit + integration tests                      |
| Bracket variants preserved (`old[v]` → `new[v]`)        | Base replaced, variant suffix kept                                       | Unit + integration tests                      |
| Renames go through normalization first                  | normalizeAnnotation applied before propagation ('e GFP' → 'e_GFP')       | Integration test                              |

## Beyond legacy (v2 additions)

- **Organism renames propagate too** (legacy left GMO/feature references
  dangling outside the Sheets-sync path): full-name change updates
  `gmos.organismName` and full-name feature references; short-name change
  updates short-name feature references.
- Rename + propagation run in a **single knex transaction** (legacy committed
  after the loop on one connection; v2 makes atomicity explicit).

## Not applicable / deferred

- Plasmid alias propagation (`update_alias`) — v2 has no alias field yet.
- Sheets-sync-driven renames — arrive with the sync milestone and reuse this
  same service path.

## Verification results

- 226/226 Jest tests passing (12 new: 5 unit token-rename + 7 integration)
- `tsc --noEmit` clean, ESLint + Prettier clean
- Live UI smoke: renamed GFP → eGFP in the glossary table; Plasmid-A's
  cassette read `eGFP-T7term` and remained fully resolved (no unresolved
  highlight); renaming back restored `GFP-T7term`.
