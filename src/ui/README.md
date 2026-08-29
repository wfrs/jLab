# /src/ui

React UI components (ADR-0001, AGENTS.md design review).

## Structure

```
ui/
  components/
    plasmid/
      PlasmidTable.tsx       — Spreadsheet view (core from ui-ux-direction)
      PlasmidDetailPanel.tsx — Synced detail panel
      PlasmidEditor.tsx      — Form editor
    cassette/
      CassetteEditor.tsx     — Improved cassette editing (no modal)
      CassetteBrowser.tsx    — List view with search
    common/
      Header.tsx
      Navigation.tsx
      Layout.tsx
      ErrorBoundary.tsx
  hooks/
    usePlasmid.ts           — React hook for plasmid state/sync
    useTable.ts             — Table selection & sorting
  styles/
    globals.css             — Tailwind imports
    theme.css               — Design tokens (colors, fonts, spacing)
```

## UI/UX Direction (Locked)

From `docs/architecture/ui-ux-direction.md`:

1. **Spreadsheet-first model** — Table is home screen
2. **Autosave on edit** — No save button
3. **Synced detail panel** — Row selection opens side/bottom panel
4. **Improved cassette editing** — Free-text + autocomplete (no modal workflow)
5. **Copy/paste-first** — Cells, ranges, rows are copy/paste-able
6. **Token-level highlighting** — Unresolved items marked
7. **Formblatt-Z readiness** — Row-level compliance indicator

## Design Review (apple-design-skill)

Before implementing any UI:

1. Create mockup or screenshot
2. Invoke apple-design-skill for HIG compliance review
3. Verify accessibility (WCAG 2.1 AA minimum)
4. Implement based on design review recommendations

See AGENTS.md "Design Review & Accessibility" section for invocation rules.

## Component Patterns

All components:

- Use TypeScript strict mode
- Export named + default
- Include PropTypes or TypeScript interfaces
- Use semantic HTML
- Support light/dark mode (Tailwind)
- Are keyboard-accessible
