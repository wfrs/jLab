'use client';

import { useMemo } from 'react';
import { LabelSpec } from '@/domain/label-layout';
import { GlycerolLabelData, buildGlycerolLabelLines } from '@/domain/label-content';
import { LabelCell } from './LabelSheet';
import { LabelLines } from './LabelLines';
import { useAutoFit } from './useAutoFit';

export interface GlycerolLabelProps {
  data: GlycerolLabelData;
  spec: LabelSpec;
}

/**
 * One glycerol stock label: stock ID, organism and strain, the construct, and
 * the date it was made — left-aligned, with only the stock ID bold and only
 * the organism binomial in italics.
 */
export function GlycerolLabel({ data, spec }: GlycerolLabelProps) {
  const lines = useMemo(() => buildGlycerolLabelLines(data), [data]);
  const contentKey = useMemo(() => lines.map((line) => line.text).join(' '), [lines]);
  const { ref } = useAutoFit(spec.fontStepsPt, contentKey);

  return (
    <LabelCell spec={spec}>
      <div ref={ref} className="label-content" style={{ textAlign: spec.align }}>
        <LabelLines lines={lines} />
      </div>
    </LabelCell>
  );
}
