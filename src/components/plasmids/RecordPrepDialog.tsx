'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Plasmid } from '@/domain/types';
import { Button } from '@/components/ui/Button';
import { recordPrepBatch } from '@/components/labels/api-client';

export interface RecordPrepDialogProps {
  plasmids: Plasmid[];
  /** Pre-filled from Settings.initials */
  defaultInitials: string;
  onClose: () => void;
  onRecorded: (count: number) => void;
}

const todayIso = (): string => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
};

/**
 * Record a prep for every selected plasmid.
 *
 * One date and one set of initials for the batch, one concentration per
 * plasmid — the shape of an actual miniprep session. pJM0084 to pJM0096 all
 * carry 06.11.24 in the lab's spreadsheet; pJM0153 to pJM0161 all carry
 * 12.03.25. Typing the date once is not a convenience, it is what keeps the
 * three values on a label describing the same tube.
 */
export function RecordPrepDialog({
  plasmids,
  defaultInitials,
  onClose,
  onRecorded,
}: RecordPrepDialogProps) {
  const [preppedOn, setPreppedOn] = useState(todayIso);
  const [initials, setInitials] = useState(defaultInitials);
  const [concentrations, setConcentrations] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  const invalid = useMemo(() => {
    return Object.entries(concentrations)
      .filter(([, raw]) => raw.trim().length > 0)
      .filter(([, raw]) => {
        const value = Number(raw.trim().replace(',', '.'));
        return !Number.isFinite(value) || value < 0;
      })
      .map(([id]) => id);
  }, [concentrations]);

  const handleSave = async () => {
    if (invalid.length > 0) {
      setError('Some concentrations are not numbers.');
      return;
    }
    if (initials.trim().length === 0) {
      setError('Initials are required — they are printed on the label.');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      // A blank field means prepped but not yet measured, which the label
      // prints as "xxxx ng/µL" — Julia's own placeholder. It is not zero.
      const entries = plasmids.map((plasmid) => {
        const raw = concentrations[plasmid.id]?.trim();
        return {
          plasmidId: plasmid.id,
          concentrationNgUl: raw ? Number(raw.replace(',', '.')) : null,
        };
      });

      const preps = await recordPrepBatch({
        preppedOn,
        operatorInitials: initials.trim(),
        entries,
      });
      onRecorded(preps.length);
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not record the preps');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="record-prep-title"
        tabIndex={-1}
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-lg border border-gray-700 bg-surface-3 shadow-xl focus:outline-none"
      >
        <div className="border-b border-gray-700 px-6 py-4">
          <h2 id="record-prep-title" className="text-base font-semibold text-gray-100">
            Record prep
          </h2>
          <p className="mt-1 text-sm text-gray-400">
            {plasmids.length} plasmid{plasmids.length === 1 ? '' : 's'} · one date and operator for
            the batch
          </p>
        </div>

        <div className="flex flex-wrap gap-4 border-b border-gray-700 px-6 py-4">
          <label className="flex flex-col gap-1 text-xs text-gray-400">
            Prepped on
            <input
              type="date"
              value={preppedOn}
              onChange={(event) => setPreppedOn(event.target.value)}
              className="h-9 rounded-md border border-gray-700 bg-gray-900 px-2 text-sm text-gray-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-400">
            Initials
            <input
              type="text"
              value={initials}
              maxLength={10}
              onChange={(event) => setInitials(event.target.value)}
              placeholder="JM"
              className="h-9 w-24 rounded-md border border-gray-700 bg-gray-900 px-2 text-sm text-gray-100"
            />
          </label>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="pb-2 font-medium">Plasmid</th>
                <th className="pb-2 font-medium">Construct</th>
                <th className="pb-2 font-medium">Concentration (ng/µL)</th>
              </tr>
            </thead>
            <tbody>
              {plasmids.map((plasmid) => (
                <tr key={plasmid.id} className="border-t border-gray-800">
                  <td className="py-1.5 pr-3 font-medium text-gray-100">{plasmid.name}</td>
                  <td className="py-1.5 pr-3 text-gray-400">{plasmid.constructName || '—'}</td>
                  <td className="py-1.5">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={concentrations[plasmid.id] ?? ''}
                      onChange={(event) =>
                        setConcentrations((prev) => ({
                          ...prev,
                          [plasmid.id]: event.target.value,
                        }))
                      }
                      placeholder="not measured"
                      aria-label={`Concentration for ${plasmid.name}`}
                      aria-invalid={invalid.includes(plasmid.id)}
                      className={`h-8 w-32 rounded-md border bg-gray-900 px-2 text-sm text-gray-100 ${
                        invalid.includes(plasmid.id) ? 'border-red-600' : 'border-gray-700'
                      }`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-gray-700 px-6 py-4">
          <p className="text-xs text-gray-500">
            Leave a field blank if the Nanodrop reading is still to come.
          </p>
          <div className="flex gap-2">
            <Button intent="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              intent="primary"
              size="sm"
              onClick={() => void handleSave()}
              loading={isSaving}
              disabled={invalid.length > 0}
            >
              Record {plasmids.length} prep{plasmids.length === 1 ? '' : 's'}
            </Button>
          </div>
        </div>

        {error && (
          <div role="alert" className="border-t border-red-800 bg-red-900/20 px-6 py-3">
            <p className="text-sm text-red-200">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
