'use client';

/**
 * SpreadsheetImportSection
 * Settings-page card for importing the lab's plasmid workbook.
 *
 * Sits beside ImportSection, which reads a legacy GMOCU v1 .db file. The
 * workbook is the authoritative record: it carries the construct names,
 * concentrations, prep dates, strains, freezer boxes and glycerol stocks that
 * the .db export has no room for.
 *
 * Inspect first, import second — the same two-step shape as the .db import,
 * so a wrong file is caught before anything is written.
 */

import { useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface Inspection {
  sheets: string[];
  plasmidRows: number;
  namedPlasmids: number;
  agroRows: number;
}

interface SheetCounts {
  added: number;
  updated: number;
  skippedReserved: number;
  skippedBlank: number;
}

interface ImportResult {
  sheetsRead: string[];
  plasmids: SheetCounts;
  preps: { added: number };
  stocks: SheetCounts & { agrobacterium: number };
  stockIdMismatches: string[];
  externalStocks: string[];
  unresolvedPlasmidRefs: string[];
}

type Phase = 'idle' | 'inspecting' | 'ready' | 'importing' | 'done';

async function postWorkbook(file: File, dryRun: boolean): Promise<unknown> {
  const formData = new FormData();
  formData.append('file', file);
  if (dryRun) {
    formData.append('dryRun', '1');
  }
  const response = await fetch('/api/import/spreadsheet', { method: 'POST', body: formData });
  const json = await response.json();
  if (!response.ok) {
    throw new Error(json?.message || 'Import request failed');
  }
  return json.data;
}

/** A short list of keys, with the tail summarized */
function KeyList({ label, keys }: { label: string; keys: string[] }): JSX.Element | null {
  if (keys.length === 0) {
    return null;
  }
  const shown = keys.slice(0, 8);
  const hidden = keys.length - shown.length;
  return (
    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
      <span className="text-gray-500 dark:text-gray-500">{label}:</span>{' '}
      <span className="font-mono">{shown.join(', ')}</span>
      {hidden > 0 && <span className="text-gray-500 dark:text-gray-500"> +{hidden} more</span>}
    </p>
  );
}

export function SpreadsheetImportSection(): JSX.Element {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = (): void => {
    setFile(null);
    setPhase('idle');
    setInspection(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFile = async (picked: File | null): Promise<void> => {
    if (!picked) return;
    setFile(picked);
    setResult(null);
    setError(null);
    setPhase('inspecting');
    try {
      setInspection((await postWorkbook(picked, true)) as Inspection);
      setPhase('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read the workbook');
      setPhase('idle');
    }
  };

  const handleImport = async (): Promise<void> => {
    if (!file) return;
    setPhase('importing');
    setError(null);
    try {
      setResult((await postWorkbook(file, false)) as ImportResult);
      setPhase('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setPhase('ready');
    }
  };

  return (
    // Spacing belongs to the page's layout, not to this card
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle as="h3">Lab spreadsheet</CardTitle>
          <span className="rounded bg-blue-600/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-blue-700 dark:text-blue-300">
            Routine
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          The plasmid workbook (.xlsx) — construct names, concentrations, prep dates, freezer boxes
          and glycerol stocks. Existing plasmids are matched on their accession and updated, so
          importing the same file twice is safe.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          aria-label="Lab spreadsheet"
          disabled={phase === 'inspecting' || phase === 'importing'}
          className="block w-full text-sm text-gray-700 dark:text-gray-300 file:mr-3 file:px-3 file:py-1.5 file:text-sm file:font-medium file:border-0 file:rounded-md file:bg-blue-600 file:text-white hover:file:bg-blue-700 file:cursor-pointer"
          onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
        />

        {phase === 'inspecting' && (
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">Reading the workbook…</p>
        )}

        {error && (
          <p role="alert" className="mt-3 text-xs font-medium text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        {inspection && phase !== 'done' && (
          <div className="mt-4">
            <p className="text-sm text-gray-700 dark:text-gray-200">
              {inspection.namedPlasmids} plasmids and {inspection.agroRows} Agrobacterium stocks
              found.
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {inspection.plasmidRows - inspection.namedPlasmids} numbers are reserved but unused,
              and will be skipped. Sheets: {inspection.sheets.join(', ')}.
            </p>
            <div className="mt-3 flex gap-2">
              <Button onClick={() => void handleImport()} disabled={phase === 'importing'}>
                {phase === 'importing' ? 'Importing…' : 'Import'}
              </Button>
              <Button intent="secondary" onClick={reset} disabled={phase === 'importing'}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {result && (
          <div role="status" className="mt-4">
            <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
              {result.plasmids.added} plasmids added, {result.plasmids.updated} updated.
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              {result.preps.added} preparation{result.preps.added === 1 ? '' : 's'},{' '}
              {result.stocks.added} glycerol stock{result.stocks.added === 1 ? '' : 's'} (
              {result.stocks.agrobacterium} Agrobacterium). {result.plasmids.skippedReserved}{' '}
              reserved numbers skipped.
            </p>

            {result.stockIdMismatches.length > 0 && (
              <p className="mt-2 text-xs font-medium text-amber-600 dark:text-amber-400">
                Some glycerol stock numbers no longer match their plasmid number. The app derives
                stock IDs from plasmid numbers, so this needs looking at:
                <span className="font-mono">
                  {' '}
                  {result.stockIdMismatches.slice(0, 5).join(', ')}
                </span>
              </p>
            )}

            <KeyList label="Obtained from someone else" keys={result.externalStocks} />
            <KeyList
              label="Referenced a plasmid we do not have"
              keys={result.unresolvedPlasmidRefs}
            />

            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Anything the spreadsheet flags about its own data now appears under Reports → Data
              quality.
            </p>

            <div className="mt-3">
              <Button intent="secondary" onClick={reset}>
                Import another file
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
