# ADR-0009: Data migration and compatibility policy

## Status

Accepted

## Context

Legacy GMOCU stores operational data in SQLite (`gmocu.db`) with historical schema evolution and behavior-coupled semantics. The rebuild must preserve functional parity while moving to a web architecture.

This ADR defines the migration and compatibility policy so cutover is safe, repeatable, and testable.

## Decision

Adopt a **parity-first, reversible migration policy**:

1. Legacy `gmocu.db` is the source of truth for migration inputs.
2. Migration is explicit, versioned, and idempotent.
3. No destructive in-place legacy DB rewrites by default.
4. All transformed data must be validated against parity rules before production use.
5. Cutover must support rollback to legacy state using backups/checkpoints.

## Migration modes

### Mode A: Ingest + transform (default)

- Read from legacy DB.
- Map to new schema model.
- Write into new application storage.
- Preserve reference links and key business semantics.

### Mode B: Read-compatibility (bridge mode, optional)

- Temporary compatibility layer for selected workflows while migration is incomplete.
- Must be explicitly scoped and time-bounded.

## Rules (enforceable)

- Never modify legacy reference DB in place unless explicitly approved.
- Create timestamped migration artifacts and logs for each run.
- Record source version/schema fingerprint and target migration version.
- Every migration run must output:
  - row counts per major entity,
  - failed records with reasons,
  - parity-check summary.
- Migrations must support re-run without duplicate side effects.

## Identity and mapping policy

- Preserve legacy business identifiers where possible.
- If new IDs are generated, keep deterministic crosswalk tables (`legacy_id -> new_id`).
- Preserve glossary identity semantics (`uid`-based uniqueness where applicable).
- Keep enum/status mapping explicit and version-controlled.

## Validation and parity gates

Before cutover acceptance:

- Entity count parity checks (within expected documented differences),
- Referential integrity checks,
- Workflow-level parity checks (critical use cases),
- Report parity checks (Formblatt/plasmid list outputs),
- Integration payload compatibility checks for publish/sync paths.

If parity gates fail: migration is not accepted.

## Backup and rollback policy

- Always snapshot source input and target pre-migration state.
- Keep migration logs and mapping artifacts with run ID.
- Rollback path must be documented and tested for each release milestone involving migration.

## Security and compliance

- Treat migrated data as sensitive operational data.
- Do not log raw secrets, credential fields, or sensitive attachment content.
- Restrict migration tool access by least privilege.

## Consequences

- Pros:
  - safer cutover with auditable migration history,
  - reduced risk of silent data regressions,
  - clear accountability for migration outcomes.
- Trade-offs:
  - additional migration tooling and validation effort,
  - slower initial cutover speed in exchange for reliability.

## Alternatives considered

- Big-bang one-time migration without repeatability (high risk).
- In-place schema mutation of legacy DB as primary path (hard rollback and auditability).
- Manual migration-only approach (non-repeatable and error-prone).

## Risks and mitigations

- Risk: hidden semantic mismatches between old/new models.
  - Mitigation: workflow parity tests and explicit mapping specs.
- Risk: duplicate or partial imports on retry.
  - Mitigation: idempotent migration keys and run-state tracking.
- Risk: attachment/large payload inconsistencies.
  - Mitigation: checksum validation and per-batch verification.

## Test and parity implications

- Unit tests:
  - field mapping and transformation rules,
  - enum/status conversion behavior.
- Integration tests:
  - migration end-to-end against representative legacy DB fixtures.
- Parity checks:
  - pre/post workflow outputs and report equivalence for critical scenarios.
