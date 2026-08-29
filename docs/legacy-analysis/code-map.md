# GMOCU code map

## 1. File-level map

## `gmocu.py`

Main executable module. Contains:

- app constants and startup setup,
- full UI layout declaration,
- DB initialization/migration,
- all business workflows,
- full event loop.

## `pysimplesqlmod.py`

Customized helper library that binds SQLite tables to PySimpleGUI widgets/events.

## `gmocu.sql`

Bootstrap SQL schema + initial seed values for status and settings.

## `gmocu.spec`

PyInstaller packaging definition including required template assets.

---

## 2. `gmocu.py` function map

## Settings and lookup

- `read_settings()`: loads `Settings` + selected `IceCredentials`, returns full runtime tuple.
- `autocomp()`: reads feature annotations for autocomplete options.
- `select_orga()`: reads organism short names for dropdowns.

## Binary/file helpers

- `convertToBinaryData(filename)`: reads file bytes.
- `insertBLOB(plasmidId, file, filename)`: stores attachment binary in `Attachments`.
- `readBlobData(attId, attName, path)`: writes stored attachment from DB to file.

## Glossary import/update helpers

- `add_to_features(wb)`: imports feature rows from dataframe, skipping existing annotations.
- `add_to_organisms(wb)`: imports organism rows from dataframe, skipping existing short names.
- `update_cassettes(old2new_annot_dict)`: propagates feature annotation rename into cassette strings.
- `update_alias(old2new_annot_dict)`: propagates feature annotation rename into plasmid aliases.
- `sync_gsheets()`: bidirectional glossary synchronization with Google Sheets.

## Export/reporting

- `generate_formblatt(lang)`: creates Formblatt-Z dataframe from GMO/cassette/feature/organism graph.
- `generate_plasmidlist()`: creates flattened plasmid list dataframe.

## External publishing

- `upload_ice(thisice, use_ice)`: create/update plasmid records in JBEI/ICE.
- `upload_file_servers(thisfile, use_filebrowser, use_gdrive, zip_files)`: local export + optional Filebrowser/GDrive upload.

## GMO/plasmid data manipulation

- `add_organism(organism_index)`: inserts GMO row for selected target organism and current plasmid.
- `import_data()`: imports selected plasmids and dependencies from another GMOCU database.

## Integrity checks

- `check_plasmids()`: duplicates and completeness checks.
- `check_features()`: glossary coverage/duplicates/redundancy checks for features.
- `check_organisms()`: glossary coverage/duplicates/redundancy checks for organisms.

## Autocomplete UI behavior

- `handler(event)`: click-handler helper for tooltip choice behavior.
- `clear_combo_tooltip(ui_handle)`: hides combo tooltip.
- `show_combo_tooltip(ui_handle, tooltip, space_ref, text_len)`: renders custom tooltip.
- `autocomplete(event, event_data, auto_options, ui_handle, space_ref, text_len)`: fuzzy-match and dropdown/tooltip behavior.
- `refresh_autocomp_options()`: refreshes in-memory options for `-AIN-` and `-FEATURECOMBO-`.

---

## 3. `gmocu.py` event map (explicit custom branches)

## Data and save flow

- `cassettesActions.table_insert`
- `cassettesActions.db_save`
- `featureActions.db_save`
- `settingsActions.db_save`
- `Settings.ice.quick_edit`
- `plasmidActions.table_insert`
- `featureActions.table_delete`
- `organismActions.table_delete`
- `organismActions.db_save`

## Plasmid and GMO operations

- `-DUPLICATE-`
- `-THISICE-`
- `-ADDORGA-`
- `-ADDFAV-`
- `-DESTROYORGA-`

## Attachment/GenBank operations

- `insElement`
- `-ALIAS_IN-`
- `insGb`
- `-down_gb-`
- `-down_att-`

## Autocomplete and keyboard flow

- `-LEFTCLICK-`
- `-ENTERKEY-`
- `\t` / `-DOWNKEY-`
- `-DROPDOWN-`
- `-ADDFEATURE-`

## Glossary import/export/sync

- `-ALLEXCEL-`
- `-ALLEXCELORGA-`
- `-USEDEXCEL-`
- `-USEDEXCELORGA-`
- `-ADDFEATURESEXCEL-`
- `-ADDEXCELORGA-`
- `-FEATURESYNC-` / `-ORGASYNC-`
- `-FEATUREINFO-`
- `-FEATURECOMBO-`
- `-ADDSELORGA-`
- `-COPYFAVORGA-`

## Validation and reporting

- `-CHECKFEATURES-`
- `-CHECKORGANISMS-`
- `-CHECKPLASMIDS-`
- `-SERVERS-`
- `-FORMBLATT-`
- `-PLASMIDLIST-`
- `-IMPORTGMOCU-`

## App/meta flow

- `-SETTINGSINFO-`
- `-CTRL-E-`
- `sg.WIN_CLOSED` / `Exit`

---

## 4. `pysimplesqlmod.py` class and API map

## Top-level helpers

- `eat_events(win)`: flushes synthetic timeout events after table updates.
- `escape(query_string)`: placeholder for query string escaping.

## `Row`

Wrapper for display value + primary key pairing in selectors/combo/list controls.

## `Relationship`

Describes parent/child relation used for auto-join and cascade requery behavior.

## `Table`

Key responsibilities:

- query composition (`set_query`, `set_join_clause`, `set_where_clause`, `set_order_clause`, `generate_query`),
- data refresh/navigation (`requery`, `first`, `last`, `next`, `previous`, `search`, `set_by_index`, `set_by_pk`),
- record operations (`insert_record`, `save_record`, `delete_record`),
- view helpers (`table_values`, `get_current*`, `get_description_for_pk`, `quick_editor`),
- callback support (`set_callback`).

## `Database`

Key responsibilities:

- lifecycle (`__init__`, `__del__`, `execute_script`, `commit`),
- schema reflection (`auto_add_tables`, `auto_add_relationships`),
- mapping (`auto_map_elements`, `auto_map_events`, `map_element`, `map_event`, `replace_event`),
- event dispatch (`process_events`),
- UI synchronization (`update_elements`, `disable_elements`, `edit_protect`),
- bulk actions (`save_records`, `requery_all`),
- metadata helpers (`get_parent`, `get_relationships_for_table`, `get_cascaded_relationships`).

---

## 5. `pysimplesqlmod.py` local modifications compared to upstream behavior

Tagged directly in file:

- prompt-save behavior disabled (`prompt_save` is short-circuited),
- deletion API expanded with `ask` switch in `delete_record`,
- Linux-size behavior adjustments.

These modifications are functional and part of GMOCU behavior assumptions.
