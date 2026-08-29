# Parity Evidence: Plasmid Editable Table + Autosave Slice

**Date:** 2026-08-27
**Scope:** Inline cell editing with autosave, synced detail panel, wired create/delete, Zod API validation

---

## Legacy GMOCU behavior preserved

| Legacy behavior                            | New implementation                                          | Verified by                                |
| ------------------------------------------ | ----------------------------------------------------------- | ------------------------------------------ |
| Create plasmid records                     | "New Plasmid" button → POST /api/plasmids                   | API test + Playwright UI smoke             |
| Edit plasmid metadata (name, size, status) | Inline cell edit + detail panel, PATCH per field            | API tests + UI smoke                       |
| Delete plasmids with dependent records     | Bulk delete with confirm; cascades to cassettes/primers/... | `plasmid.api.test.ts` cascade test         |
| Duplicate plasmid name check               | Enforced on create AND rename (exact, case-insensitive)     | Service + API tests; UI shows inline error |
| Search plasmids by name/description        | Debounced search box → GET ?search=                         | API test + existing repository tests       |

## Improvements over legacy (per locked UI/UX direction)

- Autosave on edit — no save-button loop (locked v1 requirement #1)
- Spreadsheet-first: table is home screen, cells edit in place (requirement #2)
- Synced detail panel for form-style editing; does not replace the table
- Inline validation feedback instead of modal interruption

## Behavior changes (deliberate, documented)

- **Uniqueness check fixed**: previously used `LIKE` substring match, which
  wrongly rejected creating "pGFP" when "pGFP-long" existed (or when any
  description contained the name). Now exact case-insensitive name match.
- **Rename uniqueness**: legacy checked duplicates via maintenance report;
  v2 enforces at write time (create and rename).
- **`null` clears nullable columns** (sizeBp, parentId) via PATCH.

## Verification results

- 92/92 Jest tests passing (39 new: 15 schema unit + 24 API integration)
- `tsc --noEmit` clean, ESLint + Prettier clean
- Playwright smoke against the running app: create → inline rename →
  size edit → duplicate rejection (inline error + banner, Escape reverts) →
  panel edit synced to table → bulk delete. Screenshots captured.
