'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import {
  DEFAULT_FINAL_VOLUME_UL,
  DEFAULT_PART_VOLUME_UL,
  FMOL_TARGET,
  GoldenGatePartResult,
  PartRole,
  calculateMix,
  minimumUsableConcentrationNgUl,
} from '@/domain/golden-gate';
import { readLabelSelection } from '@/components/labels/api-client';

interface PartRow {
  id: string;
  name: string;
  constructName: string | null;
  sizeBp: number | null;
  concentrationNgUl: number | null;
  role: PartRole;
}

const ul = (value: number | null) => (value === null ? '—' : `${value.toFixed(1)} µL`);
const ng = (value: number | null) => (value === null ? '—' : `${value.toFixed(1)} ng/µL`);

/**
 * Golden Gate mix, from plasmids already in jlab.
 *
 * The `parts` sheet asks you to retype every fragment's size and its measured
 * concentration; both are already recorded here, so the calculator reads them
 * and only asks which parts are inserts and which is the backbone.
 */
export function GoldenGateCalculator(): JSX.Element {
  const searchParams = useSearchParams();
  const [stashed, setStashed] = useState<string[] | null>(null);
  const [rows, setRows] = useState<PartRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [finalVolumeUl, setFinalVolumeUl] = useState(DEFAULT_FINAL_VOLUME_UL);

  useEffect(() => {
    setStashed(readLabelSelection());
  }, []);

  const ids = useMemo(() => {
    const raw = searchParams.get('ids');
    if (raw) {
      return raw
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
    }
    return stashed ?? [];
  }, [searchParams, stashed]);

  useEffect(() => {
    if (!searchParams.get('ids') && stashed === null) {
      return;
    }
    if (ids.length === 0) {
      setError('No plasmids selected. Choose rows on the Plasmids page, then Golden Gate.');
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch(
          `/api/tools/golden-gate?ids=${encodeURIComponent(ids.join(','))}`
        );
        const json = await response.json();
        if (!response.ok) {
          throw new Error(json?.message || 'Could not load the parts');
        }
        if (!cancelled) {
          // The largest fragment is almost always the backbone; a sensible
          // guess beats an empty form, and one click changes it
          const parts = json.data.parts as Omit<PartRow, 'role'>[];
          const largest = parts.reduce(
            (best, part) => ((part.sizeBp ?? 0) > (best?.sizeBp ?? 0) ? part : best),
            parts[0]
          );
          setRows(
            parts.map((part) => ({
              ...part,
              role: part.id === largest?.id ? 'backbone' : 'insert',
            }))
          );
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Could not load the parts');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [ids, searchParams, stashed]);

  const setRole = useCallback((id: string, role: PartRole) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, role } : row)));
  }, []);

  const sized = rows.filter((row) => row.sizeBp && row.sizeBp > 0);
  const unsized = rows.filter((row) => !row.sizeBp || row.sizeBp <= 0);

  const results: (GoldenGatePartResult & { id: string })[] = useMemo(
    () =>
      calculateMix(
        sized.map((row) => ({
          name: row.constructName || row.name,
          role: row.role,
          sizeBp: row.sizeBp as number,
          stockConcentrationNgUl: row.concentrationNgUl,
        })),
        { finalVolumeUl }
      ).map((result, index) => ({ ...result, id: sized[index]!.id })),
    [sized, finalVolumeUl]
  );

  const tooDilute = results.filter((result) => result.tooDilute);
  const unmeasured = results.filter((result) => result.unmeasured);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-8">
        <header>
          <h1 className="mb-2 text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
            Golden Gate mix
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Dilutions for {FMOL_TARGET.insert} fmol of each insert and {FMOL_TARGET.backbone} fmol
            of the backbone, measured into {DEFAULT_PART_VOLUME_UL} µL. Sizes and concentrations
            come from each plasmid&apos;s record and its newest prep.
          </p>
        </header>

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20"
          >
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {isLoading && <p className="text-sm text-gray-500 dark:text-gray-400">Loading parts…</p>}

        {rows.length > 0 && (
          <>
            <Card>
              <CardHeader>
                <CardTitle as="h2">Parts</CardTitle>
              </CardHeader>
              <CardContent>
                <label className="mb-4 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  Final volume
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={finalVolumeUl}
                    onChange={(event) => {
                      const next = Number(event.target.value);
                      setFinalVolumeUl(Number.isFinite(next) && next > 0 ? next : 1);
                    }}
                    className="h-8 w-20 rounded-md border border-gray-300 bg-white px-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  />
                  µL
                </label>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                        <th className="pb-2 font-medium">Part</th>
                        <th className="pb-2 font-medium">Role</th>
                        <th className="pb-2 text-right font-medium">Size</th>
                        <th className="pb-2 text-right font-medium">Stock</th>
                        <th className="pb-2 text-right font-medium">Target</th>
                        <th className="pb-2 pr-3 text-right font-medium">Take</th>
                        <th className="pb-2 pl-3 text-right font-medium">Tris-HCl</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sized.map((row) => {
                        const result = results.find((r) => r.id === row.id);
                        if (!result) return null;
                        return (
                          <tr
                            key={row.id}
                            className="border-t border-gray-200 dark:border-gray-800"
                          >
                            <td className="py-2 pr-3">
                              <span className="font-medium text-gray-900 dark:text-gray-100">
                                {row.constructName || row.name}
                              </span>
                              {row.constructName && (
                                <span className="ml-2 text-xs text-gray-500">{row.name}</span>
                              )}
                            </td>
                            <td className="py-2 pr-3">
                              <select
                                value={row.role}
                                aria-label={`Role of ${row.name}`}
                                onChange={(event) =>
                                  setRole(row.id, event.target.value as PartRole)
                                }
                                className="h-7 rounded border border-gray-300 bg-white px-1 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                              >
                                <option value="insert">insert (40 fmol)</option>
                                <option value="backbone">backbone (20 fmol)</option>
                              </select>
                            </td>
                            <td className="py-2 pr-3 text-right tabular-nums text-gray-600 dark:text-gray-400">
                              {row.sizeBp} bp
                            </td>
                            <td className="py-2 pr-3 text-right tabular-nums text-gray-600 dark:text-gray-400">
                              {ng(result.stockConcentrationNgUl)}
                            </td>
                            <td className="py-2 pr-3 text-right tabular-nums text-gray-600 dark:text-gray-400">
                              {ng(result.targetConcentrationNgUl)}
                            </td>
                            <td className="py-2 pr-3 text-right tabular-nums font-medium text-gray-900 dark:text-gray-100">
                              {result.tooDilute ? (
                                <span className="text-amber-600 dark:text-amber-400">
                                  too dilute
                                </span>
                              ) : (
                                ul(result.stockVolumeUl)
                              )}
                            </td>
                            <td className="py-2 pl-3 text-right tabular-nums text-gray-900 dark:text-gray-100">
                              {ul(result.bufferVolumeUl)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {(tooDilute.length > 0 || unmeasured.length > 0 || unsized.length > 0) && (
              <Card>
                <CardHeader>
                  <CardTitle as="h2">What needs attention</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="flex flex-col gap-2 text-sm">
                    {tooDilute.map((result) => (
                      <li key={result.name} className="text-amber-700 dark:text-amber-400">
                        <span className="font-medium">{result.name}</span> is too dilute at{' '}
                        {ng(result.stockConcentrationNgUl)} — it would take{' '}
                        {ul(result.stockVolumeUl)} of a {finalVolumeUl} µL reaction. It needs at
                        least {ng(minimumUsableConcentrationNgUl(result))}, so concentrate it or
                        prep it again.
                      </li>
                    ))}
                    {unmeasured.map((result) => (
                      <li key={result.name} className="text-gray-600 dark:text-gray-400">
                        <span className="font-medium">{result.name}</span> has no measured
                        concentration, so only the target ({ng(result.targetConcentrationNgUl)}) can
                        be worked out. Record a prep with a Nanodrop reading.
                      </li>
                    ))}
                    {unsized.map((row) => (
                      <li key={row.id} className="text-gray-600 dark:text-gray-400">
                        <span className="font-medium">{row.constructName || row.name}</span> has no
                        recorded size, so it cannot be included.
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
