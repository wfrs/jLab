/**
 * Golden Gate mix.
 *
 * Every expected number is the value the lab's own `parts` sheet computed, read
 * out of the workbook's cached formula results.
 */

import {
  DEFAULT_FINAL_VOLUME_UL,
  FMOL_TARGET,
  MW_END_CORRECTION,
  MW_PER_BASE_PAIR,
  calculateMix,
  calculatePart,
  massForFmol,
  minimumUsableConcentrationNgUl,
  molecularWeight,
} from '@domain/golden-gate';

describe('molecular weight', () => {
  it('is 615.96 per base pair plus a 36.04 end correction', () => {
    expect(MW_PER_BASE_PAIR).toBe(615.96);
    expect(MW_END_CORRECTION).toBe(36.04);
    expect(molecularWeight(453)).toBeCloseTo(453 * 615.96 + 36.04, 6);
  });
});

describe('massForFmol', () => {
  it('matches the sheet for the virB promoter (453 bp, 40 fmol)', () => {
    // parts!D2 = 11.162636799999998
    expect(massForFmol(453, 40)).toBeCloseTo(11.1626368, 9);
  });

  it('matches the sheet for the virD promoter (267 bp, 40 fmol)', () => {
    // parts!D3 = 6.5798944
    expect(massForFmol(267, 40)).toBeCloseTo(6.5798944, 9);
  });

  it('matches the sheet for a backbone at 20 fmol', () => {
    // parts!M2 = 59.8720328 for pMiso211b_new at 4860 bp
    expect(massForFmol(4860, 20)).toBeCloseTo(59.8720328, 7);
    // parts!M3 = 45.5201648 for pMiso001_MFG at 3695 bp
    expect(massForFmol(3695, 20)).toBeCloseTo(45.5201648, 7);
  });

  it('scales linearly with the molar amount', () => {
    expect(massForFmol(1000, 40)).toBeCloseTo(2 * massForFmol(1000, 20), 9);
  });
});

describe('targets', () => {
  it('puts inserts in at 40 fmol and backbones at 20', () => {
    expect(FMOL_TARGET.insert).toBe(40);
    expect(FMOL_TARGET.backbone).toBe(20);
  });
});

describe('calculatePart', () => {
  it('reproduces the virB promoter row end to end', () => {
    // parts row 2: size 453, conc 127.448
    //   D2 ng for 40 fmol            = 11.1626368
    //   E2 conc for 0.5 µL           = 22.3252736
    //   G2 30 µL of GG concentration = 5.25514882932647
    //   H2 Tris-HCl                  = 24.74485117067353
    const result = calculatePart({
      name: 'virB promoter',
      role: 'insert',
      sizeBp: 453,
      stockConcentrationNgUl: 127.448,
    });

    expect(result.massNg).toBeCloseTo(11.1626368, 9);
    expect(result.targetConcentrationNgUl).toBeCloseTo(22.3252736, 9);
    expect(result.stockVolumeUl).toBeCloseTo(5.25514882932647, 9);
    expect(result.bufferVolumeUl).toBeCloseTo(24.74485117067353, 9);
    expect(result.tooDilute).toBe(false);
  });

  it('reproduces the pMiso001_MFG backbone row', () => {
    // parts row 3 right block: size 3695, conc 226.5
    //   P3 = 12.058321801324505, Q3 = 17.941678198675497
    const result = calculatePart({
      name: 'pMiso001_MFG',
      role: 'backbone',
      sizeBp: 3695,
      stockConcentrationNgUl: 226.5,
    });

    expect(result.stockVolumeUl).toBeCloseTo(12.058321801324505, 9);
    expect(result.bufferVolumeUl).toBeCloseTo(17.941678198675497, 9);
  });

  it('reports a stock that is too dilute instead of a negative volume', () => {
    // parts!Q2: pMiso211b_new at 48 ng/µL gives Tris-HCl = -44.840041.
    // A negative volume is not something anyone can pipette.
    const result = calculatePart({
      name: 'pMiso211b_new',
      role: 'backbone',
      sizeBp: 4860,
      stockConcentrationNgUl: 48,
    });

    expect(result.tooDilute).toBe(true);
    expect(result.bufferVolumeUl).toBeNull();
    // The stock volume the sheet computed is still reported, so the size of
    // the shortfall is visible: it wanted 74.8 µL of a 30 µL reaction
    expect(result.stockVolumeUl).toBeCloseTo(74.840041, 6);
  });

  it('names the concentration the stock would need to be usable', () => {
    const result = calculatePart({
      name: 'pMiso211b_new',
      role: 'backbone',
      sizeBp: 4860,
      stockConcentrationNgUl: 48,
    });

    // At exactly the target concentration the whole reaction is stock and no
    // buffer is added — the boundary of what is achievable
    const minimum = minimumUsableConcentrationNgUl(result);
    expect(minimum).toBeCloseTo(119.7440656, 6);
    expect(minimum).toBeGreaterThan(48);

    const atMinimum = calculatePart({
      name: 'pMiso211b_new',
      role: 'backbone',
      sizeBp: 4860,
      stockConcentrationNgUl: minimum,
    });
    expect(atMinimum.tooDilute).toBe(false);
    expect(atMinimum.stockVolumeUl).toBeCloseTo(DEFAULT_FINAL_VOLUME_UL, 6);
    expect(atMinimum.bufferVolumeUl).toBeCloseTo(0, 6);
  });

  it('computes the target even when the stock has never been measured', () => {
    // The lab writes "xxx" while waiting on a Nanodrop reading; the mass and
    // target are still worth knowing
    const result = calculatePart({
      name: 'pJM0376',
      role: 'insert',
      sizeBp: 453,
      stockConcentrationNgUl: null,
    });

    expect(result.unmeasured).toBe(true);
    expect(result.massNg).toBeCloseTo(11.1626368, 9);
    expect(result.targetConcentrationNgUl).toBeCloseTo(22.3252736, 9);
    expect(result.stockVolumeUl).toBeNull();
    expect(result.bufferVolumeUl).toBeNull();
    expect(result.tooDilute).toBe(false);
  });

  it('treats a zero or negative concentration as unmeasured, not as infinity', () => {
    for (const stockConcentrationNgUl of [0, -5, Number.NaN]) {
      const result = calculatePart({
        name: 'x',
        role: 'insert',
        sizeBp: 100,
        stockConcentrationNgUl,
      });
      expect(result.unmeasured).toBe(true);
      expect(result.stockVolumeUl).toBeNull();
    }
  });

  it('honours a different final volume', () => {
    const thirty = calculatePart({
      name: 'virB promoter',
      role: 'insert',
      sizeBp: 453,
      stockConcentrationNgUl: 127.448,
    });
    const sixty = calculatePart(
      { name: 'virB promoter', role: 'insert', sizeBp: 453, stockConcentrationNgUl: 127.448 },
      { finalVolumeUl: 60 }
    );

    expect(sixty.stockVolumeUl).toBeCloseTo((thirty.stockVolumeUl as number) * 2, 9);
    expect(sixty.targetConcentrationNgUl).toBeCloseTo(thirty.targetConcentrationNgUl, 9);
  });

  it('halves the mass when the same fragment is used as a backbone', () => {
    const insert = calculatePart({ name: 'x', role: 'insert', sizeBp: 3695 });
    const backbone = calculatePart({ name: 'x', role: 'backbone', sizeBp: 3695 });

    expect(backbone.massNg).toBeCloseTo(insert.massNg / 2, 9);
  });
});

describe('calculateMix', () => {
  it('keeps every part, in order', () => {
    const results = calculateMix([
      { name: 'virB promoter', role: 'insert', sizeBp: 453, stockConcentrationNgUl: 127.448 },
      { name: 'virD promoter', role: 'insert', sizeBp: 267, stockConcentrationNgUl: 233.5 },
      { name: 'pMiso001_MFG', role: 'backbone', sizeBp: 3695, stockConcentrationNgUl: 226.5 },
    ]);

    expect(results.map((result) => result.name)).toEqual([
      'virB promoter',
      'virD promoter',
      'pMiso001_MFG',
    ]);
    expect(results.filter((result) => result.tooDilute)).toHaveLength(0);
  });

  it('is empty for an empty mix', () => {
    expect(calculateMix([])).toEqual([]);
  });
});
