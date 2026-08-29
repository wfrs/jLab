# 🚀 GMOCU Rebuild: Project Ready for Implementation

**Status:** ✅ **COMPLETE & READY TO BUILD**

---

## What You Get

A fully scaffolded Next.js project with:

### 1. Architecture (Locked & Unambiguous)

- ✅ 10 ADRs covering all critical decisions
- ✅ No open questions or ambiguities
- ✅ Design review skill integrated
- ✅ Parity-first governance (AGENTS.md)
- ✅ Testing requirements specified
- ✅ All blocking issues resolved

### 2. Project Structure (Ready to Code)

- ✅ TypeScript strict mode configured
- ✅ All path aliases set up (@app, @domain, @services, @infrastructure, @ui, @shared)
- ✅ Next.js + React configured
- ✅ Module organization per ADRs (layered architecture)
- ✅ Directory READMEs for each module

### 3. Dependencies (Locked)

```
Query Builder:     knex.js (SQL-agnostic, not ORM)
Testing:          Jest + React Testing Library
UI Components:    shadcn/ui + Tailwind CSS
Validation:       Zod (TypeScript-first)
Logging:          pino (structured JSON + correlation IDs)
Database:         sqlite3 (async, phase 2-ready)
Migrations:       knex migrations
HTTP Client:      fetch + custom retry helper
```

### 4. Infrastructure Code (Implemented)

- ✅ Logger with correlation ID support (ADR-0008)
- ✅ Database connection pooling + transaction helpers (ADR-0005)
- ✅ Query builder initialization (knex)
- ✅ API error/success envelope types (ADR-0008)
- ✅ Base Repository<T> class with CRUD + query patterns (ADR-0005)
- ✅ Domain entity TypeScript interfaces (all 8 entities)

### 5. Database Schema (Designed & Reversible)

- ✅ Complete schema design (docs/plans/DATABASE_SCHEMA_MIGRATION.md)
- ✅ Migration scripts (db-init.ts, db-seed.ts)
- ✅ Parity verification checklist
- ✅ Sample data for development

### 6. Testing Foundation (Ready)

- ✅ Jest configured with TypeScript
- ✅ React Testing Library set up
- ✅ Example unit test pattern
- ✅ Code coverage enforcement (70% threshold)

### 7. Documentation (Complete)

- ✅ Module-by-module READMEs (guidance for agents)
- ✅ API pattern examples (route handler template)
- ✅ Implementation status checklist
- ✅ Architecture decision map
- ✅ Legacy GMOCU analysis (feature inventory, workflows, code map)

---

## Getting Started (3 Commands)

```bash
# 1. Install dependencies
npm install

# 2. Initialize database
npm run db:init && npm run db:seed

# 3. Start development
npm run dev
```

Then open **http://localhost:3000** and you'll see the GMOCU home page.

---

## Build Sequence (Ready for Agents)

### Phase 1: Foundation (Critical Path)

These must be done first, in order:

1. **Entity Repositories & Services** (follow src/services/README.md)
   - PlasmidRepository / PlasmidService
   - CassetteRepository / CassetteService
   - ProjectRepository / ProjectService
   - Time: ~2 hours (each follows repository.ts base class pattern)

2. **API Route Handlers** (follow src/app/README.md)
   - Plasmid CRUD endpoints (/api/plasmids/_, /api/plasmids/:id/_)
   - Cassette endpoints
   - Project endpoints
   - Must return ApiErrorEnvelope / ApiSuccessEnvelope (ADR-0008)
   - Time: ~2 hours

3. **Parity Testing**
   - Verify all read/write behavior matches legacy GMOCU
   - Document evidence in docs/plans/parity-evidence/
   - Time: ~1 hour per entity

### Phase 2: UI (Can Run in Parallel)

Once Phase 1 APIs work:

1. **Spreadsheet Table Component**
   - Read from /api/plasmids
   - Row selection
   - Autosave on cell edit
   - Copy/paste support
   - **Must pass apple-design-skill review before merge**

2. **Detail Panel Component**
   - Synced with table selection
   - Form editor

3. **Cassette Editor**
   - Improved from GMOCU (no modal)
   - Free-text + autocomplete

### Phase 3: Integration Adapters (Can Run in Parallel)

Follow ADR-0006 adapter pattern with concrete timeouts/retry logic:

- Google Drive adapter (read/write)
- Google Sheets adapter (sync)
- GenBank auto-match
- ICE integration
- Filebrowser integration

### Phase 4: Remaining Entities

- User/auth (phase 1: single-user local-first)
- Integration sync orchestration
- Full parity test suite

---

## Key Principles (From AGENTS.md)

### Parity First

Every feature **must** verify it works identically to legacy GMOCU:

- [ ] Feature behavior verified against legacy
- [ ] Data read/write parity verified
- [ ] Validation/error behavior parity verified
- [ ] No UI flow regressions
- [ ] Migration/backward compatibility verified

### Design Review (Before UI Implementation)

- ✅ All UI changes must pass apple-design-skill review
- ✅ Accessibility (WCAG 2.1 AA) is required, not optional
- ✅ Dark mode support required
- See AGENTS.md for design review invocation rules

### Strict Architecture

- ✅ No raw SQL (use knex query builder)
- ✅ No heavy ORM (query builder is the limit)
- ✅ Services own transactions via `withTransaction()` helper
- ✅ Repositories are thin read/write layer only
- ✅ Validation is three-layer (API → domain → adapter)
- ✅ All logs are structured JSON with correlationId

### Testing Requirements

Every feature must include:

- Unit tests (happy + error + edge cases)
- Integration tests (database + API)
- Parity evidence (legacy behavior verification)
- Error-path validation

---

## Commands You Have

```bash
# Development
npm run dev              # Start dev server on :3000
npm run build            # Production build
npm start                # Start production server

# Database
npm run db:init          # Create schema
npm run db:seed          # Load sample data
npm run db:migrate       # Run pending migrations (when added)

# Code Quality
npm run lint             # ESLint + Prettier check
npm run lint:fix         # Auto-fix lint issues
npm run type-check       # TypeScript type check

# Testing
npm run test             # Run all tests once
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests only

# CI/Local Validation
npm run ci:local         # Run local CI checks
```

---

## File Structure Reference

```
Governance & Config:
  AGENTS.md                          — Development principles
  IMPLEMENTATION_STATUS.md           — What's ready, next steps
  package.json, tsconfig.json, etc.  — Build config

Architecture:
  docs/decisions/ADR-*.md            — All 10 locked decisions
  docs/decisions/DEPENDENCY_DECISIONS.md
  docs/architecture/ui-ux-direction.md

Database:
  docs/plans/DATABASE_SCHEMA_MIGRATION.md
  scripts/db-init.ts                 — Schema creation
  scripts/db-seed.ts                 — Sample data

Scaffolding:
  src/app/                           — Route handlers
  src/domain/                        — Entity types
  src/services/repository.ts         — Base repository class
  src/infrastructure/                — Logger, DB, query builder
  src/ui/                            — React components
  src/shared/                        — Common types & utilities

Testing:
  tests/setup.ts
  tests/unit/repository.test.ts      — Example pattern
  jest.config.js

Module Guidance:
  src/*/README.md                    — Per-module instructions
```

---

## What's NOT Included (Intentional)

- ❌ No actual route handlers yet (agents will implement)
- ❌ No database migrations yet (ADR-0009 reversible pattern to follow)
- ❌ No UI components yet (must pass design review first)
- ❌ No integration adapters yet (ADR-0006 pattern to follow)
- ❌ No multi-user auth (phase 1 is single-user local-first)

Everything else is ready. This is intentional — agents have clear patterns and constraints but freedom to implement correctly.

---

## No Blockers 🚀

Everything needed to start building is complete:

- ✅ Architecture decisions locked
- ✅ Dependencies specified
- ✅ Project structure scaffolded
- ✅ Infrastructure code ready
- ✅ Database schema designed
- ✅ Testing framework configured
- ✅ Documentation complete
- ✅ Design review skill integrated

**You can start implementation immediately.**

---

## First Agent Task

1. Review IMPLEMENTATION_STATUS.md and this file
2. Run: `npm install && npm run db:init && npm run db:seed`
3. Verify database initialized successfully
4. Start with PlasmidRepository + PlasmidService following src/services/repository.ts pattern
5. Write parity tests against legacy GMOCU behavior
6. Create /api/plasmids GET endpoint (list all plasmids from database)
7. Verify response matches ApiSuccessEnvelope contract (ADR-0008)
8. Next agent can build on this foundation in parallel

**Estimated Phase 1 time:** 6-8 hours total for all repos + services + route handlers

---

## Questions?

Everything is documented:

- **Architecture questions?** → docs/decisions/ADR-*.md
- **How to implement X?** → src/*/README.md
- **Database?** → docs/plans/DATABASE_SCHEMA_MIGRATION.md
- **Development workflow?** → AGENTS.md
- **Dependencies?** → docs/decisions/DEPENDENCY_DECISIONS.md

No ambiguity. Ready to build.
