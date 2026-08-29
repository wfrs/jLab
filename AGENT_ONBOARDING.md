# jlab - Agent Onboarding Guide

**For agents launching Phase 1 implementation**

---

## 🚀 You Are Here

The jlab project is **production-ready for implementation**. All infrastructure is built, all patterns are documented, all decisions are locked.

Your job: **Build the domain layer following established patterns.**

---

## 📋 Essential Reading (Complete These First)

### 1. Governance & Rules (10 min)

- **File:** [AGENTS.md](../AGENTS.md)
- **What you'll learn:** Development principles, testing requirements, security rules, forbidden actions
- **Why it matters:** Violating these rules will cause PR rejection
- **Key sections:** Development Principles, Testing Requirements, Coding Standards

### 2. Architecture Decisions (15 min)

- **Files:** [docs/decisions/ADR-*.md](../docs/decisions/)
- **Critical reads:**
  - ADR-0005: Data Access Pattern (Repository + Services + Transactions)
  - ADR-0008: Error Handling & API Envelopes
  - ADR-0009: Parity-First Migration Strategy
  - ADR-0002: Architecture layers
- **Why it matters:** These lock all technical decisions - no debate needed

### 3. Your First Task (5 min)

- **File:** [FIRST_IMPLEMENTATION_TASK.md](../FIRST_IMPLEMENTATION_TASK.md)
- **What you'll build:** PlasmidRepository & PlasmidService + tests
- **Acceptance criteria:** Clearly defined with acceptance checklist
- **How long:** 4-6 hours for experienced developer

---

## 💾 Before You Code: Understand the Foundation

### Database Schema

- **File:** [docs/plans/DATABASE_SCHEMA_MIGRATION.md](../docs/plans/DATABASE_SCHEMA_MIGRATION.md)
- **What it is:** Complete SQL schema with all tables, columns, types
- **Read this because:** You need to know what fields you're querying

### Repository Pattern

- **File:** [src/services/README.md](../src/services/README.md)
- **What it explains:** How repositories work, how services own transactions, error handling
- **Read this because:** You'll extend Repository<T> for PlasmidRepository
- **Reference:** [src/services/repository.ts](../src/services/repository.ts) (base class)

### Service Layer Ownership

- **File:** [ADR-0013](../docs/decisions/ADR-0013-service-ownership.md)
- **Key rule:** Services own transactions, repositories never do
- **Read this because:** Many developers get this wrong - it matters

### Legacy Features to Preserve

- **File:** [docs/legacy-analysis/feature-inventory.md](../docs/legacy-analysis/feature-inventory.md)
- **What it is:** Complete list of GMOCU features with P0/P1 categorization
- **Read this because:** You must verify your implementation matches original behavior
- **Parity verification:** See [docs/plans/PRE_IMPLEMENTATION_CHECKLIST.md](../docs/plans/PRE_IMPLEMENTATION_CHECKLIST.md)

---

## 🔨 Let's Build: Step-by-Step

### Step 1: Create PlasmidRepository (1-2 hours)

**File:** `src/services/plasmid.repository.ts`

```typescript
import { Repository } from './repository';
import { Plasmid } from '@domain/types';
import { getQueryBuilder } from '@infrastructure/query-builder';
import { Logger } from '@infrastructure/logger';

export class PlasmidRepository extends Repository<Plasmid> {
  constructor(logger?: Logger) {
    super(getQueryBuilder(), 'plasmids', { logger });
  }

  async getByProject(projectId: string): Promise<Plasmid[]> {
    this.logger.info('PlasmidRepository.getByProject', { projectId });
    return this.getAll({ project_id: projectId });
  }

  // ... implement all methods from FIRST_IMPLEMENTATION_TASK.md
}
```

**Checklist:**

- [ ] Extends Repository<Plasmid>
- [ ] All methods typed with proper returns
- [ ] All operations logged with correlationId
- [ ] Proper error handling
- [ ] No raw SQL
- [ ] No transaction management (that's the service's job)
- [ ] Types imported correctly

### Step 2: Create PlasmidService (1 hour)

**File:** `src/services/plasmid.service.ts`

```typescript
import { PlasmidRepository } from './plasmid.repository';
import { Plasmid, DomainError } from '@domain/types';
import { Logger } from '@infrastructure/logger';
import { getDatabase } from '@infrastructure/database';

export class PlasmidService {
  private repository: PlasmidRepository;
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger || new Logger();
    this.repository = new PlasmidRepository(this.logger);
  }

  async createPlasmid(projectId: string, data: CreatePlasmidInput): Promise<Plasmid> {
    // Validate domain invariants
    // Own the transaction
    // Call repository
    // Return result or throw DomainError
  }

  private async withTransaction<T>(callback: () => Promise<T>): Promise<T> {
    // Transaction management - start/commit/rollback
    // This is the SERVICE's job, not the repository's
  }
}
```

**Checklist:**

- [ ] Validates domain invariants
- [ ] Owns all transactions
- [ ] Calls repository methods
- [ ] Returns typed results
- [ ] Throws DomainError on failure (never returns null for errors)
- [ ] All operations logged

### Step 3: Write Integration Tests (1-2 hours)

**Files:**

- `tests/integration/plasmid.repository.test.ts`
- `tests/integration/plasmid.service.test.ts`

**Important:** Use real database (in-memory SQLite), NOT mocks

```typescript
import { PlasmidRepository } from '@services/plasmid.repository';
import { getDatabase } from '@infrastructure/database';
import { initSchema } from '@infrastructure/database';

describe('PlasmidRepository (Integration)', () => {
  let repository: PlasmidRepository;
  let db: any;

  beforeAll(async () => {
    db = getDatabase();
    await initSchema(db);
  });

  beforeEach(async () => {
    await db('plasmids').del();
  });

  it('should create and retrieve a plasmid', async () => {
    const data = {/* ... */};
    const created = await repository.create(data);
    expect(created.id).toBeDefined();
  });

  // ... more tests
});
```

**Checklist:**

- [ ] Tests use real database
- [ ] Schema initialized in beforeAll
- [ ] Database cleaned in beforeEach
- [ ] All CRUD operations tested
- [ ] Error cases tested
- [ ] Parity with legacy behavior documented

### Step 4: Document Parity (30 min)

**File:** `docs/plans/parity-evidence/plasmid-parity.md`

```markdown
# Plasmid Feature Parity

## Legacy Features Preserved

| Feature        | Legacy Behavior                  | New Implementation             | Status     |
| -------------- | -------------------------------- | ------------------------------ | ---------- |
| Create plasmid | Creates record with name, status | PlasmidService.createPlasmid() | ✓ Verified |
| ...            | ...                              | ...                            | ...        |

## Testing Evidence

- Unit tests: ...
- Integration tests: ...
- Manual testing: ...
```

**Checklist:**

- [ ] All legacy features listed
- [ ] How each is tested documented
- [ ] Any behavior changes justified
- [ ] Reference tests by file & line

---

## 🧪 Verification Before PR

```bash
# Type checking
npm run type-check
# Should output: 0 errors

# Linting & formatting
npm run lint
# Should output: No issues found

# All tests
npm run test
# Should show: All tests passing

# Database still works
npm run db:init
npm run db:seed
# Should show: Sample data loaded

# Production build
npm run build
# Should create: .next/ folder
```

---

## 🚨 Common Mistakes (Don't Do These)

### ❌ Raw SQL

```typescript
// WRONG ❌
const result = await db.raw('SELECT * FROM plasmids WHERE id = ?', [id]);

// CORRECT ✓
const result = await qb('plasmids').where('id', id).first();
```

### ❌ Repository manages transactions

```typescript
// WRONG ❌
export class PlasmidRepository {
  async create(data) {
    const trx = await db.transaction();
    // ... this is the SERVICE's job!
  }
}

// CORRECT ✓
export class PlasmidService {
  async createPlasmid(data) {
    return this.withTransaction(async () => {
      return this.repository.create(data);
    });
  }
}
```

### ❌ Swallowing errors

```typescript
// WRONG ❌
try {
  return await this.repository.getById(id);
} catch {
  return null; // Lost error context!
}

// CORRECT ✓
try {
  return await this.repository.getById(id);
} catch (error) {
  throw new DomainError('DATABASE', 'Failed to retrieve plasmid', { cause: error });
}
```

### ❌ No logging

```typescript
// WRONG ❌
async getById(id: string) {
  return qb('plasmids').where('id', id).first();
}

// CORRECT ✓
async getById(id: string) {
  this.logger.info('PlasmidRepository.getById', { id });
  return qb('plasmids').where('id', id).first();
}
```

### ❌ Mocking the database in tests

```typescript
// WRONG ❌
jest.mock('@infrastructure/database');
// Now your test doesn't actually test database behavior!

// CORRECT ✓
// Use real in-memory SQLite database
const db = getDatabase(':memory:');
await initSchema(db);
```

---

## 📚 File Reference Guide

### Infrastructure (Already Built - Just Use)

- `src/infrastructure/database.ts` - Database connection & schema init
- `src/infrastructure/query-builder.ts` - Knex initialization
- `src/infrastructure/logger.ts` - Structured logging
- `src/domain/types.ts` - All entity types

### Patterns (Follow These)

- `src/services/repository.ts` - Base Repository<T> class
- `src/services/README.md` - Pattern explanation
- `tests/unit/repository.test.ts` - How to test repositories

### Legacy Reference

- `docs/legacy-analysis/feature-inventory.md` - What to build
- `docs/legacy-analysis/user-workflows.md` - How it's used
- `gmocu/` - Original code (read-only reference)

### Rules & Decisions

- `AGENTS.md` - All governance
- `docs/decisions/ADR-*.md` - Architecture decisions
- `FIRST_IMPLEMENTATION_TASK.md` - This task's requirements

---

## 🎯 Success Criteria

Your PR should have:

1. ✅ PlasmidRepository fully implemented
2. ✅ PlasmidService fully implemented
3. ✅ Integration tests (7-10 tests minimum)
4. ✅ Parity evidence documented
5. ✅ All tests passing
6. ✅ Zero TypeScript errors
7. ✅ Code formatted (prettier)
8. ✅ Clear commit message

When all of these are true, you're ready for PR review.

---

## 💬 Questions? Start Here

| Question                                      | Answer                                                   |
| --------------------------------------------- | -------------------------------------------------------- |
| What should the repository pattern look like? | Read `src/services/README.md`                            |
| How do I handle transactions?                 | Read `ADR-0013` and see PlasmidService pattern           |
| What are the database tables?                 | See `docs/plans/DATABASE_SCHEMA_MIGRATION.md`            |
| How do I log correctly?                       | See `src/infrastructure/logger.ts`                       |
| What are the legacy plasmid features?         | See `docs/legacy-analysis/feature-inventory.md`          |
| What error handling should I use?             | See `ADR-0008` and `src/domain/errors.ts`                |
| How do I write tests?                         | See `tests/unit/repository.test.ts` (reference, pattern) |
| What's forbidden?                             | See `AGENTS.md` (Forbidden Actions section)              |

---

## 🏁 Ready to Start?

1. ✅ Read AGENTS.md
2. ✅ Read FIRST_IMPLEMENTATION_TASK.md
3. ✅ Read src/services/README.md
4. ✅ Check docs/plans/DATABASE_SCHEMA_MIGRATION.md
5. ✅ Create src/services/plasmid.repository.ts
6. ✅ Run `npm run test` to verify pattern
7. ✅ Create src/services/plasmid.service.ts
8. ✅ Write integration tests
9. ✅ Document parity
10. ✅ Run full verification (`npm run type-check && npm run lint && npm run test`)
11. ✅ Create PR with evidence

**Estimated time: 4-6 hours**

Good luck! 🚀
