'use client';

/**
 * GmoSection
 * GMO records for the selected plasmid, shown in the detail panel.
 * Legacy parity: add a GMO by picking an organism from the glossary,
 * approval defaults to '-', target RG seeds from the organism's risk group,
 * "Destroy" stamps the destruction date. The summary line is derived from
 * the record's fields (legacy stored it denormalized).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Gmo, OrganismTarget } from '@/domain/types';
import { buildGmoSummary, DESTROYED_PENDING } from '@/domain/gmo-summary';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EditableCell, EditableCellValue } from '@/components/ui/EditableCell';
import { addFavouriteGmos, createGmo, deleteGmo, listGmos, updateGmo } from './api-client';
import { listOrganisms } from '@/components/glossary/api-client';
import { listOrganismTargets } from '@/components/settings/api-client';

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function GmoSection({ plasmidId }: { plasmidId: string }): JSX.Element {
  const [gmos, setGmos] = useState<Gmo[]>([]);
  const [organismNames, setOrganismNames] = useState<string[]>([]);
  const [targets, setTargets] = useState<OrganismTarget[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [newOrganism, setNewOrganism] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isAddingFavourites, setIsAddingFavourites] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      setGmos(await listGmos(plasmidId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load GMOs');
    } finally {
      setIsLoading(false);
    }
  }, [plasmidId]);

  useEffect(() => {
    setIsLoading(true);
    void refresh();
  }, [refresh]);

  useEffect(() => {
    listOrganisms()
      .then((organisms) => setOrganismNames(organisms.map((o) => o.fullName)))
      .catch(() => setOrganismNames([]));
    // The target shortlist is optional config — failing to load it just
    // means the picker falls back to the flat glossary list
    listOrganismTargets()
      .then(setTargets)
      .catch(() => setTargets([]));
  }, []);

  // Targets lead the picker (legacy offered only them); the rest of the
  // glossary stays reachable below
  const targetNames = targets.map((target) => target.organismName);
  const targetNameSet = new Set(targetNames.map((name) => name.toLowerCase()));
  const otherNames = organismNames.filter((name) => !targetNameSet.has(name.toLowerCase()));
  const favouriteCount = targets.filter((target) => target.favourite).length;

  const saveField = async (id: string, patch: Parameters<typeof updateGmo>[1]) => {
    try {
      const updated = await updateGmo(id, patch);
      setGmos((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save GMO');
      throw err;
    }
  };

  const handleAdd = async () => {
    if (!newOrganism) return;
    try {
      setIsAdding(true);
      setError(null);
      setNotice(null);
      const created = await createGmo(plasmidId, { organismName: newOrganism });
      setGmos((prev) => [created, ...prev]);
      setNewOrganism('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add GMO');
    } finally {
      setIsAdding(false);
    }
  };

  const handleAddFavourites = async () => {
    // Legacy confirmation wording (gmocu.py:2113)
    if (!window.confirm('Adding all favourite organisms as GMOs. Proceed?')) return;
    try {
      setIsAddingFavourites(true);
      setError(null);
      setNotice(null);
      const result = await addFavouriteGmos(plasmidId);
      setGmos((prev) => [...result.created, ...prev]);
      const added =
        result.created.length === 1
          ? 'Added 1 favourite'
          : `Added ${result.created.length} favourites`;
      setNotice(
        result.skipped.length > 0
          ? `${added}; skipped ${result.skipped.join(', ')} (already present)`
          : added
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add favourite organisms');
    } finally {
      setIsAddingFavourites(false);
    }
  };

  const handleDestroy = async (gmo: Gmo) => {
    if (!window.confirm(`Mark GMO "${gmo.organismName}" as destroyed today?`)) return;
    setNotice(null);
    try {
      await saveField(gmo.id, { dateDestroyed: todayIsoDate() });
    } catch {
      // error already surfaced by saveField
    }
  };

  const handleDelete = async (gmo: Gmo) => {
    if (!window.confirm(`Delete the GMO record for "${gmo.organismName}"? This cannot be undone.`))
      return;
    try {
      setError(null);
      setNotice(null);
      await deleteGmo(gmo.id);
      setGmos((prev) => prev.filter((g) => g.id !== gmo.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete GMO');
    }
  };

  const inputClasses =
    'px-2 py-1.5 text-sm border rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 ' +
    'border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <section aria-label="GMOs" className="pt-4 border-t border-gray-200 dark:border-gray-700">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
        GMOs ({gmos.length})
      </h3>

      {error && (
        <p role="alert" className="mb-2 text-xs font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {notice && (
        <p aria-live="polite" className="mb-2 text-xs text-emerald-600 dark:text-emerald-400">
          {notice}
        </p>
      )}

      {isLoading ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">Loading…</p>
      ) : gmos.length === 0 ? (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          No GMOs yet. Pick an organism below.
        </p>
      ) : (
        <ul className="flex flex-col gap-2 mb-3">
          {gmos.map((gmo) => {
            const destroyed = Boolean(gmo.dateDestroyed);
            return (
              <li
                key={gmo.id}
                className="p-2 rounded border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/40"
                title={buildGmoSummary(gmo)}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={
                      destroyed
                        ? 'text-sm italic line-through text-gray-500 dark:text-gray-400'
                        : 'text-sm italic text-gray-900 dark:text-gray-100'
                    }
                  >
                    {gmo.organismName}
                  </span>
                  <div className="flex items-center gap-1">
                    <Badge variant={destroyed ? 'default' : 'info'} size="sm">
                      RG {gmo.targetRiskGroup}
                    </Badge>
                    {!destroyed && (
                      <Button
                        intent="ghost"
                        size="xs"
                        aria-label={`Destroy GMO ${gmo.organismName}`}
                        onClick={() => void handleDestroy(gmo)}
                      >
                        Destroy
                      </Button>
                    )}
                    <Button
                      intent="ghost"
                      size="xs"
                      aria-label={`Delete GMO record ${gmo.organismName}`}
                      onClick={() => void handleDelete(gmo)}
                    >
                      ✕
                    </Button>
                  </div>
                </div>
                <div className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs text-gray-500 dark:text-gray-400">
                  <span>Approval</span>
                  <EditableCell
                    value={gmo.approval}
                    ariaLabel={`Approval of GMO ${gmo.organismName}`}
                    onCommit={(value: EditableCellValue) =>
                      saveField(gmo.id, { approval: String(value ?? '') })
                    }
                  />
                  <span>Period</span>
                  <span>
                    {gmo.dateGenerated} — {gmo.dateDestroyed || DESTROYED_PENDING}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <form
        className="flex gap-2 items-center"
        onSubmit={(e) => {
          e.preventDefault();
          void handleAdd();
        }}
      >
        <select
          aria-label="Organism for new GMO"
          className={`${inputClasses} flex-1 min-w-0`}
          value={newOrganism}
          onChange={(e) => setNewOrganism(e.target.value)}
        >
          <option value="">
            {organismNames.length === 0 ? 'No organisms in glossary' : 'Select organism…'}
          </option>
          {targetNames.length === 0 ? (
            organismNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))
          ) : (
            <>
              <optgroup label="Target organisms">
                {targetNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </optgroup>
              {otherNames.length > 0 && (
                <optgroup label="Other organisms">
                  {otherNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </optgroup>
              )}
            </>
          )}
        </select>
        <Button
          type="submit"
          intent="secondary"
          size="sm"
          loading={isAdding}
          disabled={!newOrganism}
        >
          Add GMO
        </Button>
      </form>

      {favouriteCount > 0 && (
        <div className="mt-2">
          <Button
            intent="ghost"
            size="sm"
            loading={isAddingFavourites}
            onClick={() => void handleAddFavourites()}
          >
            ★ Add {favouriteCount === 1 ? 'favourite' : `all ${favouriteCount} favourites`}
          </Button>
        </div>
      )}
    </section>
  );
}
