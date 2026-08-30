'use client';

/**
 * DangerZoneSection
 * Clears every table except settings, after backing up the database file.
 *
 * This card sits on the page Julia visits to change her initials, so it is
 * built to be hard to trigger by accident and impossible to trigger without
 * knowing what will go: the exact row counts are fetched and shown first, the
 * backup path is stated before as well as after, and the button stays disabled
 * until the confirmation phrase is typed exactly.
 */

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatBytes } from '@/shared/format-bytes';

const CONFIRMATION = 'DELETE ALL DATA';

interface ResetPreview {
  counts: Record<string, number>;
  totalRows: number;
  databaseSizeBytes: number | null;
  backupDirectory: string | null;
}

interface ResetResult {
  deleted: Record<string, number>;
  totalRows: number;
  backupPath: string;
  backupSizeBytes: number;
  reclaimedBytes: number;
}

/** Human-readable table names, so the list reads as lab objects not schema */
const TABLE_LABELS: Record<string, string> = {
  plasmids: 'Plasmids',
  cassettes: 'Cassettes',
  primers: 'Primers',
  features: 'Features',
  gmos: 'GMO records',
  attachments: 'Attachments',
  genbank_files: 'GenBank files',
  glossary_features: 'Glossary features',
  organisms: 'Glossary organisms',
  organism_targets: 'Target organism list',
  plasmid_preps: 'Preps',
  glycerol_stocks: 'Glycerol stocks',
  label_prints: 'Label print history',
  projects: 'Projects',
  project_plasmids: 'Project links',
  integrations: 'Integrations',
  users: 'Users',
};

export function DangerZoneSection(): JSX.Element {
  const [preview, setPreview] = useState<ResetPreview | null>(null);
  const [isArmed, setIsArmed] = useState(false);
  const [typed, setTyped] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResetResult | null>(null);

  const loadPreview = useCallback(async () => {
    try {
      const response = await fetch('/api/database/reset');
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json?.message || 'Could not read the database contents');
      }
      setPreview(json.data as ResetPreview);
    } catch (previewError) {
      setError(
        previewError instanceof Error ? previewError.message : 'Could not read the database'
      );
    }
  }, []);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  const handleReset = async () => {
    setIsResetting(true);
    setError(null);
    try {
      const response = await fetch('/api/database/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: typed }),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json?.message || 'The reset failed');
      }
      setResult(json.data as ResetResult);
      setIsArmed(false);
      setTyped('');
      await loadPreview();
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'The reset failed');
    } finally {
      setIsResetting(false);
    }
  };

  const nonEmpty = preview
    ? Object.entries(preview.counts)
        .filter(([, count]) => count > 0)
        .sort((a, b) => b[1] - a[1])
    : [];

  return (
    <Card className="border-red-300 dark:border-red-900/60">
      <CardHeader>
        <CardTitle as="h3" className="text-red-700 dark:text-red-400">
          Delete all data
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Empties every table except your settings. A full copy of the database is saved next to
            it first — that copy is the only way back, so keep it until you are sure.
          </p>

          {/* Idle: one line. The full inventory and the warnings appear on arming,
              which is the moment they are actually being weighed. */}
          {preview &&
            (preview.totalRows === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                There is nothing to delete — every table is already empty.
              </p>
            ) : (
              !isArmed && (
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-medium tabular-nums">
                    {preview.totalRows.toLocaleString()}
                  </span>{' '}
                  rows across {nonEmpty.length} tables
                  {preview.databaseSizeBytes !== null && (
                    <span className="text-gray-500 dark:text-gray-400">
                      {' '}
                      · {formatBytes(preview.databaseSizeBytes)} on disk
                    </span>
                  )}
                </p>
              )
            ))}

          {preview && preview.totalRows > 0 && isArmed && (
            <div className="rounded-md border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-900/10 p-3">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {preview.totalRows.toLocaleString()} rows will be deleted
                {preview.databaseSizeBytes !== null && (
                  <span className="font-normal text-gray-500 dark:text-gray-400">
                    {' '}
                    · database is {formatBytes(preview.databaseSizeBytes)}
                  </span>
                )}
              </p>
              <ul className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-gray-600 dark:text-gray-400 sm:grid-cols-3">
                {nonEmpty.map(([table, count]) => (
                  <li key={table} className="flex justify-between gap-2">
                    <span>{TABLE_LABELS[table] ?? table}</span>
                    <span className="tabular-nums text-gray-900 dark:text-gray-200">
                      {count.toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
              {(preview.counts.attachments ?? 0) + (preview.counts.genbank_files ?? 0) > 0 && (
                <p className="mt-3 text-xs text-amber-700 dark:text-amber-400">
                  {preview.counts.attachments ?? 0} attachments and{' '}
                  {preview.counts.genbank_files ?? 0} GenBank files are stored inside the database.
                  They exist nowhere else unless you have kept the originals.
                </p>
              )}
              {(preview.counts.gmos ?? 0) > 0 && (
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                  {preview.counts.gmos} GMO records will go too — these are the rows behind the
                  Formblatt-Z reports.
                </p>
              )}
            </div>
          )}

          {result && (
            <div
              role="status"
              className="rounded-md border border-emerald-300 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-900/20 p-3"
            >
              <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                Deleted {result.totalRows.toLocaleString()} rows.
              </p>
              <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
                Backup saved to <code className="font-mono break-all">{result.backupPath}</code> (
                {formatBytes(result.backupSizeBytes)}).
                {result.reclaimedBytes > 0 &&
                  ` ${formatBytes(result.reclaimedBytes)} freed on disk.`}
              </p>
            </div>
          )}

          {error && (
            <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          {preview && preview.totalRows > 0 && (
            <>
              {!isArmed ? (
                <div>
                  <Button intent="danger" size="sm" onClick={() => setIsArmed(true)}>
                    Delete all data…
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="reset-confirmation"
                    className="text-sm text-gray-700 dark:text-gray-300"
                  >
                    Type <code className="font-mono font-semibold">{CONFIRMATION}</code> to confirm
                  </label>
                  <input
                    id="reset-confirmation"
                    type="text"
                    value={typed}
                    onChange={(event) => setTyped(event.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                    className="w-full max-w-sm px-3 py-2 text-sm font-mono border rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  <div className="flex gap-2">
                    <Button
                      intent="secondary"
                      size="sm"
                      onClick={() => {
                        setIsArmed(false);
                        setTyped('');
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      intent="danger"
                      size="sm"
                      disabled={typed !== CONFIRMATION}
                      loading={isResetting}
                      onClick={() => void handleReset()}
                    >
                      Back up and delete {preview.totalRows.toLocaleString()} rows
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
