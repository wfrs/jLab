# Dependency Decisions for GMOCU Rebuild

This document captures the critical dependency choices that will shape development velocity and maintainability.

---

## Overview

We need to make 8-10 key decisions before initializing package.json. This document presents trade-offs for each so you (the user) can decide strategically upfront rather than agents deciding case-by-case during implementation.

---

## 1. Query Builder Library

**ADR-0005 constraint:** Query builder (not raw SQL, not heavy ORM)

**Candidates:**

### Option A: `better-sqlite3` + raw SQL builders

- **Pros:** Lightweight, direct SQL, fast for SQLite, minimal dependencies
- **Cons:** Manual SQL string building, requires schema knowledge
- **Example:** `db.exec("SELECT * FROM plasmids WHERE id = ?", [id])`
- **Agents will:** Write schema-aware query helpers

### Option B: `knex.js` (query builder)

- **Pros:** SQL-agnostic, queryBuilder API is readable, well-documented, industry-standard
- **Cons:** Larger dependency, slight performance overhead
- **Example:** `knex('plasmids').where('id', id).first()`
- **Agents will:** Use knex query methods consistently

### Option C: `prisma` (ORM)

- **Pro:** Type-safe, strong schema validation
- **Con:** ADR-0005 explicitly rejects ORMs (too much abstraction, harder to optimize queries)
- **Decision:** ❌ Not allowed

### Option D: `d1` / Native SQLite

- **Pros:** Minimal overhead, SQLite-native
- **Cons:** Requires careful parameterization
- **Example:** `db.prepare("SELECT * FROM plasmids WHERE id = ?").get(id)`
- **Agents will:** Write parameterized statements carefully

**Recommendation:** **Option B (knex.js)**

- Balances readability, safety, and flexibility
- Industry-standard means better patterns and tooling
- Easy to add raw SQL fallback when needed
- Great for CQRS-lite reporting (ADR-0005 concern)

---

## 2. Testing Framework

**ADR-0004, ADR-0005 constraint:** Comprehensive test coverage (unit + integration + parity)

**Candidates:**

### Option A: Jest + React Testing Library

- **Pros:** Industry standard, great TypeScript support, fast, built-in mocking
- **Cons:** Jest is slower than alternatives for large projects
- **Agents will:** Write tests with React Testing Library best practices

### Option B: Vitest + React Testing Library

- **Pros:** Fast (Vite-based), Vitest-first ergonomics, same API as Jest
- **Cons:** Newer, smaller ecosystem
- **Agents will:** Write tests with same patterns as Jest

### Option C: Mocha + Chai (lighter)

- **Pros:** Lightweight, minimal boilerplate
- **Cons:** Needs extra setup for assertions, mocking, coverage
- **Agents will:** Add multiple companion tools

**Recommendation:** **Option A (Jest + React Testing Library)**

- Mature ecosystem
- Great test isolation for React components
- Built-in coverage reporting
- No additional tools needed

---

## 3. UI Component Library

**AGENTS.md constraint:** Accessibility-first, HIG-compliant, React + TypeScript

**Candidates:**

### Option A: shadcn/ui (headless components)

- **Pros:** Copy-paste customizable, Radix UI foundation (accessible), Tailwind-based, no lock-in
- **Cons:** Requires Tailwind, more manual work than premade themes
- **Agents will:** Copy components from shadcn registry and customize

### Option B: Headless UI + Tailwind

- **Pros:** Accessible, minimal styling, lightweight
- **Cons:** Fewer pre-built components, more work
- **Agents will:** Build custom components from scratch

### Option C: Material-UI (MUI)

- **Pros:** Rich component library, accessibility built-in
- **Cons:** Heavy bundle, less customizable, less control
- **Agents will:** Use MUI components directly, limited customization

### Option D: No library, custom Tailwind

- **Pros:** Maximum control, lightweight
- **Cons:** Rebuilds common patterns (bad for parity speed)
- **Agents will:** Write accessibility helpers repeatedly

**Recommendation:** **Option A (shadcn/ui + Tailwind CSS)**

- Balances accessibility (Radix UI foundation), customization, and speed
- Copy-paste model makes it easy to audit against HIG (apple-design-skill)
- Lightweight (only what you use is bundled)
- Great for spreadsheet-first UI (tables, forms, detail panels)

---

## 4. Validation Library

**ADR-0007 constraint:** Three-layer validation (API boundary → domain invariants → adapter payloads)

**Candidates:**

### Option A: Zod

- **Pros:** TypeScript-first, great DX, chain-able schema API, small bundle
- **Cons:** Runtime overhead for complex schemas
- **Example:** `const PlasmidSchema = z.object({ id: z.string(), name: z.string().min(1) })`
- **Agents will:** Use Zod for all input validation

### Option B: Valibot

- **Pros:** Smaller bundle than Zod, TypeScript-first
- **Cons:** Newer, smaller community
- **Agents will:** Write validation schemas with Valibot

### Option C: Joi / Yup

- **Pros:** Mature, flexible
- **Cons:** Larger bundle, less TypeScript-native
- **Agents will:** Use class-based schemas

**Recommendation:** **Option A (Zod)**

- Best TypeScript DX
- Perfect for strict typing requirement (AGENTS.md)
- Lightweight
- Great for both API schemas and domain invariants

---

## 5. Logging & Diagnostics

**ADR-0008 constraint:** JSON structured logs with correlation ID propagation, centralized redaction

**Candidates:**

### Option A: `pino`

- **Pros:** Fast JSON logging, built-in child logger pattern (correlation IDs), streaming-first
- **Cons:** Requires transport setup for log output
- **Example:** `logger.info({ correlationId, operation }, "Plasmid read")`
- **Agents will:** Use pino child loggers for context propagation

### Option B: `winston`

- **Pros:** Flexible, multiple transports, mature
- **Cons:** Larger bundle, more configuration
- **Agents will:** Use winston with transports

### Option C: `bunyan`

- **Pros:** Simple JSON logging
- **Cons:** Less active maintenance
- **Agents will:** Use bunyan serializers

**Recommendation:** **Option A (pino)**

- Fastest JSON logger
- Child logger pattern is perfect for correlation IDs (ADR-0008 requirement)
- Minimal overhead

---

## 6. HTTP Client for Integrations

**ADR-0006 constraint:** Adapter pattern with concrete timeouts (10s reads, 20s writes, 60s uploads), 2 retries, exponential backoff

**Candidates:**

### Option A: `axios` + `axios-retry`

- **Pros:** Feature-rich, easy retry/timeout configuration, mature
- **Cons:** Larger bundle
- **Example:** `axios.get(url, { timeout: 10000 })`
- **Agents will:** Configure retry logic per adapter

### Option B: native `fetch` + custom retry

- **Pros:** No dependency, built-in to modern Node/browsers
- **Cons:** No built-in retry/timeout, requires wrapper
- **Example:** Custom `fetchWithRetry()` helper
- **Agents will:** Write retry wrapper once, reuse

### Option C: `undici`

- **Pros:** Modern, no dependencies, Node-native
- **Cons:** Newer, fewer examples
- **Agents will:** Use undici timeout/retry patterns

**Recommendation:** **Option B (native fetch + custom retry helper)**

- No extra dependency
- Forces discipline: one retry helper in shared kernel (ADR-0003)
- Perfect for timeout defaults in ADR-0006
- Agents will create reusable helper pattern

---

## 7. Database Driver

**Project constraint:** SQLite local-first phase 1, potential multi-user phase 2

**Candidates:**

### Option A: `better-sqlite3`

- **Pros:** Synchronous, fastest, great for development, desktop-app-like feel
- **Cons:** Not ideal for multi-user/concurrent scenarios (phase 2 blocker)
- **Agents will:** Use synchronous queries

### Option B: `sqlite3` (async)

- **Pros:** Async-first, easier transition to phase 2 (multi-user)
- **Cons:** More complex error handling, callback-style (or promisify)
- **Agents will:** Use async queries, better for scalability

### Option C: `sql.js` (in-memory)

- **Pros:** No external dependency, fast for development
- **Cons:** Not persistent without save logic, not for production

**Recommendation:** **Option B (sqlite3 async)**

- Phase 1 = local-first, but async patterns prepare for phase 2 multi-user
- Better for concurrent access later (no migration to async needed)
- Slightly more complex now, but future-proof

---

## 8. Environment Configuration

**Security constraint (AGENTS.md):** No secrets in source, validation at startup

**Candidates:**

### Option A: dotenv + typed schema validation

- **Pros:** Simple, familiar, pairs well with Zod for validation
- **Cons:** Easy to forget to .gitignore
- **Agents will:** Create .env.example + validation at app startup

### Option B: Env validation library (e.g., `t3-env`)

- **Pros:** Type-safe env vars, fails fast at startup
- **Cons:** Small additional dependency
- **Agents will:** Define env schema once, use typed accessors

**Recommendation:** **Option A (dotenv + Zod validation)**

- Combine dotenv for loading + Zod for schema validation
- Fail fast at startup (ADR-0008 requirement for diagnostics)
- Simple, no extra dependencies

---

## 9. TypeScript & Build

**AGENTS.md constraint:** Strict mode, no compiler warnings

**Candidates:**

### TypeScript version

- **Recommendation:** Latest stable (5.x)
- **Config:** `strict: true`, `noUnusedLocals: true`, `noUnusedParameters: true`, `exactOptionalPropertyTypes: true`

### Build tool

- **Recommendation:** Next.js built-in (no separate bundler)
- **Rationale:** ADR-0001 locks Next.js; no need for separate Webpack/Vite

### Linting

- **Recommendation:** ESLint (latest config) + Prettier
- **Config:** Strict TypeScript rules, no `any`, no `@ts-ignore` without justification

---

## 10. Optional: Database Migrations

**ADR-0009 constraint:** Reversible, parity-first, automated tests for migrations

**Candidates:**

### Option A: `better-sqlite3` + manual migration scripts

- **Pros:** Simple, explicit, minimal dependencies
- **Cons:** Manual error handling, no built-in state tracking
- **Agents will:** Write `.up.sql` and `.down.sql` scripts

### Option B: `knex.js` migrations

- **Pros:** Built-in state tracking, rollback support, pairs well with query builder choice (Option B)
- **Cons:** Additional complexity
- **Agents will:** Use knex migration CLI

### Option C: No migrations, manual DDL + initialization

- **Pros:** Simplest for phase 1 (single-user, local-first)
- **Cons:** No rollback, fragile for phase 2
- **Agents will:** Hand-edit schema, risk losing data

**Recommendation:** **Option B (knex.js migrations)**

- Pairs with knex.js (if you choose Option B for query builder)
- State tracking prevents migration corruption
- Reversibility supports parity testing (ADR-0009)

---

## Summary: Recommended Stack

| Category            | Choice                       | Rationale                                            |
| ------------------- | ---------------------------- | ---------------------------------------------------- |
| **Query Builder**   | knex.js                      | SQL-readable, industry standard, reporting-friendly  |
| **Testing**         | Jest + React Testing Library | Mature, fast, built-in mocking                       |
| **UI Components**   | shadcn/ui + Tailwind         | Accessible, customizable, lightweight                |
| **Validation**      | Zod                          | TypeScript-first, great DX, small bundle             |
| **Logging**         | pino                         | Fastest JSON logger, correlation ID pattern built-in |
| **HTTP Client**     | fetch + custom retry         | No dependency, reusable helper pattern               |
| **Database Driver** | sqlite3 (async)              | Async-first, phase 2 ready                           |
| **Build**           | Next.js (built-in)           | No extra bundler needed                              |
| **Migrations**      | knex.js                      | State tracking + reversibility                       |
| **Environment**     | dotenv + Zod                 | Simple + type-safe                                   |
| **Linting**         | ESLint + Prettier            | Strict TypeScript enforcement                        |
| **TypeScript**      | 5.x strict mode              | No compromises on type safety                        |

---

## Your Decision: Lock These Now or Defer?

### Option A: Lock Now

- Create `package.json` with all versions pinned
- Create `tsconfig.json` and `.eslintrc` now
- All agents build against the same foundation
- More setup upfront, zero ambiguity

### Option B: Lock During First Implementation Sprint

- Leave query builder/UI library as "TBD"
- First agent decides based on deep analysis
- More flexibility, but risk of misalignment

**Strong recommendation:** **Option A (Lock Now)**

Reason: GMOCU is complex (integrations, parity, strict typing, accessibility). Having identical tooling across all agents eliminates rework and ensures consistency. The 30 minutes to decide now saves hours of rework later.

---

## Next Steps

1. Review recommendations above
2. Confirm choices (override any if desired)
3. I'll create `package.json` + `tsconfig.json` + `.eslintrc` using your choices
4. Initialize Next.js scaffolding
5. Code can begin
