/**
 * Unit Tests: primer sequence calculations (pure domain logic)
 */

import {
  gcPercent,
  isValidPrimerSequence,
  wallaceTm,
  WALLACE_MAX_LENGTH,
} from '@domain/primer-calc';

describe('primer-calc', () => {
  describe('isValidPrimerSequence', () => {
    it('accepts ACGT and IUPAC degenerate codes', () => {
      expect(isValidPrimerSequence('ACGT')).toBe(true);
      expect(isValidPrimerSequence('ACGTRYSWKMBDHVN')).toBe(true);
    });

    it('rejects other characters', () => {
      expect(isValidPrimerSequence('ACGU')).toBe(false); // RNA
      expect(isValidPrimerSequence('ACG T')).toBe(false);
      expect(isValidPrimerSequence('ACG-T')).toBe(false);
      expect(isValidPrimerSequence('')).toBe(false);
    });
  });

  describe('gcPercent', () => {
    it('computes GC fraction with one decimal', () => {
      expect(gcPercent('GGCC')).toBe(100);
      expect(gcPercent('AATT')).toBe(0);
      expect(gcPercent('ACGT')).toBe(50);
      expect(gcPercent('ACG')).toBe(66.7);
    });

    it('counts S (G|C) as GC; other degenerate codes only add length', () => {
      expect(gcPercent('SSSS')).toBe(100);
      expect(gcPercent('GCRN')).toBe(50);
    });
  });

  describe('wallaceTm', () => {
    it('applies 2·(A+T) + 4·(G+C)', () => {
      expect(wallaceTm('AATT')).toBe(8);
      expect(wallaceTm('GGCC')).toBe(16);
      // Classic M13 forward: GTAAAACGACGGCCAGT → 10 AT, 7 GC → 2·10+4·7 = 48...
      // count: G T A A A A C G A C G G C C A G T → A/T: T,A,A,A,A,A,A,T = 8? Verified below.
      expect(wallaceTm('GTAAAACGACGGCCAGT')).toBe(2 * 8 + 4 * 9);
    });

    it('returns null beyond the length bound or with degenerate codes', () => {
      expect(wallaceTm('A'.repeat(WALLACE_MAX_LENGTH))).toBe(2 * WALLACE_MAX_LENGTH);
      expect(wallaceTm('A'.repeat(WALLACE_MAX_LENGTH + 1))).toBeNull();
      expect(wallaceTm('ACGN')).toBeNull();
    });
  });
});
