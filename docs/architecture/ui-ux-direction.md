# UI/UX direction (locked for v1)

## Source basis

This direction is based on user interview synthesis and validated in planning discussion.

## Primary UX model (non-negotiable)

Use a **spreadsheet-first workflow** for plasmid management:

- table is the home screen,
- users type directly in cells,
- autosave on edit (no global save button),
- full copy/paste support for cells/ranges/rows,
- sort/filter per column,
- global search across visible columns.

## Detail editing mode

Selecting a row opens a **synced detail panel** (side or bottom):

- supports users who prefer form-style editing,
- table and panel remain in sync,
- panel does not replace the table as the primary workflow.

## Cassette/insert UX requirements

- free-text cassette editing with `-` token convention,
- autocomplete from glossary while typing,
- inline token-level unresolved highlight,
- row-level Formblatt-Z readiness indicator,
- row remains editable/saveable with soft warnings.

## Plasmid workflow priorities

Top priorities for v1 UX:

1. Autosave everywhere in plasmid workflow.
2. Table-first interaction quality (clipboard-friendly, fast filtering/sorting).
3. Rethought cassette editing (no click-to-build flow).

## What to avoid

- Form-first workflow replacing the table as default.
- Reintroducing "save button" loops.
- Modal-heavy cassette construction interactions.
