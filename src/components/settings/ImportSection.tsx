'use client';

/**
 * ImportSection
 * Settings-page card for importing plasmids from a legacy GMOCU v1 .db file
 * (legacy import_data workflow: pick file -> select from the plasmids that
 * do not exist locally -> import, glossary entries follow automatically).
 */

import { useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface ImportInspection {
  candidates: string[];
  skippedExisting: string[];
}

interface ImportResult extends ImportInspection {
  importedPlasmids: string[];
  skippedDuplicateNames: string[];
  cassettes: number;
  gmos: number;
  attachments: number;
  genbankFiles: number;
  addedFeatures: string[];
  addedOrganisms: string[];
}

type Phase = 'idle' | 'inspecting' | 'selecting' | 'importing' | 'done';

async function postImport(file: File, fields: Record<string, string>): Promise<unknown> {
  const formData = new FormData();
  formData.append('file', file);
  for (const [key, value] of Object.entries(fields)) {
    formData.append(key, value);
  }
  const response = await fetch('/api/import', { method: 'POST', body: formData });
  const json = await response.json();
  if (!response.ok) {
    throw new Error(json?.message || 'Import request failed');
  }
  return json.data;
}

export function ImportSection(): JSX.Element {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [inspection, setInspection] = useState<ImportInspection | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setFile(null);
    setPhase('idle');
    setInspection(null);
    setSelected(new Set());
    setResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileChange = async (chosen: File | null) => {
    setError(null);
    setResult(null);
    setInspection(null);
    setSelected(new Set());
    setFile(chosen);
    if (!chosen) {
      setPhase('idle');
      return;
    }
    setPhase('inspecting');
    try {
      const data = (await postImport(chosen, { dryRun: '1' })) as ImportInspection;
      setInspection(data);
      // Legacy offered "Import all" as the one-click path; preselect all
      setSelected(new Set(data.candidates));
      setPhase('selecting');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read database file');
      setPhase('idle');
    }
  };

  const toggle = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const handleImport = async () => {
    if (!file || selected.size === 0) {
      return;
    }
    setPhase('importing');
    setError(null);
    try {
      const data = (await postImport(file, {
        names: JSON.stringify(Array.from(selected)),
      })) as ImportResult;
      setResult(data);
      setPhase('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setPhase('selecting');
    }
  };

  const allSelected = inspection !== null && selected.size === inspection.candidates.length;

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Import from GMOCU v1</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Select a legacy gmocu.db file. Plasmids that do not exist here yet can be imported with
          their cassettes, GMOs, attachments and GenBank files; missing glossary entries they
          reference are added automatically.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept=".db,application/x-sqlite3,application/octet-stream"
          aria-label="GMOCU v1 database file"
          className="block w-full text-sm text-gray-700 dark:text-gray-300 file:mr-3 file:px-3 file:py-1.5 file:text-sm file:font-medium file:border-0 file:rounded-md file:bg-blue-600 file:text-white hover:file:bg-blue-700 file:cursor-pointer"
          disabled={phase === 'inspecting' || phase === 'importing'}
          onChange={(e) => void handleFileChange(e.target.files?.[0] ?? null)}
        />

        {phase === 'inspecting' && (
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">Reading database…</p>
        )}

        {error && (
          <p role="alert" className="mt-3 text-xs font-medium text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        {inspection && phase !== 'done' && (
          <div className="mt-4">
            {inspection.candidates.length === 0 ? (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                No new plasmids to import
                {inspection.skippedExisting.length > 0 &&
                  ` — all ${inspection.skippedExisting.length} plasmids in the file already exist`}
                .
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {inspection.candidates.length} plasmid
                    {inspection.candidates.length === 1 ? '' : 's'} can be imported
                  </p>
                  <Button
                    intent="ghost"
                    size="xs"
                    onClick={() =>
                      setSelected(allSelected ? new Set() : new Set(inspection.candidates))
                    }
                  >
                    {allSelected ? 'Select none' : 'Select all'}
                  </Button>
                </div>
                <ul className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-md divide-y divide-gray-100 dark:divide-gray-700/60 mb-3">
                  {inspection.candidates.map((name) => (
                    <li key={name}>
                      <label className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-800 dark:text-gray-200 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40">
                        <input
                          type="checkbox"
                          className="w-4 h-4 accent-blue-600"
                          checked={selected.has(name)}
                          onChange={() => toggle(name)}
                        />
                        <span className="font-mono">{name}</span>
                      </label>
                    </li>
                  ))}
                </ul>
                {inspection.skippedExisting.length > 0 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    Already present (skipped): {inspection.skippedExisting.join(', ')}
                  </p>
                )}
                <Button
                  intent="primary"
                  size="sm"
                  disabled={selected.size === 0 || phase === 'importing'}
                  onClick={() => void handleImport()}
                >
                  {phase === 'importing'
                    ? 'Importing…'
                    : `Import ${selected.size} plasmid${selected.size === 1 ? '' : 's'}`}
                </Button>
              </>
            )}
          </div>
        )}

        {result && phase === 'done' && (
          <div className="mt-4" role="status">
            <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-1">
              Imported {result.importedPlasmids.length} plasmid
              {result.importedPlasmids.length === 1 ? '' : 's'}:{' '}
              {result.importedPlasmids.join(', ')}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              {result.cassettes} cassettes, {result.gmos} GMOs, {result.attachments} attachments,{' '}
              {result.genbankFiles} GenBank files.
            </p>
            {result.addedFeatures.length > 0 && (
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Added nucleic acid features: {result.addedFeatures.join(', ')}
              </p>
            )}
            {result.addedOrganisms.length > 0 && (
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Added organisms: {result.addedOrganisms.join(', ')}
              </p>
            )}
            {result.skippedDuplicateNames.length > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                Duplicate rows in the source were skipped: {result.skippedDuplicateNames.join(', ')}
              </p>
            )}
            <div className="mt-3">
              <Button intent="secondary" size="sm" onClick={reset}>
                Import another file
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
