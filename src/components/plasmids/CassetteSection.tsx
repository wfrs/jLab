'use client';

/**
 * CassetteSection
 * Cassette list for the selected plasmid, shown in the detail panel.
 * Inline editing with autosave (same interaction model as the table).
 *
 * Note: this is the basic list/CRUD UI. The full cassette editor
 * (free-text `-` token composition with glossary autocomplete) arrives
 * with the glossary entity.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Cassette } from '@/domain/types';
import { Button } from '@/components/ui/Button';
import { EditableCell, EditableCellValue } from '@/components/ui/EditableCell';
import { CassetteContentCell } from './CassetteContentCell';
import { createCassette, deleteCassette, listCassettes, updateCassette } from './api-client';
import { listGlossaryFeatures } from '@/components/glossary/api-client';

const CASSETTE_TYPE_OPTIONS: { value: Cassette['type']; label: string }[] = [
  { value: 'promoter', label: 'Promoter' },
  { value: 'terminator', label: 'Terminator' },
  { value: 'marker', label: 'Marker' },
  { value: 'origin', label: 'Origin' },
  { value: 'resistance', label: 'Resistance' },
  { value: 'other', label: 'Other' },
];

const typeLabel = (type: Cassette['type']): string =>
  CASSETTE_TYPE_OPTIONS.find((option) => option.value === type)?.label || type;

export function CassetteSection({ plasmidId }: { plasmidId: string }): JSX.Element {
  const [cassettes, setCassettes] = useState<Cassette[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<Cassette['type']>('other');
  const [isAdding, setIsAdding] = useState(false);
  const [annotations, setAnnotations] = useState<string[]>([]);

  // Glossary annotations for token resolution + autocomplete
  useEffect(() => {
    listGlossaryFeatures()
      .then((features) => setAnnotations(features.map((f) => f.annotation)))
      .catch(() => {
        // Non-fatal: without the glossary, tokens simply show as unresolved
        setAnnotations([]);
      });
  }, []);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const result = await listCassettes(plasmidId);
      setCassettes(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cassettes');
    } finally {
      setIsLoading(false);
    }
  }, [plasmidId]);

  useEffect(() => {
    setIsLoading(true);
    void refresh();
  }, [refresh]);

  const saveField = async (id: string, patch: Parameters<typeof updateCassette>[1]) => {
    try {
      const updated = await updateCassette(id, patch);
      setCassettes((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save cassette');
      throw err;
    }
  };

  const handleAdd = async () => {
    if (newName.trim().length === 0) return;
    try {
      setIsAdding(true);
      setError(null);
      const created = await createCassette(plasmidId, { name: newName.trim(), type: newType });
      setCassettes((prev) => [...prev, created]);
      setNewName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add cassette');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (cassette: Cassette) => {
    if (!window.confirm(`Delete cassette "${cassette.name}"? This cannot be undone.`)) return;
    try {
      setError(null);
      await deleteCassette(cassette.id);
      setCassettes((prev) => prev.filter((c) => c.id !== cassette.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete cassette');
    }
  };

  const inputClasses =
    'px-2 py-1.5 text-sm border rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 ' +
    'border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <section aria-label="Cassettes" className="pt-4 border-t border-gray-200 dark:border-gray-700">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
        Cassettes ({cassettes.length})
      </h3>

      {error && (
        <p role="alert" className="mb-2 text-xs font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {isLoading ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">Loading…</p>
      ) : cassettes.length === 0 ? (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          No cassettes yet. Add one below.
        </p>
      ) : (
        <ul className="flex flex-col gap-1 mb-2">
          {cassettes.map((cassette) => (
            <li
              key={cassette.id}
              className="grid grid-cols-[1.5rem_1fr_7rem_1.75rem] items-center gap-2 px-1 py-1 rounded hover:bg-gray-50 dark:hover:bg-gray-700/40"
            >
              <span className="text-xs font-mono text-gray-400 dark:text-gray-500 text-right">
                {cassette.position + 1}
              </span>
              <CassetteContentCell
                value={cassette.name}
                annotations={annotations}
                ariaLabel={`Name of cassette ${cassette.name}`}
                onCommit={(value: string) => saveField(cassette.id, { name: value })}
              />
              <EditableCell
                value={cassette.type}
                type="select"
                options={CASSETTE_TYPE_OPTIONS}
                ariaLabel={`Type of cassette ${cassette.name}`}
                onCommit={(value: EditableCellValue) =>
                  saveField(cassette.id, { type: value as Cassette['type'] })
                }
                format={(value) => (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {typeLabel(value as Cassette['type'])}
                  </span>
                )}
              />
              <Button
                intent="ghost"
                size="xs"
                aria-label={`Delete cassette ${cassette.name}`}
                onClick={() => void handleDelete(cassette)}
              >
                ✕
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form
        className="flex gap-2 items-center"
        onSubmit={(e) => {
          e.preventDefault();
          void handleAdd();
        }}
      >
        <input
          aria-label="New cassette name"
          placeholder="Add cassette…"
          className={`${inputClasses} flex-1 min-w-0`}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <select
          aria-label="New cassette type"
          className={inputClasses}
          value={newType}
          onChange={(e) => setNewType(e.target.value as Cassette['type'])}
        >
          {CASSETTE_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <Button
          type="submit"
          intent="secondary"
          size="sm"
          loading={isAdding}
          disabled={newName.trim().length === 0}
        >
          Add
        </Button>
      </form>
    </section>
  );
}
