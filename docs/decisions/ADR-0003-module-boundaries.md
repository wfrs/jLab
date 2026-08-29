# ADR-0003: Module boundaries and dependency rules

## Status

Accepted

## Context

The rebuild must avoid reintroducing a monolith where UI, domain, integration, and persistence are tightly coupled.

## Decision

Adopt module boundaries with dependency direction:

- UI -> Application -> Domain
- Infrastructure implements interfaces consumed by Application/Domain
- No cross-module direct DB access outside repository contracts

## Consequences

- Pros:
  - cleaner ownership and reviewability,
  - better test isolation,
  - lower regression risk.
- Trade-offs:
  - requires upfront contract design,
  - stricter code review discipline.

## Alternatives considered

- File-by-file migration with ad hoc boundaries (faster start, long-term drift risk).

## Resolution notes

Resolved defaults:

- Shared kernel scope is limited to:
  - generic primitives (`Result`, pagination DTOs, common identifiers),
  - cross-cutting error base types/codes,
  - logging/correlation context contracts.
- Shared kernel must not contain:
  - domain-specific entities or business rules,
  - repository or adapter implementations.
- Boundary enforcement policy:
  1. path-based module ownership in source layout,
  2. lint rules preventing forbidden cross-layer imports,
  3. CI validation that fails on boundary violations.
