# Parity Evidence: Attachments + GenBank

**Date:** 2026-08-28
**Scope:** Per-plasmid file attachments (BLOB storage, upload/download/delete) and the plasmid GenBank file (.gb/.gbk import, download, replace, remove), detail-panel sections for both

Grounded in the legacy source in-repo: `gmocu.sql` Attachments table; `gmocu.py` `insertBLOB`/`readBlobData` (lines 679–719), attachment events (2157–2172), GenBank import (2182–2207), file download (2211–2237).

---

## Legacy GMOCU behavior preserved

| Legacy behavior                                                        | New implementation                                              | Verified by                    |
| ---------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------ |
| Attachments stored as BLOBs in the database (file/Filename/plasmid_id) | `attachments` table with binary `data` + filename per plasmid   | Service tests + byte roundtrip |
| Any file type attachable; original basename kept                       | Upload keeps the client filename; no type restriction           | API test + live curl/UI        |
| Attachment download writes the stored bytes under the stored name      | GET /api/attachments/[id] with Content-Disposition filename     | Byte-identical roundtrip test  |
| GenBank import gate: ".gb or .gbk extension" only                      | Same message, VALIDATION 400 (extension check case-insensitive) | Service/API tests + UI smoke   |
| One GenBank file per plasmid; re-import overwrites content + name      | `genbank_files` keyed by plasmidId; PUT replaces in place       | Replace test (count stays 1)   |
| '•' marker + gb_name shown when a GenBank file exists                  | Panel GenBank card shows • + stored filename                    | UI smoke screenshot            |
| "There is no Genebank file to download."                               | NOT_FOUND 404 with equivalent message                           | API test                       |
| GenBank download uses the stored filename (gb_name)                    | ?download=1 with Content-Disposition of stored filename         | API test + live curl           |
| Attachments deleted implicitly with their plasmid                      | Plasmid delete cascade extended (attachments + genbank_files)   | Cascade test                   |

## Deliberate deviations (documented modernizations)

- **GenBank normalized out of the plasmid row.** Legacy stored `genebank`/`gb_name`/`gb` as Plasmids columns; v2 keeps them in `genbank_files` so list/search responses never carry full sequence text. The '•' presence marker is derived, like GMO_summary.
- **Size caps added** (attachments 25 MB, GenBank 5 MB) — legacy had none; guards the single-file SQLite database. Empty files rejected.
- **Extension check case-insensitive** (`.GB` accepted); legacy compared exact lowercase, which is hostile on case-insensitive filesystems.
- **Attachment metadata extended** with mimeType/sizeBytes for the UI; legacy stored only blob + name.
- Correction (2026-08-28): `gmocu.py` 1610–1615 copies attachments in the cross-instance **DB import** flow, not duplication — legacy duplication (2051–2086) does not copy attachments or GenBank, and neither does v2 (see plasmid-duplication.md).
- ICE/GDrive upload of `{name}.gb` (gmocu.py 1279, 1349) — integrations milestone.

## Verification results

- 244/244 Jest tests passing (10 new: service invariants, multipart upload via API routes, byte-identical download, extension gate, replace-in-place, delete cascade)
- `tsc --noEmit` clean, ESLint 0 errors, Prettier clean
- `npm run db:init` added both tables non-destructively to the live database
- Live curl smoke: multipart upload → 201; binary download byte-identical (`cmp`); `Content-Disposition: attachment; filename="Plasmid-A.gb"`; wrong extension → 400 with legacy message
- Browser smoke (Playwright): panel shows GenBank card (• filename, size, Download/Replace/Remove) and Attachments list (download link, size, Add file, delete with confirm); wrong-extension upload shows inline error; replace, delete, and re-import flows all verified; screenshots eyeballed
