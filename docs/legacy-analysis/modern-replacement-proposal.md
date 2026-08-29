# GMOCU modern replacement proposal

## 1) Objectives

Keep feature parity with original GMOCU while improving:

- maintainability,
- security,
- UX clarity,
- release reliability.

Constraint: keep architecture simple and avoid feature creep.

## 2) Recommended target (simple, parity-first)

## Option A (recommended): Python + Qt (PySide6)

Why:

- Preserves Python ecosystem and existing domain knowledge.
- Lowest migration risk while enabling major UI/architecture cleanup.
- Best fit for offline-heavy desktop workflows.

## 3) Target architecture (modular monolith)

### Layers

1. **UI layer**
   - Qt views and view-models
   - no direct SQL or external API calls
2. **Application layer**
   - use-case services (sync, import, report, publish)
   - transaction boundaries and validation orchestration
3. **Domain layer**
   - typed entities/value objects
   - core rules (naming, completeness, parity guards)
4. **Infrastructure layer**
   - repositories (SQLite)
   - adapters (ICE, GDrive, Filebrowser, Google Sheets)
   - filesystem and packaging utilities

## 4) Module split proposal

- `modules/settings`
- `modules/plasmids`
- `modules/cassettes`
- `modules/gmos`
- `modules/glossary`
- `modules/reports`
- `modules/publishing`
- `modules/import_merge`

Shared:

- `core/types`
- `core/errors`
- `core/logging`
- `core/config`

## 5) Behavior parity strategy

For each legacy feature:

1. define expected input/output/side-effects,
2. capture edge-case behavior,
3. add parity tests,
4. migrate feature module,
5. run parity suite before replacing legacy path.

## 6) Security hardening baseline

- Remove TLS bypass logic.
- Replace raw secret persistence with:
  - OS keyring where possible for tokens/passwords,
  - strict redaction in logs.
- Validate all imported external data via typed schema validators.

## 7) Testing strategy

- Unit tests:
  - domain rules
  - transformation logic
  - import/sync merge rules
- Integration tests:
  - repository behavior on SQLite
  - adapter contract tests for each external service wrapper
- Workflow tests:
  - end-to-end use-cases with mocked adapters

## 8) Incremental migration plan

### Phase 1: Foundation

- establish new project structure and typing/tooling baseline
- define entities and repository interfaces
- implement read-only parity checks against legacy DB

### Phase 2: Domain extraction

- port glossary validation/sync logic to isolated services
- port reporting services
- add parity tests for generated XLSX outputs

### Phase 3: Data operations

- port plasmid/cassette/GMO CRUD orchestration services
- port import/merge workflow

### Phase 4: Integrations

- implement adapter interfaces for ICE/Filebrowser/GDrive
- move upload workflows out of UI thread

### Phase 5: UI replacement

- implement Qt screens around new service layer
- replicate existing workflows with cleaner navigation and messaging

### Phase 6: Cutover

- run parity acceptance checklist
- package and validate on target OSes
- retire legacy script path

## 9) UX modernization principles (without changing function)

- Task-first navigation (Data, Glossaries, Publish, Reports, Settings).
- Reduce modal interruption; use inline validation and status banners.
- Keep advanced actions visible but clearly grouped.
- Add operation progress with cancellable long tasks.

## 10) Definition of done for modernization

- All legacy features mapped and implemented.
- Parity test suite green.
- No known credential/TLS anti-patterns.
- Clear docs for setup, migration, and operations.
