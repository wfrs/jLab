'use client';

import { useCallback, useEffect, useState } from 'react';
import type { PrintBatch } from '@/services/label.service';
import { fetchPrintBatch, fetchPrintBatches, stashLabelSelection } from './api-client';

/**
 * Past sheets, ready to print again.
 *
 * A sheet gets lost or mis-cut, and the Word workflow's only answer was to
 * retype it. Every print jlab makes is already recorded as a set, so reprinting
 * one is a click.
 */
export function ReprintHistory({ compact = false }: { compact?: boolean }): JSX.Element | null {
  const [batches, setBatches] = useState<PrintBatch[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    fetchPrintBatches()
      // Defensive: this renders inside the empty-selection state, and a
      // component that throws on an unexpected payload takes the page's error
      // message down with it
      .then((result) => setBatches(Array.isArray(result) ? result : []))
      .catch(() => setError('Could not load the print history'));
  }, []);

  const reprint = useCallback(async (batch: PrintBatch) => {
    setBusy(batch.printedAt);
    try {
      const ids = await fetchPrintBatch(batch.kind, batch.printedAt);
      stashLabelSelection(ids);
      window.location.href = `/labels/print?kind=${batch.kind}&n=${ids.length}`;
    } catch {
      setError('Could not load that sheet');
      setBusy(null);
    }
  }, []);

  if (error) {
    return <p className="text-xs text-gray-500">{error}</p>;
  }
  if (batches.length === 0) {
    return compact ? null : (
      <p className="text-sm text-gray-500">
        Nothing has been printed from jlab yet. Sheets you print here are recorded so you can print
        them again.
      </p>
    );
  }

  return (
    <div className={compact ? '' : 'mt-4'}>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Reprint a sheet</p>
      <ul className="mt-2 flex flex-col gap-1">
        {batches.map((batch) => (
          <li key={`${batch.kind}-${batch.printedAt}`}>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void reprint(batch)}
              className="flex w-full items-center justify-between gap-4 rounded border border-gray-800 px-3 py-2 text-left text-sm text-gray-300 hover:border-gray-600 hover:bg-gray-900 disabled:opacity-50"
            >
              <span>
                {batch.count} {batch.kind === 'glycerol' ? 'stock' : 'plasmid'} label
                {batch.count === 1 ? '' : 's'}
              </span>
              <span className="text-xs tabular-nums text-gray-500">
                {new Date(batch.printedAt).toLocaleString()}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
