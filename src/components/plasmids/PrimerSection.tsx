'use client';

/**
 * PrimerSection
 * PCR primers on the selected plasmid (v2 entity). Name and sequence edit
 * inline with autosave; Tm/GC% are derived server-side from the sequence
 * (Wallace rule for short unambiguous oligos) and update on every commit.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Primer } from '@/domain/types';
import { Button } from '@/components/ui/Button';
import { EditableCell, EditableCellValue } from '@/components/ui/EditableCell';
import { createPrimer, deletePrimer, listPrimers, updatePrimer } from './api-client';

function primerStats(primer: Primer): string {
  const parts = [`${primer.sequence.length} nt`, `GC ${primer.gcPercent ?? 0}%`];
  if (primer.tmCelsius != null) {
    parts.push(`Tm ${primer.tmCelsius}°C`);
  }
  return parts.join(' · ');
}

export function PrimerSection({ plasmidId }: { plasmidId: string }): JSX.Element {
  const [primers, setPrimers] = useState<Primer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newSequence, setNewSequence] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      setPrimers(await listPrimers(plasmidId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load primers');
    } finally {
      setIsLoading(false);
    }
  }, [plasmidId]);

  useEffect(() => {
    setIsLoading(true);
    void refresh();
  }, [refresh]);

  const saveField = async (id: string, patch: Parameters<typeof updatePrimer>[1]) => {
    try {
      const updated = await updatePrimer(id, patch);
      setPrimers((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save primer');
      throw err;
    }
  };

  const handleAdd = async () => {
    if (newName.trim().length === 0 || newSequence.trim().length === 0) return;
    try {
      setIsAdding(true);
      setError(null);
      const created = await createPrimer(plasmidId, {
        name: newName.trim(),
        sequence: newSequence.trim(),
      });
      setPrimers((prev) => [...prev, created]);
      setNewName('');
      setNewSequence('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add primer');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (primer: Primer) => {
    if (!window.confirm(`Delete primer "${primer.name}"? This cannot be undone.`)) return;
    try {
      setError(null);
      await deletePrimer(primer.id);
      setPrimers((prev) => prev.filter((p) => p.id !== primer.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete primer');
    }
  };

  const inputClasses =
    'px-2 py-1.5 text-sm border rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 ' +
    'border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <section aria-label="Primers" className="pt-4 border-t border-gray-200 dark:border-gray-700">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
        Primers ({primers.length})
      </h3>

      {error && (
        <p role="alert" className="mb-2 text-xs font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {isLoading ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">Loading…</p>
      ) : primers.length === 0 ? (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          No primers yet. Add one below.
        </p>
      ) : (
        <ul className="flex flex-col gap-2 mb-2">
          {primers.map((primer) => (
            <li
              key={primer.id}
              className="p-2 rounded border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/40"
            >
              <div className="flex items-center justify-between gap-2">
                <EditableCell
                  value={primer.name}
                  ariaLabel={`Name of primer ${primer.name}`}
                  onCommit={(value: EditableCellValue) =>
                    saveField(primer.id, { name: String(value ?? '') })
                  }
                  format={(value) => <span className="text-sm font-medium">{String(value)}</span>}
                />
                <Button
                  intent="ghost"
                  size="xs"
                  aria-label={`Delete primer ${primer.name}`}
                  onClick={() => void handleDelete(primer)}
                >
                  ✕
                </Button>
              </div>
              <EditableCell
                value={primer.sequence}
                mono
                ariaLabel={`Sequence of primer ${primer.name}`}
                onCommit={(value: EditableCellValue) =>
                  saveField(primer.id, { sequence: String(value ?? '') })
                }
                format={(value) => (
                  <span className="font-mono text-xs break-all text-gray-700 dark:text-gray-300">
                    {String(value)}
                  </span>
                )}
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{primerStats(primer)}</p>
            </li>
          ))}
        </ul>
      )}

      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void handleAdd();
        }}
      >
        <div className="flex gap-2 items-center">
          <input
            aria-label="New primer name"
            placeholder="Primer name…"
            className={`${inputClasses} flex-1 min-w-0`}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <Button
            type="submit"
            intent="secondary"
            size="sm"
            loading={isAdding}
            disabled={newName.trim().length === 0 || newSequence.trim().length === 0}
          >
            Add
          </Button>
        </div>
        <input
          aria-label="New primer sequence"
          placeholder="Sequence (5'→3')…"
          className={`${inputClasses} font-mono`}
          value={newSequence}
          onChange={(e) => setNewSequence(e.target.value)}
        />
      </form>
    </section>
  );
}
