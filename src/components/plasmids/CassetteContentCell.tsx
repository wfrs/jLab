'use client';

/**
 * CassetteContentCell
 * Token-aware editor for cassette content (locked UX direction):
 * - free-text editing with the `-` token convention (no click-to-build flow)
 * - glossary autocomplete while typing the current token
 * - inline highlight of tokens that don't resolve against the glossary
 * - autosave on Enter/blur, Escape cancels (same model as EditableCell)
 */

import React, { useMemo, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { parseCassetteTokens } from '@/domain/cassette-tokens';

/** How long the green "saved" confirmation ring stays visible */
const SAVED_FLASH_MS = 1200;
/** Max suggestions shown in the autocomplete dropdown */
const MAX_SUGGESTIONS = 8;

export interface CassetteContentCellProps {
  value: string;
  /** Glossary annotations used for resolution + autocomplete */
  annotations: string[];
  onCommit: (value: string) => Promise<void>;
  ariaLabel: string;
  placeholder?: string;
}

interface TokenBounds {
  start: number;
  end: number;
  fragment: string;
}

/**
 * The token surrounding the caret: text between the nearest `-` separators
 * (bracket blocks not split), used as the autocomplete fragment.
 */
function currentTokenBounds(text: string, caret: number): TokenBounds {
  let start = 0;
  let depth = 0;
  for (let i = 0; i < caret; i++) {
    const char = text[i];
    if (char === '[') depth += 1;
    else if (char === ']') depth = Math.max(0, depth - 1);
    else if (char === '-' && depth === 0) start = i + 1;
  }
  let end = text.length;
  depth = 0;
  for (let i = caret; i < text.length; i++) {
    const char = text[i];
    if (char === '[') depth += 1;
    else if (char === ']') depth = Math.max(0, depth - 1);
    else if (char === '-' && depth === 0) {
      end = i;
      break;
    }
  }
  return { start, end, fragment: text.slice(start, caret) };
}

export function CassetteContentCell({
  value,
  annotations,
  onCommit,
  ariaLabel,
  placeholder = '—',
}: CassetteContentCellProps): JSX.Element {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [caret, setCaret] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const cancelingRef = useRef(false);
  const lastFailedDraftRef = useRef<string | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const annotationSet = useMemo(() => new Set(annotations), [annotations]);

  const bounds = useMemo(() => currentTokenBounds(draft, caret), [draft, caret]);

  const suggestions = useMemo(() => {
    if (!editing || !dropdownOpen) return [];
    const fragment = bounds.fragment.toLowerCase();
    const startsWith = annotations.filter((a) => a.toLowerCase().startsWith(fragment));
    const includes = annotations.filter(
      (a) => !a.toLowerCase().startsWith(fragment) && a.toLowerCase().includes(fragment)
    );
    return [...startsWith, ...includes].slice(0, MAX_SUGGESTIONS);
  }, [editing, dropdownOpen, bounds.fragment, annotations]);

  const startEditing = () => {
    if (saving) return;
    setDraft(value);
    setCaret(value.length);
    setError(null);
    setEditing(true);
    setDropdownOpen(true);
    setHighlightIndex(0);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(value.length, value.length);
    });
  };

  const exitEditing = () => {
    setEditing(false);
    setError(null);
    setDropdownOpen(false);
    cancelingRef.current = false;
    lastFailedDraftRef.current = null;
  };

  const flashSaved = () => {
    setJustSaved(true);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setJustSaved(false), SAVED_FLASH_MS);
  };

  const commit = async (raw: string) => {
    if (cancelingRef.current) {
      exitEditing();
      return;
    }
    if (raw === value) {
      exitEditing();
      return;
    }
    if (lastFailedDraftRef.current === raw) {
      exitEditing();
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onCommit(raw);
      setSaving(false);
      exitEditing();
      flashSaved();
    } catch (err) {
      setSaving(false);
      lastFailedDraftRef.current = raw;
      setError(err instanceof Error ? err.message : 'Save failed');
      setEditing(true);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  const pickSuggestion = (annotation: string) => {
    const next = draft.slice(0, bounds.start) + annotation + draft.slice(bounds.end);
    const newCaret = bounds.start + annotation.length;
    setDraft(next);
    setCaret(newCaret);
    setHighlightIndex(0);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(newCaret, newCaret);
    });
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (dropdownOpen && suggestions.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setHighlightIndex((i) => (i + 1) % suggestions.length);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlightIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (event.key === 'Tab') {
        event.preventDefault();
        pickSuggestion(suggestions[highlightIndex]);
        return;
      }
      if (event.key === 'Enter') {
        // Enter picks the highlighted suggestion only when the fragment
        // isn't already an exact match; otherwise it commits.
        if (bounds.fragment !== suggestions[highlightIndex]) {
          event.preventDefault();
          pickSuggestion(suggestions[highlightIndex]);
          return;
        }
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setDropdownOpen(false);
        return;
      }
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      inputRef.current?.blur();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      cancelingRef.current = true;
      exitEditing();
    }
  };

  const syncCaret = () => {
    setCaret(inputRef.current?.selectionStart ?? 0);
  };

  if (editing) {
    return (
      <div className="relative" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          type="text"
          className={clsx(
            'w-full px-2 py-1 text-sm font-mono rounded border bg-white dark:bg-gray-900',
            'text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2',
            error
              ? 'border-red-400 focus:ring-red-500 dark:border-red-600'
              : 'border-blue-400 focus:ring-blue-500 dark:border-blue-600',
            saving && 'opacity-60'
          )}
          value={draft}
          disabled={saving}
          aria-label={ariaLabel}
          aria-invalid={error ? true : undefined}
          aria-expanded={dropdownOpen && suggestions.length > 0}
          role="combobox"
          aria-autocomplete="list"
          onChange={(e) => {
            setDraft(e.target.value);
            setCaret(e.target.selectionStart ?? e.target.value.length);
            setDropdownOpen(true);
            setHighlightIndex(0);
          }}
          onKeyUp={syncCaret}
          onClick={syncCaret}
          onKeyDown={handleKeyDown}
          onBlur={(e) => void commit(e.target.value)}
        />

        {dropdownOpen && suggestions.length > 0 && (
          <ul
            role="listbox"
            aria-label="Glossary suggestions"
            className="absolute left-0 top-full z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-surface-3 shadow-lg dark:shadow-none dark:panel-lift py-1"
          >
            {suggestions.map((annotation, index) => (
              <li
                key={annotation}
                role="option"
                aria-selected={index === highlightIndex}
                className={clsx(
                  'px-2 py-1 text-sm font-mono cursor-pointer',
                  index === highlightIndex
                    ? 'bg-blue-100 text-blue-900 dark:bg-blue-900/60 dark:text-blue-100'
                    : 'text-gray-700 dark:text-gray-300'
                )}
                // mousedown (not click) so the input doesn't blur first
                onMouseDown={(e) => {
                  e.preventDefault();
                  pickSuggestion(annotation);
                }}
                onMouseEnter={() => setHighlightIndex(index)}
              >
                {annotation}
              </li>
            ))}
          </ul>
        )}

        {error && (
          <p
            role="alert"
            className="absolute left-0 top-full z-10 mt-1 px-2 py-1 text-xs font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/80 border border-red-200 dark:border-red-800 rounded shadow-sm whitespace-nowrap"
          >
            {error}
          </p>
        )}
      </div>
    );
  }

  const tokens = parseCassetteTokens(value);
  const isEmpty = value.trim().length === 0;
  const unresolvedCount = tokens.filter(
    (t) => t.base.trim().length > 0 && !annotationSet.has(t.base.trim())
  ).length;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${ariaLabel}: ${isEmpty ? 'empty' : value}${
        unresolvedCount > 0 ? `. ${unresolvedCount} unresolved token(s)` : ''
      }. Press Enter to edit`}
      className={clsx(
        'w-full px-2 py-1 -mx-2 -my-1 text-sm font-mono rounded border border-transparent',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
        'cursor-text hover:border-gray-300 dark:hover:border-gray-600',
        justSaved && 'ring-2 ring-emerald-400 dark:ring-emerald-600',
        'transition-shadow duration-300',
        isEmpty && 'text-gray-400 dark:text-gray-500'
      )}
      onClick={startEditing}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === 'F2') {
          event.preventDefault();
          startEditing();
        }
      }}
    >
      {isEmpty
        ? placeholder
        : tokens.map((token, index) => {
            const base = token.base.trim();
            const unresolved = base.length > 0 && !annotationSet.has(base);
            return (
              <React.Fragment key={index}>
                {index > 0 && <span className="text-gray-400 dark:text-gray-500">-</span>}
                <span
                  className={clsx(
                    unresolved &&
                      'text-red-600 dark:text-red-400 underline decoration-wavy decoration-red-400 dark:decoration-red-500'
                  )}
                  title={unresolved ? `"${base}" is not in the glossary` : undefined}
                >
                  {token.raw}
                </span>
              </React.Fragment>
            );
          })}
    </div>
  );
}
