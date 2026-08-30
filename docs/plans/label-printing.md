# Label printing — implementation plan

Status: **complete** — Phases 0 to 3 built, one item blocked on the lab.

Evidence: [phase 0](parity-evidence/label-printing-phase-0.md) ·
[phase 1](parity-evidence/label-printing-phase-1.md) ·
[phase 2](parity-evidence/label-printing-phase-2.md) ·
[phase 3](parity-evidence/label-printing-phase-3.md).

Replaces a manual Microsoft Word workflow. The lab keeps two `.docx` files of
label grids, types each label by hand, shrinks the font when a construct name
overflows, exports to PDF, prints and cuts. Everything on those labels already
exists in `plasmids_JM_expanded.xlsx`, so the work is to import that file and
render from it — not to build a label editor.

## Source of truth

This feature has **no legacy GMOCU counterpart**; `gmocu.py` contains no label
or print code. The parity gate in AGENTS.md has nothing to compare against, so
"parity" here means fidelity to the lab's own artefacts:

| Artefact                                   | Role                                                 |
| ------------------------------------------ | ---------------------------------------------------- |
| `gmocu/example/plasmids_JM_expanded.xlsx`  | **Authoritative data.** Every field comes from here. |
| `gmocu/example/plasmid_labels.docx`        | Print specification (geometry read from its XML).    |
| `gmocu/example/glycerol_stock_labels.docx` | Print specification.                                 |
| The exported PDFs                          | Reference renderings for visual comparison only.     |

**The Word documents are output, not a second record.** Some labels were
printed and never saved back into the files, so gaps there mean nothing. Data
never flows back from them — notably, four rows are missing a concentration and
the printed labels appear to supply it, but `pJM0021`'s label reads
`21.2 ng/µL` for a construct that no longer holds that number. Those rows stay
empty and get flagged.

## Settled decisions

| Decision                       | Choice                                        | Source   |
| ------------------------------ | --------------------------------------------- | -------- |
| Print medium                   | Plain paper, cut out — borders are cut guides | Robin    |
| Output                         | In-app print preview, CSS `@page`             | Robin    |
| Prep data                      | Stored as history; label uses the newest      | Robin    |
| Import source                  | The spreadsheet, not the GMOCU `.db`          | analysis |
| Cleanup                        | In the importer, never by hand                | analysis |
| Label size                     | Unchanged — 35.56 mm fits the tubes           | analysis |
| Resistance                     | Two fields: bacterial and plant               | Julia    |
| Accession numbers              | Permanent and unique; no renumbering          | Julia    |
| Re-prep                        | Happens when a tube runs empty; newest wins   | Julia    |
| Practical-course labels        | Out of scope                                  | Julia    |
| `Column1`/`Column2`/`comment3` | Not imported                                  | Julia    |
| Glycerol stock remakes         | One current date per stock, overwritten       | analysis |

A server-side PDF library was considered and rejected: it adds a dependency and
needs a metric-compatible substitute font, since Aptos and Calibri are not
redistributable. A PDF endpoint remains possible later without touching the
layout code.

### Verified facts the design leans on

- `plasmids.name` already holds the accession number (`pJM0001`…). Nothing to invent.
- Glycerol stock IDs align with plasmid numbers on **404 of 404** rows.
- `pJM0021` is the sole row without a CJM, because its stock is Agrobacterium (`AJM24`).
- 405 unique IDs, 0 duplicate construct names, 387/387 real date values.
- The plasmids page **already has row selection** (`selectedRows`, `onRowSelect`,
  and a selection action bar) at [page.tsx:52](../../src/app/plasmids/page.tsx#L52)
  and [page.tsx:497](../../src/app/plasmids/page.tsx#L497). Printing is a new
  action in an existing bar, not new selection machinery.

---

## Phase 0 — Schema and spreadsheet importer — **done**

The prerequisite for everything, and worth shipping alone: it takes the app from
244 plasmids to 390 real ones and fills fields nothing else can. Phases 1 and 2
add no new data — they render what this phase imports.

Delivered: 11 plasmid columns, three tables, `lab-normalization.ts`,
`spreadsheet-import.service.ts`, two repositories, `plasmid-prep.service.ts`,
`POST /api/import/spreadsheet`, `SpreadsheetImportSection`, and six
data-quality checks. 47 new tests; suite at 392.

Two changes from the plan below, both driven by the data:

- `sourceNote` was added to `GlycerolStock`. The Agrobacterium sheet's
  `Column1` holds provenance ("from Tübingen") that prints on the label as
  `(Tübingen; #1)` — a different column from the plasmid sheet's `Column1`,
  which is dropped as agreed. **Confirm with the lab.**
- Preps are attributed to the configured user, since the workbook has no
  operator column.

### 0.1 Domain types

`src/domain/types.ts` — extend `Plasmid`:

```ts
constructName?: string;      // sheet `name`, legacy `alias` — line 2 of every label
insertName?: string;         // sheet `insert` ('insert' is SQL-reserved)
insertSizeBp?: number;
category?: string;           // EV | cassette | CDS | promoter | c-tag | terminator | binary | t-arm | addgene | …
bacterialResistance?: string;
plantResistance?: string;
box?: number;                // freezer box, 1–5
sequencingResult?: string;   // free text: verdict + method
sequencingDate?: string;     // ISO date
comment?: string;            // sheet `comment`
notes?: string;              // sheet `other comment`
```

New entities:

```ts
export interface PlasmidPrep {
  id: string;
  plasmidId: string;
  preppedOn: string; // ISO date
  operatorInitials: string; // JM | INA | LN
  concentrationNgUl?: number; // absent = prepped, not yet measured
  createdAt: Date;
  updatedAt: Date;
}

export interface GlycerolStock {
  id: string;
  stockId: string; // CJM1 | AJM5.1
  plasmidId?: string; // absent for strain-only and external stocks
  organism: string; // E. coli | A. tumefaciens | A. rhizogenes
  strain: string; // TOP10 | GV3101 pMP90 (Goldbio) | …
  constructLabel?: string; // when there is no linked plasmid
  madeOn?: string; // ISO date; absent = number reserved, not made
  operatorInitials?: string;
  bacterialResistance?: string; // multi-valued for Agrobacterium: "Kan + Gen + Rif"
  externalSource?: string; // "Tobi" — obtained from someone else
  parentStockId?: string; // AJM5.1 → AJM5
  createdAt: Date;
  updatedAt: Date;
}

export interface LabelPrint {
  id: string;
  kind: 'plasmid' | 'glycerol';
  targetId: string;
  printedAt: string;
}
```

**Deliberately not modelled.** "Planned but not designed yet" (`pJM0355`,
`pJM0356`) is _derived_: a plasmid with an ID and name but no prep record does
not physically exist. No new status value, no extra column.

### 0.2 Schema

`src/infrastructure/database-init.ts`, following the existing additive-alter
pattern used for `backboneVector` at [database-init.ts:48](../../src/infrastructure/database-init.ts#L48).

- Ten `hasColumn` guards adding the new `plasmids` columns.
- `createTableIfMissing('plasmid_preps')` — index `plasmidId`, index `preppedOn`.
- `createTableIfMissing('glycerol_stocks')` — unique `stockId`, index `plasmidId`.
- `createTableIfMissing('label_prints')` — index `(kind, targetId)`.

### 0.3 Normalisation helpers

`src/domain/lab-normalization.ts` — pure, unit-tested, no I/O:

| Function                   | Behaviour                                                                                                                                       |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `normalizeResistance(raw)` | `bac: Kan` / `bac:Kan` / `Bac: Kan` / `Bac:Kan` → `Kan`. Strips the `bac:` prefix, trims, title-cases. Splits `Gen + Rif` into an ordered list. |
| `parseSheetDate(v)`        | Accepts a JS `Date`, `20.06.2024`, `25.03.25`, `07.06.26` → ISO. Two-digit years pivot at 70.                                                   |
| `blankToNull(v)`           | `''`, `-`, `–`, whitespace → `null`.                                                                                                            |
| `parseAccession(name)`     | `pJM0001` → `{ prefix: 'p', initials: 'JM', number: 1 }`; `null` if it doesn't match.                                                           |
| `derivedStockId(name)`     | `pJM0001` → `CJM1`. Used to assert the import invariant.                                                                                        |
| `parseAliquot(stockId)`    | `AJM5.1` → `{ parent: 'AJM5', aliquot: 1 }`.                                                                                                    |

### 0.4 Repositories and services

New, following `plasmid.repository.ts` / `plasmid.service.ts` and extending the
`Repository<T>` base at [repository.ts](../../src/services/repository.ts):

- `src/services/plasmid-prep.repository.ts` + `.service.ts`
  - `listForPlasmid(plasmidId)` — newest first
  - `latestForPlasmid(plasmidId)`
  - `latestForPlasmids(ids)` — one query, for the label batch
  - `recordBatch(input)` — one transaction, many plasmids, shared date and initials
- `src/services/glycerol-stock.repository.ts` + `.service.ts`
  - `listByPlasmid`, `getByStockId`, `listForLabels(ids)`

Services own transactions (ADR-0005); Zod at the boundary (ADR-0007).

### 0.5 The importer

`src/services/spreadsheet-import.service.ts`, modelled on the existing
`import.service.ts`:

```ts
inspectWorkbook(data: Buffer): Promise<SpreadsheetInspection>
importWorkbook(data: Buffer, options?: ImportOptions): Promise<SpreadsheetImportResult>
```

One transaction for the whole workbook. Sheets located by name with a
header-sniff fallback, matching `glossary-excel.service.ts`.

**Sheet `plasmids + E.coli glycerol` → plasmid + prep + E. coli stock**

| Column                                                           | Target                                                   |
| ---------------------------------------------------------------- | -------------------------------------------------------- |
| `ID`                                                             | `plasmids.name`                                          |
| `name`                                                           | `plasmids.constructName`                                 |
| `details`                                                        | `plasmids.description`                                   |
| `insert`, `insert size [bp]`                                     | `insertName`, `insertSizeBp`                             |
| `category`                                                       | `category`                                               |
| `markers`                                                        | `bacterialResistance` (+ `plantResistance` when present) |
| `total size [bp]`                                                | existing `sizeBp`                                        |
| `concentration [ng/µL]` + `date plasmid`                         | one `plasmid_preps` row                                  |
| `box`                                                            | `box`                                                    |
| `Sequencing? (ONT/Sanger?)`, `date sequencing`                   | `sequencingResult`, `sequencingDate`                     |
| `Glycerol stock ID`, `Date Glycerol Stock`, `Organism`, `Strain` | one `glycerol_stocks` row                                |
| `comment`, `other comment`                                       | `comment`, `notes`                                       |
| `Column1`, `Column2`, `comment3`                                 | **ignored**                                              |

**Sheet `Glycerol Agro` → glycerol stocks**

`ID` → `stockId`; `Plasmid` → `plasmidId` by accession lookup, except the six
`Tobi` rows which set `externalSource` and leave `plasmidId` null;
`Construct Name` → `constructLabel`; `Antibiotic Resistance` →
`bacterialResistance`; `.1`/`.2` suffixes set `parentStockId`.

**Sheet `parts`** — not imported.

**Rules**

- Rows with an ID but no name (`pJM0391`–`pJM0405`) are skipped as reserved.
- A prep row is created only when a date _or_ concentration is present.
- A glycerol stock with no date is imported with `madeOn` null — the number is
  reserved, the stock does not exist.
- Idempotent: re-importing matches on `plasmids.name` and updates rather than
  duplicating. Report added / updated / skipped counts per sheet.

### 0.6 API and UI

- `src/app/api/import/spreadsheet/route.ts` — `POST` multipart, Zod-validated,
  ADR-0008 envelope. Mirrors `src/app/api/import/route.ts`.
- `src/components/settings/SpreadsheetImportSection.tsx` — sits beside the
  existing `ImportSection`, reports the same per-sheet counts.
- Surface `constructName` in the plasmid table and `PlasmidDetailPanel`.

### 0.7 Data-quality checks

Extend `src/services/data-quality.service.ts` with checks that turn Julia's
prose notes into structured state:

| Check                           | Severity | Fires on                                     |
| ------------------------------- | -------- | -------------------------------------------- |
| `plasmid-missing-concentration` | warning  | `pJM0376`, `pJM0380`                         |
| `plasmid-planned-not-made`      | info     | `pJM0355`, `pJM0356`                         |
| `plasmid-flagged-in-comment`    | warning  | `pJM0018`, `pJM0019` — "dates arent correct" |
| `stock-reserved-not-made`       | info     | 17 reserved stock IDs                        |
| `plasmid-no-glycerol-stock`     | info     | `pJM0021` — has an Agro stock instead        |

### 0.8 Tests — `tests/integration/spreadsheet-import.test.ts`

Against the real file, in-memory SQLite via `tests/helpers/test-db.ts`:

- imports 390 named plasmids; skips 15 reserved rows
- **asserts `derivedStockId(name) === stockId` for all 404 stock-bearing rows**
- `pJM0021` imports with no E. coli stock; `AJM24` links to it
- `pJM0355`/`pJM0356` import with a stock ID and no `madeOn`
- the six `Tobi` rows import with `externalSource` and no `plasmidId`
- `AJM5.1` and `AJM5.2` resolve `parentStockId` to `AJM5`
- resistance normalisation collapses all 14 spellings
- `Column1`/`Column2`/`comment3` are absent from every record
- re-import is idempotent — counts unchanged, no duplicates
- unit tests for every function in `lab-normalization.ts`

**Acceptance:** import the real workbook into a clean database and see 390
plasmids, 390 preps, 404 E. coli stocks, 38 Agrobacterium stocks, and
`/api/health` still `ok: true`.

---

## Phase 1 — Plasmid labels — **done**

Evidence: [parity-evidence/label-printing-phase-1.md](parity-evidence/label-printing-phase-1.md).

Delivered: `label-layout.ts`, `label-content.ts`, `label.service.ts`,
`label-print.repository.ts`, `GET /api/labels/plasmids`,
`POST /api/labels/prints`, `POST /api/plasmids/preps`,
`GET /api/plasmids/[id]/preps`, `/labels/print`, `LabelSheet`, `PlasmidLabel`,
`useAutoFit`, `RecordPrepDialog`, `PrepHistorySection`. 86 new tests; suite at 478.

Four corrections the `.docx` XML forced on the plan below:

- **60 labels per sheet, not 56.** The document's own
  `lastRenderedPageBreak` markers put the first break at table row 16, so page
  one carried 15 rows of 4. Word grows rows to fit their content, giving 13–15
  per page across the file; a fixed 15-row grid is what the geometry yields.
- **A4 is exactly 210 × 297 mm**, not `twipsToMm(11906)` = 210.0086 mm. A sheet
  wider than the paper `@page` declares makes the browser emit a blank page
  after every sheet. Caught by a test.
- **Only the accession is bold** — 413 of 413, against 50 %, 68 % and 88 % on
  the lines below, which is hand-typing drift rather than a rule.
- **The 3-line labels are not a second shape.** All 280 are lines 2 and 3 run
  together by a missed line break (`pPXm_35Spr-PhiC31-FLAGJM 25.03.2026`).

Also fixed: `PlasmidService.deletePlasmid` cascaded to every child table except
the three Phase 0 added, orphaning preps and print history.

Playwright is installed (`npm run test:e2e`, 15 Chromium tests). It caught two
bugs nothing else could: every ordinary label was rendering at 7 pt because the
cell was sized to _exactly_ its content and sub-pixel rounding read an overflow,
and the grid's top rule overhung the last column by 17 mm.

### 1.1 Layout domain

`src/domain/label-layout.ts` — pure and unit-tested, no DOM:

```ts
export const MM_PER_TWIP = 25.4 / 1440;
export const A4 = { widthMm: 210, heightMm: 297 };
export const PLASMID_LABEL = {
  cellWidthMm: 35.56, // w:gridCol 2016
  minCellHeightMm: 7.62, // w:trHeight 432
  marginMm: 25.4, // w:pgMar 1440
  padTopMm: 0.51,
  padSideMm: 1.02,
  borderPt: 0.5, // TableGrid w:sz 4
  columns: 4,
  fontStepsPt: [8, 7, 6, 5], // matches the hand-shrinking in the original
};
export function labelsPerPage(spec): { columns: number; rows: number; total: number };
export function pageCount(labelCount, spec, startOffset): number;
```

`labelsPerPage(PLASMID_LABEL)` returns 60 — see the correction above.

### 1.2 Rendering

- `src/app/labels/print/page.tsx` — client component; reads
  `?kind=plasmid&ids=…&startAt=N`, fetches payloads, renders, offers **Print**.
- `src/components/labels/LabelSheet.tsx` — CSS grid at the exact geometry.
- `src/components/labels/PlasmidLabel.tsx` — four centred lines, first two bold.
- `src/components/labels/useAutoFit.ts` — `useLayoutEffect`, steps
  8 → 7 → 6 → 5 pt while `scrollHeight > clientHeight`, then wraps.
- Print CSS: `@page { size: A4; margin: 25.4mm }`, `break-inside: avoid` per row,
  a screen-only toolbar hidden by `@media print`.
- Font stack `Carlito, Calibri, sans-serif` — Carlito is metric-compatible with
  Calibri, so the fit matches the original even without Aptos.

### 1.3 Data and API

`src/app/api/labels/plasmids/route.ts` — `GET ?ids=`, returns per plasmid:

```ts
{
  (accession, constructName, operatorInitials, preppedOn, concentrationNgUl);
}
```

joined from the newest prep. Formatting rules: date as `DD.MM.YY`,
concentration to one decimal with the `ng/µL` suffix, and a placeholder
(`xxxx ng/µL`) when a prep exists without a measurement.

### 1.4 Prep entry

Batch, because that is how the bench works — `pJM0084`–`pJM0096` all share
`06.11.24`, `pJM0153`–`pJM0161` all share `12.03.25`.

- `src/components/plasmids/RecordPrepDialog.tsx` — opens from the existing
  selection bar: one date, one set of initials, one concentration field per
  selected plasmid, saved through `recordBatch` in a single transaction.
- `src/components/plasmids/PrepHistorySection.tsx` — in `PlasmidDetailPanel`,
  newest first, latest marked as current.

### 1.5 Wiring

- "Print labels" and "Record prep" join the existing selection action bar at
  [page.tsx:497](../../src/app/plasmids/page.tsx#L497).
- `/labels` is **not** added to `AppNav` — it is reached from a selection, and
  the nav's four items stay as they are.
- `POST /api/labels/prints` records what was generated — the complete print
  history the Word workflow never kept.

### 1.6 Tests

- `tests/unit/label-layout.test.ts` — 56 per page; twip and millimetre
  conversions; page counts with a start offset; fit-step ordering.
- `tests/integration/label.api.test.ts` — payload shape; newest prep wins when
  two exist; placeholder for an unmeasured prep; unknown id → 404.
- `tests/integration/plasmid-prep.test.ts` — batch insert is atomic; a failed
  row rolls the whole batch back; `latestForPlasmids` returns one row each.
- Playwright: render `/labels/print`, assert 4 columns, 56 cells on page one,
  35.56 mm cell width within tolerance, and that
  `pMisoMFG_virEp-TrmAE358Q-GST-virD2(53C)-rnpBt` — 6 pt by hand in the
  original — fits without overflow.

**Acceptance:** select 56 plasmids, print, and place the output beside page 1 of
`plasmid_labels.pdf`. Same grid, same content, no overflow, no manual resizing.

---

## Phase 2 — Glycerol stock labels — **done**

Evidence: [parity-evidence/label-printing-phase-2.md](parity-evidence/label-printing-phase-2.md).

Delivered: `GLYCEROL_LABEL`, `buildGlycerolLabelLines`, `formatStockDate`,
`compareStockIds`, `LabelSegment`, `glycerol-stock.service.ts`,
`GET /api/labels/glycerol`, `/api/glycerol-stocks` (+ `[id]`),
`GlycerolLabel`, `LabelLines`, `GlycerolStockSection`, and a
`stock-construct-name-mismatch` data-quality check. 45 new tests; suite at 533
Jest plus 26 Playwright.

Three corrections the `.docx` forced on the plan below:

- **There is no five-line label.** The one five-paragraph cell is CJM260's
  construct name hand-wrapped, not a fifth field, and AJM16 is a four-line
  label. Cells are sized for four lines, as in Phase 1.
- **Only the organism is italic**, not the whole organism-and-strain line — a
  paragraph-level reading said otherwise; runs say `E. coli` italic beside a
  roman `TOP10`, 470 times out of 472.
- **Dates use `DD.MM.YYYY` here**, the opposite of the plasmid labels.

Not reproducible: the `(Tübingen; #1)` provenance line on six labels — the
spreadsheet does not carry the source in a usable form. See the evidence note.

No new data: Phase 0 already imported the stocks. This is rendering plus entry.

### 2.1 Layout

`GLYCEROL_LABEL` in `label-layout.ts`: `cellWidthMm: 38.10` (w:gridCol 2160),
left-aligned, same margins and borders.

Cells are **content-sized, not fixed at four lines** — the Agrobacterium labels
vary:

| Shape        | Lines | Example                                                                     |
| ------------ | ----- | --------------------------------------------------------------------------- |
| Strain only  | 3     | `AJM1` · `A. tumefaciens GV3101 pMP90 (CPGE)` · `20.06.2024`                |
| Transformed  | 4     | `AJM30` · strain · `pMisoMFG_Tetp-NLS-B3-GALLS(41C)-rnpBt (pJM0347)` · date |
| Two plasmids | 5     | `AJM16` · strain · `pMiso011 hp` · `pPSUP_35SproFL-GeNL` · date             |

### 2.2 Rendering

- `src/components/labels/GlycerolLabel.tsx` — genus and species italic, strain
  roman. Renders `E. coli TOP10` from `organism` + `strain`, and appends the
  plasmid accession in parentheses for Agrobacterium stocks.
- `/labels/print?kind=glycerol&ids=…` reuses `LabelSheet` and `useAutoFit`.
- `src/app/api/labels/glycerol/route.ts`.

### 2.3 Entry

`src/components/plasmids/GlycerolStockSection.tsx` in the detail panel: stock
ID, organism, strain, made-on, resistance. Remaking a stock updates `madeOn` in
place — the sheet's own model, confirmed against `CJM348`, `CJM353`, `CJM369`
and `CJM370`, where the sheet holds the latest date each time.

### 2.4 Tests

- Genus italic, strain roman; 3-, 4- and 5-line shapes all render.
- Aliquots `AJM5.1` and `AJM5.2` render under their own IDs.
- External stocks render without a plasmid line.
- Playwright diff against page 1 and page 10 of the updated `glycerol_stock_labels.pdf`.

---

## Phase 3 — Polish — **done except one blocked item**

Evidence: [parity-evidence/label-printing-phase-3.md](parity-evidence/label-printing-phase-3.md).

Delivered: `StartCellPicker`, the dense layout (`A4_DENSE_PAGE`),
`ReprintHistory` with `GET /api/labels/prints`, and the Golden Gate calculator
(`golden-gate.ts`, `/api/tools/golden-gate`, `/tools/golden-gate`). 34 new
tests; suite at 567 Jest plus 32 Playwright.

Corrections to the items below:

- **The dense sheet holds 85, not 75.** 10 mm margins give 5 x 17 for plasmid
  labels; the glycerol label misses a fifth column by half a millimetre
  (190 / 38.10 = 4.9869) and gets 4 x 17 = 68. The lab's 390 plasmid labels go
  from 7 sheets to 5.
- **Subscript rendering is not built.** It still needs a convention from Julia,
  as item 4 predicted; nothing in the data separates a meaningful underscore
  from the many that carry no typographic meaning.

Independent, none blocking:

1. **Partial-sheet offset UI** — a visual picker for the first free cell rather
   than a `startAt` query parameter.
2. **Dense layout** — a setting for 10 mm margins: 5 columns × 15 rows = **75
   labels per sheet** at the identical label size, 34 % less paper.
3. **Reprint from history** — re-print any past label set from `label_prints`.
4. **Subscript rendering.** The original marks `TrmA_E358Q` as subscript in 18
   places, but underscores appear throughout construct names with no
   typographic meaning, so this cannot be inferred. Needs an explicit
   convention from Julia before it is worth building — low priority.
5. **Golden Gate calculator** — a separate feature, not label work. The `parts`
   sheet computes `ng for 40 fmol = (40 × ((bp × 615.96) + 36.04)) × 1e⁻⁶`,
   then stock volume for 30 µL at target and the Tris-HCl to top up (inserts at
   40 fmol, backbones at 20 fmol). It returns negative Tris volumes when a
   stock is too dilute — `pMiso211b_new` gives −44.8 µL — which an app version
   should report as "too dilute" instead. Precedent exists in
   [primer-calc.ts](../../src/domain/primer-calc.ts).

---

## Cross-cutting

**Sequencing.** Every phase ends with `tsc` clean, ESLint clean, the full suite
green, and a live check against the running app. Each phase is independently
shippable; Phase 0 gates 1 and 2, which are then parallel.

**Parity evidence.** `docs/plans/parity-evidence/label-printing.md` records that
no legacy behaviour exists, and grounds the print specification in the `.docx`
XML instead — page setup, column widths, row rules, borders, the font-size
histogram — with screenshots beside the original PDF pages.

**Risks**

| Risk                                     | Mitigation                                                                  |
| ---------------------------------------- | --------------------------------------------------------------------------- |
| Browser print margins differ from Word's | Assert cell width in the Playwright PDF; document the browser used          |
| Carlito absent on the machine            | Explicit fallback stack; fit is measured at runtime, so it adapts           |
| A future export renames a column         | Header aliasing plus a loud error naming the missing column                 |
| Import run twice                         | Matching on `plasmids.name` makes it idempotent; covered by a test          |
| Stock IDs stop aligning                  | The 404/404 assertion fails the import loudly rather than silently drifting |
