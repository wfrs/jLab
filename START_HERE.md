# START HERE - jlab Quick Navigation

## 🎯 What Do You Want to Do?

### "I'm an agent and I need to start implementing"

**→ Read [AGENT_ONBOARDING.md](AGENT_ONBOARDING.md) (5 min)**

- Step-by-step guide to your first task
- Common mistakes to avoid
- Success criteria clearly defined
- Implementation pattern reference

**Then → Read [FIRST_IMPLEMENTATION_TASK.md](FIRST_IMPLEMENTATION_TASK.md)**

- Your exact task: PlasmidRepository & PlasmidService
- Acceptance criteria with examples
- 4-6 hour estimate

---

### "I need to understand the project status"

**→ Read [PROJECT_READY.md](PROJECT_READY.md) (5 min)**

- What's complete vs pending
- Quick reference for project state
- Build commands and verification

**Also see → [FINAL_BUILD_VERIFICATION.md](FINAL_BUILD_VERIFICATION.md)**

- Complete verification results
- All build commands tested ✓
- Next steps for Phase 1

---

### "I need the big picture / architecture overview"

**→ Start with [README.md](README.md) (10 min)**

- Project overview
- Quick start
- File structure
- Tech stack

**Then → Browse [docs/decisions/](docs/decisions/)**

- 14 locked architectural decisions
- Every major choice documented with rationale
- Key reads: ADR-0005, ADR-0008, ADR-0009

---

### "I'm reviewing code / need governance rules"

**→ Read [AGENTS.md](AGENTS.md) (15 min)**

- Development principles
- Testing requirements (CRITICAL for reviews)
- Coding standards
- Security requirements
- Forbidden actions

**Checklist sections in AGENTS.md:**

- Testing Requirements - minimum tests needed
- Coding Standards - TypeScript, no magic numbers
- Security Requirements - credentials, input validation
- Forbidden Actions - what never to do

---

### "I'm a developer and need to understand the patterns"

**→ Read [src/services/README.md](src/services/README.md) (15 min)**

- Repository pattern explained
- Service layer ownership
- Transaction management
- Error handling
- Examples and code patterns

**Reference [src/services/repository.ts](src/services/repository.ts)**

- Base Repository<T> class you'll extend
- All generic methods defined
- Usage examples in comments

---

### "I need to know what GMOCU is and what features to build"

**→ Read [docs/legacy-analysis/feature-inventory.md](docs/legacy-analysis/feature-inventory.md)**

- Every GMOCU feature listed with P0/P1 priority
- What must be preserved
- What's optional in Phase 1

**Also see:**

- [docs/legacy-analysis/user-workflows.md](docs/legacy-analysis/user-workflows.md) - How users interact
- [docs/legacy-analysis/modern-replacement-proposal.md](docs/legacy-analysis/modern-replacement-proposal.md) - How we're rebuilding it

---

### "I'm interested in UI/UX"

**→ Read [docs/architecture/ui-ux-direction.md](docs/architecture/ui-ux-direction.md)**

- UI/UX strategy determined in user interview
- Spreadsheet-first layout approach
- Design patterns to follow

**Note:** Design review skill (apple-design-skill) is installed

- See AGENTS.md section on design review workflow
- Required before UI component PR merge

---

### "I need the complete database schema"

**→ Read [docs/plans/DATABASE_SCHEMA_MIGRATION.md](docs/plans/DATABASE_SCHEMA_MIGRATION.md)**

- All 8 tables with columns and types
- Relationships and foreign keys
- Indexes and constraints
- Sample queries

---

### "I need to understand what was fixed / what happened last"

**→ Read [SESSION_SUMMARY.md](SESSION_SUMMARY.md) (5 min)**

- What was accomplished in final session
- 11 TypeScript errors fixed
- All build commands verified working

**Technical detail → [TYPESCRIPT_FIXES.md](TYPESCRIPT_FIXES.md)**

- Detailed breakdown of each fix
- Before/after code snippets
- Rationale for each change

---

### "I need a complete overview of what was delivered"

**→ Read [DELIVERY_SUMMARY.md](DELIVERY_SUMMARY.md) (10 min)**

- What was delivered vs original request
- Complete documentation structure
- Code production-readiness status
- How to use all deliverables

---

## 🗂️ File Quick Reference

| File                                                                               | What's It For                               | Read Time  |
| ---------------------------------------------------------------------------------- | ------------------------------------------- | ---------- |
| [README.md](README.md)                                                             | Project overview, quick start, tech stack   | 5 min      |
| [AGENT_ONBOARDING.md](AGENT_ONBOARDING.md)                                         | Step-by-step guide for agents to start work | 10 min     |
| [AGENTS.md](AGENTS.md)                                                             | Governance, rules, requirements (MUST READ) | 15 min     |
| [FIRST_IMPLEMENTATION_TASK.md](FIRST_IMPLEMENTATION_TASK.md)                       | Your first task with acceptance criteria    | 10 min     |
| [PROJECT_READY.md](PROJECT_READY.md)                                               | What's ready, what's next, quick status     | 5 min      |
| [FINAL_BUILD_VERIFICATION.md](FINAL_BUILD_VERIFICATION.md)                         | Complete build verification results         | 10 min     |
| [SESSION_SUMMARY.md](SESSION_SUMMARY.md)                                           | What was fixed this session                 | 5 min      |
| [TYPESCRIPT_FIXES.md](TYPESCRIPT_FIXES.md)                                         | Technical fixes applied                     | 5 min      |
| [DELIVERY_SUMMARY.md](DELIVERY_SUMMARY.md)                                         | Complete delivery overview                  | 10 min     |
| [docs/decisions/ADR-*.md](docs/decisions/)                                         | Architecture decisions (all locked)         | 5 min each |
| [docs/legacy-analysis/](docs/legacy-analysis/)                                     | Feature inventory, workflows, analysis      | 10-15 min  |
| [docs/plans/DATABASE_SCHEMA_MIGRATION.md](docs/plans/DATABASE_SCHEMA_MIGRATION.md) | Complete database schema                    | 10 min     |
| [src/services/README.md](src/services/README.md)                                   | Repository pattern documentation            | 15 min     |
| [src/services/repository.ts](src/services/repository.ts)                           | Base class to extend                        | Reference  |
| [docs/architecture/ui-ux-direction.md](docs/architecture/ui-ux-direction.md)       | UI/UX strategy                              | 10 min     |

---

## ⚡ Quick Command Reference

```bash
# Development
npm run dev                     # Start dev server (http://localhost:3000)

# Testing
npm run test                    # Run all tests (7 tests passing)
npm run test:watch            # Watch mode

# Code Quality
npm run type-check            # TypeScript check (0 errors)
npm run lint                  # ESLint + Prettier check
npm run lint:fix              # Auto-fix issues

# Database
npm run db:init               # Initialize schema
npm run db:seed               # Load sample data

# Build
npm run build                 # Production build
npm start                     # Run production build
```

---

## 🎯 For Different Roles

### Implementation Agent

1. [AGENT_ONBOARDING.md](AGENT_ONBOARDING.md) (this turn)
2. [AGENTS.md](AGENTS.md) (governance)
3. [FIRST_IMPLEMENTATION_TASK.md](FIRST_IMPLEMENTATION_TASK.md) (your task)
4. Start coding!

### Code Reviewer

1. [AGENTS.md](AGENTS.md) (Testing Requirements section)
2. Check: tests passing, no TypeScript errors, parity documented
3. Review against governance rules

### Architect / Tech Lead

1. [docs/decisions/](docs/decisions/) (14 ADRs, all locked)
2. [FINAL_BUILD_VERIFICATION.md](FINAL_BUILD_VERIFICATION.md) (verification results)
3. [AGENTS.md](AGENTS.md) (governance overview)

### Designer

1. [docs/architecture/ui-ux-direction.md](docs/architecture/ui-ux-direction.md)
2. [apple-design-skill](AGENTS.md) (integrated for design review)
3. Coordinate with dev team before UI PRs

### Project Manager

1. [PROJECT_READY.md](PROJECT_READY.md) (current status)
2. [DELIVERY_SUMMARY.md](DELIVERY_SUMMARY.md) (what's been delivered)
3. [FIRST_IMPLEMENTATION_TASK.md](FIRST_IMPLEMENTATION_TASK.md) (next task to assign)

---

## ✅ Verification Checklist

Before starting work:

- [ ] Read AGENTS.md (governance rules)
- [ ] Read AGENT_ONBOARDING.md or role-specific guide
- [ ] Ran `npm install` (dependencies installed)
- [ ] Ran `npm run type-check` (0 TypeScript errors)
- [ ] Ran `npm run test` (7 tests passing)
- [ ] Ran `npm run db:init` (database working)
- [ ] Ran `npm run dev` (dev server starts)
- [ ] Ready to implement!

---

## 🚀 Status

**Project: PRODUCTION-READY FOR IMPLEMENTATION**

All infrastructure built ✓
All patterns established ✓
All decisions locked ✓
All tests passing ✓
Build pipeline verified ✓

**Next: Assign Phase 1 tasks**

---

## Questions?

| Question                              | Where to Find Answer                                                                   |
| ------------------------------------- | -------------------------------------------------------------------------------------- |
| What should I build?                  | [FIRST_IMPLEMENTATION_TASK.md](FIRST_IMPLEMENTATION_TASK.md)                           |
| How do I build it?                    | [AGENT_ONBOARDING.md](AGENT_ONBOARDING.md)                                             |
| What are the rules?                   | [AGENTS.md](AGENTS.md)                                                                 |
| What's the architecture?              | [docs/decisions/](docs/decisions/)                                                     |
| What's the pattern for this?          | [src/services/README.md](src/services/README.md)                                       |
| What legacy features must I preserve? | [docs/legacy-analysis/feature-inventory.md](docs/legacy-analysis/feature-inventory.md) |
| What's the database schema?           | [docs/plans/DATABASE_SCHEMA_MIGRATION.md](docs/plans/DATABASE_SCHEMA_MIGRATION.md)     |
| What UI/UX strategy?                  | [docs/architecture/ui-ux-direction.md](docs/architecture/ui-ux-direction.md)           |
| What was just fixed?                  | [SESSION_SUMMARY.md](SESSION_SUMMARY.md)                                               |
| What's the big picture?               | [DELIVERY_SUMMARY.md](DELIVERY_SUMMARY.md)                                             |

---

**Ready to get started? Pick your role above and follow the links!**
