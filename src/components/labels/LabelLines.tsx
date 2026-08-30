'use client';

import { clsx } from 'clsx';
import { LabelLine } from '@/domain/label-content';

/**
 * The text of one label, inside its cell.
 *
 * Shared by both label kinds: they differ in what the lines say and how they
 * are aligned, not in how a line is drawn. A line with `segments` is rendered
 * as spans so a glycerol label can set `E. coli` in italics beside a roman
 * `TOP10` — the one place the originals mix styles within a line.
 */
export function LabelLines({ lines }: { lines: LabelLine[] }): JSX.Element {
  return (
    <>
      {lines.map((line, index) => (
        <div
          key={`${index}-${line.text}`}
          className={clsx(
            'label-line',
            line.bold && 'label-line-bold',
            line.italic && 'label-line-italic'
          )}
        >
          {line.segments
            ? line.segments.map((segment, segmentIndex) => (
                <span
                  key={`${segmentIndex}-${segment.text}`}
                  className={clsx(
                    segment.bold && 'label-line-bold',
                    segment.italic && 'label-line-italic'
                  )}
                >
                  {segment.text}
                </span>
              ))
            : line.text}
        </div>
      ))}
    </>
  );
}
