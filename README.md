# jlab - Modern Reimplementation

A comprehensive rebuild of GMOCU (GMO/Plasmid management system) with modern architecture, improved UX, and clean code practices.

**Current Status: 🚀 READY FOR IMPLEMENTATION**

---

## Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev
# Visit http://localhost:3000

# Run type checking
npm run type-check

# Run all tests
npm run test

# Run linting and formatting
npm run lint

# Initialize database (optional: the dev server creates the schema on first use)
npm run db:init

# Seed sample data
npm run db:seed

# Production build
npm run build
```

---

## For First-Time Readers

### I'm an agent starting implementation work

1. **Read these first (5-10 min):**
   - [AGENTS.md](AGENTS.md) - Governance rules, development principles, testing requirements
   - [FIRST_IMPLEMENTATION_TASK.md](FIRST_IMPLEMENTATION_TASK.md) - Your first task: PlasmidRepository

2. **Understand the architecture (15 min):**
   - [docs/decisions/](docs/decisions/) - 10 locked architectural decisions
   - Key files: ADR-0005 (data access), ADR-0008 (API patterns), ADR-0009 (parity gates)

3. **Before you start coding (10 min):**
   - [src/services/README.md](src/services/README.md) - Repository pattern explanation
   - [docs/plans/DATABASE_SCHEMA_MIGRATION.md](docs/plans/DATABASE_SCHEMA_MIGRATION.md) - Full schema reference
   - [docs/legacy-analysis/feature-inventory.md](docs/legacy-analysis/feature-inventory.md) - What features to build

4. **Start implementing:**
   - Follow patterns in [src/services/repository.ts](src/services/repository.ts) (base class)
   - Reference examples in existing infrastructure code
   - Tests go in `tests/integration/` (use real database, no mocks)
   - Run verification: `npm run type-check && npm run lint && npm run test`

### I'm reviewing the project status

- [PROJECT_READY.md](PROJECT_READY.md) - What's ready, what's next
- [SESSION_SUMMARY.md](SESSION_SUMMARY.md) - What was fixed this session
- [FINAL_BUILD_VERIFICATION.md](FINAL_BUILD_VERIFICATION.md) - Complete build verification results
- [TYPESCRIPT_FIXES.md](TYPESCRIPT_FIXES.md) - Technical fixes applied

### I'm interested in design/UX

- [docs/architecture/ui-ux-direction.md](docs/architecture/ui-ux-direction.md) - UI/UX strategy
- [docs/architecture/](docs/architecture/) - All architecture documents
- [.claude/skills/design-taste-frontend/references/linear-design-system.md](.claude/skills/design-taste-frontend/references/linear-design-system.md) - The design system (Linear language: tokens, elevation ladder, components)
- Design review skill: `design-taste-frontend` (already installed, see AGENTS.md)

### I want to understand what GMOCU does

- [docs/legacy-analysis/feature-inventory.md](docs/legacy-analysis/feature-inventory.md) - All features
- [docs/legacy-analysis/user-workflows.md](docs/legacy-analysis/user-workflows.md) - How users work with it
- [docs/legacy-analysis/modern-replacement-proposal.md](docs/legacy-analysis/modern-replacement-proposal.md) - How we're rebuilding it

---

## Project Structure

```
jlab/
├── AGENTS.md                        # Governance & rules for all work
├── FIRST_IMPLEMENTATION_TASK.md     # First agent task (PlasmidRepository)
├── PROJECT_READY.md                 # Project status & readiness
├── FINAL_BUILD_VERIFICATION.md      # Build verification results
├── SESSION_SUMMARY.md               # What was accomplished this session
├── TYPESCRIPT_FIXES.md              # Technical fixes applied
│
├── src/
│   ├── app/                         # Next.js pages & layouts
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── globals.css
│   │
│   ├── infrastructure/              # Core technical components
│   │   ├── database.ts              # SQLite connection + setup
│   │   ├── logger.ts                # Structured JSON logging (pino)
│   │   ├── query-builder.ts         # Knex query builder initialization
│   │   └── README.md                # Infrastructure overview
│   │
│   ├── services/                    # Business logic layer
│   │   ├── repository.ts            # Base Repository<T> class
│   │   ├── plasmid.repository.ts    # [TO IMPLEMENT] - First task
│   │   ├── plasmid.service.ts       # [TO IMPLEMENT] - First task
│   │   └── README.md                # Service pattern guidelines
│   │
│   ├── domain/                      # Domain types & validation
│   │   ├── types.ts                 # TypeScript types for all entities
│   │   └── errors.ts                # DomainError types
│   │
│   ├── utils/                       # Shared utilities
│   │   ├── pagination.ts
│   │   └── errors.ts
│   │
│   └── api/                         # [TO IMPLEMENT] - API routes
│       └── plasmids/
│           ├── route.ts             # GET /api/plasmids, POST
│           └── [id]/
│               └── route.ts         # PATCH, DELETE /api/plasmids/[id]
│
├── tests/
│   ├── setup.ts                     # Jest setup & environment
│   ├── unit/
│   │   └── repository.test.ts       # Repository pattern tests
│   └── integration/
│       ├── plasmid.repository.test.ts  # [TO IMPLEMENT] - First task
│       └── plasmid.service.test.ts     # [TO IMPLEMENT] - First task
│
├── scripts/
│   ├── db-init.ts                   # Initialize database schema
│   └── db-seed.ts                   # Load sample data
│
├── docs/
│   ├── decisions/                   # 10+ Architectural Decision Records (locked)
│   │   ├── ADR-0001-tech-stack.md
│   │   ├── ADR-0005-data-access.md       # [CRITICAL] - Read before implementing
│   │   ├── ADR-0008-logging.md
│   │   ├── ADR-0009-parity.md            # [CRITICAL] - Verify legacy behavior
│   │   └── ...14 total ADRs
│   │
│   ├── architecture/
│   │   ├── system-architecture.md
│   │   ├── ui-ux-direction.md
│   │   ├── database-schema.md
│   │   └── api-design.md
│   │
│   ├── legacy-analysis/
│   │   ├── feature-inventory.md
│   │   ├── user-workflows.md
│   │   ├── technology-inventory.md
│   │   └── modern-replacement-proposal.md
│   │
│   └── plans/
│       ├── DATABASE_SCHEMA_MIGRATION.md
│       └── parity-evidence/
│           └── plasmid-parity.md         # [TO IMPLEMENT] - First task
│
├── gmocu/                           # Original GMOCU (reference only)
├── package.json
├── jest.config.js
├── next.config.js
├── tsconfig.json
└── tailwind.config.js
```

---

## Development Workflow

### Before Starting Work

1. Read [AGENTS.md](AGENTS.md)
2. Read relevant ADRs for your component
3. Check [FIRST_IMPLEMENTATION_TASK.md](FIRST_IMPLEMENTATION_TASK.md)

### During Development

1. Follow patterns from existing code
2. Test with `npm run test` after changes
3. Format with `npm run lint` before committing
4. Type-check with `npm run type-check`

### Before Submitting PR

- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm run test` passes all tests
- [ ] New integration tests added
- [ ] Parity evidence documented
- [ ] Clear commit message with intent

---

## Tech Stack

- **Framework:** Next.js 15 (React) with TypeScript
- **Database:** SQLite with Knex query builder
- **Testing:** Jest with ts-jest
- **Styling:** Tailwind CSS
- **Logging:** Pino (structured JSON)
- **Validation:** Zod
- **Quality:** ESLint, Prettier

See [ADR-0001](docs/decisions/ADR-0001-tech-stack.md) for rationale.

---

## Important Boundaries

- `gmocu/` is the legacy application and is **reference-only**.
- New implementation work must happen outside `gmocu/`.
- See [AGENTS.md](AGENTS.md) for all governance rules.

---

## Local CI

Run CI checks locally:

```powershell
pwsh -File .\scripts\ci-local.ps1
```

---

## Next Steps

1. **First agent task:** [FIRST_IMPLEMENTATION_TASK.md](FIRST_IMPLEMENTATION_TASK.md)
2. **For developers:** Start with [src/services/README.md](src/services/README.md)
3. **For reviewers:** See [AGENTS.md](AGENTS.md) (Testing Requirements)
4. **For questions:** Check [docs/decisions/](docs/decisions/) or [docs/legacy-analysis/](docs/legacy-analysis/)

---

**Status: Ready for Phase 1 Implementation** ✅
