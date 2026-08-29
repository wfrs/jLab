# jlab - First Implementation Task

**Status: Ready to Assign**
**Estimated Duration: 4-6 hours**
**Difficulty: Medium (following established patterns)**

---

## Task: Implement PlasmidRepository & PlasmidService

### Objective

Implement the data access layer for the core `Plasmid` entity, establishing the repository pattern that all other entities will follow. This is the foundation for Phase 1 implementation.

### What You Will Build

1. **PlasmidRepository** - Data access object for plasmid queries
2. **PlasmidService** - Business logic orchestrator with transaction management
3. **Integration Tests** - Verify database operations match legacy GMOCU behavior
4. **Parity Evidence** - Document that legacy behavior is preserved

### Prerequisites

- Read: `AGENTS.md` (sections: Development Principles, Architecture Rules, Coding Standards)
- Read: `docs/decisions/ADR-0005-data-implementation-strategy.md` (repository pattern)
- Read: `docs/decisions/ADR-0002-data-access-pattern.md` (service orchestration)
- Read: `docs/plans/DATABASE_SCHEMA_MIGRATION.md` (full schema reference)
- Reference: `src/services/README.md` (Repository pattern explanation)
- Reference: `docs/legacy-analysis/feature-inventory.md` (what Plasmid should do)

### Acceptance Criteria

#### 1. PlasmidRepository Implementation

Location: `src/services/plasmid.repository.ts`

Methods to implement (minimum):

- `getById(id: string): Promise<Plasmid | null>`
- `getByProject(projectId: string): Promise<Plasmid[]>`
- `getAll(): Promise<Plasmid[]>`
- `search(query: string): Promise<Plasmid[]>`
- `paginatedList(limit: number, offset: number): Promise<{data: Plasmid[], total: number}>`
- `create(data: CreatePlasmidInput): Promise<Plasmid>`
- `update(id: string, updates: UpdatePlasmidInput): Promise<Plasmid>`
- `delete(id: string): Promise<void>`
- `count(): Promise<number>`

Requirements:

- ✓ Extend `Repository<Plasmid>`
- ✓ Use knex query builder (NO raw SQL)
- ✓ All methods logged with correlationId
- ✓ Proper error handling with typed errors
- ✓ Type-safe queries (no `any` types)

#### 2. PlasmidService Implementation

Location: `src/services/plasmid.service.ts`

Methods to implement (minimum):

- `createPlasmid(projectId: string, data: CreatePlasmidInput): Promise<Plasmid>`
- `updatePlasmid(id: string, updates: UpdatePlasmidInput): Promise<Plasmid>`
- `deletePlasmid(id: string): Promise<void>`
- `getPlasmid(id: string): Promise<Plasmid | null>`
- `listProjectPlasmids(projectId: string): Promise<Plasmid[]>`

Requirements:

- ✓ Owns all database transactions
- ✓ Validates domain invariants (e.g., plasmid name required, status valid)
- ✓ Returns typed results or throws DomainError
- ✓ All operations logged
- ✓ Structured error messages for clients

#### 3. Integration Tests

Location: `tests/integration/plasmid.repository.test.ts` and `tests/integration/plasmid.service.test.ts`

Test coverage minimum:

- Repository CRUD operations with real database
- Service domain validation
- Transaction rollback on error
- Parity with legacy GMOCU queries

Requirements:

- ✓ Use in-memory SQLite (`:memory:`)
- ✓ Run schema initialization in beforeAll()
- ✓ Clean database in beforeEach()
- ✓ No mocking (real database operations)
- ✓ Tests in beforeAll/beforeEach/afterEach pattern

#### 4. Parity Verification

File: `docs/plans/parity-evidence/plasmid-parity.md`

Document:

- [ ] List of legacy GMOCU plasmid features
- [ ] For each feature: How it's tested in new codebase
- [ ] Any behavior changes (with justification)
- [ ] Known limitations vs legacy version

Reference: `docs/plans/PRE_IMPLEMENTATION_CHECKLIST.md` (Parity Gate Checklist)

### Implementation Pattern Reference

```typescript
// In src/services/plasmid.repository.ts

import { Repository } from './repository';
import { Plasmid } from '@domain/types';
import { getQueryBuilder } from '@infrastructure/query-builder';
import { Logger, LogContext } from '@infrastructure/logger';

export class PlasmidRepository extends Repository<Plasmid> {
  constructor(logger?: Logger, context?: LogContext) {
    super(getQueryBuilder(), 'plasmids', { logger, ...context });
  }

  async getByProject(projectId: string): Promise<Plasmid[]> {
    this.logger.info('PlasmidRepository.getByProject', { projectId });
    return this.getAll({ project_id: projectId });
  }

  // ... other methods following this pattern
}
```

```typescript
// In src/services/plasmid.service.ts

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
    this.logger.info('PlasmidService.createPlasmid', { projectId });

    // Validate domain invariants
    if (!data.name) {
      throw new DomainError('VALIDATION', 'Plasmid name is required');
    }
    if (!data.status || !['draft', 'validated', 'archived'].includes(data.status)) {
      throw new DomainError('VALIDATION', 'Invalid plasmid status');
    }

    // Transaction handles rollback on error
    return this.withTransaction(async (trx) => {
      return this.repository.create({
        project_id: projectId,
        ...data,
      });
    });
  }

  private async withTransaction<T>(callback: () => Promise<T>): Promise<T> {
    const db = getDatabase();
    const trx = await db.transaction();
    try {
      const result = await callback();
      await trx.commit();
      return result;
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }
}
```

### Test Example Pattern

```typescript
// tests/integration/plasmid.repository.test.ts

import { PlasmidRepository } from '@services/plasmid.repository';
import { getDatabase } from '@infrastructure/database';
import { getQueryBuilder } from '@infrastructure/query-builder';

describe('PlasmidRepository (Integration)', () => {
  let repository: PlasmidRepository;
  let db: any;

  beforeAll(async () => {
    // Initialize test database
    db = getDatabase();
    await initSchema(db); // Run schema creation
  });

  beforeEach(async () => {
    // Clear data between tests
    await db('plasmids').del();
  });

  it('should create and retrieve a plasmid', async () => {
    const data = {
      id: 'test-plasmid',
      name: 'Test Plasmid',
      status: 'draft' as const,
    };

    const created = await repository.create(data);
    expect(created.id).toBe('test-plasmid');

    const retrieved = await repository.getById('test-plasmid');
    expect(retrieved?.name).toBe('Test Plasmid');
  });

  // ... more tests
});
```

### Non-Negotiable Rules (From AGENTS.md)

1. **No raw SQL** - Use knex query builder only
2. **Services own transactions** - Repositories never manage transactions
3. **Structured logging** - Every operation logged with correlationId
4. **Three-layer validation** - API boundary → domain invariants → adapter payloads
5. **Error handling** - Return typed errors, never swallow exceptions
6. **Type safety** - No `any` types, strict TypeScript
7. **Testing** - Unit tests for logic, integration tests for database
8. **Documentation** - Update README.md, add parity evidence

### Deliverables Checklist

- [ ] `src/services/plasmid.repository.ts` - Implementation complete
- [ ] `src/services/plasmid.service.ts` - Implementation complete
- [ ] `tests/integration/plasmid.repository.test.ts` - All tests passing
- [ ] `tests/integration/plasmid.service.test.ts` - All tests passing
- [ ] `docs/plans/parity-evidence/plasmid-parity.md` - Parity documented
- [ ] `npm run test` - All tests passing
- [ ] `npm run lint` - Code formatted
- [ ] `npm run type-check` - Zero type errors
- [ ] PR ready with clear commit message

### Resources

- Base class: `src/services/repository.ts` (read this first)
- Types: `src/domain/types.ts` (Plasmid interface)
- Legacy behavior: `docs/legacy-analysis/feature-inventory.md`
- Error types: `src/domain/types.ts` (DomainError)
- Logging: `src/infrastructure/logger.ts` (Logger class)
- Database: `src/infrastructure/database.ts` (connection helpers)
- Query builder: `src/infrastructure/query-builder.ts` (knex initialization)

### Success Criteria

1. ✅ All methods implemented with correct signatures
2. ✅ All tests passing (unit + integration)
3. ✅ Zero TypeScript errors
4. ✅ Lint + format passing
5. ✅ Legacy plasmid behavior preserved (verified in parity document)
6. ✅ Code follows patterns in ADR-0005 and src/services/README.md
7. ✅ Clear commit message explaining changes
8. ✅ Ready for PR review

### Questions to Answer Before Starting

- [ ] Have you read AGENTS.md sections 1-3?
- [ ] Have you read ADR-0005 and ADR-0002?
- [ ] Do you understand the Repository pattern (src/services/README.md)?
- [ ] Do you understand transaction ownership (service owns, repository doesn't)?
- [ ] Do you know how to run tests? (`npm run test:integration`)
- [ ] Do you know where to find legacy feature requirements? (`docs/legacy-analysis/feature-inventory.md`)

---

**Ready to start?** Begin with `src/services/plasmid.repository.ts` and follow the pattern in `src/services/repository.ts`.

**Need clarification?** Review the referenced ADRs and README files first - they answer most questions.

**After completion:** This task establishes the pattern for all other repositories (CassetteRepository, PrimerRepository, FeatureRepository, etc.) in Phase 1.
