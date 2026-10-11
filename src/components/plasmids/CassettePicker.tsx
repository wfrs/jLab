'use client';

/**
 * CassettePicker — combobox over the library's distinct cassette contents.
 * Type-ahead narrows the list; Enter or click picks; text matching nothing
 * can be used as typed, so free entry is never blocked. Escape cancels.
 * Linear floating overlay: surface-3, hairline border, no shadow on dark.
 */

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { unresolvedTokens } from '@/domain/cassette-tokens';
import { CassetteOption, filterCassetteOptions } from './cassette-options';

export interface CassettePickerProps {
  options: readonly CassetteOption[];
  /** Glossary annotations; contents with unknown features are flagged, not blocked */
  annotations: Set<string>;
  /** Prefilled text (replace mode, or the key that opened the picker) */
  initialValue?: string;
  ariaLabel: string;
  onPick: (content: string) => Promise<void>;
  onCancel: () => void;
}

export function CassettePicker({
  options,
  annotations,
  initialValue = '',
  ariaLabel,
  onPick,
  onCancel,
}: CassettePickerProps): JSX.Element {
  const [query, setQuery] = useState(initialValue);
  const [highlight, setHighlight] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const matches = useMemo(() => filterCassetteOptions(options, query), [options, query]);
  const typed = query.trim();
  const exactMatch = matches.some((option) => option.content === typed);
  // Choices: the matches, plus the typed text when it is new
  const choices =
    typed !== '' && !exactMatch ? [...matches, { content: typed, count: 0 }] : matches;
  const highlighted = choices[Math.min(highlight, Math.max(0, choices.length - 1))];

  const pick = async (content: string) => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await onPick(content);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save cassette');
      setSaving(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    // The grid must not treat these as cell navigation
    event.stopPropagation();
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlight((index) => Math.min(index + 1, choices.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlight((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (highlighted) void pick(highlighted.content);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
    }
  };

  return (
    <div className="relative" onClick={(event) => event.stopPropagation()}>
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-label={ariaLabel}
        aria-autocomplete="list"
        aria-expanded={choices.length > 0}
        aria-controls={listId}
        aria-activedescendant={highlighted ? `${listId}-${highlight}` : undefined}
        aria-invalid={error ? true : undefined}
        placeholder="Pick a cassette or type a new one"
        className={clsx(
          'w-full px-2 py-1 text-sm font-mono rounded border bg-white dark:bg-gray-900',
          'text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2',
          error
            ? 'border-red-400 focus:ring-red-500 dark:border-red-600'
            : 'border-blue-400 focus:ring-blue-500 dark:border-blue-600',
          saving && 'opacity-60'
        )}
        value={query}
        disabled={saving}
        onChange={(event) => {
          setQuery(event.target.value);
          setHighlight(0);
        }}
        onKeyDown={handleKeyDown}
        // Clicking an option fires mousedown first; cancelling on blur would
        // close the list before the click lands, so options prevent it
        onBlur={() => {
          if (!saving) onCancel();
        }}
      />
      {error && (
        <p role="alert" className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      {choices.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Cassettes in the library"
          className="absolute left-0 top-full z-20 mt-1 w-full min-w-[20rem] max-h-64 overflow-y-auto rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-surface-3 shadow-lg dark:shadow-none dark:panel-lift py-1"
        >
          {choices.map((option, index) => {
            const unknown = unresolvedTokens(option.content, annotations);
            return (
              <li
                key={option.content}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === highlight}
                className={clsx(
                  'flex items-center gap-3 px-3 py-1.5 text-sm cursor-pointer',
                  index === highlight
                    ? 'bg-blue-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                    : 'text-gray-700 dark:text-gray-300'
                )}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setHighlight(index)}
                onClick={() => void pick(option.content)}
              >
                <span className="flex-1 font-mono break-all">{option.content}</span>
                <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
                  {option.count === 0
                    ? 'new'
                    : `${option.count} plasmid${option.count === 1 ? '' : 's'}`}
                  {unknown.length > 0 && (
                    <span
                      className="ml-2 text-amber-600 dark:text-amber-400"
                      title={`Unknown features: ${unknown.join(', ')}`}
                    >
                      {unknown.length} unknown
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
