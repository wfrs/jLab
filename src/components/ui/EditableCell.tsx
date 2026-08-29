'use client';

/**
 * EditableCell component
 * Spreadsheet-style inline editing with autosave (UI/UX direction: table-first,
 * autosave on edit, no save button).
 *
 * Interaction model:
 * - Click or Enter/F2 on a focused cell starts editing
 * - Enter or blur commits (commit only fires when the value changed)
 * - Tab / Shift+Tab commit and ask the grid to move right/left
 * - Escape cancels, restores the previous value, and refocuses the cell
 * - After a keyboard-driven commit, focus returns to the cell (Enter also
 *   asks the grid to move down — spreadsheet convention)
 * - Commit failures keep the cell in edit mode with the server's error message
 */

import React, { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';

/** How long the green "saved" confirmation ring stays visible */
const SAVED_FLASH_MS = 1200;

export type EditableCellValue = string | number | null;

export type CellNavDirection = 'up' | 'down' | 'left' | 'right';

export interface EditableCellOption {
  value: string;
  label: string;
}

export interface EditableCellProps {
  value: EditableCellValue;
  /** Commits the new value; reject with an Error to surface a message in the cell */
  onCommit: (value: EditableCellValue) => Promise<void>;
  type?: 'text' | 'number' | 'select';
  /** Required when type is 'select' */
  options?: EditableCellOption[];
  /** Formats the display (read) state; falls back to String(value) */
  format?: (value: EditableCellValue) => React.ReactNode;
  placeholder?: string;
  ariaLabel: string;
  disabled?: boolean;
  /** Monospace display (e.g. sizes, sequences) */
  mono?: boolean;
  /** Column id exposed as data-col for grid paste targeting */
  colId?: string;
  /**
   * Called after Enter/Tab finishes an edit (spreadsheet navigation).
   * The grid focuses the neighboring cell; without it focus returns here.
   */
  onNavigate?: (direction: CellNavDirection, fromElement: HTMLElement) => void;
}

/** Why the editor closed — decides focus restoration and navigation */
type ExitReason = 'enter' | 'tab' | 'shifttab' | 'escape' | 'change' | 'blur';

function toDraft(value: EditableCellValue): string {
  return value === null || value === undefined ? '' : String(value);
}

export function EditableCell({
  value,
  onCommit,
  type = 'text',
  options,
  format,
  placeholder = '—',
  ariaLabel,
  disabled = false,
  mono = false,
  colId,
  onNavigate,
}: EditableCellProps): JSX.Element {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);
  const displayRef = useRef<HTMLDivElement>(null);
  const cancelingRef = useRef(false);
  const exitReasonRef = useRef<ExitReason>('blur');
  const lastFailedDraftRef = useRef<string | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigateRef = useRef(onNavigate);
  navigateRef.current = onNavigate;
  /** True when editing began by typing — caret goes to the end, no select-all */
  const seedCaretRef = useRef(false);

  useEffect(() => {
    return () => {
      if (flashTimerRef.current) {
        clearTimeout(flashTimerRef.current);
      }
    };
  }, []);

  const startEditing = (initialDraft?: string) => {
    if (disabled || saving) return;
    setDraft(initialDraft ?? toDraft(value));
    seedCaretRef.current = initialDraft !== undefined;
    setError(null);
    exitReasonRef.current = 'blur';
    setEditing(true);
  };

  // Focus the editor as soon as it mounts
  useEffect(() => {
    if (editing) {
      if (type === 'select') {
        selectRef.current?.focus();
      } else {
        inputRef.current?.focus();
        if (seedCaretRef.current) {
          const end = inputRef.current?.value.length ?? 0;
          inputRef.current?.setSelectionRange(end, end);
          seedCaretRef.current = false;
        } else {
          inputRef.current?.select();
        }
      }
    }
  }, [editing, type]);

  /**
   * Close the editor. Keyboard-driven exits restore focus to the display
   * cell on the next frame (it remounts); Enter/Tab additionally hand off
   * to the grid so focus lands on the neighboring cell instead.
   */
  const exitEditing = () => {
    const reason = exitReasonRef.current;
    setEditing(false);
    setError(null);
    cancelingRef.current = false;
    lastFailedDraftRef.current = null;
    exitReasonRef.current = 'blur';

    if (reason === 'blur') return;
    requestAnimationFrame(() => {
      const element = displayRef.current;
      if (!element) return;
      const direction: CellNavDirection | null =
        reason === 'enter'
          ? 'down'
          : reason === 'tab'
            ? 'right'
            : reason === 'shifttab'
              ? 'left'
              : null;
      if (direction && navigateRef.current) {
        navigateRef.current(direction, element);
      } else {
        element.focus();
      }
    });
  };

  const flashSaved = () => {
    setJustSaved(true);
    if (flashTimerRef.current) {
      clearTimeout(flashTimerRef.current);
    }
    flashTimerRef.current = setTimeout(() => setJustSaved(false), SAVED_FLASH_MS);
  };

  /** Parses the draft into a commit value; returns an error message when invalid */
  const parseDraft = (raw: string): { value: EditableCellValue } | { parseError: string } => {
    if (type === 'number') {
      const trimmed = raw.trim();
      if (trimmed === '') {
        return { value: null };
      }
      const parsed = Number(trimmed);
      if (!Number.isFinite(parsed)) {
        return { parseError: 'Enter a number' };
      }
      return { value: parsed };
    }
    return { value: raw };
  };

  const commit = async (raw: string) => {
    if (cancelingRef.current) {
      exitEditing();
      return;
    }

    const parsed = parseDraft(raw);
    if ('parseError' in parsed) {
      setError(parsed.parseError);
      inputRef.current?.focus();
      return;
    }

    // No change → exit without a server round-trip
    if (toDraft(parsed.value) === toDraft(value)) {
      exitEditing();
      return;
    }

    // The draft already failed once and the user is moving on (blur
    // re-committed the same rejected value) — revert instead of retrying.
    if (lastFailedDraftRef.current === raw) {
      exitEditing();
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onCommit(parsed.value);
      setSaving(false);
      exitEditing();
      flashSaved();
    } catch (err) {
      setSaving(false);
      lastFailedDraftRef.current = raw;
      exitReasonRef.current = 'blur';
      setError(err instanceof Error ? err.message : 'Save failed');
      setEditing(true);
      // Re-focus so the user can fix the value or press Escape to revert;
      // clicking elsewhere reverts via the lastFailedDraft guard above.
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        selectRef.current?.focus();
      });
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      exitReasonRef.current = event.key === 'Enter' ? 'enter' : event.shiftKey ? 'shifttab' : 'tab';
      // Blur triggers the single commit path
      inputRef.current?.blur();
      selectRef.current?.blur();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      cancelingRef.current = true;
      exitReasonRef.current = 'escape';
      exitEditing();
    }
  };

  const handleDisplayKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === 'F2') {
      event.preventDefault();
      startEditing();
    } else if (
      // Typing a printable character starts editing with it (spreadsheet UX)
      event.key.length === 1 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      type !== 'select'
    ) {
      event.preventDefault();
      startEditing(event.key);
    }
  };

  if (editing) {
    const editorClasses = clsx(
      'w-full px-2 py-1 text-sm rounded border bg-white dark:bg-gray-900',
      'text-gray-900 dark:text-gray-100',
      'focus:outline-none focus:ring-2',
      error
        ? 'border-red-400 focus:ring-red-500 dark:border-red-600'
        : 'border-blue-400 focus:ring-blue-500 dark:border-blue-600',
      saving && 'opacity-60',
      mono && 'font-mono'
    );

    return (
      <div className="relative" onClick={(e) => e.stopPropagation()}>
        {type === 'select' ? (
          <select
            ref={selectRef}
            className={editorClasses}
            value={draft}
            disabled={saving}
            aria-label={ariaLabel}
            onChange={(e) => {
              setDraft(e.target.value);
              exitReasonRef.current = 'change';
              void commit(e.target.value);
            }}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              if (!saving) {
                exitEditing();
              }
            }}
          >
            {options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            ref={inputRef}
            type="text"
            inputMode={type === 'number' ? 'numeric' : 'text'}
            className={editorClasses}
            value={draft}
            disabled={saving}
            aria-label={ariaLabel}
            aria-invalid={error ? true : undefined}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={(e) => void commit(e.target.value)}
          />
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

  const isEmpty = value === null || value === undefined || value === '';

  return (
    <div
      ref={displayRef}
      role="button"
      tabIndex={disabled ? -1 : 0}
      data-editable-cell=""
      data-cell-value={toDraft(value)}
      {...(colId && { 'data-col': colId })}
      aria-label={`${ariaLabel}: ${isEmpty ? 'empty' : String(value)}. Press Enter to edit`}
      className={clsx(
        'w-full px-2 py-1 -mx-2 -my-1 text-sm rounded border border-transparent',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
        !disabled && 'cursor-text hover:border-gray-300 dark:hover:border-gray-600',
        justSaved && 'ring-2 ring-emerald-400 dark:ring-emerald-600',
        'transition-shadow duration-300',
        mono && 'font-mono',
        isEmpty && 'text-gray-400 dark:text-gray-500'
      )}
      onClick={() => startEditing()}
      onKeyDown={handleDisplayKeyDown}
    >
      {isEmpty ? placeholder : format ? format(value) : String(value)}
    </div>
  );
}
