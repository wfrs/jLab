'use client';

/**
 * GlycerolStockSection
 * Frozen stocks made from the selected plasmid.
 *
 * Remaking a stock overwrites its date rather than adding a row — the tube is
 * new, the number written on it is not. That is the lab's own model, confirmed
 * against CJM348, CJM353, CJM369 and CJM370, where the spreadsheet holds only
 * the latest date each time.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { GlycerolStock } from '@/domain/types';
import { Button } from '@/components/ui/Button';
import { formatStockDate } from '@/domain/label-content';
import { derivedStockId } from '@/domain/lab-normalization';
import {
  createGlycerolStock,
  listGlycerolStocks,
  stashLabelSelection,
  updateGlycerolStock,
} from '@/components/labels/api-client';

const todayIso = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
};

export function GlycerolStockSection({
  plasmidId,
  plasmidName,
}: {
  plasmidId: string;
  plasmidName: string;
}): JSX.Element {
  const [stocks, setStocks] = useState<GlycerolStock[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      setStocks(await listGlycerolStocks([plasmidId]));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load glycerol stocks');
    } finally {
      setIsLoading(false);
    }
  }, [plasmidId]);

  useEffect(() => {
    setIsLoading(true);
    void refresh();
  }, [refresh]);

  /** Record that the stock was made again today */
  const handleRemake = async (stock: GlycerolStock) => {
    setBusyId(stock.id);
    try {
      setError(null);
      const updated = await updateGlycerolStock(stock.id, { madeOn: todayIso() });
      setStocks((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update the stock');
    } finally {
      setBusyId(null);
    }
  };

  const handleAdd = async () => {
    // E. coli stock IDs mirror the plasmid number, so the obvious one is
    // offered rather than asked for
    const suggested = derivedStockId(plasmidName) ?? '';
    setIsAdding(true);
    try {
      setError(null);
      const created = await createGlycerolStock({
        stockId: suggested,
        plasmidId,
        organism: 'E. coli',
        strain: 'TOP10',
        madeOn: todayIso(),
      });
      setStocks((prev) => [...prev, created]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add the stock');
    } finally {
      setIsAdding(false);
    }
  };

  const printLabels = () => {
    stashLabelSelection(stocks.map((stock) => stock.id));
    window.location.href = `/labels/print?kind=glycerol&n=${stocks.length}`;
  };

  return (
    <section
      aria-label="Glycerol stocks"
      className="pt-4 border-t border-gray-200 dark:border-gray-700"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Glycerol stocks ({stocks.length})
        </h3>
        {stocks.length > 0 && (
          <Button intent="ghost" size="xs" onClick={printLabels}>
            Print labels
          </Button>
        )}
      </div>

      {error && (
        <p role="alert" className="mb-2 text-xs font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {isLoading ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">Loading…</p>
      ) : stocks.length === 0 ? (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          No glycerol stock recorded for this plasmid.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5 mb-2">
          {stocks.map((stock) => (
            <li
              key={stock.id}
              className="flex items-center justify-between gap-2 rounded border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/40 px-2 py-1.5"
            >
              <span className="text-sm text-gray-900 dark:text-gray-100">
                <span className="font-medium">{stock.stockId}</span>
                <span className="ml-2 text-gray-500 dark:text-gray-400">
                  <em>{stock.organism}</em> {stock.strain}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <span className="text-xs tabular-nums text-gray-600 dark:text-gray-400">
                  {stock.madeOn ? formatStockDate(stock.madeOn) : 'not made'}
                </span>
                <Button
                  intent="ghost"
                  size="xs"
                  loading={busyId === stock.id}
                  onClick={() => void handleRemake(stock)}
                  title="Record that this stock was made again today"
                >
                  Remade today
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {stocks.length === 0 && !isLoading && (
        <Button intent="secondary" size="xs" loading={isAdding} onClick={() => void handleAdd()}>
          Add {derivedStockId(plasmidName) ?? 'stock'}
        </Button>
      )}
    </section>
  );
}
