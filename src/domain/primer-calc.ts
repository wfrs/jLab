/**
 * Primer sequence calculations (pure domain logic)
 * gcPercent and tmCelsius are derived values, recomputed on every
 * sequence write — never accepted from clients.
 */

/** IUPAC nucleotide codes (degenerate codes included) */
const IUPAC_NUCLEOTIDES = /^[ACGTRYSWKMBDHVN]+$/;

/** Wallace rule is only meaningful for short, unambiguous oligos */
export const WALLACE_MAX_LENGTH = 30;

/**
 * Validate a primer sequence: IUPAC nucleotide letters only.
 * Expects an already-uppercased string.
 */
export function isValidPrimerSequence(sequence: string): boolean {
  return IUPAC_NUCLEOTIDES.test(sequence);
}

/**
 * GC content in percent, one decimal. S (G or C) counts as GC;
 * other degenerate codes count toward length only.
 */
export function gcPercent(sequence: string): number {
  if (sequence.length === 0) return 0;
  let gc = 0;
  for (const base of sequence) {
    if (base === 'G' || base === 'C' || base === 'S') gc += 1;
  }
  return Math.round((gc / sequence.length) * 1000) / 10;
}

/**
 * Melting temperature via the Wallace rule: 2°C·(A+T) + 4°C·(G+C).
 * Returns null for sequences with degenerate codes or longer than
 * WALLACE_MAX_LENGTH, where the rule does not apply.
 */
export function wallaceTm(sequence: string): number | null {
  if (sequence.length === 0 || sequence.length > WALLACE_MAX_LENGTH) return null;
  let at = 0;
  let gc = 0;
  for (const base of sequence) {
    if (base === 'A' || base === 'T') at += 1;
    else if (base === 'G' || base === 'C') gc += 1;
    else return null;
  }
  return 2 * at + 4 * gc;
}
