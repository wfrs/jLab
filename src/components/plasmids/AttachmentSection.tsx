'use client';

/**
 * AttachmentSection
 * File attachments on the selected plasmid (legacy Attachments frame:
 * add any file, download the stored copy, delete). Files download by
 * navigating to /api/attachments/[id].
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AttachmentMeta } from '@/domain/types';
import { Button } from '@/components/ui/Button';
import {
  attachmentDownloadUrl,
  deleteAttachment,
  listAttachments,
  uploadAttachment,
} from './api-client';

function formatSize(sizeBytes: number): string {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentSection({ plasmidId }: { plasmidId: string }): JSX.Element {
  const [attachments, setAttachments] = useState<AttachmentMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      setAttachments(await listAttachments(plasmidId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load attachments');
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
      setIsUploading(true);
      setError(null);
      const created = await uploadAttachment(plasmidId, file);
      setAttachments((prev) => [created, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload attachment');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (attachment: AttachmentMeta) => {
    if (!window.confirm(`Delete the attachment "${attachment.filename}"? This cannot be undone.`))
      return;
    try {
      setError(null);
      await deleteAttachment(attachment.id);
      setAttachments((prev) => prev.filter((a) => a.id !== attachment.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete attachment');
    }
  };

  return (
    <section
      aria-label="Attachments"
      className="pt-4 border-t border-gray-200 dark:border-gray-700"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Attachments ({attachments.length})
        </h3>
        <Button
          intent="secondary"
          size="sm"
          loading={isUploading}
          onClick={() => fileInputRef.current?.click()}
        >
          Add file
        </Button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        aria-label="Choose attachment file"
        onChange={(e) => void handleFileChosen(e.target.files?.[0])}
      />

      {error && (
        <p role="alert" className="mb-2 text-xs font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {isLoading ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">Loading…</p>
      ) : attachments.length === 0 ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          No attachments yet (e.g. sequencing results, documents).
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {attachments.map((attachment) => (
            <li
              key={attachment.id}
              className="flex items-center justify-between gap-2 p-2 rounded border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/40"
            >
              <a
                href={attachmentDownloadUrl(attachment.id)}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline break-all min-w-0"
                title={`Download ${attachment.filename}`}
              >
                {attachment.filename}
              </a>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  {formatSize(attachment.sizeBytes)}
                </span>
                <Button
                  intent="ghost"
                  size="xs"
                  aria-label={`Delete attachment ${attachment.filename}`}
                  onClick={() => void handleDelete(attachment)}
                >
                  ✕
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
