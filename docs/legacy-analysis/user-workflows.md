# GMOCU user workflows

## 1) First-time setup workflow

1. Start app.
2. App creates user data folder and initializes `gmocu.db` if missing.
3. User enters initials on first run.
4. User fills settings:
   - profile/institution
   - credentials and service toggles
   - optional Google IDs
5. User saves settings.
6. If enabled, app syncs glossaries with Google Sheets.

## 2) Core plasmid documentation workflow

1. User creates a plasmid entry.
2. User fills core metadata (name, vector, purpose, summary).
3. User creates one or more cassette entries.
4. User composes cassettes via feature autocomplete and variants.
5. User adds one or more GMO records linked to organisms.
6. User attaches GenBank and additional files.
7. User saves and optionally duplicates for derivative constructs.

## 3) Glossary curation workflow (local)

1. User imports `Nucleic acids` and `Organisms` from templates or edits manually.
2. User fixes duplicate or invalid entries as prompted.
3. User runs glossary completeness checks.
4. User updates missing items until checks pass.

## 4) Shared glossary workflow (Google Sheets)

1. Team configures shared sheet and service account credentials.
2. User clicks sync.
3. App:
   - downloads new valid entries
   - uploads unsynced local entries
   - applies remote edits locally
   - updates existing cassettes/aliases when annotations changed
4. User confirms deletion of locally present entries marked invalid online.

## 5) Export and compliance workflow

1. User validates data (`Check features`, `Check organisms`, `Check plasmids`).
2. User generates:
   - Formblatt Z
   - Plasmid list
3. App writes formatted XLSX reports to user data folder.

## 6) Publication/upload workflow

1. User enables target services in Settings.
2. User chooses:
   - upload all (`Run` in GMO tab), or
   - update selected plasmid (`UP` button).
3. App always builds local export artifacts.
4. App uploads enabled targets:
   - ICE metadata + records
   - Filebrowser folder trees
   - Google Drive folders or ZIPs

## 7) Multi-user merge workflow

1. User selects another `gmocu.db` via import.
2. App computes non-duplicate plasmids.
3. User chooses subset/all to import.
4. App imports plasmids plus related cassettes/GMOs/attachments.
5. App resolves missing feature/organism dependencies.
6. App refreshes UI tables.

## 8) Operational guard workflows

- Edit-protect mode is default; editing is enabled through mapped actions.
- Synced glossary rows are protected from direct editing.
- Invalid upload names (placeholder/copy names) are blocked.
- Missing prerequisites produce popup guidance.
