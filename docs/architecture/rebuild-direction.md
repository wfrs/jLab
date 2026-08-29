# GMOCU rebuild direction (draft)

## 1) Intent

Build a modern GMOCU implementation that preserves legacy behavior while improving maintainability, security, and UX clarity.

Primary constraint: parity over feature expansion.

## 2) Product direction

- Keep all existing core workflows functional.
- Reduce operator friction with cleaner task-first navigation.
- Keep the implementation simple and modular.
- Avoid introducing speculative platform complexity.

## 3) Proposed architecture direction

## 3.1 Architectural style

Use a **modular monolith**:

- one deployable application,
- clear internal module boundaries,
- strict dependency direction across layers.

## 3.2 Layering

1. **UI layer**
   - screens/view-models only,
   - no direct persistence or external API calls.
2. **Application layer**
   - use-case orchestration,
   - transaction and validation flow.
3. **Domain layer**
   - entities/value objects/rules,
   - parity-critical business behavior.
4. **Infrastructure layer**
   - SQLite repositories,
   - adapters for ICE/GDrive/Filebrowser/Google Sheets,
   - filesystem and packaging concerns.

## 3.3 Module boundaries

- `settings`
- `plasmids`
- `cassettes`
- `gmos`
- `glossary`
- `reports`
- `publishing`
- `import-merge`

## 4) UX direction

- Task-first top-level navigation:
  1. Plasmids
  2. Glossaries
  3. Reports
  4. Publish
  5. Settings
- **Locked primary interaction model (v1):** spreadsheet-first plasmid table with immediate autosave.
- Clicking/selecting a row opens a synced detail panel (side or bottom) for form-style editing.
- Inline validation over modal interruption where possible.
- Progressive disclosure for advanced settings/actions.
- Copy/paste-first UX for cells, ranges, and rows; drag-fill where relevant.

## 5) Security direction

- Remove all TLS bypass behavior.
- Keep secrets out of source and logs.
- Introduce explicit input/schema validation at import/sync boundaries.
- Apply least-privilege credential usage for integration adapters.

## 6) Testing direction

- Parity test suite is a first-class artifact.
- Unit tests for domain rules and transformations.
- Integration tests for repository and adapter contracts.
- Error-path tests for all external dependency interactions.

## 7) Migration direction

- Keep legacy `gmocu/` as read-only reference.
- Migrate workflow-by-workflow, not file-by-file.
- Preserve data compatibility with existing `gmocu.db`.
- Require parity evidence before replacing any legacy behavior.

## 8) Non-goals (initial)

- No new product features outside parity and UX clarity improvements.
- No microservices/distributed architecture.
- No cloud-first redesign at this stage.
