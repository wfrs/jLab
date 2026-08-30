/**
 * Unit tests for the lab spreadsheet normalization helpers.
 * Cases are drawn from the real values in plasmids_JM_expanded.xlsx.
 */

import {
  compareStockIds,
  blankToNull,
  derivedStockId,
  formatAccession,
  isUncertainResistance,
  parseAccession,
  parseAliquot,
  parseDecimalCell,
  parseIntegerCell,
  parseMarkers,
  parseSheetDate,
} from '@domain/lab-normalization';

describe('blankToNull', () => {
  it('treats the sheet placeholders as empty', () => {
    expect(blankToNull('')).toBeNull();
    expect(blankToNull('   ')).toBeNull();
    expect(blankToNull('-')).toBeNull();
    expect(blankToNull('–')).toBeNull();
    expect(blankToNull('NA')).toBeNull();
    expect(blankToNull(null)).toBeNull();
    expect(blankToNull(undefined)).toBeNull();
  });

  it('trims real values', () => {
    expect(blankToNull('  TOP10 ')).toBe('TOP10');
    expect(blankToNull(0)).toBe('0');
  });
});

describe('parseAccession', () => {
  it('parses a plasmid accession', () => {
    expect(parseAccession('pJM0001')).toEqual({
      prefix: 'p',
      initials: 'JM',
      number: 1,
      padWidth: 4,
    });
    expect(parseAccession('pJM0405')).toMatchObject({ number: 405 });
  });

  it('rejects construct names, which are not accessions', () => {
    expect(parseAccession('pMiso000')).toBeNull();
    expect(parseAccession('pMisoMFG_virEp-TrmAWT-FLAG-rnpBt')).toBeNull();
    expect(parseAccession('pEgg_Bxb1')).toBeNull();
    expect(parseAccession('')).toBeNull();
    expect(parseAccession(null)).toBeNull();
  });

  it('round-trips through formatAccession', () => {
    for (const name of ['pJM0001', 'pJM0021', 'pJM0390']) {
      expect(formatAccession(parseAccession(name)!)).toBe(name);
    }
  });
});

describe('derivedStockId', () => {
  it('drops the padding, matching the sheet', () => {
    expect(derivedStockId('pJM0001')).toBe('CJM1');
    expect(derivedStockId('pJM0119')).toBe('CJM119');
    expect(derivedStockId('pJM0390')).toBe('CJM390');
  });

  it('returns null for a non-accession', () => {
    expect(derivedStockId('pMiso000')).toBeNull();
  });
});

describe('parseAliquot', () => {
  it('splits an Agrobacterium aliquot', () => {
    expect(parseAliquot('AJM5.1')).toEqual({ parentStockId: 'AJM5', aliquot: 1 });
    expect(parseAliquot('AJM5.2')).toEqual({ parentStockId: 'AJM5', aliquot: 2 });
    expect(parseAliquot('AJM22.1')).toEqual({ parentStockId: 'AJM22', aliquot: 1 });
  });

  it('returns null for a plain stock ID', () => {
    expect(parseAliquot('CJM1')).toBeNull();
    expect(parseAliquot('AJM38')).toBeNull();
    expect(parseAliquot(null)).toBeNull();
  });
});

describe('parseSheetDate', () => {
  it('reads a real Excel date in UTC', () => {
    expect(parseSheetDate(new Date(Date.UTC(2024, 0, 31)))).toBe('2024-01-31');
    expect(parseSheetDate(new Date(Date.UTC(2026, 6, 29)))).toBe('2026-07-29');
  });

  it('reads the Agrobacterium sheet string forms', () => {
    expect(parseSheetDate('20.06.2024')).toBe('2024-06-20');
    expect(parseSheetDate('25.03.25')).toBe('2025-03-25');
    expect(parseSheetDate('07.06.26')).toBe('2026-06-07');
  });

  it('passes ISO text through', () => {
    expect(parseSheetDate('2025-02-07')).toBe('2025-02-07');
    expect(parseSheetDate('2025-02-07T00:00:00.000Z')).toBe('2025-02-07');
  });

  it('pivots two-digit years at 70', () => {
    expect(parseSheetDate('01.01.69')).toBe('2069-01-01');
    expect(parseSheetDate('01.01.70')).toBe('1970-01-01');
  });

  it('returns null for blanks and nonsense', () => {
    expect(parseSheetDate(null)).toBeNull();
    expect(parseSheetDate('-')).toBeNull();
    expect(parseSheetDate('xx.xx.25')).toBeNull();
    expect(parseSheetDate('99.99.2024')).toBeNull();
    expect(parseSheetDate(new Date('nope'))).toBeNull();
  });
});

describe('parseMarkers', () => {
  it('collapses every spelling of the bacterial prefix', () => {
    for (const raw of ['bac: Kan', 'bac:Kan', 'Bac: Kan', 'Bac:Kan', '  bac :  kan ']) {
      expect(parseMarkers(raw)).toEqual({ bacterial: 'Kan', plant: null });
    }
  });

  it('canonicalises the abbreviations', () => {
    expect(parseMarkers('bac: amp').bacterial).toBe('Amp');
    expect(parseMarkers('Bac:SPEC').bacterial).toBe('Spec');
    expect(parseMarkers('bac: Tet').bacterial).toBe('Tet');
  });

  it('keeps multiple resistances in order for Agrobacterium', () => {
    expect(parseMarkers('Gen + Rif').bacterial).toBe('Gen + Rif');
    expect(parseMarkers('Spec + Kan + Rif + Gen').bacterial).toBe('Spec + Kan + Rif + Gen');
    expect(parseMarkers('Rif').bacterial).toBe('Rif');
  });

  it('preserves the author uncertainty marker', () => {
    expect(parseMarkers('bac: Kan???').bacterial).toBe('Kan?');
    expect(isUncertainResistance(parseMarkers('bac: Kan???').bacterial)).toBe(true);
    expect(isUncertainResistance(parseMarkers('bac: Kan').bacterial)).toBe(false);
    expect(parseMarkers('?').bacterial).toBe('?');
  });

  it('splits a labelled plant resistance', () => {
    expect(parseMarkers('bac: Kan; plant: Hyg')).toEqual({ bacterial: 'Kan', plant: 'Hyg' });
    expect(parseMarkers('plant: Hyg')).toEqual({ bacterial: null, plant: 'Hyg' });
  });

  it('returns nulls for empty cells', () => {
    expect(parseMarkers(null)).toEqual({ bacterial: null, plant: null });
    expect(parseMarkers('–')).toEqual({ bacterial: null, plant: null });
  });
});

describe('numeric cells', () => {
  it('parses integers and decimals', () => {
    expect(parseIntegerCell(3823)).toBe(3823);
    expect(parseIntegerCell('4516')).toBe(4516);
    expect(parseDecimalCell(53.8)).toBe(53.8);
    expect(parseDecimalCell('176')).toBe(176);
  });

  it('returns null rather than NaN', () => {
    expect(parseIntegerCell('NA')).toBeNull();
    expect(parseIntegerCell('-')).toBeNull();
    expect(parseDecimalCell(null)).toBeNull();
  });

  it('never turns a not-measured placeholder into a number', () => {
    // The lab writes these while waiting on a Nanodrop reading; a naive
    // strip-then-Number would yield 0 and print "0.0 ng/µL" on a label.
    for (const placeholder of ['xxx', 'xxxx', 'xx.xx.25', '???']) {
      expect(parseDecimalCell(placeholder)).toBeNull();
      expect(parseIntegerCell(placeholder)).toBeNull();
    }
  });

  it('accepts comma decimals and stray spacing', () => {
    expect(parseDecimalCell('53,8')).toBe(53.8);
    expect(parseDecimalCell(' 176 ')).toBe(176);
  });
});

describe('compareStockIds', () => {
  it('orders by number, not by string — AJM10 comes after AJM2', () => {
    const sorted = ['AJM10', 'AJM2', 'AJM1', 'AJM21'].sort(compareStockIds);
    expect(sorted).toEqual(['AJM1', 'AJM2', 'AJM10', 'AJM21']);
  });

  it('puts an aliquot directly after its parent', () => {
    const sorted = ['AJM5.2', 'AJM6', 'AJM5', 'AJM5.1'].sort(compareStockIds);
    expect(sorted).toEqual(['AJM5', 'AJM5.1', 'AJM5.2', 'AJM6']);
  });

  it('groups the prefixes', () => {
    const sorted = ['CJM2', 'AJM3', 'CJM1', 'AJM1'].sort(compareStockIds);
    expect(sorted).toEqual(['AJM1', 'AJM3', 'CJM1', 'CJM2']);
  });

  it('does not lose an unparseable id', () => {
    const sorted = ['CJM2', 'weird', 'CJM1'].sort(compareStockIds);
    expect(sorted).toHaveLength(3);
    expect(sorted.slice(0, 2)).toEqual(['CJM1', 'CJM2']);
  });
});
