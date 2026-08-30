'use client';

/**
 * PrepHistorySection
 * Every preparation of the selected plasmid, newest first.
 *
 * The spreadsheet keeps one date and one concentration per plasmid, so a
 * re-prep overwrites the previous one and the history is lost. Keeping the
 * rows is what lets a label always carry the current tube's numbers — and
 * what explains a label like pJM0021's, printed at 21.2 ng/µL for a tube that
 * has since been remade.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { PlasmidPrep } from '@/domain/types';
import { formatConcentration, formatLabelDate } from '@/domain/label-content';
import { fetchPrepHistory } from '@/components/labels/api-client';

export function PrepHistorySection({ plasmidId }: { plasmidId: string }): JSX.Element {
  const [preps, setPreps] = useState<PlasmidPrep[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      setPreps(await fetchPrepHistory(plasmidId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load prep history');
    } finally {
      setIsLoading(false);
    }
  }, [plasmidId]);

  useEffect(() => {
    setIsLoading(true);
    void refresh();
  }, [refresh]);

  return (
    <section aria-label="Preps" className="pt-4 border-t border-gray-200 dark:border-gray-700">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
        Preps ({preps.length})
      </h3>

      {error && (
        <p role="alert" className="mb-2 text-xs font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {isLoading ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">Loading…</p>
      ) : preps.length === 0 ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Never prepped. Select the row on the Plasmids page and choose Record prep.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {preps.map((prep, index) => (
            <li
              key={prep.id}
              className="flex items-center justify-between gap-2 rounded border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/40 px-2 py-1.5"
            >
              <span className="text-sm text-gray-900 dark:text-gray-100">
                {formatLabelDate(prep.preppedOn) ?? prep.preppedOn}
                <span className="ml-2 text-gray-500 dark:text-gray-400">
                  {prep.operatorInitials}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <span className="text-sm tabular-nums text-gray-700 dark:text-gray-300">
                  {formatConcentration(prep.concentrationNgUl)}
                </span>
                {index === 0 && (
                  <span className="rounded bg-blue-600/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-blue-700 dark:text-blue-300">
                    Current
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
