# Parity evidence — Phase 1: plasmid labels

Feature: render and print plasmid labels from jlab, replacing the manual Word
grid the lab types by hand.

## Why the usual parity gate does not apply

Legacy GMOCU has **no label or print code** — `gmocu.py` reads only its own
SQLite database and the two glossary Excel templates. There is no legacy
behaviour to compare against.

The specification is therefore `gmocu/example/plasmid_labels.docx` itself, read
from its XML rather than from the exported PDF. Every geometric constant in
`src/domain/label-layout.ts` carries its source value in a comment.

| Element      | XML                                                  | Value used                           |
| ------------ | ---------------------------------------------------- | ------------------------------------ |
| Page         | `<w:pgSz w:w="11906" w:h="16838"/>`                  | 210 × 297 mm — see the A4 note below |
| Margins      | `<w:pgMar w:top/right/bottom/left="1440"/>`          | 25.4 mm                              |
| Cell width   | `<w:gridCol w:w="2016"/>`                            | 35.56 mm                             |
| Cell padding | `<w:tblCellMar>` top/bottom 29, left/right 58        | 0.51 mm / 1.02 mm                    |
| Borders      | `TableGrid` style, `w:sz="4"` (eighths of a point)   | 0.5 pt                               |
| Row minimum  | `<w:trHeight w:val="432"/>`, no `w:hRule`            | 7.62 mm, "at least"                  |
| Font sizes   | `<w:sz>` histogram: 8 pt ×5301, 7 ×426, 6 ×124, 5 ×4 | steps 8/7/6/5                        |
| Alignment    | 1414 `<w:jc w:val="center"/>`, no other value        | centred                              |
| Bold         | line 1 in 413/413 cells                              | accession only                       |
| Italic       | 0 occurrences                                        | none                                 |

## Evidence

### Automated

- `tests/unit/label-layout.test.ts` — 30 tests: conversions, page setup, grid,
  pagination, font stepping.
- `tests/unit/label-content.test.ts` — 23 tests: date, concentration and line
  assembly, each anchored to a real printed label.
- `tests/unit/label-render.test.ts` — 10 tests: the rendered DOM actually
  carries the millimetres the geometry computed.
- `tests/integration/label.api.test.ts` — 22 tests: payload joins, newest-prep
  wins, print history, prep batches, cascade on delete.

Full suite: **479 Jest tests** plus **15 Playwright tests**, `tsc` clean,
ESLint 0 errors.

`tests/integration/plasmid.service.test.ts` kept its own copy of the schema,
which went stale when Phase 0 added the label tables and silently broke the
delete cascade. It now uses the shared `createTestSchema` helper.

### Live, against the running app and the real 244-plasmid database

```
GET  /api/labels/plasmids?ids=<3 ids>   200, 3 labels
GET  /api/labels/plasmids               400   (ids missing)
GET  /api/labels/plasmids?ids=nope      404
GET  /labels/print?kind=plasmid&ids=…   200, label-preview present
     stylesheet /_next/static/css/app/labels/print/page.css
       contains @page{size:A4;margin:0}, .label-cell, Carlito
POST /api/plasmids/preps                201
GET  /api/labels/plasmids?ids=<temp>    accession=… prep=2024-01-31 JM 80
GET  /api/plasmids/<temp>/preps         1 row
POST /api/labels/prints                 201, lastPrintedAt then populated
```

The throwaway plasmid was deleted and its orphaned rows removed; the database
is back to 244 plasmids, 0 preps, 0 stocks, 0 label prints.

## Corrections the XML forced on the plan

**A sheet holds 60 labels, not 56.** The document's own
`lastRenderedPageBreak` markers sit at table rows 16, 29, 44, 59, 73, 87, 100,
101 and 109, so page one carried rows 1–15 — 15 rows of 4. Word grows a row to
fit its content, which is why the file ranges from 13 to 15 rows per page. jlab
fixes the row height instead, so the cut grid is regular, and `gridForPage`
derives 15 rows from it rather than hard-coding a number.

The plan's 56 was not wrong, it was counting something else: **row 15 of page 1
is empty**, so Word laid out 60 cells and Julia had typed 56 labels. Capacity 60,
filled 56.

**A4 is exactly 210 × 297 mm.** `twipsToMm(11906)` gives 210.0086 mm — Word's
integer twips are its own rounding of A4. A sheet even a hundredth of a
millimetre wider than the paper `@page { size: A4 }` declares makes the browser
lay out an overflow column and emit a blank page after every sheet. A test
asserts the exact values and that the twips round-trip exceeds them.

**Only the accession is bold.** The plan said the first two lines. Measured per
line index: 413/413 bold on line 1, then 208/413, 279/413 and 117/133. Only the
first is a rule; the rest is hand-typing drift.

**The 3-line labels are not a second label shape.** 280 of the 413 cells hold
three paragraphs rather than four, which looked like a variant. Every one turns
out to be lines 2 and 3 run together by a missed line break —
`pPXm_35Spr-PhiC31-FLAGJM 25.03.2026`, `pMisoMFG_virEp-TGA2.2-GALLS(41C)-rnpBtJM 25.03.26`.
Generating the text removes the class of defect entirely.

## Deliberate deviations

**Line height is jlab's own.** The original relies on Word's implicit spacing
for Aptos, which is not in the file. `LABEL_LINE_HEIGHT = 1.3` was chosen so
four 8 pt lines plus the `<w:tblCellMar>` padding come to 15.70 mm; with
`CELL_SLACK_MM` the cell is 16.20 mm, inside the ≤ 16.41 mm rows Word actually
produced on page one, and roomy enough for five lines once the auto-fit has
dropped to 6 pt.

**Fixed row height, not content-driven.** Word's rows grow, so the original's
grid is irregular and the cut lines move from page to page. A fixed height
makes every sheet identical.

**Font stack `Carlito, Calibri, 'Segoe UI', sans-serif`.** Neither Aptos nor
Calibri is redistributable. Carlito is metric-compatible with Calibri, so a
machine that has it lays the text out as Word did. Because the fit is measured
at runtime rather than estimated, a fallback still produces a correct sheet —
it may simply drop a step sooner.

**Ordered by accession, not by selection order.** A cut-up sheet is filed into
boxes in accession order.

**An unknown id is a 404, not a skipped label.** A short sheet is not noticed
until the tubes are already labelled.

**The selection travels in `sessionStorage`.** 400 UUIDs make a ~15 KB query
string, past Node's 16 KB header limit. `?ids=` still works for a direct link,
and the API is called in chunks of 50 for the same reason.

**Prints are recorded on the way to the print dialog**, so a cancelled dialog
still records. The record answers "did I already do these?" and is advisory;
over-recording is much less costly than the Word workflow's habit of recording
nothing.

**Glycerol stocks survive their plasmid's deletion, unlinked.** Preps and print
history are deleted with the plasmid, but a stock is a tube in a freezer, and an
Agrobacterium stock is numbered independently. **Worth confirming with the lab.**

## Browser-measured evidence

`tests/e2e/label-print.spec.ts` — 15 Playwright tests in Chromium
(`npm run test:e2e`). The label API is intercepted rather than seeded, so the
suite neither reads nor writes the lab's database. CSS defines exactly 96 px per
inch, so the px→mm conversion is exact rather than approximate.

Covered: sheet is 210 × 297 mm with the grid inset exactly 25.4 mm; cells
measure 35.56 × 16.20 mm as laid out; four columns; 60 cells a sheet; the 61st
label starts a second sheet and its blanks keep their borders; no cell crosses
the margin; an ordinary label stays at 8 pt; the long names shrink and neither
overflow nor truncate; app chrome and toolbar vanish under print media; and
`page.pdf()` yields exactly one PDF page for one sheet and three for three.

### Two bugs Playwright caught that nothing else could

**Every ordinary label was rendering at 7 pt.** `cellHeightForLines(4, 8, pad)`
returns the height four 8 pt lines need _exactly_ — 55.47 px of content in a
55.47 px box. With zero slack the browser's sub-pixel rounding decides the fit
and always loses: `scrollHeight` rounds up, `useAutoFit` reads an overflow, and
the whole sheet drops a point below the original. Fixed with `CELL_SLACK_MM =
0.5`, which is wider than a CSS pixel (0.2646 mm) and still leaves 15 rows on
the page. A unit test now asserts the cell is strictly taller than its content.

**The grid's top rule overhung the last column by 17 mm.** A grid block
stretches to its container, so the border ran the full 159.2 mm printable width
while the four 35.56 mm columns reach only 142.24 mm. Fixed with
`width: fit-content`. Found by rendering a sheet and looking at it — no
assertion would have been written for a bug nobody suspected.

### Rendered against the original's own content

`page 1 of plasmid_labels.docx` was parsed back out of the XML and re-rendered
through jlab: **1 sheet, 60 cells, 56 filled, 0 overflowing**, at 8 pt, 7 pt and
6 pt. That also settles where the plan's "56" came from — Word laid out 15 rows
on page 1 and Julia had typed 56 labels; **row 15 was empty**. Capacity 60,
filled 56. Both numbers are right about different things.

## Not covered

**The physical print.** Chromium's PDF pipeline is exercised, but no test can
confirm the printer driver and paper tray agree — print margins must be set to
None with headers and footers off, which the toolbar says on screen. One sheet
held against page 1 of `plasmid_labels.pdf` settles it.
