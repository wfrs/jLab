# Parity Evidence: Plasmid Table Columns + Pinned Header

**Date:** 2026-10-11
**Scope:** Selectable columns on the plasmids table (lab spreadsheet default set), derived prep/stock columns, inline editing of the lab spreadsheet fields, table header pinned while the table scrolls

## Basis

Legacy GMOCU is a PySimpleGUI form app with a fixed plasmid list; there is no legacy column choice to preserve. The lab's working document is the "plasmids + E.coli glycerol" spreadsheet (docs/plans/label-printing.md §0.5), whose columns the importer already maps onto the v2 record. This slice lets the table show that sheet, so the lab reads jlab the way it read the sheet, and every other record field remains available.

## v2 contract

**Column catalogue** (src/components/plasmids/plasmid-columns.ts, pure, unit-tested):

- 24 columns in fixed display order; the first 17 are the lab sheet in sheet order and form the default set: ID, Name, Insert, Details, Category, Marker bac, Marker plant, Concentration [ng/µL], Comment, Sequencing? (ONT/Sanger?), Date sequencing, Box, Date plasmid, Glycerol stock ID, Date glycerol stock, Organism, Strain
- Hidden by default, selectable: Status, Total size [bp], Insert size [bp], Original vector, Other comment, Created, Formblatt Z
- "ID" is the accession (`plasmids.name`, previously headed "Name"); "Name" is the construct name; "Details" is the description. The spreadsheet wording wins because it is what the lab reads
- The ID column is pinned (cannot be hidden): it identifies the row and anchors paste
- Choice persists per browser in localStorage (`jlab.plasmids.columns`); unknown ids are dropped, storage failures fall back to the default set, order is always catalogue order

**Derived columns** (read-only, from other records):

- Concentration and Date plasmid show the plasmid's newest prep (`GET /api/plasmids/preps`, newest per plasmid in one query)
- Glycerol stock ID / date / Organism / Strain show one stock per plasmid (`GET /api/glycerol-stocks` with no filter = whole freezer): the E. coli stock when there is one, otherwise the lowest stock id. Stocks without a plasmid never appear
- Refreshed on mount, after the prep dialog records, and when the detail panel closes (it records stocks)

**Inline editing of lab fields:** construct name, insert, category, markers, comment, sequencing result/date, box, insert size, other comment and original vector are editable cells with autosave (PATCH accepts them; `null` clears). Sequencing date must be ISO (YYYY-MM-DD). Paste fills them too (empty cell clears; non-ISO dates and non-numbers reported per cell). Pasted rows _below_ the table still create plasmids from name/details/size/status only — the create schema does not take lab fields yet (follow-up)

**Pinned header:** the plasmids page is viewport-high and does not scroll; the table scrolls inside its card (both axes) with its header cells `position: sticky`. Heading, search, column picker and the detail panel stay in place. Other pages using Table are unaffected (their boxes do not scroll vertically)

**Sorting:** derived columns sort by their record's value; empty values sort last in both directions

## Verification results

- 630/630 Jest tests passing (new: column catalogue defaults/normalization/storage/stock choice, paste of lab fields, GET preps latest-per-plasmid, GET stocks unfiltered vs. empty filter, PATCH lab fields round-trip + ISO date rejection)
- `tsc --noEmit` clean, ESLint 0 errors, Prettier clean
- Headless browser against a dev server with the 185-plasmid example library plus a seeded prep and stock: default headers equal the lab sheet in order; pJM0001 row shows 210 / 2025-06-20 / CJM1 / 2025-06-21 / E. coli / TOP10; Status toggled on via the picker appears, is stored, and survives reload; an inline Category edit lands in the API; after scrolling the table box to the bottom the header cells sit at the box top and the page itself has no scroll range

## Accessibility

- Picker button: `aria-haspopup="dialog"`, `aria-expanded`, `aria-controls`; popover `role="dialog"` with a label; Escape and outside click close; focus returns to the button
- Options are native checkboxes in labelled fieldsets (≥32px rows); the pinned column is a disabled checked box marked "always shown"
- Derived cells carry no `data-editable-cell`, so keyboard grid navigation and paste skip them as before
