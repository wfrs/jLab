'use client';

/**
 * GlossaryImportSection
 * Uploads a glossary .xlsx template (legacy "Add features/organisms from
 * Excel"). Existing entries are reported, never overwritten, so re-importing
 * a shared lab template is safe.
 */

import { useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import type { GlossaryImportResult } from '@/services/glossary-excel.service';

/** Keys listed inline before the rest are summarized as a count */
const KEY_PREVIEW_LIMIT = 12;

async function postWorkbook(file: File): Promise<GlossaryImportResult> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch('/api/glossary/import', { method: 'POST', body: formData });
  const json = await response.json();
  if (!response.ok) {
    throw new Error(json?.message || 'Import failed');
  }
  return json.data as GlossaryImportResult;
}

function KeyList({ label, keys }: { label: string; keys: string[] }): JSX.Element | null {
  if (keys.length === 0) {
    return null;
  }
  const shown = keys.slice(0, KEY_PREVIEW_LIMIT);
  const hidden = keys.length - shown.length;
  return (
    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
      <span className="text-gray-500 dark:text-gray-500">{label}:</span>{' '}
      <span className="font-mono">{shown.join(', ')}</span>
      {hidden > 0 && <span className="text-gray-500 dark:text-gray-500"> +{hidden} more</span>}
    </p>
  );
}

export function GlossaryImportSection({
  onImported,
}: {
  /** Lets the surrounding tabs reload their tables after a successful import */
  onImported?: () => void;
}): JSX.Element {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<GlossaryImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setIsImporting(true);
    setError(null);
    setResult(null);
    try {
      const imported = await postWorkbook(file);
      setResult(imported);
      onImported?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const totalAdded = (result?.features.added.length ?? 0) + (result?.organisms.added.length ?? 0);

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Import from Excel</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Select a glossary .xlsx file. Sheets named <span className="font-mono">features</span>{' '}
          (columns annotation, alias, risk, organism) and{' '}
          <span className="font-mono">organisms</span> (full_name, short_name, RG) are both
          imported. Entries that already exist are left untouched.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          aria-label="Glossary Excel file"
          disabled={isImporting}
          className="block w-full text-sm text-gray-700 dark:text-gray-300 file:mr-3 file:px-3 file:py-1.5 file:text-sm file:font-medium file:border-0 file:rounded-md file:bg-blue-600 file:text-white hover:file:bg-blue-700 file:cursor-pointer"
          onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
        />

        {isImporting && <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">Importing…</p>}

        {error && (
          <p role="alert" className="mt-3 text-xs font-medium text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        {result && (
          <div role="status" className="mt-4">
            <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
              Added {totalAdded} entr{totalAdded === 1 ? 'y' : 'ies'} from{' '}
              {result.sheetsRead.join(' and ')}.
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              {result.features.added.length} nucleic acid feature
              {result.features.added.length === 1 ? '' : 's'}, {result.organisms.added.length}{' '}
              organism{result.organisms.added.length === 1 ? '' : 's'}.
            </p>

            <KeyList label="Skipped, already present" keys={result.features.skippedExisting} />
            <KeyList
              label="Skipped organisms, already present"
              keys={result.organisms.skippedExisting}
            />
            <KeyList
              label="Skipped, repeated in the file"
              keys={[
                ...result.features.skippedDuplicateInFile,
                ...result.organisms.skippedDuplicateInFile,
              ]}
            />

            {result.normalizedAnnotations.length > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                Renamed to valid cassette tokens:{' '}
                <span className="font-mono">
                  {result.normalizedAnnotations.map((r) => `${r.from} → ${r.to}`).join(', ')}
                </span>
              </p>
            )}

            {result.unresolvedFeatureOrganisms.length > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                Imported features reference organisms that are not in the glossary:{' '}
                <span className="font-mono">{result.unresolvedFeatureOrganisms.join(', ')}</span>.
                Import an organisms file or add them by hand — reports stay blocked until then.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
