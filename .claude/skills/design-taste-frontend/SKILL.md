---
name: design-taste-frontend
description: jlab's UI design skill. Use whenever generating or restyling UI in this project. The app follows the Linear design language — near-black canvas, 5-step dark surface ladder, hairline borders, single lavender-blue accent (#5e6ad2), dense technical typography. Read references/linear-design-system.md BEFORE writing any UI code and use its tokens instead of inventing values.
---

# design-taste-frontend

## Design System (mandatory first read)

This project's UI follows the **Linear design language**. The full token set and
component grammar live in **`references/linear-design-system.md`**
(colors YAML, typography scale, elevation ladder, component specs).

**Use that design system for all UI you generate or modify in jlab.**

Hard rules distilled from it:

- **Canvas & surfaces:** page canvas `#010102`; panels/cards climb the surface
  ladder `#0f1011 → #141516 → #18191a → #191a1b`. Depth = surface step +
  hairline border, never drop shadows.
- **Elevation levels:** 0 flat body · 1 default card (surface-1 + hairline) ·
  2 featured/hover (surface-2 + strong hairline) · 3 dropdowns/sub-nav
  (surface-3) · 4 focus ring (2px accent outline). A subtle lighter top-edge
  highlight may mark lifted panels.
- **Single accent:** lavender-blue `#5e6ad2` (hover `#828fff`) carries every
  interactive signal — buttons, links, focus, selection. No second accent.
- **Text:** light gray `#f7f8f8` for primary text on dark; muted grays for
  secondary. Never pure white body on pure black.
- **Typography:** Inter/system sans, 500–700 for headings with slight negative
  tracking; dense, technical, quiet.
- **No decorative gradients, no glassmorphism, no shadows on chrome.**

jlab-specific application notes:

- The app is **dark-only** (dark class pinned in layout). All tokens map to the
  dark ladder; there is no light mode to maintain.
- Spreadsheet rows sit on canvas; the detail panel is elevation 1; autocomplete
  dropdowns and modals are elevation 3.
- Status/risk indicators may use semantic colors from the reference (success /
  warning / danger) but body chrome stays monochrome + accent.
