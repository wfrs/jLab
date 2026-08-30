# Parity Evidence: Target + Favourite Organism Lists

**Feature:** Target organism shortlist and favourite batch-add
(feature-inventory §6, plus the §3 gap "batch-add GMOs from favourites")
**Date:** 2026-08-30
**Legacy source:** `gmocu.py` Settings tab (L358-372), `-ADDSELORGA-`/`-COPYFAVORGA-`
handlers (L2492-2502), `-ADDFAV-` batch add (L2112-2137), `add_organism`
(L1482-1500); schema in `gmocu.sql` (OrganismSelection L68-71,
OrganismFavourites L73-76).

## Legacy behavior

- Two plain-text tables: `OrganismSelection(orga_sel_id, organism_name)` and
  `OrganismFavourites(orga_fav_id, organism_fav_name)`. No foreign keys to the
  Organisms glossary — linked by name only.
- Settings tab, "Target organisms": a combo fed by
  `SELECT short_name FROM Organisms` (sorted) plus an Add button that inserts
  the combo value into OrganismSelection (`-ADDSELORGA-`). No duplicate guard.
  Rows deletable via the pysimplesql actions strip.
- Settings tab, "Fav. organisms": no combo — the only authoring path is the
  Copy button (`-COPYFAVORGA-`), which copies the currently selected target
  into OrganismFavourites. Caption: "All listed organisms must also exist in
  Target organisms." Deleting a target does NOT touch favourites, so the two
  lists can drift apart.
- GMO tab: the per-plasmid organism combo (`Plasmids.organism_selector`) is a
  pysimplesql FK combo over OrganismSelection — single GMO adds only offer the
  shortlist, not the whole glossary.
- `-ADDFAV-`: yes/no popup "Adding all favourite organisms as GMOs. Proceed?",
  then checks favourites ⊆ targets (`np.setdiff1d`) and errors with a popup if
  violated; otherwise every favourite is added as a GMO via `add_organism`,
  unconditionally — pressing twice duplicates every GMO record.
- `add_organism` reads the plasmid's `target_RG` combo and the `-APPROVAL-`
  combo for every GMO in the batch.

## v2 implementation

- One table, `organism_targets(id, organismName UNIQUE, favourite, createdAt,
  updatedAt)` — a favourite IS a starred target, so the legacy guardrail
  ("favourites must exist in targets") is structural instead of a runtime
  popup. `src/infrastructure/database-init.ts`, mirrored in
  `tests/helpers/test-db.ts`; added to `RESET_TABLES` (the danger-zone reset
  schema-coverage test enforces this) and to the danger-zone table labels.
- `OrganismTargetService` (`src/services/organism-target.service.ts`):
  `listTargets` (insertion order, like the legacy autoincrement listing),
  `listFavourites`, `addTarget` (must exist in the organism glossary — the
  legacy combo only ever offered glossary entries; stores the canonical
  glossary full name), `setFavourite`, `removeTarget`.
- Propagation (`src/services/organism.service.ts`): a glossary full-name
  rename rewrites the matching target entry inside the same transaction as
  gmos/glossary_features (merging, favourite OR'd, if the new name is somehow
  already targeted); deleting a glossary organism deletes its target entry.
- `GmoService.addFavouritesAsGmos` (legacy `-ADDFAV-`): every favourite is
  added with the single-add defaults (approval '-', target RG seeded from the
  organism's glossary risk group, dates today). Sequential adds, like legacy's
  per-GMO commits.
- API: GET/POST `/api/settings/organism-targets`, PATCH/DELETE
  `/api/settings/organism-targets/[id]`, POST
  `/api/plasmids/[id]/gmos/favourites` (no body; returns
  `{created, skipped}`). Zod at the boundary (ADR-0007), envelopes (ADR-0008).
- UI: "Organisms" section on /settings (`OrganismTargetsSection`: add from a
  glossary dropdown that hides already-targeted organisms, star toggle =
  favourite, remove). GmoSection's picker gains a "Target organisms" optgroup
  ahead of "Other organisms" (flat list when no targets exist), plus a
  "★ Add favourite(s)" button with the legacy confirmation wording, reporting
  added/skipped.

## Documented deviations

1. **Full names, not short names.** Legacy stored glossary short names; jlab's
   organism identity is the full name (locked with the GMO layer). Batch-add
   and reports resolve either form, so imported data still matches.
2. **Duplicates rejected.** Legacy allowed inserting the same organism into
   the target list repeatedly; duplicates serve no purpose in a shortlist.
3. **Removing a target removes its favourite status.** Legacy left orphaned
   favourites behind and failed later, at batch-add time, with "Please fix!".
   The server still cannot express the broken state (single table).
4. **Batch-add skips organisms with a live GMO** instead of duplicating
   (legacy inserted unconditionally). A GMO already destroyed does not block —
   regenerating after destruction is a legitimate new record. Matching
   resolves names through the glossary with `findOrganism` semantics (exact
   short OR full name), because v1-imported GMOs carry short names (`AgTu`)
   while jlab-created ones carry full names — verified against the real
   database: pJM0001's imported live `AgTu` record blocks the favourite
   `Agrobacterium tumefaciens`.
5. **RG per organism, not per batch.** Legacy stamped the whole batch with the
   plasmid form's `target_RG` combo value; jlab seeds each GMO from its own
   organism's glossary risk group (consistent with the locked single-add
   behavior).
6. **Single adds still offer the whole glossary.** Legacy's GMO combo offered
   only the shortlist; jlab lists targets first but keeps the rest of the
   glossary reachable in a second optgroup, so an empty shortlist (fresh
   install) never blocks GMO creation.
7. **Not imported from v1 databases** — legacy `import_data` never copied
   OrganismSelection/OrganismFavourites either (verified: no reference in the
   import path), so this is parity-exact; the lists are quick to rebuild by
   hand. Could be added to the importer later if wanted.

## Verification

- `tests/integration/organism-targets.test.ts` (14 tests): service CRUD +
  guards, insertion order, favourite toggle, rename-follows / merge / delete
  cascade propagation, route status codes.
- `tests/integration/gmo-favourites.test.ts` (9 tests): defaults + per-organism
  RG seeding, non-favourites excluded, live-GMO skip (full name and imported
  short name), destroyed-GMO re-add, empty favourites, unknown plasmid, route
  responses.
- Full suites green: 590 Jest (38 suites), 32 Playwright, `tsc` clean.
- Live against the real database (dev server): add/star/remove via UI and API,
  duplicate + unknown-organism rejection (400s), batch-add created a GMO with
  RG from the glossary then skipped on re-run, and the imported short-name
  case above. All test records removed afterwards; screenshots
  (`settings-targets.png`, `gmo-section.png`) confirm the Settings card and
  GMO section render correctly.
