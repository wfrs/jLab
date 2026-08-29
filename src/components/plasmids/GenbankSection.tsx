'use client';

/**
 * GenbankSection
 * The plasmid's GenBank file in the detail panel. Legacy parity: one file
 * per plasmid, .gb/.gbk only, a new import replaces the old one, and the
 * presence marker '•' with the stored filename (legacy Plasmids.gb/gb_name).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GenbankMeta } from '@/domain/types';
import { Button } from '@/components/ui/Button';
import { deleteGenbank, genbankDownloadUrl, getGenbankMeta, uploadGenbank } from './api-client';

function formatSize(sizeBytes: number): string {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  return `${(sizeBytes / 1024).toFixed(1)} KB`;
}

export function GenbankSection({ plasmidId }: { plasmidId: string }): JSX.Element {
  const [meta, setMeta] = useState<GenbankMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      setMeta(await getGenbankMeta(plasmidId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load GenBank file');
    } finally {
      setIsLoading(false);
    }
  }, [plasmidId]);

  useEffect(() => {
    setIsLoading(true);
    void refresh();
  }, [refresh]);

  const handleFileChosen = async (file: File | undefined) => {
    if (!file) return;
    try {
      setIsBusy(true);
      setError(null);
      setMeta(await uploadGenbank(plasmidId, file));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload GenBank file');
    } finally {
      setIsBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemove = async () => {
    if (!meta) return;
    if (!window.confirm(`Remove the GenBank file "${meta.filename}"?`)) return;
    try {
      setIsBusy(true);
      setError(null);
      await deleteGenbank(plasmidId);
      setMeta(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove GenBank file');
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <section
      aria-label="GenBank file"
      className="pt-4 border-t border-gray-200 dark:border-gray-700"
    >
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">GenBank</h3>

      {error && (
        <p role="alert" className="mb-2 text-xs font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".gb,.gbk"
        className="hidden"
        aria-label="Choose GenBank file"
        onChange={(e) => void handleFileChosen(e.target.files?.[0])}
      />

      {isLoading ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">Loading…</p>
      ) : meta ? (
        <div className="p-2 rounded border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/40">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-gray-900 dark:text-gray-100 break-all">
              <span aria-hidden="true" className="text-emerald-500 mr-1.5">
                •
              </span>
              {meta.filename}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
              {formatSize(meta.sizeBytes)}
            </span>
          </div>
          <div className="mt-2 flex gap-1">
            <Button
              intent="ghost"
              size="xs"
              onClick={() => {
                window.location.href = genbankDownloadUrl(plasmidId);
              }}
            >
              Download
            </Button>
            <Button
              intent="ghost"
              size="xs"
              disabled={isBusy}
              onClick={() => fileInputRef.current?.click()}
            >
              Replace
            </Button>
            <Button intent="ghost" size="xs" disabled={isBusy} onClick={() => void handleRemove()}>
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-gray-500 dark:text-gray-400">No GenBank file (.gb / .gbk).</p>
          <Button
            intent="secondary"
            size="sm"
            loading={isBusy}
            onClick={() => fileInputRef.current?.click()}
          >
            Import
          </Button>
        </div>
      )}
    </section>
  );
}
