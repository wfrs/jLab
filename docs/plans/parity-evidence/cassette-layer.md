# Parity Evidence: Cassette Layer

**Date:** 2026-08-27
**Scope:** CassetteRepository, CassetteService, Zod-validated REST API, cassette list UI in the detail panel

---

## Legacy GMOCU behavior preserved

| Legacy behavior                         | New implementation                                              | Verified by                            |
| --------------------------------------- | --------------------------------------------------------------- | -------------------------------------- |
| Add cassette entries linked to plasmids | POST /api/plasmids/[id]/cassettes; add form in detail panel     | API tests + Playwright UI smoke        |
| Edit cassette entries                   | PATCH /api/cassettes/[id]; inline edit with autosave            | API tests + UI smoke                   |
| Cassettes ordered within a plasmid      | `position` column; list ordered by position; new entries append | Service + API tests                    |
| Cassettes deleted with their plasmid    | PlasmidService cascade (verified cross-service)                 | `cassette.service.test.ts` parity test |

## Deferred to the glossary milestone (documented, not dropped)

- Free-text cassette composition with `-` token convention
- Glossary autocomplete while typing
- Inline unresolved-token highlighting; Formblatt-Z readiness indicator
- Bracket-notation feature variants; annotation rename propagation

These require the glossary entity (Nucleic acids / Organisms), which does not
exist yet. The current UI is the structural CRUD base the token editor will
replace/extend.

## Infrastructure fixes shipped with this slice

- **`npm run db:init` produced a broken schema**: `scripts/db-init.ts` created
  snake_case columns (`plasmid_id`) while all code uses camelCase (`plasmidId`).
  It now delegates to `src/infrastructure/database-init.ts` — single source of
  truth. Verified against a fresh database.
- **`/api/init` data loss**: `initializeDatabase()` dropped and recreated every
  table on each call. Now idempotent and non-destructive (create-if-missing).

## Verification results

- 135/135 Jest tests passing (43 new: 15 schema unit + 17 service + 11 API integration)
- `tsc --noEmit` clean, ESLint + Prettier clean
- Playwright smoke against the running app: open panel → add two cassettes
  (positions append) → inline rename → inline type change → empty-name add
  disabled → per-row delete. Screenshots captured.
