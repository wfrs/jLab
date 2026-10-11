'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import {
  A4_DENSE_PAGE,
  A4_PAGE,
  GLYCEROL_LABEL,
  PLASMID_LABEL,
  gridForPage,
  labelsPerPage,
  paginate,
} from '@/domain/label-layout';
import type { GlycerolLabelPayload, PlasmidLabelPayload } from '@/services/label.service';
import { LabelCell, LabelSheet } from './LabelSheet';
import { PlasmidLabel } from './PlasmidLabel';
import { GlycerolLabel } from './GlycerolLabel';
import { StartCellPicker } from './StartCellPicker';
import { ReprintHistory } from './ReprintHistory';
import {
  fetchGlycerolLabels,
  fetchPlasmidLabels,
  readLabelSelection,
  recordLabelPrints,
} from './api-client';

type AnyLabel = PlasmidLabelPayload | GlycerolLabelPayload;

const isGlycerol = (label: AnyLabel): label is GlycerolLabelPayload => 'stockId' in label;

/**
 * Print preview for a label sheet.
 *
 * Reached from a selection on the plasmids page, not from the nav — you print
 * the labels you just chose. The screen shows the paper: same millimetres,
 * same grid, so what you check is what comes out.
 */
export function LabelPrintView() {
  const searchParams = useSearchParams();
  const kind = searchParams.get('kind') === 'glycerol' ? 'glycerol' : 'plasmid';
  const spec = kind === 'glycerol' ? GLYCEROL_LABEL : PLASMID_LABEL;
  // Same labels, narrower margins: 85 to a sheet instead of 60 for plasmids
  const [isDense, setIsDense] = useState(false);
  const page = isDense ? A4_DENSE_PAGE : A4_PAGE;

  // The selection normally arrives in sessionStorage — 400 UUIDs do not fit in
  // a query string — but ?ids= keeps a direct link working.
  const [stashedIds, setStashedIds] = useState<string[] | null>(null);
  useEffect(() => {
    setStashedIds(readLabelSelection());
  }, []);

  const ids = useMemo(() => {
    const raw = searchParams.get('ids');
    if (raw) {
      return raw
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
    }
    return stashedIds ?? [];
  }, [searchParams, stashedIds]);

  const [labels, setLabels] = useState<AnyLabel[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [startAt, setStartAt] = useState(() => {
    const parsed = Number.parseInt(searchParams.get('startAt') ?? '0', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  });
  const [recordedAt, setRecordedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      // Still reading sessionStorage — not an empty selection yet
      if (!searchParams.get('ids') && stashedIds === null) {
        return;
      }
      if (ids.length === 0) {
        setError('No plasmids selected. Choose rows on the Plasmids page, then Print labels.');
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const result: AnyLabel[] =
          kind === 'glycerol' ? await fetchGlycerolLabels(ids) : await fetchPlasmidLabels(ids);
        if (!cancelled) {
          setLabels(result);
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Could not load labels');
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
  }, [ids, kind, searchParams, stashedIds]);

  const grid = gridForPage(spec, page);
  const perPage = labelsPerPage(spec, page);
  const pages = useMemo(() => paginate(labels, spec, startAt, page), [labels, spec, startAt, page]);

  // A denser sheet has more cells, so a start cell chosen on the sparse grid
  // can fall outside it — clamp rather than silently dropping labels
  useEffect(() => {
    if (startAt >= perPage) {
      setStartAt(0);
    }
  }, [perPage, startAt]);

  const handlePrint = useCallback(() => {
    // Recorded on the way to the print dialog. The record is a hint — "did I
    // already do these?" — not a source of truth, and over-recording is far
    // less costly here than the Word workflow's habit of recording nothing.
    void recordLabelPrints(
      kind,
      labels.map((label) => (isGlycerol(label) ? label.id : label.plasmidId))
    )
      .then((result) => setRecordedAt(result.printedAt ?? new Date().toISOString()))
      .catch(() => {
        // A failed history write must never block the print itself
        setRecordedAt(null);
      });
    window.print();
  }, [kind, labels]);

  const undated = labels.filter((label) =>
    isGlycerol(label) ? !label.madeOn : !label.preppedOn
  ).length;
  const reprinted = labels.filter((label) => label.lastPrintedAt).length;
  const noun = kind === 'glycerol' ? 'glycerol stock label' : 'plasmid label';

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="print-hidden sticky top-[var(--app-nav-height)] z-10 border-b border-gray-800 bg-gray-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 px-6 py-3">
          <div className="flex-1 min-w-[16rem]">
            <p className="text-sm font-medium text-gray-100">
              {labels.length} {noun}
              {labels.length === 1 ? '' : 's'}
              {pages.length > 0 && (
                <span className="text-gray-400">
                  {' '}
                  · {pages.length} sheet{pages.length === 1 ? '' : 's'} · {perPage} per sheet
                </span>
              )}
            </p>
            <p className="mt-0.5 text-xs text-gray-500">
              Set the browser&apos;s print margins to None and turn headers and footers off — the
              sheet supplies its own {page.marginMm} mm margin.
            </p>
          </div>

          <StartCellPicker grid={grid} value={startAt} onChange={setStartAt} />

          <label className="flex items-center gap-2 text-xs text-gray-400">
            <input
              type="checkbox"
              checked={isDense}
              onChange={(event) => setIsDense(event.target.checked)}
              className="h-4 w-4 accent-blue-600"
            />
            Dense ({labelsPerPage(spec, A4_DENSE_PAGE)}/sheet)
          </label>

          <Button intent="primary" size="sm" onClick={handlePrint} disabled={labels.length === 0}>
            Print
          </Button>
        </div>

        {(undated > 0 || reprinted > 0 || recordedAt) && (
          <div className="mx-auto max-w-5xl px-6 pb-3 text-xs">
            {undated > 0 && (
              <p className="text-amber-400">
                {undated} label{undated === 1 ? ' has' : 's have'} no{' '}
                {kind === 'glycerol' ? 'date recorded' : 'prep recorded'}, so no date
                {kind === 'glycerol' ? '' : ' or concentration'} is printed.
              </p>
            )}
            {reprinted > 0 && (
              <p className="text-gray-500">
                {reprinted} of these {reprinted === 1 ? 'was' : 'were'} printed from jlab before.
              </p>
            )}
            {recordedAt && <p className="text-gray-500">Recorded as printed.</p>}
          </div>
        )}
      </div>

      {error && (
        <div className="print-hidden mx-auto max-w-5xl px-6 py-6">
          <div role="alert" className="rounded-lg border border-red-800 bg-red-900/20 p-4">
            <p className="text-sm text-red-200">{error}</p>
          </div>
          {/* An empty selection is a dead end otherwise; a past sheet is
              usually what someone arriving here without one wants */}
          <div className="mt-6">
            <ReprintHistory />
          </div>
        </div>
      )}

      {isLoading && (
        <p className="print-hidden mx-auto max-w-5xl px-6 py-6 text-sm text-gray-400">
          Loading labels…
        </p>
      )}

      <div className="label-preview">
        {pages.map((cells, pageIndex) => (
          <LabelSheet key={pageIndex} spec={spec} page={page}>
            {cells.map((label, cellIndex) => {
              if (!label) {
                return <LabelCell key={`blank-${pageIndex}-${cellIndex}`} spec={spec} />;
              }
              return isGlycerol(label) ? (
                <GlycerolLabel key={label.id} data={label} spec={spec} />
              ) : (
                <PlasmidLabel key={label.plasmidId} data={label} spec={spec} />
              );
            })}
          </LabelSheet>
        ))}
      </div>
    </div>
  );
}
