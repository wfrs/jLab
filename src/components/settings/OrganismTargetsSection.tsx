'use client';

/**
 * OrganismTargetsSection
 * Manages the target organism shortlist (legacy Settings tab:
 * OrganismSelection + OrganismFavourites). Targets are offered first when
 * adding a GMO; starred favourites are the one-click batch-add set.
 *
 * Legacy kept two lists side by side and let them drift apart (favourites
 * not present in targets errored later, at batch-add). Here a favourite IS
 * a starred target, so the drift cannot exist.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { OrganismTarget } from '@/domain/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { listOrganisms } from '@/components/glossary/api-client';
import {
  addOrganismTarget,
  listOrganismTargets,
  removeOrganismTarget,
  setOrganismTargetFavourite,
} from './api-client';

export function OrganismTargetsSection(): JSX.Element {
  const [targets, setTargets] = useState<OrganismTarget[]>([]);
  const [organismNames, setOrganismNames] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newOrganism, setNewOrganism] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      setTargets(await listOrganismTargets());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load target organisms');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    listOrganisms()
      .then((organisms) => setOrganismNames(organisms.map((o) => o.fullName)))
      .catch(() => setOrganismNames([]));
  }, [refresh]);

  const targetedNames = new Set(targets.map((t) => t.organismName.toLowerCase()));
  const available = organismNames.filter((name) => !targetedNames.has(name.toLowerCase()));

  const handleAdd = async () => {
    if (!newOrganism) return;
    try {
      setIsAdding(true);
      setError(null);
      const created = await addOrganismTarget(newOrganism);
      setTargets((prev) => [...prev, created]);
      setNewOrganism('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add target organism');
    } finally {
      setIsAdding(false);
    }
  };

  const handleToggleFavourite = async (target: OrganismTarget) => {
    try {
      setError(null);
      const updated = await setOrganismTargetFavourite(target.id, !target.favourite);
      setTargets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update favourite');
    }
  };

  const handleRemove = async (target: OrganismTarget) => {
    try {
      setError(null);
      await removeOrganismTarget(target.id);
      setTargets((prev) => prev.filter((t) => t.id !== target.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove target organism');
    }
  };

  const selectClasses =
    'px-3 py-2 text-sm border rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 ' +
    'border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h3">Target organisms</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          The shortlist offered first when adding a GMO to a plasmid. Starred organisms are
          favourites — the GMO list can add all of them to a plasmid in one click.
        </p>

        {error && (
          <p role="alert" className="mb-3 text-xs font-medium text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        {isLoading ? (
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Loading…</p>
        ) : targets.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            No target organisms yet. Pick one from the glossary below.
          </p>
        ) : (
          <ul className="flex flex-col mb-4 divide-y divide-gray-200 dark:divide-gray-700 border-y border-gray-200 dark:border-gray-700">
            {targets.map((target) => (
              <li key={target.id} className="flex items-center gap-2 py-1.5">
                <button
                  type="button"
                  aria-pressed={target.favourite}
                  aria-label={
                    target.favourite
                      ? `Remove ${target.organismName} from favourites`
                      : `Mark ${target.organismName} as favourite`
                  }
                  title={target.favourite ? 'Favourite — click to unstar' : 'Mark as favourite'}
                  onClick={() => void handleToggleFavourite(target)}
                  className={`shrink-0 w-6 h-6 rounded text-base leading-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    target.favourite
                      ? 'text-amber-500 dark:text-amber-400'
                      : 'text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400'
                  }`}
                >
                  {target.favourite ? '★' : '☆'}
                </button>
                <span className="flex-1 min-w-0 truncate text-sm italic text-gray-900 dark:text-gray-100">
                  {target.organismName}
                </span>
                <Button
                  intent="ghost"
                  size="xs"
                  aria-label={`Remove ${target.organismName} from target list`}
                  onClick={() => void handleRemove(target)}
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
          <select
            aria-label="Organism to add to the target list"
            className={`${selectClasses} flex-1 min-w-0`}
            value={newOrganism}
            onChange={(e) => setNewOrganism(e.target.value)}
          >
            <option value="">
              {organismNames.length === 0
                ? 'No organisms in glossary'
                : available.length === 0
                  ? 'All glossary organisms are targeted'
                  : 'Select organism…'}
            </option>
            {available.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <Button
            type="submit"
            intent="secondary"
            size="sm"
            loading={isAdding}
            disabled={!newOrganism}
          >
            Add
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
