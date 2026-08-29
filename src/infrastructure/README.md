# /src/infrastructure

Infrastructure layer for technical concerns (ADR-0006, ADR-0008).

## Modules

- **logger.ts** — Structured JSON logging with correlation ID support (pino)
- **database.ts** — SQLite connection management, transaction helpers
- **query-builder.ts** — knex.js query builder initialization (ADR-0005)
- **validation.ts** — Zod schema definitions for API boundaries (ADR-0007)
- **http-client.ts** — fetch wrapper with retry logic (ADR-0006)
- **adapters/** — Integration adapters (Google Drive, Sheets, GenBank, ICE, Filebrowser)

## Key Patterns

All modules export singletons for consistency:

- `getDatabase()` — database connection
- `getQueryBuilder()` — knex instance
- `Logger` class — logger instances

Every operation must provide a `correlationId` for request tracking.
