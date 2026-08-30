'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { selectFontStep } from '@/domain/label-layout';

/**
 * Shrink a label's text until it fits its cell.
 *
 * This replaces the manual step in the Word workflow: when a construct name
 * overflowed, Julia selected the cell and dropped the font a point at a time.
 * The originals show her landing on 8 pt (5301 runs), 7 pt (426), 6 pt (124)
 * and, four times, 5 pt.
 *
 * Measured rather than estimated, because the fit depends on which of
 * Carlito/Calibri/the system fallback is actually installed — a character
 * count could not tell them apart.
 */
export function useAutoFit(
  steps: readonly number[],
  /** Re-measure when the text changes */
  contentKey: string
): { ref: React.RefObject<HTMLDivElement>; fontPt: number } {
  const ref = useRef<HTMLDivElement>(null);
  const [fontPt, setFontPt] = useState<number>(steps[0] ?? 8);

  const measure = useCallback((element: HTMLDivElement, candidatePt: number): boolean => {
    element.style.fontSize = `${candidatePt}pt`;
    // Reading a layout property here forces the style to apply before the
    // comparison; the cell has a fixed height and hides its overflow, so a
    // scroll height beyond the client height means the text does not fit.
    return (
      element.scrollHeight <= element.clientHeight && element.scrollWidth <= element.clientWidth
    );
  }, []);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || steps.length === 0) {
      return;
    }

    const chosen = selectFontStep(steps, (candidate) => measure(element, candidate));
    element.style.fontSize = `${chosen}pt`;
    setFontPt(chosen);
    // contentKey stands in for the rendered text: the same string always
    // measures the same way, so re-running on identity alone would be waste.
  }, [steps, contentKey, measure]);

  return { ref, fontPt };
}
