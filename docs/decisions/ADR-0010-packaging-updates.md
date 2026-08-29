# ADR-0010: Packaging and update strategy

## Status

Accepted

## Context

The rebuild is currently local-first and agent-driven. We need a packaging/update strategy that:

- supports local development velocity,
- preserves reproducibility,
- allows a clean path from local-only operation to controlled release channels later.

This ADR aligns with ADR-0001 (Next.js web baseline) and ADR-0009 (migration safety).

## Decision

Adopt a **two-stage packaging strategy**:

1. **Stage 1 (current): local-first runtime**
   - run via local Next.js app processes,
   - no mandatory auto-update system,
   - deterministic scripts for build/test/run.
2. **Stage 2 (later): release packaging**
   - containerized deployment artifacts,
   - versioned release bundles,
   - optional controlled update channel.

## Stage 1 standards (enforceable now)

- Provide canonical local run/build/test scripts.
- Pin toolchain/runtime versions where practical.
- Keep environment setup reproducible from repository docs.
- No hidden machine-specific manual steps.
- Record application version in build/runtime metadata.

## Stage 2 target standards (planned)

- Produce immutable versioned artifacts per release.
- Maintain release notes with migration requirements.
- Include rollback-compatible deployment instructions.
- Gate release on parity checks and migration validation.

## Update policy

- No silent background updates.
- Any update mechanism must:
  - be explicit and user-triggered or admin-controlled,
  - provide pre-update backup/migration checks,
  - provide rollback instructions.

## Environment profiles

- `local-dev`: high observability, fast iteration.
- `local-prod-like`: production-like config for validation.
- `release`: immutable artifact + migration and parity gates.

## Consequences

- Pros:
  - low friction for current local-only phase,
  - clear path to production-grade release process,
  - reduced operational surprises.
- Trade-offs:
  - defers some distribution automation to later phase,
  - requires discipline to keep scripts/docs in sync.

## Alternatives considered

- Immediate full installer/update platform (premature complexity now).
- Ad hoc packaging per environment (non-reproducible).
- Auto-update-first strategy before migration hardening (risk to data integrity).

## Risks and mitigations

- Risk: local environments drift over time.
  - Mitigation: pinned versions and deterministic run scripts.
- Risk: future release pipeline retrofit is expensive.
  - Mitigation: stage model with early versioned artifact conventions.
- Risk: update process breaks migrated data.
  - Mitigation: tie updates to ADR-0009 migration gates and rollback policy.

## Test and parity implications

- Verify build/run scripts on clean local environment.
- Validate version metadata visibility in runtime.
- For release stage, require parity suite + migration verification before publish.
