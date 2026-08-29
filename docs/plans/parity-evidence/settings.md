# Parity Evidence: Settings Entity

**Date:** 2026-08-27
**Scope:** Settings singleton (table/service/API), /settings page, Settings nav entry, settings-driven report filenames and footers

Grounded in the legacy source in-repo: `gmocu.sql` Settings table, report handlers using `user_name`/`initials`/`institution`.

---

## Legacy GMOCU behavior preserved

| Legacy behavior                                            | New implementation                                              | Verified by               |
| ---------------------------------------------------------- | --------------------------------------------------------------- | ------------------------- |
| Single settings row (name, initials, email, institution)   | `settings` singleton (id='default'), auto-created on first read | Service/API tests         |
| duplicate_gmos flag                                        | duplicateGmos boolean (consumed when plasmid duplication ships) | Service tests + UI toggle |
| Formblatt-Z filename `Formblatt-Z_{name}_{date}.xlsx`      | Sanitized name segment from settings                            | API test + live download  |
| Formblatt-Z footer `Formblatt Z, {institution}`            | Institution from settings (env GMOCU_INSTITUTION seeds default) | API read-back test        |
| Plasmid list footer `{initials} Plasmidlist, date: {date}` | Initials from settings                                          | API read-back test        |
| Plasmid list filename `Plasmidlist_{name}_{date}.xlsx`     | Sanitized name segment                                          | API test                  |

## Not applicable / deferred

- PySimpleGUI display settings (scale, font_size, style, horizontal_layout) — N/A for the web UI.
- Integration settings (ice/gdrive/filebrowser/autosync/zip, IceCredentials) — integrations milestone; schema grows additively.
- Legacy treated initials as immutable after first setup (upload folder naming); v2 keeps them editable until integrations land — the UI notes the file-naming impact.

## Verification results

- 234/234 Jest tests passing (8 new: service defaults/partial updates, API validation incl. email format, report filename/footer parity read back from the workbooks)
- `tsc --noEmit` clean, ESLint + Prettier clean
- `npm run db:init` added the settings table non-destructively
- Browser smoke: /settings via nav, autosave-on-blur with Saved indicators,
  inline invalid-email error (stale error now clears on revert), optimistic
  checkbox toggle, then Reports produced `Formblatt-Z_Jane_Lab_2026-08-27.xlsx`.
