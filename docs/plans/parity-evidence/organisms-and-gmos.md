# Parity Evidence: Organisms Glossary + GMO Layer

**Date:** 2026-08-27
**Scope:** Organism entity (glossary tab, repo/service/API), GMO entity (repo/service/API, detail-panel section with add/approve/destroy/delete)

Grounded in the legacy source in-repo: `gmocu/gmocu.sql` (Organisms, GMOs tables) and `gmocu/gmocu.py` (GMO add at ~L1488-1497, summary format, Destroy handler at L2139-2154).

---

## Legacy GMOCU behavior preserved

| Legacy behavior                                                                        | New implementation                                                      | Verified by                  |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------- |
| Organisms glossary: full_name, short_name, RG, uid, synced                             | `organisms` table + /glossary Organisms tab (spreadsheet CRUD)          | Service/API tests + UI smoke |
| Add GMO linked to plasmid + organism                                                   | POST /api/plasmids/[id]/gmos; organism picked from glossary             | Service/API tests + UI smoke |
| GMOs reference organisms by name                                                       | `organismName` column (name resolved to glossary spelling on create)    | Service tests                |
| Approval default '-'                                                                   | Service default; inline-editable in the panel                           | Service/API tests + UI smoke |
| Target risk group per GMO                                                              | `targetRiskGroup`, seeded from the organism's glossary RG               | Service/API tests + UI smoke |
| Dates generated/destroyed/entry, defaults today                                        | ISO date columns with service defaults + format validation              | Service tests                |
| Destroy button sets destruction date                                                   | PATCH dateDestroyed (UI stamps today after confirm); null reverts       | Service/API tests + UI smoke |
| GMO_summary display string (`RG n \| Approval: a \| gen - destroyed\|tbd \| organism`) | Derived at render time by `buildGmoSummary()` — same format incl. 'tbd' | `gmo-summary.test.ts`        |
| GMOs deleted with their plasmid                                                        | PlasmidService cascade extended to gmos                                 | Cascade parity test          |

## Deliberate modernizations

- **GMO_summary is derived, not stored**: legacy persisted the display string
  and mutated it via `str.replace('tbd', date)` on destroy — corruptible and
  denormalized. v2 computes the identical string from the record's fields.
- Organism uniqueness is case-insensitive (legacy relied on manual dup checks).

## Deferred (documented, not dropped)

- Target-organism shortlist (OrganismSelection) and favorites + one-click
  batch GMO creation — with the Settings milestone; v2 currently offers the
  full organism glossary in the picker.
- Organism rename propagation into existing GMO records (name-linked).
- Duplicate-plasmid "duplicate GMOs" setting; Excel import/export; Sheets sync.

## Verification results

- 201/201 Jest tests passing (28 new: 4 summary unit + 15 service + 9 API integration)
- `tsc --noEmit` clean, ESLint + Prettier clean
- `npm run db:init` added `organisms` + `gmos` tables non-destructively
- Playwright smoke: Organisms tab add + inline RG edit → plasmid panel →
  Add GMO (RG seeded from organism) → approval inline edit → Destroy (tbd →
  date, button disappears) → record delete (verified empty via API).
  Screenshots captured.
