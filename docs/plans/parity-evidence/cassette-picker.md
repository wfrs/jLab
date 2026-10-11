# Parity Evidence: Cassettes Column + Reuse Picker

**Date:** 2026-10-11
**Scope:** Cassettes column on the plasmids table, picker over the library's distinct cassette contents, add/replace/remove from the table, paste of cassettes

## Basis

A cassette is a combination of features (`Pt7-EGFP-tag6His-Tt7`), and many plasmids carry the same one. Legacy GMOCU (gmocu.py L2060–2075, L2248–2278) offered no reuse: content was typed per plasmid, with per-token feature autocomplete, or copied along when a plasmid was duplicated. This slice is a v2 addition inside the locked UX direction (table-first): picking a whole existing cassette is reuse, not the click-to-build token flow the direction rejects. Token-level editing, reordering and the glossary autocomplete remain in the detail panel unchanged.

The cassette record's `type` field (promoter/terminator/…) describes a feature category, not a cassette; the table ignores it and new cassettes carry `other`, as the importers do. Retiring the field is a separate, schema-touching change.

## v2 contract

**Data:** `GET /api/cassettes` returns every cassette (by plasmid, then position). The page groups them per row and derives the distinct contents with how many plasmids use each (src/components/plasmids/cassette-options.ts, pure, unit-tested). Loaded with the prep and stock data; reloaded after any cassette change from the table, the prep dialog, or when the detail panel closes.

**Column:** "Cassettes", in the Plasmid group, visible by default right after Details. Chips in position order. A chip whose features are not all in the glossary is tinted amber with the unknown features in its tooltip (soft signal, same as the panel's underline).

**Picker** (CassettePicker, ARIA combobox): opened by "+ Add" (append), by clicking a chip (replace that cassette), by Enter/F2 on the focused cell, or by typing into it. Type-ahead filters case-insensitively; the list is capped at 50 and shows "N plasmids" per option. Text matching nothing is offered as "new", so free entry is never blocked. Enter or click picks, Escape and blur cancel, focus returns to the cell. Server errors show inline under the input.

**Always add:** a pick never replaces an existing cassette unless the user opened the picker from that chip. × removes with the same confirm the panel uses.

**Paste:** a cell in the Cassettes column accepts `A; B` and creates one cassette per entry, on existing rows and on rows pasted below the table. Ctrl+C on the cell copies the same joined form.

**Sorting:** by the joined contents; empty last.

## Verification results

- Jest: new unit tests for grouping, option counting/ordering, filtering/capping, join/split round trip; paste tests for the column; API test for `GET /api/cassettes` (order, empty)
- `tsc --noEmit` clean, ESLint 0 errors, Prettier clean
- Headless browser against a dev server with the imported example library: the column sits after Details by default; "+ Add" on a plasmid lists the library's cassettes most used first; picking one creates the cassette (verified through the API) and readiness refreshes; clicking a chip and choosing another content patches in place; Enter on the focused cell opens the picker and Escape returns focus to the cell

## Accessibility

- Cell: `role="group"`, focusable, label lists the cassettes and the Enter hint; participates in arrow-key grid navigation like editable cells
- Chips: the content is a button ("Replace cassette … of …"), × is a button ("Remove cassette … from …"), both ≥28px tall with visible focus rings
- Picker: `role="combobox"` with `aria-expanded`, `aria-controls`, `aria-activedescendant`; options `role="option"` with `aria-selected`; errors `role="alert"`
