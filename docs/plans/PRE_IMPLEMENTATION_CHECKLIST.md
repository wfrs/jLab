# Pre-Implementation Checklist

Before we begin coding the GMOCU rebuild, we need to complete this checklist. Items marked ✅ are done; items marked ⚠️ need completion before implementation starts.

---

## Architecture & Design (✅ COMPLETE)

- ✅ Project goal and principles defined (`AGENTS.md`)
- ✅ 10 ADRs locked with all blocking issues resolved
- ✅ ADR dependency map created (`docs/decisions/ADR-dependency-map.md`)
- ✅ UI/UX model locked (spreadsheet-first + synced detail panel)
- ✅ Design review process integrated (apple-design-skill)
- ✅ Cross-platform HIG principles wired into governance

**Status:** Ready for implementation.

---

## Legacy Analysis (✅ COMPLETE)

- ✅ Feature inventory (`docs/legacy-analysis/feature-inventory.md`)
- ✅ User workflows (`docs/legacy-analysis/user-workflows.md`)
- ✅ Technology inventory (`docs/legacy-analysis/technology-inventory.md`)
- ✅ Architecture diagram (`docs/legacy-analysis/architecture-diagram.md`)
- ✅ Technical debt assessment (`docs/legacy-analysis/technical-debt-assessment.md`)
- ✅ Modern replacement proposal (`docs/legacy-analysis/modern-replacement-proposal.md`)
- ✅ Deep code map (`docs/legacy-analysis/code-map.md`)
- ✅ Repository structure analysis (`docs/legacy-analysis/repository-deep-dive.md`)

**Status:** Complete. Agents can reference for parity verification.

---

## Project Setup (⚠️ TODO - HIGH PRIORITY)

Items needed before running the first build:

- ⚠️ **package.json & dependencies**
  - Next.js version pinned (recommend latest stable)
  - React/TypeScript versions
  - Query builder library choice (ADR-0005: query builder not ORM)
  - Testing framework (Jest/Vitest + React Testing Library)
  - Linting (ESLint + Prettier config)
  - Database driver (sqlite3, better-sqlite3, or node-sqlite)
  - Validation library (Zod or similar for ADR-0007)
  - Logging library (pino or similar for ADR-0008 JSON structured logs)
  - Integration adapters (axios/fetch, Google API clients, etc.)
  - **Decision needed:** Should agents decide these during setup, or lock them now?

- ⚠️ **TypeScript configuration**
  - tsconfig.json with strict mode enabled
  - Path aliases for src modules (ADR-0003 module boundaries)
  - Type definitions for all external integrations

- ⚠️ **Next.js project structure**
  - `app/` directory with route handlers initial backend setup
  - Route handler extraction trigger scaffolding (ADR-0001 extraction criteria)
  - Middleware for logging/correlation ID propagation (ADR-0008)
  - Global error boundary for API responses (ADR-0008 error envelope)

- ⚠️ **Build & dev scripts**
  - `npm run dev` (Next.js dev server)
  - `npm run build` (production build)
  - `npm run test` (test runner)
  - `npm run lint` (ESLint + Prettier)
  - Local CI script integration (`scripts/ci-local.ps1` → invokes actual tests)

---

## Database Schema (⚠️ TODO - HIGH PRIORITY)

- ⚠️ **Schema migration plan**
  - Map legacy `gmocu.db` schema to new implementation
  - Document schema changes vs parity-required compatibility
  - Create migration scripts (ADR-0009: reversible migrations)
  - Define seed data for local development

- ⚠️ **Data access layer skeleton**
  - Database initialization & connection pooling (if needed)
  - Transaction helper implementation (ADR-0005 pattern)
  - Query builder repository scaffolding for each entity
  - **Decision needed:** Which entities first? (likely: Plasmids, Users, Projects based on feature-inventory)

---

## API & Route Handler Design (⚠️ TODO - MEDIUM PRIORITY)

- ⚠️ **Route handler surface**
  - List all endpoints needed for plasmid v1 (from feature-inventory + ui-ux-direction)
  - Group by module (plasmid CRUD, user/auth, project management, integration adapters)
  - Define request/response schemas for each (ADR-0007 validation layers)
  - Error code mapping (ADR-0008 error codes must align across all handlers)
  - **Decision needed:** HTTP-first design, or wait until code?

- ⚠️ **Authentication & authorization (Phase 1)**
  - Local-first auth strategy (ADR-0001 phase 1: no mandatory cloud)
  - Session management approach (JWT vs session cookies?)
  - Initial admin/single-user setup flow
  - **Decision needed:** How does local-first auth work for phase 1?

---

## Component Architecture (⚠️ TODO - MEDIUM PRIORITY)

- ⚠️ **React component inventory**
  - Table/spreadsheet component (core UI from ui-ux-direction)
  - Detail panel component (synced with table row selection)
  - Cassette editor component (improved from GMOCU)
  - Form components (consistent with validation 3-layer model)
  - Navigation/layout component (desktop-first responsive)
  - **Decision needed:** Use UI library (shadcn/ui, Headless UI, MUI)?

- ⚠️ **Styling strategy**
  - Tailwind CSS (recommended for rapid UI development)
  - Color system / semantic tokens (ADR-0008 requires semantic colors for light/dark mode)
  - Typography scale (locked by HIG principles in AGENTS.md)

---

## Testing Infrastructure (⚠️ TODO - MEDIUM PRIORITY)

- ⚠️ **Test framework setup**
  - Unit test structure (ADR-0004, ADR-0005 require comprehensive test coverage)
  - Integration test structure (database + API handlers)
  - Parity test evidence system (docs/plans/parity-evidence/)
  - Test runner configuration & CI integration

- ⚠️ **Test helpers**
  - Database seeding for tests
  - API test client
  - Mock adapter factories (for Google Drive, GenBank, etc. integrations)

---

## Development Workflow (⚠️ TODO - LOW PRIORITY)

- ⚠️ **Local environment setup guide**
  - Node version (recommend LTS)
  - npm/yarn/pnpm choice
  - Database setup for local dev
  - Environment variables template (.env.example)
  - IDE extensions recommended (ESLint, Prettier, TypeScript)

- ⚠️ **PR/change workflow documentation**
  - How to reference ADRs in commit messages
  - How to structure parity checklists
  - How to link issues/PRs to parity evidence
  - Code review checklist (.github/pull_request_template.md is ready)

- ⚠️ **Local CI automation**
  - Current `scripts/ci-local.ps1` is placeholder
  - Should run: lint + type-check + unit tests + integration tests
  - Should validate AGENTS.md + ADRs exist

---

## Implementation Order Recommendation

Once project setup is complete, follow this sequence (based on ADR-dependency-map):

1. **Database & repos** (ADR-0005 foundation)
   - Schema migration from legacy
   - Transaction helper implementation
   - Base repository/service scaffold for Plasmid entity

2. **Auth & core route handlers** (ADR-0001, ADR-0008)
   - Session management for phase 1 (local-first)
   - Global middleware (logging, error envelope, correlation IDs)
   - Error handling helpers per ADR-0008

3. **Plasmid CRUD** (first feature)
   - Plasmid read/list endpoints
   - Plasmid create/update/delete endpoints
   - Validation layers (ADR-0007)
   - Parity tests vs legacy

4. **UI components** (ADR-0001, AGENTS.md design review)
   - Spreadsheet table component
   - Detail panel component
   - Cassette editor component
   - Design review audit via apple-design-skill

5. **Integration adapters** (ADR-0006)
   - Google Drive adapter
   - Google Sheets adapter
   - GenBank auto-match adapter
   - ICE integration adapter

6. **Remaining features** (User, Project, etc.)

---

## Decision Gate: Project Setup

**Question for user:** Should we:

### Option A: Lock dependencies now

- Define exact versions for query builder, testing framework, UI library, logging, validation
- Create package.json + tsconfig.json now
- More setup upfront, but smoother agent code generation

### Option B: Defer to agent discretion

- Leave query builder library choice open (any that isn't an ORM)
- Let agents pick UI library based on trade-offs
- Faster to start, but may require later standardization

**Recommendation:** Option A (lock dependencies now) — reduces ambiguity and ensures all agents code consistently without rework.

---

## What Blocks Building?

Currently **nothing architectural** blocks building — all ADRs are locked and unambiguous. However, **project scaffolding** (package.json, TypeScript config, folder structure templates) must be done first so agents have a foundation to code against.

Once scaffolding is complete, development can proceed in parallel:

- Agent 1: Database/repo layer
- Agent 2: Auth/middleware
- Agent 3: UI components
- Agent 4: Integration adapters

---

## Checklist Summary

| Category              | Status      | Blocker?                    |
| --------------------- | ----------- | --------------------------- |
| Architecture & Design | ✅ Complete | No                          |
| Legacy Analysis       | ✅ Complete | No                          |
| Project Setup         | ⚠️ TODO     | **YES**                     |
| Database Schema       | ⚠️ TODO     | **YES**                     |
| API Design            | ⚠️ TODO     | No (can iterate in code)    |
| Components            | ⚠️ TODO     | No (after DB/API)           |
| Testing               | ⚠️ TODO     | No (scaffolding + as we go) |
| Workflow              | ⚠️ TODO     | No (nice-to-have)           |

**Critical path:**

1. Decide on dependencies (Option A or B)
2. Create package.json + tsconfig.json
3. Initialize Next.js project structure
4. Map legacy schema to new data model
5. Create database initialization script

**After critical path:** Can begin implementation with full clarity and parallel work.
