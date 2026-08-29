# ADR-0007: Validation strategy

## Status

Accepted

## Context

Legacy GMOCU relies on mixed validation approaches across UI events, ad hoc SQL checks, and operational popups. The rebuild requires predictable, layered validation aligned with:

- ADR-0001 (Next.js web baseline),
- ADR-0002/0005 (service/repository boundaries),
- ADR-0006 (adapter boundaries).

Without explicit validation boundaries, agent-generated code tends to duplicate or skip critical checks.

## Decision

Adopt a **three-layer validation model** with strict responsibility boundaries:

1. **API boundary validation** (request shape and basic constraints),
2. **Domain validation** (business invariants and workflow rules),
3. **Adapter payload validation** (external provider input/output contracts).

Validation must be explicit, typed, and composable.

## Validation boundaries

## 1) API boundary validation

Applies in route handlers before calling services:

- request schema/type validation,
- required fields and primitive constraints,
- enum/domain-reference shape checks,
- pagination/filter parameter constraints.

Not allowed at this layer:

- business decisions spanning multiple entities,
- persistence-or-integration-dependent invariants.

## 2) Domain validation

Applies in application/domain services:

- business invariants (e.g., required relationships, naming/state rules),
- workflow sequencing constraints,
- cross-entity consistency checks,
- state transition validity.

Domain validation is the source of truth for behavior parity rules.

## 3) Adapter payload validation

Applies at integration edges:

- validate outbound payload shape before sending,
- validate inbound provider responses before mapping to domain DTOs,
- reject malformed/unexpected structures with typed integration errors.

## Error model

Validation errors must be typed and categorized:

- `InputValidationError` (API boundary)
- `DomainValidationError` (business rule violation)
- `IntegrationValidationError` (provider payload contract issue)

Errors must include machine-readable codes and user-safe messages.

## Rules (enforceable)

- Route handlers must never bypass API schema validation.
- Services must never trust unvalidated input objects.
- Repositories must not be used for input validation logic.
- Adapters must not pass unvalidated external payloads to domain/services.
- Validation logic must be reusable and not duplicated across handlers.

## Implementation guidance

- Use shared schema definitions for request/response DTO validation.
- Keep domain invariant checks in dedicated validator functions/policies.
- Use normalization utilities only after schema validation passes.
- Prefer fail-fast validation for invalid requests.
- Collect and return field-level error details where useful.

## Consequences

- Pros:
  - predictable behavior and fewer hidden validation gaps,
  - easier testing and code generation consistency,
  - stronger security posture for external inputs.
- Trade-offs:
  - additional schema/validator maintenance,
  - requires discipline to avoid layer leakage.

## Alternatives considered

- Validation only in UI/API layer (insufficient for business invariants).
- Validation only in database constraints (poor user feedback and late failure).
- Ad hoc per-endpoint validation (duplication and drift risk).

## Risks and mitigations

- Risk: duplicated validation in multiple layers.
  - Mitigation: document single-owner rule per validation concern.
- Risk: over-validation hurting development speed.
  - Mitigation: prioritize parity-critical and security-critical constraints first.
- Risk: inconsistent error responses.
  - Mitigation: shared validation error formatter and response contract.

## Test and parity implications

- Unit tests:
  - API schema validators,
  - domain invariant validators,
  - adapter payload validators.
- Integration tests:
  - route-to-service validation behavior,
  - error contract consistency.
- Parity checks:
  - legacy-equivalent acceptance/rejection outcomes for critical workflows.
