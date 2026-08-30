/**
 * What a label says.
 *
 * Kept separate from `label-layout.ts`, which decides where cells sit: this is
 * the text. Pure, so the exact wording is unit-tested rather than eyeballed in
 * a print preview.
 *
 * The canonical plasmid label is four lines, taken from row 1 of the lab's
 * `plasmid_labels.docx`:
 *
 *     pJM0001
 *     pMiso000
 *     JM 31.01.24
 *     80.0 ng/µL
 *
 * 280 of the 413 hand-typed labels have only three paragraphs, but every one of
 * those turns out to be lines 2 and 3 run together by a missed line break
 * ("pPXm_35Spr-PhiC31-FLAGJM 25.03.2026"). They are typing slips, not a second
 * label shape, and generating the text removes them.
 */

import { derivedStockId } from './lab-normalization';

/**
 * A run of text within a line. Exists because a glycerol label's second line
 * mixes styles inside one line — `E. coli` italic, `TOP10` roman — which
 * line-level flags cannot express.
 */
export interface LabelSegment {
  text: string;
  bold?: boolean;
  italic?: boolean;
}

export interface LabelLine {
  /** The whole line as plain text; always the concatenation of any segments */
  text: string;
  bold?: boolean;
  italic?: boolean;
  /** Set when the line is not uniformly styled */
  segments?: LabelSegment[];
}

export interface PlasmidLabelData {
  /** Accession number — `pJM0001` */
  accession: string;
  /** Everyday construct name — `pMiso000` */
  constructName?: string | null;
  /** From the newest prep; absent when the plasmid has never been prepped */
  operatorInitials?: string | null;
  /** ISO date of the newest prep */
  preppedOn?: string | null;
  /** Absent when prepped but not yet measured */
  concentrationNgUl?: number | null;
}

/**
 * Placeholder for a prep whose Nanodrop reading is still missing. Julia's own
 * convention — the spreadsheet holds `xxx` in that case — so it reads as
 * "not measured yet" at the bench rather than as a printing fault.
 */
export const UNMEASURED_CONCENTRATION = 'xxxx ng/µL';

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * The glycerol document writes the year in full — `23.01.2024` on 151 labels
 * against 34 short ones, the opposite balance to the plasmid labels. Both are
 * normalized, each to the form its own document prefers.
 */
export function formatStockDate(iso: string | null | undefined): string | null {
  if (!iso) {
    return null;
  }
  const match = ISO_DATE_PATTERN.exec(iso.trim());
  if (!match) {
    return null;
  }
  const [, year, month, day] = match;
  return `${day}.${month}.${year}`;
}

/**
 * ISO date to the lab's `DD.MM.YY`.
 *
 * The originals are inconsistent — `31.01.24`, `25.03.2026` and `25.03.26` all
 * appear, sometimes with a doubled space — so one format is imposed here.
 * Returns null for anything unparseable rather than printing a broken date.
 */
export function formatLabelDate(iso: string | null | undefined): string | null {
  if (!iso) {
    return null;
  }
  const match = ISO_DATE_PATTERN.exec(iso.trim());
  if (!match) {
    return null;
  }
  const [, year, month, day] = match;
  return `${day}.${month}.${(year as string).slice(2)}`;
}

/**
 * One decimal and a space before the unit. The originals vary here too —
 * `209.3ng/µL` has no space — and the spacing matters at 8 pt.
 */
export function formatConcentration(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return UNMEASURED_CONCENTRATION;
  }
  return `${value.toFixed(1)} ng/µL`;
}

/** `JM 31.01.24` — who prepped it and when */
export function formatPrepLine(
  initials: string | null | undefined,
  preppedOn: string | null | undefined
): string | null {
  const date = formatLabelDate(preppedOn);
  const who = initials?.trim();
  if (!date) {
    return who ? who : null;
  }
  return who ? `${who} ${date}` : date;
}

/**
 * The lines of one plasmid label, in print order.
 *
 * Only the accession is bold. That is the one thing the originals are
 * unanimous about — bold on line 1 in 413 of 413 labels, against 50 %, 68 %
 * and 88 % on the lines below, which is hand-typing drift rather than a rule.
 *
 * Lines with nothing to say are dropped, not left blank: a plasmid that has
 * never been prepped has no date and no concentration, and an empty line
 * would only push the remaining text off centre.
 */
export function buildPlasmidLabelLines(data: PlasmidLabelData): LabelLine[] {
  const lines: LabelLine[] = [{ text: data.accession, bold: true }];

  const constructName = data.constructName?.trim();
  if (constructName) {
    lines.push({ text: constructName });
  }

  const prepLine = formatPrepLine(data.operatorInitials, data.preppedOn);
  if (prepLine) {
    lines.push({ text: prepLine });
    lines.push({ text: formatConcentration(data.concentrationNgUl) });
  }

  return lines;
}

export interface GlycerolLabelData {
  /** Lab identifier — `CJM1`, `AJM5.1` */
  stockId: string;
  /** Binomial, set in italics — `E. coli`, `A. tumefaciens` */
  organism: string;
  /** Roman beside it — `TOP10`, `GV3101 pMP90 (Goldbio)` */
  strain: string;
  /** Who made it, appended to the strain when known */
  operatorInitials?: string | null;
  /** Construct in the stock, from its plasmid or recorded on the stock itself */
  constructName?: string | null;
  /** Accession of the linked plasmid, if any */
  accession?: string | null;
  /** ISO date; absent when the number is reserved but the stock was never made */
  madeOn?: string | null;
}

/**
 * The lines of one glycerol stock label.
 *
 *     CJM1
 *     E. coli TOP10        <- organism italic, strain roman
 *     pMiso000
 *     23.01.2024
 *
 * Measured across the lab's 472 hand-typed labels: the stock ID is bold in
 * 470, and the organism binomial is italic with the strain roman in 470 —
 * `E. coli`+`TOP10`, `A. tumefaciens`+`GV3101 pMP90`, `A. rhizogenes`+`AS109`,
 * without exception. No other line is reliably styled.
 */
export function buildGlycerolLabelLines(data: GlycerolLabelData): LabelLine[] {
  const lines: LabelLine[] = [{ text: data.stockId, bold: true }];

  const organism = data.organism?.trim() ?? '';
  const strainParts = [data.strain?.trim(), data.operatorInitials?.trim()].filter(
    (part): part is string => Boolean(part)
  );
  const strain = strainParts.join(' ');

  if (organism || strain) {
    const segments: LabelSegment[] = [];
    if (organism) {
      segments.push({ text: organism, italic: true });
    }
    if (strain) {
      segments.push({ text: organism ? ` ${strain}` : strain });
    }
    lines.push({ text: segments.map((segment) => segment.text).join(''), segments });
  }

  const construct = buildConstructLine(data);
  if (construct) {
    lines.push({ text: construct });
  }

  const made = formatStockDate(data.madeOn);
  if (made) {
    lines.push({ text: made });
  }

  return lines;
}

/**
 * The construct, with the plasmid's accession appended only when the stock ID
 * does not already encode it.
 *
 * `CJM1` is derived from `pJM0001`, so repeating the accession would be noise —
 * and the originals never do. Agrobacterium stocks are numbered independently,
 * so `AJM9` says nothing about `pJM0152` and the label spells it out. 22 of the
 * lab's labels carry the accession this way, all of them AJM.
 */
function buildConstructLine(data: GlycerolLabelData): string | null {
  const construct = data.constructName?.trim();
  const accession = data.accession?.trim();

  if (!construct) {
    // The originals put the source here for six strain-only stocks — see the
    // Phase 2 evidence note; the spreadsheet does not carry it in a usable form
    return accession ? `(${accession})` : null;
  }
  if (!accession || derivedStockId(accession) === data.stockId) {
    return construct;
  }
  return `${construct} (${accession})`;
}
