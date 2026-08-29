# GMOCU technology inventory

## 1) Languages and runtime

- Python 3.9 (targeted by setup docs)

## 2) Primary application framework

- PySimpleGUI (desktop UI)
- Local customized `pysimplesqlmod.py` for DB/UI binding

## 3) Data storage and processing

- SQLite (`sqlite3`)
- SQL bootstrap and migrations (`gmocu.sql` + runtime alters)
- pandas / numpy for query transformation and report shaping

## 4) Reporting and file formats

- XLSX generation via `xlsxwriter`
- XLSX read via `openpyxl` / pandas
- GenBank text persisted in DB and exported to `.gb` / `.gbk`
- Binary attachments persisted as SQLite BLOB

## 5) Search/autocomplete tooling

- fuzzywuzzy + Levenshtein-based matching

## 6) External integrations

- JBEI/ICE via `icebreaker`
- Google Sheets via `gspread` + `gspread_dataframe`
- Google Drive via `PyDrive2` + service-account credentials
- Filebrowser via `filebrowser-client`

## 7) Packaging and distribution

- PyInstaller (`gmocu.spec`)
- Embedded data assets:
  - SQL schema
  - template spreadsheets
  - Downloads info file

## 8) Environment and deployment helpers

- Conda environment bootstrap (`conda_environment.txt`)
- Docker Compose for local ICE + Postgres (`docker-compose.yml`)

## 9) Data and configuration locations

- User data folder: `${HOME}/GMOCU`
- DB location: `${HOME}/GMOCU/gmocu.db`
- local credentials file: `${HOME}/GMOCU/gmocu_gdrive_credits.json`

## 10) Security-relevant observations

- Contains code path that disables TLS verification for an obsolete Google CSV import flow (`-ADDGOOGLE-` branch, marked to be removed).
- Stores integration credentials in SQLite settings tables.
- Heavy use of broad exception handling and popup-based error reporting.
