/**
 * Normalization helpers for the lab spreadsheet import
 * (gmocu/example/plasmids_JM_expanded.xlsx).
 *
 * Pure functions, no I/O. The spreadsheet is maintained by hand, so the same
 * value appears in several spellings; normalizing here rather than asking for
 * a cleaned file means the rules run identically on every future export.
 *
 * See docs/plans/label-printing.md §0.3.
 */

/** Cells the sheet uses to mean "nothing here" */
const BLANK_TOKENS = new Set(['', '-', '–', '—', 'n/a', 'na']);

/**
 * Trim, and treat the sheet's placeholder dashes as empty.
 * `NA` is deliberately included: the sheet writes it in `insert size [bp]`
 * for plasmids with no insert.
 */
export function blankToNull(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const text = String(value).trim();
  return BLANK_TOKENS.has(text.toLowerCase()) ? null : text;
}

/** Parsed parts of an accession like `pJM0001` */
export interface Accession {
  /** Lowercase type prefix, `p` for plasmid */
  prefix: string;
  /** Owner initials, `JM` */
  initials: string;
  /** Numeric part without padding, `1` */
  number: number;
  /** Digits as written, so `pJM0001` can be rebuilt */
  padWidth: number;
}

/**
 * Parse `pJM0001` into its parts. Returns null for anything else, including
 * construct names like `pMiso000` — the digits must be the whole tail and the
 * initials must be upper case.
 */
export function parseAccession(name: string | null | undefined): Accession | null {
  const text = blankToNull(name);
  if (!text) {
    return null;
  }
  const match = /^([a-z]+)([A-Z]{2,4})(\d{1,6})$/.exec(text);
  if (!match) {
    return null;
  }
  const [, prefix, initials, digits] = match;
  return { prefix, initials, number: Number(digits), padWidth: digits.length };
}

/** Rebuild `pJM0001` from its parts */
export function formatAccession(accession: Accession): string {
  const digits = String(accession.number).padStart(accession.padWidth, '0');
  return `${accession.prefix}${accession.initials}${digits}`;
}

/**
 * The E. coli glycerol stock ID a plasmid accession implies: `pJM0001` → `CJM1`.
 *
 * Verified against all 404 stock-bearing rows of the workbook — the stock
 * number always equals the plasmid number, and is written unpadded. The
 * importer stores the sheet's own value and asserts it matches this, so a
 * future divergence fails loudly instead of drifting.
 */
export function derivedStockId(plasmidName: string | null | undefined): string | null {
  const accession = parseAccession(plasmidName);
  return accession ? `C${accession.initials}${accession.number}` : null;
}

/** A stock ID split into its parent and aliquot number */
export interface AliquotRef {
  parentStockId: string;
  aliquot: number;
}

/**
 * `AJM5.1` → parent `AJM5`, aliquot 1. Returns null for a plain stock ID.
 * Aliquots are parallel tubes from one transformation; they share the parent's
 * date, strain, construct and resistance.
 */
export function parseAliquot(stockId: string | null | undefined): AliquotRef | null {
  const text = blankToNull(stockId);
  if (!text) {
    return null;
  }
  const match = /^([A-Za-z]+\d+)\.(\d+)$/.exec(text);
  return match ? { parentStockId: match[1], aliquot: Number(match[2]) } : null;
}

/** Two-digit years below this are 20xx, at or above are 19xx */
const CENTURY_PIVOT = 70;

function isoDate(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}`;
}

function expandYear(raw: string): number {
  const year = Number(raw);
  if (raw.length === 4) {
    return year;
  }
  return year < CENTURY_PIVOT ? 2000 + year : 1900 + year;
}

/**
 * Read a date cell as an ISO `YYYY-MM-DD` string.
 *
 * The main sheet stores real dates (387 of 387), but the Agrobacterium sheet
 * mixes 22 strings with 25 dates, in both `20.06.2024` and `07.06.26` forms.
 * Excel dates arrive as UTC midnight, so the UTC components are read directly
 * rather than the local ones, which would shift the day west of Greenwich.
 */
export function parseSheetDate(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return null;
    }
    return isoDate(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
  }

  const text = blankToNull(value);
  if (!text) {
    return null;
  }

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (iso) {
    return isoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }

  // 20.06.2024 · 25.03.25 · 07.06.26, also tolerating / and - separators
  const dotted = /^(\d{1,2})\s*[.\/-]\s*(\d{1,2})\s*[.\/-]\s*(\d{2}|\d{4})$/.exec(text);
  if (dotted) {
    return isoDate(expandYear(dotted[3]), Number(dotted[2]), Number(dotted[1]));
  }

  return null;
}

/** Antibiotic resistance split by the audience it applies to */
export interface Markers {
  bacterial: string | null;
  plant: string | null;
}

/** Canonical casing for the abbreviations the sheet uses */
const RESISTANCE_CASE: Record<string, string> = {
  kan: 'Kan',
  amp: 'Amp',
  spec: 'Spec',
  tet: 'Tet',
  gen: 'Gen',
  rif: 'Rif',
  hyg: 'Hyg',
  cm: 'Cm',
  strep: 'Strep',
};

/**
 * Normalize one resistance value: `Kan + Gen + Rif`, `bac:Kan`, `Kan???`.
 *
 * A trailing `?` is kept — collapsed to one — because it is the author marking
 * the value as uncertain, and dropping it would silently launder a doubt into
 * a fact. `data-quality` surfaces it from there.
 */
function normalizeResistanceValue(raw: string): string | null {
  const parts = raw
    .split('+')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  const normalized = parts.map((part) => {
    const uncertain = /\?+$/.test(part);
    const bare = part.replace(/\?+$/, '').trim();
    const canonical = RESISTANCE_CASE[bare.toLowerCase()] ?? bare;
    return uncertain ? `${canonical}?` : canonical;
  });

  const joined = normalized.join(' + ').trim();
  return joined.length > 0 ? joined : null;
}

/**
 * Split the sheet's `markers` column into bacterial and plant resistance.
 *
 * The plasmid sheet prefixes values with `bac:` in four different spellings
 * (`bac: Kan`, `bac:Kan`, `Bac: Kan`, `Bac:Kan`); the Agrobacterium sheet has
 * no prefix and lists several resistances, because the strain already carries
 * some before any plasmid goes in. An unprefixed value is therefore bacterial.
 */
export function parseMarkers(raw: unknown): Markers {
  const text = blankToNull(raw);
  if (!text) {
    return { bacterial: null, plant: null };
  }

  const bacterial: string[] = [];
  const plant: string[] = [];

  for (const segment of text.split(/[;\n]/)) {
    const trimmed = segment.trim();
    if (trimmed.length === 0) {
      continue;
    }
    const labelled = /^(bac|bacteria|bacterial|plant|plants)\s*:\s*(.*)$/i.exec(trimmed);
    if (labelled) {
      const target = /^plant/i.test(labelled[1]) ? plant : bacterial;
      const value = normalizeResistanceValue(labelled[2]);
      if (value) {
        target.push(value);
      }
      continue;
    }
    const value = normalizeResistanceValue(trimmed);
    if (value) {
      bacterial.push(value);
    }
  }

  return {
    bacterial: bacterial.length > 0 ? bacterial.join(' + ') : null,
    plant: plant.length > 0 ? plant.join(' + ') : null,
  };
}

/** True when a resistance value carries the author's uncertainty marker */
export function isUncertainResistance(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.includes('?');
}

/**
 * A numeric cell as clean text, or null when it is not a number at all.
 *
 * Strict on purpose. The lab writes `xxx` and `xxxx` as placeholders for
 * "not measured yet", and stripping non-digits from those would leave an empty
 * string, which `Number('')` turns into 0 — printing a real-looking
 * `0.0 ng/µL` onto a label for a concentration nobody has taken.
 */
function numericText(value: unknown): string | null {
  const text = blankToNull(value);
  if (!text) {
    return null;
  }
  const cleaned = text.replace(/\s/g, '').replace(',', '.');
  return /^-?(\d+\.?\d*|\.\d+)$/.test(cleaned) ? cleaned : null;
}

/** Parse an integer cell, returning null for blanks and placeholders */
export function parseIntegerCell(value: unknown): number | null {
  const text = numericText(value);
  return text === null ? null : Math.round(Number(text));
}

/** Parse a decimal cell (concentrations), returning null for blanks and placeholders */
export function parseDecimalCell(value: unknown): number | null {
  const text = numericText(value);
  return text === null ? null : Number(text);
}

/**
 * Order stock IDs the way the freezer box is ordered.
 *
 * Plain string comparison puts `AJM10` before `AJM2`, which would deal a label
 * sheet in an order nobody can file. Sorts on the letters first, then the
 * number, then the aliquot suffix: AJM2, AJM5, AJM5.1, AJM5.2, AJM10.
 */
export function compareStockIds(a: string, b: string): number {
  const parse = (
    value: string
  ): { prefix: string; number: number; aliquot: number; raw: string } => {
    const match = /^([A-Za-z]+)(\d+)(?:\.(\d+))?$/.exec(value.trim());
    if (!match) {
      return { prefix: value, number: Number.MAX_SAFE_INTEGER, aliquot: 0, raw: value };
    }
    return {
      prefix: match[1] as string,
      number: Number(match[2]),
      aliquot: match[3] ? Number(match[3]) : 0,
      raw: value,
    };
  };

  const left = parse(a);
  const right = parse(b);

  return (
    left.prefix.localeCompare(right.prefix) ||
    left.number - right.number ||
    left.aliquot - right.aliquot ||
    left.raw.localeCompare(right.raw)
  );
}
