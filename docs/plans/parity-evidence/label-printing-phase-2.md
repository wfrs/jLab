# Parity evidence — Phase 2: glycerol stock labels

Feature: render and print glycerol stock labels, and record stocks in jlab.

## Specification

`gmocu/example/glycerol_stock_labels.docx`, read from its XML. GMOCU has no
label code, so the document is the specification.

| Element       | XML                                                   | Value used           |
| ------------- | ----------------------------------------------------- | -------------------- |
| Cell width    | `<w:gridCol w:w="2160"/>` (uniform)                   | 38.10 mm             |
| Page, margins | Same A4 and 1440-twip margins as the plasmid sheet    | 210 × 297, 25.4 mm   |
| Cell padding  | `<w:tblCellMar>` 29 / 58 twips                        | 0.51 / 1.02 mm       |
| Borders       | `TableGrid`, `w:sz="4"`                               | 0.5 pt               |
| Alignment     | **No `<w:jc>` anywhere** (plasmid sheet: 1414 center) | left                 |
| Font sizes    | 8 pt ×6125, 7 ×142, 6 ×91 — never 5 pt                | steps 8/7/6, 5 spare |
| Bold          | Run-level: line 1 in 470 of 472                       | stock ID only        |
| Italic        | Run-level: organism italic, strain roman, 470 of 472  | organism only        |
| Date          | `DD.MM.YYYY` ×151 against `DD.MM.YY` ×34              | four-digit year      |

## Corrections the XML forced on the plan

**There is no five-line label.** The plan described a "two plasmids, 5 lines"
shape citing AJM16. The document holds exactly one five-paragraph cell, and it
is CJM260's construct name hand-wrapped across two paragraphs
(`pMisoMFG_virEp-TGA2.2-` / `FLAG-SUMO-VirF(39C)-rnpBt`), not a fifth field. The
real shapes are three lines (strain only, 294 cells) and four (with a construct,
175). AJM16 is a four-line label. So the glycerol cell is sized for four lines
like the plasmid cell — sizing for five to serve one hand-wrapped cell would
have cost three rows on every sheet.

**The two-line cells are typing slips**, not a shape: both read
`AJM5.1A. tumefaciens GV3101 pMP90 (Goldbio)` — the stock ID run into the
organism by a missed line break, the same class of defect as the plasmid sheet's
280 merged lines.

**A run-level reading was needed to get the italics right.** A paragraph-level
test reported 470 of 472 line-2 paragraphs italic, which suggested the whole
organism-and-strain line was italic. That was an artefact of `<w:pPr>` carrying
paragraph-mark formatting: reading `<w:r>` runs instead gives 470 _mixed_ lines
— `E. coli` italic + `TOP10` roman, `A. tumefaciens` + `GV3101 pMP90`,
`A. rhizogenes` + `AS109`, without exception. The first regex also missed runs
carrying attributes (`<w:r w:rsidR=…>`), which is what made the earlier count
wrong.

**Dates keep each document's own convention.** The glycerol sheet writes the
year in full where the plasmid sheet abbreviates it, so `formatStockDate` and
`formatLabelDate` are separate functions rather than one shared format.

## Design

**The accession is appended only when the stock ID does not already encode it.**
`CJM1` derives from `pJM0001`, so repeating it would be noise — and the
originals never do. `AJM9` says nothing about `pJM0152`, so the label spells it
out, as 22 Agrobacterium labels do. Decided with `derivedStockId` from Phase 0
rather than by testing the organism.

**The stock's own construct name beats the plasmid's.** Found while verifying
against real data: `AJM9` records `pPXm_35SprFL-sGeNL(C)` while its plasmid
`pJM0152` is named `pPXm_35S_sNL(C)`. The printed label uses the stock's — it is
the name written on that tube — so the renderer does too, and a new
`stock-construct-name-mismatch` data-quality check surfaces the disagreement
instead of the renderer hiding it.

**`LabelSegment` was added to the line model.** Line-level bold/italic flags
cannot express `E. coli` italic beside a roman `TOP10`; a line may now carry
segments, with `text` always the plain concatenation so measurement and tests
are unaffected.

**Stock IDs sort naturally.** `compareStockIds` orders on letters, then number,
then aliquot: AJM2, AJM2.1, AJM10 — not the AJM10-before-AJM2 that plain string
comparison gives, which would deal a sheet nobody can file.

## Evidence

### Automated

- `tests/unit/label-content.test.ts` — glycerol line assembly, dates, the
  italic/roman split, the accession rule, aliquots, reserved numbers.
- `tests/unit/label-layout.test.ts` — the 38.10 mm cell, left alignment, four
  columns and 15 rows.
- `tests/unit/lab-normalization.test.ts` — natural stock ID ordering.
- `tests/integration/glycerol-label.api.test.ts` — 18 tests: payload joins,
  construct-name precedence, ordering, the API, and recording stocks.
- `tests/e2e/glycerol-label-print.spec.ts` — 11 Chromium tests, including the
  computed `font-style` of each span on line 2.

Full suite: **533 Jest**, **26 Playwright**, `tsc` clean, ESLint 0 errors.

### Live, against the lab's 436 imported stocks

Three real stocks — one E. coli with a plasmid, one Agrobacterium with a
plasmid, one strain-only:

```
CJM1  ["CJM1","E. coli TOP10","pMiso000","23.01.2024"]
        italic=["E. coli"]        align=left  8pt
AJM1  ["AJM1","A. tumefaciens GV3101 pMP90 (CPGE)","20.06.2024"]
        italic=["A. tumefaciens"] align=left  8pt
AJM9  ["AJM9","A. tumefaciens GV3101 pMP90 (Goldbio)",
       "pPXm_35SprFL-sGeNL(C) (pJM0152)","25.03.2025"]
        italic=["A. tumefaciens"] align=left  6pt (auto-fit)

cell width measured in the browser: 38.10 mm
```

CJM1 and AJM1 match their printed originals line for line.

## Not reproducible from the data

**The `(Source; #N)` provenance line.** Six of the lab's labels carry one —
`(Tübingen; #1)`, `(CPGE; #1)`, `(Invitrogen; #1)` — and the spreadsheet does
not hold it in a usable form. Of those six stocks, only AJM20 and AJM21 have a
`sourceNote` that reads as provenance ("from Tübingen"); AJM22's holds a lab
observation ("didn't grow with Rif in medium…") and AJM23's is null. Printing
`(sourceNote)` would put that observation on a label. The line is therefore not
generated. **The lab would need to supply the source per stock for these to
print as before.**

This also corrects the Phase 0 note, which read as though `sourceNote` carried
provenance cleanly; it does for two stocks of six.

**Operator initials.** 233 originals read `TOP10 JM`, `TOP10 LN` or `TOP10 INA`,
but no imported stock carries initials — the Agrobacterium and plasmid sheets
have no per-stock operator column, and the strain column is clean (`TOP10` on
381 stocks). The field is wired through the model, the label and the editor, so
stocks recorded in jlab from here on will print them; imported ones will not
until someone fills them in.
