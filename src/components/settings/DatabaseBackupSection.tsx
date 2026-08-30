'use client';

/**
 * DatabaseBackupSection
 * Downloads a consistent snapshot of the whole database as a .db file.
 *
 * Legacy GMOCU offered this only as a prompt before risky operations
 * ("Shall we make a backup of the current database in the Download folder
 * as gmocu_backup_{date}.db", gmocu.py:1567); jlab keeps the same file one
 * click away at any time. Everything lives in the database — attachments
 * and GenBank files included — so the download IS the full backup, and
 * restoring is replacing the database file with it.
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatBytes } from '@/shared/format-bytes';

export function DatabaseBackupSection(): JSX.Element {
  const [sizeBytes, setSizeBytes] = useState<number | null>(null);

  useEffect(() => {
    // The reset preview already reports the file size; reuse it
    fetch('/api/database/reset')
      .then((response) => response.json())
      .then((json) => setSizeBytes((json?.data?.databaseSizeBytes as number | null) ?? null))
      .catch(() => setSizeBytes(null));
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h3">Backup</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          Download the entire database as one file — plasmids, attachments, GenBank files,
          glossaries and settings included. Keep a copy somewhere safe, and take one before
          importing. To restore, replace the database file with a downloaded backup while the app is
          stopped.
        </p>
        <div className="flex items-center gap-3">
          <Button
            intent="secondary"
            size="sm"
            onClick={() => {
              window.location.href = '/api/database/backup';
            }}
          >
            Download backup
          </Button>
          {sizeBytes !== null && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Current size: {formatBytes(sizeBytes)}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
