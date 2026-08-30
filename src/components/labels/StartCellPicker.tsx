'use client';

import { Grid } from '@/domain/label-layout';

export interface StartCellPickerProps {
  grid: Grid;
  /** Cells to skip — the ones already cut off the sheet */
  value: number;
  onChange: (startAt: number) => void;
}

/**
 * Pick the first free cell on a part-used sheet by clicking it.
 *
 * A sheet is rarely cut to the last label, so the next print should start where
 * the last one stopped. A number between 0 and 84 is not something anyone can
 * read off a half-cut sheet; the shape of the used corner is.
 */
export function StartCellPicker({ grid, value, onChange }: StartCellPickerProps): JSX.Element {
  return (
    <div className="flex items-start gap-3">
      <div>
        <p className="text-xs text-gray-400">Start at</p>
        <p className="text-[11px] text-gray-500">
          {value === 0 ? 'a full sheet' : `skipping ${value}`}
        </p>
      </div>

      <div
        role="group"
        aria-label="First free cell on the sheet"
        className="grid gap-px rounded border border-gray-700 bg-gray-700 p-px"
        style={{ gridTemplateColumns: `repeat(${grid.columns}, 0.55rem)` }}
      >
        {Array.from({ length: grid.total }, (_, index) => {
          const used = index < value;
          return (
            <button
              key={index}
              type="button"
              aria-label={`Start at cell ${index + 1} of ${grid.total}`}
              aria-pressed={index === value}
              title={`Row ${Math.floor(index / grid.columns) + 1}, column ${
                (index % grid.columns) + 1
              }`}
              onClick={() => onChange(index)}
              className={`h-[0.55rem] w-[0.55rem] transition-colors ${
                used ? 'bg-gray-600' : 'bg-gray-950 hover:bg-blue-500'
              } ${index === value ? 'ring-1 ring-blue-400' : ''}`}
            />
          );
        })}
      </div>

      {value > 0 && (
        <button
          type="button"
          onClick={() => onChange(0)}
          className="text-xs text-gray-400 underline hover:text-gray-200"
        >
          Reset
        </button>
      )}
    </div>
  );
}
