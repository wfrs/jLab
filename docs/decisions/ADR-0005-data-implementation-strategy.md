# ADR-0005: Data implementation strategy (querying, transactions, reporting)

## Status

Accepted

## Context

ADR-0001 selected a pure Next.js web app with route handlers first. ADR-0002 defined architectural boundaries (route handlers -> services -> repositories) but left key implementation details open:

- raw SQL vs query builder vs ORM,
- transaction ownership style,
- reporting query placement.

These details must be fixed early to keep agent-generated code consistent and prevent architecture drift.

## Decision

Adopt the following standards:

1. **Default data access style:** query builder in repositories.
2. **Raw SQL policy:** allowed only when query builder is materially worse (complex reports, CTE-heavy or performance-critical queries), with justification in code comments.
3. **ORM policy:** do not use a heavy ORM as the primary data path in phase 1.
4. **Transaction policy:** transactions are started and owned in application services only.
5. **Reporting policy:** reporting uses dedicated read-model/query services (CQRS-lite), not CRUD repositories.

## Rules (enforceable)

- Route handlers must not execute database queries.
- Repositories must not begin or commit transactions.
- Services must use a shared `withTransaction(...)` helper for multi-step writes.
- Write repositories focus on aggregate/module ownership and mutation workflows.
- Reporting/export queries live in `reporting` query services and return typed DTOs.
- Any raw SQL must be parameterized and never string-concatenated with user input.

## Concrete examples

### Route handler (allowed)

- parse input
- call `plasmidService.create(input)`
- return result/error mapping

### Route handler (forbidden)

- inline `db.insert(...)` / SQL execution
- orchestration of 3+ persistence steps

### Service (allowed)

- `withTransaction(async (tx) => { ... })`
- call `plasmidRepo(tx).insert(...)`
- call `cassetteRepo(tx).insertDefault(...)`

### Repository (allowed)

- module-scoped queries only
- map rows to domain/data DTOs

### Reporting service (allowed)

- join-heavy read queries for Formblatt/plasmid list
- output read DTOs optimized for export generation

## Consequences

- Pros:
  - strong consistency for agentic code generation,
  - better testability and maintainability,
  - clear migration path to separate backend service later.
- Trade-offs:
  - initial scaffolding and stricter review discipline,
  - some duplication between write models and report/read DTOs.

## Alternatives considered

- Raw SQL everywhere (fast start, high inconsistency risk).
- Heavy ORM-first model (higher abstraction cost/risk in parity-focused phase).
- Putting report queries into CRUD repositories (bloated repository contracts).

## Risks and mitigations

- Risk: route handlers accumulate business logic again.
  - Mitigation: lint/review rule forbidding DB access in handlers.
- Risk: ad hoc transaction patterns.
  - Mitigation: mandatory `withTransaction(...)` service helper.
- Risk: reporting logic leaks across modules.
  - Mitigation: dedicated reporting namespace and ownership.

## Test and parity implications

- Unit tests:
  - service orchestration and transaction behavior,
  - repository mapping and query correctness,
  - report query DTO correctness.
- Integration tests:
  - transaction rollback/commit semantics,
  - parity-critical report outputs.
