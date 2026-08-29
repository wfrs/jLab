# ADR-0001: UI/runtime stack

## Status

Accepted

## Context

The legacy app is a Python desktop GUI with a monolithic implementation. We need a modernized UI architecture with strong parity and low delivery risk.

## Decision

Adopt a **pure web application using Next.js (React + TypeScript)** as the rebuild baseline.

Architecture shape:

- Next.js app for UI and web runtime.
- API-first backend boundaries.
- Initial backend implementation will use Next.js route handlers.
- Extract to dedicated backend services later when complexity/scale thresholds are reached.

## Consequences

- Pros:
  - modern web UX and component ecosystem,
  - strong TypeScript-first developer/agentic coding experience,
  - unified frontend framework with built-in routing, rendering, and API support.
- Trade-offs:
  - migration from legacy Python desktop logic requires explicit service extraction,
  - web deployment/runtime concerns become first-class (auth, hosting, browser behaviors),
  - offline behavior requires explicit design rather than being implicit desktop-local behavior.

## Alternatives considered

- Python + Qt desktop (low migration risk, but not aligned with selected web-first direction).
- Local web app + desktop shell (adds packaging complexity without current need).

## Resolution notes

Resolved defaults for phase 1 (local-first):

- Hosting/deployment: local process runtime (`next dev` / `next start`) with optional local container profile.
- Auth model: local single-user mode by default; no external IdP required in phase 1.
- Route-handler extraction trigger criteria (split to dedicated backend service when any condition is met):
  1. a domain area exceeds 8 route handlers with duplicated orchestration patterns,
  2. average route-handler file size exceeds 250 LOC in a domain area,
  3. p95 latency target is repeatedly missed due to API-layer orchestration coupling,
  4. independent scaling/deployment is required for background or integration-heavy workloads,
  5. a feature routinely requires coordinated changes across 3+ domain modules.
