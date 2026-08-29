# ADR-0006: Integration adapter strategy

## Status

Accepted

## Context

The legacy GMOCU integrates with external systems (ICE, Google Drive, Google Sheets, Filebrowser) directly from UI logic, with inconsistent error handling and weak boundary control.

In the rebuild:

- ADR-0001 established a Next.js web app baseline.
- ADR-0002/0005 established service/repository boundaries and transaction discipline.

We need a consistent integration pattern that works for agentic coding, testability, and security.

## Decision

Adopt **adapter-based integration boundaries**:

1. External systems are accessed only through typed adapter interfaces.
2. Application services depend on adapter interfaces, not provider SDKs/clients.
3. Provider-specific SDK usage is isolated in infrastructure adapters.
4. Integration calls use standardized timeout, retry, and error mapping policies.
5. All adapters must expose deterministic, testable contracts.

## Adapter model

Each integration has:

- `port` (interface): domain-oriented operations
- `adapter` (implementation): provider-specific logic
- `dto/mapper`: transform provider payloads to internal DTOs

Examples:

- `IceRegistryPort` / `IceRegistryAdapter`
- `GlossarySyncPort` / `GoogleSheetsGlossaryAdapter`
- `ArtifactStoragePort` / `GoogleDriveAdapter`, `FilebrowserAdapter`

## Rules (enforceable)

- Route handlers must not call external SDKs directly.
- Application services may only call adapter ports.
- Adapter implementations must:
  - set explicit request timeouts,
  - classify retryable vs non-retryable failures,
  - map provider errors into typed internal integration errors,
  - redact secrets from logs.
- No TLS verification bypass is allowed.
- No credentials are stored in source-controlled files.

## Timeout, retry, and backoff policy

Default policy for network operations:

- timeout defaults:
  - metadata/read operations: 10s,
  - write/update operations: 20s,
  - upload/export batch operations: 60s per request/chunk,
- retries: up to 2 retries for transient failures (3 total attempts),
- backoff: exponential with jitter (base 300ms, factor 2, max 5s),
- idempotency: required for retryable write operations (or guarded by dedupe keys).

Do not retry:

- validation/authentication failures,
- semantic conflict errors that require user action.

## Error mapping policy

Map provider-specific errors to internal categories:

- `IntegrationAuthError`
- `IntegrationPermissionError`
- `IntegrationRateLimitError`
- `IntegrationTimeoutError`
- `IntegrationUnavailableError`
- `IntegrationDataContractError`

Application services decide user-visible messaging and compensation behavior from these categories.

## Operational behavior

- Long-running adapter operations must emit progress checkpoints for UI feedback.
- Batch operations should support partial-failure reporting with per-item status.
- Where practical, adapters should support dry-run/validate mode for preflight checks.

## Security requirements

- Credentials must come from approved runtime configuration/secret storage only.
- Logs must never include tokens, passwords, API keys, or full credential payloads.
- Enforce least-privilege scopes for each integration.
- Validate and sanitize all external payloads before domain use.

## Consequences

- Pros:
  - clear integration boundaries and lower coupling,
  - easier provider swaps and mocking in tests,
  - predictable error handling and better resilience.
- Trade-offs:
  - additional interface/mapping boilerplate,
  - requires consistent conventions across adapters.

## Alternatives considered

- Direct SDK usage from services/handlers (fast start, high long-term coupling).
- Single generic integration client for all providers (over-generalization risk).
- Ad hoc retries/error handling in each call site (inconsistent behavior).

## Risks and mitigations

- Risk: inconsistent adapter implementations.
  - Mitigation: shared adapter base utilities (timeouts, retries, error mapping).
- Risk: hidden provider payload drift.
  - Mitigation: strict DTO validation and contract tests.
- Risk: flaky external dependencies in CI.
  - Mitigation: mock adapters for most tests; isolate live integration tests.

## Test and parity implications

- Unit tests:
  - adapter error mapping,
  - retry/timeout behavior using fakes/mocks,
  - DTO mapping and validation.
- Integration tests:
  - adapter contract behavior against representative test environments/mocks.
- Parity checks:
  - legacy-equivalent upload/sync/reporting outcomes for supported integrations.
