# Implementation Status

**Project Stage:** Phase 1 — Plasmid vertical slice complete ✅ (2026-08-27); v1 database import shipped (2026-08-29)

## Current State (read this first — sections below are historical)

**Done:**

- PlasmidRepository + PlasmidService (incl. exact-match name uniqueness on create AND rename, null clears for sizeBp/parentId)
- Plasmid REST API: GET/POST /api/plasmids, GET/PATCH/DELETE /api/plasmids/[id] — Zod-validated (ADR-0007 layer 1), shared envelope helpers in src/shared/api-envelope.ts
- Spreadsheet-first UI (locked UX direction): inline editable cells with autosave (EditableCell), synced detail panel (PlasmidDetailPanel), wired create + bulk delete
- Dark-only theme (dark class pinned in layout.tsx; color-scheme: dark)
- CassetteRepository + CassetteService (position append semantics, plasmid-existence checks) + REST API (GET/POST /api/plasmids/[id]/cassettes, PATCH/DELETE /api/cassettes/[id]) + cassette list UI in the detail panel (add/rename/retype/delete, autosave)
- Fresh-install fix: scripts/db-init.ts now delegates to src/infrastructure/database-init.ts (was creating snake_case columns the app can't read); initializeDatabase() no longer drops tables (was wiping data on every /api/init)
- Glossary (Nucleic acids): glossary_features table, repo/service (legacy-exact annotation normalization + uniqueness), REST API (/api/glossary/features), /glossary spreadsheet page, top-level nav (AppNav)
- Token-based cassette editor (CassetteContentCell): free-text `-` convention, glossary autocomplete while typing (caret-aware), inline unresolved-token highlighting; pure token logic in src/domain/cassette-tokens.ts (parity with gmocu.py tokenization/normalization)
- Input component a11y fix: labels now associated via htmlFor/useId (WCAG 1.3.1)
- Organisms glossary: organisms table, repo/service/API (/api/glossary/organisms), Organisms tab on /glossary (page now tabbed: Nucleic acids | Organisms)
- GMO layer: gmos table, repo/service/API (/api/plasmids/[id]/gmos, /api/gmos/[id]), GmoSection in the detail panel (add from organism glossary with RG seeding, inline approval edit, Destroy stamps date, delete); GMO summary derived by src/domain/gmo-summary.ts (legacy format incl. 'tbd'); plasmid delete cascade extended to gmos
- Formblatt-Z + plasmid list reports: ReportService (legacy-parity row assembly + glossary integrity gate), exceljs workbooks with legacy print formatting, GET /api/reports/formblatt-z?lang=de|en and /api/reports/plasmid-list, /reports page with itemized gate errors, Reports nav entry
- plasmids.backboneVector field (Ausgangsvektor): additive column migration in database-init, schemas/service/panel field
- New dependency: exceljs 4.4.0 (XLSX generation)
- Rename propagation: feature annotation renames rewrite cassette content transactionally (legacy update_cassettes semantics: full tokens only, variants preserved, normalized first); organism renames propagate into gmos.organismName and glossary_features.organism (beyond legacy)
- Settings entity: singleton settings table/service/API (GET/PATCH /api/settings), /settings page (autosave-on-blur, email validation, optimistic checkbox), Settings nav entry; reports now use settings for filenames (Formblatt-Z_{name}_{date}.xlsx, Plasmidlist_{name}_{date}.xlsx) and footers (institution; "{initials} Plasmidlist"), closing the deferred report items
- Attachments: attachments table (BLOB in DB, legacy model), AttachmentRepository/Service, multipart upload API (POST /api/plasmids/[id]/attachments), download (GET /api/attachments/[id], stored filename via Content-Disposition), delete; AttachmentSection in the detail panel
- GenBank: genbank_files table (one per plasmid — normalized out of the legacy Plasmids.genebank/gb_name columns), GenbankService with legacy .gb/.gbk gate and replace-on-import, API (GET metadata / ?download=1 / PUT multipart / DELETE at /api/plasmids/[id]/genbank), GenbankSection in the panel ('•' marker + filename, Download/Replace/Remove); plasmid delete cascade extended to both tables; shared upload/download helpers in src/shared/http-file.ts
- Plasmid duplication (legacy -DUPLICATE-): PlasmidService.duplicatePlasmid copies content fields + ' (Copy)' name (numbered on clash), all cassettes; GMOs only when the duplicateGmos setting is on (today's dates, destroyed cleared); GenBank/attachments left behind; POST /api/plasmids/[id]/duplicate; Duplicate button in the detail panel with legacy confirm prompt, copy becomes selected
- Primer + Feature layers (v2 additions — no legacy counterpart; locked v2 schema): repos/services/APIs (GET/POST /api/plasmids/[id]/primers|features, PATCH/DELETE /api/primers|features/[id]), PrimerSection + FeatureSection in the detail panel; primer gcPercent/tmCelsius derived server-side (src/domain/primer-calc.ts: GC% + Wallace rule ≤ 30 nt), IUPAC sequence validation, 1-based position ranges with merged-range checks
- Table UX completion (locked ui-ux-direction): spreadsheet keyboard navigation (arrows/Home/End, Enter-commit-moves-down, Tab-commit-moves-right, Escape refocus, type-to-edit) via src/components/ui/grid-navigation.ts + EditableCell nav/focus-restoration; Ctrl+C cell copy; bulk-bar row copy (TSV); TSV block paste filling rows/columns from the anchor cell (src/components/plasmids/paste-grid.ts, one PATCH per row, per-cell error reporting, overflow ignored+reported)
- GMOCU v1 database import (legacy import_data): ImportService + POST /api/import (dryRun inspection, selective import) + ImportSection card on /settings; imports plasmids (status/description/backboneVector mapping), cassettes, GMOs, attachments (BLOBs), GenBank (normalized into genbank_files), and backfills missing glossary features/organisms from the source; single transaction; handles pre-0.5 sources without uid columns; verified live against gmocu/example v0.4 + v0.7 databases
- Linear design language adopted app-wide (2026-08-29): design system installed at .claude/skills/design-taste-frontend/references/linear-design-system.md; gray/blue Tailwind scales remapped to Linear's canvas/surface ladder (#010102 → #0f1011 → #141516 → #18191a) and single lavender accent (#5e6ad2), Inter via next/font, hairline borders, no dark shadows (elevation = surface steps + panel-lift top-edge highlight), quiet tinted status badges, surface-3 floating overlays; styling only — no behavior changes, all 296 tests still pass
- Data quality checks (legacy check_plasmids/check_features/check_organisms): DataQualityService with 10 graded checks (error = blocks Formblatt-Z, warning = record incomplete, info = housekeeping), GET /api/health, "Data quality" card on /reports with per-check itemized findings; the two error checks delegate to ReportService.checkGlossaryIntegrity so the card and the export gate cannot disagree. Legacy computed the check_plasmids lists and the redundant/duplicate lists but discarded them at every call site — v2 surfaces them
- Row-level Formblatt-Z readiness indicator (closes the last open locked UX requirement from ui-ux-direction.md): DataQualityService.plasmidReadiness returns ready/incomplete/blocked per plasmid with deduplicated reasons, GET /api/plasmids/readiness, "Formblatt Z" column in the plasmid table (dot + label, reasons as tooltip and accessible name); soft signal — rows stay editable; refreshed on mount, create/duplicate/delete, and detail-panel close
- 318 tests passing (unit + integration incl. API route tests via tests/helpers/test-db.ts)
- Parity evidence: docs/plans/parity-evidence/ (plasmid-editable-table-autosave.md, cassette-layer.md, glossary-and-token-editor.md, organisms-and-gmos.md, formblatt-z-reports.md, rename-propagation.md, settings.md, attachments-genbank.md, plasmid-duplication.md, primers-features.md, table-ux-clipboard-keyboard.md, db-import.md)

**Next candidates** (checked against docs/legacy-analysis/feature-inventory.md — the earlier list omitted three real parity gaps):

_Local, testable without credentials:_

1. Glossary Excel import/export (inventory §5) — template-based import, export all/used-only; exceljs already a dependency
2. Target + favourite organism lists (inventory §6) — also unlocks batch-add GMOs from favourites (inventory §3 gap)
3. Bulk-create-on-paste (rows below the table); glossary tables adopting the grid navigation
4. DB backup/export (complement to import; legacy offered a backup before importing)

_Needs external credentials, so it cannot be verified autonomously:_

6. Google Sheets glossary sync (inventory §7)
7. ICE / Google Drive / Filebrowser publishing (inventory §8) — the one remaining nav target (Publish)

---

---

## What's Ready

### Architecture & Governance ✅

- [x] AGENTS.md — Development principles, testing requirements, parity gates
- [x] 10 ADRs locked (all blocking issues resolved)
- [x] Design review skill wired (apple-design-skill integrated)
- [x] ADR dependency map created

### Project Scaffolding ✅

- [x] package.json — Dependencies locked (knex, jest, zod, pino, tailwind, shadcn/ui)
- [x] tsconfig.json — Strict mode, path aliases for all modules
- [x] .eslintrc.json + .prettierrc.json — Code quality enforcement
- [x] jest.config.js — Testing setup
- [x] next.config.js — Next.js configuration
- [x] .env.example — Environment variables template

### Source Code Structure ✅

- [x] /src/app — Next.js route handlers + pages (ADR-0001)
- [x] /src/domain — Entity types + business rules
- [x] /src/services — Repository base class (ADR-0005)
- [x] /src/infrastructure — Database, logging, query builder (ADR-0008, ADR-0005)
- [x] /src/ui — React component templates
- [x] /src/shared — API types, validation schemas, constants
- [x] /tests/unit — Example unit tests
- [x] /tests/integration — Integration test templates

### Infrastructure Code ✅

- [x] logger.ts — Structured JSON logging with correlation IDs (pino)
- [x] database.ts — SQLite connection + transaction helpers
- [x] query-builder.ts — knex.js query builder initialization
- [x] repository.ts — Generic Repository<T> base class with CRUD + query patterns
- [x] api-types.ts — Standard error/success envelopes (ADR-0008)
- [x] domain/types.ts — TypeScript interfaces for all entities

### Database Layer ✅

- [x] Schema design document (docs/plans/DATABASE_SCHEMA_MIGRATION.md)
- [x] db-init.ts — Schema creation script
- [x] db-seed.ts — Development seed data (sample plasmid, cassettes, primers, etc.)
- [x] Migration plan (reversible, parity-first per ADR-0009)

### Documentation ✅

- [x] PRE_IMPLEMENTATION_CHECKLIST.md — Detailed checklist
- [x] DEPENDENCY_DECISIONS.md — Dependency analysis + recommendations
- [x] DATABASE_SCHEMA_MIGRATION.md — Schema mapping + migration strategy
- [x] src/*/README.md — Module-by-module guidance for agents

### Testing Infrastructure ✅

- [x] jest.config.js — TypeScript + coverage configuration
- [x] tests/setup.ts — Jest setup file
- [x] tests/unit/repository.test.ts — Example unit test pattern

---

## Next Steps: Ready to Build

### Critical Path

1. ✅ Dependencies locked (package.json)
2. ✅ TypeScript configured (tsconfig.json)
3. ✅ Folder structure prepared
4. ✅ Infrastructure code scaffolded (logger, database, query builder)
5. ✅ Base repository pattern implemented

### Ready for Agents to Implement (in this order)

#### Phase 1: Foundation (critical path)

- **Database initialization**
  - Run: `npm run db:init` to create schema
  - Implement migration infrastructure (knex migrations)
  - Verify schema matches docs/plans/DATABASE_SCHEMA_MIGRATION.md

- **Entity repositories & services**
  - PlasmidRepository / PlasmidService
  - CassetteRepository / CassetteService
  - ProjectRepository / ProjectService
  - (Each follows repository.ts base class pattern)

- **API route handlers**
  - Plasmid CRUD endpoints (GET /api/plasmids, POST, PATCH, DELETE)
  - Cassette CRUD endpoints
  - Project endpoints
  - Follow src/app/README.md pattern
  - Each must return ApiSuccessEnvelope / ApiErrorEnvelope (ADR-0008)

#### Phase 2: UI (can run in parallel)

- **Spreadsheet table component** (core from ui-ux-direction)
  - Read from /api/plasmids
  - Support row selection
  - Autosave on cell edit
  - Copy/paste support

- **Detail panel component**
  - Synced with table row selection
  - Form editor for plasmid properties
  - Side or bottom panel layout

- **Cassette editor**
  - Improved from GMOCU (no modal workflow)
  - Free-text + autocomplete

#### Phase 3: Integration adapters (can run in parallel)

- **Google Drive adapter** (ADR-0006 pattern)
- **Google Sheets adapter**
- **GenBank auto-match**
- **ICE integration**
- Each uses adapter pattern with concrete timeouts/retry logic

#### Phase 4: Remaining entities

- User/auth (phase 1 is single-user local-first)
- Integration sync orchestration
- Parity testing suite

---

## Build Commands (Ready)

```bash
# Install dependencies
npm install

# Development
npm run dev              # Next.js dev server on :3000

# Database
npm run db:init          # Create schema
npm run db:seed          # Load sample data

# Code quality
npm run lint             # ESLint + Prettier
npm run type-check       # TypeScript type checking

# Testing
npm run test             # Jest unit tests
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report

# Build & production
npm run build            # Next.js production build
npm start                # Start production server
```

---

## Constraints to Remember

### Architecture Enforcement

- ✅ No raw SQL (use knex query builder, ADR-0005)
- ✅ No heavy ORM (query builder is the limit, ADR-0005)
- ✅ Services own transactions via `withTransaction()` helper
- ✅ Repositories are thin read/write layer only
- ✅ Validation is three-layer (API → domain → adapter, ADR-0007)
- ✅ All logs are structured JSON with correlationId (ADR-0008)
- ✅ All API responses use error/success envelopes (ADR-0008)
- ✅ No feature creep — parity-first (ADR-0004)

### Parity Gate (Required Before Merge)

Every feature must include parity evidence:

- [ ] Feature behavior verified against legacy GMOCU
- [ ] Data read/write parity verified
- [ ] Validation/error behavior parity verified
- [ ] No UI flow regressions introduced
- [ ] Migration/backward compatibility verified

See .github/pull_request_template.md for checklist.

### Design Review

- ✅ UI components must pass apple-design-skill review before merge
- ✅ Accessibility (WCAG 2.1 AA) required
- ✅ Dark mode support required
- ✅ See AGENTS.md "Design Review & Accessibility" for invocation

---

## Blockers: None 🚀

Everything is ready. Agents can begin implementation immediately with:

- Clear architecture (10 locked ADRs)
- Type-safe scaffolding (TypeScript, Zod)
- Test infrastructure (Jest + examples)
- Database schema designed (reversible migrations)
- API contracts defined (error/success envelopes)
- UI direction locked (spreadsheet-first + detail panel)

**First Agent Task:**
Run `npm run db:init && npm run db:seed` to verify database setup, then implement PlasmidRepository and PlasmidService following src/services/repository.ts pattern.

---

**Status:** ✅ Ready for full-scale development
