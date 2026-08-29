# ADR-0008: Logging and diagnostics strategy

## Status

Accepted

## Context

Legacy GMOCU relies heavily on popup-based runtime feedback with limited structured diagnostics. In the web rebuild, we need consistent observability for:

- debugging agent-generated code paths,
- diagnosing integration failures,
- tracing multi-step workflows across services/adapters,
- preserving security constraints (no secret leakage).

This ADR aligns with ADR-0001/0002/0005/0006/0007.

## Decision

Adopt a **structured logging and diagnostics standard** with:

1. JSON-structured logs across server/runtime layers,
2. request correlation IDs propagated through handlers, services, repositories, and adapters,
3. strict secret redaction policy,
4. consistent error event shape and severity levels,
5. environment-specific verbosity controls.

## Log model

Each log event must include:

- timestamp
- level (`debug` | `info` | `warn` | `error`)
- message
- component (handler/service/repository/adapter)
- operation/use-case name
- correlationId (request scope)
- optional entity identifiers (non-secret)
- optional error code/category

## Rules (enforceable)

- No plaintext secrets/tokens/passwords/API keys in logs.
- No full request/response body logging for sensitive flows.
- Route handlers must attach or generate a correlation ID.
- Services/adapters must propagate correlation ID downstream.
- Adapter failures must log provider, operation, timeout/retry metadata, and mapped internal error category.
- User-facing errors must be separated from internal diagnostic detail.

## Redaction policy

Always redact:

- access tokens
- refresh tokens
- API keys
- passwords
- credential JSON contents
- authorization headers

Use centralized redaction utilities; do not implement ad hoc masking in each module.

## Severity guidance

- `debug`: development-only internals, disabled in production by default.
- `info`: normal workflow milestones.
- `warn`: recoverable issues, partial failures, degraded paths.
- `error`: failed operations requiring user retry, support action, or incident response.

## Diagnostics and troubleshooting

- Include machine-readable error codes aligned with ADR-0007 validation errors and ADR-0006 integration errors.
- Emit workflow checkpoints for long-running operations (imports, sync, publish, report generation).
- Capture retry attempts and terminal failure reason for integration operations.
- Provide a stable diagnostic envelope for API error responses.

Standard API error envelope:

```json
{
  "error": {
    "code": "DOMAIN_OR_INTEGRATION_CODE",
    "category": "validation|domain|integration|internal",
    "message": "User-safe message",
    "correlationId": "req-...",
    "details": []
  }
}
```

## Environment behavior

- Local/dev:
  - `debug` and above,
  - human-friendly pretty output optional.
- CI/test:
  - deterministic formatting for assertion and parsing.
- production:
  - `info` and above by default,
  - debug enabled only with explicit short-lived override.

## Consequences

- Pros:
  - faster root-cause analysis,
  - safer operations with redaction guarantees,
  - improved consistency across agent-generated modules.
- Trade-offs:
  - added instrumentation overhead,
  - logging schema governance required over time.

## Alternatives considered

- Plain text logging only (hard to parse/correlate at scale).
- Per-module ad hoc logging conventions (high inconsistency risk).
- Minimal logging with only error stacks (insufficient operational insight).

## Risks and mitigations

- Risk: accidental secret leakage.
  - Mitigation: centralized logger wrapper + redaction tests.
- Risk: noisy logs reducing signal quality.
  - Mitigation: level standards and event taxonomy.
- Risk: missing correlation propagation.
  - Mitigation: middleware and request-context helpers.

## Test and parity implications

- Unit tests:
  - redaction utility behavior,
  - log envelope shape validation.
- Integration tests:
  - correlation ID propagation through service and adapter calls,
  - error code/log alignment.
- Operational parity checks:
  - equivalent visibility for key workflows (import/sync/publish/report) vs legacy outcomes, with stronger diagnostics.
