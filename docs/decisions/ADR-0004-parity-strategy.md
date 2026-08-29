# ADR-0004: Parity verification strategy

## Status

Accepted

## Context

The modernization objective explicitly requires preserving functional behavior from legacy GMOCU.

## Decision

Define a parity matrix by workflow and require objective evidence before replacement:

1. workflow definition,
2. expected legacy behavior,
3. rebuilt behavior verification,
4. evidence artifact (test output/manual script/screenshot/log).

Parity gate policy:

- P0 workflows (regulatory, data integrity, migration-critical) require automated parity tests.
- P1 workflows require automated tests where practical; manual evidence allowed only with explicit rationale.
- Any workflow with failing parity evidence blocks merge.

Evidence location convention:

- automated outputs: `tests/parity/` and CI logs,
- manual parity evidence: `docs/plans/parity-evidence/` with reproducible steps.

## Consequences

- Pros:
  - measurable modernization safety,
  - explicit regression prevention,
  - easier release confidence.
- Trade-offs:
  - upfront test/documentation effort.

## Alternatives considered

- Informal parity checks during development (insufficient confidence).

## Resolution notes

No blocking open questions remain for this ADR.
