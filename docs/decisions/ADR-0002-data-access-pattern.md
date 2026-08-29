# ADR-0002: Data access pattern

## Status

Accepted

## Context

Legacy GMOCU mixes direct SQL/pandas queries with mapper-style table interactions, creating duplicated logic and weak boundaries.

ADR-0001 selected a pure web app with Next.js and route handlers first. Without strict data-access boundaries, route handlers can quickly become monolithic and recreate legacy coupling.

## Decision

Use a **repository pattern with application services** inside the Next.js codebase:

- Route handlers call application services only.
- Application services orchestrate workflows and transactions.
- Repositories own all database access and query logic.
- Client components never access database APIs directly.

Initial persistence target remains SQLite for parity-first migration, with repository interfaces designed to allow later database changes.

## Consequences

- Pros:
  - clear boundaries in a single Next.js app,
  - prevents data/query logic from leaking into route handlers,
  - testable persistence and workflow logic,
  - easier later extraction to dedicated backend service if needed.
- Trade-offs:
  - initial scaffolding overhead,
  - requires discipline for module ownership and transaction design.

## Alternatives considered

- Continue mixed direct-query style (fast initially, high debt).
- Use framework handlers + inline SQL directly (simple start, high long-term coupling risk).
- Introduce heavy ORM everywhere (possible over-complexity for current scope).

## Resolution notes

No blocking open questions remain for this ADR.

Implementation specifics are governed by:

- ADR-0005 (query builder default, transaction ownership, reporting query strategy),
- ADR-0003 (module boundary and enforcement direction).
