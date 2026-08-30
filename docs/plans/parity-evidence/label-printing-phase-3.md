# Parity evidence — Phase 3: polish

Four of the five Phase 3 items are built. The fifth is blocked on the lab.

| Item                        | State                                         |
| --------------------------- | --------------------------------------------- |
| Partial-sheet offset picker | Done                                          |
| Dense layout                | Done                                          |
| Reprint from history        | Done                                          |
| Subscript rendering         | **Blocked** — needs a convention from the lab |
| Golden Gate calculator      | Done                                          |

## Partial-sheet offset picker

`StartCellPicker` replaces the `startAt` number input with a miniature of the
sheet: click the first free cell. A number between 0 and 84 is not something
anyone can read off a half-cut sheet; the shape of the used corner is.

Switching to the dense grid can leave a chosen start cell outside the new grid,
so it is clamped rather than silently dropping labels.

## Dense layout

The same labels on 10 mm margins instead of Word's 25.4 mm. The margins are a
document default, not a property of the label — the cells are the size that
fits the tubes, and nothing about them needs an inch of paper around the grid.
10 mm rather than less because it clears the ~5 mm unprintable edge of a typical
laser printer.

**The plan's arithmetic was wrong.** It predicted 5 columns × 15 rows = 75. The
cell height settled in Phase 1 gives:

```
                printable        plasmid          glycerol
25.4 mm margin  159.2 x 246.2    4 x 15 =  60     4 x 15 = 60
10 mm margin    190.0 x 277.0    5 x 17 =  85     4 x 17 = 68
```

**85, not 75.** The glycerol label misses a fifth column by half a millimetre —
190 / 38.10 = 4.9869 — so it gains a row and not a column.

For the lab's own library: 390 plasmid labels drop from **7 sheets to 5**; 436
glycerol labels from 8 to 7.

Verified in the browser: toggling re-lays 61 labels from two sheets onto one,
the grid inset measures 10 mm, the cell stays 35.56 mm, and `page.pdf()` still
yields exactly one page.

## Reprint from history

`recordPrints` already stamps every label on a sheet with one `printedAt`, so a
past sheet is exactly the rows sharing a kind and a timestamp — no extra column
was needed to group them. `GET /api/labels/prints` lists them; the same route
with `kind` and `printedAt` returns that sheet's ids.

The list also fills the empty-selection state, which was otherwise a dead end:
arriving at `/labels/print` with nothing selected now offers the sheets you have
already printed.

**A crash found by a test.** The e2e stub answered `/api/labels/prints` for every
method, so a GET received the POST's payload, `batches` was `undefined`, and
`ReprintHistory` threw — taking the page's own error message down with it. The
component now tolerates an unexpected payload. The stub was wrong too, but a
component that removes the error message when its data is malformed is the
actual defect.

## Golden Gate calculator

`src/domain/golden-gate.ts` reimplements the workbook's `parts` sheet:

```
D  ng for 40 fmol  = (40 * ((size * 615.96) + 36.04)) * 1e-6
E  conc for 0.5 µL = D / 0.5
G  stock volume    = (30 * E) / measured concentration
H  Tris-HCl        = 30 - G          (20 fmol for backbones)
```

Every expected value in `tests/unit/golden-gate.test.ts` is the number the
sheet itself computed, read from its cached formula results — the virB promoter
row end to end (11.1626368 ng, 22.3252736 ng/µL, 5.25514882932647 µL,
24.74485117067353 µL) and the pMiso001_MFG backbone row.

**Negative volumes are reported as a condition.** The sheet returns a negative
Tris-HCl when the stock is too dilute: `pMiso211b_new` gives −44.8 µL, and six
other rows are negative too. A negative volume is not something anyone can
pipette, so `tooDilute` is set and the calculator says how concentrated the
stock would need to be.

**A float-only tolerance.** A stock at exactly the target concentration needs
the whole final volume and no buffer, but `30 − (30 × c) / c` lands a few parts
in 10¹⁵ below zero and would have been reported as too dilute. `VOLUME_EPSILON_UL`
covers the representation, not pipetting.

**It reads what the lab already recorded.** The sheet asks you to retype every
fragment's size and its measured concentration; jlab has both, so the calculator
joins each plasmid to its newest prep and only asks which parts are inserts. The
largest fragment is pre-selected as the backbone.

### Live, against the lab's real plasmids

Four real plasmids with a recorded size and concentration:

```
p256                 15372 bp   732.2 ng/µL  target 757.5   too dilute (needs 31.0 µL of 30)
pMJ920_addgene Cas9  10357 bp   615.1 ng/µL  target 510.4   take 24.9 µL + 5.1 µL Tris-HCl
pSHS207_addgene Cas9 10073 bp    95.1 ng/µL  target 496.4   too dilute (needs 156.6 µL)
pVP141 (backbone)    15649 bp   254.0 ng/µL  target 385.6   too dilute (needs 45.5 µL)
```

Three of four are too dilute, which is what 10–15 kb fragments at 40 fmol
demand — and exactly the case the spreadsheet answered with a negative number.

## Blocked: subscript rendering

The original marks `TrmA_E358Q` as subscript in 18 places, but underscores
appear throughout construct names with no typographic meaning
(`pMiso001_M1L_S267L_G107C`, `pPXm_35SprFL`). Nothing in the data distinguishes
the two, so a rule would guess wrong far more often than right.

**This needs an explicit convention from Julia** — which underscores mark a
subscript, or a different marker in the construct name — before it is worth
building. Not attempted.

## Verification

Full suite: **567 Jest tests**, **32 Playwright**, `tsc` clean, ESLint 0 errors.
