# Parity Evidence: Table UX — Clipboard + Keyboard Navigation

**Date:** 2026-08-28
**Scope:** Spreadsheet keyboard navigation, cell/row copy, TSV block paste on the plasmids table

## Basis: locked v2 UX direction (no legacy counterpart)

Legacy GMOCU is a PySimpleGUI form app; there is no legacy behavior to preserve. This slice implements the remaining requirements of docs/architecture/ui-ux-direction.md ("full copy/paste support for cells/ranges/rows", table-first interaction quality) and the design review's keyboard-navigation requirements.

## v2 contract

**Keyboard navigation** (display-mode cells; DOM-based grid in src/components/ui/grid-navigation.ts):

- Arrow keys move focus between editable cells; Home/End jump within the row; edges clamp (no wrap)
- Enter/F2 open the editor; typing a printable character opens it seeded with that character (caret at end)
- Enter commits and moves focus down a row (spreadsheet convention); Tab/Shift+Tab commit and move right/left; Escape cancels and refocuses the cell
- Focus is restored to the cell after every keyboard-driven commit (previously it fell to the document body)

**Copy:**

- Ctrl/Cmd+C on a focused cell copies its raw value
- Bulk bar "Copy" button copies the selected rows as TSV (name, description, sizeBp, status)

**Paste** (onto a focused display cell; pure parsing in src/components/plasmids/paste-grid.ts, unit-tested):

- Clipboard text is interpreted as a TSV block (Excel/Sheets convention; CRLF normalized, trailing newline dropped)
- The block fills existing rows downward and editable columns rightward from the anchor — one PATCH per row with the merged fields
- Status accepts labels case-insensitively ("Validated" → validated); sizes tolerate thousands separators ("6,425"); empty size clears
- Invalid cells are reported per row in the error banner without blocking valid cells; a notice banner summarizes ("Pasted 4 cells into 2 rows")
- Cells beyond the table (rows below the last row, columns past status) are ignored and counted in the notice — pasting does not create plasmids (bulk-create-on-paste is a possible follow-up)
- Pasting while an editor is open is native input paste, untouched

## Incident during verification (resolved)

A transient bug in an intermediate build (`onClick={startEditing}` passing the MouseEvent as the initial draft) was hot-reloaded into an open browser tab during development and committed a literal "[object Object]" into one plasmid description. tsc caught the bug and it was fixed before the final build; the corrupted row was repaired via API. An instrumented Playwright repro confirmed every commit path in the final code (table edit, panel edit, paste, select change) writes clean strings.

## Verification results

- 280/280 Jest tests passing (11 new: TSV parsing incl. CRLF/trailing-row/interior-empty cells, status normalization, row-patch building with aligned/overflow columns and error collection)
- `tsc --noEmit` clean, ESLint 0 errors, Prettier clean
- Browser smoke (Playwright, clipboard permissions granted): arrow/Home/End navigation verified by active-element inspection; Enter-commit moved down, Tab-commit moved right, type-to-edit seeded, Escape refocused without saving; Ctrl+C copied the cell value; 2×2 TSV paste filled two rows (+ notice banner); invalid-status paste surfaced the per-row error while the valid row applied; overflow reported; row copy produced correct TSV; screenshots eyeballed; demo data restored afterwards
