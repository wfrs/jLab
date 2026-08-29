# ADR dependency map

This document maps architecture decisions to implementation areas and shows dependency direction between ADRs.

## 1) Dependency graph (high level)

```text
ADR-0001 (UI/runtime: Next.js)
  ├─> ADR-0002 (data access pattern)
  │     └─> ADR-0005 (data implementation strategy)
  ├─> ADR-0003 (module boundaries)
  ├─> ADR-0006 (integration adapters)
  ├─> ADR-0007 (validation strategy)
  ├─> ADR-0008 (logging/diagnostics)
  ├─> ADR-0009 (migration/compatibility)
  └─> ADR-0010 (packaging/updates)

ADR-0004 (parity strategy)
  ├─> ADR-0009 (migration acceptance gates)
  └─> ADR-0010 (release gating)
```

## 2) Implementation area ownership

- **Runtime/web architecture**
  - ADR-0001

- **Layering and code structure**
  - ADR-0002, ADR-0003, ADR-0005

- **External systems and resilience**
  - ADR-0006

- **Input/business/payload validation**
  - ADR-0007

- **Observability and error diagnostics**
  - ADR-0008

- **Data migration and cutover safety**
  - ADR-0009 (+ ADR-0004 gates)

- **Build, release, and update operations**
  - ADR-0010 (+ ADR-0004 gates)

## 3) Build-order guidance for implementation

Recommended implementation order:

1. ADR-0001
2. ADR-0003
3. ADR-0002
4. ADR-0005
5. ADR-0007
6. ADR-0006
7. ADR-0008
8. ADR-0004
9. ADR-0009
10. ADR-0010

Rationale:

- lock architecture and boundaries first,
- then data and validation foundations,
- then integration and diagnostics,
- then parity/migration/release gating.

## 4) Review checklist by ADR impact

When a change touches:

- route handlers/services/repos -> review against ADR-0002/0003/0005
- external API calls -> review against ADR-0006/0008
- schema/input validation -> review against ADR-0007
- migration scripts/data transforms -> review against ADR-0004/0009
- packaging/deployment/update scripts -> review against ADR-0010
