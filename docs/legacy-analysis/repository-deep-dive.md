# GMOCU repository deep dive

## 1. Purpose and scope

GMOCU is a desktop application for:

- managing plasmid records,
- linking plasmids to GMO entries,
- maintaining controlled glossaries (`Nucleic acids`, `Organisms`),
- generating regulatory exports (`Formblatt Z`, plasmid list),
- synchronizing glossary data with Google Sheets,
- uploading plasmid metadata to JBEI/ICE,
- uploading files/artifacts to Filebrowser and/or Google Drive.

The implementation is monolithic and centered around a single PySimpleGUI script (`gmocu.py`) plus a customized local ORM/UI binding helper (`pysimplesqlmod.py`).

---

## 2. Repository inventory

### 2.1 Core code and schema

- `gmocu.py`: Main application (UI, workflows, integrations, export logic).
- `pysimplesqlmod.py`: Customized PySimpleSQL-like database/UI binding layer.
- `gmocu.sql`: SQLite schema bootstrap and seed data.

### 2.2 Packaging/runtime support

- `gmocu.spec`: PyInstaller build specification.
- `docker-compose.yml`: Local JBEI/ICE + PostgreSQL deployment helper.
- `conda_environment.txt`: Conda environment bootstrap commands.
- `GMOCU-0.4_env_packages.txt`: older dependency snapshot.

### 2.3 Templates/examples/assets

- `Downloads/templates/*.xlsx`: import templates for features/organisms.
- `Downloads/Downloads.txt`: explains user data output location.
- `example/GMOCU-0.4/gmocu.db` and `example/GMOCU-0.7/gmocu.db`: sample databases.
- `img/navigation.gif`: README media.
- `icon.ico`: app icon.

### 2.4 Product documentation and legal

- `README.md`: end-user and setup documentation.
- `LICENSE`

---

## 3. Runtime architecture

## 3.1 Execution model

- Single-process desktop app.
- UI event loop (`while True`) runs in `gmocu.py`.
- Persistent state in local SQLite (`gmocu.db`) under user home `.../GMOCU`.
- No background workers; network tasks are executed inline from UI actions.

## 3.2 Module-level architecture

- `gmocu.py`
  - bootstraps settings/theme/layout
  - initializes database (`ss.Database`)
  - defines business functions (sync, exports, uploads, import, validation checks)
  - owns event routing and feature behavior
- `pysimplesqlmod.py`
  - maps UI keys (`Table.column`) to SQLite table records
  - auto-discovers schema/relations from SQLite
  - provides CRUD, navigation, selector widgets, edit protection

## 3.3 Data flow style

Mixed approach:

- many operations use `db['Table']...` abstractions from `pysimplesqlmod.py`,
- many operations bypass abstraction and run direct `sqlite3` + `pandas.read_sql_query`.

This causes a dual data-access model in one codebase.

---

## 4. Data model (SQLite)

Schema source: `gmocu.sql` (+ runtime migration code in `gmocu.py`).

## 4.1 Tables and roles

- `Plasmids`: main plasmid records.
- `Cassettes`: cassette content per plasmid.
- `GMOs`: generated GMO records linked to plasmid.
- `Attachments`: binary files per plasmid.
- `Features`: nucleic acid glossary.
- `Organisms`: organism glossary.
- `OrganismSelection`: target organism shortlist.
- `OrganismFavourites`: quick-add favorite organisms.
- `SelectionValues`: status lookup for plasmids.
- `Settings`: app/user/integration configuration.
- `IceCredentials`: endpoint + credential profiles.

## 4.2 Important relational links

- `Cassettes.plasmid_id -> Plasmids.id`
- `GMOs.plasmid_id -> Plasmids.id`
- `Attachments.plasmid_id -> Plasmids.id`
- `Plasmids.status -> SelectionValues.id`
- `Settings.ice -> IceCredentials.id`

## 4.3 Behavioral data conventions

- Feature annotations are normalized (replace `-`, `[`, `]`, spaces).
- `uid` columns in `Features` and `Organisms` are synchronization identity keys.
- `synced` flag marks records synced/managed by online glossary flows.
- `Settings.initials` is foundational for upload folder naming and intended as immutable after first setup.

---

## 5. Initialization and boot sequence

1. `gmocu.py` sets constants (`version_no`, `database`, paths).
2. Copies template XLSX files to user data directory if missing.
3. Loads PySimpleGUI user settings (theme/scale/font/horizontal layout).
4. Builds full UI layout for tabs.
5. Opens window and sets initial element states.
6. Re-targets database path to user data folder.
7. Initializes DB via `ss.Database(..., sql_script='gmocu.sql')`.
8. If DB exists, applies version-based migration logic.
9. Enables edit protection and disables advanced editing controls.
10. Loads settings and applies runtime behavior.
11. Optional autosync with Google Sheets.
12. Runs integrity checks (`check_plasmids`, `check_features`, `check_organisms`).
13. Enters main event loop.

---

## 6. UI architecture and UX behavior

## 6.1 Tabs

- `Plasmid data`
- `GMO`
- `Nucleic acids`
- `Organisms`
- `Settings`

## 6.2 Plasmid tab behavior

Supports:

- plasmid browse/select/edit,
- cassette editing with feature autocomplete,
- alias auto-fill from cassette,
- GMO add/destroy flows,
- GenBank attach/download,
- binary attachment add/download,
- per-plasmid upload update (`UP` button).

## 6.3 GMO tab behavior

Grouped action hub:

- maintenance checks,
- bulk server upload/export,
- report generation,
- cross-instance DB import.

## 6.4 Glossary tabs behavior

`Nucleic acids` and `Organisms`:

- table-based CRUD,
- Excel import/export (all/used),
- Google Sheets synchronization,
- constraints around duplicate names and synced row edit protection.

## 6.5 Settings tab behavior

Captures:

- user/institution metadata,
- server credentials profile selection,
- Google IDs,
- style/layout flags,
- upload toggles and autosync toggles,
- target/favorite organism helper lists.

Notable UX detail:

- font size and scale fields are hidden/disabled by default; unlock via `Ctrl+E`.

---

## 7. Core workflows

## 7.1 Glossary synchronization (`sync_gsheets`)

Four-phase sync logic:

1. import new valid remote rows (by `uid`),
2. upload new local rows to online sheets,
3. update modified rows from remote locally (and propagate feature rename to cassettes + aliases),
4. handle online-invalidated rows with deletion confirmation.

Also ensures worksheet creation (`features`, `organisms`, `logging`) when missing.

## 7.2 Report generation

- `generate_formblatt(lang)`
  - derives donor/recipient/risk context by traversing GMO -> plasmid -> cassette -> feature -> organism
  - returns dataframe for formatted Excel write
  - supports German default and English header translation
- `generate_plasmidlist()`
  - simple flattened plasmid export with status translation

## 7.3 ICE upload (`upload_ice`)

- authenticates via `icebreaker`,
- ensures per-initials ICE folder exists,
- creates missing plasmid parts,
- updates metadata/custom fields,
- attaches GenBank record text,
- can filter by selected plasmid (`thisice`) or all.

## 7.4 File upload (`upload_file_servers`)

Builds local export tree first (`user_data/initials[/plasmid]`) with:

- txt metadata summary,
- gb file (if present),
- attachment binaries.

Then optionally uploads to:

- Filebrowser (async client, path-level overwrite),
- Google Drive (folder or zip upload strategy).

## 7.5 Data import from another GMOCU DB (`import_data`)

- attaches external SQLite,
- computes importable plasmids by name difference,
- allows user selection (subset/all),
- imports plasmids and dependent cassettes/GMOs/attachments,
- imports missing referenced features/organisms,
- handles schema compatibility where source may lack `uid`.

---

## 8. Integrity and guard logic

## 8.1 Validation functions

- `check_plasmids`: duplicate names, missing backbone, missing cassettes, missing GMOs.
- `check_features`: missing glossary coverage for cassette tokens, redundant glossary entries, duplicates.
- `check_organisms`: missing glossary coverage for used organisms, redundant entries, duplicates.

## 8.2 Inline constraints in event flow

- duplicate feature annotation prevention,
- duplicate organism short-name prevention,
- disallow upload of placeholder/copy plasmid names,
- immutable-ish behavior for synced glossary records (fields disabled),
- extra edit controls gated by edit-protect state.

---

## 9. Event-driven behavior map (high level)

Main loop handles:

- PySimpleSQL mapped events (`db.process_events`)
- custom UI actions (about 50+ explicit event branches):
  - plasmid duplication, upload, add organism(s), destroy GMO date update
  - attachments/genbank import/export
  - glossary import/export/sync
  - validation checks
  - report generation
  - data import
  - settings info and hidden controls
  - graceful shutdown persistence

Autocomplete behavior is custom:

- fuzzy matching (`fuzzywuzzy`),
- tooltip rendering for candidate lists,
- keyboard-aware behavior (`Tab`, arrow events, enter/left-click interactions).

---

## 10. `pysimplesqlmod.py` role and customizations

`pysimplesqlmod.py` provides:

- schema reflection (`auto_add_tables`, `auto_add_relationships`),
- element/event auto-mapping by key convention,
- `Table` abstraction with search/navigation/CRUD,
- UI selector synchronization and edit-protect propagation.

Documented custom modifications in file:

- prompt-save disabled due known save behavior issue (`prompt_save` body short-circuited),
- delete flow extended with `ask` argument,
- Linux-specific size handling adjustments,
- several `# mod` tagged edits.

---

## 11. External integrations and dependencies

## 11.1 Libraries

Primary runtime dependencies include:

- `PySimpleGUI`
- `pandas`, `numpy`
- `gspread`, `gspread_dataframe`
- `PyDrive2`, `oauth2client`
- `icebreaker`
- `filebrowser_client`
- `fuzzywuzzy`
- `xlsxwriter`, `openpyxl`

## 11.2 Services

- Google Sheets API (glossary sync)
- Google Drive API (artifact uploads)
- JBEI/ICE API (plasmid registry sync)
- Filebrowser API (artifact tree upload)

---

## 12. Persistence and filesystem behavior

All working outputs are written into user home `GMOCU` directory:

- `gmocu.db`
- generated reports
- exported template/data files
- temporary upload folder trees
- optional Google service credential JSON (`gmocu_gdrive_credits.json`)
- backups (`gmocu_backup_YYYY-MM-DD.db`) during migration/import flows

---

## 13. Versioning and schema migration strategy

Migration logic is embedded in startup path and keyed by `Settings.version`.

Handled upgrades include:

- adding Settings columns (`version`, `horizontal_layout`, integration toggles),
- adding Filebrowser credential fields to `IceCredentials`,
- introducing `uid` and `synced` fields for glossary tables (with rebuild-style table migration),
- writing updated version number after successful migration.

Migration is interactive in places (popup confirmations), and may request restart.

---

## 14. Operational risks and technical debt (current state)

Observed characteristics:

- very large monolithic script (`gmocu.py`),
- mixed data access styles (ORM-like + raw SQL/pandas),
- many broad `except` usages with popup-only error handling,
- substantial GUI and business logic coupling,
- repeated state refresh snippets across event handlers,
- platform-conditional layout tuning via hardcoded constants.

These points are important context for a future modernization/rebuild effort.

---

## 15. Practical “what happens when” summary

- **Create new plasmid**: insert via mapped table action -> prompt for custom name -> manual cassette/GMO composition.
- **Add feature token to cassette**: choose in autocomplete + optional variant -> append token string using `-` separator.
- **Sync glossaries online**: bidirectional merge based on `uid`, plus local propagation of renamed features.
- **Generate Formblatt Z**: traverses full relation graph and exports formatted XLSX in user data folder.
- **Upload all**: always exports local artifacts, then conditionally pushes to ICE/Filebrowser/GDrive.
- **Import another DB**: selective plasmid import and dependency hydration for missing glossary entries.

---

## 16. Rebuild-relevant boundaries (for future architecture planning)

Current natural domain boundaries already visible in code:

1. `Settings + Credentials`
2. `Plasmid Catalog`
3. `Cassette Composition`
4. `GMO Lifecycle`
5. `Glossary Curation & Sync`
6. `Export/Reporting`
7. `External Publishing/Upload`
8. `Cross-instance Import/Merge`

These boundaries can be used directly as candidate modules in a modernized architecture.
