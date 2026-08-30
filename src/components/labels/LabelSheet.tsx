'use client';

import React from 'react';
import { A4_PAGE, LabelSpec, PageSpec, gridForPage } from '@/domain/label-layout';

export interface LabelSheetProps {
  spec: LabelSpec;
  page?: PageSpec;
  /** Exactly `labelsPerPage(spec)` cells, blanks included */
  children?: React.ReactNode;
}

/**
 * One sheet of paper.
 *
 * Sized in millimetres so the preview on screen is the same object that comes
 * out of the printer. The grid is not stretched to fill the width: four
 * 35.56 mm columns leave 16.96 mm unused on the right, exactly as in the
 * original, whose table is `w:tblW="0" type="auto"`.
 */
export function LabelSheet({ spec, page = A4_PAGE, children }: LabelSheetProps) {
  const { columns } = gridForPage(spec, page);

  return (
    <div
      className="label-page"
      style={{
        width: `${page.widthMm}mm`,
        height: `${page.heightMm}mm`,
        padding: `${page.marginMm}mm`,
      }}
    >
      <div
        className="label-grid"
        style={{
          gridTemplateColumns: `repeat(${columns}, ${spec.cellWidthMm}mm)`,
          gridAutoRows: `${spec.cellHeightMm}mm`,
          borderTopWidth: `${spec.borderPt}pt`,
          borderLeftWidth: `${spec.borderPt}pt`,
        }}
      >
        {children}
      </div>
    </div>
  );
}

export interface LabelCellProps {
  spec: LabelSpec;
  children?: React.ReactNode;
}

/**
 * One cell of the grid, blank or filled.
 *
 * Blank cells still render their borders. Those borders are the cut guides,
 * and the original prints them too — its last sheet carries 43 empty bordered
 * cells.
 */
export const LabelCell = React.forwardRef<HTMLDivElement, LabelCellProps>(function LabelCell(
  { spec, children },
  ref
) {
  return (
    <div
      ref={ref}
      className="label-cell"
      style={{
        borderRightWidth: `${spec.borderPt}pt`,
        borderBottomWidth: `${spec.borderPt}pt`,
        padding: `${spec.padBlockMm}mm ${spec.padInlineMm}mm`,
      }}
    >
      {children}
    </div>
  );
});
