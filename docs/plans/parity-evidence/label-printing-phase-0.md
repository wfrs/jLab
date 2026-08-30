# Parity evidence — Phase 0: schema and lab spreadsheet import

Feature: import `plasmids_JM_expanded.xlsx`, the lab's authoritative plasmid
record, and add the schema it needs. Prerequisite for label printing.

## Why the usual parity gate does not apply

Legacy GMOCU has **no label or print code** and **no spreadsheet import** of
this kind — `gmocu.py` reads only its own SQLite database and the two glossary
Excel templates. There is no legacy behaviour to compare against.

The standard is therefore fidelity to the lab's own artefacts:

| Artefact                                            | Role                          |
| --------------------------------------------------- | ----------------------------- |
| `gmocu/example/plasmids_JM_expanded.xlsx`           | Authoritative data            |
| `gmocu/example/plasmid_labels.docx` / `.pdf`        | Reference for expected values |
| `gmocu/example/glycerol_stock_labels.docx` / `.pdf` | Reference for expected values |

**Data flows one way.** The Word documents are partial print output, not a
second record: some labels were printed and never saved back, so a gap there
says nothing about the freezer. Nothing is ever read back from them. Confirmed
with the lab.

## Evidence

### Automated

`tests/integration/spreadsheet-import.test.ts` — 23 tests against the real
workbook. `tests/unit/lab-normalization.test.ts` — 24 tests on the pure helpers.
Full suite: **392 passing**, `tsc` clean, ESLint 0 errors.

The load-bearing assertion, since stock IDs are treated as derivable from
plasmid numbers everywhere else:

```
finds no stock ID that disagrees with its plasmid number
  -> 389/389 imported E. coli stocks satisfy derivedStockId(plasmid.name) === stock.stockId
```

### Live, against the real 244-plasmid database

Schema migration is additive and ran clean:

```
Added plasmids columns: constructName, insertName, insertSizeBp, category,
  bacterialResistance, plantResistance, box, sequencingResult, sequencingDate,
  comment, notes
Created table: plasmid_preps / glycerol_stocks / label_prints
```

`POST /api/import/spreadsheet`:

```
plasmids: { added: 151, updated: 239, skippedReserved: 15, skippedBlank: 0 }
preps:    { added: 387 }
stocks:   { added: 436, updated: 0, skippedReserved: 40, agrobacterium: 47 }
stockIdMismatches:    []
externalStocks:       [AJM7, AJM8, AJM16, AJM17, AJM18, AJM19 -> Tobi]
unresolvedPlasmidRefs: []
```

**239 updated** are the plasmids already present from the GMOCU `.db` import,
now carrying the construct names that importer discarded. Every label field
resolves:

| Label line     | Value after import                                       | Printed label                                  |
| -------------- | -------------------------------------------------------- | ---------------------------------------------- |
| pJM0001 line 1 | `pJM0001`                                                | `pJM0001`                                      |
| line 2         | `pMiso000`                                               | `pMiso000`                                     |
| line 3         | `2024-01-31`                                             | `JM 31.01.24`                                  |
| line 4         | `80` ng/µL                                               | `80.0 ng/µL`                                   |
| CJM1 lines 1–4 | `CJM1` · `E. coli` + `TOP10` · `pMiso000` · `2024-01-23` | `CJM1 / E. coli TOP10 / pMiso000 / 23.01.2024` |

The imported data was then reverted (`jlab.db` restored, schema re-applied) —
the task was to build the importer, not to load the lab's data.

## Deliberate deviations and decisions

**Construct name restored.** `import.service.ts` discards legacy
`Plasmids.alias` as "derived from cassettes". Measured across all 239 legacy
rows, `alias` equals the joined cassette content **0 times** (`pJM0001` is
alias `pMiso000`, cassettes `MCSpSEVA`). It is independent curated data and
line 2 of every label. Now imported as `constructName`.

**"Planned" is derived, not stored.** `pJM0355` and `pJM0356` are marked "not
designed yet". Rather than add a status value — awkward to alter in SQLite — a
plasmid with no prep record simply has not been made. The data-quality check
narrows further to plasmids whose glycerol stock number is also reserved and
unmade, so hand-entered plasmids are not swept up.

**Stock IDs are stored and asserted, not derived.** Deriving them at read time
is elegant but brittle if naming ever changes. The sheet's own value is stored
and compared against the derived one on import, so a divergence fails loudly.

**Uncertainty is preserved.** `bac: Kan???` normalizes to `Kan?`, not `Kan`.
Dropping the question mark would launder the author's doubt into a fact; a
data-quality check surfaces it instead.

**Placeholders never become numbers.** `parseDecimalCell` is strict: the lab
writes `xxx` while waiting on a Nanodrop reading, and a strip-then-`Number`
approach yields `0`, which would print `0.0 ng/µL` on a label. Covered by a
test.

**`Column1` is sheet-specific.** The lab asked for `Column1`, `Column2` and
`comment3` to be dropped — they hold stray sequencing verdicts on the plasmid
sheet. The Agrobacterium sheet has a _different_ `Column1` holding provenance
("from Tübingen") that reaches the printed label as `(Tübingen; #1)`, so it is
kept as `sourceNote`. **Worth confirming with the lab.**

**Preps are attributed to the configured user.** The workbook has no operator
column; it belongs to one person, and the few preps her students made are noted
only in prose ("midi prepped by INA"), preserved verbatim in `notes`. Preps
recorded in jlab from here on carry their own operator.

## Findings raised for the lab

Surfaced as data-quality checks rather than corrected during import, since the
spreadsheet is authoritative:

| Finding                        | Records                                                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| One strain under two organisms | `AS109` is `A. rhizogenes` on AJM20, AJM21, AJM38 but `A. tumefaciens` on AJM24. The printed label says _A. rhizogenes_. |
| Notes flagging bad data        | `pJM0018`, `pJM0019` — "the plasmids dates arent correct"                                                                |
| Uncertain resistance           | `pJM0117` — `Kan?`                                                                                                       |
| Planned, never made            | `pJM0355`, `pJM0356`                                                                                                     |
| Reserved stock numbers         | 40, including `CJM355` and `CJM356`                                                                                      |
