'use client';

/**
 * FeatureSection
 * Annotated sequence regions on the selected plasmid (v2 entity).
 * Positions are 1-based inclusive; strand toggles between + and −.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Feature } from '@/domain/types';
import { Button } from '@/components/ui/Button';
import { EditableCell, EditableCellValue } from '@/components/ui/EditableCell';
import { createFeature, deleteFeature, listFeatures, updateFeature } from './api-client';

const FEATURE_TYPE_OPTIONS: { value: Feature['type']; label: string }[] = [
  { value: 'gene', label: 'Gene' },
  { value: 'promoter', label: 'Promoter' },
  { value: 'terminator', label: 'Terminator' },
  { value: 'rbs', label: 'RBS' },
  { value: 'his_tag', label: 'His-tag' },
  { value: 'flag_tag', label: 'FLAG-tag' },
  { value: 'other', label: 'Other' },
];

const typeLabel = (type: Feature['type']): string =>
  FEATURE_TYPE_OPTIONS.find((option) => option.value === type)?.label || type;

export function FeatureSection({ plasmidId }: { plasmidId: string }): JSX.Element {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<Feature['type']>('gene');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      setFeatures(await listFeatures(plasmidId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load features');
    } finally {
      setIsLoading(false);
    }
  }, [plasmidId]);

  useEffect(() => {
    setIsLoading(true);
    void refresh();
  }, [refresh]);

  const saveField = async (id: string, patch: Parameters<typeof updateFeature>[1]) => {
    try {
      const updated = await updateFeature(id, patch);
      setFeatures((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save feature');
      throw err;
    }
  };

  const canAdd =
    newName.trim().length > 0 &&
    Number.isInteger(Number(newStart)) &&
    Number(newStart) >= 1 &&
    Number.isInteger(Number(newEnd)) &&
    Number(newEnd) >= 1;

  const handleAdd = async () => {
    if (!canAdd) return;
    try {
      setIsAdding(true);
      setError(null);
      const created = await createFeature(plasmidId, {
        name: newName.trim(),
        type: newType,
        startPos: Number(newStart),
        endPos: Number(newEnd),
      });
      setFeatures((prev) =>
        [...prev, created].sort((a, b) => a.startPos - b.startPos || a.endPos - b.endPos)
      );
      setNewName('');
      setNewStart('');
      setNewEnd('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add feature');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (feature: Feature) => {
    if (!window.confirm(`Delete feature "${feature.name}"? This cannot be undone.`)) return;
    try {
      setError(null);
      await deleteFeature(feature.id);
      setFeatures((prev) => prev.filter((f) => f.id !== feature.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete feature');
    }
  };

  const toggleStrand = async (feature: Feature) => {
    try {
      await saveField(feature.id, { strand: feature.strand === '+' ? '-' : '+' });
    } catch {
      // error already surfaced by saveField
    }
  };

  const inputClasses =
    'px-2 py-1.5 text-sm border rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 ' +
    'border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <section aria-label="Features" className="pt-4 border-t border-gray-200 dark:border-gray-700">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
        Features ({features.length})
      </h3>

      {error && (
        <p role="alert" className="mb-2 text-xs font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {isLoading ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">Loading…</p>
      ) : features.length === 0 ? (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          No features yet. Add one below.
        </p>
      ) : (
        <ul className="flex flex-col gap-1 mb-2">
          {features.map((feature) => (
            <li
              key={feature.id}
              className="grid grid-cols-[1fr_auto_auto_1.75rem] items-center gap-2 px-1 py-1 rounded hover:bg-gray-50 dark:hover:bg-gray-700/40"
            >
              <div className="min-w-0">
                <EditableCell
                  value={feature.name}
                  ariaLabel={`Name of feature ${feature.name}`}
                  onCommit={(value: EditableCellValue) =>
                    saveField(feature.id, { name: String(value ?? '') })
                  }
                  format={(value) => <span className="text-sm">{String(value)}</span>}
                />
                <div className="flex items-center gap-2">
                  <EditableCell
                    value={feature.type}
                    type="select"
                    options={FEATURE_TYPE_OPTIONS}
                    ariaLabel={`Type of feature ${feature.name}`}
                    onCommit={(value: EditableCellValue) =>
                      saveField(feature.id, { type: value as Feature['type'] })
                    }
                    format={(value) => (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {typeLabel(value as Feature['type'])}
                      </span>
                    )}
                  />
                </div>
              </div>
              <span className="font-mono text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                {feature.startPos.toLocaleString()}–{feature.endPos.toLocaleString()}
              </span>
              <button
                type="button"
                className="font-mono text-xs px-1.5 py-0.5 rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                title="Toggle strand"
                aria-label={`Strand of feature ${feature.name}: ${feature.strand}. Click to toggle.`}
                onClick={() => void toggleStrand(feature)}
              >
                {feature.strand}
              </button>
              <Button
                intent="ghost"
                size="xs"
                aria-label={`Delete feature ${feature.name}`}
                onClick={() => void handleDelete(feature)}
              >
                ✕
              </Button>
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
            aria-label="New feature name"
            placeholder="Feature name…"
            className={`${inputClasses} flex-1 min-w-0`}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <select
            aria-label="New feature type"
            className={inputClasses}
            value={newType}
            onChange={(e) => setNewType(e.target.value as Feature['type'])}
          >
            {FEATURE_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 items-center">
          <input
            aria-label="New feature start position"
            placeholder="Start"
            inputMode="numeric"
            className={`${inputClasses} font-mono w-20`}
            value={newStart}
            onChange={(e) => setNewStart(e.target.value)}
          />
          <input
            aria-label="New feature end position"
            placeholder="End"
            inputMode="numeric"
            className={`${inputClasses} font-mono w-20`}
            value={newEnd}
            onChange={(e) => setNewEnd(e.target.value)}
          />
          <span className="flex-1" />
          <Button type="submit" intent="secondary" size="sm" loading={isAdding} disabled={!canAdd}>
            Add
          </Button>
        </div>
      </form>
    </section>
  );
}
