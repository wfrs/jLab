# /src/services

Service and repository layer (ADR-0002, ADR-0005).

## Modules

- **repository.ts** — Base Repository<T> class for all data access
- **plasmid.service.ts** — Business logic for Plasmid CRUD + queries
- **cassette.service.ts** — Cassette management
- **project.service.ts** — Project management
- **integration.service.ts** — Integration adapter orchestration

## Pattern: Repository + Service

Each domain entity gets:

1. **Repository** — Thin data access layer (inherited from base)
2. **Service** — Business logic, transaction ownership, validation

Example:

```typescript
class PlasmidService {
  constructor(private repo: PlasmidRepository) {}

  async createPlasmid(input: CreatePlasmidInput): Promise<Plasmid> {
    // Validate input (ADR-0007)
    // Apply domain invariants
    // Manage transaction (ADR-0005)
    return withTransaction(async (db) => {
      const plasmid = await this.repo.create(input);
      // Side effects (logging, adapters, etc.)
      return plasmid;
    });
  }
}
```

## Key Constraints

- Services own transactions via `withTransaction()` helper
- Repositories are read/write only (no business logic)
- Validation happens at API boundary → domain invariants → adapter payloads
- Logging uses structured format with correlationId
