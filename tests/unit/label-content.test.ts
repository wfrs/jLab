/**
 * Label text.
 *
 * Every expectation is taken from the lab's own printed labels
 * (`gmocu/example/plasmid_labels.docx`), which is the specification.
 */

import {
  UNMEASURED_CONCENTRATION,
  buildGlycerolLabelLines,
  buildPlasmidLabelLines,
  formatConcentration,
  formatLabelDate,
  formatPrepLine,
  formatStockDate,
} from '@domain/label-content';

describe('formatLabelDate', () => {
  it('renders an ISO date as DD.MM.YY', () => {
    expect(formatLabelDate('2024-01-31')).toBe('31.01.24');
    expect(formatLabelDate('2024-01-23')).toBe('23.01.24');
  });

  it('shortens a four-digit year, which the originals write inconsistently', () => {
    // The document holds both "25.03.2026" and "25.03.26"
    expect(formatLabelDate('2026-03-25')).toBe('25.03.26');
  });

  it('keeps leading zeros', () => {
    expect(formatLabelDate('2025-03-05')).toBe('05.03.25');
  });

  it('returns null for a missing or unparseable date rather than printing junk', () => {
    expect(formatLabelDate(null)).toBeNull();
    expect(formatLabelDate(undefined)).toBeNull();
    expect(formatLabelDate('')).toBeNull();
    expect(formatLabelDate('31.01.2024')).toBeNull();
    expect(formatLabelDate('not a date')).toBeNull();
  });
});

describe('formatConcentration', () => {
  it('prints one decimal and a space before the unit', () => {
    expect(formatConcentration(80)).toBe('80.0 ng/µL');
    expect(formatConcentration(176)).toBe('176.0 ng/µL');
    expect(formatConcentration(53.8)).toBe('53.8 ng/µL');
  });

  it('adds the space the originals sometimes miss', () => {
    // pJM0338's label reads "209.3ng/µL"
    expect(formatConcentration(209.3)).toBe('209.3 ng/µL');
  });

  it('rounds to one decimal', () => {
    expect(formatConcentration(21.24)).toBe('21.2 ng/µL');
    expect(formatConcentration(21.26)).toBe('21.3 ng/µL');
  });

  it('marks an unmeasured prep rather than printing a zero', () => {
    // A strip-then-Number read of the lab's "xxx" placeholder yields 0, which
    // would print "0.0 ng/µL" on a tube that simply has not been measured.
    expect(formatConcentration(null)).toBe(UNMEASURED_CONCENTRATION);
    expect(formatConcentration(undefined)).toBe(UNMEASURED_CONCENTRATION);
    expect(formatConcentration(Number.NaN)).toBe(UNMEASURED_CONCENTRATION);
    expect(formatConcentration(Number.POSITIVE_INFINITY)).toBe(UNMEASURED_CONCENTRATION);
  });

  it('prints a genuine zero as a zero', () => {
    expect(formatConcentration(0)).toBe('0.0 ng/µL');
  });
});

describe('formatPrepLine', () => {
  it('joins initials and date as the originals do', () => {
    expect(formatPrepLine('JM', '2024-01-31')).toBe('JM 31.01.24');
  });

  it('collapses the doubled space seen in "JM  25.03.26"', () => {
    expect(formatPrepLine(' JM ', '2025-03-25')).toBe('JM 25.03.25');
  });

  it('falls back to whichever half exists', () => {
    expect(formatPrepLine('JM', null)).toBe('JM');
    expect(formatPrepLine(null, '2024-01-31')).toBe('31.01.24');
    expect(formatPrepLine(null, null)).toBeNull();
    expect(formatPrepLine('  ', null)).toBeNull();
  });
});

describe('buildPlasmidLabelLines', () => {
  it('reproduces row 1 of the lab document', () => {
    const lines = buildPlasmidLabelLines({
      accession: 'pJM0001',
      constructName: 'pMiso000',
      operatorInitials: 'JM',
      preppedOn: '2024-01-31',
      concentrationNgUl: 80,
    });

    expect(lines.map((line) => line.text)).toEqual([
      'pJM0001',
      'pMiso000',
      'JM 31.01.24',
      '80.0 ng/µL',
    ]);
  });

  it('bolds only the accession', () => {
    // Bold on line 1 in 413 of 413 labels, against 50%, 68% and 88% on the
    // lines below — the lower lines are hand-typing drift, not a rule.
    const lines = buildPlasmidLabelLines({
      accession: 'pJM0001',
      constructName: 'pMiso000',
      operatorInitials: 'JM',
      preppedOn: '2024-01-31',
      concentrationNgUl: 80,
    });

    expect(lines[0]?.bold).toBe(true);
    expect(lines.slice(1).some((line) => line.bold)).toBe(false);
  });

  it('prints the placeholder when a prep has no measurement', () => {
    const lines = buildPlasmidLabelLines({
      accession: 'pJM0376',
      constructName: 'pMiso999',
      operatorInitials: 'JM',
      preppedOn: '2025-03-25',
      concentrationNgUl: null,
    });

    expect(lines.map((line) => line.text)).toEqual([
      'pJM0376',
      'pMiso999',
      'JM 25.03.25',
      UNMEASURED_CONCENTRATION,
    ]);
  });

  it('omits the date and concentration when the plasmid has never been prepped', () => {
    // pJM0355 and pJM0356 are designed but not yet cloned; a blank line would
    // only push the remaining text off centre.
    const lines = buildPlasmidLabelLines({
      accession: 'pJM0355',
      constructName: 'pMisoPlanned',
    });

    expect(lines.map((line) => line.text)).toEqual(['pJM0355', 'pMisoPlanned']);
  });

  it('omits the construct name when there is none', () => {
    const lines = buildPlasmidLabelLines({
      accession: 'pJM0999',
      constructName: null,
      operatorInitials: 'JM',
      preppedOn: '2024-01-31',
      concentrationNgUl: 80,
    });

    expect(lines.map((line) => line.text)).toEqual(['pJM0999', 'JM 31.01.24', '80.0 ng/µL']);
  });

  it('never runs the construct name into the date', () => {
    // 280 of the 413 hand-typed labels have lines 2 and 3 merged by a missed
    // line break, e.g. "pPXm_35Spr-PhiC31-FLAGJM 25.03.2026".
    const lines = buildPlasmidLabelLines({
      accession: 'pJM0336',
      constructName: 'pPXm_35Spr-PhiC31-FLAG',
      operatorInitials: 'JM',
      preppedOn: '2026-03-25',
      concentrationNgUl: 265.7,
    });

    expect(lines.map((line) => line.text)).toEqual([
      'pJM0336',
      'pPXm_35Spr-PhiC31-FLAG',
      'JM 25.03.26',
      '265.7 ng/µL',
    ]);
    expect(lines.some((line) => /FLAGJM/.test(line.text))).toBe(false);
  });

  it('trims the trailing spaces the originals carry', () => {
    const lines = buildPlasmidLabelLines({
      accession: 'pJM0039',
      constructName: 'pMiso001_M1L_S267L_G107C-RepA_WT ',
    });

    expect(lines[1]?.text).toBe('pMiso001_M1L_S267L_G107C-RepA_WT');
  });

  it('never emits more lines than the cell is sized for', () => {
    const lines = buildPlasmidLabelLines({
      accession: 'pJM0001',
      constructName: 'pMiso000',
      operatorInitials: 'JM',
      preppedOn: '2024-01-31',
      concentrationNgUl: 80,
    });

    expect(lines.length).toBeLessThanOrEqual(4);
  });
});

describe('formatStockDate', () => {
  it('writes the year in full, as the glycerol document does', () => {
    // 151 labels use DD.MM.YYYY against 34 short — the opposite balance to the
    // plasmid labels, so each document keeps its own convention
    expect(formatStockDate('2024-01-23')).toBe('23.01.2024');
    expect(formatStockDate('2025-09-24')).toBe('24.09.2025');
  });

  it('returns null rather than printing a broken date', () => {
    expect(formatStockDate(null)).toBeNull();
    expect(formatStockDate('24.10.2024')).toBeNull();
  });
});

describe('buildGlycerolLabelLines', () => {
  it('reproduces CJM1 from the lab document', () => {
    const lines = buildGlycerolLabelLines({
      stockId: 'CJM1',
      organism: 'E. coli',
      strain: 'TOP10',
      constructName: 'pMiso000',
      accession: 'pJM0001',
      madeOn: '2024-01-23',
    });

    expect(lines.map((line) => line.text)).toEqual([
      'CJM1',
      'E. coli TOP10',
      'pMiso000',
      '23.01.2024',
    ]);
  });

  it('sets the organism in italics and the strain roman', () => {
    // 470 of 472 labels do exactly this; not one sets the strain in italics
    const [, organismLine] = buildGlycerolLabelLines({
      stockId: 'CJM1',
      organism: 'E. coli',
      strain: 'TOP10',
    });

    expect(organismLine?.segments).toEqual([{ text: 'E. coli', italic: true }, { text: ' TOP10' }]);
  });

  it('bolds only the stock ID', () => {
    const lines = buildGlycerolLabelLines({
      stockId: 'CJM1',
      organism: 'E. coli',
      strain: 'TOP10',
      constructName: 'pMiso000',
      madeOn: '2024-01-23',
    });

    expect(lines[0]?.bold).toBe(true);
    expect(lines.slice(1).some((line) => line.bold)).toBe(false);
  });

  it('appends the accession only when the stock ID does not already encode it', () => {
    // CJM1 is derived from pJM0001, so repeating it would be noise
    const ecoli = buildGlycerolLabelLines({
      stockId: 'CJM152',
      organism: 'E. coli',
      strain: 'TOP10',
      constructName: 'pPXm_35SprFL-sGeNL(C)',
      accession: 'pJM0152',
    });
    expect(ecoli[2]?.text).toBe('pPXm_35SprFL-sGeNL(C)');

    // AJM9 says nothing about pJM0152, so the label spells it out — as 22 of
    // the lab's own Agrobacterium labels do
    const agro = buildGlycerolLabelLines({
      stockId: 'AJM9',
      organism: 'A. tumefaciens',
      strain: 'GV3101 pMP90',
      constructName: 'pPXm_35SprFL-sGeNL(C)',
      accession: 'pJM0152',
    });
    expect(agro[2]?.text).toBe('pPXm_35SprFL-sGeNL(C) (pJM0152)');
  });

  it('renders a strain-only stock as three lines', () => {
    // AJM1: no plasmid, just the strain in the freezer
    const lines = buildGlycerolLabelLines({
      stockId: 'AJM1',
      organism: 'A. tumefaciens',
      strain: 'GV3101 pMP90 (CPGE)',
      madeOn: '2024-06-20',
    });

    expect(lines.map((line) => line.text)).toEqual([
      'AJM1',
      'A. tumefaciens GV3101 pMP90 (CPGE)',
      '20.06.2024',
    ]);
  });

  it('appends the operator initials to the strain', () => {
    // "TOP10 JM", "TOP10 LN" and "TOP10 INA" appear on 233 of the originals
    const [, organismLine] = buildGlycerolLabelLines({
      stockId: 'CJM260',
      organism: 'E. coli',
      strain: 'TOP10',
      operatorInitials: 'LN',
    });

    expect(organismLine?.text).toBe('E. coli TOP10 LN');
  });

  it('omits the date for a stock number that was reserved but never made', () => {
    const lines = buildGlycerolLabelLines({
      stockId: 'CJM355',
      organism: 'E. coli',
      strain: 'TOP10',
      madeOn: null,
    });

    expect(lines.map((line) => line.text)).toEqual(['CJM355', 'E. coli TOP10']);
  });

  it('renders an aliquot under its own ID', () => {
    const lines = buildGlycerolLabelLines({
      stockId: 'AJM5.1',
      organism: 'A. tumefaciens',
      strain: 'GV3101 pMP90 (Goldbio)',
      madeOn: '2024-10-24',
    });

    expect(lines[0]).toEqual({ text: 'AJM5.1', bold: true });
  });

  it('never runs the stock ID into the organism', () => {
    // Two of the originals read "AJM5.1A. tumefaciens GV3101 pMP90 (Goldbio)"
    const lines = buildGlycerolLabelLines({
      stockId: 'AJM5.1',
      organism: 'A. tumefaciens',
      strain: 'GV3101 pMP90 (Goldbio)',
      madeOn: '2024-10-24',
    });

    expect(lines.some((line) => /AJM5\.1A\./.test(line.text))).toBe(false);
    expect(lines).toHaveLength(3);
  });

  it('stays within the four lines the cell is sized for', () => {
    const lines = buildGlycerolLabelLines({
      stockId: 'AJM30',
      organism: 'A. tumefaciens',
      strain: 'GV3101 pMP90',
      operatorInitials: 'JM',
      constructName: 'pMisoMFG_Tetp-NLS-B3-GALLS(41C)-rnpBt',
      accession: 'pJM0347',
      madeOn: '2025-03-25',
    });

    expect(lines.length).toBeLessThanOrEqual(4);
  });
});
