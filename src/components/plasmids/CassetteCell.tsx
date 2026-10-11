'use client';

/**
 * CassetteCell — a plasmid's cassettes in the table, as chips.
 * "Add" opens the CassettePicker to append one from the library; clicking a
 * chip opens it prefilled to replace that cassette; × removes. Reordering
 * and token-level editing stay in the detail panel.
 *
 * Participates in the spreadsheet grid like an EditableCell: focusable,
 * Enter/F2 or typing opens the picker, Ctrl+C copies the joined contents.
 */

import React, { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { Cassette } from '@/domain/types';
import { unresolvedTokens } from '@/domain/cassette-tokens';
import { CassettePicker } from './CassettePicker';
import { CassetteOption, joinCassetteContents } from './cassette-options';

export interface CassetteCellProps {
  plasmidName: string;
  cassettes: readonly Cassette[];
  options: readonly CassetteOption[];
  annotations: Set<string>;
  onAdd: (content: string) => Promise<void>;
  onReplace: (cassette: Cassette, content: string) => Promise<void>;
  onRemove: (cassette: Cassette) => Promise<void>;
}

type PickerMode =
  { kind: 'closed' } | { kind: 'add'; seed: string } | { kind: 'replace'; cassette: Cassette };

export function CassetteCell({
  plasmidName,
  cassettes,
  options,
  annotations,
  onAdd,
  onReplace,
  onRemove,
}: CassetteCellProps): JSX.Element {
  const [mode, setMode] = useState<PickerMode>({ kind: 'closed' });
  const wrapperRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef(false);

  // After the picker closes, focus returns to the cell for keyboard users
  useEffect(() => {
    if (mode.kind === 'closed' && restoreFocusRef.current) {
      restoreFocusRef.current = false;
      wrapperRef.current?.focus();
    }
  }, [mode]);

  const close = () => {
    restoreFocusRef.current = true;
    setMode({ kind: 'closed' });
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === 'F2') {
      event.preventDefault();
      setMode({ kind: 'add', seed: '' });
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      setMode({ kind: 'add', seed: event.key });
    }
  };

  if (mode.kind !== 'closed') {
    const replacing = mode.kind === 'replace' ? mode.cassette : null;
    return (
      <CassettePicker
        options={options}
        annotations={annotations}
        initialValue={replacing ? replacing.name : mode.kind === 'add' ? mode.seed : ''}
        ariaLabel={
          replacing
            ? `Replace cassette ${replacing.name} of ${plasmidName}`
            : `Add a cassette to ${plasmidName}`
        }
        onPick={async (content) => {
          if (replacing) {
            if (content !== replacing.name) await onReplace(replacing, content);
          } else {
            await onAdd(content);
          }
          close();
        }}
        onCancel={close}
      />
    );
  }

  const joined = joinCassetteContents(cassettes);

  return (
    <div
      ref={wrapperRef}
      role="group"
      tabIndex={0}
      data-editable-cell=""
      data-col="cassettes"
      data-cell-value={joined}
      aria-label={`Cassettes of ${plasmidName}: ${joined || 'none'}. Press Enter to add one`}
      className="flex flex-wrap items-center gap-1 -mx-2 -my-1 px-2 py-1 rounded border border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      onKeyDown={handleKeyDown}
    >
      {cassettes.map((cassette) => {
        const unknown = unresolvedTokens(cassette.name, annotations);
        return (
          <span
            key={cassette.id}
            className={clsx(
              'inline-flex items-center max-w-full rounded-full border text-xs font-mono',
              unknown.length > 0
                ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30'
                : 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-surface-2 dark:text-gray-300 dark:border-gray-600'
            )}
            title={unknown.length > 0 ? `Unknown features: ${unknown.join(', ')}` : undefined}
          >
            <button
              type="button"
              className="min-h-[28px] pl-2.5 pr-1 py-0.5 truncate rounded-l-full hover:bg-gray-200/60 dark:hover:bg-gray-700/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label={`Replace cassette ${cassette.name} of ${plasmidName}`}
              onClick={() => setMode({ kind: 'replace', cassette })}
            >
              {cassette.name}
            </button>
            <button
              type="button"
              className="min-h-[28px] px-1.5 rounded-r-full text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label={`Remove cassette ${cassette.name} from ${plasmidName}`}
              onClick={(event) => {
                event.stopPropagation();
                void onRemove(cassette);
              }}
            >
              ×
            </button>
          </span>
        );
      })}
      <button
        type="button"
        className="min-h-[28px] px-2 text-xs rounded-md text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        aria-label={`Add a cassette to ${plasmidName}`}
        onClick={() => setMode({ kind: 'add', seed: '' })}
      >
        + Add
      </button>
    </div>
  );
}
