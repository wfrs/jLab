# jlab - Project Ready for Implementation

**Status: ✓ BUILD VERIFIED**

All TypeScript errors fixed. Project successfully builds, database scripts work, dev server starts.

---

## ✓ Verification Summary

### Build & Compilation

- [x] TypeScript compilation: **PASS**
- [x] Next.js build to .next/: **PASS**
- [x] ESLint & Prettier: Configured
- [x] Jest test runner: Configured

### Database

- [x] Schema initialization (db:init): **PASS**
  - All 8 tables created with indexes and constraints
  - Reversible migrations planned (ADR-0009)
- [x] Sample data seeding (db:seed): **PASS**
  - Sample plasmid (pGFP) with cassettes, primers, features
  - Enables API testing without manual data setup

### Runtime

- [x] Next.js dev server (npm run dev): **PASS**
  - Server starts at http://localhost:3000
  - Ready for route handler development

---

## Quick Start

```bash
# Install dependencies
npm install

# Initialize database (creates schema + indexes)
npm run db:init

# Seed development data (sample plasmids, cassettes, etc.)
npm run db:seed

# Start dev server
npm run dev

# Run tests
npm test

# Type checking
npm run type-check

# Linting + formatting
npm run lint
npm run lint:fix
```

---

## Project Structure

```
src/
├── app/              # Next.js route handlers & pages (ADR-0001)
├── domain/           # Entity types (ADR-0007)
├── services/         # Repository base class + services (ADR-0005)
├── infrastructure/   # Logger, database, query builder (ADR-0008)
├── ui/               # React components (ADR-0001)
└── shared/           # Common types & utilities (ADR-0008)

tests/
├── unit/             # Repository pattern, service layer
└── integration/      # API routes, database transactions

scripts/
├── db-init.ts        # Schema creation
└── db-seed.ts        # Development data

docs/
├── decisions/        # 10 locked ADRs
├── architecture/     # UI/UX direction, rebuild strategy
├── plans/            # Database schema, parity checklist
└── legacy-analysis/  # Feature inventory, technical debt
```

---

## Architecture

### Tech Stack (Locked - ADR-0001)

- **Frontend**: React 18 + TypeScript + Next.js 14
- **Styling**: Tailwind CSS + shadcn/ui components
- **Backend**: Next.js route handlers (extract at 8+ handlers)
- **Database**: SQLite + knex query builder (ADR-0005)
- **Logging**: pino structured JSON logs with correlation IDs (ADR-0008)
- **Testing**: Jest + React Testing Library
- **Validation**: Zod (three-layer model - ADR-0007)

### Key Patterns (Non-Negotiable)

1. **Repository pattern** (ADR-0005)
   - Base class: `Repository<T>`
   - All data access through typed repos
   - Services own transactions

2. **Standard API envelopes** (ADR-0008)
   - `ApiSuccessEnvelope<T>` for all successful responses
   - `ApiErrorEnvelope` for errors with categories
   - Correlation IDs for tracing

3. **Validation layers** (ADR-0007)
   - Layer 1: API boundary (Zod schemas)
   - Layer 2: Domain invariants (TypeScript types)
   - Layer 3: Adapter payloads (integration-specific)

4. **Logging pattern** (ADR-0008)
   - Structured JSON logs via pino
   - Correlation ID in every log context
   - Request tracking across services

---

## What's Ready

- ✓ Architecture locked (10 ADRs approved)
- ✓ Dependencies decided & pinned
- ✓ Project scaffolded (all folders, config)
- ✓ Infrastructure code implemented
  - Logger with correlation IDs
  - SQLite connection + transaction helpers
  - knex query builder initialization
  - Generic Repository<T> base class
  - Standard API envelopes
- ✓ Database schema designed with migration plan
- ✓ Seed data configured for testing
- ✓ Testing framework configured
- ✓ Design review skill integrated

---

## What Agents Will Build (Phase 1)

### Tier 1: Domain Layer

1. **PlasmidRepository** - extends Repository<Plasmid>
   - Implement queries: getByProject(), search(), paginatedList()
   - Parity tests vs legacy GMOCU

2. **PlasmidService** - orchestrates repository & transactions
   - createPlasmid(project, data)
   - updatePlasmid(id, updates)
   - deletePlasmid(id)
   - All tests passing before PR merge

### Tier 2: API Routes

3. **GET /api/plasmids** - list plasmids with paging
   - Return ApiSuccessEnvelope<PlasmidList>
   - Implement pagination, search, sorting
   - Error handling returns ApiErrorEnvelope

4. **POST /api/plasmids** - create plasmid
   - Validate input with Zod
   - Check domain invariants
   - Return ApiSuccessEnvelope<Plasmid>

5. **PATCH /api/plasmids/[id]** - update plasmid
6. **DELETE /api/plasmids/[id]** - delete plasmid

### Tier 3: UI Components

7. **PlasmidTable** component
   - Display plasmids in spreadsheet-first layout (from UI/UX direction)
   - Sync with detail panel
   - Auto-save on edit

8. **PlasmidForm** component
   - Create/edit form
   - Zod validation feedback
   - Submit to API

---

## Governance Rules (From AGENTS.md)

### Before Implementing Any Feature

1. Read relevant ADRs (AGENTS.md section 2)
2. Check DEPENDENCY_DECISIONS.md for why each dependency was chosen
3. Review parity checklist for legacy behavior expectations
4. Understand validation layers (ADR-0007)

### During Implementation

1. ✓ No raw SQL - use knex query builder
2. ✓ Services own transactions - repositories don't
3. ✓ All route handlers return standard envelopes
4. ✓ Structured logging with correlationId
5. ✓ Three-layer validation always
6. ✓ Unit + integration tests required
7. ✓ No magic numbers, no hardcoded secrets
8. ✓ Strict TypeScript (noUnusedLocals, exactOptionalPropertyTypes)

### Before PR Merge

1. ✓ All tests pass
2. ✓ Type check passes
3. ✓ Lint + format passes
4. ✓ Design review (apple-design-skill) for UI components
5. ✓ Parity verification for legacy features
6. ✓ Documentation updated (README, IMPLEMENTATION_STATUS)

---

## TypeScript Errors Fixed (Completed)

| Error                                    | Cause                             | Fix                                    |
| ---------------------------------------- | --------------------------------- | -------------------------------------- |
| `crypto.v4()` doesn't exist              | No uuid package                   | Implemented `generateUUID()`           |
| pino transport option typing             | exactOptionalPropertyTypes strict | Explicitly handle undefined in options |
| knex logger 'deprecation' vs 'deprecate' | API mismatch                      | Changed to correct pino API            |
| Repository base class instantiation      | Abstract class in tests           | Created concrete test subclass         |
| NODE_ENV readonly in Jest                | process.env read-only             | Removed direct assignment              |
| LogContext missing definition            | Import missing                    | Added to logger.ts exports             |
| Unused fs/path imports                   | Cleanup                           | Removed unused imports                 |
| next.config.js module.exports in ESM     | package.json "type": "module"     | Changed to ES6 export default          |
| globals.css missing                      | Layout imports non-existent file  | Created globals.css with Tailwind      |

---

## Database Schema Ready

### 8 Tables (Parity with Legacy GMOCU)

1. **projects** - plasmid projects (groups of related plasmids)
2. **plasmids** - core biological constructs
3. **cassettes** - sub-components of plasmids
4. **primers** - PCR primer designs
5. **features** - named biological features (promoters, terminators, etc.)
6. **project_plasmids** - association table
7. **users** - user accounts
8. **integrations** - external service configs (Google Drive, Sheets)

### Sample Data Available

- Project: "Sample Project"
- Plasmid: pGFP (green fluorescent protein vector)
  - 5 cassettes (promoter, GFP marker, terminator, origin, resistance)
  - 2 primers (pGFP-Fwd, pGFP-Rev)
  - 4 features (T7 promoter, GFP gene, His-tag, stop codon)

Use `npm run db:seed` to reload for testing.

---

## Next Steps for Agents

1. **PlasmidRepository implementation**
   - Start with getByProject() query
   - Write tests in tests/unit/
   - Use parity checklist for coverage

2. **PlasmidService implementation**
   - Orchestrate PlasmidRepository
   - Own all transactions (service layer responsibility)
   - Error handling returns DomainError

3. **API routes for /api/plasmids**
   - Each route follows envelope pattern
   - Every response: ApiSuccessEnvelope or ApiErrorEnvelope
   - Correlation ID in every log

4. **UI implementation**
   - Use spreadsheet-first layout (docs/architecture/ui-ux-direction.md)
   - Integrate with shadcn/ui + Tailwind
   - Design review before component PR

---

## Build Commands Reference

```bash
# Development
npm run dev              # Next.js dev server (http://localhost:3000)
npm run build            # Production build to .next/
npm run start            # Start production server

# Database
npm run db:init          # Initialize schema
npm run db:seed          # Load sample data
npm run db:migrate       # Run knex migrations (not yet implemented)

# Testing
npm test                 # Run all tests
npm run test:unit        # Run unit tests only
npm run test:integration # Run integration tests only
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report

# Code Quality
npm run type-check       # TypeScript without emit
npm run lint             # ESLint + Prettier check
npm run lint:fix         # Auto-fix linting issues
```

---

## Important Files to Know

- **AGENTS.md** - Development governance & patterns (read before any implementation)
- **docs/decisions/ADR-\*.md** - Locked architectural decisions
- **docs/plans/DATABASE_SCHEMA_MIGRATION.md** - Full schema with parity checklist
- **docs/plans/PRE_IMPLEMENTATION_CHECKLIST.md** - Detailed readiness checklist
- **docs/architecture/ui-ux-direction.md** - Locked UI/UX model
- **BUILD_READY.md** - Original completion summary
- **IMPLEMENTATION_STATUS.md** - Phase breakdown and constraints

---

## Support

**All infrastructure is ready. No blockers. Begin Phase 1 implementation immediately.**

For questions on patterns, refer to:

- AGENTS.md (governance)
- src/{module}/README.md (implementation guides)
- tests/unit/repository.test.ts (example test structure)
- docs/decisions/ (architectural decisions)

Project is **production-ready scaffolding**. Agents can start implementing domain features immediately.

---

**Last Updated**: TypeScript errors resolved, all systems verified
**Verified**: npm run build ✓ | npm run db:init ✓ | npm run db:seed ✓ | npm run dev ✓
