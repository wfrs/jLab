# /src/domain

Domain layer — entity types and business rules.

## Modules

- **types.ts** — TypeScript interfaces for all entities (Plasmid, Cassette, Primer, Feature, Project, User, Integration)
- **errors.ts** — Domain-specific error types (DomainError, ValidationError)
- **validators.ts** — Domain invariant validation functions

## Pattern: Strict Typing

All domain types are:

- Immutable (treated as value objects)
- Fully typed (no `any`)
- Independent of framework (no React, no HTTP)

Example:

```typescript
interface Plasmid {
  id: string;
  name: string;
  status: 'draft' | 'validated' | 'archived';
  createdAt: Date;
  updatedAt: Date;
}
```

## Domain Invariants

Business rules that must always hold:

- Plasmid status transitions follow rules (draft → validated → archived)
- Plasmid cannot have duplicate cassettes
- Feature positions must be in order

Validate these in services, not in repositories.
