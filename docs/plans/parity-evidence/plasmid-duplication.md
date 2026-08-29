# Parity Evidence: Plasmid Duplication

**Date:** 2026-08-28
**Scope:** Duplicate plasmid action (service + POST /api/plasmids/[id]/duplicate + panel button), consuming the duplicateGmos setting

Grounded in the legacy source in-repo: `gmocu.py` -DUPLICATE- event (lines 2051–2086).

---

## Legacy GMOCU behavior preserved

| Legacy behavior                                                                        | New implementation                                                                                                                                 | Verified by                              |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Confirm first: "Do you wish to duplicate the plasmid entry?"                           | Same prompt on the panel's Duplicate button                                                                                                        | UI smoke                                 |
| Copies content fields only (name, alias, purpose, summary, clone, backbone_vector)     | Copies the v2 equivalents: name, description, sizeBp, backboneVector                                                                               | Service test                             |
| New name = original + ' (Copy)'                                                        | Same; numbered (Copy 2), (Copy 3)… when names clash                                                                                                | Service test + UI smoke                  |
| Status and dates reset to defaults                                                     | Copy starts as 'draft'; fresh createdAt/updatedAt                                                                                                  | Service test                             |
| All cassettes copied (content)                                                         | All cassettes copied (name/type/sequence/position), new ids                                                                                        | Service test + UI smoke                  |
| GMOs copied only if duplicate_gmos = 1, "but with current date", destroyed not carried | Same: organismName/approval/targetRiskGroup preserved; dateGenerated/entryDate = today; dateDestroyed = null; destroyed source GMOs copied as live | Service tests + live smoke both branches |
| GenBank columns and attachments NOT copied (absent from the INSERT column list)        | genbank_files/attachments left behind                                                                                                              | Service test + UI smoke                  |
| Copy becomes the selected record                                                       | Panel switches to the new copy                                                                                                                     | UI smoke                                 |

## Deliberate deviations (documented)

- **Name clashes numbered.** Legacy allows duplicate names (it ships a separate "check duplicated plasmid names" tool); v2 enforces uniqueness, so repeated copies become ' (Copy 2)', ' (Copy 3)', …
- **entryDate stamped on copied GMOs.** Legacy left entry_date NULL on duplicated GMOs (feeding the Formblatt-Z entry-date TODO); v2 stamps today, consistent with GmoService creation.
- **Dates are UTC-based** (`toISOString`), the app-wide convention since the GMO slice; legacy used the local date.
- v2 copies sizeBp (no legacy column; it is content-describing like the copied fields). parentId is NOT set on the copy (legacy has no lineage concept; kept out to avoid implying one).

## Verification results

- 252/252 Jest tests passing (8 new: field copy + status reset, name numbering, cassette copy with new ids, both duplicateGmos branches, destroyed-GMO-copied-as-live, files left behind, API 201/404)
- `tsc --noEmit` clean, ESLint 0 errors, Prettier clean
- Browser smoke (Playwright): Duplicate button with confirm → "Plasmid-A (Copy)" appears and panel switches to it; cassette copied; GMO copied with today+tbd while the setting was on; setting toggled off via API → second copy "(Copy 2)" had GMOs (0); GenBank showed "No GenBank file" and Attachments (0) on both copies; screenshots eyeballed; copies cleaned up afterwards
- Copied-GMO dates verified against the live API: dateGenerated = entryDate = app-convention today, dateDestroyed null, approval/RG preserved
