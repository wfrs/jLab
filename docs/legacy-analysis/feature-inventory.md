# GMOCU feature inventory

## 1) Plasmid management

- Create, browse, search, edit, and delete plasmid records.
- Track plasmid metadata:
  - name, alias, status, clone
  - purpose and cloning summary
  - backbone/original vector
  - dates (generated/destroyed/entry date)
- Duplicate plasmids (with optional GMO duplication behavior from settings).
- Copy cassette content into plasmid alias.

## 2) Cassette composition

- Add and edit cassette entries linked to plasmids.
- Compose cassette content using standardized feature tokens.
- Add feature variants via bracket notation.
- Validate cassette features against glossary.
- Auto-propagate glossary annotation renames to cassette content.

## 3) GMO management

- Add GMO entries linked to plasmids and selected organisms.
- Batch-add GMOs from favorite organisms.
- Set/track approval, target risk group, generated/destroyed dates.
- Build summarized GMO strings for list display and reporting.
- Mark GMO destruction date and update summary text.

## 4) Attachment and GenBank handling

- Attach arbitrary binary files to plasmids (BLOB in SQLite).
- Download stored attachments to user data folder.
- Import `.gb` / `.gbk` files and persist GenBank text to DB.
- Export GenBank content back to files.

## 5) Glossary management (Nucleic acids and Organisms)

- Full CRUD through table views.
- Excel import of new entries using templates.
- Excel export:
  - all entries
  - used entries only
- Duplicate and completeness checks.
- Glossary integrity enforcement during report generation/upload.

## 6) Target and favorite organism lists

- Maintain "Target organisms" shortlist for fast GMO generation.
- Maintain "Favorite organisms" list for one-click batch GMO creation.
- Guardrail: favorites must exist in target list.

## 7) Online glossary synchronization (Google Sheets)

- Bi-directional sync between local DB and shared Google Sheets.
- Auto-create expected worksheets (`features`, `organisms`, `logging`) when missing.
- Import new valid online entries (by UID).
- Upload new local entries.
- Apply remote edits to local entries.
- Propagate renamed features into cassettes and aliases.
- Handle remote invalidation (`valid != 1`) with local deletion prompt.
- Optional autosync on startup and save events.

## 8) External publication and file delivery

- JBEI/ICE upload/update:
  - create missing parts
  - update metadata/custom fields
  - attach GenBank records
  - organize in user-initials folder
- Filebrowser upload:
  - upload generated local export trees
  - per-user overwrite behavior
- Google Drive upload:
  - folder or ZIP strategy
  - overwrite/update per plasmid or full export

## 9) Reporting and exports

- Formblatt Z (German regulation format) generation.
- Optional English column headers for Formblatt export.
- Plasmid list generation.
- Formatted XLSX output with print-ready settings and metadata footer.

## 10) Cross-instance data import

- Import plasmids from another `gmocu.db`.
- User-selective import (`selected` vs `all`).
- Import dependent cassettes, GMOs, attachments.
- Detect and import missing referenced features/organisms.
- Schema compatibility path for old DBs without UID columns.
- Optional backup before import.

## 11) Maintenance and data quality checks

- Check duplicated plasmid names.
- Check missing plasmid backbone, cassettes, GMOs.
- Check missing features used in cassettes.
- Check missing organisms used by features/GMOs.
- Detect redundant glossary entries.
- Detect duplicate glossary entries.

## 12) Settings and runtime behavior

- User identity and institutional metadata.
- Credential profile management for ICE/Filebrowser.
- Google Sheet and folder IDs.
- Feature toggles:
  - use_ice
  - use_filebrowser
  - use_gdrive
  - zip_files
  - duplicate_gmos
  - upload_completed
  - autosync
- Theme and layout controls.
- Hidden advanced controls (`Ctrl+E`) for scale and font.
