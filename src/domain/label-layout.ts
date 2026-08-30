/**
 * Label sheet geometry.
 *
 * Every constant here is read from the lab's own Word documents
 * (`gmocu/example/plasmid_labels.docx`), which are the print specification —
 * legacy GMOCU has no label code at all. Values are kept in their original
 * twips beside the conversion so the provenance stays visible.
 *
 * Pure: no DOM, no I/O. The renderer turns these millimetres into CSS.
 */

/** Word measures in twentieths of a point; 1440 twips = 1 inch = 25.4 mm */
export const MM_PER_TWIP = 25.4 / 1440;
export const MM_PER_PT = 25.4 / 72;

export function twipsToMm(twips: number): number {
  return twips * MM_PER_TWIP;
}

export function ptToMm(points: number): number {
  return points * MM_PER_PT;
}

/**
 * A4, exactly.
 *
 * The document says `<w:pgSz w:w="11906" w:h="16838"/>`, but those are Word's
 * integer twips for A4 and convert back to 210.0086 x 297.0036 mm. The sheet
 * must not be even a hundredth of a millimetre wider than the paper the
 * `@page { size: A4 }` rule declares, or the browser lays out an overflow
 * column and emits a blank page after every sheet. The ISO values are what the
 * printer actually has.
 */
export const A4 = {
  widthMm: 210,
  heightMm: 297,
} as const;

/** `<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>` */
export const PAGE_MARGIN_MM = twipsToMm(1440);

/**
 * Leading as a multiple of font size. The original relies on Word's implicit
 * line spacing for Aptos, which cannot be read from the file, so this is the
 * app's own value — chosen so four 8 pt lines plus padding land inside a row
 * of the height Word actually produced (see `docs/plans/parity-evidence`).
 */
export const LABEL_LINE_HEIGHT = 1.3;

/** `<w:tblCellMar>`: top/bottom 29 twips, left/right 58 twips */
const PAD_BLOCK_MM = twipsToMm(29);
const PAD_INLINE_MM = twipsToMm(58);

/** TableGrid borders are `w:sz="4"`, and w:sz counts eighths of a point */
const BORDER_PT = 4 / 8;

/**
 * Minimum row height from `<w:trHeight w:val="432"/>`. No `w:hRule` is set, so
 * Word treats it as "at least" and grows the row to fit its content — which is
 * why the original's pages hold 13 to 15 rows depending on what was typed. The
 * app fixes the row height instead, so the cut grid is regular.
 */
export const MIN_ROW_HEIGHT_MM = twipsToMm(432);

export interface LabelSpec {
  /** Cell width in mm — `<w:gridCol>` */
  cellWidthMm: number;
  cellHeightMm: number;
  padBlockMm: number;
  padInlineMm: number;
  borderPt: number;
  /** Font sizes tried largest-first before the text is allowed to wrap */
  fontStepsPt: readonly number[];
  /** Lines the cell height is sized for at the largest step */
  maxLines: number;
  align: 'center' | 'left';
}

export interface PageSpec {
  widthMm: number;
  heightMm: number;
  marginMm: number;
}

export const A4_PAGE: PageSpec = {
  widthMm: A4.widthMm,
  heightMm: A4.heightMm,
  marginMm: PAGE_MARGIN_MM,
};

/**
 * The same labels on narrower margins.
 *
 * Word's 25.4 mm margins are a document default, not a property of the label:
 * the cells are the size that fits the tubes and nothing about them needs an
 * inch of paper around the grid. At 10 mm a plasmid sheet holds 85 instead of
 * 60 — the whole 390-plasmid library drops from 7 sheets to 5.
 *
 * 10 mm rather than less because that clears the unprintable edge of a typical
 * laser printer, which is around 5 mm, with room to spare.
 */
export const DENSE_MARGIN_MM = 10;

export const A4_DENSE_PAGE: PageSpec = {
  widthMm: A4.widthMm,
  heightMm: A4.heightMm,
  marginMm: DENSE_MARGIN_MM,
};

/** Height a cell needs to hold `lines` lines at `fontPt` without scrolling */
export function cellHeightForLines(lines: number, fontPt: number, padBlockMm: number): number {
  return lines * fontPt * LABEL_LINE_HEIGHT * MM_PER_PT + 2 * padBlockMm;
}

/**
 * Slack added on top of that exact height.
 *
 * A cell sized to exactly its content hands the fit decision to the browser's
 * sub-pixel rounding, and it loses: four 8 pt lines measure 55.47 px inside a
 * 55.47 px box, `scrollHeight` rounds up, `useAutoFit` reads an overflow, and
 * *every* ordinary label drops to 7 pt. Half a millimetre absorbs the rounding
 * and costs nothing — 15 rows of 16.20 mm still fit the 246.2 mm printable
 * height, which allows 16.41 mm a row.
 */
export const CELL_SLACK_MM = 0.5;

/**
 * Plasmid label — four centred lines, 35.56 mm wide.
 *
 * The font steps mirror the sizes found in the original: a histogram of
 * `<w:sz>` across all 413 labels gives 8 pt (5301 runs), 7 pt (426), 6 pt (124)
 * and 5 pt (4). Julia shrinks the whole cell by hand when a construct name
 * overflows; `useAutoFit` does the same thing by measurement.
 */
export const PLASMID_LABEL: LabelSpec = {
  cellWidthMm: twipsToMm(2016),
  cellHeightMm: cellHeightForLines(4, 8, PAD_BLOCK_MM) + CELL_SLACK_MM,
  padBlockMm: PAD_BLOCK_MM,
  padInlineMm: PAD_INLINE_MM,
  borderPt: BORDER_PT,
  fontStepsPt: [8, 7, 6, 5],
  maxLines: 4,
  align: 'center',
};

/**
 * Glycerol stock label — 38.10 mm wide, left-aligned.
 *
 * Wider than the plasmid label (`<w:gridCol w:w="2160"/>` against 2016) and
 * left-aligned: the glycerol document sets no `<w:jc>` at all, against 1414
 * explicit `center` values in the plasmid one.
 *
 * The same height as the plasmid label, for four lines. The document appears to
 * hold one five-line cell, but it is CJM260's construct name hand-wrapped
 * across two paragraphs rather than a fifth field — every glycerol label is at
 * most ID, organism, construct and date. Sizing for five lines to serve that
 * one cell would cost three rows on every sheet.
 *
 * `<w:sz>` runs to 8 pt (6125), 7 pt (142) and 6 pt (91) here, never 5 pt. The
 * 5 pt step is kept anyway as a last resort, so a long Agrobacterium construct
 * name shrinks rather than overflowing.
 */
export const GLYCEROL_LABEL: LabelSpec = {
  cellWidthMm: twipsToMm(2160),
  cellHeightMm: cellHeightForLines(4, 8, PAD_BLOCK_MM) + CELL_SLACK_MM,
  padBlockMm: PAD_BLOCK_MM,
  padInlineMm: PAD_INLINE_MM,
  borderPt: BORDER_PT,
  fontStepsPt: [8, 7, 6, 5],
  maxLines: 4,
  align: 'left',
};

export interface Grid {
  columns: number;
  rows: number;
  total: number;
}

/** The printable box inside the page margins */
export function printableArea(page: PageSpec): { widthMm: number; heightMm: number } {
  return {
    widthMm: page.widthMm - 2 * page.marginMm,
    heightMm: page.heightMm - 2 * page.marginMm,
  };
}

/**
 * How many whole cells fit inside the margins.
 *
 * The grid is *not* stretched to fill the page: 4 columns of 35.56 mm leave
 * 16.96 mm unused on the right, exactly as in the original, where the table is
 * `w:tblW="0" type="auto"` and narrower than the text column.
 */
export function gridForPage(spec: LabelSpec, page: PageSpec = A4_PAGE): Grid {
  const area = printableArea(page);
  const columns = Math.floor(area.widthMm / spec.cellWidthMm);
  const rows = Math.floor(area.heightMm / spec.cellHeightMm);
  return { columns, rows, total: columns * rows };
}

export function labelsPerPage(spec: LabelSpec, page: PageSpec = A4_PAGE): number {
  return gridForPage(spec, page).total;
}

/**
 * Pages needed for `labelCount` labels when the first `startOffset` cells of
 * the first sheet are already used or cut away.
 */
export function pageCount(
  labelCount: number,
  spec: LabelSpec,
  startOffset: number = 0,
  page: PageSpec = A4_PAGE
): number {
  if (labelCount <= 0) {
    return 0;
  }
  const perPage = labelsPerPage(spec, page);
  const offset = normalizeOffset(startOffset, perPage);
  return Math.ceil((labelCount + offset) / perPage);
}

function normalizeOffset(startOffset: number, perPage: number): number {
  if (!Number.isFinite(startOffset) || startOffset <= 0) {
    return 0;
  }
  return Math.floor(startOffset) % perPage;
}

/**
 * Deal labels into fixed-size pages, padding with nulls.
 *
 * Blank cells are kept rather than dropped because they still print their
 * borders — the original's last page carries 43 empty bordered cells, and the
 * borders are the cut guides.
 */
export function paginate<T>(
  items: readonly T[],
  spec: LabelSpec,
  startOffset: number = 0,
  page: PageSpec = A4_PAGE
): (T | null)[][] {
  const perPage = labelsPerPage(spec, page);
  if (perPage <= 0) {
    return [];
  }

  const offset = normalizeOffset(startOffset, perPage);
  const cells: (T | null)[] = [...new Array<null>(offset).fill(null), ...items];

  const pages: (T | null)[][] = [];
  for (let start = 0; start < cells.length; start += perPage) {
    const slice = cells.slice(start, start + perPage);
    while (slice.length < perPage) {
      slice.push(null);
    }
    pages.push(slice);
  }
  return pages;
}

/**
 * Whether the grid actually fits the paper. Guards a spec change that would
 * silently push a column or row off the sheet.
 */
export function gridFits(spec: LabelSpec, page: PageSpec = A4_PAGE): boolean {
  const { columns, rows } = gridForPage(spec, page);
  if (columns < 1 || rows < 1) {
    return false;
  }
  const area = printableArea(page);
  return (
    columns * spec.cellWidthMm <= area.widthMm + 1e-9 &&
    rows * spec.cellHeightMm <= area.heightMm + 1e-9
  );
}

/**
 * Pick the largest font step whose rendered text fits, falling back to the
 * smallest step when nothing does — matching the original, where four labels
 * ended up at 5 pt and the text was never truncated.
 *
 * Split out from `useAutoFit` so the stepping logic is testable without a
 * layout engine; jsdom reports every element as zero-sized.
 */
export function selectFontStep(
  steps: readonly number[],
  fits: (fontPt: number) => boolean
): number {
  if (steps.length === 0) {
    throw new Error('selectFontStep requires at least one step');
  }
  for (const step of steps) {
    if (fits(step)) {
      return step;
    }
  }
  return steps[steps.length - 1] as number;
}
