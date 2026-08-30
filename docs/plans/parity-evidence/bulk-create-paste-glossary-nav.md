# Parity Evidence: Bulk-Create-on-Paste + Glossary Grid Navigation

**Date:** 2026-08-30
**Scope:** TSV paste below the plasmid table creates plasmids; the two
glossary tables adopt the spreadsheet keyboard navigation.

## Basis: locked v2 UX direction (no legacy counterpart)

Both items close follow-ups recorded in
`table-ux-clipboard-keyboard.md` (2026-08-28): "pasting does not create
plasmids (bulk-create-on-paste is a possible follow-up)" and the glossary
tables not yet using `grid-navigation.ts`. Legacy GMOCU is a PySimpleGUI
form app with no comparable behavior.

## v2 contract

**Bulk-create-on-paste** (plasmids table):

- A pasted TSV block still fills existing rows downward from the anchor
  (one PATCH per row) — unchanged.
- Rows past the last table row now become NEW plasmids (one POST per row),
  aligned to the same columns as the anchor row. `buildRowCreate` in
  `src/components/plasmids/paste-grid.ts` (pure, unit-tested) converts the
  row into a create payload: name required, empty size omitted rather than
  null, status normalized case-insensitively.
- A row that cannot reach a name column, or whose name cell is empty, is
  refused with a per-row message ("needs a name to create a plasmid" /
  "name cannot be empty"); other cell errors (bad size, bad status) are
  reported while the row is still created from its valid cells — the same
  keep-what-parses rule the PATCH path has always had.
- Created rows are appended to the table (they were pasted below it) and
  the Formblatt-Z readiness column refreshes.
- The notice banner now reads e.g. "Pasted 1 cell into 1 row · Created 2
  plasmids"; only cells beyond the LAST COLUMN are still "ignored" (cells
  beyond the last row no longer exist as a concept).
- Duplicate names are rejected by the existing service invariant and
  surface per row in the error banner.

**Glossary grid navigation** (NucleicAcidsTab + OrganismsTab):

- Both tables adopt the exact plasmid-table wiring: a `handleGridKeys`
  wrapper (arrows / Home / End / Ctrl+C via `grid-navigation.ts`) and
  `onNavigate` on every EditableCell (Enter commits and moves down,
  Tab/Shift+Tab commit and move right/left, Escape cancels and refocuses).
- Ctrl+C cell copy needed no extra wiring — EditableCell always exposes
  `data-cell-value`.
- Paste stays a plasmid-table feature; the glossary already has Excel
  import/export for bulk entry.

## Verification

- 596 Jest tests (6 new in `tests/unit/paste-grid.test.ts`: full payload,
  name-only, empty-size omission, out-of-reach name, empty name without a
  doubled message, cell errors alongside a valid payload); 32 Playwright;
  `tsc` clean; Prettier clean.
- Live (dev server, real database, self-cleaning script): a 3-row block
  pasted onto a scratch anchor row patched the anchor, created two
  plasmids (size 4,321 + status validated applied; the row with status
  "bogus" was created and its error reported per row), the notice read
  "Pasted 1 cell into 1 row · Created 2 plasmids", and readiness refreshed
  — screenshot `paste-create.png` eyeballed. Glossary: arrow/Home/End
  moved focus across both tabs (verified by active-element aria-label),
  Enter opened the editor, Escape refocused the cell. All scratch
  plasmids deleted afterwards.
