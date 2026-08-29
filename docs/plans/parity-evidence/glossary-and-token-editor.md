# Parity Evidence: Glossary (Nucleic acids) + Token-based Cassette Editor

**Date:** 2026-08-27
**Scope:** GlossaryFeature entity (schema/repo/service/API), /glossary page, top-level nav, token-aware cassette content editor with autocomplete and unresolved highlighting

Schema and behavior are grounded in the legacy source in-repo: `gmocu/gmocu.sql` (Features table) and `gmocu/gmocu.py` (normalization at L725-728, tokenization at L1045-1048, autocomplete at L644).

---

## Legacy GMOCU behavior preserved

| Legacy behavior                                              | New implementation                                                                           | Verified by                               |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Features glossary: annotation, alias, risk, organism, uid    | `glossary_features` table (+ synced flag for the sync milestone)                             | Service + API tests                       |
| Annotation normalization: `-`→`_`, `[`→`(`, `]`→`)`, ` `→`_` | `normalizeAnnotation()` — exact same replacements, on create AND rename                      | `cassette-tokens.test.ts` + service tests |
| Duplicate annotation prevention                              | Enforced after normalization (create + rename, excluding self)                               | Service + API tests                       |
| Glossary table CRUD                                          | /glossary spreadsheet page, inline autosave                                                  | Playwright UI smoke                       |
| Cassette tokenization: strip `[variant]`, split on `-`       | `parseCassetteTokens()` — dashes inside brackets do not split                                | Unit tests (incl. `prom[v-2]` case)       |
| Token resolution: exact, case-sensitive annotation match     | `unresolvedTokens()` against the glossary set                                                | Unit tests                                |
| Autocomplete from feature annotations while typing           | Dropdown on the current token (caret-aware), Tab/Enter/click to pick                         | Playwright UI smoke                       |
| Free-text cassette editing (no click-to-build)               | CassetteContentCell: plain text input with `-` convention                                    | Playwright UI smoke                       |
| Unresolved feature warning (popup in legacy)                 | Inline red wavy underline per token + count in aria-label (soft warning; row stays saveable) | UI smoke + screenshot                     |

## Improvements over legacy (per locked UI/UX direction)

- Inline token-level unresolved highlighting instead of a blocking popup
- Autosave; row remains editable/saveable with soft warnings (explicit UX requirement)
- Task-first top-level navigation (Plasmids, Glossary) — first two of the five locked nav targets

## Deferred (documented, not dropped)

- Organisms glossary (comes with the GMO layer)
- Annotation rename propagation into cassette content and plasmid aliases (legacy `update_cassettes`/`update_alias`) — noted in GlossaryFeatureService.updateFeature
- Excel import/export; Google Sheets sync (uid/synced columns already in place)
- Plasmid-row-level Formblatt-Z readiness indicator (needs GMO + report layers)

## Also fixed in this slice

- **Input component a11y**: labels were not associated with inputs (no htmlFor/id) — WCAG 1.3.1 violation in the shared component; fixed with React.useId.

## Verification results

- 173/173 Jest tests passing (38 new: 13 token-logic unit + 14 service + 11 API integration)
- `tsc --noEmit` clean, ESLint + Prettier clean
- `npm run db:init` added `glossary_features` to the live DB non-destructively (existing data untouched)
- Playwright smoke: nav → glossary add (incl. "my feature" → `my_feature` normalization visible) → inline alias edit → cassette `pLac-GFP-XXX` shows XXX unresolved (red wavy) → autocomplete suggests `T7term` for fragment `T7` → Tab picks, Enter commits → no unresolved. Screenshots captured.
