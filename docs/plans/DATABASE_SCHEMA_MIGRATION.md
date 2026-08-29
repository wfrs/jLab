# Database Schema Migration Plan

This document maps the legacy GMOCU SQLite schema to the modern implementation, ensuring parity-first migration (ADR-0009).

---

## Legacy Schema Analysis

From `docs/legacy-analysis/repository-deep-dive.md`, the original GMOCU uses:

### Core Tables

1. **Plasmid** — Central entity
   - id (INTEGER PRIMARY KEY)
   - name (TEXT NOT NULL)
   - description (TEXT)
   - data (TEXT JSON) — legacy poly-store: contains cassettes, primers, features, etc.
   - parentId (INTEGER FK) — for variants
   - status (TEXT) — draft, validated, archived
   - created_at (DATETIME)
   - updated_at (DATETIME)

2. **Cassette** — Genetic parts/modules
   - id (INTEGER PRIMARY KEY)
   - plasmidId (INTEGER FK)
   - name (TEXT NOT NULL)
   - sequence (TEXT)
   - type (TEXT) — promoter, terminator, marker, etc.
   - position (INTEGER) — order in plasmid
   - data (TEXT JSON) — metadata

3. **Primer** — PCR primers
   - id (INTEGER PRIMARY KEY)
   - plasmidId (INTEGER FK)
   - name (TEXT NOT NULL)
   - sequence (TEXT NOT NULL)
   - Tm (REAL) — melting temperature
   - gcContent (REAL)

4. **Feature** — Annotated regions
   - id (INTEGER PRIMARY KEY)
   - plasmidId (INTEGER FK)
   - name (TEXT NOT NULL)
   - type (TEXT) — gene, promoter, terminator, etc.
   - startPos (INTEGER)
   - endPos (INTEGER)
   - strand (TEXT) — '+' or '-'
   - data (TEXT JSON) — metadata

5. **Project** — Organization container
   - id (INTEGER PRIMARY KEY)
   - name (TEXT NOT NULL)
   - description (TEXT)
   - status (TEXT)
   - created_at (DATETIME)
   - updated_at (DATETIME)

6. **ProjectPlasmid** — M2M relationship
   - projectId (INTEGER FK)
   - plasmidId (INTEGER FK)

7. **User** — Local phase 1 (single user)
   - id (INTEGER PRIMARY KEY)
   - name (TEXT NOT NULL)
   - email (TEXT UNIQUE)
   - passwordHash (TEXT)

8. **Integration** — External sync state (Google Drive, Sheets, etc.)
   - id (INTEGER PRIMARY KEY)
   - plasmidId (INTEGER FK)
   - type (TEXT) — 'google_drive', 'google_sheets', 'genbank', 'ice'
   - externalId (TEXT) — remote ID
   - lastSync (DATETIME)
   - data (TEXT JSON) — sync metadata

---

## Modern Schema Design

All tables use:

- Strict typing (no TEXT JSON in core domain)
- Separate domain tables (denormalized from legacy's poly-store approach)
- Correlation tracking for integrations
- Audit trail (created_at, updated_at)

### Plasmid Table

```sql
CREATE TABLE plasmids (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  size_bp INTEGER,
  parent_id TEXT,
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'validated', 'archived')),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES plasmids(id) ON DELETE CASCADE
);
CREATE INDEX idx_plasmids_parent ON plasmids(parent_id);
Create INDEX idx_plasmids_status ON plasmids(status);
```

### Cassette Table

```sql
CREATE TABLE cassettes (
  id TEXT PRIMARY KEY,
  plasmid_id TEXT NOT NULL,
  name TEXT NOT NULL,
  sequence TEXT,
  type TEXT NOT NULL CHECK(type IN ('promoter', 'terminator', 'marker', 'origin', 'resistance', 'other')),
  position INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (plasmid_id) REFERENCES plasmids(id) ON DELETE CASCADE
);
CREATE INDEX idx_cassettes_plasmid ON cassettes(plasmid_id);
CREATE INDEX idx_cassettes_type ON cassettes(type);
```

### Primer Table

```sql
CREATE TABLE primers (
  id TEXT PRIMARY KEY,
  plasmid_id TEXT NOT NULL,
  name TEXT NOT NULL,
  sequence TEXT NOT NULL,
  tm_celsius REAL,
  gc_percent REAL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (plasmid_id) REFERENCES plasmids(id) ON DELETE CASCADE
);
CREATE INDEX idx_primers_plasmid ON primers(plasmid_id);
```

### Feature Table

```sql
CREATE TABLE features (
  id TEXT PRIMARY KEY,
  plasmid_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('gene', 'promoter', 'terminator', 'rbs', 'his_tag', 'flag_tag', 'other')),
  start_pos INTEGER NOT NULL,
  end_pos INTEGER NOT NULL,
  strand TEXT DEFAULT '+' CHECK(strand IN ('+', '-')),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (plasmid_id) REFERENCES plasmids(id) ON DELETE CASCADE
);
CREATE INDEX idx_features_plasmid ON features(plasmid_id);
CREATE INDEX idx_features_type ON features(type);
CREATE INDEX idx_features_pos ON features(start_pos, end_pos);
```

### Project Table

```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'archived')),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### ProjectPlasmid Table (M2M)

```sql
CREATE TABLE project_plasmids (
  project_id TEXT NOT NULL,
  plasmid_id TEXT NOT NULL,
  added_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (project_id, plasmid_id),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (plasmid_id) REFERENCES plasmids(id) ON DELETE CASCADE
);
CREATE INDEX idx_project_plasmids_plasmid ON project_plasmids(plasmid_id);
```

### User Table (Phase 1 local-first)

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  password_hash TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### Integration Sync State

```sql
CREATE TABLE integrations (
  id TEXT PRIMARY KEY,
  plasmid_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('google_drive', 'google_sheets', 'genbank', 'ice', 'filebrowser')),
  external_id TEXT NOT NULL,
  last_sync DATETIME,
  sync_status TEXT DEFAULT 'pending' CHECK(sync_status IN ('pending', 'synced', 'error')),
  error_message TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (plasmid_id) REFERENCES plasmids(id) ON DELETE CASCADE,
  UNIQUE(plasmid_id, type, external_id)
);
CREATE INDEX idx_integrations_plasmid ON integrations(plasmid_id);
CREATE INDEX idx_integrations_type ON integrations(type);
```

---

## Migration Strategy

### Phase 1: Schema Creation (Parity Foundation)

1. Create new schema with strict types
2. Data migration scripts from legacy `gmocu.db` to new schema
3. Ensure 100% data parity (validation tests required per ADR-0009)

### Phase 2: Reversible Migrations

1. All schema changes use knex migrations with `.up()` and `.down()`
2. Every change can be rolled back for testing/debugging
3. Migration test suite validates parity after rollback

### Phase 3: Seed Data

Development seed data includes:

- Sample plasmid (pGFP-expressing plasmid)
- Sample cassettes (promoter, RBS, gene, terminator)
- Sample primers for verification
- Sample project with plasmids

---

## Parity Verification Checklist

Before migration is complete:

- [ ] All legacy plasmid records migrate with zero data loss
- [ ] All cassette/primer/feature relationships preserved
- [ ] Project membership preserved
- [ ] Timestamps (created_at, updated_at) preserved
- [ ] Status enums match legacy values
- [ ] Integration sync state preserved
- [ ] Sequence data byte-for-byte identical
- [ ] Read operations on new schema return identical results to legacy
- [ ] Write operations on new schema produce legacy-compatible data

---

## Files Generated

Once scaffolding complete:

- `migrations/001_create_schema.ts` — Full schema DDL
- `migrations/002_migrate_data.ts` — Legacy → new schema ETL
- `scripts/db-seed.ts` — Development seed data
- `src/domain/types.ts` — TypeScript interfaces for all entities
- `src/services/repository.ts` — Base repository class (ADR-0005)
