# Parity Evidence: Formblatt Z + Plasmid List Reports

**Date:** 2026-08-27
**Scope:** ReportService (integrity gate + row assembly), XLSX workbook builders (exceljs), report API routes, /reports page, Reports nav entry, plasmids.backboneVector field (+ additive column migration)

Grounded in the legacy source in-repo: `gmocu.py` `generate_formblatt` (L1025+), `check_features`/`check_organisms` (L1720+), `-FORMBLATT-` handler with xlsxwriter formatting (L2554+), `generate_plasmidlist`.

---

## Legacy GMOCU behavior preserved

| Legacy behavior                                                                                                                                              | New implementation                                                          | Verified by                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- | -------------------------------------- |
| One Formblatt-Z row per GMO                                                                                                                                  | ReportService.buildFormblattZRows                                           | Service tests                          |
| 14 German columns (Nr. … Datum des Eintrags); optional English headers                                                                                       | FORMBLATT_HEADERS de/en, ?lang= param                                       | API tests (read-back)                  |
| Donor organisms/RGs from cassette tokens' glossary entries, joined `\|`                                                                                      | Token resolution via cassetteBaseTokens + feature.organism + organism RG    | Service tests (`E. coli\|A. victoria`) |
| Empty feature risk shown as 'None'                                                                                                                           | EMPTY_RISK_LABEL                                                            | Service tests                          |
| GVO Bezeichnung = organism short name + '-' + plasmid name                                                                                                   | Same composition (short name preferred)                                     | Service tests + live file              |
| Ausgangsvektor from plasmid backbone vector                                                                                                                  | New plasmids.backboneVector field (panel-editable)                          | API tests + live file                  |
| Generation gated on glossary integrity (missing features/organisms)                                                                                          | 400 with missingFeatures ("plasmid: token") / missingOrganisms lists        | Service/API tests + UI screenshot      |
| Formatting: landscape A4, fit 1 page wide, repeat header row, footer with institution, gray bold wrapped header, bordered wrapped cells, fixed column widths | exceljs pageSetup/headerFooter/styles with legacy widths [4,30,…,10]        | API read-back test                     |
| Filename Formblatt-Z_{date}.xlsx / Plasmidlist_{date}.xlsx                                                                                                   | Content-Disposition (user-name part deferred to Settings)                   | API tests + browser download           |
| Plasmid list export                                                                                                                                          | v2 field set (name, description, original vector, size, status, entry date) | Service/API tests                      |

## Deliberate changes

- **Entry date column uses the GMO's real entryDate** — legacy reused
  date_generated with a `# TODO:, fix` comment; v2 has the proper field.
- Legacy wrote files to the user-data folder; v2 serves a browser download.
- Institution comes from GMOCU_INSTITUTION env (Settings entity pending).

## Deferred (documented, not dropped)

- Redundant/duplicate glossary entry reporting (legacy check returns them; not yet surfaced)
- User initials/name in filenames and plasmid-list footer (Settings milestone)

## New dependency

- **exceljs 4.4.0** — XLSX generation with print formatting (column widths,
  fills, borders, page setup, footers). Replaces legacy pandas/xlsxwriter.

## Verification results

- 214/214 Jest tests passing (13 new: 8 service + 5 API incl. XLSX read-back
  of headers, data cells, and print setup)
- `tsc --noEmit` clean, ESLint + Prettier clean
- `npm run db:init` added backboneVector via additive migration (data intact)
- Browser smoke: integrity gate blocks with itemized missing lists →
  data completed → Formblatt-Z_2026-08-27.xlsx downloads; file re-read with
  exceljs confirms headers, donor joins, vector, GVO name, landscape.
  Plasmid list downloads too. Screenshots captured.
