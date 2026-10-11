'use client';

/**
 * ColumnPicker — which columns the plasmid table shows.
 * A button opening a non-modal popover of grouped checkboxes; the choice is
 * applied immediately. Linear floating overlay: surface-3 lift, hairline
 * border, no shadow on dark.
 */

import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import {
  DEFAULT_COLUMN_IDS,
  PINNED_COLUMN_ID,
  PLASMID_COLUMNS,
  PlasmidColumnGroup,
  PlasmidColumnId,
  PlasmidColumnSpec,
} from '@/components/plasmids/plasmid-columns';

const GROUP_ORDER: readonly PlasmidColumnGroup[] = ['Plasmid', 'Prep', 'Glycerol stock', 'Record'];

interface ColumnPickerProps {
  visible: readonly PlasmidColumnId[];
  onChange: (next: PlasmidColumnId[]) => void;
}

export function ColumnPicker({ visible, onChange }: ColumnPickerProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dialogId = useId();
  const visibleSet = new Set(visible);

  // Outside click and Escape close the popover; Escape also returns focus
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const toggle = (id: PlasmidColumnId, checked: boolean) => {
    onChange(checked ? [...visible, id] : visible.filter((visibleId) => visibleId !== id));
  };

  const groups = GROUP_ORDER.map((group) => ({
    group,
    columns: PLASMID_COLUMNS.filter((column) => column.group === group),
  }));

  return (
    <div ref={rootRef} className="relative">
      <Button
        ref={buttonRef}
        intent="secondary"
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
      >
        Columns
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {visible.length}/{PLASMID_COLUMNS.length}
        </span>
      </Button>

      {open && (
        <div
          id={dialogId}
          role="dialog"
          aria-label="Choose table columns"
          className="absolute right-0 top-full z-30 mt-2 w-72 max-h-[70vh] overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-surface-3 shadow-lg dark:shadow-none dark:panel-lift p-3"
        >
          <div className="flex flex-col gap-3">
            {groups.map(({ group, columns }) => (
              <fieldset key={group} className="flex flex-col gap-1">
                <legend className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {group}
                </legend>
                {columns.map((column) => (
                  <ColumnOption
                    key={column.id}
                    column={column}
                    checked={visibleSet.has(column.id)}
                    onToggle={(checked) => toggle(column.id, checked)}
                  />
                ))}
              </fieldset>
            ))}
          </div>
          <div className="mt-3 flex justify-between border-t border-gray-200 dark:border-gray-700 pt-3">
            <Button intent="ghost" size="sm" onClick={() => onChange([...DEFAULT_COLUMN_IDS])}>
              Reset to lab sheet
            </Button>
            <Button
              intent="secondary"
              size="sm"
              onClick={() => {
                setOpen(false);
                buttonRef.current?.focus();
              }}
            >
              Done
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ColumnOption({
  column,
  checked,
  onToggle,
}: {
  column: PlasmidColumnSpec;
  checked: boolean;
  onToggle: (checked: boolean) => void;
}): JSX.Element {
  const pinned = column.id === PINNED_COLUMN_ID;
  return (
    <label className="flex min-h-[32px] items-center gap-2 rounded-md px-1 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/70">
      <input
        type="checkbox"
        className="w-4 h-4 accent-blue-600"
        checked={checked}
        disabled={pinned}
        onChange={(event) => onToggle(event.target.checked)}
      />
      <span className="flex-1">{column.label}</span>
      {pinned && <span className="text-xs text-gray-500 dark:text-gray-400">always shown</span>}
    </label>
  );
}
