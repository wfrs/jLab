# Architecture decision plan (phase 0)

This plan defines which architecture decisions we need to lock before implementation scales.

## Decision cadence

- Use ADRs in `docs/decisions/`.
- Classify each decision:
  - **Critical**: blocks implementation start.
  - **Near-term**: needed before module implementation.
  - **Later**: can be deferred safely.

## Critical decisions (must lock first)

## D1. UI/runtime stack

- Options:
  - Python + Qt desktop
  - Local web UI + desktop shell
- Decision owner: product + architecture
- Why critical: drives team skills, packaging, test strategy, UI architecture.
- Target ADR: `ADR-0001-ui-runtime-stack.md`

## D2. Data access pattern

- Options:
  - repository pattern over sqlite3
  - lightweight ORM + repositories
- Why critical: controls maintainability and testability.
- Target ADR: `ADR-0002-data-access-pattern.md`

## D3. Module boundaries and dependency rules

- Define canonical module contracts and allowed imports.
- Why critical: avoids monolith regression.
- Target ADR: `ADR-0003-module-boundaries.md`

## D4. Parity verification strategy

- Define parity matrix and proof artifacts.
- Why critical: modernization must preserve behavior.
- Target ADR: `ADR-0004-parity-strategy.md`

## Near-term decisions

## D5. Data implementation strategy

- Query builder vs raw SQL policy, transaction helper style, and reporting query placement.
- ADR target: `ADR-0005-data-implementation-strategy.md`

## D6. Integration adapter strategy

- Service wrappers, retries, timeouts, error mapping.
- ADR target: `ADR-0006-integration-adapters.md`

## D7. Validation strategy

- Input schemas and domain validation boundary.
- ADR target: `ADR-0007-validation-strategy.md`

## D8. Logging and diagnostics

- Structured logging shape and redaction policy.
- ADR target: `ADR-0008-logging-diagnostics.md`

## D9. Migration and compatibility policy

- DB compatibility and migration tooling approach.
- ADR target: `ADR-0009-data-migration-policy.md`

## Later decisions

## D10. Packaging and update strategy

- Installer/update channel strategy.
- ADR target: `ADR-0010-packaging-updates.md`

## D11. Optional plugin/extensibility model

- Only if future requirements justify.
- ADR target: `ADR-0011-extensibility.md`

## Output expectations for each ADR

Each ADR must include:

1. Context
2. Decision
3. Alternatives considered
4. Consequences
5. Risks and mitigations
6. Impacted modules
7. Test and parity implications

## Recommended sequence (next 1-2 weeks)

1. D1 UI/runtime stack
2. D2 data access pattern
3. D3 module boundaries
4. D4 parity strategy
5. D5 data implementation strategy
6. D6 adapter strategy
