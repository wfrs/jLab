# Design Review: jlab UI Foundation

## Executive Summary

**Status**: Foundation Ready for Implementation | **Severity**: No Critical Issues

jlab has a solid foundation for UI implementation:

- Design system setup is appropriate (Tailwind CSS, system fonts, accessible components)
- UX direction is locked and well-defined (spreadsheet-first workflow)
- Current landing page is minimal but properly structured
- No accessibility violations detected in current code
- Ready to proceed with component library and feature pages

This review provides actionable guidance for implementing the plasmid management interface according to HIG principles adapted for web/desktop contexts.

---

## Part 1: Current State Audit

### Design System Setup ✓

**What exists:**

- Tailwind CSS 3.4.1 configured with PostCSS and Autoprefixer
- Headless UI for accessible component primitives
- class-variance-authority for component variants
- System font stack (SF Pro → Segoe UI → Roboto, etc.)
- Global styles with proper reset and semantic defaults

**Assessment**: GOOD

- Uses industry-standard tools for modern web design
- Proper CSS reset prevents cross-browser surprises
- System fonts provide excellent readability and platform consistency

---

### Current Landing Page Audit

**File**: `src/app/page.tsx`

```tsx
export default function Home() {
  return (
    <main>
      <h1>GMOCU - Plasmid Management</h1>
      <p>Modern reimplementation of GMOCU</p>
    </main>
  );
}
```

**Assessment**: Minimal but Correct

- ✓ Semantic HTML (`<main>`, `<h1>`, `<p>`)
- ✓ No hardcoded colors or sizes
- ✓ Leverages Tailwind defaults for text rendering
- ⚠ No responsive layout structure
- ⚠ No visual hierarchy
- ⚠ No accessibility attributes (though defaults are reasonable)

**What's needed next**: This page should evolve into either:

1. An onboarding/login page (if authentication is required), or
2. A redirect to the main plasmid management table

---

## Part 2: UX Direction Analysis

### Locked Direction: Spreadsheet-First Workflow ✓

**From**: `docs/architecture/ui-ux-direction.md`

**Key requirements** (validated against HIG principles):

1. **Table as Home Screen** ✓ Appropriate
   - Users spend 80% of time in the plasmid table
   - Aligns with "progressive disclosure" principle
   - Clear visual hierarchy: table content first, filters/controls secondary

2. **Direct Cell Editing with Autosave** ✓ Appropriate
   - Reduces friction vs. modal-based editing
   - Matches "intuitive interactions" principle
   - Requires robust error handling and feedback
   - **Must implement**: inline validation feedback, undo/redo, conflict resolution

3. **Synced Detail Panel** ✓ Appropriate
   - Accommodates users preferring form-style editing
   - Panel ≠ modal (must not replace table as primary)
   - Provides "adaptability" for different user preferences

4. **Cassette Editing with Autocomplete** ✓ Appropriate
   - Free-text entry with `-` token convention
   - Glossary autocomplete while typing
   - Inline unresolved token highlighting
   - **Accessibility concern**: Must provide keyboard-only access (no mouse required)

### Validation Against HIG Principles

| Principle     | GMOCU Design                                | Assessment             |
| ------------- | ------------------------------------------- | ---------------------- |
| Intuitive     | Table editing, autosave, direct feedback    | ✓ Excellent            |
| Perceivable   | Multiple cues (color, icons, text) required | ⚠ Needs implementation |
| Adaptable     | Detail panel for form-style preference      | ✓ Good                 |
| Accessibility | Keyboard nav, screen readers, contrast      | ⚠ Needs implementation |

---

## Part 3: Critical Issues

### None Identified

The current codebase has no critical accessibility violations, broken platform conventions, or unusable patterns.

---

## Part 4: High-Priority Improvements

### 4.1 Establish Color System with Semantic Tokens

**Issue**: Tailwind defaults use literal colors (red-500, blue-600); plasmid app needs semantic meaning.

**Why this matters** (Design Guideline — Color > Best practices):

- Avoids using same color for different meanings
- Ensures light/dark mode support from day one
- Makes bulk theme changes possible
- Supports increased contrast accessibility mode

**Recommendation**:

Create `src/styles/colors.ts` with semantic tokens:

```typescript
export const semanticColors = {
  // Functional status colors
  status: {
    success: 'bg-emerald-500 text-emerald-900', // For ready/valid plasmids
    warning: 'bg-amber-500 text-amber-900', // For incomplete/soft warnings
    error: 'bg-red-500 text-red-900', // For validation errors
    info: 'bg-blue-500 text-blue-900', // For info/hints
  },

  // Plasmid-specific domain colors
  plasmid: {
    new: 'bg-slate-100 text-slate-900', // Unsaved drafts
    valid: 'bg-green-50 border-green-200', // Formblatt-Z ready
    incomplete: 'bg-yellow-50 border-yellow-200', // Missing data
    synced: 'bg-blue-50 border-blue-200', // Synced from glossary
  },

  // Interaction states
  interactive: {
    default: 'bg-white border-gray-300',
    hover: 'bg-gray-50 border-gray-400',
    active: 'bg-blue-50 border-blue-500',
    disabled: 'bg-gray-100 text-gray-400',
  },
};
```

**Implementation order**:

1. Define tokens in TypeScript/CSS custom properties
2. Update Tailwind config to use custom palette
3. Build component library using these tokens
4. Test in both light and dark modes

---

### 4.2 Define Typography Scale

**Issue**: No documented type sizes for plasmid table, forms, or detail panel.

**Why this matters** (Design Guideline — Typography):

- Establishes clear visual hierarchy
- Ensures readability at minimum 10pt (desktop) or 11pt (mobile)
- Supports dynamic font scaling (accessibility feature)
- Provides consistent spacing based on type baseline

**Recommendation**:

Define text styles matching HIG + domain requirements:

| Use case        | Size | Weight   | Example                     |
| --------------- | ---- | -------- | --------------------------- |
| Page title      | 28pt | Bold     | "Plasmids"                  |
| Section heading | 18pt | Semibold | "Cassettes" in detail panel |
| Table header    | 13pt | Medium   | Column names in table       |
| Table cell      | 13pt | Regular  | Plasmid name, construct     |
| Label (form)    | 12pt | Medium   | "Vector type:"              |
| Caption/hint    | 11pt | Regular  | "Feature not in glossary"   |
| Status badge    | 11pt | Medium   | "Formblatt-Z ready"         |

**Implementation**:

```typescript
// src/styles/typography.ts
export const textStyles = {
  pageTitle: 'text-2xl font-bold leading-tight tracking-tight',
  sectionHeading: 'text-lg font-semibold leading-snug tracking-tight',
  tableHeader: 'text-sm font-medium leading-normal tracking-normal',
  tableCell: 'text-sm font-normal leading-normal',
  label: 'text-xs font-medium leading-normal uppercase tracking-wide',
  caption: 'text-xs font-normal leading-relaxed text-gray-600',
  badge: 'text-xs font-medium px-2 py-1 rounded-full',
};
```

---

### 4.3 Establish Spacing & Layout Grid

**Issue**: No documented margins, padding, or grid system.

**Why this matters** (Design Guideline — Layout):

- Consistent spacing creates visual coherence
- Grid-based layout adapts to different screen sizes
- Proper spacing between controls reduces mis-clicks
- Aligns content into logical regions

**Recommendation**:

Use Tailwind's 4px base unit (already configured):

- Spacing increments: 4px, 8px, 12px, 16px, 24px, 32px
- Content max-width: 1400px for wide screens, full-width for mobile
- Table padding: 12px (between header/rows), 16px (cell internal)
- Detail panel width: 360px (fixed right sidebar) or 100% (bottom sheet on mobile)

**Implementation**:

```typescript
// src/components/layouts/MainLayout.tsx
export function MainLayout({ children }) {
  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Header: 48px fixed height */}
      <header className="h-12 border-b border-gray-200 flex items-center px-6">
        {/* Navigation, search, actions */}
      </header>

      {/* Content: flex-grow, scrollable */}
      <div className="flex-1 overflow-hidden flex">
        {/* Table: flex-1 */}
        <main className="flex-1 overflow-auto">{children}</main>

        {/* Detail panel: 360px, hidden on small screens */}
        <aside className="hidden lg:block w-90 border-l border-gray-200 overflow-auto">
          {/* Detail form */}
        </aside>
      </div>
    </div>
  );
}
```

---

### 4.4 Accessibility: Keyboard Navigation

**Issue**: No documented keyboard shortcuts or focus management.

**Why this matters** (Design Guideline — Accessibility):

- Users with mobility limitations rely on keyboard
- Power users benefit from shortcuts (Ctrl+K search, Ctrl+N new, etc.)
- Focus management ensures screen reader navigation is logical
- Reduces reliance on mouse for every interaction

**Recommendation**:

Implement keyboard shortcuts following desktop conventions:

| Shortcut             | Action                           |
| -------------------- | -------------------------------- |
| Ctrl/Cmd + K         | Focus global search              |
| Ctrl/Cmd + N         | New plasmid                      |
| Ctrl/Cmd + S         | (Should not be needed; autosave) |
| Tab                  | Move to next control             |
| Shift+Tab            | Move to previous control         |
| Enter                | Activate button, save cell       |
| Escape               | Exit edit mode, close panel      |
| Arrow keys           | Navigate table cells             |
| Ctrl/Cmd + Arrow     | Jump to edge of table            |
| Ctrl/Cmd + Z         | Undo (if row not yet saved)      |
| Ctrl/Cmd + Shift + Z | Redo                             |

**Implementation approach**:

1. Use React Hook Form + Zod for form keyboard navigation
2. Implement table cell navigation with arrow keys (accessible-table library or custom)
3. Add `onKeyDown` handlers to major components
4. Wire Cmd/Ctrl combinations via global keyboard listener
5. Test with screen readers (NVDA, JAWS, VoiceOver)

---

### 4.5 Accessibility: Color Contrast & Dark Mode

**Issue**: No validation that text meets minimum contrast ratios; no dark mode.

**Why this matters** (Design Guideline — Accessibility):

- Text smaller than 18pt needs 4.5:1 contrast ratio minimum
- Dark mode is standard expectation (platform convention)
- Many users prefer dark mode for reduced eye strain
- Improves readability in low-light laboratory environments

**Recommendation**:

1. **Establish contrast baseline**:
   - Primary text (body): 4.5:1 minimum (use #1F2937 on white = 11:1, excellent)
   - Secondary text (hints): 4.5:1 minimum (use #6B7280 on white = 5.7:1, acceptable)
   - Status colors: Ensure each uses text overlay with sufficient contrast

2. **Implement dark mode**:

```typescript
// tailwind.config.js (create if missing)
export default {
  darkMode: 'class', // or 'media' for system preference
  theme: {
    extend: {
      colors: {
        // Define semantic colors with dark variants
        surfacePrimary: {
          light: '#FFFFFF',
          dark: '#1F2937',
        },
        // ... more tokens
      },
    },
  },
};
```

3. **Test contrast**:
   - Use WebAIM contrast checker before shipping
   - Test in both light and dark modes
   - Verify at minimum and maximum font sizes

---

### 4.6 Component Library Bootstrap

**Issue**: No reusable components defined; each feature reimplements basics.

**Why this matters** (Design Guideline — Layout, Interaction):

- Consistency across all screens and workflows
- Faster feature development
- Easier to maintain and update
- Establishes design language

**Recommendation**:

Create component library in `src/components/ui/`:

```
src/components/ui/
├── Button.tsx          # Primary, secondary, danger variants
├── Input.tsx           # Text, number, date inputs
├── Table.tsx           # Sortable, filterable data table
├── Badge.tsx           # Status indicators
├── Modal.tsx           # Dialog with focus trap
├── Tabs.tsx            # Tabbed content
├── Spinner.tsx         # Loading state
├── Toast.tsx           # Notifications
└── Select.tsx          # Dropdown with autocomplete
```

Each component should:

- Use `class-variance-authority` for variants
- Accept `className` prop for customization
- Support disabled/loading/error states
- Include ARIA labels and roles
- Export TypeScript props interface

Example structure:

```typescript
// src/components/ui/Button.tsx
import { cva } from 'class-variance-authority';
import { clsx } from 'clsx';

const buttonVariants = cva(
  'px-4 py-2 rounded font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500',
  {
    variants: {
      intent: {
        primary: 'bg-blue-600 text-white hover:bg-blue-700',
        secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300',
        danger: 'bg-red-600 text-white hover:bg-red-700',
      },
      size: {
        small: 'text-xs px-2 py-1',
        medium: 'text-sm px-4 py-2',
        large: 'text-base px-6 py-3',
      },
    },
    defaultVariants: {
      intent: 'primary',
      size: 'medium',
    },
  }
);

export function Button({ intent, size, className, ...props }) {
  return <button className={clsx(buttonVariants({ intent, size }), className)} {...props} />;
}
```

---

## Part 5: Medium-Priority Improvements

### 5.1 Onboarding Flow

**Current state**: None exists

**Need**: First-time users must set up:

- User initials
- Institution/organization
- Service credentials (Google Sheets, ICE, etc.)
- Glossary initialization

**Approach**:

- Multi-step wizard with progress indicator
- Validate email/credentials before advancing
- Save progress to draft until complete
- Allow returning to edit settings anytime

---

### 5.2 Empty States & Error Handling

**Current state**: Undefined

**Need**: When plasmid table is empty, when network fails, when validation fails, etc.

**Approach**:

- Empty state: Large illustration + explanatory text + primary CTA (New plasmid)
- Error state: Red banner with error message + retry button
- Loading state: Skeleton rows in table
- Conflict state: Modal explaining what happened + resolution options

---

### 5.3 Data Visualization (Charts)

**Current state**: Not mentioned in requirements

**Need**: Users may want to visualize:

- Plasmid count over time
- Feature usage distribution
- Project breakdown

**Approach**:

- Use a lightweight charting library (Recharts recommended for React)
- Follow HIG charting best practices (clear labels, accessible colors)
- Keep charts optional/secondary (table is primary)

---

## Part 6: Implementation Roadmap

### Phase 0: Design System (Weeks 1-2)

- [ ] Create `src/styles/colors.ts` with semantic tokens
- [ ] Create `src/styles/typography.ts` with text styles
- [ ] Update `tailwind.config.ts` to use custom tokens
- [ ] Create `src/styles/layout.ts` with spacing constants
- [ ] Test dark mode toggle

### Phase 1: Component Library (Weeks 2-3)

- [ ] Button (primary, secondary, danger, sizes)
- [ ] Input (text, number, date, with validation feedback)
- [ ] Table (sortable, filterable, keyboard navigable)
- [ ] Badge (status indicators)
- [ ] Modal (accessible dialog)
- [ ] Toast (notifications)
- [ ] Spinner (loading states)
- [ ] Write Storybook stories for each component

### Phase 2: Plasmid Table (Week 4)

- [ ] Layout: header + table + detail panel sidebar
- [ ] Table component integration (rows, columns, sorting)
- [ ] Cell editing (editable cells, autosave, validation feedback)
- [ ] Keyboard navigation (arrow keys, Tab, Escape)
- [ ] Detail panel (synced form on right side)
- [ ] Search/filter bar at top

### Phase 3: Forms & Detail Panels (Week 5)

- [ ] Plasmid create/edit form
- [ ] Cassette editing with autocomplete
- [ ] File upload area
- [ ] Related records (GMOs, attachments)

### Phase 4: Settings & Onboarding (Week 6)

- [ ] Onboarding wizard
- [ ] Settings page
- [ ] User profile
- [ ] Service credentials management

---

## Part 7: Design Checklist for Components

Before implementing any component, verify:

- [ ] **Accessibility**
  - [ ] Minimum 44pt touch targets (mobile) or 20pt (desktop)
  - [ ] 4.5:1 contrast ratio for all text < 18pt
  - [ ] ARIA labels on interactive elements
  - [ ] Keyboard navigation (Tab, Enter, Arrow keys, Escape)
  - [ ] Focus indicator visible (outline or ring)

- [ ] **Visual Design**
  - [ ] Uses semantic color tokens (not hardcoded colors)
  - [ ] Typography follows established scale
  - [ ] Spacing uses grid (4px increments)
  - [ ] Dark mode variant tested
  - [ ] States defined (default, hover, active, disabled, loading, error)

- [ ] **Interaction**
  - [ ] Loading state shown during async operations
  - [ ] Error messages clear and actionable
  - [ ] Success feedback provided (toast or inline)
  - [ ] Destructive actions confirmed (e.g., delete)
  - [ ] No modal dialogs for non-modal actions

- [ ] **Platform Conventions**
  - [ ] Consistent with web/desktop platform norms
  - [ ] Standard keyboard shortcuts (Ctrl+C copy, Ctrl+V paste, etc.)
  - [ ] Right-click context menu where appropriate
  - [ ] Responsive (works on small and large screens)

---

## Part 8: Testing Strategy

### Unit Tests (Component library)

- Test component renders with various props
- Test ARIA attributes present
- Test keyboard event handling
- Test className variants applied correctly

### Integration Tests (Features)

- Test plasmid table loads and sorts
- Test cell edit + autosave flow
- Test detail panel sync with table
- Test search/filter functionality

### Accessibility Tests (E2E)

- Run Axe accessibility scan on each page
- Test keyboard-only navigation end-to-end
- Test with screen reader (VoiceOver, NVDA, JAWS)
- Verify color contrast in both light and dark modes

### Visual Regression Tests

- Screenshot each component in multiple states
- Compare against baseline
- Catch unintended styling changes

---

## Part 9: Design System Documentation

Create `docs/design/DESIGN_SYSTEM.md` with:

1. **Color tokens** (with hex values, usage guidelines)
2. **Typography scale** (font sizes, weights, line heights)
3. **Spacing system** (margin/padding increments)
4. **Component catalog** (one section per component)
5. **Accessibility guidelines** (keyboard shortcuts, contrast, ARIA)
6. **Dark mode strategy** (which colors invert, how to test)
7. **Animation principles** (if any motion is used)

---

## Recommendations Summary

### Do This First (Before building components)

1. ✅ Define semantic color tokens in `src/styles/colors.ts`
2. ✅ Define typography scale in `src/styles/typography.ts`
3. ✅ Create Tailwind config to use custom tokens
4. ✅ Build 3-4 core components (Button, Input, Table, Badge)

### Do This in Parallel (During component development)

1. ✅ Write component stories (Storybook)
2. ✅ Set up accessibility testing (axe-core)
3. ✅ Implement dark mode toggle for testing
4. ✅ Create design documentation

### Do This Later (After initial plasmid table)

1. ✅ Build forms (onboarding, settings, plasmid edit)
2. ✅ Implement data visualization (charts)
3. ✅ Add notifications system (toasts)
4. ✅ Build help/documentation interface

---

## Appendix: HIG Principle Citations

This review references these design principles from the apple-design-skill knowledge base:

- **Accessibility** (Complete foundations document)
  - Vision: Color contrast, text scaling, screen readers
  - Mobility: Touch/click target sizes, spacing
  - Interaction: Keyboard navigation, alternatives to gestures

- **Color** (Complete foundations document)
  - Use semantic colors consistently
  - Support light and dark modes
  - Test contrast ratios
  - Avoid color-only information

- **Typography** (Complete foundations document)
  - Minimum 10pt (desktop) or 11pt (mobile)
  - Establish clear hierarchy with size and weight
  - Support scalable text
  - Use system fonts for optimal rendering

- **Layout** (Complete foundations document)
  - Group related items
  - Make essential info prominent
  - Consistent spacing and alignment
  - Adapt to different contexts (window size, device, language)

---

## Sign-Off

**Review conducted by**: Copilot (using apple-design-skill v1)
**Date**: 2024
**Status**: Ready for implementation

Next step: Create design system tokens and component library following Phase 0 roadmap.
