# GMOCU technical debt assessment

## Summary

The current implementation is functional and feature-rich, but debt concentration is high in architecture, error handling, and security posture. Most debt is refactorable without changing functional behavior.

## 1) Architecture debt

### A1. Monolithic application module

- `gmocu.py` contains UI composition, business logic, migration logic, integrations, and event routing in one file.
- Impact: low change velocity, hard test isolation, high regression risk.

### A2. Mixed data access patterns

- Coexistence of mapper-based access (`db['Table']`) and direct `sqlite3`/pandas queries.
- Impact: duplicated data logic, inconsistent validation boundaries.

### A3. Event-handler sprawl

- Large `if/elif` chain with many side-effects and duplicated refresh logic.
- Impact: high cognitive load, brittle behavior changes.

## 2) Code quality debt

### Q1. Repeated imperative snippets

- Repeated fetch/refresh/update patterns for combo data, checks, and saves.
- Impact: maintenance overhead, subtle divergence over time.

### Q2. Weak typing discipline

- Dynamic dictionaries and tuple-heavy return signatures dominate.
- Impact: runtime-only failures and fragile callsites.

## 3) Error handling debt

### E1. Broad exception handling

- Frequent blanket `except` branches with popup messages only.
- Impact: hidden root causes, difficult troubleshooting, inconsistent recovery.

### E2. UI-thread blocking operations

- Long-running sync/upload logic executes synchronously in event loop.
- Impact: frozen UI under poor network conditions.

## 4) Security debt

### S1. TLS bypass path present

- Obsolete flow includes explicit TLS verification bypass for CSV fetch.
- Impact: insecure network behavior risk if path is used.

### S2. Credential storage model

- Credentials persisted in local DB and JSON file locations.
- Impact: local secret management weakness, no rotation controls.

### S3. External input trust boundaries

- Spreadsheet and file inputs have limited schema/constraint enforcement.
- Impact: malformed external data can propagate deeper into workflows.

## 5) UX debt

### U1. Dense multi-responsibility screens

- High-control-density tabs, mixed action levels, and many hidden conventions.
- Impact: onboarding friction and discoverability issues.

### U2. Popup-heavy flow

- Frequent modal prompts for operational and error states.
- Impact: interruption-heavy interaction model.

## 6) Operational debt

### O1. Migration logic in startup path

- Runtime DB migrations are interactive and interwoven with app startup.
- Impact: difficult deterministic automation and upgrade testing.

### O2. Packaging-specific manual steps

- README includes post-build file relocation caveats.
- Impact: non-reproducible release complexity.

## 7) Prioritized remediation order (parity-safe)

1. Isolate domain services from UI event handlers.
2. Normalize data access through one repository/service layer.
3. Replace broad exceptions with explicit failure pathways.
4. Remove TLS-bypass code path and harden credential handling.
5. Introduce testable workflow modules before UI rewrite.
