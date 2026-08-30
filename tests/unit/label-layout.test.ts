/**
 * Label geometry.
 *
 * The numbers checked here are read from the lab's `plasmid_labels.docx`, which
 * is the print specification: legacy GMOCU has no label code to compare
 * against. A change that silently moves a column off the page is exactly what
 * these guard.
 */

import {
  A4,
  A4_DENSE_PAGE,
  A4_PAGE,
  CELL_SLACK_MM,
  DENSE_MARGIN_MM,
  GLYCEROL_LABEL,
  LabelSpec,
  MIN_ROW_HEIGHT_MM,
  PAGE_MARGIN_MM,
  PLASMID_LABEL,
  cellHeightForLines,
  gridFits,
  gridForPage,
  labelsPerPage,
  pageCount,
  paginate,
  printableArea,
  ptToMm,
  selectFontStep,
  twipsToMm,
} from '@domain/label-layout';

describe('unit conversions', () => {
  it('converts twips to millimetres at 1440 per inch', () => {
    expect(twipsToMm(1440)).toBeCloseTo(25.4, 10);
    expect(twipsToMm(720)).toBeCloseTo(12.7, 10);
    expect(twipsToMm(0)).toBe(0);
  });

  it('converts points to millimetres at 72 per inch', () => {
    expect(ptToMm(72)).toBeCloseTo(25.4, 10);
    expect(ptToMm(8)).toBeCloseTo(2.822, 3);
  });
});

describe('page setup from <w:pgSz> and <w:pgMar>', () => {
  it('is A4 exactly, not the twips round-trip', () => {
    // The document's w:w="11906" converts back to 210.0086 mm. A sheet wider
    // than the paper @page declares makes the browser emit a blank page after
    // every sheet, so the ISO values win over Word's rounding.
    expect(A4.widthMm).toBe(210);
    expect(A4.heightMm).toBe(297);
    expect(twipsToMm(11906)).toBeGreaterThan(210);
  });

  it('has 25.4 mm margins', () => {
    // w:top/right/bottom/left all 1440
    expect(PAGE_MARGIN_MM).toBeCloseTo(25.4, 10);
  });

  it('leaves a 159.2 x 246.2 mm printable area', () => {
    const area = printableArea(A4_PAGE);
    expect(area.widthMm).toBeCloseTo(159.2, 1);
    expect(area.heightMm).toBeCloseTo(246.2, 1);
  });
});

describe('PLASMID_LABEL', () => {
  it('is 35.56 mm wide, from <w:gridCol w:w="2016"/>', () => {
    expect(PLASMID_LABEL.cellWidthMm).toBeCloseTo(35.56, 2);
  });

  it('steps the font 8 -> 7 -> 6 -> 5 pt, matching the sizes in the original', () => {
    expect(PLASMID_LABEL.fontStepsPt).toEqual([8, 7, 6, 5]);
  });

  it('draws 0.5 pt borders, from the TableGrid style w:sz="4" (eighths of a point)', () => {
    expect(PLASMID_LABEL.borderPt).toBe(0.5);
  });

  it('is taller than the 7.62 mm row minimum, which Word only treats as "at least"', () => {
    expect(MIN_ROW_HEIGHT_MM).toBeCloseTo(7.62, 2);
    expect(PLASMID_LABEL.cellHeightMm).toBeGreaterThan(MIN_ROW_HEIGHT_MM);
  });

  it('sizes the cell for four 8 pt lines, the Word cell padding, and slack', () => {
    // 4 lines x 8pt x 1.3 leading = 14.68 mm, plus 2 x 0.51 mm padding
    expect(cellHeightForLines(4, 8, PLASMID_LABEL.padBlockMm)).toBeCloseTo(15.7, 1);
    expect(PLASMID_LABEL.cellHeightMm).toBeCloseTo(
      cellHeightForLines(4, 8, PLASMID_LABEL.padBlockMm) + CELL_SLACK_MM,
      10
    );
  });

  it('leaves the cell room to spare over its exact content height', () => {
    // Without this the browser's sub-pixel rounding reads an overflow on a
    // perfectly ordinary label and shrinks every one of them to 7 pt.
    const exact = cellHeightForLines(4, 8, PLASMID_LABEL.padBlockMm);
    expect(PLASMID_LABEL.cellHeightMm).toBeGreaterThan(exact);
    // Half a millimetre is more than a CSS pixel (0.2646 mm), so rounding
    // cannot eat it
    expect(PLASMID_LABEL.cellHeightMm - exact).toBeGreaterThan(25.4 / 96);
  });

  it('leaves room for a fifth line once the text has shrunk to 6 pt', () => {
    const fiveSmallLines = cellHeightForLines(5, 6, PLASMID_LABEL.padBlockMm);
    expect(fiveSmallLines).toBeLessThan(PLASMID_LABEL.cellHeightMm);
  });
});

describe('gridForPage', () => {
  it('fits 4 columns and 15 rows on A4', () => {
    const grid = gridForPage(PLASMID_LABEL);
    expect(grid.columns).toBe(4);
    expect(grid.rows).toBe(15);
    expect(grid.total).toBe(60);
  });

  it('matches the 15 rows Word laid out on page 1 of plasmid_labels.docx', () => {
    // The document's own lastRenderedPageBreak markers put the first break at
    // table row 16, so page 1 carried rows 1-15.
    expect(gridForPage(PLASMID_LABEL).rows).toBe(15);
  });

  it('does not stretch the grid to fill the width', () => {
    // 4 x 35.56 = 142.24 mm inside a 159.2 mm printable width. The original
    // table is w:tblW="0" type="auto" and narrower than the text column too.
    const grid = gridForPage(PLASMID_LABEL);
    const used = grid.columns * PLASMID_LABEL.cellWidthMm;
    expect(used).toBeCloseTo(142.24, 1);
    expect(used).toBeLessThan(printableArea(A4_PAGE).widthMm);
  });

  it('labelsPerPage agrees with the grid', () => {
    expect(labelsPerPage(PLASMID_LABEL)).toBe(gridForPage(PLASMID_LABEL).total);
  });
});

describe('gridFits', () => {
  it('accepts the shipped spec', () => {
    expect(gridFits(PLASMID_LABEL)).toBe(true);
  });

  it('rejects a cell wider than the printable area', () => {
    const tooWide: LabelSpec = { ...PLASMID_LABEL, cellWidthMm: 200 };
    expect(gridFits(tooWide)).toBe(false);
  });

  it('rejects a cell taller than the printable area', () => {
    const tooTall: LabelSpec = { ...PLASMID_LABEL, cellHeightMm: 300 };
    expect(gridFits(tooTall)).toBe(false);
  });
});

describe('pageCount', () => {
  const perPage = labelsPerPage(PLASMID_LABEL);

  it('is zero for nothing to print', () => {
    expect(pageCount(0, PLASMID_LABEL)).toBe(0);
    expect(pageCount(-5, PLASMID_LABEL)).toBe(0);
  });

  it('fills one sheet exactly', () => {
    expect(pageCount(1, PLASMID_LABEL)).toBe(1);
    expect(pageCount(perPage, PLASMID_LABEL)).toBe(1);
    expect(pageCount(perPage + 1, PLASMID_LABEL)).toBe(2);
  });

  it('counts the whole library', () => {
    // 390 named plasmids in the lab's spreadsheet
    expect(pageCount(390, PLASMID_LABEL)).toBe(Math.ceil(390 / perPage));
  });

  it('pushes to a second sheet when the first is partly used', () => {
    expect(pageCount(perPage, PLASMID_LABEL, 1)).toBe(2);
    expect(pageCount(1, PLASMID_LABEL, perPage - 1)).toBe(1);
    expect(pageCount(2, PLASMID_LABEL, perPage - 1)).toBe(2);
  });

  it('wraps an offset of a whole sheet back to zero', () => {
    expect(pageCount(1, PLASMID_LABEL, perPage)).toBe(1);
  });
});

describe('paginate', () => {
  const perPage = labelsPerPage(PLASMID_LABEL);
  const labels = Array.from({ length: perPage + 3 }, (_, index) => `label-${index}`);

  it('deals labels into fixed-size pages', () => {
    const pages = paginate(labels, PLASMID_LABEL);
    expect(pages).toHaveLength(2);
    expect(pages[0]).toHaveLength(perPage);
    expect(pages[1]).toHaveLength(perPage);
  });

  it('pads the last page with blanks rather than dropping the cells', () => {
    // The original's last sheet carries 43 empty bordered cells; the borders
    // are the cut guides, so blanks still print.
    const pages = paginate(labels, PLASMID_LABEL);
    const lastPage = pages[1] as (string | null)[];
    expect(lastPage.slice(0, 3)).toEqual(['label-60', 'label-61', 'label-62']);
    expect(lastPage.slice(3).every((cell) => cell === null)).toBe(true);
  });

  it('skips the used cells of a part-finished sheet', () => {
    const pages = paginate(['a', 'b'], PLASMID_LABEL, 2);
    expect(pages).toHaveLength(1);
    expect(pages[0]?.slice(0, 4)).toEqual([null, null, 'a', 'b']);
  });

  it('returns nothing for an empty selection', () => {
    expect(paginate([], PLASMID_LABEL)).toEqual([]);
  });

  it('keeps every label across the pages', () => {
    const many = Array.from({ length: 390 }, (_, index) => index);
    const pages = paginate(many, PLASMID_LABEL);
    const kept = pages.flat().filter((cell): cell is number => cell !== null);
    expect(kept).toEqual(many);
  });
});

describe('selectFontStep', () => {
  it('keeps the largest size when the text already fits', () => {
    expect(selectFontStep([8, 7, 6, 5], () => true)).toBe(8);
  });

  it('steps down to the first size that fits', () => {
    expect(selectFontStep([8, 7, 6, 5], (pt) => pt <= 6)).toBe(6);
  });

  it('falls back to the smallest size rather than truncating', () => {
    // Four labels in the original ended at 5 pt; none were cut short.
    expect(selectFontStep([8, 7, 6, 5], () => false)).toBe(5);
  });

  it('tries the steps largest-first and stops at the first fit', () => {
    const tried: number[] = [];
    selectFontStep([8, 7, 6, 5], (pt) => {
      tried.push(pt);
      return pt === 7;
    });
    expect(tried).toEqual([8, 7]);
  });

  it('refuses an empty step list rather than guessing a size', () => {
    expect(() => selectFontStep([], () => true)).toThrow(/at least one step/);
  });
});

describe('GLYCEROL_LABEL', () => {
  it('is 38.10 mm wide, from <w:gridCol w:w="2160"/>', () => {
    expect(GLYCEROL_LABEL.cellWidthMm).toBeCloseTo(38.1, 2);
    expect(GLYCEROL_LABEL.cellWidthMm).toBeGreaterThan(PLASMID_LABEL.cellWidthMm);
  });

  it('is left-aligned, unlike the centred plasmid label', () => {
    // The glycerol document sets no <w:jc> at all; the plasmid one sets
    // center 1414 times
    expect(GLYCEROL_LABEL.align).toBe('left');
    expect(PLASMID_LABEL.align).toBe('center');
  });

  it('is the same height as the plasmid label — four lines, not five', () => {
    // The document's one apparent five-line cell is CJM260's construct name
    // hand-wrapped across two paragraphs, not a fifth field
    expect(GLYCEROL_LABEL.cellHeightMm).toBeCloseTo(PLASMID_LABEL.cellHeightMm, 10);
    expect(GLYCEROL_LABEL.maxLines).toBe(4);
  });

  it('fits 4 columns and 15 rows on A4', () => {
    const grid = gridForPage(GLYCEROL_LABEL);
    expect(grid.columns).toBe(4);
    expect(grid.rows).toBe(15);
    expect(grid.total).toBe(60);
    expect(gridFits(GLYCEROL_LABEL)).toBe(true);
  });

  it('leaves the wider columns inside the printable area', () => {
    // 4 x 38.10 = 152.4 mm inside 159.2 mm — tighter than the plasmid grid
    const used = gridForPage(GLYCEROL_LABEL).columns * GLYCEROL_LABEL.cellWidthMm;
    expect(used).toBeCloseTo(152.4, 1);
    expect(used).toBeLessThan(printableArea(A4_PAGE).widthMm);
  });
});

describe('dense layout', () => {
  it('narrows the margin to 10 mm, clearing a printer’s unprintable edge', () => {
    expect(DENSE_MARGIN_MM).toBe(10);
    expect(A4_DENSE_PAGE.marginMm).toBe(10);
    expect(A4_DENSE_PAGE.widthMm).toBe(A4_PAGE.widthMm);
  });

  it('fits 5 columns and 17 rows of plasmid labels — 85 to a sheet', () => {
    const grid = gridForPage(PLASMID_LABEL, A4_DENSE_PAGE);
    expect(grid.columns).toBe(5);
    expect(grid.rows).toBe(17);
    expect(grid.total).toBe(85);
    expect(gridFits(PLASMID_LABEL, A4_DENSE_PAGE)).toBe(true);
  });

  it('gains a row but not a column for the wider glycerol label', () => {
    // 190 / 38.10 = 4.9869 — a fifth column misses by 0.5 mm
    const grid = gridForPage(GLYCEROL_LABEL, A4_DENSE_PAGE);
    expect(grid.columns).toBe(4);
    expect(grid.rows).toBe(17);
    expect(grid.total).toBe(68);
  });

  it('takes the 390-plasmid library from 7 sheets to 5', () => {
    expect(pageCount(390, PLASMID_LABEL, 0, A4_PAGE)).toBe(7);
    expect(pageCount(390, PLASMID_LABEL, 0, A4_DENSE_PAGE)).toBe(5);
  });

  it('paginates into the denser grid', () => {
    const labels = Array.from({ length: 86 }, (_, index) => index);
    const pages = paginate(labels, PLASMID_LABEL, 0, A4_DENSE_PAGE);

    expect(pages).toHaveLength(2);
    expect(pages[0]).toHaveLength(85);
    expect(pages.flat().filter((cell) => cell !== null)).toEqual(labels);
  });

  it('keeps the label itself the same size — only the margins change', () => {
    expect(PLASMID_LABEL.cellWidthMm).toBeCloseTo(35.56, 2);
    expect(
      gridForPage(PLASMID_LABEL, A4_DENSE_PAGE).columns * PLASMID_LABEL.cellWidthMm
    ).toBeCloseTo(177.8, 1);
  });
});
