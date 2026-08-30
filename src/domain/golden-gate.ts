/**
 * Golden Gate assembly mix.
 *
 * Reimplements the `parts` sheet of `plasmids_JM_expanded.xlsx`, whose formulas
 * are (columns as they appear there):
 *
 *     D  ng for 40 fmol  = (40 * ((size * 615.96) + 36.04)) * 1e-6
 *     E  conc for 0.5 µL = D / 0.5
 *     G  stock volume    = (30 * E) / measured concentration
 *     H  Tris-HCl        = 30 - G
 *
 * with a second block using 20 fmol for backbones. Pure and unit-tested; the
 * precedent is `primer-calc.ts`.
 *
 * The sheet returns a negative Tris-HCl volume when the stock is too dilute to
 * reach the target in 30 µL — `pMiso211b_new` gives −44.8 µL, and six other
 * rows are negative too. A negative volume is not a number anyone can pipette,
 * so this reports the condition instead.
 */

/** Average molecular weight of one base pair of double-stranded DNA, g/mol */
export const MW_PER_BASE_PAIR = 615.96;

/** Added once for the ends of the duplex */
export const MW_END_CORRECTION = 36.04;

/**
 * The lab's targets: inserts go in at twice the molar amount of the backbone,
 * which is the usual Golden Gate ratio.
 */
export const FMOL_TARGET = {
  insert: 40,
  backbone: 20,
} as const;

export type PartRole = keyof typeof FMOL_TARGET;

/** The sheet mixes to 30 µL, measuring parts into 0.5 µL */
export const DEFAULT_FINAL_VOLUME_UL = 30;
export const DEFAULT_PART_VOLUME_UL = 0.5;

/**
 * Slack for floating-point representation only, not for pipetting.
 *
 * A stock at exactly the target concentration needs the whole final volume and
 * no buffer, but `30 - (30 * c) / c` lands a few parts in 10^15 below zero and
 * would otherwise be reported as too dilute.
 */
const VOLUME_EPSILON_UL = 1e-9;

/** Molecular weight of a double-stranded fragment, g/mol */
export function molecularWeight(sizeBp: number): number {
  return sizeBp * MW_PER_BASE_PAIR + MW_END_CORRECTION;
}

/**
 * Mass of DNA holding `fmol` femtomoles of a fragment of `sizeBp`, in ng.
 *
 * fmol × (g/mol) × 1e-15 mol/fmol × 1e9 ng/g = fmol × MW × 1e-6.
 */
export function massForFmol(sizeBp: number, fmol: number): number {
  return fmol * molecularWeight(sizeBp) * 1e-6;
}

export interface GoldenGatePartInput {
  name: string;
  role: PartRole;
  sizeBp: number;
  /** Measured stock concentration, ng/µL; absent when never measured */
  stockConcentrationNgUl?: number | null;
}

export interface GoldenGatePartResult {
  name: string;
  role: PartRole;
  sizeBp: number;
  fmolTarget: number;
  /** ng of this part needed per reaction */
  massNg: number;
  /** Concentration a 0.5 µL addition must have, ng/µL */
  targetConcentrationNgUl: number;
  stockConcentrationNgUl: number | null;
  /** µL of stock to dilute; null when the concentration is unknown */
  stockVolumeUl: number | null;
  /** µL of Tris-HCl to top up to the final volume; null when not achievable */
  bufferVolumeUl: number | null;
  /**
   * The stock is too dilute to reach the target in the final volume — the
   * sheet's negative Tris-HCl, stated as the condition it actually is.
   */
  tooDilute: boolean;
  /** Set when the concentration is missing, so nothing can be computed */
  unmeasured: boolean;
}

export interface GoldenGateOptions {
  finalVolumeUl?: number;
  partVolumeUl?: number;
}

/**
 * Work out the dilution for one part.
 *
 * Everything follows from C₁V₁ = C₂V₂: the stock has to supply
 * `targetConcentration × finalVolume` ng, so `stockVolume` is that divided by
 * the stock's concentration, and the rest of the final volume is buffer.
 */
export function calculatePart(
  part: GoldenGatePartInput,
  options: GoldenGateOptions = {}
): GoldenGatePartResult {
  const finalVolumeUl = options.finalVolumeUl ?? DEFAULT_FINAL_VOLUME_UL;
  const partVolumeUl = options.partVolumeUl ?? DEFAULT_PART_VOLUME_UL;
  const fmolTarget = FMOL_TARGET[part.role];

  const massNg = massForFmol(part.sizeBp, fmolTarget);
  const targetConcentrationNgUl = massNg / partVolumeUl;

  const stock = part.stockConcentrationNgUl;
  const unmeasured = stock === null || stock === undefined || !Number.isFinite(stock) || stock <= 0;

  if (unmeasured) {
    return {
      name: part.name,
      role: part.role,
      sizeBp: part.sizeBp,
      fmolTarget,
      massNg,
      targetConcentrationNgUl,
      stockConcentrationNgUl: null,
      stockVolumeUl: null,
      bufferVolumeUl: null,
      tooDilute: false,
      unmeasured: true,
    };
  }

  const stockVolumeUl = (finalVolumeUl * targetConcentrationNgUl) / (stock as number);
  const rawBufferVolumeUl = finalVolumeUl - stockVolumeUl;
  const tooDilute = rawBufferVolumeUl < -VOLUME_EPSILON_UL;
  const bufferVolumeUl = Math.max(0, rawBufferVolumeUl);

  return {
    name: part.name,
    role: part.role,
    sizeBp: part.sizeBp,
    fmolTarget,
    massNg,
    targetConcentrationNgUl,
    stockConcentrationNgUl: stock as number,
    stockVolumeUl,
    bufferVolumeUl: tooDilute ? null : bufferVolumeUl,
    tooDilute,
    unmeasured: false,
  };
}

export function calculateMix(
  parts: GoldenGatePartInput[],
  options: GoldenGateOptions = {}
): GoldenGatePartResult[] {
  return parts.map((part) => calculatePart(part, options));
}

/**
 * The concentration a stock would need for the target to be reachable at all —
 * what to tell someone whose stock is too dilute.
 */
export function minimumUsableConcentrationNgUl(
  result: Pick<GoldenGatePartResult, 'targetConcentrationNgUl'>
): number {
  // stockVolume <= finalVolume means stock >= targetConcentration
  return result.targetConcentrationNgUl;
}
