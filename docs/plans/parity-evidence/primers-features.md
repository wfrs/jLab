# Parity Evidence: Primer + Feature Layers

**Date:** 2026-08-28
**Scope:** Per-plasmid PCR primers and annotated sequence features — repos/services, REST APIs, detail-panel sections

## Legacy status: v2 additions (no legacy counterpart)

Legacy GMOCU has **no primers table and no per-plasmid features table** — its `Features` table is the nucleic-acids glossary (already implemented as `glossary_features`). Primers and sequence features are part of the locked v2 schema design (docs/plans/DATABASE_SCHEMA_MIGRATION.md; domain types, tables, and the plasmid delete cascade have included them since scaffolding). This slice wires them up; there is no legacy behavior to preserve, so this document records the v2 contract instead of a parity table.

## v2 contract

**Primers** (`primers`; one plasmid → many):

- name (required), sequence (required; IUPAC nucleotide codes incl. degenerate, stored uppercase, ≤ 500 nt)
- gcPercent and tmCelsius are **derived server-side on every sequence write** and not accepted as input: GC% counts G/C/S over length (1 decimal); Tm via the Wallace rule 2·(A+T) + 4·(G+C) for unambiguous sequences ≤ 30 nt, else null (pure logic in src/domain/primer-calc.ts)
- API: GET/POST /api/plasmids/[id]/primers, PATCH/DELETE /api/primers/[id]; list alphabetical

**Features** (`features`; one plasmid → many):

- name (required), type (gene/promoter/terminator/rbs/his_tag/flag_tag/other), strand +/− (default +)
- positions 1-based inclusive; startPos ≤ endPos enforced, including against the merged row on partial updates (wrap-around features across the origin are entered as two features)
- API: GET/POST /api/plasmids/[id]/features, PATCH/DELETE /api/features/[id]; list ordered by position

**UI:** FeatureSection and PrimerSection in the detail panel (between GenBank and Attachments) — inline autosave edits, strand toggle button, add forms, delete with confirm; derived primer stats shown as "{n} nt · GC {x}% · Tm {y}°C".

Plasmid delete cascade already covered both tables; now exercised by tests. Duplication deliberately does not copy primers/features (its scope is the legacy field list).

## Verification results

- 269/269 Jest tests passing (17 new: primer-calc unit tests incl. Wallace bounds; service validation for sequences/positions/merged ranges; API CRUD, unknown-field 400s, 404s; delete cascade)
- `tsc --noEmit` clean, ESLint 0 errors, Prettier clean
- Browser smoke (Playwright): added feature GFP gene 100–816, toggled strand to −, inverted-range add rejected inline with the server message; added primer M13-fwd (lowercase input) → shown uppercase with "17 nt · GC 52.9% · Tm 52°C"; non-nucleotide sequence rejected inline; deletes verified; screenshots eyeballed
